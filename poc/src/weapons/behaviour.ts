export interface Vec3Like {
  x: number
  y: number
  z: number
}

export interface TargetHit {
  team: 'player' | 'enemy'
  active: boolean
  x: number
  z: number
  radius: number
  takeDamage(amount: number): void
}

export interface EnergyPort {
  canAfford(cost: number): boolean
  spend(cost: number): void
}

export interface WeaponServices {
  energy: EnergyPort
  targets: readonly TargetHit[]
}

export interface WeaponModifiers {
  damageMul: number
  rateMul: number
  energyMul: number
  critChance: number
  pulses: number
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

export function defaultModifiers(): WeaponModifiers {
  return {
    damageMul: 1,
    rateMul: 1,
    energyMul: 1,
    critChance: 0,
    pulses: 1,
    aoeMul: 1,
    beamWidthMul: 1,
    coneMul: 1,
  }
}