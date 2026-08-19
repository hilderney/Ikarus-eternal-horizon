import { describe, expect, it } from 'vitest'
import { copyWeaponConfig, WEAPONS } from './catalog'
import { applyLaserLevel, LASER_LEVELS } from './laser-levels'

const ENERGY = [1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2, 2.1, 2.2] as const
const VOLLEY = [
  [1, 0],
  [2, 0],
  [3, 0],
  [4, 0],
  [3, 1],
  [4, 1],
  [3, 2],
  [4, 2],
  [3, 3],
  [4, 3],
  [3, 4],
  [4, 4],
] as const

describe('LASER_LEVELS', () => {
  it('has 12 rows, levels 1..12', () => {
    expect(LASER_LEVELS).toHaveLength(12)
    expect(LASER_LEVELS.map((row) => row.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })

  it('every row satisfies forward + 2*diagPerSide === level', () => {
    for (const row of LASER_LEVELS) {
      expect(row.forwardShots + 2 * row.diagonalShotsPerSide).toBe(row.level)
    }
  })

  it('every row has speed 30 and lifetime 1', () => {
    for (const row of LASER_LEVELS) {
      expect(row.speed).toBe(30)
      expect(row.lifetime).toBe(1)
    }
  })

  it('volley is front + equal diagonals per the L1–L12 table', () => {
    expect(LASER_LEVELS.map((row) => [row.forwardShots, row.diagonalShotsPerSide, row.energyPerShot])).toEqual(
      VOLLEY.map((shape, i) => [shape[0], shape[1], ENERGY[i]]),
    )
  })

  it('applyLaserLevel(cfg, 5) writes damage 1.8, rate 10, energy 1.5, radius 0.14', () => {
    const cfg = copyWeaponConfig(WEAPONS.laser)
    applyLaserLevel(cfg, 5)
    expect(cfg.damage).toBe(1.8)
    expect(cfg.rate).toBe(10)
    expect(cfg.energyPerShot).toBe(1.5)
    expect(cfg.projectile?.radius).toBe(0.14)
    expect(cfg.laser?.forwardShots).toBe(3)
    expect(cfg.laser?.diagonalShotsPerSide).toBe(1)
    expect(cfg.laser?.totalShots).toBe(5)
  })

  it('applyLaserLevel(cfg, 12) writes 4 forward + 4 per side and energy 2.2', () => {
    const cfg = copyWeaponConfig(WEAPONS.laser)
    applyLaserLevel(cfg, 12)
    expect(cfg.energyPerShot).toBe(2.2)
    expect(cfg.laser?.forwardShots).toBe(4)
    expect(cfg.laser?.diagonalShotsPerSide).toBe(4)
    expect(cfg.laser?.totalShots).toBe(12)
  })

  it('applyLaserLevel(cfg, 99) is a no-op', () => {
    const cfg = copyWeaponConfig(WEAPONS.laser)
    applyLaserLevel(cfg, 99)
    expect(cfg.damage).toBe(1)
    expect(cfg.rate).toBe(8)
  })
})
