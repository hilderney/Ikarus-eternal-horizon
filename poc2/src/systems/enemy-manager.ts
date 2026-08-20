/**
 * SDD-E05 EnemyManager — left / right / front spawn zones + pool.
 * Outside BattleField ⇒ deactivate + pool.release (reuse; no mesh destroy / GC spike).
 */

import { BoxGeometry } from 'three'
import { BALANCE } from '../core/balancer'
import type { BattleField } from '../gameobjects/battle-field/battle-field'
import { Enemy, type SeekTargetPort } from '../gameobjects/enemy/enemy'
import type { SpawnArea } from '../gameobjects/spawn-area/spawn-area'
import { ObjectPool } from '../pools/object-pool'

export type SpawnSide = 'left' | 'right' | 'front'

const SPAWN_SIDES: readonly SpawnSide[] = ['left', 'right', 'front']

export interface ScenePort {
  add(object: unknown): void
  remove(object: unknown): void
}

export interface EnemyManagerOptions {
  readonly scene: ScenePort
  readonly seekTarget: SeekTargetPort
  readonly spawnLeft: SpawnArea
  readonly spawnRight: SpawnArea
  readonly spawnFront: SpawnArea
  readonly battleField: BattleField
  /** Defaults to BALANCE.enemy.poolSize. */
  readonly capacity?: number
}

export class EnemyManager {
  private readonly _scene: ScenePort
  private readonly _areas: Record<SpawnSide, SpawnArea>
  private readonly _battleField: BattleField
  private readonly _seek: SeekTargetPort
  private readonly _geo: BoxGeometry
  private readonly _pool: ObjectPool<Enemy>
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
    this._battleField = options.battleField
    this._seek = options.seekTarget
    this._geo = new BoxGeometry(1, 1, 1)
    const capacity = options.capacity ?? BALANCE.enemy.poolSize
    this._pool = new ObjectPool<Enemy>({
      capacity,
      factory: () => {
        const enemy = new Enemy({ geometry: this._geo, seekTarget: this._seek })
        this._scene.add(enemy)
        return enemy
      },
      reset: (enemy) => {
        enemy.deactivate()
      },
      disposeItem: (enemy) => {
        this._scene.remove(enemy)
        enemy.dispose()
      },
    })
  }

  activeCount(): number {
    return this._pool.activeCount
  }

  spawnOne(side: SpawnSide = this._pickSide()): Enemy | null {
    if (this._disposed) {
      return null
    }
    if (this._pool.activeCount >= this._maxActiveTotal()) {
      return null
    }
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
    enemy.activate({ x, y: center.y, z })
    return enemy
  }

  update(dt: number): void {
    if (this._disposed) {
      return
    }
    for (const side of SPAWN_SIDES) {
      this._acc[side] += dt
      const interval = Math.max(0.05, this._areas[side].intervalSec())
      while (this._acc[side] >= interval) {
        this._acc[side] -= interval
        this.spawnOne(side)
      }
    }

    this._pool.forEachActive((enemy) => {
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
    this._geo.dispose()
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
}
