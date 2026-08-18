import * as THREE from 'three'

export interface ConeVisual {
  readonly group: THREE.Group
  show(muzzle: { x: number; y: number; z: number }, length: number, angleRad: number, color: number): void
  hide(): void
  dispose(): void
}

export function createConeVisual(initialColor: number, scene: THREE.Scene): ConeVisual {
  const group = new THREE.Group()
  const geo = new THREE.ConeGeometry(1, 1, 12, 1, true)
  geo.rotateX(Math.PI / 2)
  const mat = new THREE.MeshBasicMaterial({
    color: initialColor,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(geo, mat)
  group.add(mesh)
  group.visible = false
  scene.add(group)

  return {
    group,
    show(muzzle, length, angleRad, color) {
      mat.color.setHex(color)
      const radius = Math.tan(angleRad) * length
      mesh.scale.set(radius, radius, length)
      mesh.position.y = 0
      mesh.position.z = -length / 2
      group.position.set(muzzle.x, muzzle.y, muzzle.z)
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