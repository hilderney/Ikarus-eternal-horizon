import type { Scene } from 'three'
import type { WeaponConfig, WeaponId } from '../core/weaponsCatalog'
import type { ShotPool } from '../gameobjects/shot'
import type { WeaponBehaviour } from './behaviour'
import { createLaserBehaviour } from './behaviours/laser'
import { createPlasmaBehaviour } from './behaviours/plasma'
import { createBeamBehaviour } from './behaviours/beam'
import { createMjolnirBehaviour } from './behaviours/mjolnir'

export type WeaponBehaviourFactory = (
  config: WeaponConfig,
  pool: ShotPool,
  scene: Scene,
) => WeaponBehaviour

export const WEAPON_REGISTRY: Record<WeaponId, WeaponBehaviourFactory> = {
  laser: createLaserBehaviour,
  plasma: createPlasmaBehaviour,
  beam: createBeamBehaviour,
  mjolnir: createMjolnirBehaviour,
}

export function registerWeapon(id: WeaponId, factory: WeaponBehaviourFactory): void {
  WEAPON_REGISTRY[id] = factory
}