import { describe, expect, it } from 'vitest'
import { BoxGeometry } from 'three'
import { BALANCE } from '../../core/balancer'
import type { ShotLike } from '../../systems/shot-manager'
import { Enemy } from './enemy'
import { cloneWarriorSheet, warriorAgilityLambda, warriorEngageRange, warriorMaxSpeed, WARRIOR } from './warrior'

function forceStraightSheet(): ReturnType<typeof cloneWarriorSheet> {
  const sheet = cloneWarriorSheet(WARRIOR)
  sheet.strategy.weights = { straight: 100, engage: 0, flee: 0, loop_around: 0 }
  sheet.strategy.mods = {
    hitted: {},
    hitting: {},
    in_range: {},
    passed_opponent: {},
  }
  sheet.strategy.swapBaseMs = 60_000
  return sheet
}

function makeShotPort(spawns: unknown[]) {
  return {
    acquire(): ShotLike | null {
      const shot: ShotLike = {
        active: false,
        lifetime: 0,
        x: 0,
        z: 0,
        spawnX: 0,
        spawnZ: 0,
        range: 0,
        activate(spawn: unknown) {
          spawns.push(spawn)
          this.active = true
        },
        update() {
          /* stub */
        },
        syncRender() {
          /* stub */
        },
        deactivate() {
          this.active = false
        },
      }
      return shot
    },
  }
}

describe('Warrior sheet', () => {
  it('exposes gate→player targets, agility, intelligence and fixed weapon', () => {
    expect(WARRIOR.id).toBe('warrior')
    expect(WARRIOR.targets).toEqual(['enemyGate', 'player'])
    expect(WARRIOR.agility).toBeGreaterThan(0)
    expect(WARRIOR.intelligence).toBeGreaterThan(0)
    expect(WARRIOR.weapon.rate).toBeGreaterThan(0)
    expect(WARRIOR.weapon.damage).toBeGreaterThan(0)
    expect(BALANCE.enemy.warrior).toEqual(WARRIOR)
  })

  it('maps agility to a damp lambda curve', () => {
    expect(warriorAgilityLambda(0)).toBeCloseTo(1.2, 5)
    expect(warriorAgilityLambda(100)).toBeCloseTo(6.2, 5)
    expect(warriorAgilityLambda(55)).toBeGreaterThan(warriorAgilityLambda(0))
  })

  it('derives maxSpeed as agility / 10', () => {
    expect(warriorMaxSpeed(55)).toBeCloseTo(5.5, 5)
    expect(warriorMaxSpeed(0)).toBe(0)
    expect(WARRIOR.maxSpeed).toBeCloseTo(warriorMaxSpeed(WARRIOR.agility), 5)
    expect(cloneWarriorSheet({ ...WARRIOR, agility: 80, maxSpeed: 1 }).maxSpeed).toBe(8)
  })

  it('maps intelligence to engage range fraction', () => {
    expect(warriorEngageRange(0, 28)).toBeCloseTo(28 * 0.35, 5)
    expect(warriorEngageRange(100, 28)).toBeCloseTo(28, 5)
  })
})

