/**
 * #tag/arch #tag/weapons #tag/memory
 *
 * Card:         SDD-D02 Weapon device + Laser
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: WPN-01, WPN-04, WPN-05, SHIP-03
 * Change type:  port + class-ify
 * POC-1 origin: poc/src/weapons/{weapon,behaviour,registry,laserLevels,behaviours/laser}.ts
 *               + poc/src/core/weaponsCatalog.ts  — frozen reference
 * Test file:    poc2/src/gameobjects/weapon/weapon.test.ts
 *               poc2/src/gameobjects/weapon/laser-levels.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      The weapon device, the behaviour port, the catalog, the registry
 *            seam (D12), LaserBehaviour, and LASER_LEVELS.
 *            interface WeaponBehaviour { update(ctx); dispose() }
 *            class Weapon — owns a pooled WeaponShot set + a behaviour from
 *            the registry. catalog.ts holds WEAPONS. registry.ts is
 *            Record<WeaponId, factory> + registerWeapon. laser-levels.ts
 *            holds L1–L10 and applyLaserLevel.
 * Does not own: WeaponShot mesh (D01), EnergyManager (D03), FiringManager
 *            (E07), Plasma/Beam/Mjolnir behaviours (D04–D06 register into
 *            this seam). BALANCE.weapons.catalog *imports* this catalog.
 * Player-facing: the laser volley shape per level (L1 one bolt … L10 ten)
 *            and the cyan cadence. Adding a weapon must not require editing
 *            class Weapon.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-A01 Balancer     — BALANCE.weapons.loadout; catalog imported here
 *   SDD-A03 Math         — DEG2RAD for diagonal volleys
 *   SDD-A05 ObjectPool   — pool of WeaponShot
 *   SDD-D01 WeaponShot   — activate(ShotSpawn)
 *   SDD-D03 EnergyManager — EnergyPort canAfford/spend
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-D04 Plasma / D05 Beam / D06 Mjolnir — 1 catalog row + 1 registry row
 *   SDD-E07 FiringManager — constructs Weapon, feeds BehaviourCtx
 *   SDD-G08 Debugger      — LASER_LEVELS presets
 */

// ─── 9. Agent sign-off ───────────────────────────────────────────────────────
/**
 * Orchestrator : hub-v4.1 / 2026-08-17  scope, requires, DoD
 * Programming  : hub-v4.1 / 2026-08-17  contract, memory, THREE / view
 * Game Design  : hub-v4.1 / 2026-08-17  BALANCE, feel, leveling, graphics
 * TDD          : hub-v4.1 / 2026-08-17  cases named; test file not yet written (red next)
 *
 * DoD (§6.1): spec · tests red · shape · lifecycle · BALANCE · memory ·
 *             IDs · verify green · port fidelity
 * Status: spec-complete
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Programming / Three.js
// ═════════════════════════════════════════════════════════════════════════════

// ─── 2. Contract ─────────────────────────────────────────────────────────────
/**
 * Public surface. Ports first, then the class. Constructor dependencies explicit.
 * No service locators. No globals besides BALANCE.
 * Bolt visuals live on WeaponShot (D01); Weapon itself is not a THREE object.
 * D12: adding a weapon = 1 catalog entry + 1 registry entry. Weapon is untouched.
 */

export type WeaponId = 'laser' | 'plasma' | 'beam' | 'mjolnir'

export type WeaponProfile = 'projectile' | 'orb' | 'beam' | 'cone'

export interface Vec3Like {
  x: number
  y: number
  z: number
}

export interface TargetHit {
  team: 'player' | 'enemy'
  active: boolean
  x: number
  z: number
  radius: number
  takeDamage(amount: number): void
}

/** Port owned by SDD-D03. */
export interface EnergyPort {
  canAfford(cost: number): boolean
  spend(cost: number): void
}

export interface WeaponServices {
  energy: EnergyPort
  targets: readonly TargetHit[]
}

export interface WeaponModifiers {
  damageMul: number
  rateMul: number
  energyMul: number
  critChance: number
  pulses: number
  aoeMul: number
  beamWidthMul: number
  coneMul: number
}

