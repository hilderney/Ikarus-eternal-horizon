/**
 * SDD-F03 DifficultyManager — kill-driven spawn rate and pattern scaling.
 * Reads G10 kill counter; does not spawn, damage, or write kills.
 */

import { BALANCE } from '../core/balancer'

export type MilestoneId = 'miniBoss' | 'megaAsteroid' | 'boss'

export type PatternId = 'spread' | 'lane' | 'pincer' | 'rain'

export interface KillCounterPort {
  readonly kills: number
}

export interface DifficultySnapshot {
  kills: number
  spawnRateMul: number
  patternId: PatternId
  pendingMilestone: MilestoneId | null
  cycleIndex: number
}

export interface DifficultyManagerOptions {
  readonly kills: KillCounterPort
}

export function spawnRateMulAt(kills: number, perKill: number): number {
  return Math.max(1, 1 + kills * perKill)
}

export function patternIdAt(
  kills: number,
  bossAt: number,
  cycle: readonly PatternId[],
): PatternId {
  if (kills < bossAt || cycle.length === 0) {
    return cycle[0] ?? 'spread'
  }
  const step = BALANCE.difficulty.patternStepKills
  const idx = Math.floor((kills - bossAt) / step) % cycle.length
  return cycle[idx] ?? 'spread'
}

function milestoneAt(kills: number): MilestoneId | null {
  const { miniBossAt, megaAsteroidAt, bossAt } = BALANCE.difficulty
  if (kills <= 0) return null
  const rem = kills % bossAt
  if (rem === miniBossAt) return 'miniBoss'
  if (rem === megaAsteroidAt) return 'megaAsteroid'
  if (rem === 0 && kills >= bossAt) return 'boss'
  return null
}

const BASE_PATTERN: PatternId = BALANCE.difficulty.patterns[0] ?? 'spread'

export class DifficultyManager {
  private readonly _kills: KillCounterPort
  private _lastKills = 0
  private _spawnRateMul = 1
  private _patternId: PatternId = BASE_PATTERN
  private _pendingMilestone: MilestoneId | null = null
  private _cycleIndex = 0
  private readonly _snap: DifficultySnapshot = {
    kills: 0,
    spawnRateMul: 1,
    patternId: BASE_PATTERN,
    pendingMilestone: null,
    cycleIndex: 0,
  }

  constructor(options: DifficultyManagerOptions) {
    this._kills = options.kills
    this._recompute(this._kills.kills)
    this._lastKills = this._kills.kills
  }

  get spawnRateMul(): number {
    return this._spawnRateMul
  }

  get patternId(): PatternId {
    return this._patternId
  }

  get pendingMilestone(): MilestoneId | null {
    return this._pendingMilestone
  }

  get cycleIndex(): number {
    return this._cycleIndex
  }

  update(dt: number): void {
    void dt
    const kills = this._kills.kills
    this._recompute(kills)
    this._armCrossed(this._lastKills, kills)
    this._lastKills = kills
  }

  consumeMilestone(): MilestoneId | null {
    const id = this._pendingMilestone
    this._pendingMilestone = null
    return id
  }

  snapshot(): DifficultySnapshot {
    this._snap.kills = this._kills.kills
    this._snap.spawnRateMul = this._spawnRateMul
    this._snap.patternId = this._patternId
    this._snap.pendingMilestone = this._pendingMilestone
    this._snap.cycleIndex = this._cycleIndex
    return this._snap
  }

  reset(): void {
    this._pendingMilestone = null
    this._lastKills = this._kills.kills
    this._recompute(this._kills.kills)
  }

  private _recompute(kills: number): void {
    const d = BALANCE.difficulty
    this._spawnRateMul = spawnRateMulAt(kills, d.spawnRateMulPerKill)
    this._patternId = patternIdAt(kills, d.bossAt, d.patterns)
    this._cycleIndex = Math.floor(kills / d.bossAt)
  }

  private _armCrossed(prev: number, next: number): void {
    if (next <= prev) return
    for (let k = prev + 1; k <= next; k++) {
      const id = milestoneAt(k)
      if (id) this._pendingMilestone = id
    }
  }
}
