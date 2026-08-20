/**
 * Enemy spawn volume — red semi-transparent box ahead of / beside the ship.
 * Visual + live volume for E05 (EnemyManager reads offset/size/interval/lanes).
 */

import {
  BoxGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
} from 'three'
import type { EnemySpawnConfig } from '../../core/balancer'

export interface ShipPose {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface SpawnAreaOptions {
  readonly config: EnemySpawnConfig
  /** Scene / debugger label (e.g. spawnAreaLeft). */
  readonly name?: string
}

export interface SpawnAreaPort {
  update(ship: ShipPose): void
  syncRender(): void
  setVisible(visible: boolean): void
  dispose(): void
}

export class SpawnArea implements SpawnAreaPort {
  readonly group: Group

  private readonly _mesh: Mesh
  private readonly _geo: BoxGeometry
  private readonly _mat: MeshBasicMaterial
  private readonly _ship = { x: 0, y: 0, z: 0 }
  private readonly _offset = { x: 0, y: 0, z: 0 }
  private readonly _size = { x: 1, y: 1, z: 1 }
  private _intervalSec: number
  private _lanesX: number[]
  private _maxActive: number
  private _visible: boolean
  private _dirty = true
  private _disposed = false

  constructor(options: SpawnAreaOptions) {
    const cfg = options.config
    this._offset.x = cfg.offset.x
    this._offset.y = cfg.offset.y
    this._offset.z = cfg.offset.z
    this._size.x = cfg.size.x
    this._size.y = cfg.size.y
    this._size.z = cfg.size.z
    this._intervalSec = cfg.intervalSec
    this._lanesX = [...cfg.lanesX]
    this._maxActive = cfg.maxActive
    this._visible = cfg.visible

    this._geo = new BoxGeometry(1, 1, 1)
    this._mat = new MeshBasicMaterial({
      color: cfg.color,
      transparent: true,
      opacity: cfg.opacity,
      depthWrite: false,
      side: DoubleSide,
    })
    this._mesh = new Mesh(this._geo, this._mat)
    const name = options.name ?? 'spawnArea'
    this._mesh.name = name
    this.group = new Group()
    this.group.name = name
    this.group.add(this._mesh)
    this.group.visible = this._visible
    this._dirty = true
  }

  offset(): { x: number; y: number; z: number } {
    return this._offset
  }

  size(): { x: number; y: number; z: number } {
    return this._size
  }

  worldCenter(): { x: number; y: number; z: number } {
    return {
      x: this._ship.x + this._offset.x,
      y: this._ship.y + this._offset.y,
      z: this._ship.z + this._offset.z,
    }
  }

  intervalSec(): number {
    return this._intervalSec
  }

  lanesX(): readonly number[] {
    return this._lanesX
  }

  maxActive(): number {
    return this._maxActive
  }

  visible(): boolean {
    return this._visible
  }

  color(): number {
    return this._mat.color.getHex()
  }

  opacity(): number {
    return this._mat.opacity
  }

  setOffset(x: number, y: number, z: number): void {
    this._offset.x = x
    this._offset.y = y
    this._offset.z = z
    this._dirty = true
  }

  setSize(x: number, y: number, z: number): void {
    this._size.x = Math.max(0.01, x)
    this._size.y = Math.max(0.01, y)
    this._size.z = Math.max(0.01, z)
    this._dirty = true
  }

  setIntervalSec(value: number): void {
    this._intervalSec = Math.max(0.05, value)
  }

  setLanesX(lanes: readonly number[]): void {
    this._lanesX = [...lanes]
  }

  setMaxActive(value: number): void {
    this._maxActive = Math.max(1, Math.round(value))
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
    this.group.position.set(
      this._ship.x + this._offset.x,
      this._ship.y + this._offset.y,
      this._ship.z + this._offset.z,
    )
    this._mesh.scale.set(this._size.x, this._size.y, this._size.z)
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
