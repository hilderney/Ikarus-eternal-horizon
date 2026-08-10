import * as THREE from 'three'

export interface CameraConfig {
  fov: number
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  near: number
  far: number
}

export interface CameraRig {
  camera: THREE.PerspectiveCamera
  applyConfig(config: CameraConfig): void
  dispose(): void
}

const DEG2RAD = Math.PI / 180

export function createCameraRig(config: CameraConfig, scene: THREE.Scene): CameraRig {
  const camera = new THREE.PerspectiveCamera(config.fov, 1, config.near, config.far)
  camera.rotation.order = 'YXZ'
  scene.add(camera)

  function applyConfig(cfg: CameraConfig): void {
    camera.fov = cfg.fov
    camera.near = cfg.near
    camera.far = cfg.far
    camera.updateProjectionMatrix()
    camera.position.set(cfg.position.x, cfg.position.y, cfg.position.z)
    camera.rotation.set(
      cfg.rotation.x * DEG2RAD,
      cfg.rotation.y * DEG2RAD,
      cfg.rotation.z * DEG2RAD,
    )
  }

  applyConfig(config)

  return {
    camera,
    applyConfig,
    dispose(): void {
      scene.remove(camera)
    },
  }
}