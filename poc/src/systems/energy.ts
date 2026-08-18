import type { EnergyPort } from '../weapons/behaviour'

export interface EnergyState {
  current: number
  max: number
  regenPerSec: number
}

export interface EnergySystem extends EnergyPort, EnergyState {
  update(dt: number): void
}

export function createEnergyPort(initial: number, max: number, regenPerSec: number): EnergySystem {
  return {
    current: initial,
    max,
    regenPerSec,
    canAfford(cost: number): boolean {
      return this.current >= cost
    },
    spend(cost: number): void {
      this.current = Math.max(0, this.current - cost)
    },
    update(dt: number): void {
      this.current = Math.min(this.max, this.current + this.regenPerSec * dt)
    },
  }
}