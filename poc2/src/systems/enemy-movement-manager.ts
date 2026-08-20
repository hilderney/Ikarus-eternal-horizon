/**
 * EnemyMovementManager — reachGate lerp + weighted chase strategies.
 *
 * reachGate: synchronizedLerp (A→B via reach-path curve)
 * chase: straight | engage | flee | loop_around (picked by enemy-strategy weights)
 *
 * Heading is never assigned directly: strategies ask for a desired heading and
 * `turnToward` eases the smoothed one along the shortest arc (agility damp +
 * turn-rate cap). Chase craft then travel along that smoothed heading, so nose
 * and trajectory stay continuous across strategy swaps.
 */

import { clamp, damp, dampAngle, distXYZ } from '../core/math'
import { LIVE_REACH_PATH, sampleReachPoint, type ReachPreviewSide } from './reach-path'
import type { ChaseStrategyId } from './enemy-strategy'

export type MoveStrategyId = 'synchronizedLerp' | ChaseStrategyId

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface FacingState {
  /** Smoothed heading driving nose + travel (radians; 0 = +Z). */
  current: number
  /** Heading the active strategy last asked for. */
  desired: number
}

export interface MoveContext {
  readonly position: Vec3
  readonly facing: FacingState
  readonly dt: number
  readonly currentSpeed: number
  readonly target: Readonly<Vec3>
  readonly arriveRadius: number
  readonly agilityLambda: number
  /** Ease the smoothed heading toward `desired`; returns the new heading. */
  turnToward(desired: number): number
}

export type MoveContextInput = Omit<MoveContext, 'facing' | 'turnToward'>

type MutableMoveContext = { -readonly [K in keyof MoveContext]: MoveContext[K] }

export interface LoopAroundParams {
  readonly radius: number
  readonly speedMul: number
  readonly retreatZ: number
}

export interface EnemyMoveStrategy {
  readonly id: MoveStrategyId
  begin(
    from: Readonly<Vec3>,
    to: Readonly<Vec3>,
    cruiseSpeed: number,
    pathSide?: ReachPreviewSide,
    loop?: LoopAroundParams,
  ): void
  update(ctx: MoveContext): { arrived: boolean }
  reset(): void
}

