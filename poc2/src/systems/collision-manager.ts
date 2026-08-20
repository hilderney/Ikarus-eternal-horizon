/**
 * SDD-F01 CollisionManager — detect-only circle hits on XZ via HIT_MATRIX.
 * Never calls applyDamage / takeDamage (F04 owns that).
 */

import { Layer, HIT_MATRIX, layersHit } from './layers'

export { Layer, HIT_MATRIX, layersHit }

export interface ColliderPort {
  readonly layer: Layer
  active: boolean
  x: number
  z: number
  radius: number
}

export interface HitPair {
  readonly a: ColliderPort
  readonly b: ColliderPort
  readonly aLayer: Layer
  readonly bLayer: Layer
  /** True when the pair includes a projectile that should be released (non-pierce). */
  readonly consumeProjectile: boolean
}

export interface CollisionQuery {
  readonly x: number
  readonly z: number
  readonly radius: number
  readonly hits: readonly Layer[]
}

export interface ConeQuery {
  readonly x: number
  readonly z: number
  readonly dirX: number
  readonly dirZ: number
  readonly angleDeg: number
  readonly length: number
  readonly hits: readonly Layer[]
}

export interface CollisionPool {
  forEachActive(fn: (s: ColliderPort) => void): void
}

export interface CollisionManagerOptions {
  readonly matrix?: Readonly<Record<Layer, readonly Layer[]>>
}

const PROJECTILE_LAYERS: ReadonlySet<Layer> = new Set([Layer.PlayerShot, Layer.EnemyShot])

function overlaps(a: ColliderPort, b: ColliderPort): boolean {
  const dx = a.x - b.x
  const dz = a.z - b.z
  const r = a.radius + b.radius
  return dx * dx + dz * dz <= r * r
}

function pairKey(a: ColliderPort, b: ColliderPort): string {
  const ia = (a as { __cid?: number }).__cid ?? 0
  const ib = (b as { __cid?: number }).__cid ?? 0
  return ia < ib ? `${ia}|${ib}` : `${ib}|${ia}`
}

function isProjectile(layer: Layer): boolean {
  return PROJECTILE_LAYERS.has(layer)
}

function maskAllows(hits: readonly Layer[], layer: Layer): boolean {
  for (let i = 0; i < hits.length; i++) {
    if (hits[i] === layer) {
      return true
    }
  }
  return false
}

export class CollisionManager {
  private readonly _matrix: Readonly<Record<Layer, readonly Layer[]>>
  private readonly _targets: ColliderPort[] = []
  private readonly _pairs: HitPair[] = []
  private readonly _queryBuf: ColliderPort[] = []
  private readonly _seen = new Set<string>()
  private _nextId = 1
  private _pairLen = 0

  constructor(options: CollisionManagerOptions = {}) {
    this._matrix = options.matrix ?? HIT_MATRIX
  }

  get targets(): readonly ColliderPort[] {
    return this._targets
  }

  registerTarget(t: ColliderPort): void {
    if (this._targets.includes(t)) {
      return
    }
    const tagged = t as ColliderPort & { __cid?: number }
    if (tagged.__cid === undefined) {
      tagged.__cid = this._nextId++
    }
    this._targets.push(t)
  }

  unregisterTarget(t: ColliderPort): void {
    const idx = this._targets.indexOf(t)
    if (idx >= 0) {
      this._targets.splice(idx, 1)
    }
  }

  update(_dt: number, pools: readonly CollisionPool[]): readonly HitPair[] {
    void _dt
    this._seen.clear()
    this._pairLen = 0

    for (let p = 0; p < pools.length; p++) {
      pools[p]?.forEachActive((shot) => {
        if (!shot.active) {
          return
        }
        const tagged = shot as ColliderPort & { __cid?: number }
        if (tagged.__cid === undefined) {
          tagged.__cid = this._nextId++
        }
        for (let i = 0; i < this._targets.length; i++) {
          const target = this._targets[i]
          if (!target || !target.active) {
            continue
          }
          this._tryPair(shot, target)
        }
      })
    }

    for (let i = 0; i < this._targets.length; i++) {
      const a = this._targets[i]
      if (!a || !a.active) {
        continue
      }
      for (let j = i + 1; j < this._targets.length; j++) {
        const b = this._targets[j]
        if (!b || !b.active) {
          continue
        }
        this._tryPair(a, b)
      }
    }

    this._pairs.length = this._pairLen
    return this._pairs
  }

