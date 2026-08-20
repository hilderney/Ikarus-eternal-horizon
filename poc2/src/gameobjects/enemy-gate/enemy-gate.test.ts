import { describe, expect, it } from 'vitest'
import { Mesh } from 'three'
import { BALANCE } from '../../core/balancer'
import { EnemyGate } from './enemy-gate'

describe('EnemyGate', () => {
  it('builds a named amber volume behind the front spawn', () => {
    const gate = new EnemyGate({ config: BALANCE.enemy.gate })
    expect(gate.group.name).toBe('enemyGate')
    expect(gate.group.children[0]).toBeInstanceOf(Mesh)
    expect(gate.offset().z).toBe(-90)
    expect(gate.reachSpeedMul()).toBe(3)
    expect(gate.visible()).toBe(true)
    gate.dispose()
  })

  it('worldCenter follows the ship + offset', () => {
    const gate = new EnemyGate({ config: BALANCE.enemy.gate })
    gate.update({ x: 10, y: 0, z: -5 })
    const center = gate.worldCenter()
    expect(center.x).toBe(10)
    expect(center.z).toBe(-5 + BALANCE.enemy.gate.offset.z)
    gate.dispose()
  })
})
