/**
 * SDD-E01 Enemy — Warrior gunship (pooled).
 * Phases: reachGate (curve A→B) → chase (weighted strategies).
 * Status: hitted / hitting / in_range / passed_opponent.
 * Shots always travel +Z.
 */

import {
  CircleGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
} from 'three'
import type { BoxGeometry } from 'three'
import { BALANCE } from '../../core/balancer'
import { DEG2RAD, clamp, damp, distXZ } from '../../core/math'
import type { ShotAcquirePort } from '../../systems/shot-manager'
import { EnemyMovementManager, type MoveStrategyId } from '../../systems/enemy-movement-manager'
import {
  effectiveStrategyWeights,
  isInsideFireCone,
  pickChaseStrategy,
  strategyHoldMs,
  type ActiveStatuses,
  type ChaseStrategyId,
} from '../../systems/enemy-strategy'
import type { ReachPreviewSide } from '../../systems/reach-path'
import { Layer } from '../../systems/layers'
import type { ShotSpawn } from '../shot/weapon-shot'
import {
  cloneWarriorSheet,
  warriorAgilityLambda,
  warriorEngageRange,
  warriorMaxSpeed,
  type EditableWarriorSheet,
  type WarriorSheet,
} from './warrior'

export type TeamId = 'player' | 'enemy'
export type EnemyMovePhase = 'reachGate' | 'chase'

export interface SeekTargetPort {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface EnemySpawn {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly sheet?: WarriorSheet | EditableWarriorSheet
  readonly gateEntryOffsetX?: number
  readonly pathSide?: ReachPreviewSide
}

export interface EnemyOptions {
  readonly geometry: BoxGeometry
  readonly seekTarget: SeekTargetPort
  readonly gateTarget: SeekTargetPort
  readonly shots?: ShotAcquirePort
}

export interface EnemyStatusSnapshot {
  hitted: boolean
  hitting: boolean
  in_range: boolean
  passed_opponent: boolean
  fixed_movement_strategy: boolean
  chaseStrategy: ChaseStrategyId | null
}

export class Enemy extends Mesh {
  readonly team: TeamId = 'enemy'
  readonly layer = Layer.Enemy
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
  private readonly _rangeMat: MeshBasicMaterial
  private readonly _rangeMesh: Mesh
  private readonly _movement = new EnemyMovementManager()
  private readonly _pos = { x: 0, y: 0, z: 0 }
  private _killed = false
  private _phase: EnemyMovePhase = 'reachGate'
  private _cruiseSpeed = 0
  private _currentSpeed = 0
  private _arriveRadius = 8
  private _reachSpeedMul = 3
  private _agilityLambda = 3.5
  private _intelligence = 60
  private _fireAcc = 0
  private _sheet: EditableWarriorSheet = cloneWarriorSheet(BALANCE.enemy.warrior)
  private _entryOffsetX = 0
  private _pathSide: ReachPreviewSide = 'front'
  private readonly _gateAim = { x: 0, y: 0, z: 0 }

  private _hittedMs = 0
  private _hittingMs = 0
  private _inRange = false
  private _passedOpponent = false
  private _fixedMovementStrategy = false
  private _chaseStrategy: ChaseStrategyId | null = null
  private _strategyHoldMs = 0
  private _statusFingerprint = ''
  private _rand: () => number = Math.random

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

    const rangeGeo = new CircleGeometry(1, 48)
    rangeGeo.rotateX(-Math.PI / 2)
    this._rangeMat = new MeshBasicMaterial({
      color: BALANCE.enemy.warrior.status.rangeColor,
      transparent: true,
      opacity: BALANCE.enemy.warrior.status.rangeOpacity,
      depthWrite: false,
      side: DoubleSide,
    })
    this._rangeMesh = new Mesh(rangeGeo, this._rangeMat)
    this._rangeMesh.name = 'enemy.range'
    this._rangeMesh.visible = false
    this.add(this._rangeMesh)
    this.visible = false
  }

  phase(): EnemyMovePhase {
    return this._phase
  }

  currentSpeed(): number {
    return this._currentSpeed
  }

  sheet(): EditableWarriorSheet {
    return this._sheet
  }

  statusSnapshot(): EnemyStatusSnapshot {
    return {
      hitted: this._hittedMs > 0,
      hitting: this._hittingMs > 0,
      in_range: this._inRange,
      passed_opponent: this._passedOpponent,
      fixed_movement_strategy: this._fixedMovementStrategy,
      chaseStrategy: this._chaseStrategy,
    }
  }

  chaseStrategy(): ChaseStrategyId | null {
    return this._chaseStrategy
  }

