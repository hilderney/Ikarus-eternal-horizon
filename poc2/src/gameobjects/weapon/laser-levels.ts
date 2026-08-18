/**
 * SDD-D02 laser L1–L10 presets. Port of poc/src/weapons/laserLevels.ts.
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
  { level: 1, damage: 1, rate: 8, energyPerShot: 0.25, speed: 30, radius: 0.12, lifetime: 1, forwardShots: 1, diagonalShotsPerSide: 0, diagonalAngleDeg: 22, forwardSpread: 0.55 },
  { level: 2, damage: 1.1, rate: 8.5, energyPerShot: 0.27, speed: 30, radius: 0.125, lifetime: 1, forwardShots: 2, diagonalShotsPerSide: 0, diagonalAngleDeg: 22, forwardSpread: 0.55 },
  { level: 3, damage: 1.3, rate: 9, energyPerShot: 0.3, speed: 30, radius: 0.13, lifetime: 1, forwardShots: 3, diagonalShotsPerSide: 0, diagonalAngleDeg: 22, forwardSpread: 0.55 },
  { level: 4, damage: 1.5, rate: 9.5, energyPerShot: 0.33, speed: 30, radius: 0.135, lifetime: 1, forwardShots: 4, diagonalShotsPerSide: 0, diagonalAngleDeg: 22, forwardSpread: 0.55 },
  { level: 5, damage: 1.8, rate: 10, energyPerShot: 0.36, speed: 30, radius: 0.14, lifetime: 1, forwardShots: 3, diagonalShotsPerSide: 1, diagonalAngleDeg: 22, forwardSpread: 0.55 },
  { level: 6, damage: 2.1, rate: 10.5, energyPerShot: 0.4, speed: 30, radius: 0.145, lifetime: 1, forwardShots: 4, diagonalShotsPerSide: 1, diagonalAngleDeg: 22, forwardSpread: 0.55 },
  { level: 7, damage: 2.5, rate: 11, energyPerShot: 0.44, speed: 30, radius: 0.15, lifetime: 1, forwardShots: 3, diagonalShotsPerSide: 2, diagonalAngleDeg: 22, forwardSpread: 0.55 },
  { level: 8, damage: 3, rate: 11.5, energyPerShot: 0.48, speed: 30, radius: 0.155, lifetime: 1, forwardShots: 4, diagonalShotsPerSide: 2, diagonalAngleDeg: 22, forwardSpread: 0.55 },
  { level: 9, damage: 3.6, rate: 12, energyPerShot: 0.52, speed: 30, radius: 0.16, lifetime: 1, forwardShots: 3, diagonalShotsPerSide: 3, diagonalAngleDeg: 22, forwardSpread: 0.55 },
  { level: 10, damage: 4.3, rate: 12.5, energyPerShot: 0.56, speed: 30, radius: 0.165, lifetime: 1, forwardShots: 4, diagonalShotsPerSide: 3, diagonalAngleDeg: 22, forwardSpread: 0.55 },
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
