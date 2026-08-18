import { describe, expect, it } from 'vitest'
import { copyWeaponConfig, WEAPONS } from './catalog'
import { applyLaserLevel, LASER_LEVELS } from './laser-levels'

describe('LASER_LEVELS', () => {
  it('has 10 rows, levels 1..10', () => {
    expect(LASER_LEVELS).toHaveLength(10)
    expect(LASER_LEVELS.map((row) => row.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
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

  it('L1 / L4 / L5 / L10 match the forward/side counts 1 / 4 / 3+1 / 4+3', () => {
    expect(LASER_LEVELS[0]).toMatchObject({ forwardShots: 1, diagonalShotsPerSide: 0 })
    expect(LASER_LEVELS[3]).toMatchObject({ forwardShots: 4, diagonalShotsPerSide: 0 })
    expect(LASER_LEVELS[4]).toMatchObject({ forwardShots: 3, diagonalShotsPerSide: 1 })
    expect(LASER_LEVELS[9]).toMatchObject({ forwardShots: 4, diagonalShotsPerSide: 3 })
  })

  it('applyLaserLevel(cfg, 5) writes damage 1.8, rate 10, energy 0.36, radius 0.14', () => {
    const cfg = copyWeaponConfig(WEAPONS.laser)
    applyLaserLevel(cfg, 5)
    expect(cfg.damage).toBe(1.8)
    expect(cfg.rate).toBe(10)
    expect(cfg.energyPerShot).toBe(0.36)
    expect(cfg.projectile?.radius).toBe(0.14)
    expect(cfg.laser?.forwardShots).toBe(3)
    expect(cfg.laser?.diagonalShotsPerSide).toBe(1)
    expect(cfg.laser?.totalShots).toBe(5)
  })

  it('applyLaserLevel(cfg, 99) is a no-op', () => {
    const cfg = copyWeaponConfig(WEAPONS.laser)
    applyLaserLevel(cfg, 99)
    expect(cfg.damage).toBe(1)
    expect(cfg.rate).toBe(8)
  })
})
