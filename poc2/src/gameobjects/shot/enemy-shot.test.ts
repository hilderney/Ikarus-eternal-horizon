import { describe, expect, it } from 'vitest'
import { EnemyShot } from './enemy-shot'

describe('EnemyShot', () => {
  it('uses EnemyShot layer and warm activate color', () => {
    const shot = new EnemyShot({ color: 0xfb923c })
    expect(shot.layer).toBe('EnemyShot')
    shot.activate({
      x: 0,
      z: -4,
      vx: 0,
      vz: 10,
      damage: 4,
      lifetime: 1,
      totalLifetime: 1,
      radius: 0.2,
      aoeRadius: 0,
      range: 20,
      decayPerUnit: 0,
      color: 0xfb923c,
    })
    expect(shot.active).toBe(true)
    shot.update(0.1)
    expect(shot.z).toBeCloseTo(-3, 5)
    shot.dispose()
  })
})
