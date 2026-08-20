import { describe, expect, it, vi } from 'vitest'
import type { Scene } from 'three'
import { copyWeaponConfig, WEAPONS } from '../catalog'
import { applyWeaponLevel } from '../weapon-levels'
import { defaultModifiers, type EnergyPort, type HitTarget } from '../registry'
import { MjolnirBehaviour } from './mjolnir'

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

describe('MjolnirBehaviour', () => {
  it('spends energyPerSec * dt while holding fire', () => {
    const cfg = copyWeaponConfig(WEAPONS.mjolnir)
    applyWeaponLevel(cfg, 1)
    const energy = energyStub(true)
    const mjolnir = new MjolnirBehaviour(cfg, { acquire: () => null }, mockScene())
    mjolnir.update({
      dt: 0.1,
      holding: true,
      muzzle: { x: 0, y: 0, z: 0 },
      services: { energy },
      mods: defaultModifiers(),
    })
    expect(energy.spent[0]).toBeCloseTo(0.22, 5)
    mjolnir.dispose()
  })

  it('pierces all targets inside the cone wedge', () => {
    const cfg = copyWeaponConfig(WEAPONS.mjolnir)
    applyWeaponLevel(cfg, 1)
    const energy = energyStub(true)
    const hits: number[] = []
    const targets: HitTarget[] = [
      {
        x: 0,
        z: -5,
        radius: 0.5,
        team: 'enemy',
        active: true,
        takeDamage(amount: number) {
          hits.push(amount)
        },
      },
      {
        x: 1,
        z: -8,
        radius: 0.5,
        team: 'enemy',
        active: true,
        takeDamage(amount: number) {
          hits.push(amount)
        },
      },
    ]
    const mjolnir = new MjolnirBehaviour(cfg, { acquire: () => null }, mockScene())
    mjolnir.update({
      dt: 1,
      holding: true,
      muzzle: { x: 0, y: 0, z: 0 },
      services: { energy, targets },
      mods: defaultModifiers(),
    })
    expect(hits).toHaveLength(2)
    mjolnir.dispose()
  })

  it('applyLevel 12 widens angleDeg on config used by behaviour', () => {
    const cfg = copyWeaponConfig(WEAPONS.mjolnir)
    applyWeaponLevel(cfg, 12)
    expect(cfg.cone?.angleDeg).toBe(75)
  })
})
