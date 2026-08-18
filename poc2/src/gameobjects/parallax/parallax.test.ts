import { GridHelper, PerspectiveCamera, Points } from 'three'
import type { BufferGeometry } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { BALANCE } from '../../core/balancer'
import { ParallaxField } from './parallax-field'
import { ParallaxLayer, type ParallaxLayerConfig } from './parallax-layer'

function smallLayer(overrides: Partial<ParallaxLayerConfig> = {}): ParallaxLayerConfig {
  return {
    name: 'test',
    count: 2,
    speed: 0,
    speedJitter: 0,
    parallaxGain: 1,
    size: 1,
    color: 0xffffff,
    alpha: 1,
    position: { x: 0, y: -10, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    gridSize: 100,
    gridColor: 0x555555,
    gridOpacity: 0,
    zNearWrap: 0,
    zFar: -200,
    ...overrides,
  }
}

function pointsOf(layer: ParallaxLayer): Points {
  const points = layer.group.children.find((child) => child instanceof Points)
  if (!points) {
    throw new Error('missing Points')
  }
  return points
}

function positionsOf(layer: ParallaxLayer): Float32Array {
  const attr = pointsOf(layer).geometry.getAttribute('position')
  return attr.array as Float32Array
}

describe('ParallaxField', () => {
  it('constructs three layers named background_stars, solar_system, debris', () => {
    const field = new ParallaxField(BALANCE.parallax.layers)
    expect(field.layers).toHaveLength(3)
    expect(field.layers.map((layer) => layer.name)).toEqual([
      'background_stars',
      'solar_system',
      'debris',
    ])
    field.dispose()
  })

  it('pins each layer group to camera.position + layer.position', () => {
    const field = new ParallaxField(BALANCE.parallax.layers)
    const camera = new PerspectiveCamera()
    camera.position.set(10, 20, 30)
    field.update(0, camera)
    field.syncRender()
    field.layers.forEach((layer, i) => {
      const offset = BALANCE.parallax.layers[i]?.position
      expect(layer.group.position.x).toBe(10 + (offset?.x ?? 0))
      expect(layer.group.position.y).toBe(20 + (offset?.y ?? 0))
      expect(layer.group.position.z).toBe(30 + (offset?.z ?? 0))
    })
    field.dispose()
  })

  it('uses DYNAMIC VIEW gains 0.000225 / 0.225 / 0.3 and y -600/-300/-150', () => {
    const [a, b, c] = BALANCE.parallax.layers
    expect(a?.parallaxGain).toBeCloseTo(0.000225, 10)
    expect(b?.parallaxGain).toBeCloseTo(0.225, 10)
    expect(c?.parallaxGain).toBeCloseTo(0.3, 10)
    expect(a?.position.y).toBe(-600)
    expect(b?.position.y).toBe(-300)
    expect(c?.position.y).toBe(-150)
  })

  it('uses gridSize 1000 and zFar -2000 on every layer', () => {
    for (const layer of BALANCE.parallax.layers) {
      expect(layer.gridSize).toBe(1000)
      expect(layer.zFar).toBe(-2000)
    }
  })

  it('dispose frees points and grid resources on every layer', () => {
    const field = new ParallaxField(BALANCE.parallax.layers)
    const geos: BufferGeometry[] = []
    for (const layer of field.layers) {
      layer.group.traverse((obj) => {
        if (obj instanceof Points || obj instanceof GridHelper) {
          geos.push(obj.geometry)
        }
      })
    }
    const flags = geos.map((geo) => {
      let hit = false
      geo.addEventListener('dispose', () => {
        hit = true
      })
      return () => hit
    })
    field.dispose()
    expect(flags.every((read) => read())).toBe(true)
  })
})

describe('ParallaxLayer', () => {
  it('applies zero star shift on the first update (no last-camera yet)', () => {
    const layer = new ParallaxLayer(smallLayer({ speed: 0 }))
    const camera = new PerspectiveCamera()
    camera.position.set(5, 5, 5)
    const before = Array.from(positionsOf(layer))
    layer.update(0, camera)
    expect(Array.from(positionsOf(layer))).toEqual(before)
    layer.dispose()
  })

  it('shifts stars opposite a camera Δ scaled by parallaxGain', () => {
    const layer = new ParallaxLayer(smallLayer({ parallaxGain: 1, speed: 0, speedJitter: 0 }))
    const camera = new PerspectiveCamera()
    layer.update(0, camera)
    const positions = positionsOf(layer)
    positions[0] = 0
    camera.position.x += 10
    layer.update(0, camera)
    expect(positions[0]).toBeLessThan(0)
    layer.dispose()
  })

  it('wraps stars on X at ±gridSize/2', () => {
    const layer = new ParallaxLayer(smallLayer({ gridSize: 100, speed: 0 }))
    const camera = new PerspectiveCamera()
    layer.update(0, camera)
    const positions = positionsOf(layer)
    positions[0] = 60
    layer.update(0, camera)
    expect(positions[0]).toBe(60 - 100)
    layer.dispose()
  })

  it('recycles a star whose z exceeds zNearWrap', () => {
    const layer = new ParallaxLayer(smallLayer({ zNearWrap: 0, zFar: -200, speed: 0 }))
    const camera = new PerspectiveCamera()
    layer.update(0, camera)
    const positions = positionsOf(layer)
    positions[2] = 10
    layer.update(0, camera)
    expect(positions[2] ?? 0).toBeLessThanOrEqual(0)
    layer.dispose()
  })

  it('applyConfig with same count does not allocate a new geometry', () => {
    const cfg = smallLayer()
    const layer = new ParallaxLayer(cfg)
    const geometry = pointsOf(layer).geometry
    layer.applyConfig({ ...cfg, color: 0xff0000 })
    expect(pointsOf(layer).geometry).toBe(geometry)
    layer.dispose()
  })

  it('update/syncRender do not allocate', () => {
    const layer = new ParallaxLayer(smallLayer())
    const camera = new PerspectiveCamera()
    layer.update(0, camera)
    const setSpy = vi.spyOn(globalThis, 'Set')
    layer.update(0.016, camera)
    layer.syncRender()
    expect(setSpy).not.toHaveBeenCalled()
    setSpy.mockRestore()
    layer.dispose()
  })
})
