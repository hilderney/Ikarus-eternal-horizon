/**
 * SDD-D04 PlasmaBehaviour — slow orbs via E04 acquire. AoE is F01 later.
 */

import type { ShotSpawn } from '../../shot/weapon-shot'
import type { WeaponConfig } from '../catalog'
import { registerWeapon } from '../registry'
import type { BehaviourCtx, ShotAcquirePort, WeaponBehaviour } from '../registry'

export class PlasmaBehaviour implements WeaponBehaviour {
  private cooldown = 0

  constructor(
    private readonly config: WeaponConfig,
    private readonly shots: ShotAcquirePort,
  ) {
    if (!config.orb) {
      throw new Error(`plasma weapon ${config.id} missing orb spec`)
    }
  }

  update(ctx: BehaviourCtx): void {
    const spec = this.config.orb
    if (!spec) {
      return
    }
    this.cooldown -= ctx.dt
    if (!ctx.holding || this.cooldown > 0) {
      return
    }

    const cost = this.config.energyPerShot * ctx.mods.energyMul
    if (!ctx.services.energy.canAfford(cost)) {
      return
    }
    ctx.services.energy.spend(cost)

    const shot = this.shots.acquire()
    if (!shot) {
      return
    }

    const spawn: ShotSpawn = {
      x: ctx.muzzle.x,
      z: ctx.muzzle.z,
      vx: 0,
      vz: -spec.speed,
      damage: this.config.damage * ctx.mods.damageMul,
      lifetime: spec.lifetime,
      totalLifetime: spec.lifetime,
      radius: spec.radius,
      aoeRadius: spec.aoeRadius * ctx.mods.aoeMul,
      range: spec.speed * spec.lifetime,
      decayPerUnit: spec.damageDecayPerUnit,
      color: this.config.color,
    }
    shot.activate(spawn)
    this.cooldown = 1 / (this.config.rate * ctx.mods.rateMul)
  }

  dispose(): void {
    /* no GPU — E04 owns the pool */
  }
}

export function registerPlasma(): void {
  registerWeapon('plasma', (config, shots) => new PlasmaBehaviour(config, shots))
}

registerPlasma()
