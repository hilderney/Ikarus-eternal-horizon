/**
 * SDD-F04 DamageResolver — HitPairs → applyDamage + events. Detect-only stays in F01.
 */

import { Layer } from './layers'

export { Layer }

export interface DamageOutcome {
  readonly absorbedByShield: number
  readonly dealtToHull: number
  readonly shieldBroke: boolean
  readonly hullLevelChanged: boolean
  readonly destroyed: boolean
  readonly killed: boolean
}

export interface DamageSink {
  applyDamage(amount: number, source: Layer): DamageOutcome
}

export type DamageEventKind =
  | 'shieldHit'
  | 'hullHit'
  | 'shieldBroke'
  | 'killed'
  | 'destroyed'

export interface DamageEvent {
  readonly kind: DamageEventKind
  readonly sink: DamageSink
  readonly source: Layer
  readonly amount: number
  readonly outcome: DamageOutcome
}

export interface ShotDamagePort {
  readonly layer: Layer
  active: boolean
  effectiveDamage(): number
}

export interface ContactDamagePort {
  readonly layer: Layer
  readonly contactDamage: number
  readonly active: boolean
}

export interface HitPairLike {
  readonly a: { readonly layer: Layer; active: boolean }
  readonly b: { readonly layer: Layer; active: boolean }
  readonly aLayer: Layer
  readonly bLayer: Layer
}

export type DamageListener = (e: DamageEvent) => void

const PROJECTILES = new Set<Layer>([Layer.PlayerShot, Layer.EnemyShot])
const CONTACTS = new Set<Layer>([Layer.Enemy, Layer.Meteor])

function isShot(o: unknown): o is ShotDamagePort {
  return (
    typeof o === 'object' &&
    o !== null &&
    typeof (o as ShotDamagePort).effectiveDamage === 'function'
  )
}

function isContact(o: unknown): o is ContactDamagePort {
  return (
    typeof o === 'object' &&
    o !== null &&
    typeof (o as ContactDamagePort).contactDamage === 'number'
  )
}

function isSink(o: unknown): o is DamageSink {
  return (
    typeof o === 'object' &&
    o !== null &&
    typeof (o as DamageSink).applyDamage === 'function'
  )
}

export function damageAmount(pair: HitPairLike): number {
  const a = pair.a
  const b = pair.b
  if (PROJECTILES.has(a.layer) && isShot(a)) {
    return a.effectiveDamage()
  }
  if (PROJECTILES.has(b.layer) && isShot(b)) {
    return b.effectiveDamage()
  }
  if (CONTACTS.has(a.layer) && isContact(a)) {
    return a.contactDamage
  }
  if (CONTACTS.has(b.layer) && isContact(b)) {
    return b.contactDamage
  }
  return 0
}

export function sourceLayer(pair: HitPairLike): Layer {
  if (PROJECTILES.has(pair.aLayer) || CONTACTS.has(pair.aLayer)) {
    return pair.aLayer
  }
  if (PROJECTILES.has(pair.bLayer) || CONTACTS.has(pair.bLayer)) {
    return pair.bLayer
  }
  return pair.aLayer
}

export function sinkOf(pair: HitPairLike): DamageSink | null {
  if (pair.aLayer === Layer.Drop || pair.bLayer === Layer.Drop) {
    return null
  }
  const src = sourceLayer(pair)
  const other = pair.aLayer === src ? pair.b : pair.a
  if (other.layer === Layer.Drop) {
    return null
  }
  return isSink(other) ? other : null
}

function pairKey(pair: HitPairLike): string {
  const ia = (pair.a as { __cid?: number }).__cid ?? 0
  const ib = (pair.b as { __cid?: number }).__cid ?? 0
  return ia < ib ? `${ia}|${ib}` : `${ib}|${ia}`
}

