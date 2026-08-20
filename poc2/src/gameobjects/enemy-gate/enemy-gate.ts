/**
 * EnemyGate — 9 fixed entry markers (3 left / 3 middle / 3 right), ship-relative.
 * Spawners pick one slot in their band; Warriors lerp A(spawn)→B(marker).
 */

import {
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
} from 'three'
import type { EnemyGateConfig } from '../../core/balancer'

export type GateEntryBand = 'left' | 'middle' | 'right'

const BANDS: readonly GateEntryBand[] = ['left', 'middle', 'right']

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

  private readonly _geo: SphereGeometry
  private readonly _mat: MeshBasicMaterial
  private readonly _markers: Mesh[] = []
  private readonly _localX: number[] = []
  private readonly _ship = { x: 0, y: 0, z: 0 }
  private readonly _offset = { x: 0, y: 0, z: 0 }
  private readonly _size = { x: 1, y: 1, z: 1 }
  private readonly _entryPointsX: EnemyGateConfig['entryPointsX']
  private _markerRadius: number
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
    this._entryPointsX = {
      left: [...cfg.entryPointsX.left] as [number, number, number],
      middle: [...cfg.entryPointsX.middle] as [number, number, number],
      right: [...cfg.entryPointsX.right] as [number, number, number],
    }
    this._markerRadius = Math.max(0.15, cfg.markerRadius)
    this._arriveRadius = cfg.arriveRadius
    this._reachSpeedMul = cfg.reachSpeedMul
    this._agilityLambda = cfg.agilityLambda
    this._visible = cfg.visible

    this._geo = new SphereGeometry(1, 10, 8)
    this._mat = new MeshBasicMaterial({
      color: cfg.color,
      wireframe: true,
      transparent: true,
      opacity: cfg.opacity,
      depthWrite: false,
      side: DoubleSide,
    })

    this.group = new Group()
    this.group.name = 'enemyGate'

    for (const band of BANDS) {
      for (const lx of this._entryPointsX[band]) {
        this._localX.push(lx)
        const mesh = new Mesh(this._geo, this._mat)
        mesh.name = `enemyGate.${band}.${lx}`
        mesh.scale.setScalar(this._markerRadius)
        mesh.position.set(lx, 0, 0)
        this._markers.push(mesh)
        this.group.add(mesh)
      }
    }

    this.group.visible = this._visible
    this._dirty = true
  }

  /** Flat list of the 9 local-X marker offsets (left→middle→right). */
  markerLocalXs(): readonly number[] {
    return this._localX
  }

  markerCount(): number {
    return this._markers.length
  }

  offset(): { x: number; y: number; z: number } {
    return this._offset
  }

  size(): { x: number; y: number; z: number } {
    return this._size
  }

  markerRadius(): number {
    return this._markerRadius
  }

  worldCenter(): { x: number; y: number; z: number } {
    return {
      x: this._ship.x + this._offset.x,
      y: this._ship.y + this._offset.y,
      z: this._ship.z + this._offset.z,
    }
  }

  entryPointsX(band: GateEntryBand): readonly [number, number, number] {
    return this._entryPointsX[band]
  }

  /** Pick one of the three local-X slots for the band (controlled random). */
  pickEntryOffsetX(band: GateEntryBand): number {
    const slots = this._entryPointsX[band]
    const index = Math.floor(Math.random() * slots.length) % slots.length
    return slots[index] ?? 0
  }

  /** World-space gate entry B: centre + local entry X (y/z on the gate plane). */
  worldEntryPoint(entryOffsetX: number): { x: number; y: number; z: number } {
    const center = this.worldCenter()
    return {
      x: center.x + entryOffsetX,
      y: center.y,
      z: center.z,
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
    this._size.x = Math.max(0.1, x)
    this._size.y = Math.max(0.1, y)
    this._size.z = Math.max(0.1, z)
    // Debugger size.y drives marker radius for the 9 spheres.
    this._markerRadius = Math.max(0.15, y)
    this._dirty = true
  }

  setMarkerRadius(value: number): void {
    this._markerRadius = Math.max(0.15, value)
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
    for (let i = 0; i < this._markers.length; i++) {
      const mesh = this._markers[i]
      const lx = this._localX[i] ?? 0
      if (!mesh) {
        continue
      }
      mesh.position.set(lx, 0, 0)
      mesh.scale.setScalar(this._markerRadius)
    }
    this.group.visible = this._visible
    this._dirty = false
  }

  dispose(): void {
    if (this._disposed) {
      return
    }
    this._disposed = true
    this.group.clear()
    this._markers.length = 0
    this._geo.dispose()
    this._mat.dispose()
  }
}
