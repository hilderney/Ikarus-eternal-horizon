import { describe, expect, it } from 'vitest'
import { easeInOutCubic, lerp, lerpGeometric } from '../core/math'
import { EnemyMovementManager } from './enemy-movement-manager'

describe('lerpGeometric', () => {
  it('starts at a and ends at b', () => {
    expect(lerpGeometric(-140, -90, 0)).toBeCloseTo(-140, 8)
    expect(lerpGeometric(-140, -90, 1)).toBeCloseTo(-90, 8)
  })

  it('midpoint differs from linear (curve on Z)', () => {
    const geo = lerpGeometric(-140, -90, 0.5)
    const lin = lerp(-140, -90, 0.5)
    expect(geo).not.toBeCloseTo(lin, 2)
  })
})

describe('EnemyMovementManager synchronizedLerp', () => {
  it('keeps XY residual proportions; Z follows left power curve', () => {
    const manager = new EnemyMovementManager()
    manager.setStrategy('synchronizedLerp')
    const from = { x: -100, y: -50, z: -140 }
    const to = { x: 0, y: 0, z: -90 }
    manager.beginJourney(from, to, 50, 'left')
    const position = { ...from }
    manager.update({
      position,
      dt: 0.4,
      currentSpeed: 50,
      target: to,
      arriveRadius: 0.01,
      agilityLambda: 3,
    })
    const rx = (to.x - position.x) / (to.x - from.x)
    const ry = (to.y - position.y) / (to.y - from.y)
    // left: xPower=1, yPower=1.5 ⇒ Y lags X
    expect(ry).toBeGreaterThan(rx)
    expect(rx).toBeGreaterThan(0)
    expect(rx).toBeLessThan(1)
    const tXy = (position.x - from.x) / (to.x - from.x)
    const zIfLinear = lerp(from.z, to.z, tXy)
    expect(Math.abs(position.z - zIfLinear)).toBeGreaterThan(0.1)
  })

  it('starts at A and ends at B', () => {
    const manager = new EnemyMovementManager()
    manager.setStrategy('synchronizedLerp')
    const from = { x: -100, y: -50, z: -140 }
    const to = { x: 0, y: 0, z: -90 }
    manager.beginJourney(from, to, 200)
    const position = { ...from }
    const first = manager.update({
      position,
      dt: 0,
      currentSpeed: 200,
      target: to,
      arriveRadius: 0.01,
      agilityLambda: 3,
    })
    expect(first.arrived).toBe(false)
    expect(position).toEqual(from)

    let arrived = false
    for (let i = 0; i < 40; i++) {
      arrived = manager.update({
        position,
        dt: 0.1,
        currentSpeed: 200,
        target: to,
        arriveRadius: 0.01,
        agilityLambda: 3,
      }).arrived
      if (arrived) {
        break
      }
    }
    expect(arrived).toBe(true)
    expect(position.x).toBeCloseTo(0, 5)
    expect(position.y).toBeCloseTo(0, 5)
    expect(position.z).toBeCloseTo(-90, 5)
  })

  it('ease peaks mid-journey on X while Z uses geometric u', () => {
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 10)
    const manager = new EnemyMovementManager()
    manager.setStrategy('synchronizedLerp')
    const from = { x: 0, y: 0, z: -140 }
    const to = { x: 100, y: 0, z: -90 }
    manager.beginJourney(from, to, 40)
    const pos = { ...from }
    manager.update({
      position: pos,
      dt: 0.25,
      currentSpeed: 40,
      target: to,
      arriveRadius: 0.01,
      agilityLambda: 3,
    })
    const earlyX = Math.abs(pos.x - from.x)
    for (let i = 0; i < 8; i++) {
      manager.update({
        position: pos,
        dt: 0.25,
        currentSpeed: 40,
        target: to,
        arriveRadius: 0.01,
        agilityLambda: 3,
      })
    }
    const beforeMid = pos.x
    manager.update({
      position: pos,
      dt: 0.25,
      currentSpeed: 40,
      target: to,
      arriveRadius: 0.01,
      agilityLambda: 3,
    })
    const midStep = Math.abs(pos.x - beforeMid)
    expect(midStep).toBeGreaterThan(earlyX)
  })
})

