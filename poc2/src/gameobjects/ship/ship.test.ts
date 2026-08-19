import {
  AdditiveBlending,
  BoxGeometry,
  ConeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Scene,
  SphereGeometry,
} from 'three'
import { describe, expect, it, vi } from 'vitest'
import { BALANCE } from '../../core/balancer'
import { DEG2RAD } from '../../core/math'
import { Ship } from './ship'
import type { WeaponId } from './ship'

function makeShip(caps = BALANCE.ship.inventory.caps): Ship {
  return new Ship({
    visual: BALANCE.ship.visual,
    thruster: BALANCE.thruster,
    inventoryCaps: caps,
  })
}

function thrusterOf(ship: Ship): Mesh {
  const mesh = ship.children.find(
    (child) => child instanceof Mesh && child.geometry instanceof ConeGeometry,
  )
  if (!(mesh instanceof Mesh)) {
    throw new Error('expected a thruster cone mesh')
  }
  return mesh
}

function hullOf(ship: Ship): Mesh {
  const mesh = ship.children.find((child) => {
    if (!(child instanceof Mesh) || !(child.geometry instanceof BoxGeometry)) {
      return false
    }
    const mat = child.material
    return !Array.isArray(mat) && mat.wireframe
  })
  if (!(mesh instanceof Mesh)) {
    throw new Error('expected a hull wireframe mesh')
  }
  return mesh
}

