/**
 * EnemyGroup — macro entity owning a centroid, a heading and a center-free
 * formation. Members only ever read their slot offset from here; the group
 * never moves a ship directly.
 *
 * Two cadences: `integrate(dt)` runs every frame (centroid physics, group
 * separation, containment) while `tick(dtMs)` runs on the staggered structural
 * tick (objective, patrol target, formation re-index).
 */

import { angleDelta, clamp, dampAngle, distXZ, lerp } from '../core/math'
import {
  computeFormationSlots,
  createSlotBuffer,
  type FormationId,
  type FormationParams,
  type SlotOffset,
} from './formation-slots'
import {
  addArrive,
  addContainmentX,
  addSeparation,
  clampSpeed,
  resetAcc,
  truncate,
  type SteerAcc,
} from './steering'
import type { SquadConfig } from './squad-config'

export type GroupObjective = 'patrol' | 'intercept'

/** What EnemyGroup needs from a ship (Enemy satisfies it structurally). */
export interface GroupMemberPort {
  readonly x: number
  readonly z: number
  readonly hp: number
  readonly hpMax: number
  /** −1 releases the ship; the group is null when it leaves. */
  assignSlot(group: EnemyGroup | null, index: number): void
}

export interface GroupWorldContext {
  readonly playerX: number
  readonly playerZ: number
  readonly minX: number
  readonly maxX: number
}

export interface WorldPoint {
  x: number
  z: number
}

export class EnemyGroup {
  readonly id: number
  active = false
  x = 0
  z = 0
  vx = 0
  vz = 0
  /** Travel heading in radians (0 = +Z), rotates the whole formation. */
  heading = 0
  /** Angular velocity of the last frame (rad / sec) — drives curvature sync. */
  omega = 0
  objective: GroupObjective = 'patrol'
  formation: FormationId = 'vWing'

  private readonly _cfg: SquadConfig
  private readonly _rand: () => number
  private readonly _slots: SlotOffset[]
  private readonly _owners: (GroupMemberPort | null)[]
  private readonly _params: {
    circleRadius: number
    vSpacing: number
    vAngleDeg: number
    diamondW: number
    diamondH: number
  }
  private readonly _acc: SteerAcc = { x: 0, z: 0 }
  private readonly _vel: SteerAcc = { x: 0, z: 0 }
  private _count = 0
  private _slotCount = 0
  private _peak = 0
  private _targetX = 0
  private _targetZ = 0
  private _holdMs = 0

  constructor(id: number, config: SquadConfig, rand: () => number = Math.random) {
    this.id = id
    this._cfg = config
    this._rand = rand
    const capacity = Math.max(1, Math.floor(config.maxPerGroup))
    this._slots = createSlotBuffer(capacity)
    this._owners = new Array<GroupMemberPort | null>(capacity).fill(null)
    this._params = {
      circleRadius: config.circleRadius,
      vSpacing: config.vSpacing,
      vAngleDeg: config.vAngleDeg,
      diamondW: config.diamondW,
      diamondH: config.diamondH,
    }
  }

  memberCount(): number {
    return this._count
  }

  peakMembers(): number {
    return this._peak
  }

  capacity(): number {
    return this._owners.length
  }

  hasFreeSlot(): boolean {
    return this._count < this._owners.length
  }

  memberAt(index: number): GroupMemberPort | null {
    return this._owners[index] ?? null
  }

  /** True only when losses whittled a real formation down to this one ship. */
  isLastSurvivor(member: GroupMemberPort): boolean {
    return this._peak >= 2 && this._count === 1 && this._owners[0] === member
  }

  targetX(): number {
    return this._targetX
  }

  targetZ(): number {
    return this._targetZ
  }

  distanceTo(x: number, z: number): number {
    return distXZ(this.x, this.z, x, z)
  }

  /** Pooled activation: places the centroid and rolls a first patrol target. */
  spawnAt(x: number, z: number, ctx: GroupWorldContext): void {
    this.active = true
    this.x = x
    this.z = z
    this.vx = 0
    this.vz = 0
    this.heading = 0
    this.omega = 0
    this.objective = 'patrol'
    this._count = 0
    this._slotCount = 0
    this._peak = 0
    for (let i = 0; i < this._owners.length; i += 1) {
      this._owners[i] = null
    }
    this._rollPatrolTarget(ctx)
  }

  /** Locks the next free slot id for `member`. Returns −1 when full. */
  reserveSlot(member: GroupMemberPort): number {
    if (!this.active || this._count >= this._owners.length) {
      return -1
    }
    const index = this._count
    this._owners[index] = member
    this._count += 1
    this._peak = Math.max(this._peak, this._count)
    this._recomputeSlots()
    member.assignSlot(this, index)
    return index
  }

  /**
   * Releases a member and re-indexes the survivors. The tail member takes the
   * freed id, so slots stay packed and every offset shifts by one template step
   * (ships ease into the new coordinate instead of snapping).
   */
  releaseSlot(member: GroupMemberPort): void {
    let index = -1
    for (let i = 0; i < this._count; i += 1) {
      if (this._owners[i] === member) {
        index = i
        break
      }
    }
    if (index < 0) {
      return
    }
    const last = this._count - 1
    const moved = this._owners[last] ?? null
    this._owners[index] = moved
    this._owners[last] = null
    this._count -= 1
    this._recomputeSlots()
    if (moved && moved !== member) {
      moved.assignSlot(this, index)
    }
    member.assignSlot(null, -1)
    if (this._count === 0) {
      this.active = false
    }
  }

