/**
 * SDD-D02 LaserBehaviour — forward + diagonal volleys into E04 ShotAcquirePort.
 */

import { DEG2RAD } from '../../../core/math'
import type { ShotSpawn } from '../../shot/weapon-shot'
import type { WeaponConfig } from '../catalog'
import { registerWeapon } from '../registry'
import type { BehaviourCtx, ShotAcquirePort, WeaponBehaviour } from '../registry'

export class LaserBehaviour implements WeaponBehaviour {
  private cooldown = 0

  constructor(
    private readonly config: WeaponConfig,
    private readonly shots: ShotAcquirePort,
  ) {
    if (!config.projectile || !config.laser) {
      throw new Error(`laser weapon ${config.id} missing projectile/laser spec`)
    }
  }

  update(ctx: BehaviourCtx): void {
    this.cooldown -= ctx.dt
    if (!ctx.holding || this.cooldown > 0) {
      return
    }

    const cost = this.config.energyPerShot * ctx.mods.energyMul
    if (!ctx.services.energy.canAfford(cost)) {
      return
    }
    ctx.services.energy.spend(cost)

    const spec = this.config.projectile
    const lspec = this.config.laser
    if (!spec || !lspec) {
      return
    }

    const speed = spec.speed
    const range = spec.speed * spec.lifetime
    const damage = this.config.damage * ctx.mods.damageMul
    const forward = lspec.forwardShots

    for (let i = 0; i < forward; i++) {
      const offX =
        forward === 1 ? 0 : (i - (forward - 1) / 2) * (lspec.forwardSpread / (forward - 1))
      this.spawn(ctx, spec, range, damage, ctx.muzzle.x + offX, 0, -speed)
    }

    this.spawnDiagonals(ctx, spec, range, damage, speed, lspec, -1)
    this.spawnDiagonals(ctx, spec, range, damage, speed, lspec, 1)

    this.cooldown = 1 / (this.config.rate * ctx.mods.rateMul)
  }

  dispose(): void {
    /* no GPU — E04 owns the pool */
  }

  private spawnDiagonals(
    ctx: BehaviourCtx,
    spec: NonNullable<WeaponConfig['projectile']>,
    range: number,
    damage: number,
    speed: number,
    lspec: NonNullable<WeaponConfig['laser']>,
    sign: number,
  ): void {
    const perSide = lspec.diagonalShotsPerSide
    for (let j = 0; j < perSide; j++) {
      const jitter = perSide === 1 ? 0 : (j - (perSide - 1) / 2) * lspec.diagonalSpreadDeg
      const deg = sign * lspec.diagonalAngleDeg + jitter
      const rad = deg * DEG2RAD
      const offX =
        perSide === 1 ? 0 : (j - (perSide - 1) / 2) * (lspec.forwardSpread / (perSide - 1))
      this.spawn(
        ctx,
        spec,
        range,
        damage,
        ctx.muzzle.x + offX,
        Math.sin(rad) * speed,
        -Math.cos(rad) * speed,
      )
    }
  }

  private spawn(
    ctx: BehaviourCtx,
    spec: NonNullable<WeaponConfig['projectile']>,
    range: number,
    damage: number,
    x: number,
    vx: number,
    vz: number,
  ): void {
    const shot = this.shots.acquire()
    if (!shot) {
      return
    }
    const spawn: ShotSpawn = {
      x,
      z: ctx.muzzle.z,
      vx,
      vz,
      damage,
      lifetime: spec.lifetime,
      totalLifetime: spec.lifetime,
      radius: spec.radius,
      aoeRadius: 0,
      range,
      decayPerUnit: spec.damageDecayPerUnit,
      color: this.config.color,
    }
    shot.activate(spawn)
  }
}

export function registerLaser(): void {
  registerWeapon('laser', (config, shots) => new LaserBehaviour(config, shots))
}

registerLaser()
