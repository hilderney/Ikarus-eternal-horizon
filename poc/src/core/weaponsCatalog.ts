export type WeaponId = 'laser' | 'plasma' | 'beam' | 'mjolnir'

export type WeaponProfile = 'projectile' | 'orb' | 'beam' | 'cone'

export interface ProjectileSpec {
  speed: number
  radius: number
  lifetime: number
  damageDecayPerUnit: number
}

export interface OrbSpec {
  speed: number
  radius: number
  lifetime: number
  aoeRadius: number
  damageDecayPerUnit: number
}

export interface BeamSpec {
  width: number
  length: number
  ticksPerSec: number
  dps: number
  energyPerSec: number
}

export interface ConeSpec {
  angleDeg: number
  length: number
  ticksPerSec: number
  dps: number
  energyPerSec: number
}

export interface LaserSpec {
  forwardShots: number
  diagonalShotsPerSide: number
  totalShots: number
  diagonalAngleDeg: number
  forwardSpread: number
  diagonalSpreadDeg: number
}

export interface WeaponConfig {
  id: WeaponId
  displayName: string
  color: number
  rate: number
  energyPerShot: number
  damage: number
  profile: WeaponProfile
  poolSize: number
  muzzleOffset: { x: number; y: number; z: number }
  level?: number
  projectile?: ProjectileSpec
  orb?: OrbSpec
  beam?: BeamSpec
  cone?: ConeSpec
  laser?: LaserSpec
}

export const WEAPONS: Record<WeaponId, WeaponConfig> = {
laser: {
    id: 'laser',
    displayName: 'Laser',
    color: 0x22d3ee,
    rate: 8,
    energyPerShot: 0.25,
    damage: 1,
    profile: 'projectile',
    poolSize: 128,
    muzzleOffset: { x: 0, y: 0, z: -1.4 },
    level: 1,
    projectile: {
      speed: 30,
      radius: 0.12,
      lifetime: 1,
      damageDecayPerUnit: 0,
    },
    laser: {
      forwardShots: 1,
      diagonalShotsPerSide: 0,
      totalShots: 1,
      diagonalAngleDeg: 22,
      forwardSpread: 0.55,
      diagonalSpreadDeg: 10,
    },
  },
  plasma: {
    id: 'plasma',
    displayName: 'Plasma',
    color: 0xfb923c,
    rate: 1.6,
    energyPerShot: 1.5,
damage: 2.5,
    profile: 'orb',
    poolSize: 32,
    muzzleOffset: { x: 0, y: 0, z: -1.4 },
    orb: {
      speed: 14,
      radius: 0.22,
      lifetime: 2.4,
      aoeRadius: 2.2,
      damageDecayPerUnit: 0.01,
    },
  },
  beam: {
    id: 'beam',
    displayName: 'Beam',
    color: 0xa78bfa,
    rate: 1,
    energyPerShot: 0,
damage: 0,
    profile: 'beam',
    poolSize: 4,
    muzzleOffset: { x: 0, y: 0, z: -1.4 },
    beam: {
      width: 0.35,
      length: 26,
      ticksPerSec: 60,
      dps: 6,
      energyPerSec: 3,
    },
  },
  mjolnir: {
    id: 'mjolnir',
    displayName: 'Mjolnir',
    color: 0x34d399,
    rate: 1,
    energyPerShot: 0,
damage: 0,
    profile: 'cone',
    poolSize: 4,
    muzzleOffset: { x: 0, y: 0, z: -1.4 },
    cone: {
      angleDeg: 50,
      length: 18,
      ticksPerSec: 30,
      dps: 5,
      energyPerSec: 2.2,
    },
  },
}

