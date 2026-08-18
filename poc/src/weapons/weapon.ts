import type { Scene } from 'three'
import { WEAPONS, type WeaponId, type WeaponConfig } from '../core/weaponsCatalog'
import { createShotPool, type ShotPool } from '../gameobjects/shot'
import { WEAPON_REGISTRY } from './registry'
import type { BehaviourCtx } from './behaviour'

export interface Weapon {
  readonly id: WeaponId
  readonly config: WeaponConfig
  readonly pool: ShotPool
  update(ctx: BehaviourCtx): void
  dispose(): void
}

export function createWeapon(id: WeaponId, scene: Scene): Weapon {
  const config = WEAPONS[id]
  const pool = createShotPool(config.poolSize, scene)
  const behaviour = WEAPON_REGISTRY[id](config, pool, scene)

  return {
    id,
    config,
    pool,
    update(ctx: BehaviourCtx): void {
      behaviour.update(ctx)
    },
    dispose(): void {
      behaviour.dispose()
      pool.dispose()
    },
  }
}