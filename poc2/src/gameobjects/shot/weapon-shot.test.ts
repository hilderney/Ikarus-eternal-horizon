import {
  AdditiveBlending,
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  Scene,
} from 'three'
import { describe, expect, it, vi } from 'vitest'
import { decayFactor } from '../../core/math'
import { WeaponShot } from './weapon-shot'
import type { ShotSpawn } from './weapon-shot'

const LASER_COLOR = 0x22d3ee

function laserSpawn(overrides: Partial<ShotSpawn> = {}): ShotSpawn {
  return {
    x: 0,
    z: 0,
    vx: 0,
    vz: -30,
    damage: 1,
    lifetime: 1,
    totalLifetime: 1,
    radius: 0.12,
    aoeRadius: 0,
    range: 30,
    decayPerUnit: 0,
    color: LASER_COLOR,
    ...overrides,
  }
}

function makeShot(): WeaponShot {
  return new WeaponShot({ color: LASER_COLOR })
}

function materialOf(shot: WeaponShot): MeshBasicMaterial {
  const mat = shot.material
  if (Array.isArray(mat) || !(mat instanceof MeshBasicMaterial)) {
    throw new Error('expected MeshBasicMaterial')
  }
  return mat
}

describe('WeaponShot', () => {
  it('extends THREE.Mesh and creates geometry/material once', () => {
    const shot = makeShot()
    expect(shot).toBeInstanceOf(Mesh)
    expect(shot.geometry).toBeInstanceOf(BoxGeometry)
    const geo = shot.geometry as BoxGeometry
    expect(geo.parameters.width).toBe(1)
    expect(geo.parameters.height).toBe(1)
    expect(geo.parameters.depth).toBe(0.7)
    const mat = materialOf(shot)
    expect(mat.transparent).toBe(true)
    expect(mat.blending).toBe(AdditiveBlending)
    expect(mat.depthWrite).toBe(false)
    expect(mat.color.getHex()).toBe(LASER_COLOR)
    const geoId = shot.geometry.uuid
    const matId = mat.uuid
    shot.activate(laserSpawn())
    shot.deactivate()
    shot.activate(laserSpawn({ x: 2 }))
    expect(shot.geometry.uuid).toBe(geoId)
    expect(materialOf(shot).uuid).toBe(matId)
    shot.dispose()
  })

  it('activate copies ShotSpawn and sets active/visible', () => {
    const shot = makeShot()
    expect(shot.active).toBe(false)
    expect(shot.visible).toBe(false)
    shot.activate(laserSpawn({ x: 1.5, z: -3, vx: 2, vz: -10, damage: 4 }))
    expect(shot.active).toBe(true)
    expect(shot.visible).toBe(true)
    expect(shot.x).toBe(1.5)
    expect(shot.z).toBe(-3)
    expect(shot.vx).toBe(2)
    expect(shot.vz).toBe(-10)
    expect(shot.damage).toBe(4)
    expect(shot.lifetime).toBe(1)
    expect(shot.totalLifetime).toBe(1)
    expect(shot.radius).toBe(0.12)
    expect(shot.spawnX).toBe(1.5)
    expect(shot.spawnZ).toBe(-3)
    shot.dispose()
  })

  it('effectiveDamage equals damage × A03 decayFactor(elapsed)', () => {
    const shot = makeShot()
    shot.activate(laserSpawn({ damage: 8, lifetime: 0.5, totalLifetime: 1 }))
    const elapsed = 1 - 0.5 / 1
    expect(shot.effectiveDamage()).toBe(8 * decayFactor(elapsed))
    shot.dispose()
  })

  it('decay rungs are 1.00 / 0.75 / 0.50 / 0.25 at lifetime quarters', () => {
    const shot = makeShot()
    shot.activate(laserSpawn({ damage: 4, lifetime: 1, totalLifetime: 1 }))
    expect(shot.effectiveDamage()).toBe(4)
    shot.lifetime = 0.75
    expect(shot.effectiveDamage()).toBe(4)
    shot.lifetime = 0.74
    expect(shot.effectiveDamage()).toBe(3)
    shot.lifetime = 0.5
    expect(shot.effectiveDamage()).toBe(3)
    shot.lifetime = 0.49
    expect(shot.effectiveDamage()).toBe(2)
    shot.lifetime = 0.25
    expect(shot.effectiveDamage()).toBe(2)
    shot.lifetime = 0.24
    expect(shot.effectiveDamage()).toBe(1)
    shot.lifetime = 0
    expect(shot.effectiveDamage()).toBe(1)
    shot.dispose()
  })

  it('syncRender opacity matches decayFactor', () => {
    const shot = makeShot()
    shot.activate(laserSpawn({ lifetime: 0.49, totalLifetime: 1 }))
    shot.syncRender()
    expect(materialOf(shot).opacity).toBe(decayFactor(1 - 0.49))
    shot.dispose()
  })

  it('laser-style spawn with aoeRadius 0 keeps aoeRadius 0 after activate', () => {
    const shot = makeShot()
    shot.activate(laserSpawn({ aoeRadius: 0 }))
    expect(shot.aoeRadius).toBe(0)
    shot.dispose()
  })

  it('visual scale.x/y equals 2 × radius (bolt width = hit diameter)', () => {
    const shot = makeShot()
    shot.activate(laserSpawn({ radius: 0.12 }))
    shot.syncRender()
    expect(shot.scale.x).toBeCloseTo(0.24)
    expect(shot.scale.y).toBeCloseTo(0.24)
    expect(shot.scale.z).toBe(1)
    shot.dispose()
  })

  it('update integrates x += vx*dt, z += vz*dt and decrements lifetime', () => {
    const shot = makeShot()
    shot.activate(laserSpawn({ x: 1, z: 2, vx: 10, vz: -20, lifetime: 1 }))
    shot.update(0.5)
    expect(shot.x).toBe(6)
    expect(shot.z).toBe(-8)
    expect(shot.lifetime).toBe(0.5)
    shot.dispose()
  })

  it('update does not write position, opacity or scale', () => {
    const shot = makeShot()
    shot.activate(laserSpawn({ x: 3, z: -4 }))
    const mat = materialOf(shot)
    mat.opacity = 0.9
    shot.scale.set(9, 9, 9)
    shot.position.set(1, 2, 3)
    shot.update(0.016)
    expect(shot.position.x).toBe(1)
    expect(shot.position.y).toBe(2)
    expect(shot.position.z).toBe(3)
    expect(mat.opacity).toBe(0.9)
    expect(shot.scale.x).toBe(9)
    shot.dispose()
  })

  it('syncRender writes position.x/z at y=0 and does not mutate damage', () => {
    const shot = makeShot()
    shot.activate(laserSpawn({ x: 3, z: -4, damage: 2 }))
    shot.update(0)
    shot.syncRender()
    expect(shot.position.x).toBe(3)
    expect(shot.position.y).toBe(0)
    expect(shot.position.z).toBe(-4)
    expect(shot.damage).toBe(2)
    shot.dispose()
  })

  it('deactivate hides the mesh and clears active without disposing GPU', () => {
    const shot = makeShot()
    shot.activate(laserSpawn())
    const geoId = shot.geometry.uuid
    const matId = materialOf(shot).uuid
    shot.deactivate()
    expect(shot.active).toBe(false)
    expect(shot.visible).toBe(false)
    expect(shot.geometry.uuid).toBe(geoId)
    expect(materialOf(shot).uuid).toBe(matId)
    expect(shot.geometry).toBeTruthy()
    shot.dispose()
  })

  it('dispose frees geometry and material', () => {
    const shot = makeShot()
    const geo = shot.geometry
    const mat = materialOf(shot)
    const geoSpy = vi.spyOn(geo, 'dispose')
    const matSpy = vi.spyOn(mat, 'dispose')
    shot.dispose()
    expect(geoSpy).toHaveBeenCalledOnce()
    expect(matSpy).toHaveBeenCalledOnce()
  })

  it('update/syncRender allocate no objects', () => {
    const shot = makeShot()
    shot.activate(laserSpawn())
    shot.update(0.016)
    shot.syncRender()
    const setSpy = vi.spyOn(globalThis, 'Set')
    shot.update(0.016)
    shot.syncRender()
    expect(setSpy).not.toHaveBeenCalled()
    setSpy.mockRestore()
    shot.dispose()
  })

  it('constructor does not scene.add', () => {
    const scene = new Scene()
    const addSpy = vi.spyOn(scene, 'add')
    const shot = makeShot()
    expect(addSpy).not.toHaveBeenCalled()
    expect(shot.parent).toBeNull()
    addSpy.mockRestore()
    shot.dispose()
  })

  it('layer is PlayerShot', () => {
    const shot = makeShot()
    expect(shot.layer).toBe('PlayerShot')
    shot.activate(laserSpawn())
    expect(shot.layer).toBe('PlayerShot')
    shot.dispose()
  })

  it('a speed-30 lifetime-1 shot travels 30 units in 1s', () => {
    const shot = makeShot()
    shot.activate(laserSpawn({ x: 0, z: 0, vx: 0, vz: -30, lifetime: 1 }))
    shot.update(1)
    expect(shot.x).toBe(0)
    expect(shot.z).toBe(-30)
    expect(shot.lifetime).toBe(0)
    shot.dispose()
  })
})