export interface BehaviourCtx {
  dt: number
  holding: boolean
  muzzle: Vec3Like
  services: WeaponServices
  mods: WeaponModifiers
}

export interface WeaponBehaviour {
  update(ctx: BehaviourCtx): void
  dispose(): void
}

export interface ProjectileSpec {
  readonly speed: number
  readonly radius: number
  readonly lifetime: number
  readonly damageDecayPerUnit: number
}

export interface OrbSpec {
  readonly speed: number
  readonly radius: number
  readonly lifetime: number
  readonly aoeRadius: number
  readonly damageDecayPerUnit: number
}

export interface BeamSpec {
  readonly width: number
  readonly length: number
  readonly ticksPerSec: number
  readonly dps: number
  readonly energyPerSec: number
}

export interface ConeSpec {
  readonly angleDeg: number
  readonly length: number
  readonly ticksPerSec: number
  readonly dps: number
  readonly energyPerSec: number
}

export interface LaserSpec {
  readonly forwardShots: number
  readonly diagonalShotsPerSide: number
  readonly totalShots: number
  readonly diagonalAngleDeg: number
  readonly forwardSpread: number
  readonly diagonalSpreadDeg: number
}

export interface WeaponConfig {
  readonly id: WeaponId
  readonly displayName: string
  readonly color: number
  readonly rate: number
  readonly energyPerShot: number
  readonly damage: number
  readonly profile: WeaponProfile
  readonly poolSize: number
  readonly muzzleOffset: { readonly x: number; readonly y: number; readonly z: number }
  level?: number
  projectile?: ProjectileSpec
  orb?: OrbSpec
  beam?: BeamSpec
  cone?: ConeSpec
  laser?: LaserSpec
}

export interface LaserLevel {
  readonly level: number
  readonly damage: number
  readonly rate: number
  readonly energyPerShot: number
  readonly speed: number
  readonly radius: number
  readonly lifetime: number
  readonly forwardShots: number
  readonly diagonalShotsPerSide: number
  readonly diagonalAngleDeg: number
  readonly forwardSpread: number
}

export type WeaponBehaviourFactory = (
  config: WeaponConfig,
  pool: { acquire(): { activate(spawn: unknown): void } | null },
  scene: unknown,
) => WeaponBehaviour

export declare const WEAPONS: Record<WeaponId, WeaponConfig>

export declare const WEAPON_REGISTRY: Record<WeaponId, WeaponBehaviourFactory>

export declare function registerWeapon(id: WeaponId, factory: WeaponBehaviourFactory): void

export declare const LASER_LEVELS: readonly LaserLevel[]

export declare function applyLaserLevel(cfg: WeaponConfig, level: number): void

export declare function defaultModifiers(): WeaponModifiers

export declare class Weapon {
  /**
   * Looks up WEAPONS[id] + WEAPON_REGISTRY[id]. Builds the pool (A05) of
   * config.poolSize and the behaviour via the factory. No switch on WeaponId.
   */
  constructor(id: WeaponId, scene: THREE.Scene)

  readonly id: WeaponId
  readonly config: WeaponConfig
  readonly pool: { acquire(): unknown; dispose(): void }

  update(ctx: BehaviourCtx): void
  dispose(): void
}

export declare class LaserBehaviour implements WeaponBehaviour {
  constructor(
    config: WeaponConfig,
    pool: { acquire(): { activate(spawn: unknown): void } | null },
  )