  queryRadius(q: CollisionQuery): readonly ColliderPort[] {
    this._queryBuf.length = 0
    for (let i = 0; i < this._targets.length; i++) {
      const t = this._targets[i]
      if (!t || !t.active || !maskAllows(q.hits, t.layer)) {
        continue
      }
      const dx = t.x - q.x
      const dz = t.z - q.z
      const lim = q.radius + t.radius
      if (dx * dx + dz * dz <= lim * lim) {
        this._queryBuf.push(t)
      }
    }
    return this._queryBuf
  }

  queryCone(q: ConeQuery): readonly ColliderPort[] {
    this._queryBuf.length = 0
    const dirLen = Math.hypot(q.dirX, q.dirZ) || 1
    const ndx = q.dirX / dirLen
    const ndz = q.dirZ / dirLen
    const cosHalf = Math.cos((q.angleDeg * 0.5 * Math.PI) / 180)
    for (let i = 0; i < this._targets.length; i++) {
      const t = this._targets[i]
      if (!t || !t.active || !maskAllows(q.hits, t.layer)) {
        continue
      }
      const dx = t.x - q.x
      const dz = t.z - q.z
      const dist = Math.hypot(dx, dz)
      if (dist > q.length + t.radius || dist < 0.0001) {
        continue
      }
      const dot = (dx / dist) * ndx + (dz / dist) * ndz
      if (dot >= cosHalf) {
        this._queryBuf.push(t)
      }
    }
    return this._queryBuf
  }

  querySegment(
    ax: number,
    az: number,
    bx: number,
    bz: number,
    width: number,
    hits: readonly Layer[],
  ): readonly ColliderPort[] {
    this._queryBuf.length = 0
    const abx = bx - ax
    const abz = bz - az
    const abLen2 = abx * abx + abz * abz || 1
    for (let i = 0; i < this._targets.length; i++) {
      const t = this._targets[i]
      if (!t || !t.active || !maskAllows(hits, t.layer)) {
        continue
      }
      const apx = t.x - ax
      const apz = t.z - az
      let tParam = (apx * abx + apz * abz) / abLen2
      if (tParam < 0) {
        tParam = 0
      } else if (tParam > 1) {
        tParam = 1
      }
      const cx = ax + abx * tParam
      const cz = az + abz * tParam
      const dx = t.x - cx
      const dz = t.z - cz
      const lim = width + t.radius
      if (dx * dx + dz * dz <= lim * lim) {
        this._queryBuf.push(t)
      }
    }
    return this._queryBuf
  }

  clear(): void {
    this._targets.length = 0
    this._pairLen = 0
    this._pairs.length = 0
    this._seen.clear()
  }

  private _tryPair(a: ColliderPort, b: ColliderPort): void {
    const directed =
      layersHit(a.layer, b.layer, this._matrix) || layersHit(b.layer, a.layer, this._matrix)
    if (!directed || !overlaps(a, b)) {
      return
    }
    const key = pairKey(a, b)
    if (this._seen.has(key)) {
      return
    }
    this._seen.add(key)

    let left = a
    let right = b
    if (layersHit(b.layer, a.layer, this._matrix) && !layersHit(a.layer, b.layer, this._matrix)) {
      left = b
      right = a
    }

    const pair: HitPair = {
      a: left,
      b: right,
      aLayer: left.layer,
      bLayer: right.layer,
      consumeProjectile: isProjectile(left.layer) || isProjectile(right.layer),
    }
    if (this._pairLen < this._pairs.length) {
      const slot = this._pairs[this._pairLen] as {
        a: ColliderPort
        b: ColliderPort
        aLayer: Layer
        bLayer: Layer
        consumeProjectile: boolean
      }
      slot.a = pair.a
      slot.b = pair.b
      slot.aLayer = pair.aLayer
      slot.bLayer = pair.bLayer
      slot.consumeProjectile = pair.consumeProjectile
    } else {
      this._pairs.push(pair)
    }
    this._pairLen++
  }
}
