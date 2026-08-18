import { describe, expect, it } from 'vitest'
import { BALANCE } from './balancer'

describe('BALANCE', () => {
  it('exposes a portrait playfield of 540×960', () => {
    expect(BALANCE.layout.playfield.width).toBe(540)
    expect(BALANCE.layout.playfield.height).toBe(960)
  })

  it('exposes energy start=max=100 and regenPerSec=8', () => {
    expect(BALANCE.gameplay.energy.start).toBe(100)
    expect(BALANCE.gameplay.energy.max).toBe(100)
    expect(BALANCE.gameplay.energy.regenPerSec).toBe(8)
  })

  it('exposes motion maxSpeed=12, accel=60, brake=120', () => {
    expect(BALANCE.controls.motion.maxSpeed).toBe(12)
    expect(BALANCE.controls.motion.accel).toBe(60)
    expect(BALANCE.controls.motion.decel).toBe(60)
    expect(BALANCE.controls.motion.brake).toBe(120)
  })

  it('exposes dynamic camera fov=85 at {3,14,6} / {-55,24,-14}', () => {
    expect(BALANCE.camera.fov).toBe(85)
    expect(BALANCE.camera.position).toEqual({ x: 3, y: 14, z: 6 })
    expect(BALANCE.camera.rotation).toEqual({ x: -55, y: 24, z: -14 })
    expect(BALANCE.camera.near).toBe(5)
    expect(BALANCE.camera.far).toBe(10000)
  })

  it('exposes ship.health with four speedMul slots', () => {
    expect(BALANCE.ship.health.speedMul).toHaveLength(4)
    expect(BALANCE.ship.health.speedMul).toEqual([1, 0.85, 0.7, 0.5])
    expect(BALANCE.ship.health.integrityMax).toBe(100)
    expect(BALANCE.ship.health.shieldMax).toBe(50)
    expect(BALANCE.ship.health.hullThresholds).toEqual([0.75, 0.5, 0.25])
  })

  it('exposes difficulty milestones 50 / 100 / 500', () => {
    expect(BALANCE.difficulty.miniBossAt).toBe(50)
    expect(BALANCE.difficulty.megaAsteroidAt).toBe(100)
    expect(BALANCE.difficulty.bossAt).toBe(500)
  })

  it('exposes score and drops and vfx.shake.maxAmplitude', () => {
    expect(BALANCE.score.enemy).toBe(100)
    expect(BALANCE.score.meteor).toBe(25)
    expect(BALANCE.drops.magnetRadius).toBe(2.5)
    expect(BALANCE.drops.metalScrapChance).toBe(0.4)
    expect(BALANCE.vfx.shake.maxAmplitude).toBe(0.18)
    expect(BALANCE.vfx.hitStopFrames).toBe(3)
  })

  it('exposes gamepad W3C map: deadzone 0.18, RT 7, LB 4, Start 9', () => {
    expect(BALANCE.gameplay.pauseKey).toBe('Escape')
    expect(BALANCE.controls.gamepad.deadzone).toBe(0.18)
    expect(BALANCE.controls.gamepad.triggerThreshold).toBe(0.35)
    expect(BALANCE.controls.gamepad.invertMoveZ).toBe(false)
    expect(BALANCE.controls.gamepad.axes).toEqual({ moveX: 0, moveZ: 1 })
    expect(BALANCE.controls.gamepad.buttons).toEqual({
      fire: 7,
      switchWeapon: 4,
      pause: 9,
      boost: 6,
      special: 0,
    })
  })

  it('exposes haptics presets shieldHit / hullHit / shieldBreak / destroyed', () => {
    expect(BALANCE.haptics.enabled).toBe(true)
    expect(BALANCE.haptics.presets.shieldHit).toEqual({
      durationMs: 40,
      strongMagnitude: 0.12,
      weakMagnitude: 0.35,
    })
    expect(BALANCE.haptics.presets.hullHit).toEqual({
      durationMs: 80,
      strongMagnitude: 0.45,
      weakMagnitude: 0.28,
    })
    expect(BALANCE.haptics.presets.shieldBreak.durationMs).toBe(180)
    expect(BALANCE.haptics.presets.destroyed.strongMagnitude).toBe(1)
    expect(BALANCE.haptics.presets.fireLaser.weakMagnitude).toBe(0.08)
  })

  it('exposes loop maxFrameDt 0.05 and sidecarHz 15', () => {
    expect(BALANCE.loop.maxFrameDt).toBe(0.05)
    expect(BALANCE.loop.sidecarHz).toBe(15)
  })

  it('exposes ship inventory caps 999 / 99 / 49 / 9', () => {
    expect(BALANCE.ship.inventory.caps).toEqual({
      metalScrap: 999,
      prismaticCrystal: 99,
      denseCore: 49,
      darkMatter: 9,
    })
  })

  it('exposes gizmos gridSize 1000 and worldAxisSize 4', () => {
    expect(BALANCE.gizmos.gridSize).toBe(1000)
    expect(BALANCE.gizmos.worldAxisSize).toBe(4)
    expect(BALANCE.gizmos.cameraAxisSize).toBe(2.2)
  })

  it('treats BALANCE as a frozen object (Object.isFrozen or as const)', () => {
    expect(Object.isFrozen(BALANCE)).toBe(true)
    expect(Object.isFrozen(BALANCE.layout)).toBe(true)
    expect(Object.isFrozen(BALANCE.ship.health)).toBe(true)
    expect(Object.isFrozen(BALANCE.controls.gamepad)).toBe(true)
    expect(Object.isFrozen(BALANCE.haptics.presets.shieldHit)).toBe(true)
  })
})
