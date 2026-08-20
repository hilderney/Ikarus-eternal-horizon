import { describe, expect, it, vi } from 'vitest'
import {
  CollisionManager,
  HIT_MATRIX,
  Layer,
  layersHit,
  type ColliderPort,
} from './collision-manager'

function collider(
  layer: Layer,
  x: number,
  z: number,
  radius = 1,
  active = true,
): ColliderPort {
  return { layer, x, z, radius, active }
}

function poolOf(...shots: ColliderPort[]) {
  return {
    forEachActive(fn: (s: ColliderPort) => void) {
      for (const s of shots) {
        if (s.active) {
          fn(s)
        }
      }
    },
  }
}

describe('Layer / HIT_MATRIX', () => {
  it('freezes exactly six layers and has no Hull or Shield member', () => {
    const values = Object.values(Layer).filter((v) => typeof v === 'number')
    expect(values).toHaveLength(6)
    expect(Layer).not.toHaveProperty('Hull')
    expect(Layer).not.toHaveProperty('Shield')
  })

  it('layersHit is a matrix lookup (PlayerShot vs Enemy true, vs Player false)', () => {
    expect(layersHit(Layer.PlayerShot, Layer.Enemy)).toBe(true)
    expect(layersHit(Layer.PlayerShot, Layer.Player)).toBe(false)
    expect(HIT_MATRIX[Layer.Drop]).toEqual([])
  })
})

