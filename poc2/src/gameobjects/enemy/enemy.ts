/**
 * SDD-E01 Enemy — Warrior gunship (pooled).
 * Phases follow sheet.targets: reachGate → chase player.
 * Speed via damp(agility); fixed weapon fires in chase within intel range.
 */

import { Mesh, MeshBasicMaterial } from 'three'
import type { BoxGeometry } from 'three'
import { BALANCE } from '../../core/balancer'
import { clamp, damp, distXZ } from '../../core/math'
import type { ShotAcquirePort } from '../../systems/shot-manager'
import type { ShotSpawn } from '../shot/weapon-shot'
import {
  warriorAgilityLambda,
  warriorEngageRange,
  type WarriorSheet,
} from './warrior'

export type TeamId = 'player' | 'enemy'
export type EnemyMovePhase = 'reachGate' | 'chase'

export interface SeekTargetPort {
  readonly x: number
  readonly z: number
}

export interface EnemySpawn {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly sheet?: WarriorSheet
}

export interface EnemyOptions {
  readonly geometry: BoxGeometry
  readonly seekTarget: SeekTargetPort
  readonly gateTarget: SeekTargetPort
  readonly shots?: ShotAcquirePort
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
  contactDamage = 0
  readonly vehicle = {
    position: { x: 0, y: 0, z: 0 },
    maxSpeed: 0,
    update(dt: number): void {
      void dt
    },
  }

  private readonly _seek: SeekTargetPort
  private readonly _gate: SeekTargetPort
  private readonly _shots: ShotAcquirePort | null
  private readonly _mat: MeshBasicMaterial
  private _facingY = 0
  private _killed = false
  private _phase: EnemyMovePhase = 'reachGate'
  private _cruiseSpeed = 0
  private _currentSpeed = 0
  private _arriveRadius = 8
  private _reachSpeedMul = 3
  private _agilityLambda = 3.5
  private _intelligence = 60
  private _fireAcc = 0
  private _sheet: WarriorSheet = BALANCE.enemy.warrior

  constructor(options: EnemyOptions) {
    const mat = new MeshBasicMaterial({
      color: BALANCE.enemy.warrior.color,
      wireframe: true,
      transparent: true,
      opacity: 1,
    })
    super(options.geometry, mat)
    this._mat = mat
    this._seek = options.seekTarget
    this._gate = options.gateTarget
    this._shots = options.shots ?? null
    this.contactDamage = BALANCE.enemy.warrior.contactDamage
    this.visible = false
  }

  phase(): EnemyMovePhase {
    return this._phase
  }

  currentSpeed(): number {
    return this._currentSpeed
  }

  sheet(): WarriorSheet {
    return this._sheet
  }

  archetype(): string {
    return this._sheet.id
  }

  activate(spawn: EnemySpawn): void {
    const sheet = spawn.sheet ?? BALANCE.enemy.warrior
    const gate = BALANCE.enemy.gate
    this._sheet = sheet
    this.hpMax = sheet.hp
    this.hp = this.hpMax
    this.radius = sheet.radius
    this.contactDamage = sheet.contactDamage
    this._cruiseSpeed = sheet.maxSpeed
    this.vehicle.maxSpeed = this._cruiseSpeed
    this._arriveRadius = gate.arriveRadius
    this._reachSpeedMul = sheet.reachSpeedMul
    this._agilityLambda = warriorAgilityLambda(sheet.agility)
    this._intelligence = sheet.intelligence
    this._phase = sheet.targets[0] === 'enemyGate' ? 'reachGate' : 'chase'
    this._currentSpeed = this._cruiseSpeed
    this._fireAcc = 0
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
    this._mat.color.setHex(sheet.color)
    this.scale.setScalar(this.radius * 2)
  }

  deactivate(): void {
    this.active = false
    this.visible = false
    this.hp = 0
    this._phase = 'reachGate'
    this._currentSpeed = 0
    this._fireAcc = 0
  }

  update(dt: number): void {
    if (!this.active) {
      return
    }

    if (this._phase === 'reachGate') {
      const gateDist = distXZ(this.x, this.z, this._gate.x, this._gate.z)
      if (gateDist <= this._arriveRadius) {
        this._phase = 'chase'
      }
    }

    const aim = this._phase === 'reachGate' ? this._gate : this._seek
    const targetSpeed =
      this._phase === 'reachGate' ? this._cruiseSpeed * this._reachSpeedMul : this._cruiseSpeed
    this._currentSpeed = damp(this._currentSpeed, targetSpeed, this._agilityLambda, dt)
    this.vehicle.maxSpeed = this._currentSpeed

    const dx = aim.x - this.x
    const dz = aim.z - this.z
    const dist = distXZ(this.x, this.z, aim.x, aim.z)
    if (dist > 0.001) {
      const inv = 1 / dist
      const speed = this._currentSpeed
      this.x += dx * inv * speed * dt
      this.z += dz * inv * speed * dt
      this._facingY = Math.atan2(dx, dz)
    }
    this.vehicle.position.x = this.x
    this.vehicle.position.y = this.y
    this.vehicle.position.z = this.z

    this._tryFire(dt)
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

  private _tryFire(dt: number): void {
    if (this._phase !== 'chase' || !this._shots) {
      return
    }
    const weapon = this._sheet.weapon
    const engage = warriorEngageRange(this._intelligence, weapon.range)
    const toPlayer = distXZ(this.x, this.z, this._seek.x, this._seek.z)
    if (toPlayer > engage) {
      this._fireAcc = 0
      return
    }
    this._fireAcc += dt
    const interval = 1 / Math.max(0.05, weapon.rate)
    while (this._fireAcc >= interval) {
      this._fireAcc -= interval
      this._fireBolt(weapon)
    }
  }

  private _fireBolt(weapon: WarriorSheet['weapon']): void {
    if (!this._shots) {
      return
    }
    const shot = this._shots.acquire()
    if (!shot) {
      return
    }
    const dx = this._seek.x - this.x
    const dz = this._seek.z - this.z
    const dist = Math.hypot(dx, dz) || 1
    const inv = 1 / dist
    const muzzleZ = weapon.muzzleZ
    const spawn: ShotSpawn = {
      x: this.x + dx * inv * muzzleZ,
      z: this.z + dz * inv * muzzleZ,
      vx: dx * inv * weapon.speed,
      vz: dz * inv * weapon.speed,
      damage: weapon.damage,
      lifetime: weapon.lifetime,
      totalLifetime: weapon.lifetime,
      radius: weapon.radius,
      aoeRadius: 0,
      range: weapon.range,
      decayPerUnit: weapon.decayPerUnit,
      color: weapon.color,
    }
    shot.activate(spawn)
  }
}
