import * as THREE from 'three'

export interface ShipVisual {
  size: { w: number; h: number; d: number }
  wireframeColor: number
  accentColor: number
  thrusterColor: number
}

export interface ShipTransform {
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  scale: number
}

export interface Ship {
  group: THREE.Group
  applyTransform(transform: ShipTransform): void
  update(dt: number): void
  dispose(): void
}

const DEG2RAD = Math.PI / 180

export function createShip(visual: ShipVisual, scene: THREE.Scene): Ship {
  const group = new THREE.Group()

  const hullGeo = new THREE.BoxGeometry(visual.size.w, visual.size.h, visual.size.d)
  const hullMat = new THREE.MeshBasicMaterial({
    color: visual.wireframeColor,
    wireframe: true,
    transparent: true,
    opacity: 0.9,
  })
  const hull = new THREE.Mesh(hullGeo, hullMat)
  group.add(hull)

  const accentGeo = new THREE.BoxGeometry(visual.size.w * 0.82, visual.size.h * 0.82, visual.size.d * 0.82)
  const accentMat = new THREE.MeshBasicMaterial({
    color: visual.accentColor,
    wireframe: true,
    transparent: true,
    opacity: 0.45,
  })
  const accent = new THREE.Mesh(accentGeo, accentMat)
  group.add(accent)

  const thrusterGeo = new THREE.ConeGeometry(visual.size.w * 0.28, 1.1, 8)
  thrusterGeo.rotateX(Math.PI / 2)
  const thrusterMat = new THREE.MeshBasicMaterial({
    color: visual.thrusterColor,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const thruster = new THREE.Mesh(thrusterGeo, thrusterMat)
  thruster.position.z = visual.size.d / 2 + 0.55
  thruster.scale.setScalar(0.001)
  group.add(thruster)

  scene.add(group)

  let time = 0
  return {
    group,
    applyTransform(transform: ShipTransform): void {
      group.position.set(transform.position.x, transform.position.y, transform.position.z)
      group.rotation.set(
        transform.rotation.x * DEG2RAD,
        transform.rotation.y * DEG2RAD,
        transform.rotation.z * DEG2RAD,
      )
      group.scale.setScalar(transform.scale)
    },
    update(dt: number): void {
      time += dt
      const flicker = 0.72 + 0.28 * Math.sin(time * 42) * Math.sin(time * 13 + 1.3)
      thruster.scale.set(1, flicker, 1)
    },
    dispose(): void {
      scene.remove(group)
      hullGeo.dispose()
      hullMat.dispose()
      accentGeo.dispose()
      accentMat.dispose()
      thrusterGeo.dispose()
      thrusterMat.dispose()
    },
  }
}