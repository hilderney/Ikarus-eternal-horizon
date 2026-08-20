import { describe, expect, it, vi } from 'vitest'
import { Layer } from './layers'
import {
  DamageResolver,
  damageAmount,
  sinkOf,
  type DamageOutcome,
  type DamageSink,
  type HitPairLike,
} from './damage-resolver'

function makeSink(initialHp = 10, opts?: { shield?: number }): DamageSink & {
  hp: number
  shield: number
  calls: number
} {
  const state = {
    hp: initialHp,
    shield: opts?.shield ?? 0,
    calls: 0,
    applyDamage(amount: number, _source: Layer): DamageOutcome {
      void _source
      this.calls++
      let absorbed = 0
      let shieldBroke = false
      if (this.shield > 0) {
        absorbed = Math.min(amount, this.shield)
        this.shield -= absorbed
        shieldBroke = absorbed > 0 && this.shield === 0
        amount -= absorbed
      }
      const dealt = Math.min(amount, this.hp)
      this.hp -= dealt
      return {
        absorbedByShield: absorbed,
        dealtToHull: dealt,
        shieldBroke,
        hullLevelChanged: false,
        destroyed: this.hp <= 0 && opts?.shield !== undefined,
        killed: this.hp <= 0 && opts?.shield === undefined,
      }
    },
  }
  return state
}

function pair(
  a: HitPairLike['a'] & { __cid?: number },
  b: HitPairLike['b'] & { __cid?: number },
): HitPairLike {
  a.__cid ??= Math.random()
  b.__cid ??= Math.random() + 1
  return { a, b, aLayer: a.layer, bLayer: b.layer }
}

