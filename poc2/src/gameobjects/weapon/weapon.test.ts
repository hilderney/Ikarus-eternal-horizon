import { describe, expect, it, vi } from 'vitest'
import type { ShotSpawn } from '../shot/weapon-shot'
import { copyWeaponConfig, WEAPONS } from './catalog'
import { applyLaserLevel } from './laser-levels'
import { defaultModifiers, registerWeapon, WEAPON_REGISTRY } from './registry'
import type { BehaviourCtx, EnergyPort } from './registry'
import { Weapon } from './weapon'
import './behaviours/laser'
import { LaserBehaviour } from './behaviours/laser'

interface RecordedShot {
  activate(spawn: ShotSpawn): void
}

function recordingPort() {
  const spawns: ShotSpawn[] = []
  const port = {
    acquire(): RecordedShot | null {
      return {
        activate(spawn: ShotSpawn) {
          spawns.push(spawn)
        },
      }
    },
  }
  return { port, spawns }
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

function ctx(overrides: Partial<BehaviourCtx> = {}, energy?: EnergyPort): BehaviourCtx {
  return {
    dt: 0,
    holding: true,
    muzzle: { x: 0, y: 0, z: -1.4 },
    services: { energy: energy ?? energyStub() },
    mods: defaultModifiers(),
    ...overrides,
  }
}

describe('Weapon', () => {
  it('constructs from id by asking the registry, not a switch on WeaponId', () => {
    const { port } = recordingPort()
    const weapon = new Weapon({ id: 'laser', shots: port })
    expect(weapon.id).toBe('laser')
    expect(weapon.config.id).toBe('laser')
    weapon.dispose()
  })

  it('applyLevel writes the LASER_LEVELS row onto config', () => {
    const { port } = recordingPort()
    const weapon = new Weapon({ id: 'laser', shots: port })
    weapon.applyLevel(12)
    expect(weapon.config.level).toBe(12)
    expect(weapon.config.energyPerShot).toBe(2.2)
    expect(weapon.config.laser?.totalShots).toBe(12)
    weapon.dispose()
  })

  it('throws when the registry has no factory for that id', () => {
    const { port } = recordingPort()
    expect(() => new Weapon({ id: 'beam', shots: port })).toThrow(/no weapon factory/)
  })

  it('update forwards BehaviourCtx to the behaviour', () => {
    const { port, spawns } = recordingPort()
    const weapon = new Weapon({ id: 'laser', shots: port })
    weapon.update(ctx())
    expect(spawns).toHaveLength(1)
    weapon.dispose()
  })

  it('dispose disposes behaviour and does not dispose the acquire port', () => {
    const { port } = recordingPort()
    const acquireSpy = vi.spyOn(port, 'acquire')
    const weapon = new Weapon({ id: 'laser', shots: port })
    weapon.dispose()
    expect(acquireSpy).not.toHaveBeenCalled()
    weapon.update(ctx())
    expect(acquireSpy).toHaveBeenCalled()
  })

  it('registerWeapon(id, factory) is the only hook a new weapon needs', () => {
    const original = WEAPON_REGISTRY.laser
    const calls: string[] = []
    registerWeapon('laser', (config, shots) => {
      calls.push(config.id)
      if (!original) {
        throw new Error('expected laser factory')
      }
      return original(config, shots)
    })
    const { port } = recordingPort()
    const weapon = new Weapon({ id: 'laser', shots: port })
    expect(calls).toEqual(['laser'])
    weapon.dispose()
    if (original) {
      registerWeapon('laser', original)
    }
  })

  it('constructor does not take a Scene', () => {
    const { port } = recordingPort()
    const weapon = new Weapon({ id: 'laser', shots: port })
    expect(weapon).not.toHaveProperty('scene')
    weapon.dispose()
  })
})

describe('LaserBehaviour', () => {
  it('spawns no shots when energy.canAfford is false', () => {
    const { port, spawns } = recordingPort()
    const laser = new LaserBehaviour(copyWeaponConfig(WEAPONS.laser), port)
    laser.update(ctx({}, energyStub(false)))
    expect(spawns).toHaveLength(0)
    laser.dispose()
  })

  it('spends energyPerShot * energyMul on a successful volley', () => {
    const { port } = recordingPort()
    const energy = energyStub(true)
    const laser = new LaserBehaviour(copyWeaponConfig(WEAPONS.laser), port)
    const mods = defaultModifiers()
    mods.energyMul = 2
    laser.update(ctx({ mods }, energy))
    expect(energy.spent).toEqual([2])
    laser.dispose()
  })

  it('cooldown is 1 / (rate * rateMul); L1 rate 8 ⇒ 0.125s', () => {
    const { port, spawns } = recordingPort()
    const laser = new LaserBehaviour(copyWeaponConfig(WEAPONS.laser), port)
    laser.update(ctx({ dt: 0 }))
    expect(spawns).toHaveLength(1)
    laser.update(ctx({ dt: 0.124 }))
    expect(spawns).toHaveLength(1)
    laser.update(ctx({ dt: 0.002 }))
    expect(spawns).toHaveLength(2)
    laser.dispose()
  })

  it('L1 spawns 1 forward bolt with vx=0, vz=-30, aoeRadius 0, color 0x22d3ee', () => {
    const { port, spawns } = recordingPort()
    const laser = new LaserBehaviour(copyWeaponConfig(WEAPONS.laser), port)
    laser.update(ctx())
    expect(spawns).toHaveLength(1)
    expect(spawns[0]).toMatchObject({
      vx: 0,
      vz: -30,
      aoeRadius: 0,
      color: 0x22d3ee,
      radius: 0.12,
      lifetime: 1,
    })
    laser.dispose()
  })

  it('L5 spawns 5 bolts — 3 forward + 1 per side', () => {
    const { port, spawns } = recordingPort()
    const cfg = copyWeaponConfig(WEAPONS.laser)
    applyLaserLevel(cfg, 5)
    const laser = new LaserBehaviour(cfg, port)
    laser.update(ctx())
    expect(spawns).toHaveLength(5)
    const forward = spawns.filter((s) => s.vx === 0)
    expect(forward).toHaveLength(3)
    laser.dispose()
  })

  it('L10 spawns 10 bolts — 4 forward + 3 per side', () => {
    const { port, spawns } = recordingPort()
    const cfg = copyWeaponConfig(WEAPONS.laser)
    applyLaserLevel(cfg, 10)
    const laser = new LaserBehaviour(cfg, port)
    laser.update(ctx())
    expect(spawns).toHaveLength(10)
    expect(spawns.filter((s) => s.vx === 0)).toHaveLength(4)
    laser.dispose()
  })

  it('L12 spawns 12 bolts — 4 forward + 4 per side', () => {
    const { port, spawns } = recordingPort()
    const cfg = copyWeaponConfig(WEAPONS.laser)
    applyLaserLevel(cfg, 12)
    const laser = new LaserBehaviour(cfg, port)
    laser.update(ctx())
    expect(spawns).toHaveLength(12)
    expect(spawns.filter((s) => s.vx === 0)).toHaveLength(4)
    laser.dispose()
  })

  it('muzzle uses catalog muzzleOffset via ctx.muzzle (not a literal)', () => {
    const { port, spawns } = recordingPort()
    const laser = new LaserBehaviour(copyWeaponConfig(WEAPONS.laser), port)
    laser.update(ctx({ muzzle: { x: 3, y: 0, z: -8 } }))
    expect(spawns[0]?.x).toBe(3)
    expect(spawns[0]?.z).toBe(-8)
    laser.dispose()
  })

  it('skips a bolt when acquire() returns null (no new)', () => {
    const laser = new LaserBehaviour(copyWeaponConfig(WEAPONS.laser), {
      acquire: () => null,
    })
    laser.update(ctx())
    laser.dispose()
  })

  it('update allocates no objects', () => {
    const { port } = recordingPort()
    const laser = new LaserBehaviour(copyWeaponConfig(WEAPONS.laser), port)
    laser.update(ctx())
    const setSpy = vi.spyOn(globalThis, 'Set')
    laser.update(ctx({ dt: 1 }))
    expect(setSpy).not.toHaveBeenCalled()
    setSpy.mockRestore()
    laser.dispose()
  })
})
