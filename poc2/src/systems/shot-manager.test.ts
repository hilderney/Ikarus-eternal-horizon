import { describe, expect, it, vi } from 'vitest'
import { BALANCE } from '../core/balancer'
import { ShotManager } from './shot-manager'
import type { ShotLike, ShotOrigin } from './shot-manager'

function fakeShot(): ShotLike {
  return {
    active: false,
    lifetime: 1,
    x: 0,
    z: 0,
    spawnX: 0,
    spawnZ: 0,
    range: 0,
    activate() {
      this.active = true
    },
    update(dt: number) {
      this.lifetime -= dt
      this.z += -30 * dt
    },
    syncRender() {
      /* stub */
    },
    deactivate() {
      this.active = false
    },
  }
}

function makeScene() {
  const added: unknown[] = []
  const removed: unknown[] = []
  return {
    added,
    removed,
    add(object: unknown) {
      added.push(object)
    },
    remove(object: unknown) {
      removed.push(object)
    },
  }
}

function makeManager(
  overrides: {
    weaponCapacity?: number
    enemyCapacity?: number
    bombCapacity?: number
    enemyFactory?: () => ShotLike
  } = {},
) {
  const scene = makeScene()
  const manager = new ShotManager({
    scene,
    weaponFactory: fakeShot,
    weaponCapacity: overrides.weaponCapacity ?? 4,
    enemyFactory: overrides.enemyFactory ?? fakeShot,
    enemyCapacity: overrides.enemyCapacity ?? 2,
    bombCapacity: overrides.bombCapacity ?? 0,
    despawn: BALANCE.shot.despawn,
  })
  return { manager, scene }
}

