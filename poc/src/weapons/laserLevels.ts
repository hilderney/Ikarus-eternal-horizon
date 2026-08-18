import type { WeaponConfig } from '../core/weaponsCatalog'

export interface LaserLevel {
  level: number
  damage: number
  rate: number
  energyPerShot: number
  speed: number
  radius: number
  lifetime: number
  forwardShots: number
  diagonalShotsPerSide: number
  diagonalAngleDeg: number
  forwardSpread: number
}

// totalShots = forwardShots + 2 * diagonalShotsPerSide = level (pulses 1..10)
export const LASER_LEVELS: LaserLevel[] = [
  {
    level: 1,
    damage: 1,
    rate: 8,
    energyPerShot: 0.25,
    speed: 30,
    radius: 0.12,
    lifetime: 1,
    forwardShots: 1,
    diagonalShotsPerSide: 0,
    diagonalAngleDeg: 22,
    forwardSpread: 0.55,
  },
  {
    level: 2,
    damage: 1.1,
    rate: 8.5,
    energyPerShot: 0.27,
    speed: 30,
    radius: 0.125,
    lifetime: 1,
    forwardShots: 2,
    diagonalShotsPerSide: 0,
    diagonalAngleDeg: 22,
    forwardSpread: 0.55,
  },
  {
    level: 3,
    damage: 1.3,
    rate: 9,
    energyPerShot: 0.3,
    speed: 30,
    radius: 0.13,
    lifetime: 1,
    forwardShots: 3,
    diagonalShotsPerSide: 0,
    diagonalAngleDeg: 22,
    forwardSpread: 0.55,
  },
  {
    level: 4,
    damage: 1.5,
    rate: 9.5,
    energyPerShot: 0.33,
    speed: 30,
    radius: 0.135,
    lifetime: 1,
    forwardShots: 4,
    diagonalShotsPerSide: 0,
    diagonalAngleDeg: 22,
    forwardSpread: 0.55,
  },
  {
    level: 5,
    damage: 1.8,
    rate: 10,
    energyPerShot: 0.36,
    speed: 30,
    radius: 0.14,
    lifetime: 1,
    forwardShots: 3,
    diagonalShotsPerSide: 1,
    diagonalAngleDeg: 22,
    forwardSpread: 0.55,
  },
  {
    level: 6,
    damage: 2.1,
    rate: 10.5,
    energyPerShot: 0.4,
    speed: 30,
    radius: 0.145,
    lifetime: 1,
    forwardShots: 4,
    diagonalShotsPerSide: 1,
    diagonalAngleDeg: 22,
    forwardSpread: 0.55,
  },
  {
    level: 7,
    damage: 2.5,
    rate: 11,
    energyPerShot: 0.44,
    speed: 30,
    radius: 0.15,
    lifetime: 1,
    forwardShots: 3,
    diagonalShotsPerSide: 2,
    diagonalAngleDeg: 22,
    forwardSpread: 0.55,
  },
  {
    level: 8,
    damage: 3,
    rate: 11.5,
    energyPerShot: 0.48,
    speed: 30,
    radius: 0.155,
    lifetime: 1,
    forwardShots: 4,
    diagonalShotsPerSide: 2,
    diagonalAngleDeg: 22,
    forwardSpread: 0.55,
  },
  {
    level: 9,
    damage: 3.6,
    rate: 12,
    energyPerShot: 0.52,
    speed: 30,
    radius: 0.16,
    lifetime: 1,
    forwardShots: 3,
    diagonalShotsPerSide: 3,
    diagonalAngleDeg: 22,
    forwardSpread: 0.55,
  },
  {
    level: 10,
    damage: 4.3,
    rate: 12.5,
    energyPerShot: 0.56,
    speed: 30,
    radius: 0.165,
    lifetime: 1,
    forwardShots: 4,
    diagonalShotsPerSide: 3,
    diagonalAngleDeg: 22,
    forwardSpread: 0.55,
  },
]

export function applyLaserLevel(cfg: WeaponConfig, level: number): void {
  const lv = LASER_LEVELS.find((l) => l.level === level)
  if (!lv) return
  if (!cfg.projectile) return
  if (!cfg.laser) return

  cfg.level = lv.level
  cfg.damage = lv.damage
  cfg.rate = lv.rate
  cfg.energyPerShot = lv.energyPerShot
  cfg.projectile.speed = lv.speed
  cfg.projectile.radius = lv.radius
  cfg.projectile.lifetime = lv.lifetime
  cfg.laser.forwardShots = lv.forwardShots
  cfg.laser.diagonalShotsPerSide = lv.diagonalShotsPerSide
  cfg.laser.totalShots = lv.forwardShots + 2 * lv.diagonalShotsPerSide
  cfg.laser.diagonalAngleDeg = lv.diagonalAngleDeg
  cfg.laser.forwardSpread = lv.forwardSpread
}