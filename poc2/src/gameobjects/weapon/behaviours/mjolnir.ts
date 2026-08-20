/**
 * SDD-D06 MjolnirBehaviour — piercing cone DPS with ConeVisual.
 */

import type { Scene } from 'three'
import type { WeaponConfig } from '../catalog'
import { createConeVisual, type ConeVisual } from '../cone-visual'
import { registerWeapon } from '../registry'
import type { BehaviourCtx, HitTarget, ShotAcquirePort, WeaponBehaviour } from '../registry'

function hitTarget(
  target: HitTarget,
  muzzle: { x: number; y: number; z: number },
  length: number,
  angleRad: number,
): boolean {
  if (!target.active || target.team !== 'enemy') {
    return false
  }
  const dz = muzzle.z - target.z
  if (dz < 0 || dz > length) {
    return false
  }
  const dx = Math.abs(target.x - muzzle.x)
  const maxHalf = Math.tan(angleRad) * dz + target.radius
  return dx <= maxHalf
}

export class MjolnirBehaviour implements WeaponBehaviour {
  private readonly visual: ConeVisual

  constructor(
    private readonly config: WeaponConfig,
    _shots: ShotAcquirePort,
    scene: Scene,
  ) {
    if (!config.cone) {
      throw new Error(`mjolnir weapon ${config.id} missing cone spec`)
    }
    this.visual = createConeVisual(config.color, scene)
  }

  update(ctx: BehaviourCtx): void {
    const spec = this.config.cone
    if (!spec) {
      return
    }
    const cost = spec.energyPerSec * ctx.mods.energyMul * ctx.dt
    if (!ctx.holding || !ctx.services.energy.canAfford(cost)) {
      this.visual.hide()
      return
    }
    ctx.services.energy.spend(cost)

    const length = spec.length
    const angleRad = (spec.angleDeg * ctx.mods.coneMul * Math.PI) / 180
    this.visual.show(ctx.muzzle, length, angleRad, this.config.color)

    const dps = spec.dps * ctx.mods.damageMul
    const tick = dps * ctx.dt
    const targets = ctx.services.targets ?? []
    for (let i = 0; i < targets.length; i += 1) {
      const target = targets[i]
      if (target && hitTarget(target, ctx.muzzle, length, angleRad)) {
        target.takeDamage(tick)
      }
    }
  }

  dispose(): void {
    this.visual.dispose()
  }
}

export function registerMjolnir(): void {
  registerWeapon('mjolnir', (config, shots, deps) => {
    if (!deps?.scene) {
      throw new Error('mjolnir weapon requires deps.scene')
    }
    return new MjolnirBehaviour(config, shots, deps.scene)
  })
}

registerMjolnir()
