import { describe, expect, it } from 'vitest'
import {
  applyPathEase,
  axisPathLerp,
  DEFAULT_REACH_PATH,
  sampleReachPoint,
  writeReachPolyline,
  type ReachPathConfig,
} from './reach-path'
import { lerp } from '../core/math'

describe('reach-path', () => {
  it('sampleReachPoint endpoints match A and B', () => {
    const from = { x: -10, y: 50, z: -140 }
    const to = { x: 0, y: 0, z: -90 }
    const out = { x: 0, y: 0, z: 0 }
    sampleReachPoint(from, to, 0, out, DEFAULT_REACH_PATH)
    expect(out).toEqual(from)
    sampleReachPoint(from, to, 1, out, DEFAULT_REACH_PATH)
    expect(out.x).toBeCloseTo(to.x, 8)
    expect(out.y).toBeCloseTo(to.y, 8)
    expect(out.z).toBeCloseTo(to.z, 8)
  })

  it('power Z (left profile) differs from linear mid-curve', () => {
    const from = { x: 0, y: 0, z: -140 }
    const to = { x: 0, y: 0, z: -90 }
    const out = { x: 0, y: 0, z: 0 }
    sampleReachPoint(from, to, 0.5, out, DEFAULT_REACH_PATH, 'left')
    const linearZ = lerp(from.z, to.z, applyPathEase(0.5, DEFAULT_REACH_PATH.ease))
    expect(Math.abs(out.z - linearZ)).toBeGreaterThan(0.1)
  })

  it('front vs left use different yPower defaults', () => {
    expect(DEFAULT_REACH_PATH.sides.left.yPower).toBe(1.5)
    expect(DEFAULT_REACH_PATH.sides.left.zPower).toBe(2)
    expect(DEFAULT_REACH_PATH.sides.front.yPower).toBe(0.2)
    expect(DEFAULT_REACH_PATH.sides.front.zPower).toBe(1)
    expect(DEFAULT_REACH_PATH.sides.right).toEqual(DEFAULT_REACH_PATH.sides.left)
  })

  it('power mode raises progress with power>1', () => {
    const early = axisPathLerp(0, 10, 0.5, 'power', 2)
    const midLinear = axisPathLerp(0, 10, 0.5, 'linear', 1)
    expect(early).toBeLessThan(midLinear)
  })

  it('writeReachPolyline includes Zero when extendToZero', () => {
    const cfg: ReachPathConfig = {
      ...DEFAULT_REACH_PATH,
      zero: { x: 0, y: 0, z: 0 },
      samples: 8,
      extendToZero: true,
    }
    const buf = new Float32Array(64 * 3)
    const count = writeReachPolyline({ x: 0, y: 10, z: -100 }, { x: 0, y: 0, z: -50 }, buf, cfg)
    expect(count).toBe(8 + 7)
    const last = (count - 1) * 3
    expect(buf[last]).toBeCloseTo(0, 5)
    expect(buf[last + 1]).toBeCloseTo(0, 5)
    expect(buf[last + 2]).toBeCloseTo(0, 5)
  })
})
