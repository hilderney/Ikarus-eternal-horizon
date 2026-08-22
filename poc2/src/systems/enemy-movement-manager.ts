/**
 * EnemyMovementManager — birth animation (spawn → EnemyGate) plus the smoothed
 * heading shared by nose, travel and muzzle.
 *
 * Post-gate movement belongs to the squad AI (steering.ts + EnemyGroup); this
 * class only owns the scripted A→B reach curve and the facing damp, so a craft
 * never snaps its nose when its behaviour changes.
 */

import { dampAngle, distXYZ } from '../core/math'
import { LIVE_REACH_PATH, sampleReachPoint, type ReachPreviewSide } from './reach-path'

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface FacingState {
  /** Smoothed heading driving nose + travel (radians; 0 = +Z). */
  current: number
  /** Heading the caller last asked for. */
  desired: number
}

export interface BirthInput {
  readonly position: Vec3
  readonly dt: number
  readonly target: Readonly<Vec3>
  readonly agilityLambda: number
}

const MIN_DURATION = 0.05
const DEFAULT_TURN_RATE_DEG = 120
/** Fraction of the agility damp lambda used for rotation (fluid, not twitchy). */
const TURN_DAMP_SCALE = 0.55

function copyVec(src: Readonly<Vec3>, dst: Vec3): void {
  dst.x = src.x
  dst.y = src.y
  dst.z = src.z
}

export class EnemyMovementManager {
  private readonly _facing: FacingState = { current: 0, desired: 0 }
  private readonly _from: Vec3 = { x: 0, y: 0, z: 0 }
  private readonly _to: Vec3 = { x: 0, y: 0, z: 0 }
  private _t = 0
  private _duration = 1
  private _active = false
  private _pathSide: ReachPreviewSide = 'front'
  private _turnRateRad = (DEFAULT_TURN_RATE_DEG * Math.PI) / 180

  /** Smoothed heading (radians; 0 = +Z). Nose, travel and muzzle share it. */
  facingY(): number {
    return this._facing.current
  }

  desiredFacingY(): number {
    return this._facing.desired
  }

  /** Max angular speed of the nose (degrees / sec). */
  setTurnRate(degPerSec: number): void {
    this._turnRateRad = (Math.max(1, degPerSec) * Math.PI) / 180
  }

  /** Seed the heading without easing (spawn only). */
  setFacing(heading: number): void {
    this._facing.current = heading
    this._facing.desired = heading
  }

  /** Ease the smoothed heading along the shortest arc; returns the new value. */
  turnToward(desired: number, dt: number, agilityLambda: number): number {
    this._facing.desired = desired
    const lambda = Math.max(0.5, agilityLambda * TURN_DAMP_SCALE)
    this._facing.current = dampAngle(
      this._facing.current,
      desired,
      lambda,
      dt,
      this._turnRateRad,
    )
    return this._facing.current
  }

  birthActive(): boolean {
    return this._active
  }

  /** Start the scripted reach curve from spawn to the gate entry point. */
  beginBirth(
    from: Readonly<Vec3>,
    to: Readonly<Vec3>,
    cruiseSpeed: number,
    pathSide: ReachPreviewSide = 'front',
  ): void {
    copyVec(from, this._from)
    copyVec(to, this._to)
    this._pathSide = pathSide
    const dist = distXYZ(from.x, from.y, from.z, to.x, to.y, to.z)
    const speed = Math.max(0.01, cruiseSpeed)
    this._duration = Math.max(MIN_DURATION, dist / speed)
    this._t = 0
    this._active = true
  }

  /** Advance the birth curve; writes straight into `input.position`. */
  updateBirth(input: BirthInput): { arrived: boolean } {
    if (!this._active) {
      return { arrived: true }
    }
    copyVec(input.target, this._to)
    this._t = Math.min(1, this._t + input.dt / this._duration)
    sampleReachPoint(
      this._from,
      this._to,
      this._t,
      input.position,
      LIVE_REACH_PATH,
      this._pathSide,
    )
    const dx = this._to.x - input.position.x
    const dz = this._to.z - input.position.z
    if (Math.hypot(dx, dz) > 0.0001) {
      this.turnToward(Math.atan2(dx, dz), input.dt, input.agilityLambda)
    }
    const arrived = this._t >= 1
    if (arrived) {
      copyVec(this._to, input.position)
      this._active = false
    }
    return { arrived }
  }

  reset(): void {
    this._t = 0
    this._active = false
    this._facing.current = 0
    this._facing.desired = 0
  }
}
