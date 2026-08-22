import { describe, expect, it } from 'vitest'
import { EnemyGroup, type GroupMemberPort, type GroupWorldContext } from './enemy-group'
import { cloneSquadConfig, DEFAULT_SQUAD_CONFIG } from './squad-config'

const CTX: GroupWorldContext = { playerX: 0, playerZ: 0, minX: -60, maxX: 60 }

class FakeShip implements GroupMemberPort {
  x = 0
  z = 0
  hp = 10
  hpMax = 10
  group: EnemyGroup | null = null
  slot = -1

  constructor(x = 0, z = 0) {
    this.x = x
    this.z = z
  }

  assignSlot(group: EnemyGroup | null, index: number): void {
    this.group = group
    this.slot = index
  }
}

function shipAt(ships: FakeShip[], index: number): FakeShip {
  const ship = ships[index]
  if (!ship) {
    throw new Error(`missing ship ${index}`)
  }
  return ship
}

function makeGroup(rand: () => number = () => 0.5): EnemyGroup {
  const group = new EnemyGroup(0, cloneSquadConfig(DEFAULT_SQUAD_CONFIG), rand)
  group.spawnAt(0, -40, CTX)
  return group
}

describe('EnemyGroup slots', () => {
  it('hands out packed slot ids and refuses members past capacity', () => {
    const group = makeGroup()
    const ships: FakeShip[] = []
    for (let i = 0; i < group.capacity(); i += 1) {
      const ship = new FakeShip()
      ships.push(ship)
      expect(group.reserveSlot(ship)).toBe(i)
    }
    expect(group.hasFreeSlot()).toBe(false)
    expect(group.reserveSlot(new FakeShip())).toBe(-1)
    expect(group.memberCount()).toBe(group.capacity())
    expect(group.slotCount()).toBe(group.capacity())
  })

  it('never gives two members the same slot after a release', () => {
    const group = makeGroup()
    const ships = [new FakeShip(), new FakeShip(), new FakeShip(), new FakeShip()]
    for (const ship of ships) {
      group.reserveSlot(ship)
    }
    group.releaseSlot(shipAt(ships, 1))

    expect(shipAt(ships, 1).group).toBeNull()
    expect(shipAt(ships, 1).slot).toBe(-1)
    expect(group.memberCount()).toBe(3)
    const used = new Set<number>()
    for (const ship of ships) {
      if (ship.slot < 0) {
        continue
      }
      expect(used.has(ship.slot)).toBe(false)
      expect(ship.slot).toBeLessThan(group.memberCount())
      used.add(ship.slot)
    }
    expect(used.size).toBe(3)
  })

  it('deactivates when the last member leaves', () => {
    const group = makeGroup()
    const ship = new FakeShip()
    group.reserveSlot(ship)
    group.releaseSlot(ship)
    expect(group.active).toBe(false)
    expect(group.memberCount()).toBe(0)
  })

  it('flags a sole survivor only after the formation actually took losses', () => {
    const group = makeGroup()
    const alone = new FakeShip()
    group.reserveSlot(alone)
    // A brand-new one-ship group is forming up, not a wiped-out squad.
    expect(group.isLastSurvivor(alone)).toBe(false)

    const mate = new FakeShip()
    group.reserveSlot(mate)
    group.releaseSlot(mate)
    expect(group.isLastSurvivor(alone)).toBe(true)
  })

  it('rotates slot offsets with the group heading', () => {
    const group = makeGroup()
    group.reserveSlot(new FakeShip())
    group.reserveSlot(new FakeShip())
    const out = { x: 0, z: 0 }
    group.heading = Math.PI / 2
    group.localToWorld(1, 0, out)
    // Heading +90° points the nose at +X, so local right (+X) maps to −Z.
    expect(out.x - group.x).toBeCloseTo(0, 6)
    expect(out.z - group.z).toBeCloseTo(-1, 6)
  })

  it('reports the aggregate hull ratio', () => {
    const group = makeGroup()
    const a = new FakeShip()
    const b = new FakeShip()
    group.reserveSlot(a)
    group.reserveSlot(b)
    expect(group.healthRatio()).toBe(1)
    a.hp = 0
    b.hp = 5
    expect(group.healthRatio()).toBeCloseTo(0.25, 6)
  })
})

