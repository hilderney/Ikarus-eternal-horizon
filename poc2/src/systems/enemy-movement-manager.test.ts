import { describe, expect, it } from 'vitest'
import { lerp, lerpGeometric, wrapAngle } from '../core/math'
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

describe('EnemyMovementManager birth curve', () => {
  it('keeps XY residual proportions; Z follows the left power curve', () => {
    const manager = new EnemyMovementManager()
    const from = { x: -100, y: -50, z: -140 }
    const to = { x: 0, y: 0, z: -90 }
    manager.beginBirth(from, to, 50, 'left')
    const position = { ...from }
    manager.updateBirth({ position, dt: 0.4, target: to, agilityLambda: 3 })
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

  it('starts at A, ends exactly at B and reports arrival once', () => {
    const manager = new EnemyMovementManager()
    const from = { x: -100, y: -50, z: -140 }
    const to = { x: 0, y: 0, z: -90 }
    manager.beginBirth(from, to, 200)
    const position = { ...from }
    const first = manager.updateBirth({ position, dt: 0, target: to, agilityLambda: 3 })
    expect(first.arrived).toBe(false)
    expect(position).toEqual(from)

    let arrived = false
    for (let i = 0; i < 40; i++) {
      arrived = manager.updateBirth({ position, dt: 0.1, target: to, agilityLambda: 3 }).arrived
      if (arrived) {
        break
      }
    }
    expect(arrived).toBe(true)
    expect(position.x).toBeCloseTo(to.x, 6)
    expect(position.y).toBeCloseTo(to.y, 6)
    expect(position.z).toBeCloseTo(to.z, 6)
    expect(manager.birthActive()).toBe(false)
  })

  it('re-reads the target every frame (gate follows the ship)', () => {
    const manager = new EnemyMovementManager()
    const from = { x: 0, y: 0, z: -140 }
    const target = { x: 0, y: 0, z: -90 }
    manager.beginBirth(from, target, 100)
    const position = { ...from }
    for (let i = 0; i < 5; i++) {
      target.z += 1
      manager.updateBirth({ position, dt: 0.05, target, agilityLambda: 3 })
    }
    expect(position.z).toBeGreaterThan(-140)
    expect(position.z).toBeLessThan(target.z)
  })
})

describe('EnemyMovementManager facing', () => {
  it('eases toward the desired heading instead of snapping', () => {
    const manager = new EnemyMovementManager()
    manager.setTurnRate(120)
    const stepped = manager.turnToward(Math.PI / 2, 0.05, 3)
    expect(stepped).toBeGreaterThan(0)
    expect(stepped).toBeLessThan(Math.PI / 2)
    expect(manager.desiredFacingY()).toBeCloseTo(Math.PI / 2, 6)
  })

  it('never turns faster than the configured turn rate', () => {
    const manager = new EnemyMovementManager()
    manager.setTurnRate(90)
    const dt = 0.1
    const stepped = manager.turnToward(Math.PI, dt, 100)
    expect(Math.abs(stepped)).toBeLessThanOrEqual(((90 * Math.PI) / 180) * dt + 1e-9)
  })

  it('takes the shortest arc across the ±π seam', () => {
    const manager = new EnemyMovementManager()
    manager.setTurnRate(360)
    manager.setFacing(Math.PI - 0.1)
    const stepped = manager.turnToward(-Math.PI + 0.1, 0.05, 6)
    expect(wrapAngle(stepped)).toBeGreaterThan(Math.PI - 0.11)
  })

  it('reset clears the birth curve and the heading', () => {
    const manager = new EnemyMovementManager()
    manager.beginBirth({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, 5)
    manager.turnToward(1, 0.5, 10)
    manager.reset()
    expect(manager.birthActive()).toBe(false)
    expect(manager.facingY()).toBe(0)
    expect(manager.desiredFacingY()).toBe(0)
  })
})