export class DamageResolver {
  private readonly _listeners = new Set<DamageListener>()
  private readonly _events: DamageEvent[] = []
  private readonly _seen = new Set<string>()
  private readonly _scratchOutcome: {
    absorbedByShield: number
    dealtToHull: number
    shieldBroke: boolean
    hullLevelChanged: boolean
    destroyed: boolean
    killed: boolean
  } = {
    absorbedByShield: 0,
    dealtToHull: 0,
    shieldBroke: false,
    hullLevelChanged: false,
    destroyed: false,
    killed: false,
  }
  private _resolving = false
  private _eventLen = 0

  on(listener: DamageListener): () => void {
    this._listeners.add(listener)
    return () => {
      this._listeners.delete(listener)
    }
  }

  resolve(pairs: readonly HitPairLike[]): readonly DamageEvent[] {
    if (this._resolving) {
      throw new Error('DamageResolver.resolve re-entrancy is forbidden')
    }
    this._resolving = true
    this._seen.clear()
    this._eventLen = 0
    try {
      for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i]
        if (!pair || !pair.a.active || !pair.b.active) {
          continue
        }
        if (pair.aLayer === Layer.Drop || pair.bLayer === Layer.Drop) {
          continue
        }
        const key = pairKey(pair)
        if (this._seen.has(key)) {
          continue
        }
        this._seen.add(key)

        const sink = sinkOf(pair)
        if (!sink) {
          continue
        }
        const amount = damageAmount(pair)
        if (amount <= 0) {
          continue
        }
        const source = sourceLayer(pair)
        const raw = sink.applyDamage(amount, source)
        const outcome = this._normalize(raw)
        this._emitFacets(sink, source, amount, outcome)
      }
    } finally {
      this._resolving = false
    }
    this._events.length = this._eventLen
    return this._events
  }

  resetFrame(): void {
    this._seen.clear()
  }

  private _normalize(raw: DamageOutcome | Omit<DamageOutcome, 'killed'>): DamageOutcome {
    const killed = 'killed' in raw ? Boolean(raw.killed) : false
    this._scratchOutcome.absorbedByShield = raw.absorbedByShield
    this._scratchOutcome.dealtToHull = raw.dealtToHull
    this._scratchOutcome.shieldBroke = raw.shieldBroke
    this._scratchOutcome.hullLevelChanged = raw.hullLevelChanged
    this._scratchOutcome.destroyed = raw.destroyed
    this._scratchOutcome.killed = killed
    return {
      absorbedByShield: this._scratchOutcome.absorbedByShield,
      dealtToHull: this._scratchOutcome.dealtToHull,
      shieldBroke: this._scratchOutcome.shieldBroke,
      hullLevelChanged: this._scratchOutcome.hullLevelChanged,
      destroyed: this._scratchOutcome.destroyed,
      killed: this._scratchOutcome.killed,
    }
  }

  private _emitFacets(
    sink: DamageSink,
    source: Layer,
    amount: number,
    outcome: DamageOutcome,
  ): void {
    if (outcome.absorbedByShield > 0) {
      this._push('shieldHit', sink, source, amount, outcome)
    }
    if (outcome.dealtToHull > 0) {
      this._push('hullHit', sink, source, amount, outcome)
    }
    if (outcome.shieldBroke) {
      this._push('shieldBroke', sink, source, amount, outcome)
    }
    if (outcome.killed) {
      this._push('killed', sink, source, amount, outcome)
    }
    if (outcome.destroyed) {
      this._push('destroyed', sink, source, amount, outcome)
    }
  }

  private _push(
    kind: DamageEventKind,
    sink: DamageSink,
    source: Layer,
    amount: number,
    outcome: DamageOutcome,
  ): void {
    const event: DamageEvent = { kind, sink, source, amount, outcome }
    if (this._eventLen < this._events.length) {
      const slot = this._events[this._eventLen] as {
        kind: DamageEventKind
        sink: DamageSink
        source: Layer
        amount: number
        outcome: DamageOutcome
      }
      slot.kind = event.kind
      slot.sink = event.sink
      slot.source = event.source
      slot.amount = event.amount
      slot.outcome = event.outcome
    } else {
      this._events.push(event)
    }
    this._eventLen++
    for (const listener of this._listeners) {
      listener(event)
    }
  }
}
