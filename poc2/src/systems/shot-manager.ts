/**
 * SDD-E04 ShotManager — owns projectile pools by origin.
 * Weapon / Laser / Plasma only acquire(). D14: scene.add on fill.
 */

import { distXZ } from '../core/math'
import { ObjectPool } from '../pools/object-pool'

export type ShotOrigin = 'weapon' | 'enemy' | 'bomb'

export interface ShotLike {
  active: boolean
  lifetime: number
  x: number
  z: number
  /** Fire point. Weapon origin expires by distance from here, not a world AABB. */
  spawnX: number
  spawnZ: number
  /** 0 = ignore range (lifetime only). Laser L1 = 30. */
  range: number
  activate(spawn: unknown): void
  update(dt: number): void
  syncRender(): void
  deactivate(): void
}

export interface ShotAcquirePort {
  acquire(): ShotLike | null
}

export interface ShotDespawn {
  readonly zNear: number
  readonly zFar: number
  readonly halfX: number
}

export interface ScenePort {
  add(object: unknown): void
  remove(object: unknown): void
}

export interface ShotManagerOptions {
  readonly scene: ScenePort
  readonly weaponFactory: () => ShotLike
  readonly weaponCapacity: number
  readonly despawn: ShotDespawn
  readonly enemyFactory?: () => ShotLike
  readonly enemyCapacity?: number
  readonly bombFactory?: () => ShotLike
  readonly bombCapacity?: number
}

function neverFactory(): ShotLike {
  throw new Error('empty origin factory must not run')
}

function isPastRange(shot: ShotLike): boolean {
  return shot.range > 0 && distXZ(shot.x, shot.z, shot.spawnX, shot.spawnZ) >= shot.range
}

/** Absolute world box — enemy/bomb only. Player bolts use range-from-spawn. */
function isOffField(shot: ShotLike, despawn: ShotDespawn): boolean {
  return (
    Math.abs(shot.x) > despawn.halfX || shot.z > despawn.zNear || shot.z < despawn.zFar
  )
}

export class ShotManager {
  private readonly _scene: ScenePort
  private readonly _despawn: ShotDespawn
  private readonly _weapon: ObjectPool<ShotLike>
  private readonly _enemy: ObjectPool<ShotLike>
  private readonly _bomb: ObjectPool<ShotLike>
  private readonly _pools: readonly ObjectPool<ShotLike>[]
  private readonly _acquirePort: ShotAcquirePort

  constructor(options: ShotManagerOptions) {
    this._scene = options.scene
    this._despawn = options.despawn

    this._weapon = this.makePool(
      options.weaponCapacity,
      options.weaponFactory,
    )
    this._enemy = this.makePool(options.enemyCapacity ?? 0, options.enemyFactory ?? neverFactory)
    this._bomb = this.makePool(options.bombCapacity ?? 0, options.bombFactory ?? neverFactory)
    this._pools = [this._weapon, this._enemy, this._bomb]
    this._acquirePort = {
      acquire: () => this.acquire('weapon'),
    }
  }

  asAcquirePort(): ShotAcquirePort {
    return this._acquirePort
  }

  asEnemyAcquirePort(): ShotAcquirePort {
    return {
      acquire: () => this.acquire('enemy'),
    }
  }

  acquire(origin: ShotOrigin): ShotLike | null {
    return this.pool(origin).acquire()
  }

  release(origin: ShotOrigin, shot: ShotLike): void {
    this.pool(origin).release(shot)
  }

  pools(): readonly ObjectPool<ShotLike>[] {
    return this._pools
  }

  pool(origin: ShotOrigin): ObjectPool<ShotLike> {
    if (origin === 'weapon') {
      return this._weapon
    }
    if (origin === 'enemy') {
      return this._enemy
    }
    return this._bomb
  }

  update(dt: number): void {
    this.updateOrigin('weapon', this._weapon, dt)
    this.updateOrigin('enemy', this._enemy, dt)
    this.updateOrigin('bomb', this._bomb, dt)
  }

  syncRender(): void {
    this._weapon.forEachActive((shot) => {
      shot.syncRender()
    })
    this._enemy.forEachActive((shot) => {
      shot.syncRender()
    })
    this._bomb.forEachActive((shot) => {
      shot.syncRender()
    })
  }

  clear(origin: ShotOrigin): void {
    this.pool(origin).clear()
  }

  clearAll(): void {
    this._weapon.clear()
    this._enemy.clear()
    this._bomb.clear()
  }

  dispose(): void {
    this._weapon.dispose()
    this._enemy.dispose()
    this._bomb.dispose()
  }

  private makePool(capacity: number, factory: () => ShotLike): ObjectPool<ShotLike> {
    const scene = this._scene
    return new ObjectPool<ShotLike>({
      capacity,
      factory: () => {
        const shot = factory()
        scene.add(shot)
        return shot
      },
      reset: (shot) => {
        shot.deactivate()
      },
      disposeItem: (shot) => {
        scene.remove(shot)
        shot.deactivate()
      },
    })
  }

  private updateOrigin(origin: ShotOrigin, pool: ObjectPool<ShotLike>, dt: number): void {
    pool.forEachActive((shot) => {
      shot.update(dt)
      const expired =
        origin === 'weapon'
          ? shot.lifetime <= 0 || isPastRange(shot)
          : shot.lifetime <= 0 || isOffField(shot, this._despawn)
      if (expired) {
        this.release(origin, shot)
      }
    })
  }
}
