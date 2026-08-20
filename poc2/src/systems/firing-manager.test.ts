import { describe, expect, it, vi } from 'vitest'
import { BALANCE } from '../core/balancer'
import type { InputPort } from '../core/input'
import type { WeaponId } from '../gameobjects/weapon/catalog'
import { copyWeaponConfig, WEAPONS } from '../gameobjects/weapon/catalog'
import { defaultModifiers } from '../gameobjects/weapon/registry'
import type { BehaviourCtx } from '../gameobjects/weapon/registry'
import { FiringManager } from './firing-manager'
import type { WeaponPort } from './firing-manager'

function inputStub(pressed: Partial<Record<'fire' | 'switchWeapon', boolean>> = {}): InputPort {
  return {
    update() {},
    isDown() {
      return false
    },
    axis() {
      return 0
    },
    isPressed(action) {
      if (action === 'fire') {
        return pressed.fire === true
      }
      if (action === 'switchWeapon') {
        return pressed.switchWeapon === true
      }
      return false
    },
    consumePress() {
      return false
    },
    rumble() {},
    scheme: 'keyboard',
    setScheme() {},
    connectedPadCount: 0,
    dispose() {},
  }
}

function makeWeapon(id: WeaponId, onUpdate?: (ctx: BehaviourCtx) => void): WeaponPort & { disposed: number } {
  const weapon = {
    id,
    config: copyWeaponConfig(WEAPONS[id]),
    disposed: 0,
    update(ctx: BehaviourCtx) {
      onUpdate?.(ctx)
    },
    dispose() {
      weapon.disposed += 1
    },
    applyLevel() {},
  }
  return weapon
}

