/**
 * SDD-D02 laser L1–L12 presets. Volley shape + energyPerShot (one spend per pulse).
 */

import type { WeaponConfig } from './catalog'

export interface LaserLevel {
  readonly level: number
  readonly damage: number
  readonly rate: number
  readonly energyPerShot: number
  readonly speed: number
  readonly radius: number
  readonly lifetime: number
  readonly forwardShots: number
  readonly diagonalShotsPerSide: number
  readonly diagonalAngleDeg: number
  readonly forwardSpread: number
}

export const LASER_LEVELS: readonly LaserLevel[] = [
  { level: 1, damage: 1, rate: 5, energyPerShot: 0.3, speed: 30, radius: 0.07, lifetime: 1, forwardShots: 1, diagonalShotsPerSide: 0, diagonalAngleDeg: 15, forwardSpread: 0.55 },
  { level: 2, damage: 1.1, rate: 5.1, energyPerShot: 0.35, speed: 30, radius: 0.07, lifetime: 1, forwardShots: 2, diagonalShotsPerSide: 0, diagonalAngleDeg: 15, forwardSpread: 0.55 },
  { level: 3, damage: 1.3, rate: 5.2, energyPerShot: 0.4, speed: 30, radius: 0.07, lifetime: 1, forwardShots: 3, diagonalShotsPerSide: 0, diagonalAngleDeg: 15, forwardSpread: 0.55 },
  { level: 4, damage: 1.5, rate: 5.3, energyPerShot: 0.45, speed: 30, radius: 0.07, lifetime: 1, forwardShots: 4, diagonalShotsPerSide: 0, diagonalAngleDeg: 15, forwardSpread: 0.55 },
  { level: 5, damage: 1.8, rate: 5.4, energyPerShot: 0.5, speed: 30, radius: 0.08, lifetime: 1, forwardShots: 3, diagonalShotsPerSide: 1, diagonalAngleDeg: 15, forwardSpread: 0.55 },
  { level: 6, damage: 2.1, rate: 5.5, energyPerShot: 0.6, speed: 30, radius: 0.08, lifetime: 1, forwardShots: 4, diagonalShotsPerSide: 1, diagonalAngleDeg: 15, forwardSpread: 0.55 },
  { level: 7, damage: 2.5, rate: 5.6, energyPerShot: 0.7, speed: 30, radius: 0.08, lifetime: 1, forwardShots: 3, diagonalShotsPerSide: 2, diagonalAngleDeg: 15, forwardSpread: 0.55 },
  { level: 8, damage: 3, rate: 5.7, energyPerShot: 0.8, speed: 30, radius: 0.08, lifetime: 1, forwardShots: 4, diagonalShotsPerSide: 2, diagonalAngleDeg: 15, forwardSpread: 0.55 },
  { level: 9, damage: 3.6, rate: 5.8, energyPerShot: 0.9, speed: 30, radius: 0.09, lifetime: 1, forwardShots: 3, diagonalShotsPerSide: 3, diagonalAngleDeg: 15, forwardSpread: 0.55 },
  { level: 10, damage: 4.3, rate: 5.9, energyPerShot: 1.1, speed: 30, radius: 0.09, lifetime: 1, forwardShots: 4, diagonalShotsPerSide: 3, diagonalAngleDeg: 15, forwardSpread: 0.55 },
  { level: 11, damage: 5.1, rate: 6, energyPerShot: 1.3, speed: 30, radius: 0.09, lifetime: 1, forwardShots: 3, diagonalShotsPerSide: 4, diagonalAngleDeg: 15, forwardSpread: 0.55 },
  { level: 12, damage: 6, rate: 6.5, energyPerShot: 1.5, speed: 30, radius: 0.09, lifetime: 1, forwardShots: 4, diagonalShotsPerSide: 4, diagonalAngleDeg: 15, forwardSpread: 0.55 },
]

export function applyLaserLevel(cfg: WeaponConfig, level: number): void {
  const row = LASER_LEVELS.find((entry) => entry.level === level)
  if (!row || !cfg.projectile || !cfg.laser) {
    return
  }
  cfg.level = row.level
  cfg.damage = row.damage
  cfg.rate = row.rate
  cfg.energyPerShot = row.energyPerShot
  cfg.projectile.speed = row.speed
  cfg.projectile.radius = row.radius
  cfg.projectile.lifetime = row.lifetime
  cfg.laser.forwardShots = row.forwardShots
  cfg.laser.diagonalShotsPerSide = row.diagonalShotsPerSide
  cfg.laser.totalShots = row.forwardShots + 2 * row.diagonalShotsPerSide
  cfg.laser.diagonalAngleDeg = row.diagonalAngleDeg
  cfg.laser.forwardSpread = row.forwardSpread
}
