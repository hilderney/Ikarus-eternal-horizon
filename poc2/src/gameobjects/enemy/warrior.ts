/**
 * Warrior archetype sheet — balanced gunship (ENM / bestiary stand-in).
 * Targets: enemyGate → player. Fixed weapon; spawners instantiate this profile.
 */

import {
  DEFAULT_STATUS_CONFIG,
  DEFAULT_STRATEGY_CONFIG,
  type StrategyWeights,
  type WarriorStatusConfig,
  type WarriorStrategyConfig,
} from '../../systems/enemy-strategy'

export type EnemyTargetId = 'enemyGate' | 'player'
export type EnemyArchetypeId = 'warrior'

export interface EnemyWeaponSheet {
  readonly rate: number
  readonly damage: number
  /** Bolt travel speed along nose (world units / sec). */
  readonly speed: number
  readonly lifetime: number
  readonly range: number
  readonly radius: number
  readonly color: number
  /** Local forward muzzle offset along nose. */
  readonly muzzleZ: number
  readonly decayPerUnit: number
  /** Full fire-cone amplitude in degrees (nose ± half). */
  readonly fireConeDeg: number
}

export interface WarriorSheet {
  readonly id: 'warrior'
  readonly name: string
  readonly hp: number
  readonly radius: number
  readonly color: number
  readonly contactDamage: number
  readonly maxSpeed: number
  readonly agility: number
  readonly intelligence: number
  readonly targets: readonly EnemyTargetId[]
  readonly reachSpeedMul: number
  readonly weapon: EnemyWeaponSheet
  readonly status: WarriorStatusConfig
  readonly strategy: WarriorStrategyConfig
}

/** Mutable debugger / live-spawn copy of a Warrior sheet. */
export interface EditableWarriorSheet {
  id: 'warrior'
  name: string
  hp: number
  radius: number
  color: number
  contactDamage: number
  maxSpeed: number
  agility: number
  intelligence: number
  targets: EnemyTargetId[]
  reachSpeedMul: number
  weapon: {
    rate: number
    damage: number
    speed: number
    lifetime: number
    range: number
    radius: number
    color: number
    muzzleZ: number
    decayPerUnit: number
    fireConeDeg: number
  }
  status: WarriorStatusConfig
  strategy: WarriorStrategyConfig
}

function cloneStatus(src: WarriorStatusConfig): WarriorStatusConfig {
  return { ...src }
}

function cloneStrategy(src: WarriorStrategyConfig): WarriorStrategyConfig {
  return {
    swapBaseMs: src.swapBaseMs,
    turnRateDeg: src.turnRateDeg,
    weights: { ...src.weights },
    mods: {
      hitted: { ...src.mods.hitted },
      hitting: { ...src.mods.hitting },
      in_range: { ...src.mods.in_range },
      passed_opponent: { ...src.mods.passed_opponent },
    },
    loopAround: { ...src.loopAround },
  }
}

export function cloneWarriorSheet(src: WarriorSheet | EditableWarriorSheet): EditableWarriorSheet {
  const agility = src.agility
  return {
    id: 'warrior',
    name: src.name,
    hp: src.hp,
    radius: src.radius,
    color: src.color,
    contactDamage: src.contactDamage,
    maxSpeed: warriorMaxSpeed(agility),
    agility,
    intelligence: src.intelligence,
    targets: [...src.targets],
    reachSpeedMul: src.reachSpeedMul,
    weapon: { ...src.weapon },
    status: cloneStatus(src.status),
    strategy: cloneStrategy(src.strategy),
  }
}

export function warriorMaxSpeed(agility: number): number {
  return Math.max(0, agility / 10)
}

export function warriorAgilityLambda(agility: number): number {
  const t = Math.min(1, Math.max(0, agility / 100))
  return 1.2 + t * 5
}

export function warriorEngageRange(intelligence: number, weaponRange: number): number {
  const t = Math.min(1, Math.max(0, intelligence / 100))
  return weaponRange * (0.35 + t * 0.65)
}

export const WARRIOR: WarriorSheet = {
  id: 'warrior',
  name: 'Warrior',
  hp: 3,
  radius: 0.55,
  color: 0xf43f5e,
  contactDamage: 8,
  /** Derived: agility / 10 (kept on sheet for debugger / balance mirrors). */
  maxSpeed: warriorMaxSpeed(55),
  agility: 55,
  intelligence: 60,
  targets: ['enemyGate', 'player'],
  reachSpeedMul: 3,
  weapon: {
    rate: 1.6,
    damage: 4,
    speed: 16,
    lifetime: 2.2,
    range: 28,
    radius: 0.18,
    color: 0xfb923c,
    muzzleZ: 0.6,
    decayPerUnit: 0,
    fireConeDeg: 30,
  },
  status: { ...DEFAULT_STATUS_CONFIG },
  strategy: cloneStrategy(DEFAULT_STRATEGY_CONFIG),
}

export type { StrategyWeights, WarriorStatusConfig, WarriorStrategyConfig }
