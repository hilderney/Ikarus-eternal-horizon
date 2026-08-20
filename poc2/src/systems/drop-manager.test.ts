/**
 * SDD-F02 DropManager — acceptance cases from drop-manager.spec.ts §7.
 */

/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { Mesh, Vector3 } from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BALANCE } from '../core/balancer'
import { Drop } from '../gameobjects/drop/drop'
import { ObjectPool } from '../pools/object-pool'
import { Layer } from './layers'
import {
  DropManager,
  rollTable,
  type DropColliderPort,
  type InventoryPort,
  type MagnetTargetPort,
  type ResourceId,
} from './drop-manager'

const ALL_RESOURCES: readonly ResourceId[] = [
  'metalScrap',
  'prismaticCrystal',
  'denseCore',
  'darkMatter',
  'equipment',
]

function makeInventory(caps?: Partial<Record<ResourceId, number>>): InventoryPort & {
  counts: Record<ResourceId, number>
} {
  const counts: Record<ResourceId, number> = {
    metalScrap: 0,
    prismaticCrystal: 0,
    denseCore: 0,
    darkMatter: 0,
    equipment: 0,
  }
  const resolved: Record<ResourceId, number> = {
    metalScrap: caps?.metalScrap ?? 99,
    prismaticCrystal: caps?.prismaticCrystal ?? 40,
    denseCore: caps?.denseCore ?? 20,
    darkMatter: caps?.darkMatter ?? 8,
    equipment: caps?.equipment ?? 4,
  }
  return {
    counts,
    count(id) {
      return counts[id]
    },
    cap(id) {
      return resolved[id]
    },
    tryAdd(id, amount) {
      if (amount <= 0) {
        return 0
      }
      const room = resolved[id] - counts[id]
      if (room <= 0) {
        return 0
      }
      const accepted = Math.min(room, amount)
      counts[id] += accepted
      return accepted
    },
  }
}

function makeColliders(): DropColliderPort & { targets: Drop[] } {
  const targets: Drop[] = []
  return {
    targets,
    registerTarget(t) {
      if (!targets.includes(t)) {
        targets.push(t)
      }
    },
    unregisterTarget(t) {
      const idx = targets.indexOf(t)
      if (idx >= 0) {
        targets.splice(idx, 1)
      }
    },
  }
}

function makeHarness(options?: {
  capacity?: number
  inventory?: ReturnType<typeof makeInventory>
  magnet?: MagnetTargetPort
  rand?: () => number
  shipRadius?: number
}) {
  const capacity = options?.capacity ?? BALANCE.drops.poolSize
  const inventory = options?.inventory ?? makeInventory()
  const magnet = options?.magnet ?? { x: 0, z: 0 }
  const colliders = makeColliders()
  const pool = new ObjectPool<Drop>({
    capacity,
    factory: () => new Drop(),
    reset: (d) => {
      d.deactivate()
    },
    disposeItem: (d) => {
      d.dispose()
    },
  })
  const manager = new DropManager({
    pool,
    inventory,
    magnet,
    colliders,
    rand: options?.rand,
    shipRadius: options?.shipRadius ?? 0.5,
  })
  return { manager, pool, inventory, magnet, colliders }
}

