/**
 * SDD-B04 Gizmos — world axes, playfield grid, camera axes. Dev tool.
 */

import {
  BufferGeometry,
  CanvasTexture,
  DataTexture,
  GridHelper,
  Group,
  Line,
  LineBasicMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three'
import type { Camera, Material, Texture } from 'three'
import { BALANCE } from '../../core/balancer'

export interface GizmosOptions {
  readonly camera: Camera
  readonly gridSize: number
  readonly gridDivisions: number
  readonly gridColor: number
  readonly gridY: number
  readonly gridOpacity: number
  readonly worldAxisSize: number
  readonly cameraAxisSize: number
}

export interface GizmosPort {
  update(dt: number): void
  syncRender(): void
  setEnabled(enabled: boolean): void
  dispose(): void
}

function disposeMaterial(material: Material | Material[]): void {
  if (Array.isArray(material)) {
    for (const item of material) {
      item.dispose()
    }
    return
  }
  material.dispose()
}

function makeLabelTexture(text: string, color: string): Texture {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, 128, 128)
      ctx.font = 'bold 64px Consolas, monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = color
      ctx.fillText(text, 64, 64)
      const texture = new CanvasTexture(canvas)
      return texture
    }
  }
  const data = new Uint8Array([255, 255, 255, 255])
  const texture = new DataTexture(data, 1, 1)
  texture.needsUpdate = true
  return texture
}

function addAxisLine(group: Group, a: Vector3, b: Vector3, color: number, opacity: number): void {
  const geo = new BufferGeometry().setFromPoints([a, b])
  const mat = new LineBasicMaterial({
    color,
    transparent: true,
    opacity,
  })
  const line = new Line(geo, mat)
  line.frustumCulled = false
  group.add(line)
}

function addLabel(group: Group, text: string, position: Vector3, color: string, scale: number): void {
  const texture = makeLabelTexture(text, color)
  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  })
  const sprite = new Sprite(material)
  sprite.position.copy(position)
  sprite.scale.set(scale, scale, 1)
  sprite.frustumCulled = false
  group.add(sprite)
}

function createWorldAxes(size: number, colors: { x: number; y: number; z: number }, opacity: number): Group {
  const group = new Group()
  group.name = 'worldAxes'
  addAxisLine(group, new Vector3(-size, 0, 0), new Vector3(size, 0, 0), colors.x, opacity)
  addAxisLine(group, new Vector3(0, -size, 0), new Vector3(0, size, 0), colors.y, opacity)
  addAxisLine(group, new Vector3(0, 0, -size), new Vector3(0, 0, size), colors.z, opacity)
  addLabel(group, 'X', new Vector3(size + 0.4, 0, 0), '#ff4455', 0.9)
  addLabel(group, 'Y', new Vector3(0, size + 0.4, 0), '#55ff77', 0.9)
  addLabel(group, 'Z', new Vector3(0, 0, size + 0.4), '#55aaff', 0.9)
  return group
}

function createCameraAxes(size: number, colors: { x: number; y: number; z: number }, opacity: number): Group {
  const group = new Group()
  group.name = 'cameraAxes'
  addAxisLine(group, new Vector3(-size, 0, 0), new Vector3(size, 0, 0), colors.x, opacity)
  addAxisLine(group, new Vector3(0, -size, 0), new Vector3(0, size, 0), colors.y, opacity)
  addAxisLine(group, new Vector3(0, 0, -size), new Vector3(0, 0, size), colors.z, opacity)
  addLabel(group, 'cx', new Vector3(size + 0.25, 0, 0), '#ff6677', 0.6)
  addLabel(group, 'cy', new Vector3(0, size + 0.25, 0), '#77ff99', 0.6)
  addLabel(group, 'cz', new Vector3(0, 0, size + 0.25), '#77bbff', 0.6)
  return group
}

export class Gizmos implements GizmosPort {
  readonly group: Group
  private readonly _camera: Camera
  private readonly _worldAxes: Group
  private readonly _grid: GridHelper
  private readonly _cameraAxes: Group
  private _enabled = true
  private _disposed = false

  constructor(options: GizmosOptions) {
    this._camera = options.camera
    this.group = new Group()
    const colors = BALANCE.gizmos.axis
    const opacity = BALANCE.gizmos.lineOpacity
    this._worldAxes = createWorldAxes(options.worldAxisSize, colors, opacity)
    this._grid = new GridHelper(options.gridSize, options.gridDivisions, options.gridColor, options.gridColor)
    this._grid.position.y = options.gridY
    const gridMat = this._grid.material
    if (Array.isArray(gridMat)) {
      for (const item of gridMat) {
        item.transparent = true
        item.opacity = options.gridOpacity
        item.depthWrite = false
      }
    } else {
      gridMat.transparent = true
      gridMat.opacity = options.gridOpacity
      gridMat.depthWrite = false
    }
    this._cameraAxes = createCameraAxes(options.cameraAxisSize, colors, opacity)
    this.group.add(this._worldAxes, this._grid, this._cameraAxes)
  }

  get enabled(): boolean {
    return this._enabled
  }

  update(dt: number): void {
    void dt
  }

  syncRender(): void {
    this._camera.updateWorldMatrix(true, false)
    this._cameraAxes.position.copy(this._camera.position)
    this._cameraAxes.quaternion.copy(this._camera.quaternion)
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled
    this.group.visible = enabled
  }

  dispose(): void {
    if (this._disposed) {
      return
    }
    this._disposed = true
    this.group.traverse((obj) => {
      if (obj instanceof Line) {
        obj.geometry.dispose()
        disposeMaterial(obj.material)
      }
      if (obj instanceof Sprite) {
        const map = obj.material.map
        map?.dispose()
        obj.material.dispose()
      }
      if (obj instanceof GridHelper) {
        obj.geometry.dispose()
        disposeMaterial(obj.material)
      }
    })
    this.group.clear()
  }
}
