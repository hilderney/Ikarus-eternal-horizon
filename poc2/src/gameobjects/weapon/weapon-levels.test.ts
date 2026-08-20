import { describe, expect, it } from 'vitest'
import { copyWeaponConfig, WEAPONS } from './catalog'
import {
  applyWeaponLevel,
  BEAM_LEVELS,
  LASER_LEVELS,
  levelsFor,
  MJOLNIR_LEVELS,
  PLASMA_LEVELS,
  statFieldsForWeapon,
  weaponLevelSnapshot,
  WEAPON_LEVEL_COUNT,
} from './weapon-levels'

describe('weapon level tables', () => {
  it('each weapon has 12 rows levels 1..12', () => {
    for (const id of ['laser', 'plasma', 'beam', 'mjolnir'] as const) {
      const rows = levelsFor(id)
      expect(rows).toHaveLength(WEAPON_LEVEL_COUNT)
      expect(rows.map((row) => row.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    }
  })

  it('laser rows satisfy forward + 2*diagPerSide === level', () => {
    for (const row of LASER_LEVELS) {
      expect(row.forwardShots + 2 * row.diagonalShotsPerSide).toBe(row.level)
    }
  })

  it('plasma L12 scales damage and aoe above L1', () => {
    expect(PLASMA_LEVELS[11]?.damage).toBeGreaterThan(PLASMA_LEVELS[0]?.damage ?? 0)
    expect(PLASMA_LEVELS[11]?.aoeRadius).toBeGreaterThan(PLASMA_LEVELS[0]?.aoeRadius ?? 0)
  })

  it('beam L12 scales width and dps above L1', () => {
    expect(BEAM_LEVELS[11]?.width).toBeGreaterThan(BEAM_LEVELS[0]?.width ?? 0)
    expect(BEAM_LEVELS[11]?.dps).toBeGreaterThan(BEAM_LEVELS[0]?.dps ?? 0)
  })

  it('mjolnir L12 widens angleDeg above L1', () => {
    expect(MJOLNIR_LEVELS[11]?.angleDeg).toBeGreaterThan(MJOLNIR_LEVELS[0]?.angleDeg ?? 0)
  })
})

describe('applyWeaponLevel', () => {
  it('applyWeaponLevel laser cfg 5 writes volley and energy', () => {
    const cfg = copyWeaponConfig(WEAPONS.laser)
    applyWeaponLevel(cfg, 5)
    expect(cfg.damage).toBe(1.8)
    expect(cfg.energyPerShot).toBe(0.5)
    expect(cfg.laser?.totalShots).toBe(5)
  })

  it('applyWeaponLevel plasma cfg 12 writes scaled orb stats', () => {
    const cfg = copyWeaponConfig(WEAPONS.plasma)
    applyWeaponLevel(cfg, 12)
    expect(cfg.damage).toBe(5)
    expect(cfg.orb?.aoeRadius).toBe(3.3)
  })

  it('applyWeaponLevel beam cfg 1 writes beam spec', () => {
    const cfg = copyWeaponConfig(WEAPONS.beam)
    applyWeaponLevel(cfg, 1)
    expect(cfg.beam?.width).toBe(0.35)
    expect(cfg.beam?.dps).toBe(6)
  })

  it('applyWeaponLevel mjolnir cfg 12 writes cone spec', () => {
    const cfg = copyWeaponConfig(WEAPONS.mjolnir)
    applyWeaponLevel(cfg, 12)
    expect(cfg.cone?.angleDeg).toBe(75)
    expect(cfg.cone?.dps).toBe(10)
  })

  it('applyWeaponLevel(cfg, 99) is a no-op', () => {
    const cfg = copyWeaponConfig(WEAPONS.laser)
    applyWeaponLevel(cfg, 99)
    expect(cfg.damage).toBe(1)
  })
})

describe('weaponLevelSnapshot', () => {
  it('statFieldsForWeapon returns profile-specific keys', () => {
    expect(statFieldsForWeapon('laser')).toContain('forwardShots')
    expect(statFieldsForWeapon('plasma')).toContain('aoeRadius')
    expect(statFieldsForWeapon('beam')).toContain('width')
    expect(statFieldsForWeapon('mjolnir')).toContain('angleDeg')
  })

  it('weaponLevelSnapshot reads resolved config', () => {
    const cfg = copyWeaponConfig(WEAPONS.plasma)
    applyWeaponLevel(cfg, 6)
    const snap = weaponLevelSnapshot(cfg)
    expect(snap.damage).toBe(cfg.damage)
    expect(snap.aoeRadius).toBe(cfg.orb?.aoeRadius)
  })
})
