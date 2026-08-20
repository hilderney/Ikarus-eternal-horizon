/**
 * SDD-E05 EnemyManager — spawn schedule + pool. Test mode: maxActive live bodies.
 */

import { BoxGeometry } from 'three'
import { BALANCE } from '../core/balancer'
import { Enemy, type SeekTargetPort } from '../gameobjects/enemy/enemy'
import type { SpawnArea } from '../gameobjects/spawn-area/spawn-area'
import { ObjectPool } from '../pools/object-pool'

export interface ScenePort {
  add(object: unknown): void
  remove(object: unknown): void
}

export interface EnemyManagerOptions {
  readonly scene: ScenePort
  readonly seekTarget: SeekTargetPort
  readonly spawnArea: SpawnArea
  /** Defaults to BALANCE.enemy.poolSize. */
  readonly capacity?: number
}

export class EnemyManager {
  private readonly _scene: ScenePort
  private readonly _spawnArea: SpawnArea
  private readonly _seek: SeekTargetPort
  private readonly _geo: BoxGeometry
  private readonly _pool: ObjectPool<Enemy>
  private _spawnAcc = 0
  private _laneCursor = 0
  private _disposed = false

  constructor(options: EnemyManagerOptions) {
    this._scene = options.scene
    this._spawnArea = options.spawnArea
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

  spawnOne(): Enemy | null {
    if (this._disposed) {
      return null
    }
    if (this._pool.activeCount >= this._spawnAreaMaxActive()) {
      return null
    }
    const enemy = this._pool.acquire()
    if (!enemy) {
      return null
    }
    const center = this._spawnArea.worldCenter()
    const size = this._spawnArea.size()
    const lanes = this._spawnArea.lanesX()
    let x: number
    if (lanes.length > 0) {
      const lane = lanes[this._laneCursor % lanes.length] ?? 0
      this._laneCursor += 1
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
    this._spawnAcc += dt
    const interval = Math.max(0.05, this._spawnArea.intervalSec())
    while (this._spawnAcc >= interval) {
      this._spawnAcc -= interval
      this.spawnOne()
    }

    this._pool.forEachActive((enemy) => {
      enemy.update(dt)
      if (!enemy.active || enemy.hp <= 0 || enemy.isOffField()) {
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

  private _spawnAreaMaxActive(): number {
    return Math.max(1, this._spawnArea.maxActive())
  }
}
