import { describe, expect, it } from 'vitest'
import type { EnemyGroup } from './enemy-group'
import { EnemySquadManager, type SquadShipPort } from './enemy-squad-manager'

class FakeShip implements SquadShipPort {
  x = 0
  z = 0
  vx = 0
  vz = 0
  hp = 10
  hpMax = 10
  active = true
  rogue = false
  migrations = 0
  slot = -1
  readonly affinity = new Float32Array(6)
  private _group: EnemyGroup | null = null

  constructor(x = 0, z = 0) {
    this.x = x
    this.z = z
  }

  assignSlot(group: EnemyGroup | null, index: number): void {
    this._group = group
    this.slot = index
  }

  isRogue(): boolean {
    return this.rogue
  }

  currentGroup(): EnemyGroup | null {
    return this._group
  }

  affinityTuning() {
    return { gainPerSec: 1, decayPerSec: 0.5, radius: 12, loyalty: 0.15 }
  }

  onMigrationStart(): void {
    this.migrations += 1
  }
}

function groupOf(ship: FakeShip): EnemyGroup {
  const group = ship.currentGroup()
  if (!group) {
    throw new Error('ship is not in a group')
  }
  return group
}

function makeSquad(rand = () => 0.5): EnemySquadManager {
  const squad = new EnemySquadManager({ capacity: 48, rand })
  squad.update(0, 0, 0, -60, 60)
  return squad
}

describe('EnemySquadManager registration', () => {
  it('opens a new group for a distant ship and reuses the nearby one', () => {
    const squad = makeSquad()
    const a = new FakeShip(0, -40)
    const b = new FakeShip(4, -42)
    const far = new FakeShip(0, 300)

    expect(squad.register(a)).toBe(true)
    expect(squad.register(b)).toBe(true)
    expect(squad.activeGroupCount()).toBe(1)
    expect(a.currentGroup()).toBe(b.currentGroup())

    expect(squad.register(far)).toBe(true)
    expect(squad.activeGroupCount()).toBe(2)
    expect(far.currentGroup()).not.toBe(a.currentGroup())
  })

  it('never activates more than the configured group cap', () => {
    const squad = makeSquad()
    const cap = squad.liveConfig().maxGroups
    for (let i = 0; i < cap + 4; i += 1) {
      // Each ship sits far from the others, so it always asks for a new group.
      expect(squad.register(new FakeShip(i * 1000, -40))).toBe(true)
    }
    expect(squad.activeGroupCount()).toBe(cap)
    expect(squad.groups().length).toBe(cap)
  })

  it('unregister frees the slot and stops tracking the ship', () => {
    const squad = makeSquad()
    const ship = new FakeShip(0, -40)
    squad.register(ship)
    expect(squad.trackedCount()).toBe(1)
    squad.unregister(ship)
    expect(squad.trackedCount()).toBe(0)
    expect(ship.currentGroup()).toBeNull()
    expect(squad.activeGroupCount()).toBe(0)
  })

  it('detached rogues stay tracked and land in the rogue roster', () => {
    const squad = makeSquad()
    const ship = new FakeShip(0, -40)
    squad.register(ship)
    ship.rogue = true
    squad.detachFromGroup(ship)
    squad.update(0.016, 0, 0, -60, 60)
    expect(ship.currentGroup()).toBeNull()
    expect(squad.trackedCount()).toBe(1)
    expect(squad.rogueCount()).toBe(1)
    expect(squad.rogueAt(0)).toBe(ship)
  })
})

describe('EnemySquadManager cadence', () => {
  it('runs structural decisions on the staggered tick, not every frame', () => {
    let roll = 0
    const squad = makeSquad(() => {
      roll += 0.17
      return roll % 1
    })
    const ship = new FakeShip(0, -40)
    squad.register(ship)
    const group = groupOf(ship)
    const firstTarget = group.targetX()

    // 5 Hz ⇒ 200 ms per tick; 4 frames of 16 ms cannot roll a new target.
    for (let i = 0; i < 4; i += 1) {
      squad.update(0.016, 0, 0, -60, 60)
    }
    expect(group.targetX()).toBe(firstTarget)

    for (let i = 0; i < 200; i += 1) {
      squad.update(0.05, 0, 0, -60, 60)
    }
    expect(group.targetX()).not.toBe(firstTarget)
  })

  it('clamps the arena bounds to the visible half width around the player', () => {
    const squad = makeSquad()
    squad.update(0.016, 10, 0, -600, 600)
    const half = squad.liveConfig().arenaHalfX
    expect(squad.arenaMinX()).toBe(10 - half)
    expect(squad.arenaMaxX()).toBe(10 + half)
  })

  it('keeps group centroids moving every frame', () => {
    const squad = makeSquad()
    const ship = new FakeShip(0, -40)
    squad.register(ship)
    const group = groupOf(ship)
    const startZ = group.z
    for (let i = 0; i < 20; i += 1) {
      squad.update(0.05, 0, 0, -60, 60)
    }
    expect(group.z).not.toBe(startZ)
  })
})

describe('EnemySquadManager affinity mesh', () => {
  it('migrates a ship that keeps hugging a foreign centroid', () => {
    const squad = makeSquad()
    const anchor = new FakeShip(0, -40)
    const guest = new FakeShip(0, 300)
    squad.register(anchor)
    squad.register(guest)
    const native = groupOf(guest)
    const target = groupOf(anchor)
    expect(native).not.toBe(target)

    // Park the guest on the other group's centroid; its own drifts away.
    for (let i = 0; i < 400; i += 1) {
      guest.x = target.x
      guest.z = target.z
      squad.update(0.05, 0, 0, -60, 60)
      if (guest.currentGroup() === target) {
        break
      }
    }
    expect(guest.currentGroup()).toBe(target)
    expect(guest.migrations).toBeGreaterThan(0)
    expect(guest.slot).toBeGreaterThanOrEqual(0)
  })

  it('leaves a loyal ship in its own group', () => {
    const squad = makeSquad()
    const a = new FakeShip(0, -40)
    const b = new FakeShip(0, 300)
    squad.register(a)
    squad.register(b)
    const nativeB = b.currentGroup()
    for (let i = 0; i < 200; i += 1) {
      squad.update(0.05, 0, 0, -60, 60)
    }
    expect(b.currentGroup()).toBe(nativeB)
    expect(b.migrations).toBe(0)
  })

  it('re-homes a tracked ship that lost its group', () => {
    const squad = makeSquad()
    const ship = new FakeShip(0, -40)
    squad.register(ship)
    squad.detachFromGroup(ship)
    expect(ship.currentGroup()).toBeNull()
    for (let i = 0; i < 20; i += 1) {
      squad.update(0.05, 0, 0, -60, 60)
    }
    expect(ship.currentGroup()).not.toBeNull()
  })

  it('reset clears every group and roster', () => {
    const squad = makeSquad()
    squad.register(new FakeShip(0, -40))
    squad.register(new FakeShip(0, 300))
    squad.reset()
    expect(squad.activeGroupCount()).toBe(0)
    expect(squad.trackedCount()).toBe(0)
    expect(squad.rogueCount()).toBe(0)
  })
})
