import { describe, expect, it } from 'vitest'
import { Mesh, SphereGeometry } from 'three'
import { BALANCE } from '../../core/balancer'
import { EnemyGate } from './enemy-gate'

describe('EnemyGate', () => {
  it('builds 9 amber wireframe sphere markers (3 per band)', () => {
    const gate = new EnemyGate({ config: BALANCE.enemy.gate })
    expect(gate.group.name).toBe('enemyGate')
    expect(gate.markerCount()).toBe(9)
    expect(gate.markerLocalXs()).toEqual([-24, -18, -12, -6, 0, 6, 12, 18, 24])
    expect(gate.group.children).toHaveLength(9)
    const mesh = gate.group.children[0] as Mesh
    expect(mesh.geometry).toBeInstanceOf(SphereGeometry)
    expect(mesh.material).toMatchObject({ wireframe: true, transparent: true })
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

  it('exposes three entry bands with three local-X slots each', () => {
    const gate = new EnemyGate({ config: BALANCE.enemy.gate })
    expect(gate.entryPointsX('left')).toEqual([-24, -18, -12])
    expect(gate.entryPointsX('middle')).toEqual([-6, 0, 6])
    expect(gate.entryPointsX('right')).toEqual([12, 18, 24])
    gate.dispose()
  })

  it('pickEntryOffsetX stays inside the requested band', () => {
    const gate = new EnemyGate({ config: BALANCE.enemy.gate })
    const left = new Set(BALANCE.enemy.gate.entryPointsX.left)
    const middle = new Set(BALANCE.enemy.gate.entryPointsX.middle)
    const right = new Set(BALANCE.enemy.gate.entryPointsX.right)
    for (let i = 0; i < 40; i++) {
      expect(left.has(gate.pickEntryOffsetX('left'))).toBe(true)
      expect(middle.has(gate.pickEntryOffsetX('middle'))).toBe(true)
      expect(right.has(gate.pickEntryOffsetX('right'))).toBe(true)
    }
    gate.dispose()
  })

  it('worldEntryPoint adds the local offset to gate centre X', () => {
    const gate = new EnemyGate({ config: BALANCE.enemy.gate })
    gate.update({ x: 10, y: 0, z: 0 })
    const entry = gate.worldEntryPoint(-18)
    expect(entry.x).toBe(10 - 18)
    expect(entry.y).toBe(0)
    expect(entry.z).toBe(BALANCE.enemy.gate.offset.z)
    gate.dispose()
  })

  it('syncRender places markers at local entry Xs around the ship-relative centre', () => {
    const gate = new EnemyGate({ config: BALANCE.enemy.gate })
    gate.update({ x: 5, y: 0, z: 0 })
    gate.syncRender()
    expect(gate.group.position.x).toBe(5)
    expect(gate.group.position.z).toBe(BALANCE.enemy.gate.offset.z)
    const first = gate.group.children[0] as Mesh
    expect(first.position.x).toBe(-24)
    gate.dispose()
  })
})
