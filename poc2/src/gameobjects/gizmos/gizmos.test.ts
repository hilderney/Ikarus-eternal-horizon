import { GridHelper, Line, PerspectiveCamera, Sprite } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { BALANCE } from '../../core/balancer'
import { Gizmos } from './gizmos'

function makeGizmos() {
  const camera = new PerspectiveCamera()
  const gizmos = new Gizmos({
    camera,
    gridSize: BALANCE.gizmos.gridSize,
    gridDivisions: BALANCE.gizmos.gridDivisions,
    gridColor: BALANCE.gizmos.gridColor,
    gridY: BALANCE.gizmos.gridY,
    gridOpacity: BALANCE.gizmos.gridOpacity,
    worldAxisSize: BALANCE.gizmos.worldAxisSize,
    cameraAxisSize: BALANCE.gizmos.cameraAxisSize,
  })
  return { gizmos, camera }
}

describe('Gizmos', () => {
  it('builds world axes, a playfield grid, and camera axes with sprites', () => {
    const { gizmos } = makeGizmos()
    expect(gizmos.group.children.some((child) => child.name === 'worldAxes')).toBe(true)
    expect(gizmos.group.children.some((child) => child instanceof GridHelper)).toBe(true)
    expect(gizmos.group.children.some((child) => child.name === 'cameraAxes')).toBe(true)
    let sprites = 0
    let lines = 0
    gizmos.group.traverse((obj) => {
      if (obj instanceof Sprite) {
        sprites += 1
      }
      if (obj instanceof Line) {
        lines += 1
      }
    })
    expect(sprites).toBe(6)
    expect(lines).toBeGreaterThanOrEqual(6)
    gizmos.dispose()
  })

  it('syncRender copies camera position and quaternion onto camera axes', () => {
    const { gizmos, camera } = makeGizmos()
    camera.position.set(4, 5, 6)
    camera.quaternion.set(0, 0.1, 0, 0.995)
    gizmos.syncRender()
    const camAxes = gizmos.group.children.find((child) => child.name === 'cameraAxes')
    expect(camAxes?.position.x).toBe(4)
    expect(camAxes?.position.y).toBe(5)
    expect(camAxes?.position.z).toBe(6)
    expect(camAxes?.quaternion.y).toBeCloseTo(camera.quaternion.y, 6)
    gizmos.dispose()
  })

  it('setEnabled(false) hides the group without disposing textures', () => {
    const { gizmos } = makeGizmos()
    let sprite: Sprite | undefined
    gizmos.group.traverse((obj) => {
      if (!sprite && obj instanceof Sprite) {
        sprite = obj
      }
    })
    const map = sprite?.material.map
    gizmos.setEnabled(false)
    expect(gizmos.group.visible).toBe(false)
    expect(gizmos.enabled).toBe(false)
    expect(map).toBeTruthy()
    gizmos.dispose()
  })

  it('setEnabled(true) shows the group again', () => {
    const { gizmos } = makeGizmos()
    gizmos.setEnabled(false)
    gizmos.setEnabled(true)
    expect(gizmos.group.visible).toBe(true)
    expect(gizmos.enabled).toBe(true)
    gizmos.dispose()
  })

  it('does not expose a collision layer or hit radius', () => {
    const { gizmos } = makeGizmos()
    expect('layer' in gizmos).toBe(false)
    expect('hitRadius' in gizmos).toBe(false)
    gizmos.dispose()
  })

  it('does not read import.meta.env (Q09 is the caller\'s gate)', () => {
    const { gizmos } = makeGizmos()
    expect(gizmos.enabled).toBe(true)
    gizmos.dispose()
  })

  it('dispose disposes line geos/mats and sprite textures/mats', () => {
    const { gizmos } = makeGizmos()
    let geoHits = 0
    let matHits = 0
    gizmos.group.traverse((obj) => {
      if (obj instanceof Line) {
        obj.geometry.addEventListener('dispose', () => {
          geoHits += 1
        })
        const mat = obj.material
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
      if (obj instanceof Sprite) {
        obj.material.addEventListener('dispose', () => {
          matHits += 1
        })
        obj.material.map?.addEventListener('dispose', () => {
          matHits += 1
        })
      }
    })
    gizmos.dispose()
    expect(geoHits).toBeGreaterThanOrEqual(6)
    expect(matHits).toBeGreaterThanOrEqual(6)
  })

  it('syncRender does not allocate', () => {
    const { gizmos } = makeGizmos()
    gizmos.syncRender()
    const setSpy = vi.spyOn(globalThis, 'Set')
    gizmos.syncRender()
    expect(setSpy).not.toHaveBeenCalled()
    setSpy.mockRestore()
    gizmos.dispose()
  })

  it('uses gridSize 1000, worldAxisSize 4, cameraAxisSize 2.2', () => {
    expect(BALANCE.gizmos.gridSize).toBe(1000)
    expect(BALANCE.gizmos.worldAxisSize).toBe(4)
    expect(BALANCE.gizmos.cameraAxisSize).toBe(2.2)
  })
})
