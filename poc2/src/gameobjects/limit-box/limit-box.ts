/**
 * SDD-B03 LimitBox — dead-zone follow, bounce, auto-recenter (POC-1 port).
 */

import { BufferAttribute, BufferGeometry, Group, Line, LineBasicMaterial, LineLoop, LineSegments } from 'three'
import type { Material } from 'three'
import { clamp, damp } from '../../core/math'

export interface Vec3Params {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface BounceConfig {
  readonly timeMs: number
}

export interface RecenterConfig {
  readonly delayMs: number
  readonly stillMs: number
  readonly accel: number
  readonly maxSpeed: number
}

export interface FollowConfig {
  readonly halfX: number
  readonly halfZ: number
  readonly bounce: BounceConfig
  readonly recenter: RecenterConfig
}

export interface FollowBoxVisualConfig {
  readonly color: number
  readonly opacity: number
  readonly position: Vec3Params
  readonly centerLine: { readonly color: number; readonly opacity: number }
  readonly restLine: {
    readonly color: number
    readonly opacity: number
    readonly position: Vec3Params
    readonly width: number
    readonly height: number
  }
}

export interface LimitBoxOptions {
  readonly follow: FollowConfig
  readonly visual: FollowBoxVisualConfig
  readonly cameraConfig: { position: { x: number; y: number; z: number } }
}

export interface ShipPosition {
  readonly x: number
  readonly z: number
}

export interface LimitBoxPort {
  update(ship: ShipPosition, dt: number): void
  syncRender(): void
  setVisible(visible: boolean): void
  restLineVisible(): boolean
  setRestLineVisible(visible: boolean): void
  dispose(): void
}

const MOVE_EPS = 0.01
const CENTER_EPS = 0.25

interface AxisRef {
  last: number
  anchor: number
}

interface AxisState {
  centering: boolean
  interrupted: boolean
  velocity: number
  delayMs: number
  stillMs: number
}

function newAxisState(): AxisState {
  return {
    centering: false,
    interrupted: false,
    velocity: 0,
    delayMs: 0,
    stillMs: 0,
  }
}

function edgeTarget(value: number, centre: number, half: number): number {
  if (value - centre > half) {
    return value - half
  }
  if (value - centre < -half) {
    return value + half
  }
  return centre
}

function settleRate(ms: number): number {
  return ms <= 0 ? Number.POSITIVE_INFINITY : -Math.log(0.02) / (ms / 1000)
}

function disposeMaterial(material: Material | Material[]): void {
  if (Array.isArray(material)) {
    for (const item of material) {
      item.dispose()
    }
    return
  }
  material.dispose()
}

function updateAxis(
  ref: AxisRef,
  ship: number,
  half: number,
  restOffset: number,
  state: AxisState,
  zone: FollowConfig,
  dt: number,
): void {
  const moving = Math.abs(ship - ref.last) > MOVE_EPS
  ref.last = ship

  const rate = settleRate(zone.bounce.timeMs)
  if (!state.centering) {
    ref.anchor = damp(ref.anchor, edgeTarget(ship, ref.anchor, half), rate, dt)
  }

  const rest = ship - restOffset
  const err = rest - ref.anchor
  const off = Math.abs(err)

  if (state.centering) {
    if (moving) {
      state.centering = false
      state.interrupted = true
      state.stillMs = 0
      state.velocity = 0
    } else {
      state.velocity += Math.sign(err) * zone.recenter.accel * dt
      const maxSafe = Math.min(zone.recenter.maxSpeed, off * 5)
      state.velocity = clamp(state.velocity, -maxSafe, maxSafe)
      ref.anchor += state.velocity * dt
      if (off < CENTER_EPS) {
        state.centering = false
        state.velocity = 0
        state.delayMs = 0
      }
    }
  } else if (state.interrupted) {
    state.stillMs += dt * 1000
    if (moving) {
      state.stillMs = 0
    }
    if (state.stillMs >= zone.recenter.stillMs) {
      state.interrupted = false
      state.delayMs = 0
    }
  }

  if (!state.centering && !state.interrupted && off > CENTER_EPS) {
    state.delayMs += dt * 1000
    if (moving) {
      state.delayMs = 0
    }
    if (state.delayMs >= zone.recenter.delayMs) {
      state.centering = true
      state.velocity = 0
      state.delayMs = 0
    }
  } else {
    state.delayMs = 0
  }
}

export class LimitBox implements LimitBoxPort {
  readonly group: Group
  readonly anchor: { x: number; z: number }

  private readonly _follow: FollowConfig
  private readonly _visual: FollowBoxVisualConfig
  private readonly _cameraConfig: { position: { x: number; y: number; z: number } }
  private readonly _axisX: AxisRef
  private readonly _axisZ: AxisRef
  private readonly _stateX: AxisState
  private readonly _stateZ: AxisState
  private readonly _loop: LineLoop
  private readonly _centerLine: Line
  private readonly _restLine: LineSegments
  private readonly _loopPositions: Float32Array
  private readonly _centerPositions: Float32Array
  private readonly _restPositions: Float32Array
  private readonly _loopAttr: BufferAttribute
  private readonly _centerAttr: BufferAttribute
  private readonly _restAttr: BufferAttribute
  private _disposed = false

