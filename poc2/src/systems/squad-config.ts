/**
 * Squad (macro AI) tuning shared by EnemyGroup and EnemySquadManager.
 *
 * Lives outside balancer.ts to keep BALANCE free of import cycles, exactly like
 * the Warrior sheet: BALANCE.enemy.squad simply points at DEFAULT_SQUAD_CONFIG.
 */

export interface SquadConfig {
  /** Hard cap of simultaneously active groups. */
  readonly maxGroups: number
  /** Slots per group (also the slot buffer size). */
  readonly maxPerGroup: number
  /** Structural decisions per second (staggered off the render frame). */
  readonly tickHz: number
  /** Ships evaluated for affinity / migration on each structural tick. */
  readonly shipsPerTick: number

  readonly circleRadius: number
  readonly vSpacing: number
  readonly vAngleDeg: number
  readonly diamondW: number
  readonly diamondH: number
  /** Damp λ used when a ship's slot offset is re-indexed (no snapping). */
  readonly slotLerpRate: number

  readonly groupMaxSpeed: number
  readonly groupMaxForce: number
  readonly groupArriveRadius: number
  /** Damp λ easing the group heading toward its travel direction. */
  readonly groupTurnLambda: number
  readonly groupSeparationRadius: number
  readonly groupSeparationWeight: number

  /** Random patrol target countdown window (ms). */
  readonly targetHoldMinMs: number
  readonly targetHoldMaxMs: number
  /** Member loss fraction that flips a group to Aggressive Intercept. */
  readonly casualtyPct: number
  /** Patrol Z band relative to the player (negative = ahead of the ship). */
  readonly patrolZMin: number
  readonly patrolZMax: number
  /** Intercept aims this far behind the player on Z. */
  readonly interceptStandoffZ: number

  /** Ship-relative half width of the visible arena used for containment. */
  readonly arenaHalfX: number
  readonly containmentInsetX: number
  readonly containmentExp: number
  readonly containmentWeight: number

  /** Outer-radius speed bonus during group turns (time-of-arrival sync). */
  readonly curvatureScale: number

  /** A ship joins an existing group only within this distance. */
  readonly joinRadius: number
  readonly shipSeparationRadius: number
  readonly shipSeparationWeight: number
  readonly rogueAvoidRadius: number
  readonly rogueAvoidWeight: number
}

/** Mutable debugger copy. */
export type EditableSquadConfig = {
  -readonly [K in keyof SquadConfig]: SquadConfig[K]
}

export const DEFAULT_SQUAD_CONFIG: SquadConfig = {
  maxGroups: 6,
  maxPerGroup: 8,
  tickHz: 5,
  shipsPerTick: 12,

  circleRadius: 7,
  vSpacing: 4,
  vAngleDeg: 35,
  diamondW: 8,
  diamondH: 6,
  slotLerpRate: 4,

  groupMaxSpeed: 3.5,
  groupMaxForce: 6,
  groupArriveRadius: 10,
  groupTurnLambda: 2.5,
  groupSeparationRadius: 26,
  groupSeparationWeight: 8,

  targetHoldMinMs: 3000,
  targetHoldMaxMs: 5000,
  casualtyPct: 0.5,
  patrolZMin: -70,
  patrolZMax: -20,
  interceptStandoffZ: 4,

  arenaHalfX: 34,
  containmentInsetX: 8,
  containmentExp: 3,
  containmentWeight: 12,

  curvatureScale: 0.6,

  joinRadius: 60,
  shipSeparationRadius: 2.6,
  shipSeparationWeight: 6,
  rogueAvoidRadius: 6,
  rogueAvoidWeight: 10,
}

export function cloneSquadConfig(src: SquadConfig | EditableSquadConfig): EditableSquadConfig {
  return { ...src }
}
