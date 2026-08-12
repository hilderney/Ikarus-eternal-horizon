import * as THREE from 'three'

export interface FollowBoxConfig {
  color: number
  opacity: number
  y: number
  centerLine: { color: number; opacity: number }
  restLine: {
    color: number
    opacity: number
    position: { x: number; y: number; z: number }
    width: number
    height: number
  }
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

  const centerPositions = new Float32Array(6)
  const centerGeometry = new THREE.BufferGeometry()
  const centerAttr = new THREE.BufferAttribute(centerPositions, 3)
  centerGeometry.setAttribute('position', centerAttr)

  const centerMaterial = new THREE.LineBasicMaterial({
    color: config.centerLine.color,
    transparent: true,
    opacity: config.centerLine.opacity,
  })

  const centerLine = new THREE.Line(centerGeometry, centerMaterial)
  centerLine.frustumCulled = false
  centerLine.visible = false
  scene.add(centerLine)

  const restPositions = new Float32Array(12)
  const restGeometry = new THREE.BufferGeometry()
  const restAttr = new THREE.BufferAttribute(restPositions, 3)
  restGeometry.setAttribute('position', restAttr)

  const restMaterial = new THREE.LineBasicMaterial({
    color: config.restLine.color,
    transparent: true,
    opacity: config.restLine.opacity,
  })

  const restLine = new THREE.LineSegments(restGeometry, restMaterial)
  restLine.frustumCulled = false
  restLine.visible = false
  scene.add(restLine)

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

      centerPositions[0] = center.x
      centerPositions[1] = config.y
      centerPositions[2] = center.z - halfZ
      centerPositions[3] = center.x
      centerPositions[4] = config.y
      centerPositions[5] = center.z + halfZ
      centerAttr.needsUpdate = true

      const restZ = center.z + halfZ + config.restLine.position.z
      const restX = center.x + config.restLine.position.x
      const restY = config.y + config.restLine.position.y
      const halfH = config.restLine.height / 2
      const halfW = config.restLine.width / 2
      restPositions[0] = restX - halfW
      restPositions[1] = restY
      restPositions[2] = restZ
      restPositions[3] = restX + halfW
      restPositions[4] = restY
      restPositions[5] = restZ
      restPositions[6] = restX
      restPositions[7] = restY - halfH
      restPositions[8] = restZ
      restPositions[9] = restX
      restPositions[10] = restY + halfH
      restPositions[11] = restZ
      restAttr.needsUpdate = true
    },
    setVisible(visible: boolean): void {
      loop.visible = visible
      centerLine.visible = visible
      restLine.visible = visible
    },
    dispose(): void {
      scene.remove(loop)
      scene.remove(centerLine)
      scene.remove(restLine)
      geometry.dispose()
      material.dispose()
      centerGeometry.dispose()
      centerMaterial.dispose()
      restGeometry.dispose()
      restMaterial.dispose()
    },
  }
}