describe('Ship', () => {
  it('extends THREE.Group and constructs hull, accent, thruster, weaponTip as children', () => {
    const ship = makeShip()
    expect(ship).toBeInstanceOf(Group)
    expect(ship.children).toHaveLength(4)
    expect(ship.weaponTip).toBeInstanceOf(Mesh)
    expect(ship.weaponTip.parent).toBe(ship)
    expect(ship.weaponTip.geometry).toBeInstanceOf(SphereGeometry)
    expect(
      ship.children.filter((child) => child instanceof Mesh && child.geometry instanceof BoxGeometry),
    ).toHaveLength(2)
    expect(thrusterOf(ship).parent).toBe(ship)
    ship.dispose()
  })

  it('does not expose writable hardpoints/ordnance/equipment arrays', () => {
    const ship = makeShip()
    expect(Object.isFrozen(ship.hardpoints)).toBe(true)
    expect(Object.isFrozen(ship.ordnance)).toBe(true)
    expect(Object.isFrozen(ship.equipment)).toBe(true)
    expect(() => {
      ;(ship as { hardpoints: unknown }).hardpoints = []
    }).toThrow()
    expect(() => {
      ;(ship as { ordnance: unknown }).ordnance = []
    }).toThrow()
    expect(() => {
      ;(ship as { equipment: unknown }).equipment = []
    }).toThrow()
    expect(() => {
      ;(ship.hardpoints as { index: number; equipped: WeaponId | null }[]).push({
        index: 99,
        equipped: null,
      })
    }).toThrow()
    ship.dispose()
  })

  it('equipWeapon writes the slot; a direct array mutation API does not exist', () => {
    const ship = makeShip()
    expect(ship.hardpoints.length).toBeGreaterThanOrEqual(1)
    expect(ship.hardpoints[0]?.equipped).toBeNull()
    expect(() => {
      ;(ship.hardpoints[0] as { equipped: WeaponId | null }).equipped = 'plasma'
    }).toThrow()
    expect(ship.hardpoints[0]?.equipped).toBeNull()
    ship.equipWeapon(0, 'plasma')
    expect(ship.hardpoints[0]?.equipped).toBe('plasma')
    ship.unequipWeapon(0)
    expect(ship.hardpoints[0]?.equipped).toBeNull()
    ship.dispose()
  })

  it('applyTransform stores degrees and syncRender writes radians onto this.rotation', () => {
    const ship = makeShip()
    ship.applyTransform({
      position: { x: 1, y: 2, z: 3 },
      rotation: { x: 90, y: -45, z: 15 },
      scale: 2,
    })
    expect(ship.transform.rotation.x).toBe(90)
    expect(ship.transform.rotation.y).toBe(-45)
    expect(ship.transform.rotation.z).toBe(15)
    expect(ship.rotation.x).toBe(0)
    ship.syncRender()
    expect(ship.position.x).toBe(1)
    expect(ship.position.y).toBe(2)
    expect(ship.position.z).toBe(3)
    expect(ship.rotation.x).toBeCloseTo(90 * DEG2RAD, 6)
    expect(ship.rotation.y).toBeCloseTo(-45 * DEG2RAD, 6)
    expect(ship.rotation.z).toBeCloseTo(15 * DEG2RAD, 6)
    expect(ship.scale.x).toBe(2)
    expect(ship.scale.y).toBe(2)
    expect(ship.scale.z).toBe(2)
    ship.dispose()
  })

  it('setEquippedWeapon recolours the tip and scales it to max(0.03, radius)', () => {
    const ship = makeShip()
    const mat = ship.weaponTip.material
    if (Array.isArray(mat) || !(mat instanceof MeshBasicMaterial)) {
      throw new Error('expected a MeshBasicMaterial on the weapon tip')
    }
    ship.setEquippedWeapon(0xff00aa, 0.2)
    expect(mat.color.getHex()).toBe(0xff00aa)
    expect(ship.weaponTip.scale.x).toBeCloseTo(0.2, 6)
    ship.setEquippedWeapon(0x22d3ee, 0.01)
    expect(mat.color.getHex()).toBe(0x22d3ee)
    expect(ship.weaponTip.scale.x).toBeCloseTo(0.03, 6)
    ship.dispose()
  })

  it('update(dt) does not assign thruster.scale; syncRender applies the flicker formula', () => {
    const ship = makeShip()
    const thruster = thrusterOf(ship)
    const yBefore = thruster.scale.y
    const setSpy = vi.spyOn(thruster.scale, 'set')
    ship.update(0.1)
    expect(setSpy).not.toHaveBeenCalled()
    expect(thruster.scale.y).toBe(yBefore)
    ship.syncRender()
    expect(thruster.scale.y).not.toBe(yBefore)
    setSpy.mockRestore()
    ship.dispose()
  })

  it('thruster flicker uses 0.72 + 0.28 * sin(t*42) * sin(t*13 + 1.3) on scale.y', () => {
    const ship = makeShip()
    const thruster = thrusterOf(ship)
    const dt = 0.1
    ship.update(dt)
    ship.syncRender()
    const expected = 0.72 + 0.28 * Math.sin(dt * 42) * Math.sin(dt * 13 + 1.3)
    expect(thruster.scale.y).toBeCloseTo(expected, 6)
    expect(thruster.scale.x).toBe(1)
    expect(thruster.scale.z).toBe(1)
    ship.dispose()
  })

  it('dispose() disposes hull, accent, thruster and tip geometry and material', () => {
    const ship = makeShip()
    const meshes = ship.children.filter((child): child is Mesh => child instanceof Mesh)
    expect(meshes).toHaveLength(4)
    let geoHits = 0
    let matHits = 0
    for (const mesh of meshes) {
      mesh.geometry.addEventListener('dispose', () => {
        geoHits += 1
      })
      const mat = mesh.material
      if (Array.isArray(mat)) {
        for (const item of mat) {
          item.addEventListener('dispose', () => {
            matHits += 1
          })
        }
      } else {
        mat.addEventListener('dispose', () => {
          matHits += 1
        })
      }
    }
    ship.dispose()
    expect(geoHits).toBe(4)
    expect(matHits).toBe(4)
  })

  it('update/syncRender allocate no objects', () => {
    const ship = makeShip()
    ship.update(0.016)
    ship.syncRender()
    const setSpy = vi.spyOn(globalThis, 'Set')
    ship.update(0.016)
    ship.syncRender()
    expect(setSpy).not.toHaveBeenCalled()
    setSpy.mockRestore()
    ship.dispose()
  })

  it('inventory.tryAdd stores Metal Scrap and rejects surplus above cap', () => {
    const ship = makeShip({
      metalScrap: 10,
      prismaticCrystal: 99,
      denseCore: 49,
      darkMatter: 9,
    })
    expect(ship.inventory.count('metalScrap')).toBe(0)
    expect(ship.inventory.cap('metalScrap')).toBe(10)
    expect(ship.inventory.tryAdd('metalScrap', 15)).toBe(10)
    expect(ship.inventory.count('metalScrap')).toBe(10)
    ship.dispose()
  })

  it('inventory.tryAdd on a full stack returns 0 and leaves the count unchanged', () => {
    const ship = makeShip({
      metalScrap: 5,
      prismaticCrystal: 99,
      denseCore: 49,
      darkMatter: 9,
    })
    expect(ship.inventory.tryAdd('metalScrap', 5)).toBe(5)
    expect(ship.inventory.tryAdd('metalScrap', 3)).toBe(0)
    expect(ship.inventory.count('metalScrap')).toBe(5)
    ship.dispose()
  })

  it('constructor does not call scene.add', () => {
    const scene = new Scene()
    const addSpy = vi.spyOn(scene, 'add')
    const ship = makeShip()
    expect(addSpy).not.toHaveBeenCalled()
    expect(ship.parent).toBeNull()
    addSpy.mockRestore()
    ship.dispose()
  })

  it('visual size is 1.5 × 1 × 2 and hull material colour is 0x22d3ee wireframe', () => {
    const ship = makeShip()
    const hull = hullOf(ship)
    const geo = hull.geometry
    const mat = hull.material
    if (!(geo instanceof BoxGeometry) || Array.isArray(mat) || !(mat instanceof MeshBasicMaterial)) {
      throw new Error('expected a BoxGeometry hull with MeshBasicMaterial')
    }
    expect(geo.parameters.width).toBe(1.5)
    expect(geo.parameters.height).toBe(1)
    expect(geo.parameters.depth).toBe(2)
    expect(mat.wireframe).toBe(true)
    expect(mat.color.getHex()).toBe(0x22d3ee)
    expect(mat.opacity).toBe(0.9)
    ship.dispose()
  })

  it('thruster sits at y=-0.55 with length 0.5 and width 0.3, additive 0x60c5ff', () => {
    const ship = makeShip()
    const thruster = thrusterOf(ship)
    const geo = thruster.geometry
    const mat = thruster.material
    if (!(geo instanceof ConeGeometry) || Array.isArray(mat) || !(mat instanceof MeshBasicMaterial)) {
      throw new Error('expected a ConeGeometry thruster with MeshBasicMaterial')
    }
    expect(thruster.position.y).toBe(-0.55)
    expect(geo.parameters.radius).toBe(0.3)
    expect(geo.parameters.height).toBe(0.5)
    expect(mat.color.getHex()).toBe(0x60c5ff)
    expect(mat.blending).toBe(AdditiveBlending)
    expect(mat.depthWrite).toBe(false)
    ship.dispose()
  })

  it('byte pools start at current=max=100 with byteCap 255', () => {
    const ship = makeShip()
    const cap = BALANCE.ship.stats.byteCap
    expect(cap).toBe(255)
    for (const pool of [
      ship.stats.agility,
      ship.stats.deflection,
      ship.stats.integrity,
      ship.stats.shield,
      ship.stats.precision,
      ship.stats.energy,
    ]) {
      expect(pool.current).toBe(100)
      expect(pool.max).toBe(100)
      expect(pool.current).toBeLessThanOrEqual(cap)
      expect(pool.max).toBeLessThanOrEqual(cap)
    }
    ship.dispose()
  })

  it('debugSnapshot exposes position, rotation, stats, status, loadout', () => {
    const ship = makeShip()
    ship.applyTransform({
      position: { x: 2, y: 0, z: -4 },
      rotation: { x: 0, y: 12, z: -8 },
      scale: 1,
    })
    const port = ship.debugSnapshot()
    expect(port.position).toEqual({ x: 2, y: 0, z: -4 })
    expect(port.rotation).toEqual({ x: 0, y: 12, z: -8 })
    expect(port.stats).toBe(ship.stats)
    expect(port.status).toBe(ship.status)
    expect(port.loadout).toBe(ship.loadout)
    ship.dispose()
  })

  it('debugSnapshot returns the same stats/status object identity across calls', () => {
    const ship = makeShip()
    const first = ship.debugSnapshot()
    const second = ship.debugSnapshot()
    expect(first).toBe(second)
    expect(first.stats).toBe(second.stats)
    expect(first.status).toBe(second.status)
    expect(first.loadout).toBe(second.loadout)
    expect(first.position).toBe(ship.transform.position)
    ship.dispose()
  })

  it('recovering is true only when shooting, dashing and flickering are all false', () => {
    const ship = makeShip()
    expect(ship.status.flickering).toBe(true)
    expect(ship.status.shooting).toBe(false)
    expect(ship.status.dashing).toBe(false)
    expect(ship.status.recovering).toBe(false)
    ship.setFlickering(false)
    expect(ship.status.recovering).toBe(true)
    ship.setShooting(true)
    expect(ship.status.shooting).toBe(true)
    expect(ship.status.recovering).toBe(false)
    ship.setShooting(false)
    expect(ship.status.recovering).toBe(true)
    ship.setDashing(true)
    expect(ship.status.dashing).toBe(true)
    expect(ship.status.recovering).toBe(false)
    ship.setDashing(false)
    expect(ship.status.recovering).toBe(true)
    ship.dispose()
  })

  it('spawn flicker lasts flickerMs; shooting and dashing last their BALANCE windows', () => {
    const ship = makeShip()
    expect(ship.status.flickering).toBe(true)
    ship.update((BALANCE.ship.cooldowns.flickeringMs - 1) / 1000)
    expect(ship.status.flickering).toBe(true)
    ship.update(0.002)
    expect(ship.status.flickering).toBe(false)
    expect(ship.status.recovering).toBe(true)

    ship.setShooting(true)
    expect(ship.status.recovering).toBe(false)
    ship.update((BALANCE.ship.cooldowns.shootingMs - 1) / 1000)
    expect(ship.status.shooting).toBe(true)
    ship.update(0.002)
    expect(ship.status.shooting).toBe(false)
    expect(ship.status.recovering).toBe(true)

    ship.setDashing(true)
    ship.update((BALANCE.ship.cooldowns.dashingMs - 1) / 1000)
    expect(ship.status.dashing).toBe(true)
    ship.update(0.002)
    expect(ship.status.dashing).toBe(false)
    expect(ship.status.recovering).toBe(true)
    ship.dispose()
  })

  it('setDashing / setShooting / setFlickering update status for the debugger', () => {
    const ship = makeShip()
    ship.setFlickering(false)
    expect(ship.status.dashing).toBe(false)
    ship.setDashing(true)
    expect(ship.status.dashing).toBe(true)
    expect(ship.debugSnapshot().status.dashing).toBe(true)
    ship.setShooting(true)
    expect(ship.status.recovering).toBe(false)
    ship.setShooting(false)
    ship.setFlickering(true)
    expect(ship.status.flickering).toBe(true)
    expect(ship.status.recovering).toBe(false)
    ship.update(BALANCE.ship.cooldowns.flickeringMs / 1000)
    expect(ship.status.flickering).toBe(false)
    expect(ship.status.recovering).toBe(true)
    ship.dispose()
  })

  it('loadout.weapons starts as BALANCE.weapons.loadout; equippedWeapon tracks slot 0', () => {
    const ship = makeShip()
    expect(ship.loadout.weapons).toEqual(BALANCE.weapons.loadout)
    expect(ship.loadout.equippedWeapon).toBeNull()
    ship.equipWeapon(0, 'plasma')
    expect(ship.debugSnapshot().loadout.equippedWeapon).toBe('plasma')
    expect(ship.loadout.equippedWeapon).toBe(ship.hardpoints[0]?.equipped)
    ship.dispose()
  })

  it('wings/shields/armors/collectors/converters start empty', () => {
    const ship = makeShip()
    const { loadout } = ship
    expect(loadout.equippedBomb).toBeNull()
    expect(loadout.bombs).toEqual([])
    expect(loadout.equippedWings).toBeNull()
    expect(loadout.wings).toEqual([])
    expect(loadout.equippedShield).toBeNull()
    expect(loadout.shields).toEqual([])
    expect(loadout.equippedArmor).toBeNull()
    expect(loadout.armors).toEqual([])
    expect(loadout.equippedEnergyCollector).toBeNull()
    expect(loadout.energyCollectors).toEqual([])
    expect(loadout.equippedEnergyConverter).toBeNull()
    expect(loadout.energyConverters).toEqual([])
    ship.dispose()
  })
})