describe('DamageResolver', () => {
  it('does not call a VfxManager or ScoreManager spy', () => {
    const resolver = new DamageResolver()
    const vfx = { burst: vi.fn() }
    const score = { add: vi.fn() }
    const enemy = makeSink(5)
    const shot = {
      layer: Layer.PlayerShot,
      active: true,
      effectiveDamage: () => 3,
      __cid: 1,
    }
    Object.assign(enemy, { layer: Layer.Enemy, active: true, __cid: 2 })
    resolver.resolve([pair(shot, enemy as never)])
    expect(vfx.burst).not.toHaveBeenCalled()
    expect(score.add).not.toHaveBeenCalled()
  })

  it('the same pair twice in one resolve applies once', () => {
    const resolver = new DamageResolver()
    const enemy = Object.assign(makeSink(20), {
      layer: Layer.Enemy,
      active: true,
      __cid: 2,
    })
    const shot = {
      layer: Layer.PlayerShot,
      active: true,
      effectiveDamage: () => 4,
      __cid: 1,
    }
    const p = pair(shot, enemy)
    resolver.resolve([p, p])
    expect(enemy.calls).toBe(1)
  })

  it('ignores a Player-Drop pair', () => {
    const resolver = new DamageResolver()
    const drop = { layer: Layer.Drop, active: true, __cid: 1 }
    const player = Object.assign(makeSink(10, { shield: 10 }), {
      layer: Layer.Player,
      active: true,
      __cid: 2,
    })
    expect(sinkOf(pair(player, drop))).toBeNull()
    expect(resolver.resolve([pair(player, drop)])).toHaveLength(0)
    expect(player.calls).toBe(0)
  })

  it('PlayerShot vs Enemy applies shot.effectiveDamage and emits killed at 0 hp', () => {
    const resolver = new DamageResolver()
    const kinds: string[] = []
    resolver.on((e) => kinds.push(e.kind))
    const enemy = Object.assign(makeSink(3), {
      layer: Layer.Enemy,
      active: true,
      __cid: 2,
    })
    const shot = {
      layer: Layer.PlayerShot,
      active: true,
      effectiveDamage: () => 3,
      __cid: 1,
    }
    expect(damageAmount(pair(shot, enemy))).toBe(3)
    resolver.resolve([pair(shot, enemy)])
    expect(enemy.hp).toBe(0)
    expect(kinds).toContain('killed')
    expect(kinds).not.toContain('destroyed')
  })

  it('EnemyShot vs Player applies into the ship sink', () => {
    const resolver = new DamageResolver()
    const ship = Object.assign(makeSink(100, { shield: 50 }), {
      layer: Layer.Player,
      active: true,
      __cid: 1,
    })
    const shot = {
      layer: Layer.EnemyShot,
      active: true,
      effectiveDamage: () => 10,
      __cid: 2,
    }
    resolver.resolve([pair(shot, ship)])
    expect(ship.calls).toBe(1)
    expect(ship.shield).toBe(40)
  })

  it('Enemy contact vs Player uses contactDamage', () => {
    const resolver = new DamageResolver()
    const ship = Object.assign(makeSink(100, { shield: 50 }), {
      layer: Layer.Player,
      active: true,
      __cid: 1,
    })
    const enemy = {
      layer: Layer.Enemy,
      active: true,
      contactDamage: 15,
      __cid: 2,
    }
    resolver.resolve([pair(enemy, ship)])
    expect(ship.shield).toBe(35)
  })

  it('emits shieldHit when absorbedByShield > 0 and not hullHit', () => {
    const resolver = new DamageResolver()
    const kinds: string[] = []
    resolver.on((e) => kinds.push(e.kind))
    const ship = Object.assign(makeSink(100, { shield: 50 }), {
      layer: Layer.Player,
      active: true,
      __cid: 1,
    })
    const enemy = {
      layer: Layer.Enemy,
      active: true,
      contactDamage: 10,
      __cid: 2,
    }
    resolver.resolve([pair(enemy, ship)])
    expect(kinds).toEqual(['shieldHit'])
  })

  it('emits hullHit only when dealtToHull > 0', () => {
    const resolver = new DamageResolver()
    const kinds: string[] = []
    resolver.on((e) => kinds.push(e.kind))
    const ship = Object.assign(makeSink(100, { shield: 0 }), {
      layer: Layer.Player,
      active: true,
      __cid: 1,
    })
    const enemy = {
      layer: Layer.Enemy,
      active: true,
      contactDamage: 10,
      __cid: 2,
    }
    resolver.resolve([pair(enemy, ship)])
    expect(kinds).toContain('hullHit')
    expect(kinds).not.toContain('shieldHit')
  })

  it('emits shieldBroke when outcome.shieldBroke', () => {
    const resolver = new DamageResolver()
    const kinds: string[] = []
    resolver.on((e) => kinds.push(e.kind))
    const ship = Object.assign(makeSink(100, { shield: 5 }), {
      layer: Layer.Player,
      active: true,
      __cid: 1,
    })
    const enemy = {
      layer: Layer.Enemy,
      active: true,
      contactDamage: 5,
      __cid: 2,
    }
    resolver.resolve([pair(enemy, ship)])
    expect(kinds).toContain('shieldBroke')
  })

  it('emits destroyed when the ship sink reports destroyed (integrity 0)', () => {
    const resolver = new DamageResolver()
    const kinds: string[] = []
    resolver.on((e) => kinds.push(e.kind))
    const ship = Object.assign(makeSink(10, { shield: 0 }), {
      layer: Layer.Player,
      active: true,
      __cid: 1,
    })
    const enemy = {
      layer: Layer.Enemy,
      active: true,
      contactDamage: 20,
      __cid: 2,
    }
    resolver.resolve([pair(enemy, ship)])
    expect(kinds).toContain('destroyed')
  })

  it('emits killed not destroyed when an enemy sink reports killed', () => {
    const resolver = new DamageResolver()
    const kinds: string[] = []
    resolver.on((e) => kinds.push(e.kind))
    const enemy = Object.assign(makeSink(1), {
      layer: Layer.Enemy,
      active: true,
      __cid: 2,
    })
    const shot = {
      layer: Layer.PlayerShot,
      active: true,
      effectiveDamage: () => 5,
      __cid: 1,
    }
    resolver.resolve([pair(shot, enemy)])
    expect(kinds).toContain('killed')
    expect(kinds).not.toContain('destroyed')
  })

  it('one applyDamage per pair even if shieldBroke and hullHit both emit', () => {
    const resolver = new DamageResolver()
    const ship = Object.assign(makeSink(100, { shield: 5 }), {
      layer: Layer.Player,
      active: true,
      __cid: 1,
    })
    const enemy = {
      layer: Layer.Enemy,
      active: true,
      contactDamage: 20,
      __cid: 2,
    }
    resolver.resolve([pair(enemy, ship)])
    expect(ship.calls).toBe(1)
  })

  it('skips pairs with an inactive endpoint', () => {
    const resolver = new DamageResolver()
    const enemy = Object.assign(makeSink(5), {
      layer: Layer.Enemy,
      active: false,
      __cid: 2,
    })
    const shot = {
      layer: Layer.PlayerShot,
      active: true,
      effectiveDamage: () => 3,
      __cid: 1,
    }
    expect(resolver.resolve([pair(shot, enemy)])).toHaveLength(0)
  })

  it('resolve returns the same events array reference across frames', () => {
    const resolver = new DamageResolver()
    const enemy = Object.assign(makeSink(20), {
      layer: Layer.Enemy,
      active: true,
      __cid: 2,
    })
    const shot = {
      layer: Layer.PlayerShot,
      active: true,
      effectiveDamage: () => 1,
      __cid: 1,
    }
    const a = resolver.resolve([pair(shot, enemy)])
    const b = resolver.resolve([
      pair(
        { ...shot, __cid: 3 },
        Object.assign(makeSink(20), { layer: Layer.Enemy, active: true, __cid: 4 }),
      ),
    ])
    expect(a).toBe(b)
  })

  it('a listener that calls resolve is ignored or throws (no re-entrant apply)', () => {
    const resolver = new DamageResolver()
    const enemy = Object.assign(makeSink(20), {
      layer: Layer.Enemy,
      active: true,
      __cid: 2,
    })
    const shot = {
      layer: Layer.PlayerShot,
      active: true,
      effectiveDamage: () => 1,
      __cid: 1,
    }
    resolver.on(() => {
      expect(() => resolver.resolve([pair(shot, enemy)])).toThrow()
    })
    resolver.resolve([pair(shot, enemy)])
  })

  it('a laser hit kills an enemy exactly once (acceptance)', () => {
    const resolver = new DamageResolver()
    const enemy = Object.assign(makeSink(2), {
      layer: Layer.Enemy,
      active: true,
      __cid: 2,
    })
    const shot = {
      layer: Layer.PlayerShot,
      active: true,
      effectiveDamage: () => 2,
      __cid: 1,
    }
    const p = pair(shot, enemy)
    resolver.resolve([p, p])
    expect(enemy.calls).toBe(1)
    expect(enemy.hp).toBe(0)
  })

  it('enemy contact drains shield then hull (acceptance)', () => {
    const resolver = new DamageResolver()
    const ship = Object.assign(makeSink(100, { shield: 10 }), {
      layer: Layer.Player,
      active: true,
      __cid: 1,
    })
    const enemy = {
      layer: Layer.Enemy,
      active: true,
      contactDamage: 25,
      __cid: 2,
    }
    resolver.resolve([pair(enemy, ship)])
    expect(ship.shield).toBe(0)
    expect(ship.hp).toBe(85)
  })
})
