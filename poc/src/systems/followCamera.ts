import type { CameraConfig } from '../gameobjects/cameraRig'
import type { ShipTransform } from '../gameobjects/ship'

export interface BounceConfig {
  timeMs: number
}

export interface RecenterConfig {
  delayMs: number
  stillMs: number
  accel: number
  maxSpeed: number
}

export interface FollowConfig {
  halfX: number
  halfZ: number
  bounce: BounceConfig
  recenter: RecenterConfig
}

export interface RecenterPoint {
  x: number
  z: number
}

export interface CameraFollower {
  update(camera: CameraConfig, ship: ShipTransform, dt: number): void
}

const MOVE_EPS = 0.01
const CENTER_EPS = 0.25
const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v))

const edgeTarget = (value: number, centre: number, half: number): number => {
  if (value - centre > half) return value - half
  if (value - centre < -half) return value + half
  return centre
}

const settleRate = (ms: number): number => (ms <= 0 ? Infinity : -Math.log(0.02) / (ms / 1000))
const settle = (current: number, target: number, rate: number, dt: number): number =>
  current + (target - current) * (1 - Math.exp(-rate * dt))

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

const newAxisState = (): AxisState => ({
  centering: false,
  interrupted: false,
  velocity: 0,
  delayMs: 0,
  stillMs: 0,
})

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
    ref.anchor = settle(ref.anchor, edgeTarget(ship, ref.anchor, half), rate, dt)
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
    if (moving) state.stillMs = 0
    if (state.stillMs >= zone.recenter.stillMs) {
      state.interrupted = false
      state.delayMs = 0
    }
  }

  if (!state.centering && !state.interrupted && off > CENTER_EPS) {
    state.delayMs += dt * 1000
    if (moving) state.delayMs = 0
    if (state.delayMs >= zone.recenter.delayMs) {
      state.centering = true
      state.velocity = 0
      state.delayMs = 0
    }
  } else {
    state.delayMs = 0
  }
}

export function createFollowCamera(
  zone: FollowConfig,
  anchor: { x: number; z: number },
  recenterPoint: RecenterPoint,
): CameraFollower {
  const axisX: AxisRef = { last: anchor.x, anchor: anchor.x }
  const axisZ: AxisRef = { last: anchor.z, anchor: anchor.z }
  const stateX = newAxisState()
  const stateZ = newAxisState()

  function update(camera: CameraConfig, ship: ShipTransform, dt: number): void {
    const axStart = axisX.anchor
    const azStart = axisZ.anchor

    updateAxis(axisX, ship.position.x, zone.halfX, recenterPoint.x, stateX, zone, dt)
    updateAxis(axisZ, ship.position.z, zone.halfZ, recenterPoint.z + zone.halfZ, stateZ, zone, dt)

    anchor.x = axisX.anchor
    anchor.z = axisZ.anchor

    camera.position.x += axisX.anchor - axStart
    camera.position.z += axisZ.anchor - azStart
  }

  return { update }
}