  /** Live-apply sheet combat stats without resetting pose / phase (debugger). */
  applyLiveSheet(sheet: WarriorSheet | EditableWarriorSheet): void {
    if (!this.active) {
      return
    }
    const ratio = this.hpMax > 0 ? this.hp / this.hpMax : 1
    this._sheet = cloneWarriorSheet(sheet)
    this.hpMax = sheet.hp
    this.hp = Math.max(0, Math.min(sheet.hp, sheet.hp * ratio))
    this.radius = sheet.radius
    this.contactDamage = sheet.contactDamage
    this._sheet.maxSpeed = warriorMaxSpeed(sheet.agility)
    this._cruiseSpeed = this._sheet.maxSpeed
    this.vehicle.maxSpeed = this._cruiseSpeed
    this._reachSpeedMul = sheet.reachSpeedMul
    this._agilityLambda = warriorAgilityLambda(sheet.agility)
    this._intelligence = sheet.intelligence
    this._mat.color.setHex(sheet.color)
    this.scale.setScalar(this.radius * 2)
    this._movement.setLoopParams(this._sheet.strategy.loopAround)
    this._movement.setTurnRate(this._sheet.strategy.turnRateDeg)
    this._syncRangeVisual()
  }

  archetype(): string {
    return this._sheet.id
  }

  activate(spawn: EnemySpawn): void {
    const sheet = cloneWarriorSheet(spawn.sheet ?? BALANCE.enemy.warrior)
    const gate = BALANCE.enemy.gate
    this._sheet = sheet
    this.hpMax = sheet.hp
    this.hp = this.hpMax
    this.radius = sheet.radius
    this.contactDamage = sheet.contactDamage
    this._sheet.maxSpeed = warriorMaxSpeed(sheet.agility)
    this._cruiseSpeed = this._sheet.maxSpeed
    this.vehicle.maxSpeed = this._cruiseSpeed
    this._arriveRadius = gate.arriveRadius
    this._reachSpeedMul = sheet.reachSpeedMul
    this._agilityLambda = warriorAgilityLambda(sheet.agility)
    this._intelligence = sheet.intelligence
    this._entryOffsetX = spawn.gateEntryOffsetX ?? 0
    this._pathSide = spawn.pathSide ?? 'front'
    this._phase = sheet.targets[0] === 'enemyGate' ? 'reachGate' : 'chase'
    this._currentSpeed = this._cruiseSpeed
    this._fireAcc = 0
    this._hittedMs = 0
    this._hittingMs = 0
    this._inRange = false
    this._passedOpponent = false
    this._fixedMovementStrategy = false
    this._chaseStrategy = null
    this._strategyHoldMs = 0
    this._statusFingerprint = ''
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
    this._movement.setLoopParams(sheet.strategy.loopAround)
    this._movement.setTurnRate(sheet.strategy.turnRateDeg)
    this._syncRangeVisual()

    this._movement.reset()
    if (this._phase === 'reachGate') {
      this._movement.setStrategy('synchronizedLerp')
      const aim = this._refreshGateAim()
      this._movement.beginJourney(
        { x: spawn.x, y: spawn.y, z: spawn.z },
        { x: aim.x, y: aim.y, z: aim.z },
        this._cruiseSpeed * this._reachSpeedMul,
        this._pathSide,
      )
    } else {
      this._beginChaseStrategy(true)
    }
  }

  deactivate(): void {
    this.active = false
    this.visible = false
    this.hp = 0
    this._phase = 'reachGate'
    this._currentSpeed = 0
    this._fireAcc = 0
    this._entryOffsetX = 0
    this._pathSide = 'front'
    this._hittedMs = 0
    this._hittingMs = 0
    this._inRange = false
    this._passedOpponent = false
    this._fixedMovementStrategy = false
    this._chaseStrategy = null
    this._rangeMesh.visible = false
    this._movement.reset()
  }

  gateEntryOffsetX(): number {
    return this._entryOffsetX
  }

  /** Called when this enemy takes damage (player shot). */
  notifyHitted(): void {
    this._hittedMs = Math.max(this._hittedMs, this._sheet.status.hittedCdMs)
  }

  /** Called when this enemy deals contact / opens fire. */
  notifyHitting(): void {
    this._hittingMs = Math.max(this._hittingMs, this._sheet.status.hittingCdMs)
  }

