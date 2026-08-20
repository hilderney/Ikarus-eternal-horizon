/**
 * SDD-F02 DropManager — tables, magnet pull, inventory collection (RES-01..05).
 * Owns spawn/release of pooled Drop fragments; never scores or damages.
 */

import { BALANCE } from '../core/balancer'
import { distXZ } from '../core/math'
import type { Drop, DropPull, DropSpawn, ResourceId } from '../gameobjects/drop/drop'

export type { ResourceId, DropSpawn } from '../gameobjects/drop/drop'
export { Drop } from '../gameobjects/drop/drop'

export type DropSource = 'enemy' | 'meteor' | 'miniBoss' | 'megaAsteroid' | 'boss'

export interface DropTableEntry {
  readonly id: ResourceId
  readonly chance: number
  readonly min: number
  readonly max: number
}

export interface InventoryPort {
  count(id: ResourceId): number
  cap(id: ResourceId): number
  /** Returns the amount actually accepted (0 if at cap). */
  tryAdd(id: ResourceId, amount: number): number
}

export interface MagnetTargetPort {
  readonly x: number
  readonly z: number
}

export interface DropPoolPort {
  acquire(): Drop | null
  release(d: Drop): void
  forEachActive(fn: (d: Drop) => void): void
  dispose(): void
}

export interface DropColliderPort {
  registerTarget(t: Drop): void
  unregisterTarget(t: Drop): void
}

export interface DropManagerOptions {
  readonly pool: DropPoolPort
  readonly inventory: InventoryPort
  readonly magnet: MagnetTargetPort
  readonly colliders: DropColliderPort
  /** Injected for tests; defaults to Math.random. */
  readonly rand?: () => number
  /** Player contact radius for proximity collect. Defaults from ship visual. */
  readonly shipRadius?: number
}

export interface DropGrant {
  id: ResourceId
  amount: number
}

const GRANT_SCRATCH: DropGrant[] = []
const PULL_SCRATCH: DropPull = { x: 0, z: 0, speed: 0 }

/** Roll a drop table into a reused scratch list (no per-frame use). */
export function rollTable(
  table: readonly DropTableEntry[],
  rand: () => number,
): readonly DropGrant[] {
  GRANT_SCRATCH.length = 0
  for (let i = 0; i < table.length; i++) {
    const entry = table[i]
    if (!entry || entry.chance <= 0 || entry.max <= 0) {
      continue
    }
    if (rand() >= entry.chance) {
      continue
    }
    const span = entry.max - entry.min
    const amount =
      span <= 0 ? entry.min : entry.min + Math.floor(rand() * (span + 1))
    if (amount <= 0) {
      continue
    }
    GRANT_SCRATCH.push({ id: entry.id, amount })
  }
  return GRANT_SCRATCH
}

function isOffField(x: number, z: number): boolean {
  const box = BALANCE.drops.despawn
  return Math.abs(x) > box.halfX || z > box.zNear || z < box.zFar
}

function defaultShipRadius(): number {
  const size = BALANCE.ship.visual.size
  return Math.max(size.w, size.d) * 0.5
}

export class DropManager {
  private readonly _pool: DropPoolPort
  private readonly _inventory: InventoryPort
  private readonly _magnet: MagnetTargetPort
  private readonly _colliders: DropColliderPort
  private readonly _rand: () => number
  private readonly _shipRadius: number
  private readonly _toRelease: Drop[] = []
  private _live = 0
  private _disposed = false

  constructor(options: DropManagerOptions) {
    this._pool = options.pool
    this._inventory = options.inventory
    this._magnet = options.magnet
    this._colliders = options.colliders
    this._rand = options.rand ?? Math.random
    this._shipRadius = options.shipRadius ?? defaultShipRadius()
  }

  /** E06 FragmentSink + F04 killed hook. */
  onSourceKilled(source: DropSource, x: number, z: number): void {
    if (this._disposed) {
      return
    }
    const table = BALANCE.drops.tables[source]
    const grants = rollTable(table, this._rand)
    for (let i = 0; i < grants.length; i++) {
      const grant = grants[i]
      if (!grant) {
        continue
      }
      this._spawnAt(x, z, grant.id, grant.amount)
    }
  }

  onMeteorDestroyed(meteor: { x: number; z: number; size: 'S' | 'M' | 'L' }): void {
    void meteor.size
    this.onSourceKilled('meteor', meteor.x, meteor.z)
  }

  collect(drop: Drop): void {
    if (this._disposed || !drop.active) {
      return
    }
    const accepted = this._inventory.tryAdd(drop.resourceId, drop.amount)
    if (accepted <= 0) {
      return
    }
    this._release(drop)
  }

  update(dt: number): void {
    if (this._disposed) {
      return
    }
    const magnetR = BALANCE.drops.magnetRadius
    const magnetSpd = BALANCE.drops.magnetSpeed
    const mx = this._magnet.x
    const mz = this._magnet.z
    const shipR = this._shipRadius
    this._toRelease.length = 0

    this._pool.forEachActive((drop) => {
      const d = distXZ(drop.x, drop.z, mx, mz)
      let pull: DropPull | null = null
      if (d <= magnetR) {
        PULL_SCRATCH.x = mx
        PULL_SCRATCH.z = mz
        PULL_SCRATCH.speed = magnetSpd
        pull = PULL_SCRATCH
      }
      drop.update(dt, pull)

      if (isOffField(drop.x, drop.z)) {
        this._toRelease.push(drop)
        return
      }

      const collectR = drop.radius + shipR
      if (distXZ(drop.x, drop.z, mx, mz) <= collectR) {
        this.collect(drop)
      }
    })

    for (let i = 0; i < this._toRelease.length; i++) {
      const drop = this._toRelease[i]
      if (drop) {
        this._release(drop)
      }
    }
    this._toRelease.length = 0
  }

  syncRender(): void {
    if (this._disposed) {
      return
    }
    this._pool.forEachActive((drop) => {
      drop.syncRender()
    })
  }

  liveCount(): number {
    return this._live
  }

  dispose(): void {
    if (this._disposed) {
      return
    }
    this._disposed = true
    this._pool.forEachActive((drop) => {
      this._colliders.unregisterTarget(drop)
    })
    this._pool.dispose()
    this._live = 0
    this._toRelease.length = 0
  }

  private _spawnAt(x: number, z: number, id: ResourceId, amount: number): void {
    const drop = this._pool.acquire()
    if (!drop) {
      return
    }
    const spawn: DropSpawn = { x, z, id, amount }
    drop.activate(spawn)
    this._colliders.registerTarget(drop)
    this._live++
  }

  private _release(drop: Drop): void {
    if (!drop.active) {
      return
    }
    this._colliders.unregisterTarget(drop)
    drop.deactivate()
    this._pool.release(drop)
    if (this._live > 0) {
      this._live--
    }
  }
}
