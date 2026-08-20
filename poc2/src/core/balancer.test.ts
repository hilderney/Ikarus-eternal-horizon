import { describe, expect, it } from 'vitest'
import { DASH_LEVELS } from '../gameobjects/controller/dash-levels'
import { BALANCE } from './balancer'

describe('BALANCE', () => {
  it('exposes a portrait playfield of 540×960', () => {
    expect(BALANCE.layout.playfield.width).toBe(540)
    expect(BALANCE.layout.playfield.height).toBe(960)
  })

  it('exposes render background, pixelRatioCap 2 and collapse 760', () => {
    expect(BALANCE.render.background).toBe(0x05040a)
    expect(BALANCE.render.pixelRatioCap).toBe(2)
    expect(BALANCE.render.antialias).toBe(true)
    expect(BALANCE.layout.collapsePx).toBe(760)
    expect(BALANCE.layout.areaWidth).toBe('17rem')
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
    expect(BALANCE.camera.fov).toBe(110)
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

  it('exposes gamepad W3C map: deadzone 0.18, Y 3, X 2, Start 9', () => {
    expect(BALANCE.gameplay.pauseKey).toBe('Escape')
    expect(BALANCE.controls.gamepad.deadzone).toBe(0.18)
    expect(BALANCE.controls.gamepad.triggerThreshold).toBe(0.35)
    expect(BALANCE.controls.gamepad.invertMoveZ).toBe(false)
    expect(BALANCE.controls.gamepad.axes).toEqual({ moveX: 0, moveZ: 1 })
    expect(BALANCE.controls.gamepad.buttons).toEqual({
      fire: 3,
      switchWeapon: 2,
      switchBomb: 1,
      pause: 9,
      dash: 5,
      bomb: 0,
      boost: 7,
      special: 6,
    })
  })

  it('exposes D19 action keys, dash, mouse buttons and touch overlay', () => {
    expect(BALANCE.gameplay.bombKey).toBe('KeyT')
    expect(BALANCE.gameplay.switchBombKey).toBe('KeyY')
    expect(BALANCE.gameplay.dashKey).toBe('Space')
    expect(BALANCE.controls.dash).toEqual({
      speedMul: DASH_LEVELS[0]?.speedMul,
      durationMs: BALANCE.ship.cooldowns.dashingMs,
    })
    expect(BALANCE.controls.mouse).toEqual({
      fireButton: 0,
      bombButton: 2,
    })
    expect(BALANCE.controls.touch.enabled).toBe('auto')
    expect(BALANCE.controls.touch.stickSize).toBe(120)
    expect(BALANCE.controls.touch.deadzone).toBe(0.18)
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

  it('exposes ship.stats byteCap 255 and spawn pools 100/100', () => {
    expect(BALANCE.ship.stats.byteCap).toBe(255)
    expect(BALANCE.ship.cooldowns).toEqual({
      flickeringMs: 2000,
      shootingMs: 500,
      dashingMs: 500,
      recoveringMs: 500,
    })
    for (const key of ['agility', 'deflection', 'integrity', 'shield', 'precision', 'energy'] as const) {
      expect(BALANCE.ship.stats[key]).toEqual({ current: 100, max: 100 })
    }
    expect(BALANCE.debug.syncHz).toBe(15)
  })

  it('exposes ship.modules airplane mounts and stat mods', () => {
    expect(BALANCE.ship.modules.layout.wings).toHaveLength(4)
    expect(BALANCE.ship.modules.layout.bombs).toHaveLength(2)
    expect(BALANCE.ship.modules.wings.agility.agility).toBe(25)
    expect(BALANCE.ship.modules.collector.wide.energyGain).toBe(2)
    expect(BALANCE.ship.modules.converter.crystal.labFusion).toBe(2)
  })

  it('exposes enemy left/right spawn volumes beside the ship', () => {
    expect(BALANCE.enemy.spawnLeft.offset).toEqual({ x: -140, y: 0, z: -140 })
    expect(BALANCE.enemy.spawnRight.offset).toEqual({ x: 140, y: 0, z: -140 })
    expect(BALANCE.enemy.spawnFront.offset).toEqual({ x: 0, y: 0, z: -140 })
    expect(BALANCE.enemy.spawnLeft.size.x).toBe(10)
    expect(BALANCE.enemy.spawnRight.size.x).toBe(10)
    expect(BALANCE.enemy.spawnFront.size.x).toBe(10)
    expect(BALANCE.enemy.spawnLeft.visible).toBe(true)
    expect(BALANCE.enemy.spawnRight.visible).toBe(true)
    expect(BALANCE.enemy.spawnFront.visible).toBe(true)
    expect(BALANCE.enemy.spawnLeft.color).toBe(0xff2222)
    expect(BALANCE.enemy.spawnLeft.intervalSec).toBe(3)
    expect(BALANCE.enemy.spawnRight.intervalSec).toBe(3)
    expect(BALANCE.enemy.spawnFront.intervalSec).toBe(3)
    expect(BALANCE.enemy.spawnLeft.maxActive).toBe(1)
    expect(BALANCE.enemy.spawnRight.maxActive).toBe(1)
    expect(BALANCE.enemy.spawnFront.maxActive).toBe(1)
    expect(BALANCE.enemy.spawnLeft.lanesX).toEqual([-4, -2, 0, 2, 4])
    expect(BALANCE.enemy.gate.offset.z).toBe(-90)
    expect(BALANCE.enemy.gate.reachSpeedMul).toBe(3)
    expect(BALANCE.enemy.warrior.id).toBe('warrior')
    expect(BALANCE.enemy.warrior.targets).toEqual(['enemyGate', 'player'])
    expect(BALANCE.enemy.warrior.weapon.rate).toBeGreaterThan(0)
    expect(BALANCE.enemy.shotPoolSize).toBe(64)
    expect(BALANCE.enemy.generic.hp).toBe(BALANCE.enemy.warrior.hp)
    expect(BALANCE.enemy.poolSize).toBe(32)
  })

  it('exposes gizmos gridSize 1000 and worldAxisSize 4', () => {
    expect(BALANCE.gizmos.gridSize).toBe(1000)
    expect(BALANCE.gizmos.worldAxisSize).toBe(4)
    expect(BALANCE.gizmos.cameraAxisSize).toBe(2.2)
  })

  it('exposes shot despawn bounds and laser+plasma loadout', () => {
    expect(BALANCE.shot.despawn).toEqual({ zNear: 16, zFar: -32, halfX: 16 })
    expect(BALANCE.weapons.loadout).toEqual(['laser', 'plasma', 'beam', 'mjolnir'])
    expect(BALANCE.weapons.catalog.laser.poolSize).toBe(128)
    expect(BALANCE.weapons.catalog.plasma.poolSize).toBe(32)
  })

  it('exposes BattleField ship-relative bounds (blue wall cull volume)', () => {
    expect(BALANCE.battlefield.offsetX).toEqual({ min: -240, max: 240 })
    expect(BALANCE.battlefield.offsetZ).toEqual({ min: -160, max: 30 })
    expect(BALANCE.battlefield.color).toBe(0x3b82f6)
    expect(BALANCE.battlefield.visible).toBe(true)
  })

  it('treats BALANCE as a frozen object (Object.isFrozen or as const)', () => {
    expect(Object.isFrozen(BALANCE)).toBe(true)
    expect(Object.isFrozen(BALANCE.layout)).toBe(true)
    expect(Object.isFrozen(BALANCE.ship.health)).toBe(true)
    expect(Object.isFrozen(BALANCE.controls.gamepad)).toBe(true)
    expect(Object.isFrozen(BALANCE.haptics.presets.shieldHit)).toBe(true)
  })
})
