import type { CameraConfig } from '../gameobjects/cameraRig'
import type { ShipTransform } from '../gameobjects/ship'

export interface FollowConfig {
  halfX: number
  halfZ: number
}

export interface CameraFollower {
  update(camera: CameraConfig, ship: ShipTransform): void
}

export function createFollowCamera(
  zone: FollowConfig,
  anchor: { x: number; z: number },
): CameraFollower {
  function update(camera: CameraConfig, ship: ShipTransform): void {
    const sx = ship.position.x
    const sz = ship.position.z
    const ax = anchor.x
    const az = anchor.z

    let nx = ax
    let nz = az
    if (sx - ax > zone.halfX) {
      nx = sx - zone.halfX
    } else if (sx - ax < -zone.halfX) {
      nx = sx + zone.halfX
    }
    if (sz - az > zone.halfZ) {
      nz = sz - zone.halfZ
    } else if (sz - az < -zone.halfZ) {
      nz = sz + zone.halfZ
    }

    camera.position.x += nx - ax
    camera.position.z += nz - az
    anchor.x = nx
    anchor.z = nz
  }

  return { update }
}