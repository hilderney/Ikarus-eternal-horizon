/**
 * SDD-D01 WeaponShot — pooled player projectile mesh.
 * Logic in update; GPU writes in syncRender. E04 owns scene add/remove.
 */

import {
  AdditiveBlending,
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
} from 'three'
import { clamp, decayFactor, distXZ } from '../../core/math'
import { Layer } from '../../systems/layers'

export interface WeaponShotPort {
  readonly active: boolean
  readonly layer: Layer
  readonly x: number
  readonly z: number
  readonly radius: number
  readonly aoeRadius: number
  effectiveDamage(): number
}

export interface ShotSpawn {
  readonly x: number
  readonly z: number
  readonly vx: number
  readonly vz: number
  readonly damage: number
  readonly lifetime: number
  readonly totalLifetime: number
  readonly radius: number
  readonly aoeRadius: number
  readonly range: number
  readonly decayPerUnit: number
  readonly color?: number
}

export interface WeaponShotOptions {
  readonly color: number
}

export class WeaponShot extends Mesh implements WeaponShotPort {
  readonly layer = Layer.PlayerShot

  x = 0
  z = 0
  vx = 0
  vz = 0
  damage = 0
  lifetime = 0
  radius = 0
  aoeRadius = 0
  decayPerUnit = 0
  range = 0
  totalLifetime = 0
  spawnX = 0
  spawnZ = 0

  private _active = false
  private readonly _material: MeshBasicMaterial

  constructor(options: WeaponShotOptions) {
    const geometry = new BoxGeometry(1, 1, 0.7)
    const material = new MeshBasicMaterial({
      color: options.color,
      transparent: true,
      blending: AdditiveBlending,
      depthWrite: false,
    })
    super(geometry, material)
    this._material = material
    this.visible = false
  }

  get active(): boolean {
    return this._active
  }

  activate(spawn: ShotSpawn): void {
    this.x = spawn.x
    this.z = spawn.z
    this.vx = spawn.vx
    this.vz = spawn.vz
    this.damage = spawn.damage
    this.lifetime = spawn.lifetime
    this.totalLifetime = spawn.totalLifetime
    this.radius = spawn.radius
    this.aoeRadius = spawn.aoeRadius
    this.range = spawn.range
    this.decayPerUnit = spawn.decayPerUnit
    this.spawnX = spawn.x
    this.spawnZ = spawn.z
    if (spawn.color !== undefined) {
      this._material.color.setHex(spawn.color)
    }
    this._material.opacity = 1
    this._active = true
    this.visible = true
  }

  update(dt: number): void {
    this.x += this.vx * dt
    this.z += this.vz * dt
    this.lifetime -= dt
  }

  syncRender(): void {
    this.position.set(this.x, 0, this.z)
    if (Math.hypot(this.vx, this.vz) > 1e-6) {
      this.rotation.y = Math.atan2(this.vx, this.vz)
    }
    this._material.opacity = shotDecay(this)
    const width = this.radius * 2
    this.scale.set(width, width, 1)
  }

  deactivate(): void {
    this._active = false
    this.visible = false
  }

  effectiveDamage(): number {
    return this.damage * shotDecay(this)
  }

  dispose(): void {
    this.geometry.dispose()
    this._material.dispose()
  }
}

function shotDecay(shot: WeaponShot): number {
  if (shot.totalLifetime > 0) {
    const elapsed = clamp(1 - shot.lifetime / shot.totalLifetime, 0, 1)
    return decayFactor(elapsed)
  }
  const dist = distXZ(shot.x, shot.z, shot.spawnX, shot.spawnZ)
  if (shot.range > 0) {
    return decayFactor(dist / shot.range)
  }
  return Math.max(0, 1 - shot.decayPerUnit * dist)
}
