/**
 * EnemyGate — staging line behind the front spawn (ship-relative).
 * Enemies rush here (reachGate) before turning to chase the ship.
 */

import {
  BoxGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
} from 'three'
import type { EnemyGateConfig } from '../../core/balancer'

export interface ShipPose {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface EnemyGateOptions {
  readonly config: EnemyGateConfig
}

export class EnemyGate {
  readonly group: Group

  private readonly _mesh: Mesh
  private readonly _geo: BoxGeometry
  private readonly _mat: MeshBasicMaterial
  private readonly _ship = { x: 0, y: 0, z: 0 }
  private readonly _offset = { x: 0, y: 0, z: 0 }
  private readonly _size = { x: 1, y: 1, z: 1 }
  private _arriveRadius: number
  private _reachSpeedMul: number
  private _agilityLambda: number
  private _visible: boolean
  private _dirty = true
  private _disposed = false

  constructor(options: EnemyGateOptions) {
    const cfg = options.config
    this._offset.x = cfg.offset.x
    this._offset.y = cfg.offset.y
    this._offset.z = cfg.offset.z
    this._size.x = cfg.size.x
    this._size.y = cfg.size.y
    this._size.z = cfg.size.z
    this._arriveRadius = cfg.arriveRadius
    this._reachSpeedMul = cfg.reachSpeedMul
    this._agilityLambda = cfg.agilityLambda
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
    this._mesh.name = 'enemyGate'
    this.group = new Group()
    this.group.name = 'enemyGate'
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

  arriveRadius(): number {
    return this._arriveRadius
  }

  reachSpeedMul(): number {
    return this._reachSpeedMul
  }

  agilityLambda(): number {
    return this._agilityLambda
  }

  visible(): boolean {
    return this._visible
  }

  setOffset(x: number, y: number, z: number): void {
    this._offset.x = x
    this._offset.y = y
    this._offset.z = z
    this._dirty = true
  }

  setSize(x: number, y: number, z: number): void {
    this._size.x = Math.max(0.1, x)
    this._size.y = Math.max(0.1, y)
    this._size.z = Math.max(0.1, z)
    this._dirty = true
  }

  setArriveRadius(value: number): void {
    this._arriveRadius = Math.max(0.1, value)
  }

  setReachSpeedMul(value: number): void {
    this._reachSpeedMul = Math.max(0.1, value)
  }

  setAgilityLambda(value: number): void {
    this._agilityLambda = Math.max(0.01, value)
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
    const center = this.worldCenter()
    this.group.position.set(center.x, center.y, center.z)
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
