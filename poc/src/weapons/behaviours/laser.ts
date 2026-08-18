import type { Scene } from 'three'
import type { WeaponConfig } from '../../core/weaponsCatalog'
import type { ShotSpawn, ShotPool } from '../../gameobjects/shot'
import type { BehaviourCtx, WeaponBehaviour } from '../behaviour'

const DEG2RAD = Math.PI / 180

export function createLaserBehaviour(config: WeaponConfig, pool: ShotPool, _scene: Scene): WeaponBehaviour {
  let cooldown = 0
  if (!config.projectile) throw new Error(`laser weapon ${config.id} without projectile spec`)
  const spec = config.projectile
  const range = spec.speed * spec.lifetime

  function spawn(part: Omit<ShotSpawn, 'y' | 'color' | 'radius' | 'aoeRadius' | 'lifetime' | 'range' | 'decayPerUnit' | 'totalLifetime'>): void {
    const shot = pool.acquire()
    if (!shot) return
    shot.activate({
      ...part,
      y: 0,
      color: config.color,
      radius: spec.radius,
      aoeRadius: 0,
      lifetime: spec.lifetime,
      range,
      decayPerUnit: 0,
      totalLifetime: spec.lifetime,
    })
  }

  return {
    update(ctx: BehaviourCtx): void {
      cooldown -= ctx.dt
      if (!ctx.holding) return
      if (cooldown > 0) return

      const cost = config.energyPerShot * ctx.mods.energyMul
      if (!ctx.services.energy.canAfford(cost)) return
      ctx.services.energy.spend(cost)

      const baseDmg = config.damage * ctx.mods.damageMul
      const speed = spec.speed
      const lspec = config.laser

      if (lspec) {
        const forward = lspec.forwardShots
        for (let i = 0; i < forward; i++) {
          const offX = forward === 1 ? 0 : (i - (forward - 1) / 2) * (lspec.forwardSpread / (forward - 1))
          spawn({
            x: ctx.muzzle.x + offX,
            z: ctx.muzzle.z,
            vx: 0,
            vz: -speed,
            damage: baseDmg,
          })
        }
        for (const sign of [-1, 1]) {
          const perSide = lspec.diagonalShotsPerSide
          for (let j = 0; j < perSide; j++) {
            const jitter = perSide === 1 ? 0 : (j - (perSide - 1) / 2) * lspec.diagonalSpreadDeg
            const deg = sign * lspec.diagonalAngleDeg + jitter
            const rad = deg * DEG2RAD
            const offX = perSide === 1 ? 0 : (j - (perSide - 1) / 2) * (lspec.forwardSpread / (perSide - 1))
            spawn({
              x: ctx.muzzle.x + offX,
              z: ctx.muzzle.z,
              vx: Math.sin(rad) * speed,
              vz: -Math.cos(rad) * speed,
              damage: baseDmg,
            })
          }
        }
      } else {
        const pulses = Math.max(1, Math.round(ctx.mods.pulses))
        const spread = 0.55
        for (let i = 0; i < pulses; i++) {
          const offX = pulses === 1 ? 0 : (i - (pulses - 1) / 2) * (spread / (pulses - 1))
          spawn({
            x: ctx.muzzle.x + offX,
            z: ctx.muzzle.z,
            vx: 0,
            vz: -speed,
            damage: baseDmg,
          })
        }
      }

      cooldown = 1 / (config.rate * ctx.mods.rateMul)
    },
    dispose(): void {},
  }
}