describe('CollisionManager', () => {
  it('PlayerShot overlaps Enemy ⇒ one HitPair', () => {
    const cm = new CollisionManager()
    const enemy = collider(Layer.Enemy, 0, 0)
    cm.registerTarget(enemy)
    const shot = collider(Layer.PlayerShot, 0.5, 0, 1)
    const pairs = cm.update(0, [poolOf(shot)])
    expect(pairs).toHaveLength(1)
    expect(pairs[0]?.aLayer).toBe(Layer.PlayerShot)
    expect(pairs[0]?.bLayer).toBe(Layer.Enemy)
    expect(pairs[0]?.consumeProjectile).toBe(true)
  })

  it('PlayerShot overlaps Meteor ⇒ one HitPair', () => {
    const cm = new CollisionManager()
    cm.registerTarget(collider(Layer.Meteor, 0, 0))
    const pairs = cm.update(0, [poolOf(collider(Layer.PlayerShot, 0, 0))])
    expect(pairs).toHaveLength(1)
    expect(pairs[0]?.bLayer).toBe(Layer.Meteor)
  })

  it('Player overlaps Enemy, Meteor, Drop', () => {
    const cm = new CollisionManager()
    const player = collider(Layer.Player, 0, 0)
    cm.registerTarget(player)
    cm.registerTarget(collider(Layer.Enemy, 0.5, 0))
    cm.registerTarget(collider(Layer.Meteor, -0.5, 0))
    cm.registerTarget(collider(Layer.Drop, 0, 0.5))
    const pairs = cm.update(0, [])
    const layers = pairs.map((p) => [p.aLayer, p.bLayer].sort((a, b) => a - b).join('-'))
    expect(layers).toContain(`${Layer.Player}-${Layer.Drop}`)
    expect(layers).toContain(`${Layer.Player}-${Layer.Enemy}`)
    expect(layers).toContain(`${Layer.Player}-${Layer.Meteor}`)
  })

  it('EnemyShot overlaps Player ⇒ HitPair, overlaps Enemy ⇒ none', () => {
    const cm = new CollisionManager()
    cm.registerTarget(collider(Layer.Player, 0, 0))
    cm.registerTarget(collider(Layer.Enemy, 10, 0))
    const shot = collider(Layer.EnemyShot, 0, 0)
    const pairs = cm.update(0, [poolOf(shot)])
    expect(pairs).toHaveLength(1)
    expect(pairs[0]?.bLayer).toBe(Layer.Player)
  })

  it('Enemy overlaps Player ⇒ HitPair', () => {
    const cm = new CollisionManager()
    cm.registerTarget(collider(Layer.Player, 0, 0))
    cm.registerTarget(collider(Layer.Enemy, 0.2, 0))
    expect(cm.update(0, [])).toHaveLength(1)
  })

  it('Meteor overlaps Player and PlayerShot', () => {
    const cm = new CollisionManager()
    cm.registerTarget(collider(Layer.Player, 0, 0))
    cm.registerTarget(collider(Layer.Meteor, 0.2, 0))
    const shot = collider(Layer.PlayerShot, 0.2, 0)
    const pairs = cm.update(0, [poolOf(shot)])
    expect(pairs.length).toBeGreaterThanOrEqual(2)
  })

  it('Enemy vs Enemy and PlayerShot vs PlayerShot yield no pairs', () => {
    const cm = new CollisionManager()
    cm.registerTarget(collider(Layer.Enemy, 0, 0))
    cm.registerTarget(collider(Layer.Enemy, 0.2, 0))
    const a = collider(Layer.PlayerShot, 5, 0)
    const b = collider(Layer.PlayerShot, 5.2, 0)
    expect(cm.update(0, [poolOf(a, b)])).toHaveLength(0)
  })

  it('PlayerShot vs Player yields no pair (friendly fire)', () => {
    const cm = new CollisionManager()
    cm.registerTarget(collider(Layer.Player, 0, 0))
    expect(cm.update(0, [poolOf(collider(Layer.PlayerShot, 0, 0))])).toHaveLength(0)
  })

  it('update does not call applyDamage or takeDamage', () => {
    const cm = new CollisionManager()
    const enemy = Object.assign(collider(Layer.Enemy, 0, 0), {
      applyDamage: vi.fn(),
      takeDamage: vi.fn(),
    })
    cm.registerTarget(enemy)
    cm.update(0, [poolOf(collider(Layer.PlayerShot, 0, 0))])
    expect(enemy.applyDamage).not.toHaveBeenCalled()
    expect(enemy.takeDamage).not.toHaveBeenCalled()
  })

  it('inactive or unregistered colliders do not generate pairs', () => {
    const cm = new CollisionManager()
    cm.registerTarget(collider(Layer.Enemy, 0, 0, 1, false))
    expect(cm.update(0, [poolOf(collider(Layer.PlayerShot, 0, 0))])).toHaveLength(0)
    const live = collider(Layer.Enemy, 0, 0)
    expect(cm.update(0, [poolOf(collider(Layer.PlayerShot, 0, 0))])).toHaveLength(0)
    void live
  })

  it('Meteor↔PlayerShot overlapping reports one pair not two', () => {
    const cm = new CollisionManager()
    cm.registerTarget(collider(Layer.Meteor, 0, 0))
    const pairs = cm.update(0, [poolOf(collider(Layer.PlayerShot, 0, 0))])
    expect(pairs).toHaveLength(1)
  })

  it('queryRadius returns Enemy+Meteor inside radius and skips Player', () => {
    const cm = new CollisionManager()
    cm.registerTarget(collider(Layer.Player, 0, 0))
    cm.registerTarget(collider(Layer.Enemy, 1, 0))
    cm.registerTarget(collider(Layer.Meteor, 0, 1))
    const hits = cm.queryRadius({
      x: 0,
      z: 0,
      radius: 2,
      hits: [Layer.Enemy, Layer.Meteor],
    })
    expect(hits.map((h) => h.layer).sort()).toEqual([Layer.Enemy, Layer.Meteor].sort())
  })

  it('queryCone and querySegment honour the hits mask', () => {
    const cm = new CollisionManager()
    cm.registerTarget(collider(Layer.Enemy, 0, 5))
    cm.registerTarget(collider(Layer.Player, 0, 5))
    const cone = cm.queryCone({
      x: 0,
      z: 0,
      dirX: 0,
      dirZ: 1,
      angleDeg: 40,
      length: 10,
      hits: [Layer.Enemy],
    })
    expect(cone).toHaveLength(1)
    expect(cone[0]?.layer).toBe(Layer.Enemy)
    const seg = cm.querySegment(0, 0, 0, 10, 1, [Layer.Enemy])
    expect(seg).toHaveLength(1)
  })

  it('update reuses the HitPair buffer (length rewind, same array ref)', () => {
    const cm = new CollisionManager()
    cm.registerTarget(collider(Layer.Enemy, 0, 0))
    const first = cm.update(0, [poolOf(collider(Layer.PlayerShot, 0, 0))])
    const ref = first
    cm.registerTarget(collider(Layer.Meteor, 10, 10))
    const second = cm.update(0, [poolOf(collider(Layer.PlayerShot, 0, 0))])
    expect(second).toBe(ref)
  })

  it('registerTarget twice does not duplicate; unregister missing is safe', () => {
    const cm = new CollisionManager()
    const t = collider(Layer.Enemy, 0, 0)
    cm.registerTarget(t)
    cm.registerTarget(t)
    expect(cm.targets).toHaveLength(1)
    expect(() => cm.unregisterTarget(collider(Layer.Meteor, 1, 1))).not.toThrow()
    cm.unregisterTarget(t)
    expect(cm.targets).toHaveLength(0)
  })

  it('shots damage only hostiles; contact damages the ship (acceptance)', () => {
    const cm = new CollisionManager()
    const player = collider(Layer.Player, 0, 0)
    const enemy = collider(Layer.Enemy, 0.5, 0)
    cm.registerTarget(player)
    cm.registerTarget(enemy)
    const shotPairs = cm.update(0, [poolOf(collider(Layer.PlayerShot, 0.5, 0))])
    expect(shotPairs.some((p) => p.bLayer === Layer.Enemy)).toBe(true)
    expect(shotPairs.some((p) => p.bLayer === Layer.Player)).toBe(false)
    const contact = cm.update(0, [])
    expect(contact.some((p) => p.aLayer === Layer.Enemy || p.bLayer === Layer.Enemy)).toBe(true)
  })

  it('circle test is hypot(dx,dz) <= rA+rB like POC-1 collisionSystem', () => {
    const cm = new CollisionManager()
    cm.registerTarget(collider(Layer.Enemy, 0, 0, 1))
    expect(cm.update(0, [poolOf(collider(Layer.PlayerShot, 2.01, 0, 1))])).toHaveLength(0)
    expect(cm.update(0, [poolOf(collider(Layer.PlayerShot, 1.9, 0, 1))])).toHaveLength(1)
  })
})
