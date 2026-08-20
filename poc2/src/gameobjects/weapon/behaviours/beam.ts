/**
 * SDD-D05 BeamBehaviour — hold-to-fire hitscan DPS with BeamVisual.
 */

import type { Scene } from 'three'
import type { WeaponConfig } from '../catalog'
import { createBeamVisual, type BeamVisual } from '../beam-visual'
import { registerWeapon } from '../registry'
import type { BehaviourCtx, HitTarget, ShotAcquirePort, WeaponBehaviour } from '../registry'

function hitTarget(
  target: HitTarget,
  muzzle: { x: number; y: number; z: number },
  length: number,
  width: number,
): boolean {
  if (!target.active || target.team !== 'enemy') {
    return false
  }
  const dz = muzzle.z - target.z
  if (dz < 0 || dz > length) {
    return false
  }
  const dx = Math.abs(target.x - muzzle.x)
  return dx <= width / 2 + target.radius
}

export class BeamBehaviour implements WeaponBehaviour {
  private readonly visual: BeamVisual

  constructor(
    private readonly config: WeaponConfig,
    _shots: ShotAcquirePort,
    scene: Scene,
  ) {
    if (!config.beam) {
      throw new Error(`beam weapon ${config.id} missing beam spec`)
    }
    this.visual = createBeamVisual(config.color, scene)
  }

  update(ctx: BehaviourCtx): void {
    const spec = this.config.beam
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
    const width = spec.width * ctx.mods.beamWidthMul
    this.visual.show(ctx.muzzle, length, width, this.config.color)

    const dps = spec.dps * ctx.mods.damageMul
    const tick = dps * ctx.dt
    const targets = ctx.services.targets ?? []
    for (let i = 0; i < targets.length; i += 1) {
      const target = targets[i]
      if (target && hitTarget(target, ctx.muzzle, length, width)) {
        target.takeDamage(tick)
      }
    }
  }

  dispose(): void {
    this.visual.dispose()
  }
}

export function registerBeam(): void {
  registerWeapon('beam', (config, shots, deps) => {
    if (!deps?.scene) {
      throw new Error('beam weapon requires deps.scene')
    }
    return new BeamBehaviour(config, shots, deps.scene)
  })
}

registerBeam()
