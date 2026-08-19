/**
 * SDD-C02 PlayerController — force motion, tilt, kinematic dash. Device-blind.
 */

import type { InputPort } from '../../core/input'

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

export interface PlayerControllerOptions {
  readonly input: InputPort
  readonly transform: ShipTransform
  readonly motion: MotionConfig
  readonly dash: DashConfig
  readonly tilt: TiltConfig
  readonly keys: ShipKeys
  readonly modifiers: MotionModifiers
  readonly onDash?: () => void
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

export class PlayerController {
  private readonly _input: InputPort
  private readonly _transform: ShipTransform
  private readonly _motion: MotionConfig
  private readonly _dash: DashConfig
  private readonly _tilt: TiltConfig
  private readonly _modifiers: MotionModifiers
  private readonly _onDash: (() => void) | undefined
  private _vx = 0
  private _vz = 0
  private _tiltCur = 0
  private _dashMs = 0
  private _dashCdMs = 0
  private _disposed = false

  constructor(options: PlayerControllerOptions) {
    this._input = options.input
    this._transform = options.transform
    this._motion = options.motion
    this._dash = options.dash
    this._tilt = options.tilt
    this._modifiers = options.modifiers
    this._onDash = options.onDash
    void options.keys
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
      const dashCap = maxSpeed * this._dash.speedMul
      const dirLen = Math.hypot(dirX, dirZ)
      if (dirLen > 0) {
        this._vx = (dirX / dirLen) * dashCap
        this._vz = (dirZ / dirLen) * dashCap
        this._dashMs = this._dash.durationMs
        this._dashCdMs = this._dash.cooldownMs
        this._onDash?.()
      } else {
        const vLen = Math.hypot(this._vx, this._vz)
        if (vLen > 0) {
          this._vx = (this._vx / vLen) * dashCap
          this._vz = (this._vz / vLen) * dashCap
          this._dashMs = this._dash.durationMs
          this._dashCdMs = this._dash.cooldownMs
          this._onDash?.()
        }
      }
    }

    if (this._dashMs > 0) {
      maxSpeed *= this._dash.speedMul
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
    if (this._tilt.axis === 'y') {
      this._transform.rotation.y = this._tiltCur
    } else {
      this._transform.rotation.z = this._tiltCur
    }
  }

  dispose(): void {
    this._disposed = true
  }
}
