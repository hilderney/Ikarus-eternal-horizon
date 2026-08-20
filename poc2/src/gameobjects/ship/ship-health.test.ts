import { describe, expect, it, vi } from 'vitest'
import { BALANCE } from '../../core/balancer'
import { Layer } from '../../systems/layers'
import { ShipHealth } from './ship-health'
import source from './ship-health.ts?raw'

function makeHealth(): ShipHealth {
  return new ShipHealth({ config: BALANCE.ship.health })
}

describe('ShipHealth', () => {
  it('starts at integrity 100 and shield 50', () => {
    const health = makeHealth()
    expect(health.integrity).toBe(100)
    expect(health.integrityMax).toBe(100)
    expect(health.shield).toBe(50)
    expect(health.shieldMax).toBe(50)
    health.dispose()
  })

  it('routes damage into the Force Field before Integrity', () => {
    const health = makeHealth()
    const outcome = health.applyDamage(20, Layer.EnemyShot)
    expect(outcome.absorbedByShield).toBe(20)
    expect(outcome.dealtToHull).toBe(0)
    expect(health.shield).toBe(30)
    expect(health.integrity).toBe(100)
    health.dispose()
  })

  it('spills remainder onto Integrity in the same call that breaks the shield', () => {
    const health = makeHealth()
    const outcome = health.applyDamage(70, Layer.Meteor)
    expect(outcome.absorbedByShield).toBe(50)
    expect(outcome.dealtToHull).toBe(20)
    expect(health.shield).toBe(0)
    expect(health.integrity).toBe(80)
    health.dispose()
  })

  it('sets shieldBroke true only on the call that drives shield 50→0', () => {
    const health = makeHealth()
    const first = health.applyDamage(49, Layer.EnemyShot)
    expect(first.shieldBroke).toBe(false)
    expect(health.shield).toBe(1)
    const broke = health.applyDamage(1, Layer.EnemyShot)
    expect(broke.shieldBroke).toBe(true)
    expect(health.shield).toBe(0)
    const after = health.applyDamage(5, Layer.EnemyShot)
    expect(after.shieldBroke).toBe(false)
    health.dispose()
  })

  it('never increases integrity in update()', () => {
    const health = makeHealth()
    health.applyDamage(70, Layer.EnemyShot)
    const hull = health.integrity
    health.update(10)
    expect(health.integrity).toBe(hull)
    expect(health.integrity).toBeLessThan(100)
    health.dispose()
  })

  it('does not regen shield during the 1500ms delay after a hit', () => {
    const health = makeHealth()
    health.applyDamage(10, Layer.EnemyShot)
    health.update(1.5 - 1e-6)
    expect(health.shield).toBe(40)
    health.dispose()
  })

  it('regens shield at 2/s after the delay, clamped to shieldMax', () => {
    const health = makeHealth()
    health.applyDamage(10, Layer.EnemyShot)
    health.update(1.5)
    const atDelay = health.shield
    health.update(1)
    expect(health.shield).toBeCloseTo(atDelay + 2, 5)
    health.update(100)
    expect(health.shield).toBe(50)
    health.dispose()
  })

  it('resets the regen delay when a new hit lands during regen', () => {
    const health = makeHealth()
    health.applyDamage(10, Layer.EnemyShot)
    health.update(1.5)
    health.update(0.5)
    health.applyDamage(1, Layer.EnemyShot)
    const afterHit = health.shield
    health.update(1.5 - 1e-6)
    expect(health.shield).toBe(afterHit)
    health.dispose()
  })

  it('reports hullLevel 0 above 75, 1 above 50, 2 above 25, 3 at or below 25', () => {
    const health = makeHealth()
    expect(health.hullLevel).toBe(0)
    health.applyDamage(50, Layer.EnemyShot)
    health.applyDamage(24, Layer.EnemyShot)
    expect(health.integrity).toBe(76)
    expect(health.hullLevel).toBe(0)
    health.applyDamage(1, Layer.EnemyShot)
    expect(health.integrity).toBe(75)
    expect(health.hullLevel).toBe(1)
    health.applyDamage(24, Layer.EnemyShot)
    expect(health.integrity).toBe(51)
    expect(health.hullLevel).toBe(1)
    health.applyDamage(1, Layer.EnemyShot)
    expect(health.integrity).toBe(50)
    expect(health.hullLevel).toBe(2)
    health.applyDamage(24, Layer.EnemyShot)
    expect(health.integrity).toBe(26)
    expect(health.hullLevel).toBe(2)
    health.applyDamage(1, Layer.EnemyShot)
    expect(health.integrity).toBe(25)
    expect(health.hullLevel).toBe(3)
    health.dispose()
  })

  it('exposes speedMul [1, 0.85, 0.7, 0.5] indexed by hullLevel', () => {
    const health = makeHealth()
    const expected = BALANCE.ship.health.speedMul
    expect(health.hullLevel).toBe(0)
    expect(health.modifiers.speedMul).toBe(expected[0])
    health.applyDamage(50, Layer.EnemyShot)
    health.applyDamage(25, Layer.EnemyShot)
    expect(health.hullLevel).toBe(1)
    expect(health.modifiers.speedMul).toBe(expected[1])
    health.applyDamage(25, Layer.EnemyShot)
    expect(health.hullLevel).toBe(2)
    expect(health.modifiers.speedMul).toBe(expected[2])
    health.applyDamage(25, Layer.EnemyShot)
    expect(health.hullLevel).toBe(3)
    expect(health.modifiers.speedMul).toBe(expected[3])
    health.dispose()
  })

  it('exposes matching accelMul and fireRateMul [1, 0.9, 0.75, 0.55]', () => {
    const health = makeHealth()
    expect(health.modifiers.accelMul).toBe(1)
    expect(health.modifiers.fireRateMul).toBe(1)
    health.applyDamage(50, Layer.EnemyShot)
    health.applyDamage(25, Layer.EnemyShot)
    expect(health.modifiers.accelMul).toBe(0.85)
    expect(health.modifiers.fireRateMul).toBe(0.9)
    health.applyDamage(25, Layer.EnemyShot)
    expect(health.modifiers.accelMul).toBe(0.7)
    expect(health.modifiers.fireRateMul).toBe(0.75)
    health.applyDamage(25, Layer.EnemyShot)
    expect(health.modifiers.accelMul).toBe(0.5)
    expect(health.modifiers.fireRateMul).toBe(0.55)
    health.dispose()
  })

  it('sets hullLevelChanged when a hit crosses a threshold', () => {
    const health = makeHealth()
    const shieldOnly = health.applyDamage(50, Layer.EnemyShot)
    expect(shieldOnly.hullLevelChanged).toBe(false)
    const crossed = health.applyDamage(25, Layer.EnemyShot)
    expect(health.hullLevel).toBe(1)
    expect(crossed.hullLevelChanged).toBe(true)
    const sameBand = health.applyDamage(1, Layer.EnemyShot)
    expect(health.hullLevel).toBe(1)
    expect(sameBand.hullLevelChanged).toBe(false)
    health.dispose()
  })

  it('emits destroyed exactly once when integrity reaches 0', () => {
    const health = makeHealth()
    const emptying = health.applyDamage(50, Layer.EnemyShot)
    expect(emptying.destroyed).toBe(false)
    const death = health.applyDamage(100, Layer.EnemyShot)
    expect(health.integrity).toBe(0)
    expect(death.destroyed).toBe(true)
    const again = health.applyDamage(10, Layer.EnemyShot)
    expect(health.integrity).toBe(0)
    expect(again.destroyed).toBe(false)
    health.dispose()
  })

  it('does not call any run-end or scene API when destroyed', () => {
    expect(source).not.toMatch(/from ['"]three['"]/)
    expect(source).not.toMatch(/RunState|SceneController|GameLoop/)
    expect(source).not.toMatch(/scene\.add|scene\.remove/)
    const health = makeHealth()
    health.applyDamage(50, Layer.EnemyShot)
    health.applyDamage(100, Layer.EnemyShot)
    expect(health.integrity).toBe(0)
    health.dispose()
  })

  it('rejects field writes — only applyDamage mutates pools', () => {
    const health = makeHealth()
    const proto = Object.getPrototypeOf(health) as object
    for (const key of ['integrity', 'shield', 'hullLevel', 'modifiers'] as const) {
      const desc = Object.getOwnPropertyDescriptor(proto, key)
      expect(desc?.get).toBeTypeOf('function')
      expect(desc?.set).toBeUndefined()
    }
    expect(() => {
      ;(health as unknown as { integrity: number }).integrity = 0
    }).toThrow()
    expect(health.integrity).toBe(100)
    health.dispose()
  })

  it('update/applyDamage allocate no objects on the hot path', () => {
    const health = makeHealth()
    health.applyDamage(1, Layer.EnemyShot)
    health.update(0.016)
    const objectSpy = vi.spyOn(globalThis, 'Object')
    const arraySpy = vi.spyOn(globalThis, 'Array')
    const setSpy = vi.spyOn(globalThis, 'Set')
    health.applyDamage(1, Layer.EnemyShot)
    health.update(0.016)
    expect(objectSpy).not.toHaveBeenCalled()
    expect(arraySpy).not.toHaveBeenCalled()
    expect(setSpy).not.toHaveBeenCalled()
    objectSpy.mockRestore()
    arraySpy.mockRestore()
    setSpy.mockRestore()
    health.dispose()
  })
})
