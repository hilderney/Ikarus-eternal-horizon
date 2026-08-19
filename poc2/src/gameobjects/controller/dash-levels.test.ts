import { describe, expect, it } from 'vitest'
import { BALANCE } from '../../core/balancer'
import { DASH_LEVELS } from './dash-levels'

function intraBandSteps(key: 'energyCost' | 'speedMul', start: number): number[] {
  return [1, 2, 3].map((i) => {
    const prev = DASH_LEVELS[start + i - 1]
    const row = DASH_LEVELS[start + i]
    return (row?.[key] ?? 0) - (prev?.[key] ?? 0)
  })
}

describe('DASH_LEVELS', () => {
  it('has 12 rows, levels 1..12', () => {
    expect(DASH_LEVELS).toHaveLength(12)
    expect(DASH_LEVELS.map((row) => row.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })

  it('L1 speedMul matches BALANCE.controls.dash', () => {
    expect(DASH_LEVELS[0]?.speedMul).toBe(BALANCE.controls.dash.speedMul)
  })

  it('energy cost follows the laser band pattern (step doubles every 4 levels)', () => {
    const b1 = intraBandSteps('energyCost', 0)
    const b2 = intraBandSteps('energyCost', 4)
    const b3 = intraBandSteps('energyCost', 8)
    expect(b1[0]).toBeGreaterThan(0)
    expect(b1.every((step) => step === b1[0])).toBe(true)
    expect(b2.every((step) => step === b2[0])).toBe(true)
    expect(b3.every((step) => step === b3[0])).toBe(true)
    expect(b2[0]).toBeCloseTo((b1[0] ?? 0) * 2, 10)
    expect(b3[0]).toBeCloseTo((b2[0] ?? 0) * 2, 10)
  })

  it('speedMul increases every row so later levels travel farther', () => {
    for (let i = 1; i < DASH_LEVELS.length; i++) {
      const prev = DASH_LEVELS[i - 1]
      const row = DASH_LEVELS[i]
      expect(row?.speedMul).toBeGreaterThan(prev?.speedMul ?? 0)
    }
  })
})
