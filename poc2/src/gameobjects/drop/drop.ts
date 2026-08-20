/**
 * SDD-F02 Drop — pooled collectible fragment (Layer.Drop).
 * Logic in update; GPU writes in syncRender.
 */

import {
  AdditiveBlending,
  Mesh,
  MeshBasicMaterial,
  OctahedronGeometry,
} from 'three'
import { BALANCE } from '../../core/balancer'
import { Layer } from '../../systems/layers'

export type ResourceId =
  | 'metalScrap'
  | 'prismaticCrystal'
  | 'denseCore'
  | 'darkMatter'
  | 'equipment'

export interface DropSpawn {
  readonly x: number
  readonly z: number
  readonly id: ResourceId
  readonly amount: number
}

export interface DropPull {
  x: number
  z: number
  speed: number
}

const SHARED_GEO = new OctahedronGeometry(1, 0)

export class Drop extends Mesh {
  readonly layer = Layer.Drop

  active = false
  /** Resource type — named resourceId because THREE.Object3D already owns `id`. */
  resourceId: ResourceId = 'metalScrap'
  amount = 0
  x = 0
  z = 0
  radius = 0

  private readonly _mat: MeshBasicMaterial
  private _pulseT = 0

  constructor() {
    const mat = new MeshBasicMaterial({
      color: BALANCE.drops.colors.metalScrap,
      wireframe: true,
      transparent: true,
      opacity: 1,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    super(SHARED_GEO, mat)
    this._mat = mat
    this.visible = false
    this.radius = BALANCE.drops.fragmentRadius
  }

  activate(spawn: DropSpawn): void {
    this.resourceId = spawn.id
    this.amount = spawn.amount
    this.x = spawn.x
    this.z = spawn.z
    this.radius = BALANCE.drops.fragmentRadius
    this._pulseT = 0
    this.active = true
    this.visible = true
    this._mat.color.setHex(BALANCE.drops.colors[spawn.id])
    this._mat.opacity = 1
  }

  deactivate(): void {
    this.active = false
    this.visible = false
    this.amount = 0
    this._pulseT = 0
  }

  update(dt: number, pull: DropPull | null): void {
    if (!this.active) {
      return
    }
    this._pulseT += dt
    if (!pull) {
      return
    }
    const dx = pull.x - this.x
    const dz = pull.z - this.z
    const dist = Math.hypot(dx, dz)
    if (dist <= 1e-6) {
      return
    }
    const step = Math.min(pull.speed * dt, dist)
    const inv = 1 / dist
    this.x += dx * inv * step
    this.z += dz * inv * step
  }

  syncRender(): void {
    if (!this.active) {
      this.visible = false
      return
    }
    this.position.set(this.x, 0, this.z)
    const size = this.radius * 2
    this.scale.set(size, size, size)
    // Subtle opacity pulse for scrap sparkle (view only).
    this._mat.opacity = 0.65 + 0.35 * Math.sin(this._pulseT * 8)
    this.visible = true
  }

  dispose(): void {
    this.deactivate()
    this._mat.dispose()
  }
}
