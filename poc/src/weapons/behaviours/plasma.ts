import type { Scene } from 'three'
import type { WeaponConfig } from '../../core/weaponsCatalog'
import type { ShotPool } from '../../gameobjects/shot'
import type { BehaviourCtx, WeaponBehaviour } from '../behaviour'

export function createPlasmaBehaviour(config: WeaponConfig, pool: ShotPool, _scene: Scene): WeaponBehaviour {
  let cooldown = 0

  return {
    update(ctx: BehaviourCtx): void {
      const spec = config.orb
      if (!spec) return
      cooldown -= ctx.dt
      if (!ctx.holding) return
      if (cooldown > 0) return

      const cost = config.energyPerShot * ctx.mods.energyMul
      if (!ctx.services.energy.canAfford(cost)) return
      ctx.services.energy.spend(cost)

      const shot = pool.acquire()
      if (!shot) return
      const dmg = config.damage * ctx.mods.damageMul
      shot.activate({
        x: ctx.muzzle.x,
        y: ctx.muzzle.y,
        z: ctx.muzzle.z,
        vx: 0,
        vz: -spec.speed,
        damage: dmg,
        lifetime: spec.lifetime,
        color: config.color,
        radius: spec.radius,
        aoeRadius: spec.aoeRadius * ctx.mods.aoeMul,
        decayPerUnit: spec.damageDecayPerUnit,
        range: spec.speed * spec.lifetime,
        totalLifetime: spec.lifetime,
      })
      cooldown = 1 / (config.rate * ctx.mods.rateMul)
    },
    dispose(): void {},
  }
}