  update(ctx: BehaviourCtx): void
  dispose(): void
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   module            | role
 *   ------------------|------------------------------------------------
 *   catalog.ts        | WEAPONS data; imported by BALANCE.weapons.catalog
 *   registry.ts       | WEAPON_REGISTRY + registerWeapon (D12 seam)
 *   laser-levels.ts   | LASER_LEVELS[1..10] + applyLaserLevel
 *   weapon.ts         | class Weapon — device: pool + behaviour
 *   behaviours/laser.ts | class LaserBehaviour
 *
 * Weapon:
 *   constructor looks up WEAPONS[id] and WEAPON_REGISTRY[id] (or receives
 *   them injected). update forwards to behaviour.update(ctx). dispose
 *   disposes behaviour then pool.
 *
 * LaserBehaviour.update:
 *   cooldown -= dt; return if !holding or cooldown>0.
 *   cost = energyPerShot * energyMul; return if !canAfford; then spend.
 *   Spawn forwardShots along X with forwardSpread; for each side ±1 spawn
 *   diagonalShotsPerSide at ±diagonalAngleDeg + jitter * diagonalSpreadDeg.
 *   vx,vz = (sin(rad)*speed, -cos(rad)*speed); forward uses vx=0, vz=-speed.
 *   ShotSpawn.aoeRadius = 0; decayPerUnit = 0; totalLifetime = lifetime;
 *   range = speed * lifetime.
 *   cooldown = 1 / (rate * rateMul).
 *
 * applyLaserLevel:
 *   copies the matching LASER_LEVELS row onto cfg damage/rate/energyPerShot
 *   and projectile.speed/radius/lifetime and laser.forward/diag/angle/spread.
 *   laser.totalShots = forwardShots + 2 * diagonalShotsPerSide (= level).
 *
 * Non-obvious: Weapon does not switch behaviours itself — E07 constructs a
 * new Weapon(id). registerWeapon is the only DLC hook.
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. WeaponBehaviour is { update(ctx): void; dispose(): void }.
 *   R2. Weapon is a device: pool + behaviour via registry. It has no switch
 *       statement on WeaponId.
 *   R3. Adding a weapon = 1 catalog.ts entry + 1 registerWeapon call.
 *       Class Weapon is not edited (D12).
 *   R4. Energy gate: no spawn when !canAfford(energyPerShot * energyMul).
 *   R5. Cadence: cooldown = 1 / (rate * rateMul). First shot is allowed
 *       on the first holding frame (cooldown starts at 0).
 *   R6. totalShots = forwardShots + 2 * diagonalShotsPerSide = level
 *       for every LASER_LEVELS row.
 *   R7. L1 = 1 forward; L4 = 4 forward; L5 = 3 forward + 1/side; L10 = 4
 *       forward + 3/side.
 *   R8. Laser bolts: speed 30, lifetime 1, aoeRadius 0. Pool size 128.
 *   R9. Per-frame allocation: none. Shots come from the pool; acquire null
 *       skips that bolt (no new).
 *   R10. dispose() disposes behaviour and the pool (every WeaponShot GPU).
 *   R11. applyLaserLevel is a no-op for an unknown level (does not throw).
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      N/A on Weapon / LaserBehaviour — bolts are D01 WeaponShot
 * Inheritance: N/A (device + behaviour)
 * syncRender writes: N/A (shots sync themselves)
 * Scene ownership: pool items added by A05/E04; Weapon does not scene.add
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 * Laser catalog (L1 defaults; applyLaserLevel overwrites per level):
 *   BALANCE.weapons.catalog.laser.id             = 'laser'
 *   BALANCE.weapons.catalog.laser.displayName    = 'Laser'
 *   BALANCE.weapons.catalog.laser.color          = 0x22d3ee
 *   BALANCE.weapons.catalog.laser.rate           = 8
 *   BALANCE.weapons.catalog.laser.energyPerShot  = 0.25
 *   BALANCE.weapons.catalog.laser.damage         = 1
 *   BALANCE.weapons.catalog.laser.profile        = 'projectile'
 *   BALANCE.weapons.catalog.laser.poolSize       = 128
 *   BALANCE.weapons.catalog.laser.muzzleOffset   = { x: 0, y: 0, z: -1.4 }
 *   projectile.speed / lifetime / radius         = 30 / 1 / 0.12
 *   laser.forwardShots / diagonalShotsPerSide    = 1 / 0
 *   laser.totalShots                             = 1
 *   laser.diagonalAngleDeg / forwardSpread / diagonalSpreadDeg = 22 / 0.55 / 10
 *
 * LASER_LEVELS (copied from poc/src/weapons/laserLevels.ts — port, do not retune):
 *
 *   L  dmg  rate  energy  speed  radius  life  fwd  diag/side  angle  spread
 *   1  1    8     0.25    30     0.12    1     1    0          22     0.55
 *   2  1.1  8.5   0.27    30     0.125   1     2    0          22     0.55
 *   3  1.3  9     0.30    30     0.13    1     3    0          22     0.55
 *   4  1.5  9.5   0.33    30     0.135   1     4    0          22     0.55
 *   5  1.8  10    0.36    30     0.14    1     3    1          22     0.55
 *   6  2.1  10.5  0.40    30     0.145   1     4    1          22     0.55
 *   7  2.5  11    0.44    30     0.15    1     3    2          22     0.55
 *   8  3    11.5  0.48    30     0.155   1     4    2          22     0.55
 *   9  3.6  12    0.52    30     0.16    1     3    3          22     0.55
 *  10  4.3  12.5  0.56    30     0.165   1     4    3          22     0.55
 *
 * Invariant: fwd + 2*diag/side = level for every row (1,2,3,4,5,6,7,8,9,10).
 * Speed 30 · lifetime 1 (range 30) on every row. Radius is a 0–1 float.
 *
 * Loadout: BALANCE.weapons.loadout = ['laser'] initially; catalog still
 * holds plasma/beam/mjolnir so D04–D06 register without editing A01 shape.
 *
 * Feel:      L1 is a single cyan needle. L5 is the first "fan" (3 forward +
 *            one each side at 22°). L10 is a wall of ten bolts. Cadence climbs
 *            8 → 12.5 so levels read as both denser and snappier. Energy cost
 *            climbs slower than bolt count so higher levels stay affordable.
 * Leveling:  this table IS the laser leveling. applyLaserLevel is the only
 *            writer. Hull fireRateMul (C03) scales cooldown on top.
 * Graphics:  cyan 0x22d3ee; thickness from D01 (2×radius). Pillar 4.
 * Pillars:   fire-laser fragment; 4 legibility (volley shape reads the level).
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * Files:
 *   poc2/src/gameobjects/weapon/weapon.test.ts
 *   poc2/src/gameobjects/weapon/laser-levels.test.ts
 * Runner: vitest
 * Mocks: EnergyPort stub, ObjectPool stub that records activate() calls,
 *        BALANCE/WEAPONS catalog, defaultModifiers()
 *
 * describe('Weapon')
 *   it('constructs from id by asking the registry, not a switch on WeaponId')     // R2, D12
 *   it('update forwards BehaviourCtx to the behaviour')                            // R1
 *   it('dispose disposes behaviour and pool')                                      // R10
 *   it('registerWeapon(id, factory) is the only hook a new weapon needs')          // R3
 *
 * describe('LaserBehaviour')
 *   it('spawns no shots when energy.canAfford is false')                           // R4, WPN-05
 *   it('spends energyPerShot * energyMul on a successful volley')                  // R4
 *   it('cooldown is 1 / (rate * rateMul); L1 rate 8 ⇒ 0.125s')                     // R5
 *   it('L1 spawns 1 forward bolt with vx=0, vz=-30, aoeRadius 0')                  // R7, R8
 *   it('L5 spawns 5 bolts — 3 forward + 1 per side')                               // R7, Acceptance
 *   it('L10 spawns 10 bolts — 4 forward + 3 per side')                             // R7, Acceptance
 *   it('muzzle uses catalog muzzleOffset z=-1.4 via ctx.muzzle')                   // catalog
 *   it('skips a bolt when pool.acquire() returns null (no new)')                   // R9
 *   it('update allocates no objects')                                              // R9
 *
 * describe('LASER_LEVELS')
 *   it('has 10 rows, levels 1..10')                                                // table
 *   it('every row satisfies forward + 2*diagPerSide === level')                    // R6
 *   it('every row has speed 30 and lifetime 1')                                    // R8
 *   it('L1 / L4 / L5 / L10 match the forward/side counts 1 / 4 / 3+1 / 4+3')       // R7
 *   it('applyLaserLevel(cfg, 5) writes damage 1.8, rate 10, energy 0.36, radius 0.14')
 *   it('applyLaserLevel(cfg, 99) is a no-op')                                      // R11
 *
 * Manual:
 *   A-manual-1. [manual] L5 fan is readable as 3-forward + 2-diagonal
 *   A-manual-2. [manual] holding fire at 0 energy produces silence, not a stall
 *
 * Coverage: R1–R11 + card Acceptance (L5=5, L10=10, new id needs no Weapon edit).
 */
