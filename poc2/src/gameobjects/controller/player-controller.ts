/**
 * SDD-C02 PlayerController — force motion, tilt, kinematic dash. Device-blind.
 */

import type { InputPort } from '../../core/input'
import { DASH_LEVELS, dashLevel } from './dash-levels'

export interface MotionModifiers {
  readonly speedMul: number
  readonly accelMul: number
}

export interface MotionConfig {
  readonly maxSpeed: number
  readonly accel: number
  readonly decel: number
  readonly brake: number
}

export interface DashConfig {
  readonly speedMul: number
  readonly durationMs: number
  readonly cooldownMs: number
}

export interface TiltConfig {
  readonly axis: 'y' | 'z'
  readonly sign: 1 | -1
  readonly maxDeg: number
  readonly riseMs: number
  readonly fallMs: number
}

export interface ShipKeys {
  readonly moveXMinus: string
  readonly moveXPlus: string
  readonly moveZMinus: string
  readonly moveZPlus: string
}

export interface ShipTransform {
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  scale: number
}

export interface DashEnergyPort {
  canAfford(cost: number): boolean
  spend(cost: number): void
}

export interface PlayerControllerOptions {
  readonly input: InputPort
  readonly transform: ShipTransform
  readonly motion: MotionConfig
  readonly dash: DashConfig
  readonly tilt: TiltConfig
  readonly keys: ShipKeys
  readonly modifiers: MotionModifiers
  readonly onDash?: () => void
  readonly energy?: DashEnergyPort
}

function pushVelocity(
  velocity: number,
  direction: number,
  force: number,
  maxSpeed: number,
  dt: number,
): number {
  const next = velocity + direction * force * dt
  const capped = Math.min(Math.abs(next), maxSpeed)
  return next === 0 ? 0 : Math.sign(next) * capped
}

function coastToZero(velocity: number, rate: number, dt: number): number {
  const step = rate * dt
  if (velocity > 0) {
    return Math.max(0, velocity - step)
  }
  if (velocity < 0) {
    return Math.min(0, velocity + step)
  }
  return 0
}

function axisVelocity(
  velocity: number,
  direction: number,
  accel: number,
  brake: number,
  decel: number,
  maxSpeed: number,
  dt: number,
): number {
  if (direction === 0) {
    return coastToZero(velocity, decel, dt)
  }
  const sign = direction < 0 ? -1 : 1
  const mag = Math.abs(direction)
  const braking = velocity !== 0 && Math.sign(velocity) !== sign
  const force = (braking ? brake : accel) * mag
  return pushVelocity(velocity, sign, force, maxSpeed, dt)
}

function wrapDeg(value: number): number {
  let next = value
  while (next > 180) {
    next -= 360
  }
  while (next < -180) {
    next += 360
  }
  return next
}

export class PlayerController {
  private readonly _input: InputPort
  private readonly _transform: ShipTransform
  private readonly _motion: MotionConfig
  private readonly _dash: DashConfig
  private readonly _tilt: TiltConfig
  private readonly _modifiers: MotionModifiers
  private readonly _onDash: (() => void) | undefined
  private readonly _energy: DashEnergyPort | undefined
  private _vx = 0
  private _vz = 0
  private _tiltCur = 0
  private _dashMs = 0
  private _dashCdMs = 0
  private _dashLevel = 1
  private _dashSpeedMul = DASH_LEVELS[0]?.speedMul ?? 2.2
  private _dashEnergy = DASH_LEVELS[0]?.energyCost ?? 3
  private _rollMs = 0
  private _rollDurMs = 0
  private _rollFrom = 0
  private _rollDelta = 0
  private _disposed = false

  constructor(options: PlayerControllerOptions) {
    this._input = options.input
    this._transform = options.transform
    this._motion = options.motion
    this._dash = options.dash
    this._tilt = options.tilt
    this._modifiers = options.modifiers
    this._onDash = options.onDash
    this._energy = options.energy
    void options.keys
    this.setDashLevel(1)
  }

  dashLevel(): number {
    return this._dashLevel
  }

