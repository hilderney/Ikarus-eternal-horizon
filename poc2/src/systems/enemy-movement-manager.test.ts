import { describe, expect, it } from 'vitest'
import { easeInOutCubic } from '../core/math'
import { EnemyMovementManager } from './enemy-movement-manager'

describe('EnemyMovementManager synchronizedLerp', () => {
  it('keeps XYZ residual proportions from A to B', () => {
    const manager = new EnemyMovementManager()
    manager.setStrategy('synchronizedLerp')
    const from = { x: -100, y: -50, z: -50 }
    const to = { x: 0, y: 0, z: 0 }
    manager.beginJourney(from, to, 50)
    const position = { ...from }
    // One mid-step: sample before finish
    manager.update({
      position,
      dt: 0.4,
      currentSpeed: 50,
      target: to,
      arriveRadius: 0.01,
      agilityLambda: 3,
    })
    // Residual from B should share the same factor on all axes
    const rx = (to.x - position.x) / (to.x - from.x)
    const ry = (to.y - position.y) / (to.y - from.y)
    const rz = (to.z - position.z) / (to.z - from.z)
    expect(rx).toBeCloseTo(ry, 5)
    expect(ry).toBeCloseTo(rz, 5)
    expect(rx).toBeGreaterThan(0)
    expect(rx).toBeLessThan(1)
  })

  it('starts at A and ends at B', () => {
    const manager = new EnemyMovementManager()
    manager.setStrategy('synchronizedLerp')
    const from = { x: -100, y: -50, z: -50 }
    const to = { x: 0, y: 0, z: 0 }
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
    expect(position.z).toBeCloseTo(0, 5)
  })

  it('ease peaks mid-journey (larger step around t=0.5 than near ends)', () => {
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 10)
    const manager = new EnemyMovementManager()
    manager.setStrategy('synchronizedLerp')
    const from = { x: 0, y: 0, z: 0 }
    const to = { x: 0, y: 0, z: -100 }
    manager.beginJourney(from, to, 20)
    // duration = 100/20 = 5s; sample Δu via position.z over equal dt near start vs mid
    const pos = { ...from }
    manager.update({
      position: pos,
      dt: 0.25,
      currentSpeed: 20,
      target: to,
      arriveRadius: 0.01,
      agilityLambda: 3,
    })
    const earlyStep = Math.abs(pos.z - from.z)
    // Jump timeline near midpoint by continuing
    for (let i = 0; i < 8; i++) {
      manager.update({
        position: pos,
        dt: 0.25,
        currentSpeed: 20,
        target: to,
        arriveRadius: 0.01,
        agilityLambda: 3,
      })
    }
    const beforeMid = pos.z
    manager.update({
      position: pos,
      dt: 0.25,
      currentSpeed: 20,
      target: to,
      arriveRadius: 0.01,
      agilityLambda: 3,
    })
    const midStep = Math.abs(pos.z - beforeMid)
    expect(midStep).toBeGreaterThan(earlyStep)
  })
})

describe('EnemyMovementManager seekChase', () => {
  it('closes XZ toward the player while damping Y', () => {
    const manager = new EnemyMovementManager()
    manager.setStrategy('seekChase')
    manager.beginJourney({ x: 10, y: 4, z: -20 }, { x: 0, y: 0, z: 0 }, 4)
    const position = { x: 10, y: 4, z: -20 }
    const before = { ...position }
    manager.update({
      position,
      dt: 0.5,
      currentSpeed: 8,
      target: { x: 0, y: 0, z: 0 },
      arriveRadius: 1,
      agilityLambda: 4,
    })
    expect(Math.hypot(position.x, position.z)).toBeLessThan(Math.hypot(before.x, before.z))
    expect(position.y).toBeLessThan(before.y)
  })
})