describe('Enemy Warrior', () => {
  it('activate loads the Warrior sheet', () => {
    const seek = { x: 0, y: 0, z: 0 }
    const gate = { x: 0, y: 0, z: -90 }
    const geo = new BoxGeometry(1, 1, 1)
    const enemy = new Enemy({ geometry: geo, seekTarget: seek, gateTarget: gate })
    enemy.activate({ x: 1, y: 50, z: -10 })
    expect(enemy.archetype()).toBe('warrior')
    expect(enemy.sheet().weapon.damage).toBe(WARRIOR.weapon.damage)
    expect(enemy.hp).toBe(WARRIOR.hp)
    expect(enemy.phase()).toBe('reachGate')
    enemy.dispose()
    geo.dispose()
  })

  it('reachGate aims at gate centre + personal entry offset X', () => {
    const seek = { x: 100, y: 0, z: 0 }
    const gate = { x: 0, y: 0, z: -90 }
    const geo = new BoxGeometry(1, 1, 1)
    const enemy = new Enemy({ geometry: geo, seekTarget: seek, gateTarget: gate })
    enemy.activate({ x: 0, y: 50, z: -140, gateEntryOffsetX: 18 })
    expect(enemy.gateEntryOffsetX()).toBe(18)
    enemy.update(0.5)
    expect(enemy.x).toBeGreaterThan(0)
    expect(enemy.phase()).toBe('reachGate')
    enemy.dispose()
    geo.dispose()
  })

  it('reachGate descends in Y toward the gate, not sideways to the ship', () => {
    const seek = { x: 100, y: 0, z: 0 }
    const gate = { x: 0, y: 0, z: -90 }
    const geo = new BoxGeometry(1, 1, 1)
    const enemy = new Enemy({ geometry: geo, seekTarget: seek, gateTarget: gate })
    enemy.activate({ x: 0, y: 50, z: -140 })
    enemy.update(0.5)
    expect(enemy.y).toBeLessThan(50)
    expect(enemy.z).toBeGreaterThan(-140)
    expect(Math.abs(enemy.x)).toBeLessThan(5)
    expect(enemy.phase()).toBe('reachGate')
    enemy.dispose()
    geo.dispose()
  })

  it('handoff preserves personal gate entry X (no snap to gate centre)', () => {
    const seek = { x: 0, y: 0, z: 0 }
    const gate = { x: 0, y: 0, z: -90 }
    const geo = new BoxGeometry(1, 1, 1)
    const enemy = new Enemy({ geometry: geo, seekTarget: seek, gateTarget: gate })
    const entryX = -18
    const sheet = forceStraightSheet()
    enemy.activate({
      x: -160,
      y: 50,
      z: -140,
      gateEntryOffsetX: entryX,
      pathSide: 'left',
      sheet,
    })
    for (let i = 0; i < 300; i++) {
      enemy.update(0.05)
      if (enemy.phase() === 'chase') {
        break
      }
    }
    expect(enemy.phase()).toBe('chase')
    expect(enemy.chaseStrategy()).toBe('straight')
    const atGateX = enemy.x
    // Must stay on the chosen marker, not jump to gate centre (x=0).
    expect(Math.abs(atGateX - (gate.x + entryX))).toBeLessThan(1.5)
    expect(Math.abs(atGateX)).toBeGreaterThan(10)
    // First chase frames must not teleport toward ship/gate centre.
    for (let i = 0; i < 4; i++) {
      enemy.update(0.05)
    }
    expect(Math.abs(enemy.x - atGateX)).toBeLessThan(3)
    expect(Math.abs(enemy.x)).toBeGreaterThan(10)
    enemy.dispose()
    geo.dispose()
  })

  it('handoff to chase keeps gate-plane Y without a snap teleport', () => {
    const seek = { x: 0, y: 0, z: 0 }
    const gate = { x: 0, y: 0, z: -8 }
    const geo = new BoxGeometry(1, 1, 1)
    const enemy = new Enemy({ geometry: geo, seekTarget: seek, gateTarget: gate })
    enemy.activate({ x: 0, y: 2, z: -8 })
    const yBefore = enemy.y
    for (let i = 0; i < 80; i++) {
      enemy.update(0.1)
      if (enemy.phase() === 'chase') {
        break
      }
    }
    expect(enemy.phase()).toBe('chase')
    // Soft handoff: Y stays continuous from the lerp (gate.y), no hard assign jump.
    expect(Math.abs(enemy.y - gate.y)).toBeLessThan(0.25)
    expect(Math.abs(enemy.y - yBefore)).toBeLessThan(3)
    enemy.dispose()
    geo.dispose()
  })

  it('chase flyby advances +Z past the player instead of parking on them', () => {
    const seek = { x: 0, y: 0, z: 0 }
    const gate = { x: 0, y: 0, z: -8 }
    const geo = new BoxGeometry(1, 1, 1)
    const enemy = new Enemy({ geometry: geo, seekTarget: seek, gateTarget: gate })
    const sheet = forceStraightSheet()
    enemy.activate({ x: 0, y: 0, z: -8, sheet })
    for (let i = 0; i < 40; i++) {
      enemy.update(0.05)
    }
    expect(enemy.phase()).toBe('chase')
    const zAtPlayer = enemy.z
    for (let i = 0; i < 20; i++) {
      enemy.update(0.1)
    }
    expect(enemy.z).toBeGreaterThan(zAtPlayer)
    expect(enemy.z).toBeGreaterThan(0)
    enemy.dispose()
    geo.dispose()
  })

  it('fires weapon bolts along the nose (+Z when facing forward)', () => {
    const seek = { x: 0, y: 0, z: 10 }
    const gate = { x: 0, y: 0, z: -8 }
    const spawns: unknown[] = []
    const geo = new BoxGeometry(1, 1, 1)
    const enemy = new Enemy({
      geometry: geo,
      seekTarget: seek,
      gateTarget: gate,
      shots: makeShotPort(spawns),
    })
    const sheet = forceStraightSheet()
    sheet.targets = ['player']
    sheet.weapon.rate = 10
    sheet.weapon.fireConeDeg = 40
    enemy.activate({ x: 0, y: 0, z: 0, sheet })
    for (let i = 0; i < 30; i++) {
      enemy.update(0.05)
    }
    expect(enemy.phase()).toBe('chase')
    expect(spawns.length).toBeGreaterThan(0)
    const bolt = spawns[0] as { vx: number; vz: number; damage: number }
    expect(bolt.vx).toBeCloseTo(0, 5)
    expect(bolt.vz).toBeGreaterThan(0)
    expect(bolt.damage).toBe(WARRIOR.weapon.damage)
    enemy.dispose()
    geo.dispose()
  })

  it('marks in_range and passed_opponent from player proximity / Z', () => {
    const seek = { x: 0, y: 0, z: 0 }
    const gate = { x: 0, y: 0, z: -8 }
    const geo = new BoxGeometry(1, 1, 1)
    const enemy = new Enemy({ geometry: geo, seekTarget: seek, gateTarget: gate })
    const sheet = forceStraightSheet()
    enemy.activate({ x: 0, y: 0, z: -5, sheet })
    enemy.update(0.05)
    expect(enemy.statusSnapshot().in_range).toBe(true)
    expect(enemy.statusSnapshot().passed_opponent).toBe(false)
    for (let i = 0; i < 80; i++) {
      enemy.update(0.1)
    }
    expect(enemy.z).toBeGreaterThan(0)
    expect(enemy.statusSnapshot().passed_opponent).toBe(true)
    enemy.dispose()
    geo.dispose()
  })

  it('locks strategy while loop_around is in progress', () => {
    const seek = { x: 0, y: 0, z: 0 }
    const gate = { x: 0, y: 0, z: -8 }
    const geo = new BoxGeometry(1, 1, 1)
    const enemy = new Enemy({ geometry: geo, seekTarget: seek, gateTarget: gate })
    const sheet = cloneWarriorSheet(WARRIOR)
    sheet.targets = ['player']
    sheet.strategy.weights = { straight: 0, engage: 0, flee: 0, loop_around: 100 }
    sheet.strategy.mods = {
      hitted: {},
      hitting: {},
      in_range: {},
      passed_opponent: {},
    }
    sheet.strategy.swapBaseMs = 100
    sheet.strategy.loopAround = { radius: 8, speedMul: 1.2, retreatZ: 4 }
    enemy.activate({ x: 5, y: 0, z: -8, sheet })
    for (let i = 0; i < 20; i++) {
      enemy.update(0.05)
      if (enemy.chaseStrategy() === 'loop_around') {
        break
      }
    }
    expect(enemy.chaseStrategy()).toBe('loop_around')
    expect(enemy.statusSnapshot().fixed_movement_strategy).toBe(true)
    const locked = enemy.chaseStrategy()
    for (let i = 0; i < 10; i++) {
      enemy.update(0.05)
      expect(enemy.chaseStrategy()).toBe(locked)
      expect(enemy.statusSnapshot().fixed_movement_strategy).toBe(true)
    }
    enemy.dispose()
    geo.dispose()
  })

  it('speed changes gradually when entering reachGate', () => {
    const seek = { x: 0, y: 0, z: 0 }
    const gate = { x: 0, y: 0, z: -90 }
    const geo = new BoxGeometry(1, 1, 1)
    const enemy = new Enemy({ geometry: geo, seekTarget: seek, gateTarget: gate })
    enemy.activate({ x: 0, y: 50, z: -140 })
    const start = enemy.currentSpeed()
    expect(start).toBe(WARRIOR.maxSpeed)
    enemy.update(0.05)
    const mid = enemy.currentSpeed()
    expect(mid).toBeGreaterThan(start)
    expect(mid).toBeLessThan(WARRIOR.maxSpeed * WARRIOR.reachSpeedMul)
    enemy.dispose()
    geo.dispose()
  })

  it('takeDamage to 0 deactivates once', () => {
    const seek = { x: 0, y: 0, z: 0 }
    const gate = { x: 0, y: 0, z: -90 }
    const geo = new BoxGeometry(1, 1, 1)
    const enemy = new Enemy({ geometry: geo, seekTarget: seek, gateTarget: gate })
    enemy.activate({ x: 0, y: 0, z: -5 })
    expect(enemy.applyDamage(WARRIOR.hp, 0).killed).toBe(true)
    expect(enemy.active).toBe(false)
    expect(enemy.applyDamage(2, 0).killed).toBe(false)
    enemy.dispose()
    geo.dispose()
  })
})