  constructor(options: LimitBoxOptions) {
    this._follow = options.follow
    this._visual = options.visual
    this._cameraConfig = options.cameraConfig
    this.anchor = { x: options.visual.position.x, z: options.visual.position.z }
    this._axisX = { last: this.anchor.x, anchor: this.anchor.x }
    this._axisZ = { last: this.anchor.z, anchor: this.anchor.z }
    this._stateX = newAxisState()
    this._stateZ = newAxisState()

    this.group = new Group()
    this._loopPositions = new Float32Array(12)
    this._loopAttr = new BufferAttribute(this._loopPositions, 3)
    const loopGeo = new BufferGeometry()
    loopGeo.setAttribute('position', this._loopAttr)
    this._loop = new LineLoop(
      loopGeo,
      new LineBasicMaterial({
        color: options.visual.color,
        transparent: true,
        opacity: options.visual.opacity,
      }),
    )
    this._loop.frustumCulled = false

    this._centerPositions = new Float32Array(6)
    this._centerAttr = new BufferAttribute(this._centerPositions, 3)
    const centerGeo = new BufferGeometry()
    centerGeo.setAttribute('position', this._centerAttr)
    this._centerLine = new Line(
      centerGeo,
      new LineBasicMaterial({
        color: options.visual.centerLine.color,
        transparent: true,
        opacity: options.visual.centerLine.opacity,
      }),
    )
    this._centerLine.frustumCulled = false

    this._restPositions = new Float32Array(12)
    this._restAttr = new BufferAttribute(this._restPositions, 3)
    const restGeo = new BufferGeometry()
    restGeo.setAttribute('position', this._restAttr)
    this._restLine = new LineSegments(
      restGeo,
      new LineBasicMaterial({
        color: options.visual.restLine.color,
        transparent: true,
        opacity: options.visual.restLine.opacity,
      }),
    )
    this._restLine.frustumCulled = false

    this.group.add(this._loop, this._centerLine, this._restLine)
  }

  update(ship: ShipPosition, dt: number): void {
    const axStart = this._axisX.anchor
    const azStart = this._axisZ.anchor
    updateAxis(
      this._axisX,
      ship.x,
      this._follow.halfX,
      this._visual.restLine.position.x,
      this._stateX,
      this._follow,
      dt,
    )
    updateAxis(
      this._axisZ,
      ship.z,
      this._follow.halfZ,
      this._visual.restLine.position.z + this._follow.halfZ,
      this._stateZ,
      this._follow,
      dt,
    )
    this.anchor.x = this._axisX.anchor
    this.anchor.z = this._axisZ.anchor
    this._cameraConfig.position.x += this._axisX.anchor - axStart
    this._cameraConfig.position.z += this._axisZ.anchor - azStart
  }

  syncRender(): void {
    const y = this._visual.position.y
    const { x, z } = this.anchor
    const halfX = this._follow.halfX
    const halfZ = this._follow.halfZ
    const p = this._loopPositions
    p[0] = x - halfX
    p[1] = y
    p[2] = z - halfZ
    p[3] = x + halfX
    p[4] = y
    p[5] = z - halfZ
    p[6] = x + halfX
    p[7] = y
    p[8] = z + halfZ
    p[9] = x - halfX
    p[10] = y
    p[11] = z + halfZ
    this._loopAttr.needsUpdate = true

    const c = this._centerPositions
    c[0] = x
    c[1] = y
    c[2] = z - halfZ
    c[3] = x
    c[4] = y
    c[5] = z + halfZ
    this._centerAttr.needsUpdate = true

    const restZ = z + halfZ + this._visual.restLine.position.z
    const restX = x + this._visual.restLine.position.x
    const restY = y + this._visual.restLine.position.y
    const halfH = this._visual.restLine.height / 2
    const halfW = this._visual.restLine.width / 2
    const r = this._restPositions
    r[0] = restX - halfW
    r[1] = restY
    r[2] = restZ
    r[3] = restX + halfW
    r[4] = restY
    r[5] = restZ
    r[6] = restX
    r[7] = restY - halfH
    r[8] = restZ
    r[9] = restX
    r[10] = restY + halfH
    r[11] = restZ
    this._restAttr.needsUpdate = true
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible
    this._loop.visible = visible
    this._centerLine.visible = visible
    this._restLine.visible = visible
  }

  restLineVisible(): boolean {
    return this._restLine.visible
  }

  setRestLineVisible(visible: boolean): void {
    this._restLine.visible = visible
  }

  dispose(): void {
    if (this._disposed) {
      return
    }
    this._disposed = true
    this._loop.geometry.dispose()
    disposeMaterial(this._loop.material)
    this._centerLine.geometry.dispose()
    disposeMaterial(this._centerLine.material)
    this._restLine.geometry.dispose()
    disposeMaterial(this._restLine.material)
    this.group.clear()
  }
}
