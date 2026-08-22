/**
 * EnemySquadManager — the simulation hub for post-gate enemies.
 *
 * Frame cadence: rogue roster + group centroid physics.
 * Structural cadence (BALANCE.enemy.squad.tickHz, default 5 Hz): group
 * objectives, formation re-index and a round-robin slice of the affinity
 * migration mesh. Groups and rosters are preallocated, so a heavy wave never
 * allocates.
 */

import { BALANCE } from '../core/balancer'
import { EnemyGroup, type GroupMemberPort, type GroupWorldContext } from './enemy-group'
import { cloneSquadConfig, type EditableSquadConfig, type SquadConfig } from './squad-config'

/** Affinity tuning read from each ship's sheet. */
export interface AffinityTuning {
  readonly gainPerSec: number
  readonly decayPerSec: number
  readonly radius: number
  readonly loyalty: number
}

/** What the squad needs from a ship (Enemy satisfies it structurally). */
export interface SquadShipPort extends GroupMemberPort {
  readonly active: boolean
  readonly vx: number
  readonly vz: number
  /** FURY / FLEE ships own the right of way and never migrate. */
  isRogue(): boolean
  currentGroup(): EnemyGroup | null
  /** One float per group id, allocated once by the ship. */
  readonly affinity: Float32Array
  affinityTuning(): AffinityTuning
  /** Called after a successful slot reservation in a foreign group. */
  onMigrationStart(): void
}

/** Slice of the squad a ship talks to (EnemySquadManager satisfies it). */
export interface SquadRegistryPort {
  register(ship: SquadShipPort): boolean
  detachFromGroup(ship: SquadShipPort): void
  unregister(ship: SquadShipPort): void
  rogueCount(): number
  rogueAt(index: number): SquadShipPort | null
  liveConfig(): SquadConfig
  arenaMinX(): number
  arenaMaxX(): number
}

export interface EnemySquadManagerOptions {
  readonly capacity?: number
  readonly rand?: () => number
}

/** Max structural ticks consumed in one frame (spiral-of-death guard). */
const MAX_TICKS_PER_FRAME = 4

type MutableWorldContext = {
  -readonly [K in keyof GroupWorldContext]: GroupWorldContext[K]
}

export class EnemySquadManager {
  private readonly _config: EditableSquadConfig = cloneSquadConfig(BALANCE.enemy.squad)
  private readonly _groups: EnemyGroup[] = []
  private readonly _ships: (SquadShipPort | null)[]
  private readonly _rogues: (SquadShipPort | null)[]
  private readonly _rand: () => number
  private readonly _ctx: MutableWorldContext = { playerX: 0, playerZ: 0, minX: -1, maxX: 1 }
  private _shipCount = 0
  private _rogueCount = 0
  private _cursor = 0
  private _acc = 0

  constructor(options: EnemySquadManagerOptions = {}) {
    this._rand = options.rand ?? Math.random
    const capacity = Math.max(1, options.capacity ?? BALANCE.enemy.poolSize)
    this._ships = new Array<SquadShipPort | null>(capacity).fill(null)
    this._rogues = new Array<SquadShipPort | null>(capacity).fill(null)
    for (let i = 0; i < this._config.maxGroups; i += 1) {
      this._groups.push(new EnemyGroup(i, this._config, this._rand))
    }
  }

  /** Live squad tuning used by the Squad debugger tab. */
  liveConfig(): EditableSquadConfig {
    return this._config
  }

  resetLiveConfig(): void {
    Object.assign(this._config, cloneSquadConfig(BALANCE.enemy.squad))
  }

  groups(): readonly EnemyGroup[] {
    return this._groups
  }

  activeGroupCount(): number {
    let n = 0
    for (let i = 0; i < this._groups.length; i += 1) {
      if (this._groups[i]?.active) {
        n += 1
      }
    }
    return n
  }

  trackedCount(): number {
    return this._shipCount
  }

  /** Containment bounds of the visible arena (ship relative, last frame). */
  arenaMinX(): number {
    return this._ctx.minX
  }

  arenaMaxX(): number {
    return this._ctx.maxX
  }

  rogueCount(): number {
    return this._rogueCount
  }

  rogueAt(index: number): SquadShipPort | null {
    return index >= 0 && index < this._rogueCount ? (this._rogues[index] ?? null) : null
  }

  /** Track a ship that just cleared the gate and give it a slot. */
  register(ship: SquadShipPort): boolean {
    if (this._indexOf(ship) < 0) {
      if (this._shipCount >= this._ships.length) {
        return false
      }
      this._ships[this._shipCount] = ship
      this._shipCount += 1
      ship.affinity.fill(0)
    }
    return this._assignGroup(ship)
  }

  /** Leave the formation but stay tracked (FURY / FLEE turn the ship rogue). */
  detachFromGroup(ship: SquadShipPort): void {
    ship.currentGroup()?.releaseSlot(ship)
  }

  /** Death / despawn: drop the slot and stop tracking. */
  unregister(ship: SquadShipPort): void {
    ship.currentGroup()?.releaseSlot(ship)
    const index = this._indexOf(ship)
    if (index < 0) {
      return
    }
    const last = this._shipCount - 1
    this._ships[index] = this._ships[last] ?? null
    this._ships[last] = null
    this._shipCount -= 1
    if (this._cursor > this._shipCount) {
      this._cursor = 0
    }
  }

