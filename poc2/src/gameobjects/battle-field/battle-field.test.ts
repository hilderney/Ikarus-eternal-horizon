import { describe, expect, it } from 'vitest'
import { LineSegments } from 'three'
import { BALANCE } from '../../core/balancer'
import { BattleField } from './battle-field'

describe('BattleField', () => {
  it('builds a named group with blue wall LineSegments', () => {
    const field = new BattleField({ config: BALANCE.battlefield })
    expect(field.group.name).toBe('battleField')
    expect(field.group.children[0]).toBeInstanceOf(LineSegments)
    expect(field.visible()).toBe(true)
    field.dispose()
  })

  it('contains points inside ship-relative offset bounds', () => {
    const field = new BattleField({ config: BALANCE.battlefield })
    field.update({ x: 10, y: 0, z: -5 })
    expect(field.contains(10, -5)).toBe(true)
    expect(field.contains(10 + 240, -5)).toBe(true)
    expect(field.contains(10 - 240, -5 + 30)).toBe(true)
    expect(field.contains(10 + 241, -5)).toBe(false)
    expect(field.contains(10, -5 - 161)).toBe(false)
    expect(field.contains(10, -5 + 31)).toBe(false)
    field.dispose()
  })

  it('syncRender writes twelve wall edges without allocating', () => {
    const field = new BattleField({ config: BALANCE.battlefield })
    field.update({ x: 0, y: 0, z: 0 })
    field.syncRender()
    const lines = field.group.children[0] as LineSegments
    const positions = lines.geometry.getAttribute('position')
    expect(positions.count).toBe(24)
    expect(positions.getX(0)).toBe(BALANCE.battlefield.offsetX.min)
    expect(positions.getZ(0)).toBe(BALANCE.battlefield.offsetZ.min)
    field.dispose()
  })

  it('setVisible toggles group.visible', () => {
    const field = new BattleField({ config: BALANCE.battlefield })
    field.setVisible(false)
    expect(field.group.visible).toBe(false)
    field.dispose()
  })
})
