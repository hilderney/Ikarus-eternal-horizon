import { describe, expect, it } from 'vitest'
import { BALANCE } from '../core/balancer'
import { BattleField } from '../gameobjects/battle-field/battle-field'
import { EnemyGate } from '../gameobjects/enemy-gate/enemy-gate'
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

function makeManager(capacity = 8): {
  scene: ReturnType<typeof makeScene>
  spawnLeft: SpawnArea
  spawnRight: SpawnArea
  spawnFront: SpawnArea
  enemyGate: EnemyGate
  battleField: BattleField
  manager: EnemyManager
} {
  const scene = makeScene()
  const spawnLeft = new SpawnArea({ config: BALANCE.enemy.spawnLeft, name: 'spawnAreaLeft' })
  const spawnRight = new SpawnArea({ config: BALANCE.enemy.spawnRight, name: 'spawnAreaRight' })
  const spawnFront = new SpawnArea({ config: BALANCE.enemy.spawnFront, name: 'spawnAreaFront' })
  const enemyGate = new EnemyGate({ config: BALANCE.enemy.gate })
  const battleField = new BattleField({
    config: {
      ...BALANCE.battlefield,
      offsetZ: { min: -200, max: 30 },
    },
  })
  for (const area of [spawnLeft, spawnRight, spawnFront]) {
    area.update({ x: 0, y: 0, z: 0 })
    area.syncRender()
  }
  enemyGate.update({ x: 0, y: 0, z: 0 })
  enemyGate.syncRender()
  battleField.update({ x: 0, y: 0, z: 0 })
  battleField.syncRender()
  const gateAim = { x: 0, y: 0, z: -90 }
  const manager = new EnemyManager({
    scene,
    seekTarget: { x: 0, y: 0, z: 0 },
    gateTarget: gateAim,
    spawnLeft,
    spawnRight,
    spawnFront,
    enemyGate,
    battleField,
    capacity,
  })
  return { scene, spawnLeft, spawnRight, spawnFront, enemyGate, battleField, manager }
}

function disposeAll(parts: {
  spawnLeft: SpawnArea
  spawnRight: SpawnArea
  spawnFront: SpawnArea
  enemyGate: EnemyGate
  battleField: BattleField
  manager: EnemyManager
}): void {
  parts.manager.dispose()
  parts.spawnLeft.dispose()
  parts.spawnRight.dispose()
  parts.spawnFront.dispose()
  parts.enemyGate.dispose()
  parts.battleField.dispose()
}

function silenceOtherSides(
  parts: ReturnType<typeof makeManager>,
  keep: 'left' | 'right' | 'front',
): void {
  if (keep !== 'left') {
    parts.spawnLeft.setIntervalSec(99)
  }
  if (keep !== 'right') {
    parts.spawnRight.setIntervalSec(99)
  }
  if (keep !== 'front') {
    parts.spawnFront.setIntervalSec(99)
  }
}

describe('EnemyManager', () => {
  it('spawns from the left when left interval elapses', () => {
    const parts = makeManager()
    silenceOtherSides(parts, 'left')
    expect(parts.manager.activeCount()).toBe(0)
    parts.manager.update(BALANCE.enemy.spawnLeft.intervalSec)
    expect(parts.manager.activeCount()).toBe(1)
    disposeAll(parts)
  })

  it('spawns from the right when right interval elapses', () => {
    const parts = makeManager()
    silenceOtherSides(parts, 'right')
    parts.manager.update(BALANCE.enemy.spawnRight.intervalSec)
    expect(parts.manager.activeCount()).toBe(1)
    const enemyX = parts.manager.spawnOne('right')?.x ?? 0
    expect(enemyX).toBeGreaterThan(0)
    disposeAll(parts)
  })

  it('spawns from the front when front interval elapses', () => {
    const parts = makeManager()
    silenceOtherSides(parts, 'front')
    parts.manager.update(BALANCE.enemy.spawnFront.intervalSec)
    expect(parts.manager.activeCount()).toBe(1)
    const enemy = parts.manager.spawnOne('front')
    expect(Math.abs(enemy?.x ?? 99)).toBeLessThan(10)
    disposeAll(parts)
  })

  it('keeps at most sum of all side maxActive live enemies', () => {
    const parts = makeManager(8)
    parts.spawnLeft.setIntervalSec(0.1)
    parts.spawnRight.setIntervalSec(0.1)
    parts.spawnFront.setIntervalSec(0.1)
    parts.manager.update(1)
    expect(parts.manager.activeCount()).toBe(
      BALANCE.enemy.spawnLeft.maxActive +
        BALANCE.enemy.spawnRight.maxActive +
        BALANCE.enemy.spawnFront.maxActive,
    )
    disposeAll(parts)
  })

  it('spawnOne creates a Warrior from the sheet', () => {
    const parts = makeManager(2)
    const enemy = parts.manager.spawnOne('front')
    expect(enemy?.archetype()).toBe('warrior')
    expect(enemy?.sheet().targets).toEqual(['enemyGate', 'player'])
    disposeAll(parts)
  })

  it('releases enemies that leave the BattleField (pool reuse, no destroy)', () => {
    const parts = makeManager(2)
    silenceOtherSides(parts, 'left')
    parts.spawnLeft.setIntervalSec(99)
    const enemy = parts.manager.spawnOne('left')
    expect(enemy).not.toBeNull()
    if (enemy) {
      enemy.z = -201
    }
    parts.manager.update(0)
    expect(parts.manager.activeCount()).toBe(0)
    expect(parts.manager.spawnOne('right')).not.toBeNull()
    expect(parts.manager.activeCount()).toBe(1)
    disposeAll(parts)
  })

  it('dispose is idempotent', () => {
    const parts = makeManager(1)
    parts.manager.dispose()
    expect(() => parts.manager.dispose()).not.toThrow()
    parts.spawnLeft.dispose()
    parts.spawnRight.dispose()
    parts.spawnFront.dispose()
    parts.enemyGate.dispose()
    parts.battleField.dispose()
  })
})

describe('EnemyManager lanes', () => {
  it('cycles lanesX for successive spawnOne calls on the same side', () => {
    const parts = makeManager(3)
    parts.spawnLeft.setLanesX([-4, 0, 4])
    parts.spawnLeft.setMaxActive(3)
    parts.spawnRight.setMaxActive(0)
    parts.spawnFront.setMaxActive(0)
    expect(parts.manager.spawnOne('left')?.x).toBe(BALANCE.enemy.spawnLeft.offset.x - 4)
    expect(parts.manager.spawnOne('left')?.x).toBe(BALANCE.enemy.spawnLeft.offset.x)
    expect(parts.manager.spawnOne('left')?.x).toBe(BALANCE.enemy.spawnLeft.offset.x + 4)
    disposeAll(parts)
  })
})