  update(dt: number): void {
    if (!this.active) {
      return
    }

    this._tickStatus(dt)

    const targetSpeed =
      this._phase === 'reachGate' ? this._cruiseSpeed * this._reachSpeedMul : this._cruiseSpeed
    this._currentSpeed = damp(this._currentSpeed, targetSpeed, this._agilityLambda, dt)
    this.vehicle.maxSpeed = this._currentSpeed

    if (this._phase === 'chase') {
      this._maybeSwapStrategy(dt)
    }

    this._pos.x = this.x
    this._pos.y = this.y
    this._pos.z = this.z
    const aim = this._phase === 'reachGate' ? this._refreshGateAim() : this._seek
    const { arrived } = this._movement.update({
      position: this._pos,
      dt,
      currentSpeed: this._currentSpeed,
      target: { x: aim.x, y: aim.y, z: aim.z },
      arriveRadius: this._arriveRadius,
      agilityLambda: this._agilityLambda,
    })
    this.x = this._pos.x
    this.y = this._pos.y
    this.z = this._pos.z

    if (this._phase === 'reachGate' && arrived) {
      this._phase = 'chase'
      this._beginChaseStrategy(true)
    } else if (this._phase === 'chase' && arrived && this._chaseStrategy === 'loop_around') {
      this._fixedMovementStrategy = false
      this._beginChaseStrategy(true)
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
    this.rotation.y = this._movement.facingY()
    this._mat.opacity = this.hpMax > 0 ? clamp(this.hp / this.hpMax, 0.2, 1) : 0.2
    this._rangeMesh.visible = this._sheet.status.rangeVisible
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
    if (dealt > 0) {
      this.notifyHitted()
    }
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
        destroyed: false,
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
    this._rangeMesh.geometry.dispose()
    this._rangeMat.dispose()
  }

  private _activeStatuses(): ActiveStatuses {
    return {
      hitted: this._hittedMs > 0,
      hitting: this._hittingMs > 0,
      in_range: this._inRange,
      passed_opponent: this._passedOpponent,
      fixed_movement_strategy: this._fixedMovementStrategy,
    }
  }

  private _statusKey(active: ActiveStatuses): string {
    return [
      active.hitted ? 1 : 0,
      active.hitting ? 1 : 0,
      active.in_range ? 1 : 0,
      active.passed_opponent ? 1 : 0,
    ].join('')
  }

  private _tickStatus(dt: number): void {
    const dtMs = dt * 1000
    if (this._hittedMs > 0) {
      this._hittedMs = Math.max(0, this._hittedMs - dtMs)
    }
    if (this._hittingMs > 0) {
      this._hittingMs = Math.max(0, this._hittingMs - dtMs)
    }
    const r = this._sheet.status.inRangeRadius
    this._inRange = distXZ(this.x, this.z, this._seek.x, this._seek.z) <= r
    // Enemy advances +Z; once past the player's Z it is "passed".
    this._passedOpponent = this.z >= this._seek.z
  }

  private _maybeSwapStrategy(dt: number): void {
    // Loop locks strategy until the maneuver finishes.
    if (this._fixedMovementStrategy) {
      return
    }
    if (this._chaseStrategy === null) {
      this._beginChaseStrategy(true)
      return
    }

    this._strategyHoldMs -= dt * 1000
    const active = this._activeStatuses()
    const key = this._statusKey(active)
    const statusChanged = key !== this._statusFingerprint
    this._statusFingerprint = key

    let swap = this._strategyHoldMs <= 0
    if (!swap && statusChanged && this._rand() * 100 < this._intelligence) {
      swap = true
    }
    if (swap) {
      this._beginChaseStrategy(true)
    }
  }

  private _beginChaseStrategy(force: boolean): void {
    if (this._fixedMovementStrategy && !force) {
      return
    }

    const weights = effectiveStrategyWeights(
      this._sheet.strategy.weights,
      this._sheet.strategy.mods,
      this._activeStatuses(),
    )
    const next = pickChaseStrategy(weights, this._rand)
    if (!force && next === this._chaseStrategy) {
      this._strategyHoldMs = strategyHoldMs(
        this._intelligence,
        this._sheet.strategy.swapBaseMs,
      )
      return
    }
    this._chaseStrategy = next
    this._fixedMovementStrategy = next === 'loop_around'
    this._strategyHoldMs = strategyHoldMs(this._intelligence, this._sheet.strategy.swapBaseMs)
    this._statusFingerprint = this._statusKey(this._activeStatuses())
    this._movement.setLoopParams(this._sheet.strategy.loopAround)
    this._movement.setTurnRate(this._sheet.strategy.turnRateDeg)
    this._movement.setStrategy(next as MoveStrategyId)
    this._movement.beginJourney(
      { x: this.x, y: this.y, z: this.z },
      { x: this._seek.x, y: this._seek.y, z: this._seek.z },
      this._cruiseSpeed,
    )
  }

  private _syncRangeVisual(): void {
    const r = Math.max(0.5, this._sheet.status.inRangeRadius)
    this._rangeMesh.scale.setScalar(r)
    this._rangeMat.color.setHex(this._sheet.status.rangeColor)
    this._rangeMat.opacity = this._sheet.status.rangeOpacity
    this._rangeMesh.visible = this.active && this._sheet.status.rangeVisible
  }

  private _refreshGateAim(): { x: number; y: number; z: number } {
    this._gateAim.x = this._gate.x + this._entryOffsetX
    this._gateAim.y = this._gate.y
    this._gateAim.z = this._gate.z
    return this._gateAim
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
    const halfCone = (Math.max(1, weapon.fireConeDeg) * DEG2RAD) / 2
    if (
      !isInsideFireCone(
        this.x,
        this.z,
        this._movement.facingY(),
        this._seek.x,
        this._seek.z,
        halfCone,
      )
    ) {
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

  private _fireBolt(weapon: EditableWarriorSheet['weapon']): void {
    if (!this._shots) {
      return
    }
    const shot = this._shots.acquire()
    if (!shot) {
      return
    }
    const facing = this._movement.facingY()
    const speed = Math.abs(weapon.speed)
    const muzzle = weapon.muzzleZ
    const dirX = Math.sin(facing)
    const dirZ = Math.cos(facing)
    const spawn: ShotSpawn = {
      x: this.x + dirX * muzzle,
      z: this.z + dirZ * muzzle,
      vx: dirX * speed,
      vz: dirZ * speed,
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
    this.notifyHitting()
  }
}
