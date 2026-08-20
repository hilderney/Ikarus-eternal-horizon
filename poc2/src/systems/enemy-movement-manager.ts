/**
 * EnemyMovementManager — pluggable movement strategies for hostiles.
 *
 * Strategies
 * ----------
 * synchronizedLerp (reachGate)
 *   Capture journey start A and end B (gate). Advance a single progress t ∈ [0,1]
 *   with duration = dist(A,B) / cruiseSpeed. Position = lerp(A, B, easeInOutCubic(t)).
 *   All three axes share the same residual factor (1−u), so they arrive together
 *   (e.g. A=(-100,-50,-50) → B=(0,0,0)). B may update each frame (ship-relative gate);
 *   A stays fixed for the journey. Geometric path is the A–B segment; the “curve”
 *   is temporal (ease-in-out velocity). Arrived when t≥1 or within arriveRadius.
 *   On handoff, Enemy snaps y to gate.y (BALANCE.enemy.gate.offset.y = 0 play plane).
 *
 * seekChase (chase player)
 *   Planar seek on XZ toward the player at currentSpeed; Y damps to target.y.
 *   Continuous — never reports arrived.
 *
 * Usage: Enemy owns one manager per pooled slot; activate begins synchronizedLerp
 * toward the live gate aim; on arrived switches to seekChase.
 */

import { damp, distXYZ, easeInOutCubic, lerpVec3 } from '../core/math'

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
    lerpVec3(this._from, this._to, u, ctx.position)

    const dx = this._to.x - ctx.position.x
    const dz = this._to.z - ctx.position.z
    if (Math.hypot(dx, dz) > 0.0001) {
      ctx.facingY.value = Math.atan2(dx, dz)
    }

    const near =
      distXYZ(
        ctx.position.x,
        ctx.position.y,
        ctx.position.z,
        this._to.x,
        this._to.y,
        this._to.z,
      ) <= ctx.arriveRadius
    const arrived = this._t >= 1 || near
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
    const dx = ctx.target.x - ctx.position.x
    const dz = ctx.target.z - ctx.position.z
    const dist = Math.hypot(dx, dz)
    if (dist > 0.001) {
      const inv = 1 / dist
      const step = ctx.currentSpeed * ctx.dt
      ctx.position.x += dx * inv * step
      ctx.position.z += dz * inv * step
      ctx.facingY.value = Math.atan2(dx, dz)
    }
    ctx.position.y = damp(ctx.position.y, ctx.target.y, ctx.agilityLambda, ctx.dt)
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
