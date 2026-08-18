import type { Scene } from 'three'
import type { WeaponConfig } from '../../core/weaponsCatalog'
import { createBeamVisual, type BeamVisual } from '../../gameobjects/beam'
import type { ShotPool } from '../../gameobjects/shot'
import type { BehaviourCtx, TargetHit, WeaponBehaviour } from '../behaviour'

export function createBeamBehaviour(config: WeaponConfig, _pool: ShotPool, scene: Scene): WeaponBehaviour {
  const spec = config.beam
  if (!spec) throw new Error(`beam weapon ${config.id} without beam spec`)
  const visual: BeamVisual = createBeamVisual(config.color, scene)

  function hitTarget(t: TargetHit, muzzle: { x: number; y: number; z: number }, length: number, width: number): boolean {
    if (!t.active || t.team !== 'enemy') return false
    const dz = muzzle.z - t.z
    if (dz < 0 || dz > length) return false
    const dx = Math.abs(t.x - muzzle.x)
    return dx <= width / 2 + t.radius
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
      const width = spec.width * ctx.mods.beamWidthMul
      visual.show(ctx.muzzle, length, width, config.color)

      const dps = spec.dps * ctx.mods.damageMul
      const tick = dps * ctx.dt
      const targets = ctx.services.targets
      for (let i = 0; i < targets.length; i++) {
        if (hitTarget(targets[i], ctx.muzzle, length, width)) {
          targets[i].takeDamage(tick)
        }
      }
    },
    dispose(): void {
      visual.dispose()
    },
  }
}