/**
 * EnemyMovementManager — pluggable movement strategies for hostiles.
 *
 * Strategies
 * ----------
 * synchronizedLerp (reachGate A→B)
 *   Single t ∈ [0,1] with easeInOutCubic.
 *   X/Y: linear lerp(A,B,u) — same as before.
 *   Z: geometric progression lerpGeometric(Az,Bz,u) so depth advances on a curve
 *   while lateral/altitude stay eased-linear (path bows in Z).
 *   B may update each frame (ship-relative gate marker). Arrives only when t≥1.
 *
 * seekChase (post-gate flyby)
 *   Always advances +Z at currentSpeed; X/Y damp to player; facing locked on +Z.
 */

import { damp, distXYZ, easeInOutCubic, lerp, lerpGeometric } from '../core/math'

export type MoveStrategyId = 'synchronizedLerp' | 'seekChase'

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface MoveContext {
  readonly position: Vec3
  readonly facingY: { value: number }
  readonly dt: number
  readonly currentSpeed: number
  readonly target: Readonly<Vec3>
  readonly arriveRadius: number
  readonly agilityLambda: number
}

export interface EnemyMoveStrategy {
  readonly id: MoveStrategyId
  begin(from: Readonly<Vec3>, to: Readonly<Vec3>, cruiseSpeed: number): void
  update(ctx: MoveContext): { arrived: boolean }
  reset(): void
}

const MIN_DURATION = 0.05

function copyVec(src: Readonly<Vec3>, dst: Vec3): void {
  dst.x = src.x
  dst.y = src.y
  dst.z = src.z
}

class SynchronizedLerpStrategy implements EnemyMoveStrategy {
  readonly id = 'synchronizedLerp' as const
  private readonly _from: Vec3 = { x: 0, y: 0, z: 0 }
  private readonly _to: Vec3 = { x: 0, y: 0, z: 0 }
  private _t = 0
  private _duration = 1
  private _active = false

  begin(from: Readonly<Vec3>, to: Readonly<Vec3>, cruiseSpeed: number): void {
    copyVec(from, this._from)
    copyVec(to, this._to)
    const dist = distXYZ(from.x, from.y, from.z, to.x, to.y, to.z)
    const speed = Math.max(0.01, cruiseSpeed)
    this._duration = Math.max(MIN_DURATION, dist / speed)
    this._t = 0
    this._active = true
  }

  update(ctx: MoveContext): { arrived: boolean } {
    if (!this._active) {
      return { arrived: true }
    }
    copyVec(ctx.target, this._to)
    this._t = Math.min(1, this._t + ctx.dt / this._duration)
    const u = easeInOutCubic(this._t)
    // X/Y eased-linear; Z geometric → spatial curve into the gate marker.
    ctx.position.x = lerp(this._from.x, this._to.x, u)
    ctx.position.y = lerp(this._from.y, this._to.y, u)
    ctx.position.z = lerpGeometric(this._from.z, this._to.z, u)

    const dx = this._to.x - ctx.position.x
    const dz = this._to.z - ctx.position.z
    if (Math.hypot(dx, dz) > 0.0001) {
      ctx.facingY.value = Math.atan2(dx, dz)
    }

    const arrived = this._t >= 1
    if (arrived) {
      copyVec(this._to, ctx.position)
      this._active = false
    }
    return { arrived }
  }

  reset(): void {
    this._t = 0
    this._active = false
  }
}

class SeekChaseStrategy implements EnemyMoveStrategy {
  readonly id = 'seekChase' as const

  begin(_from: Readonly<Vec3>, _to: Readonly<Vec3>, _cruiseSpeed: number): void {
    void _from
    void _to
    void _cruiseSpeed
  }

  update(ctx: MoveContext): { arrived: boolean } {
    const speed = Math.max(0, ctx.currentSpeed)
    ctx.position.z += speed * ctx.dt
    ctx.position.x = damp(ctx.position.x, ctx.target.x, ctx.agilityLambda, ctx.dt)
    ctx.position.y = damp(ctx.position.y, ctx.target.y, ctx.agilityLambda, ctx.dt)
    ctx.facingY.value = 0
    return { arrived: false }
  }

  reset(): void {
    /* stateless */
  }
}

export class EnemyMovementManager {
  private readonly _synchronized = new SynchronizedLerpStrategy()
  private readonly _seekChase = new SeekChaseStrategy()
  private _active: EnemyMoveStrategy = this._synchronized
  private readonly _facing = { value: 0 }

  strategyId(): MoveStrategyId {
    return this._active.id
  }

  facingY(): number {
    return this._facing.value
  }

  setStrategy(id: MoveStrategyId): void {
    this._active = id === 'seekChase' ? this._seekChase : this._synchronized
  }

  beginJourney(from: Readonly<Vec3>, to: Readonly<Vec3>, cruiseSpeed: number): void {
    this._active.begin(from, to, cruiseSpeed)
  }

  update(ctx: Omit<MoveContext, 'facingY'>): { arrived: boolean } {
    return this._active.update({
      ...ctx,
      facingY: this._facing,
    })
  }

  reset(): void {
    this._synchronized.reset()
    this._seekChase.reset()
    this._active = this._synchronized
    this._facing.value = 0
  }
}
