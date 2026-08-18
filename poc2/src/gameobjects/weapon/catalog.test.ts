import { describe, expect, it } from 'vitest'
import { BALANCE } from '../../core/balancer'
import { WEAPONS } from './catalog'
import catalogSource from './catalog.ts?raw'

describe('WEAPONS catalog', () => {
  it('has laser projectile 30/1/0.12 and plasma orb 14/2.4/0.22/2.2', () => {
    expect(WEAPONS.laser.projectile).toEqual({
      speed: 30,
      radius: 0.12,
      lifetime: 1,
      damageDecayPerUnit: 0,
    })
    expect(WEAPONS.plasma.orb).toEqual({
      speed: 14,
      radius: 0.22,
      lifetime: 2.4,
      aoeRadius: 2.2,
      damageDecayPerUnit: 0.01,
    })
  })

  it('is the same object as BALANCE.weapons.catalog', () => {
    expect(BALANCE.weapons.catalog).toBe(WEAPONS)
  })

  it('does not import balancer (source-text)', () => {
    expect(catalogSource).not.toMatch(/\bfrom ['"].*balancer['"]/)
  })
})