  setDashLevel(level: number): void {
    const row = dashLevel(level)
    if (!row) {
      return
    }
    this._dashLevel = row.level
    this._dashSpeedMul = row.speedMul
    this._dashEnergy = row.energyCost
  }

  update(dt: number): void {
    if (this._disposed) {
      return
    }

    const dirX = this._input.axis('moveX')
    const dirZ = this._input.axis('moveZ')
    const speedMul = this._modifiers.speedMul
    const accelMul = this._modifiers.accelMul
    const accel = this._motion.accel * accelMul
    let maxSpeed = this._motion.maxSpeed * speedMul

    if (this._dashCdMs > 0) {
      this._dashCdMs = Math.max(0, this._dashCdMs - dt * 1000)
    }
    if (this._dashMs > 0) {
      this._dashMs = Math.max(0, this._dashMs - dt * 1000)
    }

    if (this._input.consumePress('dash') && this._dashCdMs === 0) {
      const blocked = this._energy !== undefined && !this._energy.canAfford(this._dashEnergy)
      if (!blocked && this._snapDash(dirX, dirZ, maxSpeed)) {
        this._energy?.spend(this._dashEnergy)
        this._onDash?.()
      }
    }

    if (this._dashMs > 0) {
      maxSpeed *= this._dashSpeedMul
    }

    this._vx = axisVelocity(
      this._vx,
      dirX,
      accel,
      this._motion.brake,
      this._motion.decel,
      maxSpeed,
      dt,
    )
    this._vz = axisVelocity(
      this._vz,
      dirZ,
      accel,
      this._motion.brake,
      this._motion.decel,
      maxSpeed,
      dt,
    )

    this._transform.position.x += this._vx * dt
    this._transform.position.z += this._vz * dt

    this._updateBank(dirX, dt)
  }

  dispose(): void {
    this._disposed = true
  }

  private _snapDash(dirX: number, dirZ: number, maxSpeed: number): boolean {
    const dirLen = Math.hypot(dirX, dirZ)
    let dx: number
    let dz: number
    if (dirLen > 0) {
      dx = dirX / dirLen
      dz = dirZ / dirLen
    } else {
      const vLen = Math.hypot(this._vx, this._vz)
      if (vLen <= 0) {
        return false
      }
      dx = this._vx / vLen
      dz = this._vz / vLen
    }
    const cap = maxSpeed * this._dashSpeedMul
    this._vx = dx * cap
    this._vz = dz * cap
    this._dashMs = this._dash.durationMs
    this._dashCdMs = this._dash.cooldownMs
    if (Math.abs(dx) > 0.001) {
      this._rollFrom = this._tiltCur
      this._rollDelta = 360 * Math.sign(dx) * this._tilt.sign
      this._rollMs = 0
      this._rollDurMs = this._dash.durationMs
    }
    return true
  }

  private _updateBank(dirX: number, dt: number): void {
    if (this._rollDurMs > 0) {
      this._rollMs += dt * 2000
      const t = Math.min(1, this._rollMs / this._rollDurMs)
      this._tiltCur = this._rollFrom + this._rollDelta * t
      if (t >= 1) {
        this._rollDurMs = 0
        this._tiltCur = wrapDeg(this._tiltCur)
      }
    } else {
      const targetTilt = dirX * this._tilt.maxDeg * this._tilt.sign
      const useFall = Math.abs(targetTilt) < Math.abs(this._tiltCur)
      const tiltMs = useFall ? this._tilt.fallMs : this._tilt.riseMs
      const tiltRate = this._tilt.maxDeg / (tiltMs / 1000)
      const step = tiltRate * dt
      if (targetTilt > this._tiltCur) {
        this._tiltCur = Math.min(targetTilt, this._tiltCur + step)
      } else {
        this._tiltCur = Math.max(targetTilt, this._tiltCur - step)
      }
    }
    if (this._tilt.axis === 'y') {
      this._transform.rotation.y = this._tiltCur
    } else {
      this._transform.rotation.z = this._tiltCur
    }
  }
}