describe('EnemyGroup objectives', () => {
  it('rolls a new patrol target only after the 3–5 s countdown', () => {
    const group = makeGroup(() => 0.5)
    group.reserveSlot(new FakeShip())
    const firstX = group.targetX()
    const firstZ = group.targetZ()

    group.tick(1000, CTX)
    expect(group.targetX()).toBe(firstX)
    expect(group.targetZ()).toBe(firstZ)

    group.tick(DEFAULT_SQUAD_CONFIG.targetHoldMaxMs, { ...CTX, playerX: 30 })
    expect(group.targetX()).not.toBe(firstX)
  })

  it('keeps the patrol target inside the arena and ahead of the player', () => {
    const group = makeGroup(() => 0.99)
    group.reserveSlot(new FakeShip())
    group.tick(DEFAULT_SQUAD_CONFIG.targetHoldMaxMs, CTX)
    expect(group.targetX()).toBeLessThanOrEqual(CTX.maxX - DEFAULT_SQUAD_CONFIG.containmentInsetX)
    expect(group.targetX()).toBeGreaterThanOrEqual(
      CTX.minX + DEFAULT_SQUAD_CONFIG.containmentInsetX,
    )
    expect(group.targetZ()).toBeLessThan(CTX.playerZ)
  })

  it('switches to aggressive intercept after losing more than half the members', () => {
    const group = makeGroup()
    const ships = [new FakeShip(), new FakeShip(), new FakeShip(), new FakeShip()]
    for (const ship of ships) {
      group.reserveSlot(ship)
    }
    group.tick(100, CTX)
    expect(group.objective).toBe('patrol')

    group.releaseSlot(shipAt(ships, 0))
    group.releaseSlot(shipAt(ships, 1))
    group.tick(100, CTX)
    expect(group.objective).toBe('patrol')

    group.releaseSlot(shipAt(ships, 2))
    group.tick(100, { ...CTX, playerX: 12, playerZ: 3 })
    expect(group.objective).toBe('intercept')
    expect(group.formation).toBe('vWing')
    expect(group.targetX()).toBe(12)
    expect(group.targetZ()).toBe(3 - DEFAULT_SQUAD_CONFIG.interceptStandoffZ)
  })

  it('picks a formation from the member count while patrolling', () => {
    const group = makeGroup()
    for (let i = 0; i < 4; i += 1) {
      group.reserveSlot(new FakeShip())
    }
    group.tick(10, CTX)
    expect(group.formation).toBe('hollowDiamond')

    for (let i = 0; i < 2; i += 1) {
      group.reserveSlot(new FakeShip())
    }
    group.tick(10, CTX)
    expect(group.formation).toBe('hollowCircle')
  })
})

describe('EnemyGroup motion', () => {
  it('drives the centroid toward the patrol target and turns the heading', () => {
    const group = makeGroup()
    group.reserveSlot(new FakeShip())
    const before = Math.hypot(group.x - group.targetX(), group.z - group.targetZ())
    for (let i = 0; i < 60; i += 1) {
      group.integrate(0.05, CTX, [group])
    }
    const after = Math.hypot(group.x - group.targetX(), group.z - group.targetZ())
    expect(after).toBeLessThan(before)
    expect(Math.hypot(group.vx, group.vz)).toBeLessThanOrEqual(
      DEFAULT_SQUAD_CONFIG.groupMaxSpeed + 1e-6,
    )
    expect(Number.isFinite(group.omega)).toBe(true)
  })

  it('pushes overlapping groups apart', () => {
    const config = cloneSquadConfig(DEFAULT_SQUAD_CONFIG)
    const a = new EnemyGroup(0, config, () => 0.5)
    const b = new EnemyGroup(1, config, () => 0.5)
    a.spawnAt(0, -40, CTX)
    b.spawnAt(2, -40, CTX)
    a.reserveSlot(new FakeShip())
    b.reserveSlot(new FakeShip())
    const groups = [a, b]
    const before = Math.hypot(a.x - b.x, a.z - b.z)
    for (let i = 0; i < 30; i += 1) {
      a.integrate(0.05, CTX, groups)
      b.integrate(0.05, CTX, groups)
    }
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(before)
  })

  it('ignores frames while inactive', () => {
    const group = new EnemyGroup(0, cloneSquadConfig(DEFAULT_SQUAD_CONFIG), () => 0.5)
    group.integrate(0.05, CTX, [group])
    group.tick(1000, CTX)
    expect(group.x).toBe(0)
    expect(group.z).toBe(0)
  })
})
