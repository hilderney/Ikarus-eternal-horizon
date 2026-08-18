/**
 * SDD-C03 ShipHealth — Force Field, Integrity, hull-level degradation.
 * Pure arithmetic. Damage enters only through applyDamage. G10 acts on destroyed.
 */

import type { ShipHealthConfig } from '../../core/balancer'
import { clamp } from '../../core/math'

/** Frozen layer set (F01 / D13). Copied so this module is self-contained. */
export type Layer = 'Player' | 'PlayerShot' | 'Enemy' | 'EnemyShot' | 'Meteor' | 'Drop'

export type HullLevel = 0 | 1 | 2 | 3

export interface DamageOutcome {
  absorbedByShield: number
  dealtToHull: number
  shieldBroke: boolean
  hullLevelChanged: boolean
  destroyed: boolean
}

export interface HullModifiers {
  speedMul: number
  accelMul: number
  fireRateMul: number
}

export interface DamageSink {
  applyDamage(amount: number, source: Layer): DamageOutcome
}

export interface ShipHealthOptions {
  readonly config: ShipHealthConfig
}

function hullLevelOf(
  integrity: number,
  integrityMax: number,
  thresholds: readonly [number, number, number],
): HullLevel {
  const ratio = integrity / integrityMax
  if (ratio > thresholds[0]) {
    return 0
  }
  if (ratio > thresholds[1]) {
    return 1
  }
  if (ratio > thresholds[2]) {
    return 2
  }
  return 3
}

export class ShipHealth implements DamageSink {
  private readonly _config: ShipHealthConfig
  private _integrity: number
  private _shield: number
  private _regenClockMs = 0
  private _destroyedEmitted = false
  private _lastSource: Layer | null = null
  private _disposed = false
  private readonly _outcome: DamageOutcome = {
    absorbedByShield: 0,
    dealtToHull: 0,
    shieldBroke: false,
    hullLevelChanged: false,
    destroyed: false,
  }
  private readonly _modifiers: HullModifiers = {
    speedMul: 1,
    accelMul: 1,
    fireRateMul: 1,
  }

  constructor(options: ShipHealthOptions) {
    this._config = options.config
    this._integrity = options.config.integrityMax
    this._shield = options.config.shieldMax
    this._syncModifiers()
  }

  get integrity(): number {
    return this._integrity
  }

  get integrityMax(): number {
    return this._config.integrityMax
  }

  get shield(): number {
    return this._shield
  }

  get shieldMax(): number {
    return this._config.shieldMax
  }

  get hullLevel(): HullLevel {
    return hullLevelOf(this._integrity, this._config.integrityMax, this._config.hullThresholds)
  }

  get modifiers(): HullModifiers {
    return this._modifiers
  }

  applyDamage(amount: number, source: Layer): DamageOutcome {
    this._lastSource = source
    this._regenClockMs = 0

    const incoming = amount < 0 ? 0 : amount
    const levelBefore = this.hullLevel
    const shieldBefore = this._shield
    const integrityBefore = this._integrity

    const absorbed = Math.min(incoming, this._shield)
    this._shield -= absorbed
    const remainder = incoming - absorbed
    const dealt = Math.min(remainder, this._integrity)
    this._integrity -= dealt

    this._syncModifiers()

    const destroyed = integrityBefore > 0 && this._integrity === 0 && !this._destroyedEmitted
    if (destroyed) {
      this._destroyedEmitted = true
    }

    this._outcome.absorbedByShield = absorbed
    this._outcome.dealtToHull = dealt
    this._outcome.shieldBroke = shieldBefore > 0 && this._shield === 0
    this._outcome.hullLevelChanged = this.hullLevel !== levelBefore
    this._outcome.destroyed = destroyed
    return this._outcome
  }

  update(dt: number): void {
    if (this._disposed) {
      return
    }
    this._regenClockMs += dt * 1000
    if (this._shield < this._config.shieldMax && this._regenClockMs >= this._config.regenDelayMs) {
      this._shield = clamp(
        this._shield + this._config.shieldRegenPerSec * dt,
        0,
        this._config.shieldMax,
      )
    }
  }

  dispose(): void {
    this._disposed = true
    if (this._lastSource !== null) {
      this._lastSource = null
    }
  }

  private _syncModifiers(): void {
    const level = this.hullLevel
    this._modifiers.speedMul = this._config.speedMul[level]
    this._modifiers.accelMul = this._config.accelMul[level]
    this._modifiers.fireRateMul = this._config.fireRateMul[level]
  }
}