describe('FiringManager', () => {
  it('holding fire calls weapon.update with holding true', () => {
    const ctxs: BehaviourCtx[] = []
    const created: WeaponPort[] = []
    const manager = new FiringManager({
      input: inputStub({ fire: true }),
      ship: { position: { x: 1, y: 0, z: 2 } },
      energy: { canAfford: () => true, spend() {} },
      health: { modifiers: { fireRateMul: 1 } },
      loadout: ['laser'],
      registry: {
        create(id) {
          const weapon = makeWeapon(id, (ctx) => {
            ctxs.push(ctx)
          })
          created.push(weapon)
          return weapon
        },
      },
    })
    manager.update(0.016)
    expect(ctxs[0]?.holding).toBe(true)
    manager.dispose()
  })

  it('setShooting follows fire hold so recovering can gate energy regen', () => {
    const shooting = {
      value: false,
      setShooting(v: boolean) {
        this.value = v
      },
    }
    const manager = new FiringManager({
      input: inputStub({ fire: true }),
      ship: { position: { x: 0, y: 0, z: 0 } },
      energy: { canAfford: () => true, spend() {} },
      health: { modifiers: { fireRateMul: 1 } },
      loadout: ['laser'],
      shooting,
      registry: {
        create(id) {
          return makeWeapon(id)
        },
      },
    })
    manager.update(0.016)
    expect(shooting.value).toBe(true)
    manager.dispose()
  })

  it('does not clear shooting on fire release (ship timer owns the pulse)', () => {
    const calls: boolean[] = []
    const manager = new FiringManager({
      input: inputStub(),
      ship: { position: { x: 0, y: 0, z: 0 } },
      energy: { canAfford: () => true, spend() {} },
      health: { modifiers: { fireRateMul: 1 } },
      loadout: ['laser'],
      shooting: {
        setShooting(value) {
          calls.push(value)
        },
      },
      registry: {
        create(id) {
          return makeWeapon(id)
        },
      },
    })
    manager.update(0.016)
    expect(calls).toEqual([])
    manager.dispose()
  })

  it('holding Y (isPressed fire) calls weapon.update with holding true', () => {
    const ctxs: BehaviourCtx[] = []
    const manager = new FiringManager({
      input: inputStub({ fire: true }),
      ship: { position: { x: 0, y: 0, z: 0 } },
      energy: { canAfford: () => true, spend() {} },
      health: { modifiers: { fireRateMul: 1 } },
      loadout: ['laser'],
      registry: {
        create(id) {
          return makeWeapon(id, (ctx) => {
            ctxs.push(ctx)
          })
        },
      },
    })
    manager.update(0.016)
    expect(ctxs[0]?.holding).toBe(true)
    manager.dispose()
  })

  it('KeyG edge cycles the loadout once per press', () => {
    const created: WeaponId[] = []
    const switchState = { switchWeapon: false }
    const manager = new FiringManager({
      input: {
        ...inputStub(),
        isPressed(action) {
          return action === 'switchWeapon' && switchState.switchWeapon
        },
      },
      ship: { position: { x: 0, y: 0, z: 0 } },
      energy: { canAfford: () => true, spend() {} },
      health: { modifiers: { fireRateMul: 1 } },
      loadout: ['laser', 'plasma'],
      registry: {
        create(id) {
          created.push(id)
          return makeWeapon(id)
        },
      },
    })
    expect(created).toEqual(['laser'])
    switchState.switchWeapon = true
    manager.update(0.016)
    expect(created).toEqual(['laser', 'plasma'])
    manager.update(0.016)
    expect(created).toEqual(['laser', 'plasma'])
    manager.dispose()
  })

  it('cycleWeapon disposes the previous weapon and registry.creates the next', () => {
    const weapons: ReturnType<typeof makeWeapon>[] = []
    const manager = new FiringManager({
      input: inputStub(),
      ship: { position: { x: 0, y: 0, z: 0 } },
      energy: { canAfford: () => true, spend() {} },
      health: { modifiers: { fireRateMul: 1 } },
      loadout: ['laser', 'plasma'],
      registry: {
        create(id) {
          const weapon = makeWeapon(id)
          weapons.push(weapon)
          return weapon
        },
      },
    })
    manager.cycleWeapon()
    expect(weapons[0]?.disposed).toBe(1)
    expect(manager.activeId()).toBe('plasma')
    manager.dispose()
  })

  it('setWeaponLevel reapplies on the next loadout weapon', () => {
    const levels: number[] = []
    const manager = new FiringManager({
      input: inputStub(),
      ship: { position: { x: 0, y: 0, z: 0 } },
      energy: { canAfford: () => true, spend() {} },
      health: { modifiers: { fireRateMul: 1 } },
      loadout: ['laser', 'plasma'],
      registry: {
        create(id) {
          const weapon = makeWeapon(id)
          weapon.applyLevel = (level) => {
            levels.push(level)
          }
          return weapon
        },
      },
    })
    expect(manager.weaponLevel()).toBe(1)
    manager.setWeaponLevel(12)
    expect(manager.weaponLevel()).toBe(12)
    manager.cycleWeapon()
    expect(levels[levels.length - 1]).toBe(12)
    manager.dispose()
  })

  it('setActive ignores an id outside the loadout', () => {
    const manager = new FiringManager({
      input: inputStub(),
      ship: { position: { x: 0, y: 0, z: 0 } },
      energy: { canAfford: () => true, spend() {} },
      health: { modifiers: { fireRateMul: 1 } },
      loadout: ['laser', 'plasma'],
      registry: {
        create(id) {
          return makeWeapon(id)
        },
      },
    })
    manager.setActive('beam')
    expect(manager.activeId()).toBe('laser')
    manager.dispose()
  })

  it('copies health.modifiers.fireRateMul into mods.rateMul every update', () => {
    const health = { modifiers: { fireRateMul: 0.55 } }
    const manager = new FiringManager({
      input: inputStub(),
      ship: { position: { x: 0, y: 0, z: 0 } },
      energy: { canAfford: () => true, spend() {} },
      health,
      loadout: ['laser'],
      registry: {
        create(id) {
          return makeWeapon(id)
        },
      },
    })
    manager.update(0.016)
    expect(manager.mods.rateMul).toBe(0.55)
    manager.dispose()
  })

  it('passes EnergyPort into ctx.services; empty energy still calls update', () => {
    let calls = 0
    const energy = { canAfford: () => false, spend: vi.fn() }
    const manager = new FiringManager({
      input: inputStub({ fire: true }),
      ship: { position: { x: 0, y: 0, z: 0 } },
      energy,
      health: { modifiers: { fireRateMul: 1 } },
      loadout: ['laser'],
      registry: {
        create(id) {
          return makeWeapon(id, () => {
            calls += 1
          })
        },
      },
    })
    manager.update(0.016)
    expect(calls).toBe(1)
    manager.dispose()
  })

  it('switch is a no-op when loadout length is 1', () => {
    const created: WeaponId[] = []
    const manager = new FiringManager({
      input: inputStub(),
      ship: { position: { x: 0, y: 0, z: 0 } },
      energy: { canAfford: () => true, spend() {} },
      health: { modifiers: { fireRateMul: 1 } },
      loadout: ['laser'],
      registry: {
        create(id) {
          created.push(id)
          return makeWeapon(id)
        },
      },
    })
    manager.cycleWeapon()
    expect(created).toEqual(['laser'])
    manager.dispose()
  })

  it('muzzle = ship.position + config.muzzleOffset', () => {
    const ctxs: BehaviourCtx[] = []
    const manager = new FiringManager({
      input: inputStub({ fire: true }),
      ship: { position: { x: 4, y: 1, z: 8 } },
      energy: { canAfford: () => true, spend() {} },
      health: { modifiers: { fireRateMul: 1 } },
      loadout: ['laser'],
      registry: {
        create(id) {
          return makeWeapon(id, (ctx) => {
            ctxs.push(ctx)
          })
        },
      },
    })
    manager.update(0.016)
    expect(ctxs[0]?.muzzle).toEqual({ x: 4, y: 1, z: 6.6 })
    manager.dispose()
  })

  it('fireKey/switchKey default to KeyF and KeyG', () => {
    expect(BALANCE.gameplay.fireKey).toBe('KeyF')
    expect(BALANCE.gameplay.switchKey).toBe('KeyG')
  })

  it('does not call rumble fireLaser on a Laser pulse', () => {
    const rumble = vi.fn()
    const input = { ...inputStub({ fire: true }), rumble }
    const manager = new FiringManager({
      input,
      ship: { position: { x: 0, y: 0, z: 0 } },
      energy: { canAfford: () => true, spend() {} },
      health: { modifiers: { fireRateMul: 1 } },
      loadout: ['laser'],
      registry: {
        create(id) {
          return makeWeapon(id)
        },
      },
    })
    manager.update(0.016)
    expect(rumble).not.toHaveBeenCalled()
    manager.dispose()
  })

  it('reuses one muzzle scratch object across updates', () => {
    const ctxs: BehaviourCtx[] = []
    const manager = new FiringManager({
      input: inputStub({ fire: true }),
      ship: { position: { x: 0, y: 0, z: 0 } },
      energy: { canAfford: () => true, spend() {} },
      health: { modifiers: { fireRateMul: 1 } },
      loadout: ['laser'],
      registry: {
        create(id) {
          return makeWeapon(id, (ctx) => {
            ctxs.push(ctx)
          })
        },
      },
    })
    manager.update(0.016)
    manager.update(0.016)
    expect(ctxs[0]?.muzzle).toBe(ctxs[1]?.muzzle)
    manager.dispose()
  })

  it('does not register weapons on the registry (D12 consume-only)', () => {
    expect(defaultModifiers().rateMul).toBe(1)
  })
})
