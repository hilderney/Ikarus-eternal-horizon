/**
 * SDD-E07 FiringManager — input → active Weapon. Consumes D02 registry; pool is E04.
 */

import { defaultModifiers } from '../gameobjects/weapon/registry'
import type { BehaviourCtx, WeaponModifiers } from '../gameobjects/weapon/registry'
import type { WeaponId } from '../gameobjects/weapon/catalog'
import type { InputPort } from '../core/input'

export interface EnergyPort {
  canAfford(cost: number): boolean
  spend(cost: number): void
}

export interface FireRateMulPort {
  readonly modifiers: { readonly fireRateMul: number }
}

export interface MuzzlePort {
  readonly position: { x: number; y: number; z: number }
}

export interface WeaponPort {
  readonly id: WeaponId
  readonly config: { readonly muzzleOffset: { x: number; y: number; z: number } }
  update(ctx: BehaviourCtx): void
  dispose(): void
}

export interface WeaponRegistryPort {
  create(id: WeaponId): WeaponPort
}

export interface FiringManagerOptions {
  readonly input: InputPort
  readonly ship: MuzzlePort
  readonly energy: EnergyPort
  readonly health: FireRateMulPort
  readonly registry: WeaponRegistryPort
  readonly loadout: readonly WeaponId[]
}

export class FiringManager {
  readonly mods: WeaponModifiers = defaultModifiers()

  private readonly _input: InputPort
  private readonly _ship: MuzzlePort
  private readonly _energy: EnergyPort
  private readonly _health: FireRateMulPort
  private readonly _registry: WeaponRegistryPort
  private readonly _loadout: readonly WeaponId[]
  private readonly _muzzle = { x: 0, y: 0, z: 0 }
  private _index = 0
  private _weapon: WeaponPort
  private _switchWasDown = false

  constructor(options: FiringManagerOptions) {
    this._input = options.input
    this._ship = options.ship
    this._energy = options.energy
    this._health = options.health
    this._registry = options.registry
    this._loadout = options.loadout
    const first = options.loadout[0]
    if (!first) {
      throw new Error('FiringManager loadout is empty')
    }
    this._weapon = options.registry.create(first)
  }

  activeId(): WeaponId {
    return this._weapon.id
  }

  weapon(): WeaponPort {
    return this._weapon
  }

  setActive(id: WeaponId): void {
    if (!this._loadout.includes(id) || id === this._weapon.id) {
      return
    }
    this._weapon.dispose()
    this._index = this._loadout.indexOf(id)
    this._weapon = this._registry.create(id)
  }

  cycleWeapon(): void {
    if (this._loadout.length <= 1) {
      return
    }
    const next = (this._index + 1) % this._loadout.length
    const id = this._loadout[next]
    if (!id) {
      return
    }
    this.setActive(id)
  }

  update(dt: number): void {
    const switchDown = this._input.isPressed('switchWeapon')
    if (switchDown && !this._switchWasDown) {
      this.cycleWeapon()
    }
    this._switchWasDown = switchDown

    this.mods.rateMul = this._health.modifiers.fireRateMul
    const offset = this._weapon.config.muzzleOffset
    this._muzzle.x = this._ship.position.x + offset.x
    this._muzzle.y = this._ship.position.y + offset.y
    this._muzzle.z = this._ship.position.z + offset.z

    this._weapon.update({
      dt,
      holding: this._input.isPressed('fire'),
      muzzle: this._muzzle,
      services: { energy: this._energy },
      mods: this.mods,
    })
  }

  dispose(): void {
    this._weapon.dispose()
  }
}