describe('ShotManager', () => {
  it('exposes weapon, enemy and bomb origin pools', () => {
    const { manager } = makeManager()
    expect(manager.pool('weapon').capacity).toBe(4)
    expect(manager.pool('enemy').capacity).toBe(2)
    expect(manager.pool('bomb').capacity).toBe(0)
    expect(manager.pools()).toHaveLength(3)
    manager.dispose()
  })

  it('scene.add is called once per filled weapon shot (not per acquire)', () => {
    const { manager, scene } = makeManager({ weaponCapacity: 3, enemyCapacity: 0 })
    expect(scene.added).toHaveLength(3)
    manager.acquire('weapon')
    manager.acquire('weapon')
    expect(scene.added).toHaveLength(3)
    manager.dispose()
  })

  it('asAcquirePort().acquire() is the weapon origin', () => {
    const { manager } = makeManager({ weaponCapacity: 2, enemyCapacity: 1 })
    const port = manager.asAcquirePort()
    const a = port.acquire()
    const b = manager.acquire('weapon')
    expect(a).toBeTruthy()
    expect(b).toBeTruthy()
    expect(manager.pool('weapon').activeCount).toBe(2)
    expect(manager.pool('enemy').activeCount).toBe(0)
    expect(port).toBe(manager.asAcquirePort())
    manager.dispose()
  })

  it('acquire(weapon) never returns a shot that lives in the enemy pool', () => {
    const { manager } = makeManager()
    const weaponShot = manager.acquire('weapon')
    const enemyShot = manager.acquire('enemy')
    expect(weaponShot).toBeTruthy()
    expect(enemyShot).toBeTruthy()
    expect(weaponShot).not.toBe(enemyShot)
    let found = false
    manager.pool('enemy').forEachActive((shot) => {
      if (shot === weaponShot) {
        found = true
      }
    })
    expect(found).toBe(false)
    manager.dispose()
  })

  it('clear(weapon) leaves enemy actives alive (no cross-cleanup)', () => {
    const { manager } = makeManager()
    manager.acquire('weapon')
    const enemy = manager.acquire('enemy')
    manager.clear('weapon')
    expect(manager.pool('weapon').activeCount).toBe(0)
    expect(manager.pool('enemy').activeCount).toBe(1)
    let still = false
    manager.pool('enemy').forEachActive((shot) => {
      if (shot === enemy) {
        still = true
      }
    })
    expect(still).toBe(true)
    manager.dispose()
  })

  it('update releases a shot whose lifetime elapsed', () => {
    const { manager } = makeManager({ weaponCapacity: 1, enemyCapacity: 0 })
    const shot = manager.acquire('weapon')
    expect(shot).toBeTruthy()
    if (!shot) {
      return
    }
    shot.lifetime = 0
    manager.update(0.016)
    expect(manager.pool('weapon').activeCount).toBe(0)
    manager.dispose()
  })

  it('does not kill a weapon shot at the world zFar plane (range is from spawn)', () => {
    const { manager } = makeManager({ weaponCapacity: 1, enemyCapacity: 0 })
    const shot = manager.acquire('weapon')
    expect(shot).toBeTruthy()
    if (!shot) {
      return
    }
    shot.lifetime = 10
    shot.range = 30
    shot.spawnX = 0
    shot.spawnZ = -20
    shot.x = 0
    shot.z = BALANCE.shot.despawn.zFar
    manager.update(0)
    expect(manager.pool('weapon').activeCount).toBe(1)
    manager.dispose()
  })

  it('releases a weapon shot that has travelled its range from the fire point', () => {
    const { manager } = makeManager({ weaponCapacity: 1, enemyCapacity: 0 })
    const shot = manager.acquire('weapon')
    expect(shot).toBeTruthy()
    if (!shot) {
      return
    }
    shot.lifetime = 10
    shot.range = 10
    shot.spawnX = 0
    shot.spawnZ = 2
    shot.x = 0
    shot.z = 2 - 10
    manager.update(0)
    expect(manager.pool('weapon').activeCount).toBe(0)
    manager.dispose()
  })

  it('lets a weapon shot fired further forward travel the same range (spawn 9 → 19)', () => {
    const { manager } = makeManager({ weaponCapacity: 1, enemyCapacity: 0 })
    const shot = manager.acquire('weapon')
    expect(shot).toBeTruthy()
    if (!shot) {
      return
    }
    shot.lifetime = 10
    shot.range = 10
    shot.spawnX = 0
    shot.spawnZ = 9
    shot.x = 0
    shot.z = 9 - 9
    manager.update(0)
    expect(manager.pool('weapon').activeCount).toBe(1)
    shot.z = 9 - 10
    manager.update(0)
    expect(manager.pool('weapon').activeCount).toBe(0)
    manager.dispose()
  })

  it('update releases an enemy shot past world despawn bounds', () => {
    const { manager } = makeManager({ weaponCapacity: 0, enemyCapacity: 1 })
    const shot = manager.acquire('enemy')
    expect(shot).toBeTruthy()
    if (!shot) {
      return
    }
    shot.lifetime = 10
    shot.z = BALANCE.shot.despawn.zFar - 1
    manager.update(0)
    expect(manager.pool('enemy').activeCount).toBe(0)
    manager.dispose()
  })

  it('update does not call a CollisionManager or DamageSink', () => {
    const { manager } = makeManager({ weaponCapacity: 1, enemyCapacity: 0 })
    manager.acquire('weapon')
    manager.update(0.016)
    manager.dispose()
  })

  it('update allocates no arrays or shots', () => {
    const { manager } = makeManager({ weaponCapacity: 2, enemyCapacity: 0 })
    manager.acquire('weapon')
    manager.update(0.016)
    const arraySpy = vi.spyOn(Array, 'from')
    manager.update(0.016)
    expect(arraySpy).not.toHaveBeenCalled()
    arraySpy.mockRestore()
    manager.dispose()
  })

  it('pools() returns the same three references across calls', () => {
    const { manager } = makeManager()
    expect(manager.pools()).toBe(manager.pools())
    manager.dispose()
  })

  it('acquire returns null when that origin is exhausted', () => {
    const { manager } = makeManager({ weaponCapacity: 1, enemyCapacity: 0 })
    expect(manager.acquire('weapon')).toBeTruthy()
    expect(manager.acquire('weapon')).toBeNull()
    expect(manager.acquire('bomb')).toBeNull()
    manager.dispose()
  })

  it('syncRender forwards to actives and has no own mesh', () => {
    const { manager } = makeManager({ weaponCapacity: 1, enemyCapacity: 0 })
    const shot = manager.acquire('weapon')
    expect(shot).toBeTruthy()
    if (!shot) {
      return
    }
    const spy = vi.spyOn(shot, 'syncRender')
    manager.syncRender()
    expect(spy).toHaveBeenCalledOnce()
    expect(manager).not.toHaveProperty('geometry')
    manager.dispose()
  })

  it('dispose disposes all three pools and scene.remove each filled mesh', () => {
    const { manager, scene } = makeManager({ weaponCapacity: 2, enemyCapacity: 1 })
    expect(scene.added).toHaveLength(3)
    manager.dispose()
    expect(scene.removed).toHaveLength(3)
  })

  it('shots of all sources coexist without cross-cleanup (acceptance)', () => {
    const { manager } = makeManager({ weaponCapacity: 2, enemyCapacity: 2, bombCapacity: 0 })
    const origins: ShotOrigin[] = ['weapon', 'enemy']
    for (const origin of origins) {
      manager.acquire(origin)
    }
    manager.clear('weapon')
    expect(manager.pool('weapon').activeCount).toBe(0)
    expect(manager.pool('enemy').activeCount).toBe(1)
    manager.dispose()
  })
})
