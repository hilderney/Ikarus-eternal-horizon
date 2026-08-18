/**
 * SDD-D02 weapon registry seam (D12). Adding a gun = catalog row + registerWeapon.
 */

import type { WeaponConfig, WeaponId } from './catalog'
import type { ShotSpawn } from '../shot/weapon-shot'

export interface ShotAcquirePort {
  acquire(): { activate(spawn: ShotSpawn): void } | null
}

export interface Vec3Like {
  x: number
  y: number
  z: number
}

export interface EnergyPort {
  canAfford(cost: number): boolean
  spend(cost: number): void
}

export interface WeaponServices {
  energy: EnergyPort
}

export interface WeaponModifiers {
  damageMul: number
  rateMul: number
  energyMul: number
  aoeMul: number
  beamWidthMul: number
  coneMul: number
}

export interface BehaviourCtx {
  dt: number
  holding: boolean
  muzzle: Vec3Like
  services: WeaponServices
  mods: WeaponModifiers
}

export interface WeaponBehaviour {
  update(ctx: BehaviourCtx): void
  dispose(): void
}

export type WeaponBehaviourFactory = (
  config: WeaponConfig,
  shots: ShotAcquirePort,
) => WeaponBehaviour

export const WEAPON_REGISTRY: Partial<Record<WeaponId, WeaponBehaviourFactory>> = {}

export function registerWeapon(id: WeaponId, factory: WeaponBehaviourFactory): void {
  WEAPON_REGISTRY[id] = factory
}

export function defaultModifiers(): WeaponModifiers {
  return {
    damageMul: 1,
    rateMul: 1,
    energyMul: 1,
    aoeMul: 1,
    beamWidthMul: 1,
    coneMul: 1,
  }
}