describe('EnemyMovementManager chase strategies', () => {
  it('straight advances +Z without yanking X hard', () => {
    const manager = new EnemyMovementManager()
    manager.setStrategy('straight')
    manager.beginJourney({ x: 10, y: 4, z: -20 }, { x: 0, y: 0, z: 0 }, 4)
    const position = { x: 10, y: 4, z: -20 }
    manager.update({
      position,
      dt: 0.5,
      currentSpeed: 8,
      target: { x: 0, y: 0, z: 0 },
      arriveRadius: 1,
      agilityLambda: 4,
    })
    expect(position.z).toBeGreaterThan(-20)
    expect(position.x).toBeCloseTo(10, 0)
  })

  it('engage damps X toward the player while advancing +Z', () => {
    const manager = new EnemyMovementManager()
    manager.setStrategy('engage')
    manager.beginJourney({ x: 10, y: 4, z: -20 }, { x: 0, y: 0, z: 0 }, 4)
    const position = { x: 10, y: 4, z: -20 }
    manager.update({
      position,
      dt: 0.5,
      currentSpeed: 8,
      target: { x: 0, y: 0, z: 0 },
      arriveRadius: 1,
      agilityLambda: 4,
    })
    expect(position.z).toBeGreaterThan(-20)
    expect(Math.abs(position.x)).toBeLessThan(10)
  })

  it('caps total chase displacement by currentSpeed', () => {
    const manager = new EnemyMovementManager()
    manager.setStrategy('engage')
    manager.beginJourney({ x: 40, y: 0, z: -20 }, { x: 0, y: 0, z: 0 }, 4)
    const position = { x: 40, y: 0, z: -20 }
    const dt = 0.5
    const speed = 8
    manager.update({
      position,
      dt,
      currentSpeed: speed,
      target: { x: 0, y: 0, z: 0 },
      arriveRadius: 1,
      agilityLambda: 20,
    })
    const step = Math.hypot(position.x - 40, position.y - 0, position.z - -20)
    expect(step).toBeLessThanOrEqual(speed * dt + 1e-6)
  })

  it('keeps advancing +Z even when already at the player XZ', () => {
    const manager = new EnemyMovementManager()
    manager.setStrategy('straight')
    manager.beginJourney({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 4)
    const position = { x: 0, y: 0, z: 0 }
    manager.update({
      position,
      dt: 1,
      currentSpeed: 5,
      target: { x: 0, y: 0, z: 0 },
      arriveRadius: 1,
      agilityLambda: 8,
    })
    expect(position.z).toBeCloseTo(5, 5)
  })

  it('eases the nose instead of snapping when the strategy swaps', () => {
    const manager = new EnemyMovementManager()
    manager.setTurnRate(120)
    manager.setStrategy('straight')
    manager.beginJourney({ x: 0, y: 0, z: -20 }, { x: 0, y: 0, z: 0 }, 6)
    const position = { x: 0, y: 0, z: -20 }
    const step = (target: { x: number; y: number; z: number }) => {
      manager.update({
        position,
        dt: 1 / 60,
        currentSpeed: 6,
        target,
        arriveRadius: 1,
        agilityLambda: 4,
      })
    }
    step({ x: 0, y: 0, z: 0 })
    expect(manager.facingY()).toBeCloseTo(0, 6)

    // Swap to flee: desired heading jumps sideways, actual heading must crawl.
    manager.setStrategy('flee')
    manager.beginJourney(position, { x: 0, y: 0, z: 0 }, 6)
    const headings: number[] = []
    for (let i = 0; i < 30; i++) {
      step({ x: -40, y: 0, z: 0 })
      headings.push(manager.facingY())
    }
    // Never more than the configured 120°/s between frames.
    const maxRate = (120 * Math.PI) / 180 / 60 + 1e-9
    let prev = 0
    for (const heading of headings) {
      expect(Math.abs(heading - prev)).toBeLessThanOrEqual(maxRate)
      prev = heading
    }
    // Still bending toward the flee side after the ramp.
    expect(manager.facingY()).toBeGreaterThan(0)
    expect(manager.desiredFacingY()).toBeGreaterThan(manager.facingY())
  })

  it('loop_around ends behind start on Z at same X after a full turn', () => {
    const manager = new EnemyMovementManager()
    manager.setLoopParams({ radius: 10, speedMul: 2, retreatZ: 8 })
    manager.setStrategy('loop_around')
    const start = { x: 5, y: 2, z: -20 }
    manager.beginJourney(start, { x: 0, y: 0, z: 0 }, 8)
    const position = { ...start }
    let arrived = false
    for (let i = 0; i < 400; i++) {
      arrived = manager.update({
        position,
        dt: 0.05,
        currentSpeed: 12,
        target: { x: 0, y: 0, z: 0 },
        arriveRadius: 1,
        agilityLambda: 4,
      }).arrived
      if (arrived) {
        break
      }
    }
    expect(arrived).toBe(true)
    expect(position.x).toBeCloseTo(start.x, 4)
    expect(position.y).toBeCloseTo(start.y, 4)
    expect(position.z).toBeCloseTo(start.z - 8, 4)
  })
})
