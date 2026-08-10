import * as THREE from 'three'

export interface FollowBoxConfig {
  color: number
  opacity: number
  y: number
}

export interface FollowBox {
  group: THREE.LineLoop
  update(center: { x: number; z: number }, halfX: number, halfZ: number): void
  setVisible(visible: boolean): void
  dispose(): void
}

export function createFollowBox(config: FollowBoxConfig, scene: THREE.Scene): FollowBox {
  const positions = new Float32Array(12)
  const geometry = new THREE.BufferGeometry()
  const attr = new THREE.BufferAttribute(positions, 3)
  geometry.setAttribute('position', attr)

  const material = new THREE.LineBasicMaterial({
    color: config.color,
    transparent: true,
    opacity: config.opacity,
  })

  const loop = new THREE.LineLoop(geometry, material)
  loop.frustumCulled = false
  loop.visible = false
  scene.add(loop)

  return {
    group: loop,
    update(center: { x: number; z: number }, halfX: number, halfZ: number): void {
      positions[0] = center.x - halfX
      positions[1] = config.y
      positions[2] = center.z - halfZ
      positions[3] = center.x + halfX
      positions[4] = config.y
      positions[5] = center.z - halfZ
      positions[6] = center.x + halfX
      positions[7] = config.y
      positions[8] = center.z + halfZ
      positions[9] = center.x - halfX
      positions[10] = config.y
      positions[11] = center.z + halfZ
      attr.needsUpdate = true
    },
    setVisible(visible: boolean): void {
      loop.visible = visible
    },
    dispose(): void {
      scene.remove(loop)
      geometry.dispose()
      material.dispose()
    },
  }
}