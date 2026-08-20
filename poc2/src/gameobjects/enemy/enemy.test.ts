import { describe, expect, it } from 'vitest'
import { BoxGeometry } from 'three'
import { BALANCE } from '../../core/balancer'
import { Enemy } from './enemy'

describe('Enemy', () => {
  it('activate sets team enemy, hp and visible', () => {
    const seek = { x: 0, z: 0 }
    const geo = new BoxGeometry(1, 1, 1)
    const enemy = new Enemy({ geometry: geo, seekTarget: seek })
    enemy.activate({ x: 1, y: 0, z: -10 })
    expect(enemy.team).toBe('enemy')
    expect(enemy.active).toBe(true)
    expect(enemy.hp).toBe(BALANCE.enemy.generic.hp)
    expect(enemy.visible).toBe(true)
    enemy.dispose()
    geo.dispose()
  })

  it('update drifts toward the seek target without allocating', () => {
    const seek = { x: 0, z: 0 }
    const geo = new BoxGeometry(1, 1, 1)
    const enemy = new Enemy({ geometry: geo, seekTarget: seek })
    enemy.activate({ x: 0, y: 0, z: -10 })
    const before = enemy.z
    enemy.update(0.5)
    expect(enemy.z).toBeGreaterThan(before)
    enemy.dispose()
    geo.dispose()
  })

  it('takeDamage to 0 deactivates once', () => {
    const seek = { x: 0, z: 0 }
    const geo = new BoxGeometry(1, 1, 1)
    const enemy = new Enemy({ geometry: geo, seekTarget: seek })
    enemy.activate({ x: 0, y: 0, z: -5, hp: 2 })
    expect(enemy.applyDamage(2, 0).killed).toBe(true)
    expect(enemy.active).toBe(false)
    expect(enemy.applyDamage(2, 0).killed).toBe(false)
    enemy.dispose()
    geo.dispose()
  })

  it('isOffField follows BALANCE.enemy.despawn', () => {
    const seek = { x: 0, z: 0 }
    const geo = new BoxGeometry(1, 1, 1)
    const enemy = new Enemy({ geometry: geo, seekTarget: seek })
    enemy.activate({ x: 0, y: 0, z: BALANCE.enemy.despawn.zFar - 1 })
    expect(enemy.isOffField()).toBe(true)
    enemy.dispose()
    geo.dispose()
  })
})
