import { describe, expect, it } from 'vitest'
import { BALANCE } from '../core/balancer'
import { SpawnArea } from '../gameobjects/spawn-area/spawn-area'
import { EnemyManager } from './enemy-manager'

function makeScene() {
  const added: unknown[] = []
  return {
    added,
    add(object: unknown) {
      added.push(object)
    },
    remove(object: unknown) {
      const idx = added.indexOf(object)
      if (idx >= 0) {
        added.splice(idx, 1)
      }
    },
  }
}

describe('EnemyManager', () => {
  it('spawns one enemy when spawnAcc crosses intervalSec', () => {
    const scene = makeScene()
    const spawnArea = new SpawnArea({ config: BALANCE.enemy.spawn })
    spawnArea.update({ x: 0, y: 0, z: 0 })
    spawnArea.syncRender()
    const manager = new EnemyManager({
      scene,
      seekTarget: { x: 0, z: 0 },
      spawnArea,
      capacity: 4,
    })
    expect(manager.activeCount()).toBe(0)
    manager.update(BALANCE.enemy.spawn.intervalSec)
    expect(manager.activeCount()).toBe(1)
    manager.dispose()
    spawnArea.dispose()
  })

  it('keeps at most maxActive live enemies', () => {
    const scene = makeScene()
    const spawnArea = new SpawnArea({ config: BALANCE.enemy.spawn })
    spawnArea.setIntervalSec(0.1)
    spawnArea.update({ x: 0, y: 0, z: 0 })
    spawnArea.syncRender()
    const manager = new EnemyManager({
      scene,
      seekTarget: { x: 0, z: 0 },
      spawnArea,
      capacity: 8,
    })
    manager.update(1)
    expect(manager.activeCount()).toBe(BALANCE.enemy.spawn.maxActive)
    manager.dispose()
    spawnArea.dispose()
  })

  it('spawnOne places the enemy inside the spawn volume', () => {
    const scene = makeScene()
    const spawnArea = new SpawnArea({ config: BALANCE.enemy.spawn })
    spawnArea.update({ x: 2, y: 0, z: -3 })
    spawnArea.syncRender()
    const manager = new EnemyManager({
      scene,
      seekTarget: { x: 0, z: 0 },
      spawnArea,
      capacity: 2,
    })
    const enemy = manager.spawnOne()
    expect(enemy).not.toBeNull()
    const center = spawnArea.worldCenter()
    const size = spawnArea.size()
    expect(Math.abs((enemy?.x ?? 0) - center.x)).toBeLessThanOrEqual(size.x / 2 + 5)
    expect(Math.abs((enemy?.z ?? 0) - center.z)).toBeLessThanOrEqual(size.z / 2 + 0.01)
    manager.dispose()
    spawnArea.dispose()
  })

  it('releases off-field enemies the same update', () => {
    const scene = makeScene()
    const spawnArea = new SpawnArea({ config: BALANCE.enemy.spawn })
    spawnArea.update({ x: 0, y: 0, z: 0 })
    spawnArea.syncRender()
    const manager = new EnemyManager({
      scene,
      seekTarget: { x: 0, z: 0 },
      spawnArea,
      capacity: 2,
    })
    const enemy = manager.spawnOne()
    expect(enemy).not.toBeNull()
    if (enemy) {
      enemy.z = BALANCE.enemy.despawn.zFar - 1
    }
    manager.update(0)
    expect(manager.activeCount()).toBe(0)
    manager.dispose()
    spawnArea.dispose()
  })

  it('dispose is idempotent', () => {
    const scene = makeScene()
    const spawnArea = new SpawnArea({ config: BALANCE.enemy.spawn })
    const manager = new EnemyManager({
      scene,
      seekTarget: { x: 0, z: 0 },
      spawnArea,
      capacity: 1,
    })
    manager.dispose()
    expect(() => manager.dispose()).not.toThrow()
    spawnArea.dispose()
  })
})

describe('EnemyManager lanes', () => {
  it('cycles lanesX for successive spawnOne calls', () => {
    const scene = makeScene()
    const spawnArea = new SpawnArea({ config: BALANCE.enemy.spawn })
    spawnArea.setLanesX([-4, 0, 4])
    spawnArea.setMaxActive(3)
    spawnArea.update({ x: 0, y: 0, z: 0 })
    spawnArea.syncRender()
    const manager = new EnemyManager({
      scene,
      seekTarget: { x: 0, z: 0 },
      spawnArea,
      capacity: 3,
    })
    expect(manager.spawnOne()?.x).toBe(-4)
    expect(manager.spawnOne()?.x).toBe(0)
    expect(manager.spawnOne()?.x).toBe(4)
    manager.dispose()
    spawnArea.dispose()
  })
})
