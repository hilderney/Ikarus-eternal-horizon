/**
 * Warrior archetype sheet — balanced gunship (ENM / bestiary stand-in).
 * Targets: enemyGate → player. Fixed weapon; spawners instantiate this profile.
 */

export type EnemyTargetId = 'enemyGate' | 'player'
export type EnemyArchetypeId = 'warrior'

export interface EnemyWeaponSheet {
  /** Shots per second while allowed to fire. */
  readonly rate: number
  readonly damage: number
  /** Bolt speed (world units / sec) toward the player. */
  readonly speed: number
  readonly lifetime: number
  readonly range: number
  readonly radius: number
  readonly color: number
  /** Local Z muzzle offset (negative = toward ship / forward for hostiles). */
  readonly muzzleZ: number
  readonly decayPerUnit: number
}

export interface WarriorSheet {
  readonly id: 'warrior'
  readonly name: string
  readonly hp: number
  readonly radius: number
  readonly color: number
  readonly contactDamage: number
  readonly maxSpeed: number
  /** 0–100. Higher = snappier speed damp (agility curve). */
  readonly agility: number
  /** 0–100. Higher = opens fire earlier (engagement range fraction). */
  readonly intelligence: number
  /** Ordered intent: rush gate, then attack player. */
  readonly targets: readonly EnemyTargetId[]
  readonly reachSpeedMul: number
  readonly weapon: EnemyWeaponSheet
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
  }
}

export function cloneWarriorSheet(src: WarriorSheet): EditableWarriorSheet {
  return {
    id: src.id,
    name: src.name,
    hp: src.hp,
    radius: src.radius,
    color: src.color,
    contactDamage: src.contactDamage,
    maxSpeed: src.maxSpeed,
    agility: src.agility,
    intelligence: src.intelligence,
    targets: [...src.targets],
    reachSpeedMul: src.reachSpeedMul,
    weapon: { ...src.weapon },
  }
}

/** Map sheet agility (0–100) → damp λ for currentSpeed → targetSpeed. */
export function warriorAgilityLambda(agility: number): number {
  const t = Math.min(1, Math.max(0, agility / 100))
  return 1.2 + t * 5
}

/**
 * Intelligence scales how far into weapon.range the Warrior opens fire (0.35…1.0).
 */
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
  maxSpeed: 4,
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
  },
}
