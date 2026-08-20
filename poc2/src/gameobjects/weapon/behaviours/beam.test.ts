import { describe, expect, it, vi } from 'vitest'
import type { Scene } from 'three'
import { copyWeaponConfig, WEAPONS } from '../catalog'
import { applyWeaponLevel } from '../weapon-levels'
import { defaultModifiers, type EnergyPort, type HitTarget } from '../registry'
import { BeamBehaviour } from './beam'

function mockScene(): Scene {
  return { add: vi.fn(), remove: vi.fn() } as unknown as Scene
}

function energyStub(afford = true): EnergyPort & { spent: number[] } {
  const spent: number[] = []
  return {
    spent,
    canAfford() {
      return afford
    },
    spend(cost: number) {
      spent.push(cost)
    },
  }
}

describe('BeamBehaviour', () => {
  it('spends energyPerSec * dt while holding fire', () => {
    const cfg = copyWeaponConfig(WEAPONS.beam)
    applyWeaponLevel(cfg, 1)
    const energy = energyStub(true)
    const beam = new BeamBehaviour(cfg, { acquire: () => null }, mockScene())
    beam.update({
      dt: 0.1,
      holding: true,
      muzzle: { x: 0, y: 0, z: 0 },
      services: { energy },
      mods: defaultModifiers(),
    })
    expect(energy.spent[0]).toBeCloseTo(0.3, 5)
    beam.dispose()
  })

  it('does not spend when energy.canAfford is false', () => {
    const cfg = copyWeaponConfig(WEAPONS.beam)
    applyWeaponLevel(cfg, 1)
    const energy = energyStub(false)
    const beam = new BeamBehaviour(cfg, { acquire: () => null }, mockScene())
    beam.update({
      dt: 0.1,
      holding: true,
      muzzle: { x: 0, y: 0, z: 0 },
      services: { energy },
      mods: defaultModifiers(),
    })
    expect(energy.spent).toHaveLength(0)
    beam.dispose()
  })

  it('damages targets inside the beam segment', () => {
    const cfg = copyWeaponConfig(WEAPONS.beam)
    applyWeaponLevel(cfg, 1)
    const energy = energyStub(true)
    const damaged: number[] = []
    const targets: HitTarget[] = [
      {
        x: 0,
        z: -10,
        radius: 0.5,
        team: 'enemy',
        active: true,
        takeDamage(amount: number) {
          damaged.push(amount)
        },
      },
    ]
    const beam = new BeamBehaviour(cfg, { acquire: () => null }, mockScene())
    beam.update({
      dt: 1,
      holding: true,
      muzzle: { x: 0, y: 0, z: 0 },
      services: { energy, targets },
      mods: defaultModifiers(),
    })
    expect(damaged[0]).toBeCloseTo(6, 5)
    beam.dispose()
  })
})
