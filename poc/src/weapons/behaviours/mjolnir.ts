import type { Scene } from 'three'
import type { WeaponConfig } from '../../core/weaponsCatalog'
import { createConeVisual, type ConeVisual } from '../../gameobjects/cone'
import type { ShotPool } from '../../gameobjects/shot'
import type { BehaviourCtx, TargetHit, WeaponBehaviour } from '../behaviour'

export function createMjolnirBehaviour(config: WeaponConfig, _pool: ShotPool, scene: Scene): WeaponBehaviour {
  const spec = config.cone
  if (!spec) throw new Error(`mjolnir weapon ${config.id} without cone spec`)
  const visual: ConeVisual = createConeVisual(config.color, scene)

  function hitTarget(t: TargetHit, muzzle: { x: number; y: number; z: number }, length: number, angleRad: number): boolean {
    if (!t.active || t.team !== 'enemy') return false
    const dz = muzzle.z - t.z
    if (dz < 0 || dz > length) return false
    const dx = Math.abs(t.x - muzzle.x)
    const maxHalf = Math.tan(angleRad) * dz + t.radius
    return dx <= maxHalf
  }

  return {
    update(ctx: BehaviourCtx): void {
      const cost = spec.energyPerSec * ctx.mods.energyMul * ctx.dt
      const affordable = ctx.services.energy.canAfford(cost)
      if (!ctx.holding || !affordable) {
        visual.hide()
        return
      }
      ctx.services.energy.spend(cost)

      const length = spec.length
      const angleRad = (spec.angleDeg * Math.PI) / 180
      visual.show(ctx.muzzle, length, angleRad, config.color)

      const dps = spec.dps * ctx.mods.damageMul
      const tick = dps * ctx.dt
      const targets = ctx.services.targets
      for (let i = 0; i < targets.length; i++) {
        if (hitTarget(targets[i], ctx.muzzle, length, angleRad)) {
          targets[i].takeDamage(tick)
        }
      }
    },
    dispose(): void {
      visual.dispose()
    },
  }
}