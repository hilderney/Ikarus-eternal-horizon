import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STRATEGY_CONFIG,
  effectiveStrategyWeights,
  isInsideFireCone,
  pickChaseStrategy,
  strategyHoldMs,
} from './enemy-strategy'

describe('enemy-strategy weights', () => {
  it('applies stacked status modifiers and floors at 0', () => {
    const w = effectiveStrategyWeights(DEFAULT_STRATEGY_CONFIG.weights, DEFAULT_STRATEGY_CONFIG.mods, {
      hitted: true,
      hitting: false,
      in_range: true,
      passed_opponent: false,
      fixed_movement_strategy: false,
    })
    // base straight 40 -20 (hitted) -40 (in_range) = 0
    expect(w.straight).toBe(0)
    // engage 50 +20 in_range = 70
    expect(w.engage).toBe(70)
    // flee 5 +20 hitted = 25
    expect(w.flee).toBe(25)
    // loop 5 +20 in_range = 25
    expect(w.loop_around).toBe(25)
  })

  it('pickChaseStrategy respects deterministic rand', () => {
    const weights = { straight: 0, engage: 100, flee: 0, loop_around: 0 }
    expect(pickChaseStrategy(weights, () => 0.5)).toBe('engage')
  })

  it('falls back to straight when all weights are zero', () => {
    expect(
      pickChaseStrategy({ straight: 0, engage: 0, flee: 0, loop_around: 0 }, () => 0.9),
    ).toBe('straight')
  })

  it('strategyHoldMs = swapBaseMs - intelligence (floored)', () => {
    expect(strategyHoldMs(60, 5000)).toBe(4940)
    expect(strategyHoldMs(5000, 5000)).toBe(250)
  })

  it('isInsideFireCone accepts targets within ±halfCone of nose', () => {
    // Facing +Z, player dead ahead.
    expect(isInsideFireCone(0, 0, 0, 0, 10, Math.PI / 12)).toBe(true)
    // 45° off with 15° half-cone ⇒ outside.
    expect(isInsideFireCone(0, 0, 0, 10, 10, Math.PI / 12)).toBe(false)
  })
})