  slotOffsetX(index: number): number {
    return this._slots[index]?.x ?? 0
  }

  slotOffsetZ(index: number): number {
    return this._slots[index]?.z ?? 0
  }

  slotCount(): number {
    return this._slotCount
  }

  /** Rotate a local formation offset by the group heading and add the centroid. */
  localToWorld(localX: number, localZ: number, out: WorldPoint): void {
    const cos = Math.cos(this.heading)
    const sin = Math.sin(this.heading)
    out.x = this.x + localX * cos + localZ * sin
    out.z = this.z - localX * sin + localZ * cos
  }

  /** Live hull ratio of the whole group (0..1). */
  healthRatio(): number {
    let hp = 0
    let max = 0
    for (let i = 0; i < this._count; i += 1) {
      const m = this._owners[i]
      if (!m) {
        continue
      }
      hp += Math.max(0, m.hp)
      max += Math.max(0, m.hpMax)
    }
    return max > 0 ? clamp(hp / max, 0, 1) : 0
  }

  /** Structural tick: objective, patrol countdown, formation template. */
  tick(dtMs: number, ctx: GroupWorldContext): void {
    if (!this.active) {
      return
    }
    if (this._shouldIntercept()) {
      this.objective = 'intercept'
    }

    this._holdMs -= dtMs
    if (this.objective === 'intercept') {
      this._targetX = ctx.playerX
      this._targetZ = ctx.playerZ - this._cfg.interceptStandoffZ
    } else if (this._holdMs <= 0) {
      this._rollPatrolTarget(ctx)
    }

    const next = this._formationForState()
    if (next !== this.formation) {
      this.formation = next
    }
    this._syncParams()
    this._recomputeSlots()
  }

  /** Per-frame centroid physics: arrive + group separation + containment. */
  integrate(dt: number, ctx: GroupWorldContext, groups: readonly EnemyGroup[]): void {
    if (!this.active || dt <= 0) {
      return
    }
    const cfg = this._cfg
    const acc = this._acc
    resetAcc(acc)
    addArrive(
      acc,
      this.x,
      this.z,
      this._targetX,
      this._targetZ,
      this.vx,
      this.vz,
      cfg.groupMaxSpeed,
      cfg.groupArriveRadius,
    )
    for (let i = 0; i < groups.length; i += 1) {
      const other = groups[i]
      if (!other || other === this || !other.active) {
        continue
      }
      addSeparation(
        acc,
        this.x,
        this.z,
        other.x,
        other.z,
        cfg.groupSeparationRadius,
        cfg.groupSeparationWeight,
      )
    }
    addContainmentX(
      acc,
      this.x,
      ctx.minX,
      ctx.maxX,
      cfg.containmentInsetX,
      cfg.containmentExp,
      cfg.containmentWeight,
    )
    truncate(acc, cfg.groupMaxForce)

    const vel = this._vel
    vel.x = this.vx + acc.x * dt
    vel.z = this.vz + acc.z * dt
    clampSpeed(vel, cfg.groupMaxSpeed)
    this.vx = vel.x
    this.vz = vel.z
    this.x += this.vx * dt
    this.z += this.vz * dt

    const speed = Math.hypot(this.vx, this.vz)
    if (speed > 0.05) {
      const previous = this.heading
      this.heading = dampAngle(
        this.heading,
        Math.atan2(this.vx, this.vz),
        cfg.groupTurnLambda,
        dt,
      )
      this.omega = angleDelta(previous, this.heading) / dt
    } else {
      this.omega = 0
    }
  }

  reset(): void {
    this.active = false
    this.objective = 'patrol'
    this._count = 0
    this._slotCount = 0
    this._peak = 0
    this.vx = 0
    this.vz = 0
    this.omega = 0
    for (let i = 0; i < this._owners.length; i += 1) {
      this._owners[i] = null
    }
  }

  private _shouldIntercept(): boolean {
    if (this._peak < 2) {
      return false
    }
    return this._count < this._peak * (1 - this._cfg.casualtyPct)
  }

  private _formationForState(): FormationId {
    if (this.objective === 'intercept') {
      return 'vWing'
    }
    if (this._count >= 6) {
      return 'hollowCircle'
    }
    if (this._count >= 4) {
      return 'hollowDiamond'
    }
    return 'vWing'
  }

  private _rollPatrolTarget(ctx: GroupWorldContext): void {
    const cfg = this._cfg
    const halfX = cfg.arenaHalfX * 0.8
    this._targetX = clamp(
      ctx.playerX + (this._rand() * 2 - 1) * halfX,
      ctx.minX + cfg.containmentInsetX,
      ctx.maxX - cfg.containmentInsetX,
    )
    this._targetZ = ctx.playerZ + lerp(cfg.patrolZMin, cfg.patrolZMax, this._rand())
    const span = Math.max(0, cfg.targetHoldMaxMs - cfg.targetHoldMinMs)
    this._holdMs = cfg.targetHoldMinMs + this._rand() * span
  }

  private _syncParams(): void {
    const cfg = this._cfg
    this._params.circleRadius = cfg.circleRadius
    this._params.vSpacing = cfg.vSpacing
    this._params.vAngleDeg = cfg.vAngleDeg
    this._params.diamondW = cfg.diamondW
    this._params.diamondH = cfg.diamondH
  }

  private _recomputeSlots(): void {
    this._slotCount = computeFormationSlots(
      this.formation,
      this._count,
      this._params as FormationParams,
      this._slots,
    )
  }
}
