/**
 * SDD-B02 ParallaxLayer — one grid + star field, pinned to the camera.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  GridHelper,
  Group,
  Points,
  PointsMaterial,
} from 'three'
import type { PerspectiveCamera } from 'three'
import { DEG2RAD } from '../../core/math'

export interface Vec3Params {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface ParallaxLayerConfig {
  readonly name: string
  readonly count: number
  readonly speed: number
  readonly speedJitter: number
  readonly parallaxGain: number
  readonly size: number
  readonly color: number
  readonly alpha: number
  readonly position: Vec3Params
  readonly rotation: Vec3Params
  readonly gridSize: number
  readonly gridColor: number
  readonly gridOpacity: number
  readonly zNearWrap: number
  readonly zFar: number
}

export interface ParallaxLayerPort {
  update(dt: number, camera: PerspectiveCamera): void
  syncRender(): void
  applyConfig(config: ParallaxLayerConfig): void
  dispose(): void
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function disposeMaterial(material: PointsMaterial | GridHelper['material']): void {
  if (Array.isArray(material)) {
    for (const item of material) {
      item.dispose()
    }
    return
  }
  material.dispose()
}

export class ParallaxLayer implements ParallaxLayerPort {
  readonly group: Group
  readonly name: string

  private _cfg: ParallaxLayerConfig
  private _positions: Float32Array
  private _speeds: Float32Array
  private _geometry: BufferGeometry
  private _material: PointsMaterial
  private _points: Points
  private _grid: GridHelper
  private _hasLastCam = false
  private _lastCamX = 0
  private _lastCamY = 0
  private _lastCamZ = 0
  private _camX = 0
  private _camY = 0
  private _camZ = 0
  private _disposed = false

  constructor(config: ParallaxLayerConfig) {
    this.group = new Group()
    this.name = config.name
    this._cfg = config
    this._grid = this._makeGrid()
    this.group.add(this._grid)
    const points = this._makePoints()
    this._positions = points.positions
    this._speeds = points.speeds
    this._geometry = points.geometry
    this._material = points.material
    this._points = points.points
    this.group.add(this._points)
  }

  update(dt: number, camera: PerspectiveCamera): void {
    const camPos = camera.position
    this._camX = camPos.x
    this._camY = camPos.y
    this._camZ = camPos.z

    if (!this._hasLastCam) {
      this._lastCamX = camPos.x
      this._lastCamY = camPos.y
      this._lastCamZ = camPos.z
      this._hasLastCam = true
    }

    const camDX = camPos.x - this._lastCamX
    const camDY = camPos.y - this._lastCamY
    const camDZ = camPos.z - this._lastCamZ
    this._lastCamX = camPos.x
    this._lastCamY = camPos.y
    this._lastCamZ = camPos.z

    const cfg = this._cfg
    const halfW = cfg.gridSize / 2
    const halfH = cfg.gridSize * 0.25
    const positions = this._positions
    const speeds = this._speeds

    for (let i = 0; i < cfg.count; i++) {
      const o = i * 3
      const speed = speeds[i] ?? 1
      const x = (positions[o] ?? 0) - camDX * cfg.parallaxGain * speed
      const y = (positions[o + 1] ?? 0) - camDY * cfg.parallaxGain * speed
      let z = (positions[o + 2] ?? 0) - camDZ * cfg.parallaxGain * speed

      let wrappedX = x
      if (wrappedX > halfW) {
        wrappedX -= cfg.gridSize
      } else if (wrappedX < -halfW) {
        wrappedX += cfg.gridSize
      }

      let wrappedY = y
      if (wrappedY > halfH) {
        wrappedY -= cfg.gridSize * 0.5
      } else if (wrappedY < -halfH) {
        wrappedY += cfg.gridSize * 0.5
      }

      z += cfg.speed * speed * dt
      positions[o] = wrappedX
      positions[o + 1] = wrappedY
      positions[o + 2] = z
      if (z > cfg.zNearWrap) {
        this._resetPoint(i)
      }
    }
  }

  syncRender(): void {
    const cfg = this._cfg
    this.group.position.set(
      this._camX + cfg.position.x,
      this._camY + cfg.position.y,
      this._camZ + cfg.position.z,
    )
    this.group.rotation.set(
      cfg.rotation.x * DEG2RAD,
      cfg.rotation.y * DEG2RAD,
      cfg.rotation.z * DEG2RAD,
    )
    const attr = this._geometry.getAttribute('position')
    if (attr) {
      attr.needsUpdate = true
    }
  }

  applyConfig(config: ParallaxLayerConfig): void {
    this._cfg = config
    this.group.remove(this._grid)
    this._grid.geometry.dispose()
    disposeMaterial(this._grid.material)
    this._grid = this._makeGrid()
    this.group.add(this._grid)

    if (this._positions.length !== config.count * 3) {
      this.group.remove(this._points)
      this._geometry.dispose()
      this._material.dispose()
      const points = this._makePoints()
      this._positions = points.positions
      this._speeds = points.speeds
      this._geometry = points.geometry
      this._material = points.material
      this._points = points.points
      this.group.add(this._points)
    }

    this._material.color.set(config.color)
    this._material.size = config.size
    this._material.opacity = config.alpha
  }

  dispose(): void {
    if (this._disposed) {
      return
    }
    this._disposed = true
    this._geometry.dispose()
    this._material.dispose()
    this._grid.geometry.dispose()
    disposeMaterial(this._grid.material)
    this.group.clear()
  }

  private _makeGrid(): GridHelper {
    const cfg = this._cfg
    const divisions = Math.max(2, Math.round(cfg.gridSize / 6))
    const grid = new GridHelper(cfg.gridSize, divisions, cfg.gridColor, cfg.gridColor)
    const material = grid.material
    if (Array.isArray(material)) {
      for (const item of material) {
        item.transparent = true
        item.opacity = cfg.gridOpacity
        item.depthWrite = false
      }
    } else {
      material.transparent = true
      material.opacity = cfg.gridOpacity
      material.depthWrite = false
    }
    return grid
  }

  private _makePoints(): {
    positions: Float32Array
    speeds: Float32Array
    geometry: BufferGeometry
    material: PointsMaterial
    points: Points
  } {
    const cfg = this._cfg
    const positions = new Float32Array(cfg.count * 3)
    const speeds = new Float32Array(cfg.count)
    this._positions = positions
    this._speeds = speeds
    for (let i = 0; i < cfg.count; i++) {
      this._resetPoint(i)
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    const material = new PointsMaterial({
      color: cfg.color,
      size: cfg.size,
      sizeAttenuation: true,
      transparent: true,
      opacity: cfg.alpha,
      depthWrite: false,
      blending: AdditiveBlending,
    })
    const points = new Points(geometry, material)
    return { positions, speeds, geometry, material, points }
  }

  private _resetPoint(i: number): void {
    const cfg = this._cfg
    const o = i * 3
    this._positions[o] = rand(-cfg.gridSize / 2, cfg.gridSize / 2)
    this._positions[o + 1] = rand(-cfg.gridSize * 0.25, cfg.gridSize * 0.25)
    this._positions[o + 2] = rand(cfg.zNearWrap, cfg.zFar)
    this._speeds[i] = 1 + rand(-cfg.speedJitter, cfg.speedJitter)
  }
}
