import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STATUS_CONFIG,
  ENEMY_AI_STATE_CATALOG,
  ENEMY_STATUS_CATALOG,
  isInsideFireCone,
  isRogueState,
} from './enemy-strategy'

describe('enemy AI state catalog', () => {
  it('lists the squad states in lifecycle order', () => {
    expect(ENEMY_AI_STATE_CATALOG).toEqual([
      'birth',
      'formation',
      'boost',
      'migrating',
      'fury',
      'flee',
    ])
  })

  it('treats only FURY and FLEE as rogue (right of way)', () => {
    expect(isRogueState('fury')).toBe(true)
    expect(isRogueState('flee')).toBe(true)
    expect(isRogueState('formation')).toBe(false)
    expect(isRogueState('boost')).toBe(false)
    expect(isRogueState('migrating')).toBe(false)
  })

  it('keeps the runtime status flags and their cooldowns', () => {
    expect(ENEMY_STATUS_CATALOG).toEqual(['hitted', 'hitting', 'in_range', 'passed_opponent'])
    expect(DEFAULT_STATUS_CONFIG.hittedCdMs).toBe(300)
    expect(DEFAULT_STATUS_CONFIG.hittingCdMs).toBe(300)
    expect(DEFAULT_STATUS_CONFIG.inRangeRadius).toBe(20)
  })
})

describe('fire cone', () => {
  it('accepts targets within ±halfCone of the nose', () => {
    expect(isInsideFireCone(0, 0, 0, 0, 10, Math.PI / 12)).toBe(true)
    expect(isInsideFireCone(0, 0, 0, 10, 10, Math.PI / 12)).toBe(false)
  })

  it('follows the nose when the craft is rotated', () => {
    const east = Math.PI / 2
    expect(isInsideFireCone(0, 0, east, 10, 0, Math.PI / 12)).toBe(true)
    expect(isInsideFireCone(0, 0, east, 0, 10, Math.PI / 12)).toBe(false)
  })
})
