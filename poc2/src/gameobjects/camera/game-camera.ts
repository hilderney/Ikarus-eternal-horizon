/**
 * SDD-B01 GameCamera — mounts a PerspectiveCamera (YXZ), applyConfig in degrees.
 */

import { PerspectiveCamera } from 'three'
import { DEG2RAD } from '../../core/math'

export interface Vec3Params {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface CameraConfig {
  readonly fov: number
  readonly position: Vec3Params
  readonly rotation: Vec3Params
  readonly near: number
  readonly far: number
  readonly aspect: number
}

export interface GameCameraPort {
  readonly camera: PerspectiveCamera
  applyConfig(config: CameraConfig): void
  syncRender(): void
  dispose(): void
}

export class GameCamera implements GameCameraPort {
  readonly camera: PerspectiveCamera
  private _config: CameraConfig

  constructor(config: CameraConfig) {
    this.camera = new PerspectiveCamera(config.fov, config.aspect, config.near, config.far)
    this.camera.rotation.order = 'YXZ'
    this._config = config
    this.applyConfig(config)
  }

  applyConfig(config: CameraConfig): void {
    this._config = config
    this.camera.fov = config.fov
    this.camera.near = config.near
    this.camera.far = config.far
    this.camera.aspect = config.aspect
    this.camera.updateProjectionMatrix()
    this.camera.position.set(config.position.x, config.position.y, config.position.z)
    this.camera.rotation.set(
      config.rotation.x * DEG2RAD,
      config.rotation.y * DEG2RAD,
      config.rotation.z * DEG2RAD,
    )
  }

  update(dt: number): void {
    void dt
  }

  syncRender(): void {
    this.applyConfig(this._config)
  }

  dispose(): void {
    // PerspectiveCamera has no geometry/material. Owner removes from the scene.
  }
}
