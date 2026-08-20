import { describe, expect, it } from 'vitest'
import { BALANCE } from '../core/balancer'
import {
  DifficultyManager,
  patternIdAt,
  spawnRateMulAt,
  type KillCounterPort,
  type PatternId,
} from './difficulty-manager'

function killPort(kills: number): KillCounterPort & { kills: number } {
  return { kills }
}

describe('DifficultyManager', () => {
  it('spawnRateMul is 1 + kills * 0.002 (0→1, 500→2)', () => {
    const kills = killPort(0)
    const dm = new DifficultyManager({ kills })
    dm.update(0)
    expect(dm.spawnRateMul).toBe(1)
    expect(spawnRateMulAt(0, BALANCE.difficulty.spawnRateMulPerKill)).toBe(1)

    kills.kills = 500
    dm.update(0)
    expect(dm.spawnRateMul).toBe(2)
    expect(spawnRateMulAt(500, 0.002)).toBe(2)
  })

  it('arms miniBoss at 50 and 550', () => {
    const kills = killPort(0)
    const dm = new DifficultyManager({ kills })

    kills.kills = 50
    dm.update(0)
    expect(dm.pendingMilestone).toBe('miniBoss')
    dm.consumeMilestone()

    kills.kills = 550
    dm.update(0)
    expect(dm.pendingMilestone).toBe('miniBoss')
  })

  it('arms megaAsteroid at 100 and 600', () => {
    const kills = killPort(0)
    const dm = new DifficultyManager({ kills })

    kills.kills = 100
    dm.update(0)
    expect(dm.pendingMilestone).toBe('megaAsteroid')
    dm.consumeMilestone()

    kills.kills = 600
    dm.update(0)
    expect(dm.pendingMilestone).toBe('megaAsteroid')
  })

  it('arms boss at 500 and 1000, never at 0', () => {
    const kills = killPort(0)
    const dm = new DifficultyManager({ kills })
    dm.update(0)
    expect(dm.pendingMilestone).toBeNull()

    kills.kills = 500
    dm.update(0)
    expect(dm.pendingMilestone).toBe('boss')
    dm.consumeMilestone()

    kills.kills = 1000
    dm.update(0)
    expect(dm.pendingMilestone).toBe('boss')
  })

  it('consumeMilestone returns the id once then null', () => {
    const kills = killPort(0)
    const dm = new DifficultyManager({ kills })
    kills.kills = 50
    dm.update(0)
    expect(dm.consumeMilestone()).toBe('miniBoss')
    expect(dm.consumeMilestone()).toBeNull()
    expect(dm.pendingMilestone).toBeNull()
  })

  it('patternId is spread for kills 0..499', () => {
    const kills = killPort(0)
    const dm = new DifficultyManager({ kills })
    for (const k of [0, 1, 49, 250, 499]) {
      kills.kills = k
      dm.update(0)
      expect(dm.patternId).toBe('spread')
      expect(patternIdAt(k, BALANCE.difficulty.bossAt, BALANCE.difficulty.patterns)).toBe(
        'spread',
      )
    }
  })

  it('patternId changes at 500 and again at 550 (patternStep 50)', () => {
    const patterns = BALANCE.difficulty.patterns
    const bossAt = BALANCE.difficulty.bossAt
    const kills = killPort(499)
    const dm = new DifficultyManager({ kills })
    dm.update(0)
    expect(dm.patternId).toBe('spread')

    kills.kills = 500
    dm.update(0)
    expect(dm.patternId).toBe(patternIdAt(500, bossAt, patterns))
    expect(dm.cycleIndex).toBe(1)

    kills.kills = 550
    dm.update(0)
    expect(dm.patternId).toBe(patternIdAt(550, bossAt, patterns))
    expect(dm.patternId).not.toBe(patternIdAt(500, bossAt, patterns))
    expect(dm.patternId).toBe('lane')
  })

  it('exposes no hpMul / damageMul field', () => {
    const dm = new DifficultyManager({ kills: killPort(0) })
    expect('hpMul' in dm).toBe(false)
    expect('damageMul' in dm).toBe(false)
    expect('enemyHpMul' in dm).toBe(false)
    expect('contactMul' in dm).toBe(false)
  })

  it('does not increment kills or spawn an enemy', () => {
    const kills = killPort(10)
    const dm = new DifficultyManager({ kills })
    dm.update(1)
    dm.consumeMilestone()
    dm.reset()
    expect(kills.kills).toBe(10)
    expect(dm).not.toHaveProperty('spawn')
  })

  it('snapshot() returns the same object reference', () => {
    const dm = new DifficultyManager({ kills: killPort(0) })
    const a = dm.snapshot()
    const b = dm.snapshot()
    expect(a).toBe(b)
  })

  it('reset() returns mul 1, base pattern, pending null', () => {
    const kills = killPort(0)
    const dm = new DifficultyManager({ kills })
    kills.kills = 550
    dm.update(0)
    expect(dm.pendingMilestone).not.toBeNull()
    expect(dm.spawnRateMul).toBeGreaterThan(1)

    kills.kills = 0
    dm.reset()
    expect(dm.spawnRateMul).toBe(1)
    expect(dm.patternId).toBe(BALANCE.difficulty.patterns[0] as PatternId)
    expect(dm.pendingMilestone).toBeNull()
  })

  it('update(dt) with a fixed kill count does not change mul (dt unused)', () => {
    const kills = killPort(100)
    const dm = new DifficultyManager({ kills })
    dm.update(0)
    const mul = dm.spawnRateMul
    dm.update(16)
    dm.update(1000)
    expect(dm.spawnRateMul).toBe(mul)
    expect(dm.spawnRateMul).toBe(1 + 100 * 0.002)
  })

  it('spawnRateMul is never below 1 for kills=0', () => {
    const dm = new DifficultyManager({ kills: killPort(0) })
    dm.update(0)
    expect(dm.spawnRateMul).toBeGreaterThanOrEqual(1)
    expect(spawnRateMulAt(0, 0.002)).toBe(1)
  })

  it('intensity escalates and patterns change past 500 (acceptance)', () => {
    const kills = killPort(0)
    const dm = new DifficultyManager({ kills })
    dm.update(0)
    const baseMul = dm.spawnRateMul
    const basePattern = dm.patternId

    kills.kills = 500
    dm.update(0)
    expect(dm.spawnRateMul).toBeGreaterThan(baseMul)
    expect(dm.cycleIndex).toBe(1)

    kills.kills = 550
    dm.update(0)
    expect(dm.patternId).not.toBe(basePattern)
    expect(dm.spawnRateMul).toBe(1 + 550 * 0.002)
  })
})
