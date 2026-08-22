/**
 * Warrior archetype sheet — balanced gunship (ENM / bestiary stand-in).
 * Targets: enemyGate → player. Fixed weapon; spawners instantiate this profile.
 *
 * Post-gate behaviour is squad driven: `formation`, `morale` and `affinity`
 * are the per-instance knobs of the group AI (all editable in the debugger).
 */

import { DEFAULT_STATUS_CONFIG, type WarriorStatusConfig } from '../../systems/enemy-strategy'

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

/** Slot seeking, hovering and the emergency BOOST state. */
export interface WarriorFormationConfig {
  /** Inside this distance the ship is "in slot" (hover + damping). */
  slotTolerance: number
  /** Beyond this distance the ship enters BOOST to rejoin. */
  boostDistance: number
  /** Agility multiplier while boosting. */
  boostAgilityMul: number
  /** Sine hover amplitude on the local X axis (world units). */
  hoverAmp: number
  /** Sine hover frequency (Hz). */
  hoverHz: number
  /** Random offset radius around the exact vertex (never snap perfectly). */
  imperfectionRadius: number
}

/** FURY / FLEE triggers. */
export interface WarriorMoraleConfig {
  /** Player inside this radius arms the proximity aggro timer. */
  furyProximityRadius: number
  /** Seconds of sustained proximity before FURY. */
  furyProximitySec: number
  /** Agility multiplier while in FURY (kamikaze intercept). */
  furyAgilityMul: number
  /** Hits inside the window that trigger retaliation FURY. */
  retaliationHits: number
  retaliationWindowMs: number
  /** Group health percentage under which members break and flee. */
  fleeGroupHealthPct: number
  fleeAgilityMul: number
}

/** Dynamic affinity migration mesh. */
export interface WarriorAffinityConfig {
  /** Affinity gained per second while inside a group's radius. */
  gainPerSec: number
  /** Affinity lost per second for every other group. */
  decayPerSec: number
  /** Distance to a centroid that counts as "close". */
  radius: number
  /** Bonus the native group keeps, so migration needs a clear win. */
  loyalty: number
}

export interface WarriorSheet {
  readonly id: 'warrior'
  readonly name: string
  readonly hp: number
  readonly shieldMax: number
  readonly shieldRegenPerSec: number
  readonly radius: number
  readonly color: number
  readonly contactDamage: number
  readonly maxSpeed: number
  /** Derived steering force bound (agility / 5). */
  readonly maxForce: number
  readonly agility: number
  readonly intelligence: number
  readonly targets: readonly EnemyTargetId[]
  readonly reachSpeedMul: number
  /** Max nose rotation speed (deg / sec). Lower = wider, softer turns. */
  readonly turnRateDeg: number
  readonly weapon: EnemyWeaponSheet
  readonly status: WarriorStatusConfig
  readonly formation: WarriorFormationConfig
  readonly morale: WarriorMoraleConfig
  readonly affinity: WarriorAffinityConfig
}

/** Mutable debugger / live-spawn copy of a Warrior sheet. */
export interface EditableWarriorSheet {
  id: 'warrior'
  name: string
  hp: number
  shieldMax: number
  shieldRegenPerSec: number
  radius: number
  color: number
  contactDamage: number
  maxSpeed: number
  maxForce: number
  agility: number
  intelligence: number
  targets: EnemyTargetId[]
  reachSpeedMul: number
  turnRateDeg: number
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
  formation: WarriorFormationConfig
  morale: WarriorMoraleConfig
  affinity: WarriorAffinityConfig
}

export function cloneWarriorSheet(src: WarriorSheet | EditableWarriorSheet): EditableWarriorSheet {
  const agility = src.agility
  return {
    id: 'warrior',
    name: src.name,
    hp: src.hp,
    shieldMax: src.shieldMax,
    shieldRegenPerSec: src.shieldRegenPerSec,
    radius: src.radius,
    color: src.color,
    contactDamage: src.contactDamage,
    maxSpeed: warriorMaxSpeed(agility),
    maxForce: warriorMaxForce(agility),
    agility,
    intelligence: src.intelligence,
    targets: [...src.targets],
    reachSpeedMul: src.reachSpeedMul,
    turnRateDeg: src.turnRateDeg,
    weapon: { ...src.weapon },
    status: { ...src.status },
    formation: { ...src.formation },
    morale: { ...src.morale },
    affinity: { ...src.affinity },
  }
}

export function warriorMaxSpeed(agility: number): number {
  return Math.max(0, agility / 10)
}

/** Steering force bound: how hard the craft can bend its own velocity. */
export function warriorMaxForce(agility: number): number {
  return Math.max(0.1, agility / 5)
}

export function warriorAgilityLambda(agility: number): number {
  const t = Math.min(1, Math.max(0, agility / 100))
  return 1.2 + t * 5
}

export function warriorEngageRange(intelligence: number, weaponRange: number): number {
  const t = Math.min(1, Math.max(0, intelligence / 100))
  return weaponRange * (0.35 + t * 0.65)
}

export const DEFAULT_FORMATION_CONFIG: WarriorFormationConfig = {
  slotTolerance: 1.2,
  boostDistance: 9,
  boostAgilityMul: 2.2,
  hoverAmp: 0.35,
  hoverHz: 0.5,
  imperfectionRadius: 0.3,
}

export const DEFAULT_MORALE_CONFIG: WarriorMoraleConfig = {
  furyProximityRadius: 14,
  furyProximitySec: 2,
  furyAgilityMul: 2,
  retaliationHits: 3,
  retaliationWindowMs: 1200,
  fleeGroupHealthPct: 15,
  fleeAgilityMul: 1.6,
}

export const DEFAULT_AFFINITY_CONFIG: WarriorAffinityConfig = {
  gainPerSec: 0.6,
  decayPerSec: 0.25,
  radius: 18,
  loyalty: 0.15,
}

export const WARRIOR: WarriorSheet = {
  id: 'warrior',
  name: 'Warrior',
  hp: 3,
  shieldMax: 2,
  shieldRegenPerSec: 0.35,
  radius: 0.55,
  color: 0xf43f5e,
  contactDamage: 8,
  /** Derived: agility / 10 (kept on sheet for debugger / balance mirrors). */
  maxSpeed: warriorMaxSpeed(55),
  /** Derived: agility / 5. */
  maxForce: warriorMaxForce(55),
  agility: 55,
  intelligence: 60,
  targets: ['enemyGate', 'player'],
  reachSpeedMul: 3,
  turnRateDeg: 120,
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
  formation: { ...DEFAULT_FORMATION_CONFIG },
  morale: { ...DEFAULT_MORALE_CONFIG },
  affinity: { ...DEFAULT_AFFINITY_CONFIG },
}

export type { WarriorStatusConfig }
