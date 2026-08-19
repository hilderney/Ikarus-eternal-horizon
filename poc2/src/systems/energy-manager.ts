/**
 * SDD-D03 EnergyManager — shared energy pool. No THREE. HUD / G08 read current/max.
 * Optional `pool` is the C01 byte sheet so the debugger slider is combat energy.
 */

export interface EnergyPort {
  canAfford(cost: number): boolean
  spend(cost: number): void
}

export interface EnergyPool {
  current: number
  max: number
}

export interface EnergyConfig {
  readonly start: number
  readonly max: number
  readonly regenPerSec: number
}

export interface EnergyManagerOptions {
  readonly config: EnergyConfig
  /** When set, current/max live on this object (C01 stats.energy). */
  readonly pool?: EnergyPool
  /** Regen gate. Default: always. Run wires ship.status.recovering. */
  readonly canRegen?: () => boolean
}

export class EnergyManager implements EnergyPort {
  readonly regenPerSec: number

  private readonly _pool: EnergyPool
  private readonly _canRegen: () => boolean

  constructor(options: EnergyManagerOptions) {
    const { config } = options
    this.regenPerSec = config.regenPerSec
    this._pool = options.pool ?? { current: config.start, max: config.max }
    this._canRegen = options.canRegen ?? (() => true)
  }

  get current(): number {
    return this._pool.current
  }

  get max(): number {
    return this._pool.max
  }

  canAfford(cost: number): boolean {
    return this._pool.current >= cost
  }

  spend(cost: number): void {
    this._pool.current = Math.max(0, this._pool.current - cost)
  }

  update(dt: number): void {
    if (!this._canRegen()) {
      return
    }
    this._pool.current = Math.min(this._pool.max, this._pool.current + this.regenPerSec * dt)
  }

  dispose(): void {
    /* no GPU */
  }
}
