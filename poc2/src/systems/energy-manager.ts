/**
 * SDD-D03 EnergyManager — shared energy pool. No THREE. HUD / G08 read current/max.
 * Optional `pool` is the C01 byte sheet so the debugger slider is combat energy.
 */

import { BALANCE } from '../core/balancer'

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
  /** Post-spend lockout. Default: BALANCE.ship.cooldowns.recoveringMs. */
  readonly regenDelayMs?: number
}

export class EnergyManager implements EnergyPort {
  readonly regenPerSec: number

  private readonly _pool: EnergyPool
  private readonly _canRegen: () => boolean
  private readonly _regenDelayMaxMs: number
  private _regenDelayMs = 0

  constructor(options: EnergyManagerOptions) {
    const { config } = options
    this.regenPerSec = config.regenPerSec
    this._pool = options.pool ?? { current: config.start, max: config.max }
    this._canRegen = options.canRegen ?? (() => true)
    this._regenDelayMaxMs = options.regenDelayMs ?? BALANCE.ship.cooldowns.recoveringMs
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
    this._regenDelayMs = this._regenDelayMaxMs
  }

  update(dt: number): void {
    let remain = dt
    if (this._regenDelayMs > 0) {
      const delayDt = this._regenDelayMs / 1000
      if (remain <= delayDt) {
        this._regenDelayMs -= remain * 1000
        return
      }
      remain -= delayDt
      this._regenDelayMs = 0
    }
    if (!this._canRegen() || remain <= 0) {
      return
    }
    this._pool.current = Math.min(this._pool.max, this._pool.current + this.regenPerSec * remain)
  }

  dispose(): void {
    /* no GPU */
  }
}
