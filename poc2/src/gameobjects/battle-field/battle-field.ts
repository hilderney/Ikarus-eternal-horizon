/**
 * BattleField — active play volume relative to the ship.
 * Blue wall-frame outline; enemies/meteors outside are pool-released (no mesh destroy).
 */

import {
  BufferAttribute,
  BufferGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
} from 'three'
import type { BattleFieldConfig } from '../../core/balancer'

export interface ShipPose {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface WorldBounds {
  readonly minX: number
  readonly maxX: number
  readonly minZ: number
  readonly maxZ: number
}

export interface BattleFieldOptions {
  readonly config: BattleFieldConfig
}

export interface BattleFieldPort {
  update(ship: ShipPose): void
  syncRender(): void
  contains(x: number, z: number): boolean
  setVisible(visible: boolean): void
  dispose(): void
}

/** 12 edges × 2 endpoints × 3 floats = 72 */
const EDGE_COUNT = 12

export class BattleField implements BattleFieldPort {
  readonly group: Group

  private readonly _lines: LineSegments
  private readonly _geo: BufferGeometry
  private readonly _mat: LineBasicMaterial
  private readonly _positions: Float32Array
  private readonly _ship = { x: 0, y: 0, z: 0 }
  private readonly _offsetX = { min: 0, max: 0 }
  private readonly _offsetZ = { min: 0, max: 0 }
  private _wallHeight: number
  private _visible: boolean
  private _dirty = true
  private _disposed = false

  constructor(options: BattleFieldOptions) {
    const cfg = options.config
    this._offsetX.min = cfg.offsetX.min
    this._offsetX.max = cfg.offsetX.max
    this._offsetZ.min = cfg.offsetZ.min
    this._offsetZ.max = cfg.offsetZ.max
    this._wallHeight = cfg.wallHeight
    this._visible = cfg.visible

    this._positions = new Float32Array(EDGE_COUNT * 2 * 3)
    this._geo = new BufferGeometry()
    this._geo.setAttribute('position', new BufferAttribute(this._positions, 3))
    this._mat = new LineBasicMaterial({
      color: cfg.color,
      transparent: true,
      opacity: cfg.opacity,
      depthWrite: false,
    })
    this._lines = new LineSegments(this._geo, this._mat)
    this._lines.name = 'battleFieldWalls'
    this.group = new Group()
    this.group.name = 'battleField'
    this.group.add(this._lines)
    this.group.visible = this._visible
    this._dirty = true
  }

  offsetX(): { min: number; max: number } {
    return this._offsetX
  }

  offsetZ(): { min: number; max: number } {
    return this._offsetZ
  }

  wallHeight(): number {
    return this._wallHeight
  }

  visible(): boolean {
    return this._visible
  }

  worldBounds(): WorldBounds {
    return {
      minX: this._ship.x + this._offsetX.min,
      maxX: this._ship.x + this._offsetX.max,
      minZ: this._ship.z + this._offsetZ.min,
      maxZ: this._ship.z + this._offsetZ.max,
    }
  }

  contains(x: number, z: number): boolean {
    const b = this.worldBounds()
    return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ
  }

  setOffsetX(min: number, max: number): void {
    this._offsetX.min = min
    this._offsetX.max = max
    this._dirty = true
  }

  setOffsetZ(min: number, max: number): void {
    this._offsetZ.min = min
    this._offsetZ.max = max
    this._dirty = true
  }

  setWallHeight(value: number): void {
    this._wallHeight = Math.max(0.1, value)
    this._dirty = true
  }

  setVisible(visible: boolean): void {
    this._visible = visible
    this.group.visible = visible
  }

  setColor(hex: number): void {
    this._mat.color.setHex(hex)
  }

  setOpacity(value: number): void {
    this._mat.opacity = Math.min(1, Math.max(0, value))
  }

  update(ship: ShipPose): void {
    if (this._disposed) {
      return
    }
    this._ship.x = ship.x
    this._ship.y = ship.y
    this._ship.z = ship.z
    this._dirty = true
  }

  syncRender(): void {
    if (this._disposed || !this._dirty) {
      return
    }
    const y0 = this._ship.y
    const y1 = this._ship.y + this._wallHeight
    const x0 = this._ship.x + this._offsetX.min
    const x1 = this._ship.x + this._offsetX.max
    const z0 = this._ship.z + this._offsetZ.min
    const z1 = this._ship.z + this._offsetZ.max
    const p = this._positions
    let i = 0
    // Bottom rectangle
    i = writeEdge(p, i, x0, y0, z0, x1, y0, z0)
    i = writeEdge(p, i, x1, y0, z0, x1, y0, z1)
    i = writeEdge(p, i, x1, y0, z1, x0, y0, z1)
    i = writeEdge(p, i, x0, y0, z1, x0, y0, z0)
    // Top rectangle
    i = writeEdge(p, i, x0, y1, z0, x1, y1, z0)
    i = writeEdge(p, i, x1, y1, z0, x1, y1, z1)
    i = writeEdge(p, i, x1, y1, z1, x0, y1, z1)
    i = writeEdge(p, i, x0, y1, z1, x0, y1, z0)
    // Vertical posts (walls)
    i = writeEdge(p, i, x0, y0, z0, x0, y1, z0)
    i = writeEdge(p, i, x1, y0, z0, x1, y1, z0)
    i = writeEdge(p, i, x1, y0, z1, x1, y1, z1)
    writeEdge(p, i, x0, y0, z1, x0, y1, z1)
    const attr = this._geo.getAttribute('position')
    attr.needsUpdate = true
    this.group.visible = this._visible
    this._dirty = false
  }

  dispose(): void {
    if (this._disposed) {
      return
    }
    this._disposed = true
    this.group.clear()
    this._geo.dispose()
    this._mat.dispose()
  }
}

function writeEdge(
  target: Float32Array,
  index: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
): number {
  target[index] = ax
  target[index + 1] = ay
  target[index + 2] = az
  target[index + 3] = bx
  target[index + 4] = by
  target[index + 5] = bz
  return index + 6
}
