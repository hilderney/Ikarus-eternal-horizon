import * as THREE from 'three'

export interface BeamVisual {
  readonly group: THREE.Group
  show(muzzle: { x: number; y: number; z: number }, length: number, width: number, color: number): void
  hide(): void
  dispose(): void
}

export function createBeamVisual(initialColor: number, scene: THREE.Scene): BeamVisual {
  const group = new THREE.Group()
  const geo = new THREE.BoxGeometry(1, 1, 1)
  const mat = new THREE.MeshBasicMaterial({
    color: initialColor,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(geo, mat)
  group.add(mesh)
  group.visible = false
  scene.add(group)

  return {
    group,
    show(muzzle, length, width, color) {
      mat.color.setHex(color)
      mesh.scale.set(width, width, length)
      group.position.set(muzzle.x, muzzle.y, muzzle.z - length / 2)
      group.visible = true
    },
    hide() {
      group.visible = false
    },
    dispose() {
      scene.remove(group)
      geo.dispose()
      mat.dispose()
    },
  }
}