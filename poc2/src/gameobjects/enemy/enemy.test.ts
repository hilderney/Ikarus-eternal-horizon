import { describe, expect, it } from 'vitest'
import { BoxGeometry } from 'three'
import { BALANCE } from '../../core/balancer'
import type { ShotLike } from '../../systems/shot-manager'
import { Enemy } from './enemy'
import { warriorAgilityLambda, warriorEngageRange, WARRIOR } from './warrior'

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
    enemy.activate({ x: 0, y: 0, z: -8 })
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

  it('fires the fixed weapon in chase when inside intel engage range', () => {
    const seek = { x: 0, y: 0, z: 0 }
    const gate = { x: 0, y: 0, z: -8 }
    const spawns: unknown[] = []
    const geo = new BoxGeometry(1, 1, 1)
    const enemy = new Enemy({
      geometry: geo,
      seekTarget: seek,
      gateTarget: gate,
      shots: makeShotPort(spawns),
    })
    enemy.activate({ x: 0, y: 0, z: -8 })
    for (let i = 0; i < 40; i++) {
      enemy.update(0.05)
    }
    expect(enemy.phase()).toBe('chase')
    expect(spawns.length).toBeGreaterThan(0)
    const bolt = spawns[0] as { damage: number; color: number }
    expect(bolt.damage).toBe(WARRIOR.weapon.damage)
    expect(bolt.color).toBe(WARRIOR.weapon.color)
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
