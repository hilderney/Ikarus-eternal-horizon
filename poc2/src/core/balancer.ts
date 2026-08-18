/**
 * SDD-A01 Balancer — single source of gameplay numbers (RUL-12).
 * Port of POC-1 `poc/src/core/balancer.ts` plus health / difficulty / score / drops / vfx.
 * Weapon *behaviour* is D02; the catalog data lives here until catalog.ts is extracted.
 */

export interface Vec3Params {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface PlayfieldLayout {
  readonly width: number
  readonly height: number
}

export interface EnergyConfig {
  readonly start: number
  readonly max: number
  readonly regenPerSec: number
}

export interface ShipKeysConfig {
  readonly moveXMinus: string
  readonly moveXPlus: string
  readonly moveZMinus: string
  readonly moveZPlus: string
}

export interface MotionConfig {
  readonly maxSpeed: number
  readonly accel: number
  readonly decel: number
  readonly brake: number
}

export interface TiltConfig {
  readonly axis: 'y' | 'z'
  readonly sign: 1 | -1
  readonly maxDeg: number
  readonly riseMs: number
  readonly fallMs: number
}

export interface CameraKeysConfig {
  readonly moveZPlus: string
  readonly moveZMinus: string
  readonly moveXMinus: string
  readonly moveXPlus: string
  readonly moveYPlus: string
  readonly moveYMinus: string
  readonly rotXPlus: string
  readonly rotXMinus: string
  readonly rotZPlus: string
  readonly rotZMinus: string
  readonly rotYPlus: string
  readonly rotYMinus: string
}

export interface CameraControlConfig {
  readonly moveSpeed: number
  readonly rotSpeed: number
  readonly keys: CameraKeysConfig
}

export interface FollowConfig {
  readonly halfX: number
  readonly halfZ: number
  readonly bounce: { readonly timeMs: number }
  readonly recenter: {
    readonly delayMs: number
    readonly stillMs: number
    readonly accel: number
    readonly maxSpeed: number
  }
}

export interface FollowBoxConfig {
  readonly position: Vec3Params
  readonly color: number
  readonly opacity: number
  readonly centerLine: { readonly color: number; readonly opacity: number }
  readonly restLine: {
    readonly color: number
    readonly opacity: number
    readonly position: Vec3Params
    readonly width: number
    readonly height: number
  }
}

export interface ShipVisualConfig {
  readonly size: { readonly w: number; readonly h: number; readonly d: number }
  readonly wireframeColor: number
  readonly accentColor: number
  readonly thrusterColor: number
}

export interface ShipHealthConfig {
  readonly integrityMax: number
  readonly shieldMax: number
  readonly shieldRegenPerSec: number
  readonly regenDelayMs: number
  readonly hullThresholds: readonly [number, number, number]
  readonly speedMul: readonly [number, number, number, number]
  readonly accelMul: readonly [number, number, number, number]
  readonly fireRateMul: readonly [number, number, number, number]
}

export interface CameraConfig {
  readonly fov: number
  readonly position: Vec3Params
  readonly rotation: Vec3Params
  readonly near: number
  readonly far: number
}

export interface ParallaxLayerConfig {
  readonly name: string
  readonly count: number
  readonly speed: number
  readonly speedJitter: number
  readonly parallaxGain: number
  readonly size: number
  readonly color: number
  readonly alpha: number
  readonly position: Vec3Params
  readonly rotation: Vec3Params
  readonly gridSize: number
  readonly gridColor: number
  readonly gridOpacity: number
  readonly zNearWrap: number
  readonly zFar: number
}

export interface ThrusterConfig {
  readonly position: { readonly y: number }
  readonly length: number
  readonly width: number
}

export interface DifficultyConfig {
  readonly miniBossAt: number
  readonly megaAsteroidAt: number
  readonly bossAt: number
  readonly spawnRateMulPerKill: number
}

export interface ScoreConfig {
  readonly enemy: number
  readonly meteor: number
  readonly miniBoss: number
  readonly megaAsteroid: number
  readonly boss: number
  readonly noDamageStreakMul: number
}

export interface DropsConfig {
  readonly magnetRadius: number
  readonly metalScrapChance: number
}

export interface VfxConfig {
  readonly shake: { readonly maxAmplitude: number; readonly decayPerSec: number }
  readonly hitStopFrames: number
}

export type WeaponId = 'laser' | 'plasma' | 'beam' | 'mjolnir'

export type WeaponProfile = 'projectile' | 'orb' | 'beam' | 'cone'

export interface WeaponCatalogEntry {
  readonly id: WeaponId
  readonly displayName: string
  readonly color: number
  readonly rate: number
  readonly energyPerShot: number
  readonly damage: number
  readonly profile: WeaponProfile
  readonly poolSize: number
  readonly muzzleOffset: Vec3Params
}

export interface Balance {
  readonly layout: { readonly playfield: PlayfieldLayout }
  readonly weapons: {
    readonly loadout: readonly WeaponId[]
    readonly catalog: Record<WeaponId, WeaponCatalogEntry>
  }
  readonly gameplay: {
    readonly fireKey: string
    readonly switchKey: string
    readonly energy: EnergyConfig
  }
  readonly controls: {
    readonly shipKeys: ShipKeysConfig
    readonly motion: MotionConfig
    readonly tilt: TiltConfig
    readonly camera: CameraControlConfig
  }
  readonly ship: {
    readonly transform: {
      readonly position: Vec3Params
      readonly rotation: Vec3Params
      readonly scale: number
    }
    readonly follow: FollowConfig
    readonly followBox: FollowBoxConfig
    readonly visual: ShipVisualConfig
    readonly health: ShipHealthConfig
  }
  readonly camera: CameraConfig
  readonly parallax: { readonly layers: readonly ParallaxLayerConfig[] }
  readonly thruster: ThrusterConfig
  readonly difficulty: DifficultyConfig
  readonly score: ScoreConfig
  readonly drops: DropsConfig
  readonly vfx: VfxConfig
}

const PARALLAX_GAIN_UNIT = 0.015

const BALANCE_DATA: Balance = {
  layout: {
    playfield: { width: 540, height: 960 },
  },
  weapons: {
    loadout: ['laser'],
    catalog: {
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
      },
    },
  },
  gameplay: {
    fireKey: 'Space',
    switchKey: 'KeyF',
    energy: {
      start: 100,
      max: 100,
      regenPerSec: 8,
    },
  },
  controls: {
    shipKeys: {
      moveXMinus: 'KeyA',
      moveXPlus: 'KeyD',
      moveZMinus: 'KeyW',
      moveZPlus: 'KeyS',
    },
    motion: {
      maxSpeed: 12,
      accel: 60,
      decel: 60,
      brake: 120,
    },
    tilt: {
      axis: 'z',
      sign: -1,
      maxDeg: 22,
      riseMs: 150,
      fallMs: 200,
    },
    camera: {
      moveSpeed: 12,
      rotSpeed: 45,
      keys: {
        moveZPlus: 'KeyI',
        moveZMinus: 'KeyK',
        moveXMinus: 'KeyJ',
        moveXPlus: 'KeyL',
        moveYPlus: 'KeyU',
        moveYMinus: 'KeyO',
        rotXPlus: 'Shift+KeyK',
        rotXMinus: 'Shift+KeyI',
        rotZPlus: 'Shift+KeyU',
        rotZMinus: 'Shift+KeyO',
        rotYPlus: 'Shift+KeyJ',
        rotYMinus: 'Shift+KeyL',
      },
    },
  },
  ship: {
    transform: {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: 1,
    },
    follow: {
      halfX: 6,
      halfZ: 8,
      bounce: { timeMs: 500 },
      recenter: {
        delayMs: 1500,
        stillMs: 800,
        accel: 3,
        maxSpeed: 12,
      },
    },
    followBox: {
      position: { x: 0, y: 0, z: -3 },
      color: 0xf0ab4a,
      opacity: 0.1,
      centerLine: { color: 0x50e3c2, opacity: 0.1 },
      restLine: {
        color: 0x2d6bff,
        opacity: 0.9,
        position: { x: 0, y: 0, z: -1 },
        width: 2,
        height: 4,
      },
    },
    visual: {
      size: { w: 1.5, h: 1, d: 2 },
      wireframeColor: 0x22d3ee,
      accentColor: 0x6d28d9,
      thrusterColor: 0x60c5ff,
    },
    health: {
      integrityMax: 100,
      shieldMax: 50,
      shieldRegenPerSec: 2,
      regenDelayMs: 1500,
      hullThresholds: [0.75, 0.5, 0.25],
      speedMul: [1, 0.85, 0.7, 0.5],
      accelMul: [1, 0.85, 0.7, 0.5],
      fireRateMul: [1, 0.9, 0.75, 0.55],
    },
  },
  camera: {
    fov: 85,
    position: { x: 3, y: 14, z: 6 },
    rotation: { x: -55, y: 24, z: -14 },
    near: 5,
    far: 10000,
  },
  parallax: {
    layers: [
      {
        name: 'background_stars',
        count: 400,
        speed: 0.2 * PARALLAX_GAIN_UNIT,
        speedJitter: 0.5,
        parallaxGain: 0.015 * PARALLAX_GAIN_UNIT,
        size: 1,
        color: 0xa5e8ff,
        alpha: 0.5,
        position: { x: 0, y: -600, z: 100 },
        rotation: { x: 0, y: 0, z: 0 },
        gridSize: 1000,
        gridColor: 0x555555,
        gridOpacity: 0,
        zNearWrap: 0,
        zFar: -2000,
      },
      {
        name: 'solar_system',
        count: 300,
        speed: 0.2 * 15,
        speedJitter: 0.5,
        parallaxGain: 0.015 * 15,
        size: 1,
        color: 0xd97706,
        alpha: 0.5,
        position: { x: 0, y: -300, z: 100 },
        rotation: { x: 0, y: 0, z: 0 },
        gridSize: 1000,
        gridColor: 0x555555,
        gridOpacity: 0,
        zNearWrap: 0,
        zFar: -2000,
      },
      {
        name: 'debris',
        count: 150,
        speed: 0.2 * 20,
        speedJitter: 0.5,
        parallaxGain: 0.015 * 20,
        size: 1,
        color: 0x7c68ff,
        alpha: 0.5,
        position: { x: 0, y: -150, z: 100 },
        rotation: { x: 0, y: 0, z: 0 },
        gridSize: 1000,
        gridColor: 0x555555,
        gridOpacity: 0,
        zNearWrap: 0,
        zFar: -2000,
      },
    ],
  },
  thruster: {
    position: { y: -0.55 },
    length: 0.5,
    width: 0.3,
  },
  difficulty: {
    miniBossAt: 50,
    megaAsteroidAt: 100,
    bossAt: 500,
    spawnRateMulPerKill: 0.002,
  },
  score: {
    enemy: 100,
    meteor: 25,
    miniBoss: 2500,
    megaAsteroid: 5000,
    boss: 25000,
    noDamageStreakMul: 1.5,
  },
  drops: {
    magnetRadius: 2.5,
    metalScrapChance: 0.4,
  },
  vfx: {
    shake: { maxAmplitude: 0.18, decayPerSec: 6 },
    hitStopFrames: 3,
  },
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value)
    for (const child of Object.values(value as object)) {
      deepFreeze(child)
    }
  }
  return value
}

export const BALANCE: Balance = deepFreeze(BALANCE_DATA)
