import { Line, LineLoop, LineSegments } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { BALANCE } from '../../core/balancer'
import { LimitBox } from './limit-box'

function makeBox() {
  const cameraConfig = {
    position: {
      x: BALANCE.camera.position.x,
      y: BALANCE.camera.position.y,
      z: BALANCE.camera.position.z,
    },
  }
  const box = new LimitBox({
    follow: BALANCE.ship.follow,
    visual: BALANCE.ship.followBox,
    cameraConfig,
  })
  return { box, cameraConfig }
}

function idle(box: LimitBox, ship: { x: number; z: number }, seconds: number, dt = 0.05): void {
  const steps = Math.ceil(seconds / dt)
  for (let i = 0; i < steps; i++) {
    box.update(ship, dt)
  }
}

describe('LimitBox', () => {
  it('does not move the camera while the ship stays inside the box', () => {
    const { box, cameraConfig } = makeBox()
    const startX = cameraConfig.position.x
    const startZ = cameraConfig.position.z
    box.update({ x: 0, z: 0 }, 0.016)
    box.update({ x: 1, z: 1 }, 0.016)
    expect(cameraConfig.position.x).toBe(startX)
    expect(cameraConfig.position.z).toBe(startZ)
    box.dispose()
  })

  it('eases the camera when the ship crosses an edge (bounce, not snap)', () => {
    const { box, cameraConfig } = makeBox()
    const startX = cameraConfig.position.x
    box.update({ x: 20, z: 0 }, 0.016)
    const moved = cameraConfig.position.x - startX
    expect(moved).toBeGreaterThan(0)
    expect(moved).toBeLessThan(14)
    box.dispose()
  })

  it('suspends edge-follow on an axis while that axis is centering', () => {
    const { box, cameraConfig } = makeBox()
    idle(box, { x: 0, z: 0 }, 1.6)
    const xBefore = cameraConfig.position.x
    const zBefore = cameraConfig.position.z
    box.update({ x: 20, z: 0 }, 0.016)
    expect(cameraConfig.position.x).toBeGreaterThan(xBefore)
    expect(cameraConfig.position.z).not.toBe(zBefore)
    box.dispose()
  })

  it('treats X and Z interrupts independently', () => {
    const { box, cameraConfig } = makeBox()
    idle(box, { x: 0, z: 0 }, 1.6)
    const zDuringCenter = cameraConfig.position.z
    box.update({ x: 2, z: 0 }, 0.05)
    box.update({ x: 2, z: 0 }, 0.05)
    expect(cameraConfig.position.z).not.toBe(zDuringCenter)
    box.dispose()
  })

  it('places rest Z at anchor.z + halfZ + restLine.position.z', () => {
    const { box } = makeBox()
    box.syncRender()
    const rest = box.group.children.find((child) => child instanceof LineSegments)
    const arr = (rest as LineSegments).geometry.getAttribute('position').array
    const expectedZ =
      box.anchor.z + BALANCE.ship.follow.halfZ + BALANCE.ship.followBox.restLine.position.z
    expect(arr[2]).toBe(expectedZ)
    box.dispose()
  })

  it('places rest X at anchor.x + restLine.position.x', () => {
    const { box } = makeBox()
    box.syncRender()
    const rest = box.group.children.find((child) => child instanceof LineSegments)
    const arr = (rest as LineSegments).geometry.getAttribute('position').array
    const expectedX = box.anchor.x + BALANCE.ship.followBox.restLine.position.x
    const halfW = BALANCE.ship.followBox.restLine.width / 2
    expect(arr[0]).toBe(expectedX - halfW)
    box.dispose()
  })

  it('starts recenter after delayMs of idle off the rest point', () => {
    const { box, cameraConfig } = makeBox()
    const startZ = cameraConfig.position.z
    idle(box, { x: 0, z: 0 }, 1.4)
    expect(cameraConfig.position.z).toBe(startZ)
    idle(box, { x: 0, z: 0 }, 0.3)
    expect(cameraConfig.position.z).not.toBe(startZ)
    box.dispose()
  })

  it('interrupts recenter when the ship moves on that axis', () => {
    const { box, cameraConfig } = makeBox()
    idle(box, { x: 0, z: 0 }, 1.6)
    box.update({ x: 0, z: 1 }, 0.016)
    const zAtInterrupt = cameraConfig.position.z
    box.update({ x: 0, z: 1 }, 0.016)
    expect(cameraConfig.position.z).toBeCloseTo(zAtInterrupt, 4)
    box.dispose()
  })

  it('waits stillMs after interrupt before delay can start again', () => {
    const { box, cameraConfig } = makeBox()
    idle(box, { x: 0, z: 0 }, 1.6)
    box.update({ x: 0, z: 1 }, 0.016)
    const z = cameraConfig.position.z
    idle(box, { x: 0, z: 1 }, 0.7)
    expect(cameraConfig.position.z).toBeCloseTo(z, 3)
    box.dispose()
  })

  it('uses halfX 6, halfZ 8, bounce 500, delay 1500, still 800, accel 3', () => {
    expect(BALANCE.ship.follow.halfX).toBe(6)
    expect(BALANCE.ship.follow.halfZ).toBe(8)
    expect(BALANCE.ship.follow.bounce.timeMs).toBe(500)
    expect(BALANCE.ship.follow.recenter.delayMs).toBe(1500)
    expect(BALANCE.ship.follow.recenter.stillMs).toBe(800)
    expect(BALANCE.ship.follow.recenter.accel).toBe(3)
  })

  it('uses restLine.position {0,0,-1}', () => {
    expect(BALANCE.ship.followBox.restLine.position).toEqual({ x: 0, y: 0, z: -1 })
  })

  it('syncRender writes loop / center / rest without allocating', () => {
    const { box } = makeBox()
    const setSpy = vi.spyOn(globalThis, 'Set')
    box.syncRender()
    expect(box.group.children.some((child) => child instanceof LineLoop)).toBe(true)
    expect(box.group.children.some((child) => child instanceof Line)).toBe(true)
    expect(setSpy).not.toHaveBeenCalled()
    setSpy.mockRestore()
    box.dispose()
  })

  it('dispose frees the three geometries and materials', () => {
    const { box } = makeBox()
    const geos = box.group.children.map((child) => {
      if (child instanceof LineLoop || child instanceof Line || child instanceof LineSegments) {
        return child.geometry
      }
      return null
    })
    const flags = geos.filter(Boolean).map((geo) => {
      let hit = false
      geo?.addEventListener('dispose', () => {
        hit = true
      })
      return () => hit
    })
    box.dispose()
    expect(flags).toHaveLength(3)
    expect(flags.every((read) => read())).toBe(true)
  })
})
