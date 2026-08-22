/**
 * SDD-E05 EnemyManager — left / right / front spawn + EnemyGate rush + pool.
 * Outside BattleField ⇒ deactivate + pool.release (reuse; no mesh destroy / GC spike).
 *
 * Owns the EnemySquadManager: groups are stepped before the ships each frame so
 * every craft steers against a fresh centroid and slot.
 */

import { BoxGeometry } from 'three'
import { BALANCE } from '../core/balancer'
import type { BattleField } from '../gameobjects/battle-field/battle-field'
import type { EnemyGate, GateEntryBand } from '../gameobjects/enemy-gate/enemy-gate'
import { Enemy, type EnemyStatusSnapshot, type SeekTargetPort } from '../gameobjects/enemy/enemy'
import {
  cloneWarriorSheet,
  type EditableWarriorSheet,
  WARRIOR,
} from '../gameobjects/enemy/warrior'
import type { SpawnArea } from '../gameobjects/spawn-area/spawn-area'
import { ObjectPool } from '../pools/object-pool'
import { EnemySquadManager } from './enemy-squad-manager'
import type { ShotAcquirePort } from './shot-manager'

export type SpawnSide = 'left' | 'right' | 'front'

const SPAWN_SIDES: readonly SpawnSide[] = ['left', 'right', 'front']

function entryBandForSide(side: SpawnSide): GateEntryBand {
  if (side === 'left') {
    return 'left'
  }
  if (side === 'right') {
    return 'right'
  }
  return 'middle'
}
export interface ScenePort {
  add(object: unknown): void
  remove(object: unknown): void
}

export interface EnemyManagerOptions {
  readonly scene: ScenePort
  readonly seekTarget: SeekTargetPort
  readonly gateTarget: SeekTargetPort
  readonly spawnLeft: SpawnArea
  readonly spawnRight: SpawnArea
  readonly spawnFront: SpawnArea
  readonly enemyGate: EnemyGate
  readonly battleField: BattleField
  readonly shots?: ShotAcquirePort
  /** F01 register/unregister live enemies. */
  readonly colliders?: {
    registerTarget(t: Enemy): void
    unregisterTarget(t: Enemy): void
  }
  /** Defaults to BALANCE.enemy.poolSize. */
  readonly capacity?: number
}

export class EnemyManager {
  private readonly _scene: ScenePort
  private readonly _areas: Record<SpawnSide, SpawnArea>
  private readonly _enemyGate: EnemyGate
  private readonly _gateTarget: { x: number; y: number; z: number }
  private readonly _battleField: BattleField
  private readonly _seek: SeekTargetPort
  private readonly _shots: ShotAcquirePort | null
  private readonly _colliders: EnemyManagerOptions['colliders'] | null
  private readonly _geo: BoxGeometry
  private readonly _squad: EnemySquadManager
  private readonly _pool: ObjectPool<Enemy>
  private readonly _liveSheet: EditableWarriorSheet = cloneWarriorSheet(WARRIOR)
  private readonly _acc: Record<SpawnSide, number> = { left: 0, right: 0, front: 0 }
  private readonly _lane: Record<SpawnSide, number> = { left: 0, right: 0, front: 0 }
  private _disposed = false

  constructor(options: EnemyManagerOptions) {
    this._scene = options.scene
    this._areas = {
      left: options.spawnLeft,
      right: options.spawnRight,
      front: options.spawnFront,
    }
    this._enemyGate = options.enemyGate
    this._gateTarget = options.gateTarget as { x: number; y: number; z: number }
    this._battleField = options.battleField
    this._seek = options.seekTarget
    this._shots = options.shots ?? null
    this._colliders = options.colliders ?? null
    this._geo = new BoxGeometry(1, 1, 1)
    const capacity = options.capacity ?? BALANCE.enemy.poolSize
    this._squad = new EnemySquadManager({ capacity })
    this._pool = new ObjectPool<Enemy>({
      capacity,
      factory: () => {
        const enemy = new Enemy({
          geometry: this._geo,
          seekTarget: this._seek,
          gateTarget: this._gateTarget,
          shots: this._shots ?? undefined,
          squad: this._squad,
        })
        this._scene.add(enemy)
        return enemy
      },
      reset: (enemy) => {
        this._colliders?.unregisterTarget(enemy)
        enemy.deactivate()
      },
      disposeItem: (enemy) => {
        this._colliders?.unregisterTarget(enemy)
        this._scene.remove(enemy)
        enemy.dispose()
      },
    })
  }