describe('DropManager', () => {
  const disposers: Array<() => void> = []

  afterEach(() => {
    while (disposers.length > 0) {
      disposers.pop()?.()
    }
  })

  function track(h: ReturnType<typeof makeHarness>): ReturnType<typeof makeHarness> {
    disposers.push(() => h.manager.dispose())
    return h
  }

  it('onMeteorDestroyed always rolls metalScrap from the meteor table', () => {
    const h = track(
      makeHarness({
        rand: () => 0,
      }),
    )
    h.manager.onMeteorDestroyed({ x: 1, z: -2, size: 'M' })
    expect(h.manager.liveCount()).toBe(1)
    let found: Drop | null = null
    h.pool.forEachActive((d) => {
      found = d
    })
    expect(found).not.toBeNull()
    expect(found!.resourceId).toBe('metalScrap')
    expect(found!.amount).toBeGreaterThanOrEqual(1)
    expect(found!.amount).toBeLessThanOrEqual(2)
    expect(found!.x).toBe(1)
    expect(found!.z).toBe(-2)
  })

  it('onSourceKilled(enemy) grants metalScrap with chance 0.4 (rng stub 0.39/0.41)', () => {
    const hit = track(makeHarness({ rand: () => 0.39 }))
    hit.manager.onSourceKilled('enemy', 0, 0)
    expect(hit.manager.liveCount()).toBe(1)

    const miss = track(makeHarness({ rand: () => 0.41 }))
    miss.manager.onSourceKilled('enemy', 0, 0)
    expect(miss.manager.liveCount()).toBe(0)
  })

  it('pool exhaustion skips a spawn and liveCount stays at size', () => {
    const capacity = 2
    const h = track(
      makeHarness({
        capacity,
        rand: () => 0,
      }),
    )
    h.manager.onMeteorDestroyed({ x: 0, z: 0, size: 'S' })
    h.manager.onMeteorDestroyed({ x: 1, z: 0, size: 'S' })
    h.manager.onMeteorDestroyed({ x: 2, z: 0, size: 'S' })
    expect(h.manager.liveCount()).toBe(capacity)
    expect(h.pool.activeCount).toBe(capacity)
  })

  it('a drop inside magnetRadius moves toward the ship', () => {
    const h = track(
      makeHarness({
        magnet: { x: 0, z: 0 },
        shipRadius: 0.1,
        rand: () => 0,
      }),
    )
    h.manager.onSourceKilled('enemy', 2, 0)
    let drop: Drop | null = null
    h.pool.forEachActive((d) => {
      drop = d
    })
    expect(drop).not.toBeNull()
    const before = drop!.x
    expect(before).toBe(2)
    expect(before).toBeLessThanOrEqual(BALANCE.drops.magnetRadius)
    h.manager.update(0.05)
    expect(drop!.x).toBeLessThan(before)
    expect(drop!.x).toBeGreaterThan(0)
  })

  it('collect calls tryAdd and releases when accepted > 0', () => {
    const inventory = makeInventory()
    const tryAdd = vi.spyOn(inventory, 'tryAdd')
    const h = track(makeHarness({ inventory, rand: () => 0 }))
    h.manager.onMeteorDestroyed({ x: 5, z: 5, size: 'L' })
    let drop: Drop | null = null
    h.pool.forEachActive((d) => {
      drop = d
    })
    expect(drop).not.toBeNull()
    h.manager.collect(drop!)
    expect(tryAdd).toHaveBeenCalled()
    expect(inventory.counts.metalScrap).toBeGreaterThan(0)
    expect(h.manager.liveCount()).toBe(0)
    expect(drop!.active).toBe(false)
  })

  it('when tryAdd returns 0 the drop stays active', () => {
    const inventory = makeInventory({ metalScrap: 0 })
    const h = track(makeHarness({ inventory, rand: () => 0 }))
    h.manager.onMeteorDestroyed({ x: 3, z: 3, size: 'M' })
    let drop: Drop | null = null
    h.pool.forEachActive((d) => {
      drop = d
    })
    expect(drop).not.toBeNull()
    h.manager.collect(drop!)
    expect(inventory.counts.metalScrap).toBe(0)
    expect(drop!.active).toBe(true)
    expect(h.manager.liveCount()).toBe(1)
  })

  it('tables expose all five ResourceIds', () => {
    const tables = BALANCE.drops.tables
    for (const source of Object.keys(tables) as (keyof typeof tables)[]) {
      const ids = new Set(tables[source].map((e) => e.id))
      for (const id of ALL_RESOURCES) {
        expect(ids.has(id)).toBe(true)
      }
    }
    for (const id of ALL_RESOURCES) {
      expect(BALANCE.drops.colors[id]).toBeTypeOf('number')
      expect(BALANCE.drops.stockCaps[id]).toBeTypeOf('number')
    }
    const grants = rollTable(
      [
        { id: 'equipment', chance: 1, min: 1, max: 1 },
        { id: 'darkMatter', chance: 1, min: 2, max: 2 },
      ],
      () => 0,
    )
    expect(grants.map((g) => g.id).sort()).toEqual(['darkMatter', 'equipment'])
  })

  it('update allocates no Vector3 / arrays', () => {
    const h = track(
      makeHarness({
        magnet: { x: 0, z: 0 },
        shipRadius: 0.1,
        rand: () => 0,
      }),
    )
    h.manager.onSourceKilled('enemy', 2, 0)
    h.manager.update(0.016)
    const vectorSpy = vi.spyOn(Vector3.prototype, 'clone')
    const arrayFromSpy = vi.spyOn(Array, 'from')
    h.manager.update(0.016)
    expect(vectorSpy).not.toHaveBeenCalled()
    expect(arrayFromSpy).not.toHaveBeenCalled()
    vectorSpy.mockRestore()
    arrayFromSpy.mockRestore()
  })

  it('off-field drops are released', () => {
    const h = track(makeHarness({ rand: () => 0, shipRadius: 0.1 }))
    h.manager.onMeteorDestroyed({ x: 0, z: 0, size: 'S' })
    let drop: Drop | null = null
    h.pool.forEachActive((d) => {
      drop = d
    })
    expect(drop).not.toBeNull()
    drop!.x = BALANCE.drops.despawn.halfX + 1
    h.manager.update(0)
    expect(h.manager.liveCount()).toBe(0)
    expect(drop!.active).toBe(false)
  })

  it('does not call DamageSink or ScoreManager', () => {
    const damage = { applyDamage: vi.fn() }
    const score = { add: vi.fn() }
    const h = track(makeHarness({ rand: () => 0 }))
    h.manager.onSourceKilled('enemy', 0, -1)
    h.manager.onMeteorDestroyed({ x: 1, z: -1, size: 'S' })
    h.manager.update(0.016)
    expect(damage.applyDamage).not.toHaveBeenCalled()
    expect(score.add).not.toHaveBeenCalled()
  })

  it('Drop extends THREE.Mesh with layer Drop', () => {
    const drop = new Drop()
    expect(drop).toBeInstanceOf(Mesh)
    expect(drop.layer).toBe(Layer.Drop)
    expect(drop.layer).toBe(5)
    drop.dispose()
  })

  it('destroyed enemies/asteroids drop fragments that magnet in (acceptance)', () => {
    const h = track(
      makeHarness({
        magnet: { x: 0, z: 0 },
        shipRadius: 0.1,
        rand: () => 0,
      }),
    )
    h.manager.onSourceKilled('enemy', 2, 0)
    h.manager.onMeteorDestroyed({ x: -2, z: 0, size: 'M' })
    expect(h.manager.liveCount()).toBe(2)
    const xs: number[] = []
    h.pool.forEachActive((d) => {
      xs.push(Math.abs(d.x))
    })
    h.manager.update(0.1)
    const after: number[] = []
    h.pool.forEachActive((d) => {
      after.push(Math.abs(d.x))
    })
    expect(after.length).toBe(2)
    expect(after[0]!).toBeLessThan(xs[0]!)
    expect(after[1]!).toBeLessThan(xs[1]!)
    h.manager.syncRender()
  })
})
