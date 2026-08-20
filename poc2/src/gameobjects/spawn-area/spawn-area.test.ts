import { describe, expect, it } from 'vitest'
import { Mesh } from 'three'
import { BALANCE } from '../../core/balancer'
import { SpawnArea } from './spawn-area'

const CFG = BALANCE.enemy.spawnLeft

describe('SpawnArea', () => {
  it('builds a named group with a wireframe transparent mesh', () => {
    const area = new SpawnArea({ config: CFG, name: 'spawnAreaLeft' })
    expect(area.group.name).toBe('spawnAreaLeft')
    const mesh = area.group.children[0]
    expect(mesh).toBeInstanceOf(Mesh)
    expect((mesh as Mesh).material).toMatchObject({ wireframe: true, transparent: true })
    expect(area.color()).toBe(CFG.color)
    expect(area.opacity()).toBe(CFG.opacity)
    expect(area.visible()).toBe(true)
    area.dispose()
  })

  it('syncRender places the box at ship + offset with configured size', () => {
    const area = new SpawnArea({ config: CFG })
    area.update({ x: 2, y: 1, z: -3 })
    area.syncRender()
    expect(area.group.position.x).toBeCloseTo(2 + CFG.offset.x, 5)
    expect(area.group.position.y).toBeCloseTo(1 + CFG.offset.y, 5)
    expect(area.group.position.z).toBeCloseTo(-3 + CFG.offset.z, 5)
    const mesh = area.group.children[0] as Mesh
    expect(mesh.scale.x).toBe(CFG.size.x)
    expect(mesh.scale.y).toBe(CFG.size.y)
    expect(mesh.scale.z).toBe(CFG.size.z)
    area.dispose()
  })

  it('setOffset / setSize update the next syncRender', () => {
    const area = new SpawnArea({ config: CFG })
    area.update({ x: 0, y: 0, z: 0 })
    area.setOffset(1, 2, -5)
    area.setSize(8, 3, 10)
    area.syncRender()
    expect(area.group.position.z).toBe(-5)
    const mesh = area.group.children[0] as Mesh
    expect(mesh.scale.x).toBe(8)
    expect(mesh.scale.y).toBe(3)
    expect(mesh.scale.z).toBe(10)
    area.dispose()
  })

  it('setVisible toggles group.visible', () => {
    const area = new SpawnArea({ config: CFG })
    area.setVisible(false)
    expect(area.group.visible).toBe(false)
    area.setVisible(true)
    expect(area.group.visible).toBe(true)
    area.dispose()
  })

  it('exposes intervalSec and lanesX for E05', () => {
    const area = new SpawnArea({ config: CFG })
    expect(area.intervalSec()).toBe(CFG.intervalSec)
    expect(area.lanesX()).toEqual([-4, -2, 0, 2, 4])
    area.setIntervalSec(0.8)
    area.setLanesX([-3, 0, 3])
    expect(area.intervalSec()).toBe(0.8)
    expect(area.lanesX()).toEqual([-3, 0, 3])
    area.dispose()
  })

  it('dispose frees geometry and material and is idempotent', () => {
    const area = new SpawnArea({ config: CFG })
    area.dispose()
    area.dispose()
    expect(area.group.children).toHaveLength(0)
  })
})
