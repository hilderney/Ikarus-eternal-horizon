import type { CameraConfig } from '../gameobjects/cameraRig'
import type { InputState } from '../core/input'

export interface CameraControlConfig {
  moveSpeed: number
  rotSpeed: number
  keys: {
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
}

const has = (input: InputState, ...codes: Array<string | string[]>): boolean =>
  codes.flat().some((c) => input.keys.has(c))

export function updateCameraFromInput(
  input: InputState,
  config: CameraConfig,
  control: CameraControlConfig,
  dt: number,
): void {
  const { keys } = control

  const dz = (has(input, keys.moveZPlus) ? 1 : 0) - (has(input, keys.moveZMinus) ? 1 : 0)
  const dx = (has(input, keys.moveXPlus) ? 1 : 0) - (has(input, keys.moveXMinus) ? 1 : 0)
  const dy = (has(input, keys.moveYPlus) ? 1 : 0) - (has(input, keys.moveYMinus) ? 1 : 0)

  config.position.x += dx * control.moveSpeed * dt
  config.position.y += dy * control.moveSpeed * dt
  config.position.z += dz * control.moveSpeed * dt

  updateCameraRotationFromInput(input, config, control, dt)
}

export function updateCameraRotationFromInput(
  input: InputState,
  config: CameraConfig,
  control: CameraControlConfig,
  dt: number,
): void {
  const { keys } = control
  const drx = (has(input, keys.rotXPlus) ? 1 : 0) - (has(input, keys.rotXMinus) ? 1 : 0)
  const dry = (has(input, keys.rotYPlus) ? 1 : 0) - (has(input, keys.rotYMinus) ? 1 : 0)
  const drz = (has(input, keys.rotZPlus) ? 1 : 0) - (has(input, keys.rotZMinus) ? 1 : 0)

  config.rotation.x += drx * control.rotSpeed * dt
  config.rotation.y += dry * control.rotSpeed * dt
  config.rotation.z += drz * control.rotSpeed * dt
}