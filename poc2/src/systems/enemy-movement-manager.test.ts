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
  it('keeps XY residual proportions; Z follows geometric curve', () => {
    const manager = new EnemyMovementManager()
    manager.setStrategy('synchronizedLerp')
    const from = { x: -100, y: -50, z: -140 }
    const to = { x: 0, y: 0, z: -90 }
    manager.beginJourney(from, to, 50)
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
    expect(rx).toBeCloseTo(ry, 5)
    expect(rx).toBeGreaterThan(0)
    expect(rx).toBeLessThan(1)
    // Same eased u on X ⇒ if Z were linear it would match; geometric curves away.
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

describe('EnemyMovementManager seekChase', () => {
  it('advances +Z past the player while damping X/Y toward them', () => {
    const manager = new EnemyMovementManager()
    manager.setStrategy('seekChase')
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
    expect(position.y).toBeLessThan(4)
  })

  it('keeps advancing +Z even when already at the player XZ', () => {
    const manager = new EnemyMovementManager()
    manager.setStrategy('seekChase')
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
})
