/**
 * SDD-A01 Balancer — single source of gameplay numbers (RUL-12).
 * Port of POC-1 `poc/src/core/balancer.ts` plus health / difficulty / score / drops / vfx.
 * Weapon *behaviour* is D02; catalog data lives in catalog.ts and is re-exported here.
 */

import { DASH_LEVELS } from '../gameobjects/controller/dash-levels'
import { WEAPONS } from '../gameobjects/weapon/catalog'
import type { WeaponConfig, WeaponId, WeaponProfile } from '../gameobjects/weapon/catalog'
import { WARRIOR } from '../gameobjects/enemy/warrior'
import type { WarriorSheet } from '../gameobjects/enemy/warrior'

export type { WeaponConfig, WeaponId, WeaponProfile }
export type WeaponCatalogEntry = WeaponConfig

export interface Vec3Params {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface PlayfieldLayout {
  readonly width: number
  readonly height: number
}

export interface RenderConfig {
  readonly background: number
  readonly pixelRatioCap: number
  readonly antialias: boolean
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

export interface GamepadConfig {
  readonly deadzone: number
  readonly triggerThreshold: number
  readonly invertMoveZ: boolean
  readonly axes: { readonly moveX: number; readonly moveZ: number }
  readonly buttons: {
    readonly fire: number
    readonly switchWeapon: number
    readonly switchBomb: number
    readonly pause: number
    readonly dash: number
    readonly bomb: number
    readonly boost: number
    readonly special: number
  }
}

export interface MouseControlConfig {
  readonly fireButton: number
  readonly bombButton: number
}

export interface TouchControlConfig {
  readonly enabled: 'auto' | true | false
  readonly stickSize: number
  readonly stickColor: string
  readonly deadzone: number
}

export interface DashConfig {
  readonly speedMul: number
  readonly durationMs: number
}

export interface HapticPreset {
  readonly durationMs: number
  readonly strongMagnitude: number
  readonly weakMagnitude: number
}

export interface HapticsConfig {
  readonly enabled: boolean
  readonly presets: {
    readonly shieldHit: HapticPreset
    readonly hullHit: HapticPreset
    readonly shieldBreak: HapticPreset
    readonly destroyed: HapticPreset
    readonly fireLaser: HapticPreset
  }
}

export interface LoopConfig {
  readonly maxFrameDt: number
  readonly sidecarHz: number
}

export interface GizmosConfig {
  readonly gridSize: number
  readonly gridDivisions: number
  readonly gridColor: number
  readonly gridY: number
  readonly gridOpacity: number
  readonly worldAxisSize: number
  readonly cameraAxisSize: number
  readonly axis: { readonly x: number; readonly y: number; readonly z: number }
  readonly lineOpacity: number
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

/** Enemy spawn volume relative to the ship (left / right flanks). E05 spawns inside it. */
export interface EnemySpawnConfig {
  /** Centre of the volume relative to the ship (−Z is forward). */
  readonly offset: Vec3Params
  /** Full extents of the box (world units). */
  readonly size: Vec3Params
  readonly visible: boolean
  readonly color: number
  readonly opacity: number
  /** Seconds between spawn attempts (E05). */
  readonly intervalSec: number
  /** Preferred X lanes inside the volume (shared with meteor spawn). */
  readonly lanesX: readonly number[]
  /** Cap live enemies (1 = test stream). */
  readonly maxActive: number
}

export interface EnemyGenericConfig {
  readonly hp: number
  readonly radius: number
  readonly color: number
  readonly maxSpeed: number
  readonly contactDamage: number
}

/** Staging volume behind front spawn; enemies rush here before chasing the ship. */
export interface EnemyGateConfig {
  readonly offset: Vec3Params
  readonly size: Vec3Params
  readonly visible: boolean
  readonly color: number
  readonly opacity: number
  /** Visual radius of each of the 9 entry marker spheres. */
  readonly markerRadius: number
  /** Distance to gate entry that triggers chase phase. */
  readonly arriveRadius: number
  /** Target speed multiplier while in reachGate (e.g. 3). */
  readonly reachSpeedMul: number
  /** Exponential damp λ for currentSpeed → targetSpeed. */
  readonly agilityLambda: number
  /**
   * Local X offsets (relative to gate centre) for controlled random arrival.
   * left ← spawnLeft, middle ← spawnFront, right ← spawnRight (3 each).
   */
  readonly entryPointsX: {
    readonly left: readonly [number, number, number]
    readonly middle: readonly [number, number, number]
    readonly right: readonly [number, number, number]
  }
}

export interface EnemyDespawnConfig {
  readonly zNear: number
  readonly zFar: number
  readonly halfX: number
}

export interface EnemyConfig {
  readonly spawnLeft: EnemySpawnConfig
  readonly spawnRight: EnemySpawnConfig
  readonly spawnFront: EnemySpawnConfig
  readonly gate: EnemyGateConfig
  /** @deprecated Prefer warrior sheet; kept as combat fallback snapshot. */
  readonly generic: EnemyGenericConfig
  readonly warrior: WarriorSheet
  readonly despawn: EnemyDespawnConfig
  readonly poolSize: number
  /** EnemyShot pool capacity (E03/E04). */
  readonly shotPoolSize: number
}

/** Active play volume relative to the ship. Outside ⇒ pool-release (enemies/meteors). */
export interface BattleFieldConfig {
  readonly offsetX: { readonly min: number; readonly max: number }
  readonly offsetZ: { readonly min: number; readonly max: number }
  /** Vertical extent of the blue wall frame (world Y). */
  readonly wallHeight: number
  readonly color: number
  readonly opacity: number
  readonly visible: boolean
}

export interface ShipVisualConfig {
  readonly size: { readonly w: number; readonly h: number; readonly d: number }
  /** XZ collision radius for F01 Player layer. */
  readonly hitRadius: number
  readonly wireframeColor: number
  readonly accentColor: number
  readonly thrusterColor: number
}

export type ShipResourceId =
  | 'metalScrap'
  | 'prismaticCrystal'
  | 'denseCore'
  | 'darkMatter'
  | 'equipment'

export interface ShipInventoryConfig {
  readonly caps: Readonly<Record<ShipResourceId, number>>
}

export interface BytePoolConfig {
  readonly current: number
  readonly max: number
}

export interface ShipCooldowns {
  readonly flickeringMs: number
  readonly shootingMs: number
  readonly dashingMs: number
  readonly recoveringMs: number
}

export interface ModuleMount {
  readonly position: Vec3Params
  readonly size: { readonly w: number; readonly h: number; readonly d: number }
}

export interface BodyModuleMods {
  readonly integrity: number
  readonly energy: number
}

export interface WingModuleMods {
  readonly agility: number
  readonly deflection: number
}

export interface ShieldModuleMods {
  readonly shield: number
  readonly deflection: number
}

export interface CollectorModuleMods {
  readonly energyGain: number
}

export interface ConverterModuleMods {
  readonly labFusion: number
}

export interface ShipModulesConfig {
  readonly layout: {
    readonly wings: readonly [ModuleMount, ModuleMount, ModuleMount, ModuleMount]
    readonly shield: ModuleMount
    readonly bombs: readonly [ModuleMount, ModuleMount]
    readonly collector: ModuleMount
    readonly converter: ModuleMount
  }
  readonly body: Readonly<Record<'light' | 'standard' | 'heavy', BodyModuleMods>>
  readonly wings: Readonly<Record<'standard' | 'agility' | 'armored', WingModuleMods>>
  readonly shield: Readonly<Record<'light' | 'standard' | 'heavy', ShieldModuleMods>>
  readonly collector: Readonly<Record<'passive' | 'wide', CollectorModuleMods>>
  readonly converter: Readonly<Record<'scrap' | 'crystal', ConverterModuleMods>>
}

export interface ShipStatsConfig {
  readonly byteCap: number
  readonly agility: BytePoolConfig
  readonly deflection: BytePoolConfig
  readonly integrity: BytePoolConfig
  readonly shield: BytePoolConfig
  readonly precision: BytePoolConfig
  readonly energy: BytePoolConfig
}

export interface DebugConfig {
  readonly syncHz: number
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
  readonly patternStepKills: number
  readonly patterns: readonly ('spread' | 'lane' | 'pincer' | 'rain')[]
}

export interface ScoreConfig {
  readonly enemy: number
  readonly meteor: number
  readonly miniBoss: number
  readonly megaAsteroid: number
  readonly boss: number
  readonly noDamageStreakMul: number
}

export type DropResourceId =
  | 'metalScrap'
  | 'prismaticCrystal'
  | 'denseCore'
  | 'darkMatter'
  | 'equipment'

export type DropSourceId = 'enemy' | 'meteor' | 'miniBoss' | 'megaAsteroid' | 'boss'

export interface DropTableEntryConfig {
  readonly id: DropResourceId
  readonly chance: number
  readonly min: number
  readonly max: number
}

export interface DropsConfig {
  readonly magnetRadius: number
  readonly magnetSpeed: number
  readonly metalScrapChance: number
  readonly fragmentRadius: number
  readonly poolSize: number
  readonly despawn: {
    readonly zNear: number
    readonly zFar: number
    readonly halfX: number
  }
  readonly stockCaps: Readonly<Record<DropResourceId, number>>
  readonly tables: Readonly<Record<DropSourceId, readonly DropTableEntryConfig[]>>
  readonly colors: Readonly<Record<DropResourceId, number>>
}

export interface VfxConfig {
  readonly shake: { readonly maxAmplitude: number; readonly decayPerSec: number }
  readonly hitStopFrames: number
}

export interface ShotDespawnConfig {
  readonly zNear: number
  readonly zFar: number
  readonly halfX: number
}

export interface Balance {
  readonly layout: {
    readonly playfield: PlayfieldLayout
    readonly collapsePx: number
    readonly areaWidth: string
  }
  readonly render: RenderConfig
  readonly weapons: {
    readonly loadout: readonly WeaponId[]
    readonly catalog: Record<WeaponId, WeaponCatalogEntry>
  }
  readonly gameplay: {
    readonly fireKey: string
    readonly switchKey: string
    readonly pauseKey: string
    readonly bombKey: string
    readonly switchBombKey: string
    readonly dashKey: string
    readonly energy: EnergyConfig
  }
  readonly controls: {
    readonly shipKeys: ShipKeysConfig
    readonly motion: MotionConfig
    readonly dash: DashConfig
    readonly tilt: TiltConfig
    readonly camera: CameraControlConfig
    readonly gamepad: GamepadConfig
    readonly mouse: MouseControlConfig
    readonly touch: TouchControlConfig
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
    readonly inventory: ShipInventoryConfig
    readonly cooldowns: ShipCooldowns
    readonly stats: ShipStatsConfig
    readonly modules: ShipModulesConfig
    readonly health: ShipHealthConfig
  }
  readonly camera: CameraConfig
  readonly parallax: { readonly layers: readonly ParallaxLayerConfig[] }
  readonly thruster: ThrusterConfig
  readonly difficulty: DifficultyConfig
  readonly score: ScoreConfig
  readonly drops: DropsConfig
  readonly shot: { readonly despawn: ShotDespawnConfig }
  readonly enemy: EnemyConfig
  readonly battlefield: BattleFieldConfig
  readonly vfx: VfxConfig
  readonly haptics: HapticsConfig
  readonly loop: LoopConfig
  readonly gizmos: GizmosConfig
  readonly debug: DebugConfig
}

const PARALLAX_GAIN_UNIT = 0.015

const SHIP_COOLDOWNS: ShipCooldowns = {
  flickeringMs: 2000,
  shootingMs: 500,
  dashingMs: 500,
  recoveringMs: 500,
}

const SHIP_MODULES: ShipModulesConfig = {
  layout: {
    wings: [
      { position: { x: -1.15, y: 0, z: 0.18 }, size: { w: 1.1, h: 0.06, d: 0.38 } },
      { position: { x: 1.15, y: 0, z: 0.18 }, size: { w: 1.1, h: 0.06, d: 0.38 } },
      { position: { x: -0.85, y: 0.02, z: -0.55 }, size: { w: 0.55, h: 0.05, d: 0.22 } },
      { position: { x: 0.85, y: 0.02, z: -0.55 }, size: { w: 0.55, h: 0.05, d: 0.22 } },
    ],
    shield: { position: { x: 0, y: 0.58, z: 0 }, size: { w: 0.72, h: 0.05, d: 0.95 } },
    bombs: [
      { position: { x: -0.95, y: 0.2, z: 0.06 }, size: { w: 0.14, h: 0.12, d: 0.32 } },
      { position: { x: 0.95, y: 0.2, z: 0.06 }, size: { w: 0.14, h: 0.12, d: 0.32 } },
    ],
    collector: { position: { x: 0, y: 0.04, z: 0.92 }, size: { w: 0.48, h: 0.2, d: 0.24 } },
    converter: { position: { x: 0, y: 0.58, z: -0.42 }, size: { w: 0.42, h: 0.14, d: 0.38 } },
  },
  body: {
    light: { integrity: -10, energy: 20 },
    standard: { integrity: 0, energy: 0 },
    heavy: { integrity: 25, energy: -10 },
  },
  wings: {
    standard: { agility: 0, deflection: 0 },
    agility: { agility: 25, deflection: 5 },
    armored: { agility: 5, deflection: 25 },
  },
  shield: {
    light: { shield: 15, deflection: 5 },
    standard: { shield: 25, deflection: 10 },
    heavy: { shield: 40, deflection: 18 },
  },
  collector: {
    passive: { energyGain: 1 },
    wide: { energyGain: 2 },
  },
  converter: {
    scrap: { labFusion: 1 },
    crystal: { labFusion: 2 },
  },
}

const BALANCE_DATA: Balance = {
  layout: {
    playfield: { width: 540, height: 960 },
    collapsePx: 760,
    areaWidth: '17rem',
  },
  render: {
    background: 0x05040a,
    pixelRatioCap: 2,
    antialias: true,
  },
  weapons: {
    loadout: ['laser', 'plasma', 'beam', 'mjolnir'],
    catalog: WEAPONS,
  },
  gameplay: {
    fireKey: 'KeyF',
    switchKey: 'KeyG',
    pauseKey: 'Escape',
    bombKey: 'KeyT',
    switchBombKey: 'KeyY',
    dashKey: 'Space',
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
    dash: {
      speedMul: DASH_LEVELS[0]?.speedMul ?? 2.05,
      durationMs: SHIP_COOLDOWNS.dashingMs,
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
    gamepad: {
      deadzone: 0.18,
      triggerThreshold: 0.35,
      invertMoveZ: false,
      axes: { moveX: 0, moveZ: 1 },
      buttons: {
        fire: 3,
        switchWeapon: 2,
        switchBomb: 1,
        pause: 9,
        dash: 5,
        bomb: 0,
        boost: 7,
        special: 6,
      },
    },
    mouse: {
      fireButton: 0,
      bombButton: 2,
    },
    touch: {
      enabled: 'auto',
      stickSize: 120,
      stickColor: '#22d3ee',
      deadzone: 0.18,
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
      opacity: 0.02,
      centerLine: { color: 0x50e3c2, opacity: 0.02 },
      restLine: {
        color: 0x2d6bff,
        opacity: 0.1,
        position: { x: 0, y: 0, z: -1 },
        width: 2,
        height: 4,
      },
    },
    visual: {
      size: { w: 1.5, h: 1, d: 2 },
      hitRadius: 0.85,
      wireframeColor: 0x22d3ee,
      accentColor: 0x6d28d9,
      thrusterColor: 0x60c5ff,
    },
    inventory: {
      caps: {
        metalScrap: 999,
        prismaticCrystal: 99,
        denseCore: 49,
        darkMatter: 9,
        equipment: 4,
      },
    },
    cooldowns: SHIP_COOLDOWNS,
    stats: {
      byteCap: 255,
      agility: { current: 100, max: 100 },
      deflection: { current: 100, max: 100 },
      integrity: { current: 100, max: 100 },
      shield: { current: 100, max: 100 },
      precision: { current: 100, max: 100 },
      energy: { current: 100, max: 100 },
    },
    modules: SHIP_MODULES,
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
    fov: 110,
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
        position: { x: 0, y: -400, z: 100 },
        rotation: { x: 0, y: 0, z: 0 },
        gridSize: 2000,
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
        gridSize: 2000,
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
        position: { x: 0, y: -250, z: 100 },
        rotation: { x: 0, y: 0, z: 0 },
        gridSize: 2000,
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
    patternStepKills: 50,
    patterns: ['spread', 'lane', 'pincer', 'rain'],
  },
  score: {
    enemy: 100,
    meteor: 25,
    miniBoss: 2500,
    megaAsteroid: 10000,
    boss: 25000,
    noDamageStreakMul: 1.5,
  },
  drops: {
    magnetRadius: 2.5,
    magnetSpeed: 8,
    metalScrapChance: 0.4,
    fragmentRadius: 0.22,
    poolSize: 64,
    despawn: { zNear: 12, zFar: -40, halfX: 14 },
    stockCaps: {
      metalScrap: 99,
      prismaticCrystal: 40,
      denseCore: 20,
      darkMatter: 8,
      equipment: 4,
    },
    tables: {
      enemy: [
        { id: 'metalScrap', chance: 0.4, min: 1, max: 1 },
        { id: 'prismaticCrystal', chance: 0, min: 0, max: 0 },
        { id: 'denseCore', chance: 0, min: 0, max: 0 },
        { id: 'darkMatter', chance: 0, min: 0, max: 0 },
        { id: 'equipment', chance: 0, min: 0, max: 0 },
      ],
      meteor: [
        { id: 'metalScrap', chance: 1, min: 1, max: 2 },
        { id: 'prismaticCrystal', chance: 0, min: 0, max: 0 },
        { id: 'denseCore', chance: 0, min: 0, max: 0 },
        { id: 'darkMatter', chance: 0, min: 0, max: 0 },
        { id: 'equipment', chance: 0, min: 0, max: 0 },
      ],
      miniBoss: [
        { id: 'metalScrap', chance: 0, min: 0, max: 0 },
        { id: 'prismaticCrystal', chance: 0, min: 0, max: 0 },
        { id: 'denseCore', chance: 0, min: 0, max: 0 },
        { id: 'darkMatter', chance: 0, min: 0, max: 0 },
        { id: 'equipment', chance: 0, min: 0, max: 0 },
      ],
      megaAsteroid: [
        { id: 'metalScrap', chance: 0, min: 0, max: 0 },
        { id: 'prismaticCrystal', chance: 0, min: 0, max: 0 },
        { id: 'denseCore', chance: 0, min: 0, max: 0 },
        { id: 'darkMatter', chance: 0, min: 0, max: 0 },
        { id: 'equipment', chance: 0, min: 0, max: 0 },
      ],
      boss: [
        { id: 'metalScrap', chance: 0, min: 0, max: 0 },
        { id: 'prismaticCrystal', chance: 0, min: 0, max: 0 },
        { id: 'denseCore', chance: 0, min: 0, max: 0 },
        { id: 'darkMatter', chance: 0, min: 0, max: 0 },
        { id: 'equipment', chance: 0, min: 0, max: 0 },
      ],
    },
    colors: {
      metalScrap: 0xc4b5a5,
      prismaticCrystal: 0xc084fc,
      denseCore: 0xfbbf24,
      darkMatter: 0x7c3aed,
      equipment: 0x34d399,
    },
  },
  shot: {
    despawn: { zNear: 16, zFar: -32, halfX: 16 },
  },
  enemy: {
    spawnLeft: {
      offset: { x: -160, y: 50, z: -140 },
      size: { x: 10, y: 2, z: 10 },
      visible: true,
      color: 0xff2222,
      opacity: 0.55,
      intervalSec: 3,
      lanesX: [-4, -2, 0, 2, 4],
      maxActive: 1,
    },
    spawnRight: {
      offset: { x: 160, y: 50, z: -140 },
      size: { x: 10, y: 2, z: 10 },
      visible: true,
      color: 0xff2222,
      opacity: 0.55,
      intervalSec: 3,
      lanesX: [-4, -2, 0, 2, 4],
      maxActive: 1,
    },
    spawnFront: {
      offset: { x: 0, y: 100, z: -140 },
      size: { x: 10, y: 2, z: 10 },
      visible: true,
      color: 0xff2222,
      opacity: 0.55,
      intervalSec: 3,
      lanesX: [-4, -2, 0, 2, 4],
      maxActive: 1,
    },
    gate: {
      offset: { x: 0, y: 0, z: -90 },
      size: { x: 60, y: 1.2, z: 8 },
      visible: true,
      color: 0xf59e0b,
      opacity: 0.55,
      markerRadius: 1.2,
      arriveRadius: 8,
      reachSpeedMul: 3,
      agilityLambda: 3.5,
      entryPointsX: {
        left: [-24, -18, -12],
        middle: [-6, 0, 6],
        right: [12, 18, 24],
      },
    },
    generic: {
      hp: WARRIOR.hp,
      radius: WARRIOR.radius,
      color: WARRIOR.color,
      maxSpeed: WARRIOR.maxSpeed,
      contactDamage: WARRIOR.contactDamage,
    },
    warrior: WARRIOR,
    despawn: { zNear: 30, zFar: -160, halfX: 240 },
    poolSize: 32,
    shotPoolSize: 64,
  },
  battlefield: {
    offsetX: { min: -240, max: 240 },
    offsetZ: { min: -160, max: 30 },
    wallHeight: 6,
    color: 0x3b82f6,
    opacity: 0.9,
    visible: true,
  },
  vfx: {
    shake: { maxAmplitude: 0.18, decayPerSec: 6 },
    hitStopFrames: 3,
  },
  haptics: {
    enabled: true,
    presets: {
      shieldHit: { durationMs: 40, strongMagnitude: 0.12, weakMagnitude: 0.35 },
      hullHit: { durationMs: 80, strongMagnitude: 0.45, weakMagnitude: 0.28 },
      shieldBreak: { durationMs: 180, strongMagnitude: 0.85, weakMagnitude: 0.5 },
      destroyed: { durationMs: 420, strongMagnitude: 1, weakMagnitude: 0.7 },
      fireLaser: { durationMs: 16, strongMagnitude: 0, weakMagnitude: 0.08 },
    },
  },
  loop: {
    maxFrameDt: 0.05,
    sidecarHz: 15,
  },
  gizmos: {
    gridSize: 1000,
    gridDivisions: 1000,
    gridColor: 0x2b6fd8,
    gridY: -1,
    gridOpacity: 0,
    worldAxisSize: 4,
    cameraAxisSize: 2.2,
    axis: { x: 0xff4455, y: 0x55ff77, z: 0x55aaff },
    lineOpacity: 0.1,
  },
  debug: {
    syncHz: 15,
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
