import type { InputState } from '../core/input'
import type { CameraConfig } from '../gameobjects/cameraRig'
import type { ShipTransform } from '../gameobjects/ship'

export interface ShipKeys {
  moveXMinus: string
  moveXPlus: string
  moveZMinus: string
  moveZPlus: string
}

export interface ShipMotionConfig {
  maxSpeed: number
  accel: number
  decel: number
  brake: number
}

export interface ShipTiltConfig {
  axis: 'y' | 'z'
  sign: 1 | -1
  maxDeg: number
  riseMs: number
  fallMs: number
}

export interface CameraKeys {
  moveZPlus: string | string[]
  moveZMinus: string | string[]
  moveXMinus: string | string[]
  moveXPlus: string | string[]
  moveYPlus: string | string[]
  moveYMinus: string | string[]
  rotXPlus: string | string[]
  rotXMinus: string | string[]
  rotZPlus: string | string[]
  rotZMinus: string | string[]
  rotYPlus: string | string[]
  rotYMinus: string | string[]
}

export interface CameraControlConfig {
  moveSpeed: number
  rotSpeed: number
  keys: CameraKeys
}

export interface ControllersConfig {
  shipKeys: ShipKeys
  motion: ShipMotionConfig
  tilt: ShipTiltConfig
  camera: CameraControlConfig
}

export interface Controllers {
  update(dt: number): void
}

const has = (input: InputState, ...codes: Array<string | string[]>): boolean =>
  codes.flat().some((c) => input.keys.has(c))

const pushVelocity = (
  velocity: number,
  direction: number,
  force: number,
  maxSpeed: number,
  dt: number,
): number => {
  const next = velocity + direction * force * dt
  const capped = Math.min(Math.abs(next), maxSpeed)
  return next === 0 ? 0 : Math.sign(next) * capped
}

const coastToZero = (velocity: number, rate: number, dt: number): number => {
  const step = rate * dt
  if (velocity > 0) return Math.max(0, velocity - step)
  if (velocity < 0) return Math.min(0, velocity + step)
  return 0
}

const axisVelocity = (
  velocity: number,
  direction: number,
  motion: ShipMotionConfig,
  dt: number,
): number => {
  if (direction === 0) return coastToZero(velocity, motion.decel, dt)

  const brakingAgainst = Math.sign(velocity) !== direction && velocity !== 0
  const force = brakingAgainst ? motion.brake : motion.accel
  return pushVelocity(velocity, direction, force, motion.maxSpeed, dt)
}

export function createControllers(
  config: ControllersConfig,
  shipTransform: ShipTransform,
  cameraConfig: CameraConfig,
  input: InputState,
): Controllers {
  let vx = 0
  let vz = 0
  let tiltCur = 0

  return {
    update(dt: number): void {
      const sk = config.shipKeys
      const dirX = (has(input, sk.moveXPlus) ? 1 : 0) - (has(input, sk.moveXMinus) ? 1 : 0)
      const dirZ = (has(input, sk.moveZPlus) ? 1 : 0) - (has(input, sk.moveZMinus) ? 1 : 0)

      vx = axisVelocity(vx, dirX, config.motion, dt)
      vz = axisVelocity(vz, dirZ, config.motion, dt)

      shipTransform.position.x += vx * dt
      shipTransform.position.z += vz * dt

      const targetTilt = dirX * config.tilt.maxDeg * config.tilt.sign
      const tiltRate = targetTilt > tiltCur
        ? config.tilt.maxDeg / (config.tilt.riseMs / 1000)
        : config.tilt.maxDeg / (config.tilt.fallMs / 1000)
      const step = tiltRate * dt
      tiltCur =
        targetTilt > tiltCur
          ? Math.min(targetTilt, tiltCur + step)
          : Math.max(targetTilt, tiltCur - step)
      if (config.tilt.axis === 'y') {
        shipTransform.rotation.y = tiltCur
      } else {
        shipTransform.rotation.z = tiltCur
      }

      const ck = config.camera.keys
      const dz = (has(input, ck.moveZPlus) ? 1 : 0) - (has(input, ck.moveZMinus) ? 1 : 0)
      const dx = (has(input, ck.moveXPlus) ? 1 : 0) - (has(input, ck.moveXMinus) ? 1 : 0)
      const dy = (has(input, ck.moveYPlus) ? 1 : 0) - (has(input, ck.moveYMinus) ? 1 : 0)
      cameraConfig.position.x += dx * config.camera.moveSpeed * dt
      cameraConfig.position.y += dy * config.camera.moveSpeed * dt
      cameraConfig.position.z += dz * config.camera.moveSpeed * dt

      const drx = (has(input, ck.rotXPlus) ? 1 : 0) - (has(input, ck.rotXMinus) ? 1 : 0)
      const dry = (has(input, ck.rotYPlus) ? 1 : 0) - (has(input, ck.rotYMinus) ? 1 : 0)
      const drz = (has(input, ck.rotZPlus) ? 1 : 0) - (has(input, ck.rotZMinus) ? 1 : 0)
      cameraConfig.rotation.x += drx * config.camera.rotSpeed * dt
      cameraConfig.rotation.y += dry * config.camera.rotSpeed * dt
      cameraConfig.rotation.z += drz * config.camera.rotSpeed * dt
    },
  }
}