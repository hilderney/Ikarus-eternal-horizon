/**
 * SDD-C02 CameraController — IJKL/UO debug rig. Keyboard only.
 */

import type { InputPort } from '../../core/input'

export interface CameraKeys {
  readonly moveZPlus: string
  readonly moveZMinus: string
  readonly moveXMinus: string
  readonly moveXPlus: string
  readonly moveYPlus: string
  readonly moveYMinus: string
  readonly rotXPlus: string
  readonly rotXMinus: string
  readonly rotZPlus: string
  readonly rotZMinus: string
  readonly rotYPlus: string
  readonly rotYMinus: string
}

export interface CameraControlConfig {
  readonly moveSpeed: number
  readonly rotSpeed: number
  readonly keys: CameraKeys
}

export interface CameraPose {
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
}

export interface CameraControllerOptions {
  readonly input: InputPort
  readonly pose: CameraPose
  readonly config: CameraControlConfig
}

function axisFrom(input: InputPort, plus: string, minus: string): number {
  return (input.isDown(plus) ? 1 : 0) - (input.isDown(minus) ? 1 : 0)
}

export class CameraController {
  private readonly _input: InputPort
  private readonly _pose: CameraPose
  private readonly _config: CameraControlConfig
  private _disposed = false

  constructor(options: CameraControllerOptions) {
    this._input = options.input
    this._pose = options.pose
    this._config = options.config
  }

  update(dt: number): void {
    if (this._disposed) {
      return
    }
    const keys = this._config.keys
    const move = this._config.moveSpeed * dt
    const rot = this._config.rotSpeed * dt
    this._pose.position.x += axisFrom(this._input, keys.moveXPlus, keys.moveXMinus) * move
    this._pose.position.y += axisFrom(this._input, keys.moveYPlus, keys.moveYMinus) * move
    this._pose.position.z += axisFrom(this._input, keys.moveZPlus, keys.moveZMinus) * move
    this._pose.rotation.x += axisFrom(this._input, keys.rotXPlus, keys.rotXMinus) * rot
    this._pose.rotation.y += axisFrom(this._input, keys.rotYPlus, keys.rotYMinus) * rot
    this._pose.rotation.z += axisFrom(this._input, keys.rotZPlus, keys.rotZMinus) * rot
  }

  dispose(): void {
    this._disposed = true
  }
}
