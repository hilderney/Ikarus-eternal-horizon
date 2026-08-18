/**
 * SDD-D03 EnergyManager — shared energy pool. No THREE. HUD reads current/max.
 */

export interface EnergyPort {
  canAfford(cost: number): boolean
  spend(cost: number): void
}

export interface EnergyConfig {
  readonly start: number
  readonly max: number
  readonly regenPerSec: number
}

export interface EnergyManagerOptions {
  readonly config: EnergyConfig
}

export class EnergyManager implements EnergyPort {
  readonly max: number
  readonly regenPerSec: number

  private _current: number

  constructor(options: EnergyManagerOptions) {
    this.max = options.config.max
    this.regenPerSec = options.config.regenPerSec
    this._current = options.config.start
  }

  get current(): number {
    return this._current
  }

  canAfford(cost: number): boolean {
    return this._current >= cost
  }

  spend(cost: number): void {
    this._current = Math.max(0, this._current - cost)
  }

  update(dt: number): void {
    this._current = Math.min(this.max, this._current + this.regenPerSec * dt)
  }

  dispose(): void {
    /* no GPU */
  }
}
