import { describe, expect, it } from 'vitest'
import {
  addArrive,
  addAvoidRogue,
  addContainmentX,
  addFlee,
  addSeek,
  addSeparation,
  clampSpeed,
  resetAcc,
  truncate,
  type SteerAcc,
} from './steering'

function acc(): SteerAcc {
  return { x: 0, z: 0 }
}

describe('steering', () => {
  it('seek points the force at the target', () => {
    const a = acc()
    addSeek(a, 0, 0, 10, 0, 0, 0, 5)
    expect(a.x).toBeCloseTo(5, 6)
    expect(a.z).toBeCloseTo(0, 6)
  })

  it('flee points the force away from the target', () => {
    const a = acc()
    addFlee(a, 0, 0, 10, 0, 0, 0, 5)
    expect(a.x).toBeCloseTo(-5, 6)
  })

  it('arrive ramps the desired speed down inside the slow radius', () => {
    const near = acc()
    addArrive(near, 0, 0, 2, 0, 0, 0, 10, 8)
    const far = acc()
    addArrive(far, 0, 0, 20, 0, 0, 0, 10, 8)
    expect(near.x).toBeCloseTo(2.5, 6)
    expect(far.x).toBeCloseTo(10, 6)
  })

  it('arrive brakes when already on the target', () => {
    const a = acc()
    addArrive(a, 0, 0, 0, 0, 3, -4, 10, 8)
    expect(a.x).toBeCloseTo(-3, 6)
    expect(a.z).toBeCloseTo(4, 6)
  })

  it('separation only pushes inside the radius and grows as it closes', () => {
    const outside = acc()
    addSeparation(outside, 0, 0, 5, 0, 4)
    expect(outside.x).toBe(0)

    const far = acc()
    addSeparation(far, 0, 0, 3, 0, 4)
    const close = acc()
    addSeparation(close, 0, 0, 1, 0, 4)
    expect(close.x).toBeLessThan(far.x)
    expect(far.x).toBeLessThan(0)
  })

  it('rogue avoidance pushes sideways out of the corridor and ignores traffic behind it', () => {
    const side = acc()
    addAvoidRogue(side, 1, 4, 0, 0, 0, 10, 3)
    expect(side.x).toBeGreaterThan(0)

    const behind = acc()
    addAvoidRogue(behind, 1, -4, 0, 0, 0, 10, 3)
    expect(behind.x).toBe(0)
    expect(behind.z).toBe(0)
  })

  it('containment stays silent mid-field and grows exponentially near a wall', () => {
    const mid = acc()
    addContainmentX(mid, 0, -100, 100, 20, 3, 1)
    expect(mid.x).toBe(0)

    const entering = acc()
    addContainmentX(entering, 85, -100, 100, 20, 3, 1)
    const deep = acc()
    addContainmentX(deep, 99, -100, 100, 20, 3, 1)
    expect(entering.x).toBeLessThan(0)
    expect(deep.x).toBeLessThan(entering.x * 3)

    const left = acc()
    addContainmentX(left, -99, -100, 100, 20, 3, 1)
    expect(left.x).toBeGreaterThan(0)
  })

  it('truncate caps the magnitude and keeps the direction', () => {
    const a: SteerAcc = { x: 30, z: 40 }
    truncate(a, 10)
    expect(Math.hypot(a.x, a.z)).toBeCloseTo(10, 6)
    expect(a.x / a.z).toBeCloseTo(30 / 40, 6)

    const small: SteerAcc = { x: 1, z: 0 }
    clampSpeed(small, 10)
    expect(small.x).toBe(1)
  })

  it('resetAcc zeroes the accumulator for reuse', () => {
    const a: SteerAcc = { x: 3, z: 4 }
    resetAcc(a)
    expect(a).toEqual({ x: 0, z: 0 })
  })
})