  activeCount(): number {
    return this._pool.activeCount
  }

  /** Macro AI hub (groups, formations, affinity) — debugger + tests. */
  squad(): EnemySquadManager {
    return this._squad
  }

  /** Live Warrior sheet used by new spawns and the Enemy debugger tab. */
  liveSheet(): EditableWarriorSheet {
    return this._liveSheet
  }

  resetLiveSheet(): void {
    const fresh = cloneWarriorSheet(WARRIOR)
    Object.assign(this._liveSheet, {
      ...fresh,
      targets: [...fresh.targets],
      weapon: { ...fresh.weapon },
      status: { ...fresh.status },
      formation: { ...fresh.formation },
      morale: { ...fresh.morale },
      affinity: { ...fresh.affinity },
    })
    this._applyLiveSheetToActive()
  }

  /** Push current live sheet onto every active enemy (no pose reset). */
  applyLiveSheetToActive(): void {
    this._applyLiveSheetToActive()
  }

  forEachActive(fn: (enemy: Enemy) => void): void {
    this._pool.forEachActive(fn)
  }

  firstActiveStatus(): EnemyStatusSnapshot | null {
    let snap: EnemyStatusSnapshot | null = null
    this._pool.forEachActive((enemy) => {
      if (!snap) {
        snap = enemy.statusSnapshot()
      }
    })
    return snap
  }

  spawnOne(side: SpawnSide = this._pickSide()): Enemy | null {
    if (this._disposed) {
      return null
    }
    if (this._pool.activeCount >= this._maxActiveTotal()) {
      return null
    }
    this._syncGateAim()
    const area = this._areas[side]
    const enemy = this._pool.acquire()
    if (!enemy) {
      return null
    }
    const center = area.worldCenter()
    const size = area.size()
    const lanes = area.lanesX()
    let x: number
    if (lanes.length > 0) {
      const cursor = this._lane[side]
      const lane = lanes[cursor % lanes.length] ?? 0
      this._lane[side] = cursor + 1
      x = center.x + lane
    } else {
      x = center.x + (Math.random() - 0.5) * size.x
    }
    const z = center.z + (Math.random() - 0.5) * size.z
    const gateEntryOffsetX = this._enemyGate.pickEntryOffsetX(entryBandForSide(side))
    enemy.activate({
      x,
      y: center.y,
      z,
      sheet: this._liveSheet,
      gateEntryOffsetX,
      pathSide: side,
    })
    this._colliders?.registerTarget(enemy)
    return enemy
  }

  update(dt: number): void {
    if (this._disposed) {
      return
    }
    this._syncGateAim()
    for (const side of SPAWN_SIDES) {
      this._acc[side] += dt
      const interval = Math.max(0.05, this._areas[side].intervalSec())
      while (this._acc[side] >= interval) {
        this._acc[side] -= interval
        this.spawnOne(side)
      }
    }

    const bounds = this._battleField.worldBounds()
    this._squad.update(dt, this._seek.x, this._seek.z, bounds.minX, bounds.maxX)

    this._pool.forEachActive((enemy) => {
      if (!this._battleField.contains(enemy.x, enemy.z)) {
        this._pool.release(enemy)
        return
      }
      enemy.update(dt)
      if (!enemy.active || enemy.hp <= 0 || !this._battleField.contains(enemy.x, enemy.z)) {
        this._pool.release(enemy)
      }
    })
  }

  syncRender(): void {
    if (this._disposed) {
      return
    }
    this._pool.forEachActive((enemy) => {
      enemy.syncRender()
    })
  }

  dispose(): void {
    if (this._disposed) {
      return
    }
    this._disposed = true
    this._pool.dispose()
    this._squad.reset()
    this._geo.dispose()
  }

  private _syncGateAim(): void {
    // Shared port stays at gate centre; each enemy adds its own entryOffsetX.
    const center = this._enemyGate.worldCenter()
    this._gateTarget.x = center.x
    this._gateTarget.y = center.y
    this._gateTarget.z = center.z
  }

  private _maxActiveTotal(): number {
    return Math.max(
      1,
      this._areas.left.maxActive() + this._areas.right.maxActive() + this._areas.front.maxActive(),
    )
  }

  private _pickSide(): SpawnSide {
    return SPAWN_SIDES[Math.floor(Math.random() * SPAWN_SIDES.length)] ?? 'front'
  }

  private _applyLiveSheetToActive(): void {
    this._pool.forEachActive((enemy) => {
      enemy.applyLiveSheet(this._liveSheet)
    })
  }
}
