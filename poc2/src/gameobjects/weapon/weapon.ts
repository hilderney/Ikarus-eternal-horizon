/**
 * SDD-D02 Weapon — device: catalog config + registry behaviour. Pool is E04.
 */

import { copyWeaponConfig, WEAPONS } from './catalog'
import type { WeaponConfig, WeaponId } from './catalog'
import { applyWeaponLevel } from './weapon-levels'
import type { BehaviourCtx, ShotAcquirePort, WeaponBehaviour, WeaponDeps } from './registry'
import { WEAPON_REGISTRY } from './registry'

export interface WeaponOptions {
  readonly id: WeaponId
  readonly shots: ShotAcquirePort
  readonly deps?: WeaponDeps
}

export class Weapon {
  readonly id: WeaponId
  readonly config: WeaponConfig

  private readonly behaviour: WeaponBehaviour

  constructor(options: WeaponOptions) {
    const factory = WEAPON_REGISTRY[options.id]
    if (!factory) {
      throw new Error(`no weapon factory for ${options.id}`)
    }
    this.id = options.id
    this.config = copyWeaponConfig(WEAPONS[options.id])
    this.behaviour = factory(this.config, options.shots, options.deps)
  }

  update(ctx: BehaviourCtx): void {
    this.behaviour.update(ctx)
  }

  applyLevel(level: number): void {
    applyWeaponLevel(this.config, level)
  }

  dispose(): void {
    this.behaviour.dispose()
  }
}
