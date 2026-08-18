import type { Scene } from 'three'
import { isDown, type InputState } from '../core/input'
import type { ShipTransform } from '../gameobjects/ship'
import type { WeaponId } from '../core/weaponsCatalog'
import { defaultModifiers, type EnergyPort, type Vec3Like, type WeaponModifiers } from '../weapons/behaviour'
import { createWeapon, type Weapon } from '../weapons/weapon'
import type { CollisionSystem } from './collisionSystem'

export interface FiringConfig {
  fireKey: string
  switchKey: string
}

export interface FiringSystem {
  activeId(): WeaponId
  weapon(): Weapon
  mods: WeaponModifiers
  setActive(id: WeaponId): void
  cycleWeapon(): void
  update(dt: number): void
  dispose(): void
}

export function createFiringSystem(
  config: FiringConfig,
  loadout: WeaponId[],
  scene: Scene,
  input: InputState,
  shipTransform: ShipTransform,
  energy: EnergyPort,
  collider: CollisionSystem,
): FiringSystem {
  let index = 0
  let weapon: Weapon = createWeapon(loadout[0], scene)
  let switchWasDown = false
  const mods: WeaponModifiers = defaultModifiers()
  const muzzle: Vec3Like = { x: 0, y: 0, z: 0 }

  return {
    activeId(): WeaponId {
      return weapon.id
    },
    weapon(): Weapon {
      return weapon
    },
    mods,
    setActive(id: WeaponId): void {
      if (weapon.id === id) return
      const next = loadout.indexOf(id)
      if (next < 0) return
      weapon.dispose()
      index = next
      weapon = createWeapon(loadout[index], scene)
    },
    cycleWeapon(): void {
      weapon.dispose()
      index = (index + 1) % loadout.length
      weapon = createWeapon(loadout[index], scene)
    },
    update(dt: number): void {
      muzzle.x = shipTransform.position.x + weapon.config.muzzleOffset.x
      muzzle.y = shipTransform.position.y + weapon.config.muzzleOffset.y
      muzzle.z = shipTransform.position.z + weapon.config.muzzleOffset.z

      const switchDown = isDown(input, config.switchKey)
      if (switchDown && !switchWasDown && loadout.length > 1) this.cycleWeapon()
      switchWasDown = switchDown

      weapon.update({
        dt,
        holding: isDown(input, config.fireKey),
        muzzle,
        services: { energy, targets: collider.targets },
        mods,
      })

      collider.update(dt, [weapon.pool])
    },
    dispose(): void {
      weapon.dispose()
    },
  }
}