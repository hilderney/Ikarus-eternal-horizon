import { describe, expect, it, vi } from 'vitest'
import { BALANCE } from '../core/balancer'
import { EnergyManager } from './energy-manager'
import energySource from './energy-manager.ts?raw'

function makeEnergy(overrides?: Partial<{ start: number; max: number; regenPerSec: number }>): EnergyManager {
  return new EnergyManager({
    config: {
      start: overrides?.start ?? BALANCE.gameplay.energy.start,
      max: overrides?.max ?? BALANCE.gameplay.energy.max,
      regenPerSec: overrides?.regenPerSec ?? BALANCE.gameplay.energy.regenPerSec,
    },
  })
}

describe('EnergyManager', () => {
  it('implements EnergyPort with canAfford and spend', () => {
    const energy = makeEnergy()
    expect(typeof energy.canAfford).toBe('function')
    expect(typeof energy.spend).toBe('function')
    energy.dispose()
  })

  it('starts at current = max = 100', () => {
    const energy = makeEnergy()
    expect(energy.current).toBe(100)
    expect(energy.max).toBe(100)
    energy.dispose()
  })

  it('exposes regenPerSec = 8', () => {
    const energy = makeEnergy()
    expect(energy.regenPerSec).toBe(8)
    energy.dispose()
  })

  it('canAfford returns true when current >= cost and false otherwise', () => {
    const energy = makeEnergy({ start: 1, max: 100 })
    expect(energy.canAfford(1)).toBe(true)
    expect(energy.canAfford(1.01)).toBe(false)
    energy.dispose()
  })

  it('spend subtracts cost and never goes below 0', () => {
    const energy = makeEnergy({ start: 1, max: 100 })
    energy.spend(0.25)
    expect(energy.current).toBe(0.75)
    energy.spend(10)
    expect(energy.current).toBe(0)
    energy.dispose()
  })

  it('update regenerates 8 per second clamped to max', () => {
    const energy = makeEnergy({ start: 90, max: 100, regenPerSec: 8 })
    energy.update(1)
    expect(energy.current).toBe(98)
    energy.update(1)
    expect(energy.current).toBe(100)
    energy.update(1)
    expect(energy.current).toBe(100)
    energy.dispose()
  })

  it('canAfford(0.25) is false when current is 0', () => {
    const energy = makeEnergy({ start: 0, max: 100 })
    expect(energy.canAfford(0.25)).toBe(false)
    energy.dispose()
  })

  it('canAfford(0) is true even at current 0', () => {
    const energy = makeEnergy({ start: 0, max: 100 })
    expect(energy.canAfford(0)).toBe(true)
    energy.dispose()
  })

  it('update/spend allocate no objects', () => {
    const energy = makeEnergy()
    energy.spend(1)
    energy.update(0.016)
    const setSpy = vi.spyOn(globalThis, 'Set')
    energy.spend(1)
    energy.update(0.016)
    expect(setSpy).not.toHaveBeenCalled()
    setSpy.mockRestore()
    energy.dispose()
  })

  it('module does not import three', () => {
    expect(energySource).not.toMatch(/\bfrom ['"]three['"]/)
    expect(energySource).not.toMatch(/\bimport\s+['"]three['"]/)
  })

  it('spend and regen write through the bound C01 energy pool', () => {
    const pool = { current: 50, max: 100 }
    const energy = new EnergyManager({
      config: BALANCE.gameplay.energy,
      pool,
    })
    energy.spend(10)
    expect(pool.current).toBe(40)
    expect(energy.current).toBe(40)
    energy.update(BALANCE.ship.cooldowns.recoveringMs / 1000)
    expect(pool.current).toBe(40)
    energy.update(1)
    expect(pool.current).toBe(48)
    energy.dispose()
  })

  it('spend starts recoveringMs delay before regen', () => {
    const delay = BALANCE.ship.cooldowns.recoveringMs
    const energy = makeEnergy({ start: 50, max: 100, regenPerSec: 8 })
    energy.spend(10)
    energy.update((delay - 1) / 1000)
    expect(energy.current).toBe(40)
    energy.update(0.002)
    expect(energy.current).toBeCloseTo(40 + 8 * 0.001, 5)
    energy.dispose()
  })

  it('update skips regen when canRegen is false', () => {
    const gated = new EnergyManager({
      config: { start: 50, max: 100, regenPerSec: 8 },
      canRegen: () => false,
    })
    gated.update(1)
    expect(gated.current).toBe(50)
    gated.dispose()
  })

  it('regenBonus from the collector adds to regenPerSec', () => {
    const energy = new EnergyManager({
      config: { start: 50, max: 100, regenPerSec: 8 },
      regenDelayMs: 0,
      regenBonus: () => 2,
    })
    energy.update(1)
    expect(energy.current).toBe(60)
    energy.dispose()
  })
})
