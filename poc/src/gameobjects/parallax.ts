import * as THREE from 'three'

export interface ParallaxLayerConfig {
  name: string
  count: number
  speed: number
  speedJitter: number
  parallaxGain: number
  size: number
  color: number
  alpha: number
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  gridSize: number
  gridColor: number
  gridOpacity: number
  zNearWrap: number
  zFar: number
}

export interface ParallaxLayer {
  update(dt: number, camera: THREE.PerspectiveCamera): void
  applyConfig(config: ParallaxLayerConfig): void
  destroy(): void
}

const rand = (min: number, max: number): number => min + Math.random() * (max - min)
const degToRad = (deg: number): number => (deg * Math.PI) / 180

export function createParallaxLayer(
  config: ParallaxLayerConfig,
  scene: THREE.Scene,
): ParallaxLayer {
  const group = new THREE.Group()
  scene.add(group)

  let cfg: ParallaxLayerConfig = config
  let positions: Float32Array
  let speeds: Float32Array
  let geometry: THREE.BufferGeometry
  let material: THREE.PointsMaterial
  let points: THREE.Points
  let grid: THREE.GridHelper

  let hasLastCam = false
  let lastCamX = 0
  let lastCamY = 0
  let lastCamZ = 0

  function initGrid(): void {
    const size = cfg.gridSize
    const divisions = Math.max(2, Math.round(size / 6))
    grid = new THREE.GridHelper(size, divisions, cfg.gridColor, cfg.gridColor)
    const gm = grid.material as THREE.Material
    gm.transparent = true
    gm.opacity = cfg.gridOpacity
    gm.depthWrite = false
    group.add(grid)
  }

  function initPoints(): void {
    positions = new Float32Array(cfg.count * 3)
    speeds = new Float32Array(cfg.count)
    for (let i = 0; i < cfg.count; i++) {
      resetPoint(i)
    }

    geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    material = new THREE.PointsMaterial({
      color: cfg.color,
      size: cfg.size,
      sizeAttenuation: true,
      transparent: true,
      opacity: cfg.alpha,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    points = new THREE.Points(geometry, material)
    group.add(points)
  }

  function resetPoint(i: number): void {
    const o = i * 3
    positions[o] = rand(-cfg.gridSize / 2, cfg.gridSize / 2)
    positions[o + 1] = rand(-cfg.gridSize * 0.25, cfg.gridSize * 0.25)
    positions[o + 2] = rand(cfg.zNearWrap, cfg.zFar)
    speeds[i] = 1 + rand(-cfg.speedJitter, cfg.speedJitter)
  }

  initGrid()
  initPoints()

  function dispose(): void {
    geometry.dispose()
    material.dispose()
    grid.geometry.dispose()
    ;(grid.material as THREE.Material).dispose()
  }

  return {
    update(dt: number, camera: THREE.PerspectiveCamera): void {
      const camPos = camera.position
      if (!hasLastCam) {
        lastCamX = camPos.x
        lastCamY = camPos.y
        lastCamZ = camPos.z
        hasLastCam = true
      }
      const camDX = camPos.x - lastCamX
      const camDY = camPos.y - lastCamY
      const camDZ = camPos.z - lastCamZ
      lastCamX = camPos.x
      lastCamY = camPos.y
      lastCamZ = camPos.z

      const zv = cfg.speed
      const gain = cfg.parallaxGain
      const halfW = cfg.gridSize / 2
      const halfH = cfg.gridSize * 0.25

      for (let i = 0; i < cfg.count; i++) {
        const o = i * 3
        positions[o] -= camDX * gain * speeds[i]
        positions[o + 1] -= camDY * gain * speeds[i]
        positions[o + 2] -= camDZ * gain * speeds[i]

        if (positions[o] > halfW) {
          positions[o] -= cfg.gridSize
        } else if (positions[o] < -halfW) {
          positions[o] += cfg.gridSize
        }
        if (positions[o + 1] > halfH) {
          positions[o + 1] -= cfg.gridSize * 0.5
        } else if (positions[o + 1] < -halfH) {
          positions[o + 1] += cfg.gridSize * 0.5
        }

        positions[o + 2] += zv * speeds[i] * dt
        if (positions[o + 2] > cfg.zNearWrap) {
          resetPoint(i)
        }
      }
      ;(geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true

      group.position.set(
        camPos.x + cfg.position.x,
        camPos.y + cfg.position.y,
        camPos.z + cfg.position.z,
      )
      group.rotation.set(
        degToRad(cfg.rotation.x),
        degToRad(cfg.rotation.y),
        degToRad(cfg.rotation.z),
      )
    },
    applyConfig(next: ParallaxLayerConfig): void {
      cfg = next
      group.remove(grid)
      grid.geometry.dispose()
      ;(grid.material as THREE.Material).dispose()
      initGrid()

      if (positions.length !== cfg.count * 3) {
        group.remove(points)
        geometry.dispose()
        material.dispose()
        initPoints()
      } else {
        const posAttr = geometry.attributes.position as THREE.BufferAttribute
        for (let i = 0; i < cfg.count; i++) {
          const o = i * 3
          const current = posAttr.array[o + 2] as number
          if (current < Math.min(cfg.zNearWrap, cfg.zFar)) {
            resetPoint(i)
          }
        }
      }
      material.color.set(cfg.color)
      material.size = cfg.size
      material.opacity = cfg.alpha
    },
    destroy(): void {
      dispose()
      scene.remove(group)
    },
  }
}