/**
 * Enemy runtime state catalog + combat helpers shared by the squad AI.
 *
 * The weighted chase strategies (straight / engage / flee / loop_around) were
 * replaced by the group AI: macro objectives live in EnemyGroup and per-ship
 * behaviour is a deterministic state machine (see ShipAiState).
 */

/** Per-ship AI state after the birth animation. */
export type ShipAiState = 'birth' | 'formation' | 'boost' | 'migrating' | 'fury' | 'flee'

export const ENEMY_AI_STATE_CATALOG: readonly ShipAiState[] = [
  'birth',
  'formation',
  'boost',
  'migrating',
  'fury',
  'flee',
] as const

/** Rogue states own the right of way and ignore formation traffic rules. */
export function isRogueState(state: ShipAiState): boolean {
  return state === 'fury' || state === 'flee'
}

/** Runtime status flags shown in the debugger. */
export type WarriorStatusId = 'hitted' | 'hitting' | 'in_range' | 'passed_opponent'

export const ENEMY_STATUS_CATALOG: readonly WarriorStatusId[] = [
  'hitted',
  'hitting',
  'in_range',
  'passed_opponent',
] as const

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

export const DEFAULT_STATUS_CONFIG: WarriorStatusConfig = {
  hittedCdMs: 300,
  hittingCdMs: 300,
  inRangeRadius: 20,
  rangeVisible: true,
  rangeColor: 0xcccccc,
  rangeOpacity: 0.18,
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