const MIN_DURATION = 0.05
const DEFAULT_TURN_RATE_DEG = 120
/** Chase craft never steer past this off-forward angle (keeps them advancing). */
const MAX_STEER_RAD = (75 * Math.PI) / 180
/** Fraction of the agility damp lambda used for rotation (fluid, not twitchy). */
const TURN_DAMP_SCALE = 0.55

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
  private _pathSide: ReachPreviewSide = 'front'

  begin(
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

  update(ctx: MoveContext): { arrived: boolean } {
    if (!this._active) {
      return { arrived: true }
    }
    copyVec(ctx.target, this._to)
    this._t = Math.min(1, this._t + ctx.dt / this._duration)
    sampleReachPoint(
      this._from,
      this._to,
      this._t,
      ctx.position,
      LIVE_REACH_PATH,
      this._pathSide,
    )
    const dx = this._to.x - ctx.position.x
    const dz = this._to.z - ctx.position.z
    if (Math.hypot(dx, dz) > 0.0001) {
      ctx.turnToward(Math.atan2(dx, dz))
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

/**
 * Forward flyby steered by heading: straight holds +Z, engage banks toward the
 * player's X, flee banks away. Travel follows the smoothed heading, so a swap
 * bends the trajectory instead of snapping it.
 */
class LateralFlybyStrategy implements EnemyMoveStrategy {
  readonly id: ChaseStrategyId
  private readonly _mode: 'straight' | 'engage' | 'flee'

  constructor(mode: 'straight' | 'engage' | 'flee') {
    this._mode = mode
    this.id = mode
  }

  begin(
    _from: Readonly<Vec3>,
    _to: Readonly<Vec3>,
    _cruiseSpeed: number,
    _pathSide?: ReachPreviewSide,
  ): void {
    void _from
    void _to
    void _cruiseSpeed
    void _pathSide
  }

  update(ctx: MoveContext): { arrived: boolean } {
    const speed = Math.max(0, ctx.currentSpeed)
    const heading = ctx.turnToward(this._desiredHeading(ctx, speed))

    const prevX = ctx.position.x
    const prevY = ctx.position.y
    const prevZ = ctx.position.z

    ctx.position.x += Math.sin(heading) * speed * ctx.dt
    ctx.position.z += Math.cos(heading) * speed * ctx.dt
    const lateral = Math.max(0.15, ctx.agilityLambda * 0.35)
    const yLambda =
      this._mode === 'engage' ? lateral * 0.5 : this._mode === 'flee' ? lateral * 0.35 : lateral * 0.25
    ctx.position.y = damp(ctx.position.y, ctx.target.y, yLambda, ctx.dt)

    clampStep(ctx.position, prevX, prevY, prevZ, speed * ctx.dt)
    return { arrived: false }
  }

  reset(): void {
    /* stateless */
  }

  private _desiredHeading(ctx: MoveContext, speed: number): number {
    if (this._mode === 'straight') {
      return 0
    }
    // Lookahead keeps the bank shallow when the lateral error is small.
    const lookahead = Math.max(4, speed * 1.5)
    const dx =
      this._mode === 'engage'
        ? ctx.target.x - ctx.position.x
        : (ctx.position.x >= ctx.target.x ? 1 : -1) * 40
    return clamp(Math.atan2(dx, lookahead), -MAX_STEER_RAD, MAX_STEER_RAD)
  }
}

/**
 * Evasive 360° loop in XZ: wide circle ending behind the start on Z (re-enter combat line).
 * Center drifts −Z by retreatZ over the full turn so end = (start.x, start.z − retreatZ).
 */
class LoopAroundStrategy implements EnemyMoveStrategy {
  readonly id = 'loop_around' as const
  private readonly _start: Vec3 = { x: 0, y: 0, z: 0 }
  private _t = 0
  private _radius = 14
  private _speedMul = 1.35
  private _retreatZ = 6
  private _side = 1
  private _startAngle = 0
  private _active = false

  begin(
    from: Readonly<Vec3>,
    _to: Readonly<Vec3>,
    _cruiseSpeed: number,
    _pathSide?: ReachPreviewSide,
    loop?: LoopAroundParams,
  ): void {
    void _to
    void _cruiseSpeed
    void _pathSide
    copyVec(from, this._start)
    this._radius = Math.max(1, loop?.radius ?? 14)
    this._speedMul = loop?.speedMul ?? 1.35
    this._retreatZ = Math.max(0, loop?.retreatZ ?? 6)
    // Prefer swinging toward the nearer board edge (or away from origin).
    this._side = from.x >= 0 ? 1 : -1
    // Center starts beside the craft; vector center→start = (−side·R, 0).
    this._startAngle = this._side > 0 ? Math.PI : 0
    this._t = 0
    this._active = true
  }

  update(ctx: MoveContext): { arrived: boolean } {
    if (!this._active) {
      const heading = ctx.turnToward(0)
      const speed = Math.max(0, ctx.currentSpeed)
      ctx.position.x += Math.sin(heading) * speed * ctx.dt
      ctx.position.z += Math.cos(heading) * speed * ctx.dt
      return { arrived: true }
    }

    const speed = Math.max(0.01, ctx.currentSpeed) * this._speedMul
    // Path length ≈ full circle + linear retreat along the center.
    const pathLen = Math.PI * 2 * this._radius + this._retreatZ
    this._t = Math.min(1, this._t + (speed * ctx.dt) / Math.max(0.01, pathLen))

    const cx = this._start.x + this._side * this._radius
    const cz0 = this._start.z
    const cz1 = this._start.z - this._retreatZ
    const cz = cz0 + (cz1 - cz0) * this._t
    const angle = this._startAngle + this._t * Math.PI * 2

    const prevX = ctx.position.x
    const prevZ = ctx.position.z
    ctx.position.x = cx + Math.cos(angle) * this._radius
    ctx.position.y = this._start.y
    ctx.position.z = cz + Math.sin(angle) * this._radius

    const dx = ctx.position.x - prevX
    const dz = ctx.position.z - prevZ
    if (Math.hypot(dx, dz) > 1e-5) {
      ctx.turnToward(Math.atan2(dx, dz))
    }

    if (this._t >= 1) {
      ctx.position.x = this._start.x
      ctx.position.y = this._start.y
      ctx.position.z = this._start.z - this._retreatZ
      // Nose keeps easing back to +Z on the frames that follow.
      ctx.turnToward(0)
      this._active = false
      return { arrived: true }
    }
    return { arrived: false }
  }

  reset(): void {
    this._t = 0
    this._active = false
  }
}

function clampStep(
  position: Vec3,
  prevX: number,
  prevY: number,
  prevZ: number,
  maxStep: number,
): void {
  if (maxStep <= 0) {
    position.x = prevX
    position.y = prevY
    position.z = prevZ
    return
  }
  const dx = position.x - prevX
  const dy = position.y - prevY
  const dz = position.z - prevZ
  const len = Math.hypot(dx, dy, dz)
  if (len <= maxStep || len <= 1e-8) {
    return
  }
  const s = maxStep / len
  position.x = prevX + dx * s
  position.y = prevY + dy * s
  position.z = prevZ + dz * s
}

export class EnemyMovementManager {
  private readonly _synchronized = new SynchronizedLerpStrategy()
  private readonly _straight = new LateralFlybyStrategy('straight')
  private readonly _engage = new LateralFlybyStrategy('engage')
  private readonly _flee = new LateralFlybyStrategy('flee')
  private readonly _loop = new LoopAroundStrategy()
  private _active: EnemyMoveStrategy = this._synchronized
  private readonly _facing: FacingState = { current: 0, desired: 0 }
  private _loopParams: LoopAroundParams | null = null
  private _turnRateRad = (DEFAULT_TURN_RATE_DEG * Math.PI) / 180
  private readonly _ctx: MutableMoveContext

  constructor() {
    this._ctx = {
      position: { x: 0, y: 0, z: 0 },
      facing: this._facing,
      dt: 0,
      currentSpeed: 0,
      target: { x: 0, y: 0, z: 0 },
      arriveRadius: 0,
      agilityLambda: 1,
      turnToward: (desired: number) => this._turnToward(desired),
    }
  }

  strategyId(): MoveStrategyId {
    return this._active.id
  }

  /** Smoothed heading (radians; 0 = +Z). Nose, travel and muzzle share it. */
  facingY(): number {
    return this._facing.current
  }

  desiredFacingY(): number {
    return this._facing.desired
  }

  setLoopParams(params: LoopAroundParams): void {
    this._loopParams = params
  }

  /** Max angular speed of the nose (degrees / sec). */
  setTurnRate(degPerSec: number): void {
    this._turnRateRad = (Math.max(1, degPerSec) * Math.PI) / 180
  }

  setStrategy(id: MoveStrategyId): void {
    if (id === 'synchronizedLerp') {
      this._active = this._synchronized
    } else if (id === 'engage') {
      this._active = this._engage
    } else if (id === 'flee') {
      this._active = this._flee
    } else if (id === 'loop_around') {
      this._active = this._loop
    } else {
      this._active = this._straight
    }
  }

  beginJourney(
    from: Readonly<Vec3>,
    to: Readonly<Vec3>,
    cruiseSpeed: number,
    pathSide?: ReachPreviewSide,
  ): void {
    this._active.begin(from, to, cruiseSpeed, pathSide, this._loopParams ?? undefined)
  }

  update(input: MoveContextInput): { arrived: boolean } {
    const ctx = this._ctx
    ctx.position = input.position
    ctx.dt = input.dt
    ctx.currentSpeed = input.currentSpeed
    ctx.target = input.target
    ctx.arriveRadius = input.arriveRadius
    ctx.agilityLambda = input.agilityLambda
    return this._active.update(ctx)
  }

  reset(): void {
    this._synchronized.reset()
    this._straight.reset()
    this._engage.reset()
    this._flee.reset()
    this._loop.reset()
    this._active = this._synchronized
    this._facing.current = 0
    this._facing.desired = 0
  }

  private _turnToward(desired: number): number {
    this._facing.desired = desired
    const lambda = Math.max(0.5, this._ctx.agilityLambda * TURN_DAMP_SCALE)
    this._facing.current = dampAngle(
      this._facing.current,
      desired,
      lambda,
      this._ctx.dt,
      this._turnRateRad,
    )
    return this._facing.current
  }
}
