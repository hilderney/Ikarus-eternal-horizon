/**
 * Warrior movement strategy weights + status modifiers (chase phase).
 */

export type ChaseStrategyId = 'straight' | 'engage' | 'flee' | 'loop_around'

/** Runtime status ids shown in debugger / used for strategy gates. */
export type WarriorStatusId =
  | 'none'
  | 'hitted'
  | 'hitting'
  | 'in_range'
  | 'passed_opponent'
  | 'fixed_movement_strategy'

/** Statuses that modify strategy pick weights (stack). */
export type WeightModStatusId = Exclude<
  WarriorStatusId,
  'none' | 'fixed_movement_strategy'
>

export const ENEMY_STATUS_CATALOG: readonly WarriorStatusId[] = [
  'hitted',
  'hitting',
  'in_range',
  'passed_opponent',
  'fixed_movement_strategy',
] as const

export interface StrategyWeights {
  straight: number
  engage: number
  flee: number
  loop_around: number
}

export interface StatusWeightMods {
  straight?: number
  engage?: number
  flee?: number
  loop_around?: number
}

export interface WarriorStatusConfig {
  /** Active window after taking damage (ms). */
  hittedCdMs: number
  /** Active window after dealing a hit / firing (ms). */
  hittingCdMs: number
  /** Player within this radius ⇒ in_range (world units). */
  inRangeRadius: number
  /** Show translucent range disc. */
  rangeVisible: boolean
  rangeColor: number
  rangeOpacity: number
}

export interface WarriorStrategyConfig {
  /** Base pick chances (relative weights; need not sum to 100). */
  weights: StrategyWeights
  /** Additive modifiers while each status is active (stack). */
  mods: Record<WeightModStatusId, StatusWeightMods>
  /**
   * Base interval between strategy rolls (ms).
   * Effective hold = max(250, swapBaseMs - intelligence).
   */
  swapBaseMs: number
  /** Max nose rotation speed (deg / sec). Lower = wider, softer turns. */
  turnRateDeg: number
  loopAround: {
    radius: number
    speedMul: number
    /** End behind the loop start on Z (combat re-entry). */
    retreatZ: number
  }
}

export const DEFAULT_STRATEGY_WEIGHTS: StrategyWeights = {
  straight: 40,
  engage: 50,
  flee: 5,
  loop_around: 5,
}

export const DEFAULT_STATUS_CONFIG: WarriorStatusConfig = {
  hittedCdMs: 300,
  hittingCdMs: 300,
  inRangeRadius: 20,
  rangeVisible: true,
  rangeColor: 0xcccccc,
  rangeOpacity: 0.18,
}

export const DEFAULT_STRATEGY_CONFIG: WarriorStrategyConfig = {
  weights: { ...DEFAULT_STRATEGY_WEIGHTS },
  mods: {
    hitted: { flee: 20, straight: -20 },
    hitting: { engage: 30, straight: -30 },
    in_range: { engage: 20, loop_around: 20, straight: -40 },
    passed_opponent: { loop_around: 20, engage: -20 },
  },
  swapBaseMs: 5000,
  turnRateDeg: 120,
  loopAround: {
    radius: 14,
    speedMul: 1.35,
    retreatZ: 6,
  },
}

export interface ActiveStatuses {
  hitted: boolean
  hitting: boolean
  in_range: boolean
  passed_opponent: boolean
  fixed_movement_strategy: boolean
}

/** Hold between strategy rolls: swapBaseMs − intelligence (floored). */
export function strategyHoldMs(intelligence: number, swapBaseMs = 5000): number {
  return Math.max(250, swapBaseMs - intelligence)
}

/** Resolve effective weights from base + active status modifiers (floor at 0). */
export function effectiveStrategyWeights(
  base: StrategyWeights,
  mods: WarriorStrategyConfig['mods'],
  active: ActiveStatuses,
): StrategyWeights {
  const out: StrategyWeights = { ...base }
  const apply = (m: StatusWeightMods): void => {
    out.straight = Math.max(0, out.straight + (m.straight ?? 0))
    out.engage = Math.max(0, out.engage + (m.engage ?? 0))
    out.flee = Math.max(0, out.flee + (m.flee ?? 0))
    out.loop_around = Math.max(0, out.loop_around + (m.loop_around ?? 0))
  }
  if (active.hitted) {
    apply(mods.hitted)
  }
  if (active.hitting) {
    apply(mods.hitting)
  }
  if (active.in_range) {
    apply(mods.in_range)
  }
  if (active.passed_opponent) {
    apply(mods.passed_opponent)
  }
  return out
}

/** Weighted random pick. Falls back to straight if all zero. */
export function pickChaseStrategy(
  weights: StrategyWeights,
  rand: () => number = Math.random,
): ChaseStrategyId {
  const entries: { id: ChaseStrategyId; w: number }[] = [
    { id: 'straight', w: weights.straight },
    { id: 'engage', w: weights.engage },
    { id: 'flee', w: weights.flee },
    { id: 'loop_around', w: weights.loop_around },
  ]
  const total = entries.reduce((s, e) => s + e.w, 0)
  if (total <= 0) {
    return 'straight'
  }
  let r = rand() * total
  for (const e of entries) {
    r -= e.w
    if (r <= 0) {
      return e.id
    }
  }
  return entries[entries.length - 1]?.id ?? 'straight'
}

/** True when player lies inside the nose fire cone (XZ). */
export function isInsideFireCone(
  originX: number,
  originZ: number,
  facingY: number,
  targetX: number,
  targetZ: number,
  halfConeRad: number,
): boolean {
  const dx = targetX - originX
  const dz = targetZ - originZ
  if (Math.hypot(dx, dz) <= 1e-6) {
    return true
  }
  const toTarget = Math.atan2(dx, dz)
  let delta = toTarget - facingY
  while (delta > Math.PI) {
    delta -= Math.PI * 2
  }
  while (delta < -Math.PI) {
    delta += Math.PI * 2
  }
  return Math.abs(delta) <= halfConeRad
}
