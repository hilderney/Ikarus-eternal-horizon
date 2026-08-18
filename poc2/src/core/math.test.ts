import { Vector3 } from 'three'
import { describe, expect, it, vi } from 'vitest'
import {
  DEG2RAD,
  clamp,
  damp,
  decayFactor,
  distXZ,
  lerp,
  scratchV3A,
  scratchV3B,
  scratchV3C,
} from './math'

describe('math', () => {
  it('clamps below min, above max, and passes through the interior', () => {
    expect(clamp(-2, 0, 10)).toBe(0)
    expect(clamp(11, 0, 10)).toBe(10)
    expect(clamp(4, 0, 10)).toBe(4)
    expect(clamp(0, 0, 10)).toBe(0)
    expect(clamp(10, 0, 10)).toBe(10)
  })

  it('lerps endpoints and midpoint', () => {
    expect(lerp(10, 20, 0)).toBe(10)
    expect(lerp(10, 20, 1)).toBe(20)
    expect(lerp(10, 20, 0.5)).toBe(15)
  })

  it('damps toward target without overshooting', () => {
    expect(damp(5, 5, 4, 0.016)).toBe(5)
    const next = damp(0, 10, 4, 0.016)
    expect(next).toBeGreaterThan(0)
    expect(next).toBeLessThan(10)
    let value = 0
    for (let i = 0; i < 200; i++) {
      value = damp(value, 10, 8, 0.05)
    }
    expect(value).toBeLessThanOrEqual(10)
    expect(value).toBeGreaterThan(9.9)
  })

  it('exports DEG2RAD as PI/180', () => {
    expect(DEG2RAD * 180).toBeCloseTo(Math.PI, 12)
    expect(DEG2RAD).toBe(Math.PI / 180)
  })

  it('distXZ ignores Y and matches hypot(dx, dz)', () => {
    expect(distXZ(0, 0, 3, 4)).toBe(5)
    expect(distXZ(1, 2, 4, 6)).toBe(Math.hypot(1 - 4, 2 - 6))
  })

  it('decayFactor is 1 at elapsed 0 and 0.25', () => {
    expect(decayFactor(0)).toBe(1)
    expect(decayFactor(0.25)).toBe(1)
  })

  it('decayFactor is 0.75 at elapsed 0.26 and 0.5', () => {
    expect(decayFactor(0.26)).toBe(0.75)
    expect(decayFactor(0.5)).toBe(0.75)
  })

  it('decayFactor is 0.5 at elapsed 0.51 and 0.75', () => {
    expect(decayFactor(0.51)).toBe(0.5)
    expect(decayFactor(0.75)).toBe(0.5)
  })

  it('decayFactor is 0.25 at elapsed 0.76 and 1', () => {
    expect(decayFactor(0.76)).toBe(0.25)
    expect(decayFactor(1)).toBe(0.25)
  })

  it('scratchV3A/B/C are stable Vector3 identities across calls', () => {
    expect(scratchV3A).toBeInstanceOf(Vector3)
    expect(scratchV3B).toBeInstanceOf(Vector3)
    expect(scratchV3C).toBeInstanceOf(Vector3)
    expect(scratchV3A).not.toBe(scratchV3B)
    expect(scratchV3B).not.toBe(scratchV3C)
    const a = scratchV3A
    const b = scratchV3B
    const c = scratchV3C
    a.set(1, 2, 3)
    expect(scratchV3A).toBe(a)
    expect(scratchV3B).toBe(b)
    expect(scratchV3C).toBe(c)
    expect(scratchV3A.x).toBe(1)
  })

  it('clamp/lerp/damp/distXZ/decayFactor do not allocate', () => {
    const vectorSpy = vi.spyOn(Vector3.prototype, 'clone')
    const setSpy = vi.spyOn(globalThis, 'Set')
    clamp(1, 0, 2)
    lerp(0, 1, 0.3)
    damp(0, 1, 4, 0.016)
    distXZ(0, 0, 1, 1)
    decayFactor(0.4)
    expect(vectorSpy).not.toHaveBeenCalled()
    expect(setSpy).not.toHaveBeenCalled()
    vectorSpy.mockRestore()
    setSpy.mockRestore()
  })
})
