import { describe, expect, it } from 'vitest'
import { BALANCE } from '../../core/balancer'
import { emptyModuleMods, moduleModsFor } from './ship-modules'
import type { ShipLoadout } from './ship'

function loadout(overrides: Partial<ShipLoadout> = {}): ShipLoadout {
  return {
    equippedWeapon: null,
    weapons: [],
    equippedBomb: null,
    bombs: [],
    equippedWings: 'standard',
    wings: ['standard'],
    equippedShield: null,
    shields: [],
    equippedArmor: 'standard',
    armors: ['standard'],
    equippedEnergyCollector: null,
    energyCollectors: [],
    equippedEnergyConverter: null,
    energyConverters: [],
    weaponLevel: 1,
    bombLevel: 1,
    ...overrides,
  }
}

describe('moduleModsFor', () => {
  it('standard body and wings add nothing', () => {
    expect(moduleModsFor(loadout())).toEqual(emptyModuleMods())
  })

  it('sums wing and shield deflection', () => {
    const mods = moduleModsFor(
      loadout({
        equippedWings: 'agility',
        equippedShield: 'heavy',
      }),
    )
    expect(mods.agility).toBe(BALANCE.ship.modules.wings.agility.agility)
    expect(mods.deflection).toBe(
      BALANCE.ship.modules.wings.agility.deflection + BALANCE.ship.modules.shield.heavy.deflection,
    )
    expect(mods.shield).toBe(BALANCE.ship.modules.shield.heavy.shield)
  })
})
