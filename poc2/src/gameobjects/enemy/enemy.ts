/**
 * SDD-E01 Enemy — pooled hostile mesh. Thin seek (Yuka deferred); F01 hits later.
 */

import { Mesh, MeshBasicMaterial } from 'three'
import type { BoxGeometry } from 'three'
import { BALANCE } from '../../core/balancer'
import { clamp, distXZ } from '../../core/math'

export type TeamId = 'player' | 'enemy'

export interface SeekTargetPort {
  readonly x: number
  readonly z: number
}

export interface EnemySpawn {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly hp?: number
  readonly radius?: number
  readonly maxSpeed?: number
}

export interface EnemyOptions {
  readonly geometry: BoxGeometry
  readonly seekTarget: SeekTargetPort
}

export class Enemy extends Mesh {
  readonly team: TeamId = 'enemy'
  readonly layer = 2 as const
  active = false
  hp = 0
  hpMax = 0
  x = 0
  y = 0
  z = 0
  radius = 0
  readonly contactDamage: number
  readonly vehicle = {
    position: { x: 0, y: 0, z: 0 },
    maxSpeed: 0,
    update(dt: number): void {
      void dt
    },
  }

  private readonly _seek: SeekTargetPort
  private readonly _mat: MeshBasicMaterial
  private _facingY = 0
  private _killed = false

  constructor(options: EnemyOptions) {
    const mat = new MeshBasicMaterial({
      color: BALANCE.enemy.generic.color,
      wireframe: true,
      transparent: true,
      opacity: 1,
    })
    super(options.geometry, mat)
    this._mat = mat
    this._seek = options.seekTarget
    this.contactDamage = BALANCE.enemy.generic.contactDamage
    this.visible = false
  }

  activate(spawn: EnemySpawn): void {
    const generic = BALANCE.enemy.generic
    this.hpMax = spawn.hp ?? generic.hp
    this.hp = this.hpMax
    this.radius = spawn.radius ?? generic.radius
    this.vehicle.maxSpeed = spawn.maxSpeed ?? generic.maxSpeed
    this.x = spawn.x
    this.y = spawn.y
    this.z = spawn.z
    this.vehicle.position.x = spawn.x
    this.vehicle.position.y = spawn.y
    this.vehicle.position.z = spawn.z
    this.active = true
    this._killed = false
    this.visible = true
    this._mat.opacity = 1
    this._mat.color.setHex(generic.color)
    this.scale.setScalar(this.radius * 2)
  }

  deactivate(): void {
    this.active = false
    this.visible = false
    this.hp = 0
  }

  update(dt: number): void {
    if (!this.active) {
      return
    }
    const dx = this._seek.x - this.x
    const dz = this._seek.z - this.z
    const dist = distXZ(this.x, this.z, this._seek.x, this._seek.z)
    if (dist > 0.001) {
      const inv = 1 / dist
      const speed = this.vehicle.maxSpeed
      this.x += dx * inv * speed * dt
      this.z += dz * inv * speed * dt
      this._facingY = Math.atan2(dx, dz)
    }
    this.vehicle.position.x = this.x
    this.vehicle.position.y = this.y
    this.vehicle.position.z = this.z
  }

  syncRender(): void {
    if (!this.active) {
      this.visible = false
      return
    }
    this.position.set(this.x, this.y, this.z)
    this.rotation.y = this._facingY
    this._mat.opacity = this.hpMax > 0 ? clamp(this.hp / this.hpMax, 0.2, 1) : 0.2
    this.visible = true
  }

  takeDamage(amount: number): void {
    this.applyDamage(amount, 0)
  }

  applyDamage(
    amount: number,
    source: number,
  ): {
    absorbedByShield: number
    dealtToHull: number
    shieldBroke: boolean
    hullLevelChanged: boolean
    destroyed: boolean
    killed: boolean
  } {
    void source
    if (!this.active || this._killed) {
      return {
        absorbedByShield: 0,
        dealtToHull: 0,
        shieldBroke: false,
        hullLevelChanged: false,
        destroyed: false,
        killed: false,
      }
    }
    const dealt = Math.max(0, amount)
    this.hp -= dealt
    if (this.hp <= 0) {
      this.hp = 0
      this._killed = true
      this.active = false
      this.visible = false
      return {
        absorbedByShield: 0,
        dealtToHull: dealt,
        shieldBroke: false,
        hullLevelChanged: false,
        destroyed: true,
        killed: true,
      }
    }
    return {
      absorbedByShield: 0,
      dealtToHull: dealt,
      shieldBroke: false,
      hullLevelChanged: false,
      destroyed: false,
      killed: false,
    }
  }

  isOffField(): boolean {
    const box = BALANCE.enemy.despawn
    return Math.abs(this.x) > box.halfX || this.z > box.zNear || this.z < box.zFar
  }

  /** Prefer BattleField.contains via EnemyManager; kept for absolute despawn tests. */
  isOutsideBattleField(bounds: {
    readonly minX: number
    readonly maxX: number
    readonly minZ: number
    readonly maxZ: number
  }): boolean {
    return this.x < bounds.minX || this.x > bounds.maxX || this.z < bounds.minZ || this.z > bounds.maxZ
  }

  dispose(): void {
    this.deactivate()
    this._mat.dispose()
  }
}