  /**
   * Frame step: refresh the rogue roster, move every group centroid and drain
   * the structural tick accumulator.
   */
  update(dt: number, playerX: number, playerZ: number, minX: number, maxX: number): void {
    const cfg = this._config
    const half = Math.max(1, cfg.arenaHalfX)
    this._ctx.playerX = playerX
    this._ctx.playerZ = playerZ
    this._ctx.minX = Math.max(minX, playerX - half)
    this._ctx.maxX = Math.min(maxX, playerX + half)
    if (this._ctx.minX >= this._ctx.maxX) {
      this._ctx.minX = minX
      this._ctx.maxX = maxX
    }

    this._refreshRogues()
    for (let i = 0; i < this._groups.length; i += 1) {
      this._groups[i]?.integrate(dt, this._ctx, this._groups)
    }

    const step = 1 / Math.max(0.5, cfg.tickHz)
    this._acc += dt
    let ticks = 0
    while (this._acc >= step && ticks < MAX_TICKS_PER_FRAME) {
      this._acc -= step
      ticks += 1
      this._structuralTick(step * 1000)
    }
    if (ticks >= MAX_TICKS_PER_FRAME) {
      this._acc = 0
    }
  }

  reset(): void {
    for (let i = 0; i < this._groups.length; i += 1) {
      this._groups[i]?.reset()
    }
    this._ships.fill(null)
    this._rogues.fill(null)
    this._shipCount = 0
    this._rogueCount = 0
    this._cursor = 0
    this._acc = 0
  }

  private _structuralTick(dtMs: number): void {
    for (let i = 0; i < this._groups.length; i += 1) {
      this._groups[i]?.tick(dtMs, this._ctx)
    }
    const slice = Math.max(1, Math.floor(this._config.shipsPerTick))
    const dtSec = dtMs / 1000
    for (let n = 0; n < slice && n < this._shipCount; n += 1) {
      if (this._cursor >= this._shipCount) {
        this._cursor = 0
      }
      const ship = this._ships[this._cursor] ?? null
      this._cursor += 1
      if (ship) {
        this._tickAffinity(ship, dtSec)
      }
    }
  }

  /** Proximity feeds affinity; a clear win over loyalty triggers migration. */
  private _tickAffinity(ship: SquadShipPort, dtSec: number): void {
    if (!ship.active || ship.isRogue()) {
      return
    }
    const tuning = ship.affinityTuning()
    const affinity = ship.affinity
    const native = ship.currentGroup()
    let bestId = -1
    let bestValue = 0

    for (let i = 0; i < this._groups.length && i < affinity.length; i += 1) {
      const group = this._groups[i]
      if (!group || !group.active) {
        affinity[i] = 0
        continue
      }
      const close = group.distanceTo(ship.x, ship.z) <= tuning.radius
      const next = close
        ? (affinity[i] ?? 0) + tuning.gainPerSec * dtSec
        : (affinity[i] ?? 0) - tuning.decayPerSec * dtSec
      affinity[i] = Math.min(1, Math.max(0, next))
      if (group !== native && group.hasFreeSlot() && (affinity[i] ?? 0) > bestValue) {
        bestValue = affinity[i] ?? 0
        bestId = i
      }
    }

    if (!native) {
      this._assignGroup(ship)
      return
    }
    if (bestId < 0) {
      return
    }
    const nativeValue = (affinity[native.id] ?? 0) + tuning.loyalty
    if (bestValue <= nativeValue) {
      return
    }
    const target = this._groups[bestId]
    if (!target) {
      return
    }
    native.releaseSlot(ship)
    if (target.reserveSlot(ship) < 0) {
      this._assignGroup(ship)
      return
    }
    ship.onMigrationStart()
  }

  /** Nearest group with room, else a fresh group, else the emptiest one. */
  private _assignGroup(ship: SquadShipPort): boolean {
    const cfg = this._config
    const limit = Math.min(this._groups.length, Math.max(1, Math.floor(cfg.maxGroups)))
    let nearest: EnemyGroup | null = null
    let nearestDist = Number.POSITIVE_INFINITY
    let emptiest: EnemyGroup | null = null
    let free: EnemyGroup | null = null

    for (let i = 0; i < limit; i += 1) {
      const group = this._groups[i]
      if (!group) {
        continue
      }
      if (!group.active) {
        free = free ?? group
        continue
      }
      if (!group.hasFreeSlot()) {
        continue
      }
      const d = group.distanceTo(ship.x, ship.z)
      if (d < nearestDist) {
        nearestDist = d
        nearest = group
      }
      if (!emptiest || group.memberCount() < emptiest.memberCount()) {
        emptiest = group
      }
    }

    if (nearest && nearestDist <= cfg.joinRadius) {
      return nearest.reserveSlot(ship) >= 0
    }
    if (free) {
      free.spawnAt(ship.x, ship.z, this._ctx)
      return free.reserveSlot(ship) >= 0
    }
    const fallback = emptiest ?? nearest
    return fallback ? fallback.reserveSlot(ship) >= 0 : false
  }

  private _refreshRogues(): void {
    this._rogueCount = 0
    for (let i = 0; i < this._shipCount; i += 1) {
      const ship = this._ships[i]
      if (ship && ship.active && ship.isRogue()) {
        this._rogues[this._rogueCount] = ship
        this._rogueCount += 1
      }
    }
  }

  private _indexOf(ship: SquadShipPort): number {
    for (let i = 0; i < this._shipCount; i += 1) {
      if (this._ships[i] === ship) {
        return i
      }
    }
    return -1
  }
}
