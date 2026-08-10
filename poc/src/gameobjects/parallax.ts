import * as THREE from 'three'

export interface ParallaxLayerConfig {
  name: string
  count: number
  speed: number
  speedJitter: number
  size: number
  color: number
  alpha: number
  xSpan: number
  layerY: number
  zNearWrap: number
  zFar: number
  gridSize: number
  gridColor: number
  gridOpacity: number
}

export interface ParallaxLayer {
  update(dt: number): void
  applyConfig(config: ParallaxLayerConfig): void
  destroy(): void
}

const rand = (min: number, max: number): number => min + Math.random() * (max - min)

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

  function initGrid(): void {
    const size = cfg.gridSize
    const divisions = Math.max(2, Math.round(size / 6))
    grid = new THREE.GridHelper(size, divisions, cfg.gridColor, cfg.gridColor)
    grid.position.y = cfg.layerY
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
    positions[o] = rand(-cfg.xSpan / 2, cfg.xSpan / 2)
    positions[o + 1] = cfg.layerY
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
    update(dt: number): void {
      for (let i = 0; i < cfg.count; i++) {
        const o = i * 3
        positions[o + 2] += cfg.speed * speeds[i] * dt
        if (positions[o + 2] > cfg.zNearWrap) {
          resetPoint(i)
        }
      }
      ;(geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true
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