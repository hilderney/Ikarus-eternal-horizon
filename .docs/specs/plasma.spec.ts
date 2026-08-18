/**
 * #tag/arch #tag/weapons #tag/memory
 *
 * Card:         SDD-D04 PlasmaBehaviour
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: WPN-03, WPN-04, WPN-05
 * Change type:  class-ify
 * POC-1 origin: poc/src/weapons/behaviours/plasma.ts  — frozen reference
 * Test file:    poc2/src/gameobjects/weapon/behaviours/plasma.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      class PlasmaBehaviour implements WeaponBehaviour — slow pooled
 *            orbs with aoeRadius 2.2. Spawns WeaponShot (D01) from the shared
 *            pool; does not invent a second entity type. AoE is resolved once
 *            per detonation by F01, not by this class.
 * Does not own: Weapon device / registry / catalog shape (D02 — this card
 *            adds one catalog row + one registry row), EnergyManager (D03),
 *            collision/AoE application (F01), DamageResolver (F04).
 * Player-facing: fat orange orbs, slow, that bloom on impact. Wrong radius
 *            or rate makes Plasma a reskinned laser.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-A05 ObjectPool     — acquire WeaponShot
 *   SDD-D01 WeaponShot     — activate with aoeRadius > 0
 *   SDD-D02 Weapon + Laser — WeaponBehaviour, catalog row, registerWeapon
 *   SDD-D03 EnergyManager  — EnergyPort
 *   SDD-F01 CollisionManager — AoE hook; detonates once on impact or expiry
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-E07 FiringManager — switches to plasma via loadout
 *   SDD-F04 DamageResolver — consumes the single AoE pulse F01 reports
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
 * Orb visual is D01 WeaponShot (aoeRadius > 0). PlasmaBehaviour is not THREE.
 */

/** Types owned by SDD-D02. Repeated so this spec is self-contained. */
export interface WeaponBehaviour {
  update(ctx: BehaviourCtx): void
  dispose(): void
}

export interface Vec3Like {
  x: number
  y: number
  z: number
}

export interface EnergyPort {
  canAfford(cost: number): boolean
  spend(cost: number): void
}

export interface WeaponModifiers {
  damageMul: number
  rateMul: number
  energyMul: number
  aoeMul: number
}

export interface BehaviourCtx {
  dt: number
  holding: boolean
  muzzle: Vec3Like
  services: { energy: EnergyPort }
  mods: WeaponModifiers
}

export interface OrbSpec {
  readonly speed: number
  readonly radius: number
  readonly lifetime: number
  readonly aoeRadius: number
  readonly damageDecayPerUnit: number
}

export interface WeaponConfig {
  readonly id: 'plasma'
  readonly color: number
  readonly rate: number
  readonly energyPerShot: number
  readonly damage: number
  readonly poolSize: number
  readonly orb?: OrbSpec
}

export interface ShotPoolPort {
  acquire(): { activate(spawn: {
    x: number
    y: number
    z: number
    vx: number
    vz: number
    damage: number
    lifetime: number
    radius: number
    aoeRadius: number
    decayPerUnit: number
    range: number
    totalLifetime: number
  }): void } | null
}

export declare class PlasmaBehaviour implements WeaponBehaviour {
  constructor(config: WeaponConfig, pool: ShotPoolPort)

  update(ctx: BehaviourCtx): void
  dispose(): void
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   field     | type   | meaning
 *   ----------|--------|------------------------------------------------
 *   cooldown  | s      | 1 / (rate * rateMul) after a successful spawn
 *   config.orb| OrbSpec| required; constructor may throw if missing
 *
 * Non-obvious:
 *   update: cooldown -= dt; if !holding or cooldown>0 return.
 *   cost = energyPerShot * energyMul; if !canAfford return; spend.
 *   acquire(); if null return (do not still set cooldown? POC-1 sets cooldown
 *   only after a successful acquire — port that: no cooldown burn on pool miss).
 *   activate ShotSpawn:
 *     x/y/z = muzzle; vx = 0; vz = -orb.speed; damage = damage * damageMul;
 *     lifetime = totalLifetime = orb.lifetime; radius = orb.radius;
 *     aoeRadius = orb.aoeRadius * aoeMul; decayPerUnit = orb.damageDecayPerUnit;
 *     range = orb.speed * orb.lifetime.
 *   THIS CLASS DOES NOT call takeDamage and does not iterate targets.
 *   F01 applies AoE once when the orb hits or expires.
 *   dispose: no GPU of its own (shots belong to the pool).
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. PlasmaBehaviour implements WeaponBehaviour.
 *   R2. The orb is a pooled WeaponShot, not a new entity type.
 *   R3. Spawn writes aoeRadius from catalog * aoeMul (default 2.2).
 *   R4. Energy gate: no spawn when !canAfford(1.5 * energyMul).
 *   R5. Cadence: cooldown = 1 / (1.6 * rateMul) after a successful spawn.
 *   R6. vz = -speed (14); vx = 0. No homing.
 *   R7. AoE damage is NOT applied here. No takeDamage, no target loop.
 *       F01 detonates once per impact/expiry (never per-frame while flying).
 *   R8. registerWeapon('plasma', factory) + catalog row — Weapon class
 *       unchanged (D12).
 *   R9. Per-frame allocation: none. dispose() is a no-op for GPU.
 *   R10. poolSize 32 is the catalog number; the pool is owned by Weapon/E04.
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      D01 WeaponShot mesh, colour 0xfb923c, radius 0.22
 *              (thickness 0.44). Additive brick like laser, fatter and slower.
 * Inheritance: N/A (behaviour). The shot extends THREE.Mesh.
 * syncRender writes: N/A here — WeaponShot.syncRender presents the orb
 * Never writes: hostile HP
 * Scene ownership: pool (A05 / E04)
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 *   BALANCE.weapons.catalog.plasma.id            = 'plasma'
 *   BALANCE.weapons.catalog.plasma.displayName   = 'Plasma'
 *   BALANCE.weapons.catalog.plasma.color         = 0xfb923c
 *   BALANCE.weapons.catalog.plasma.rate          = 1.6
 *   BALANCE.weapons.catalog.plasma.energyPerShot = 1.5
 *   BALANCE.weapons.catalog.plasma.damage        = 2.5
 *   BALANCE.weapons.catalog.plasma.profile       = 'orb'
 *   BALANCE.weapons.catalog.plasma.poolSize      = 32
 *   BALANCE.weapons.catalog.plasma.muzzleOffset  = { x: 0, y: 0, z: -1.4 }
 *   orb.speed             = 14
 *   orb.radius            = 0.22
 *   orb.lifetime          = 2.4
 *   orb.aoeRadius         = 2.2
 *   orb.damageDecayPerUnit = 0.01
 *
 * Feel:      The "second gun" (WPN-03). Slow enough to miss if you panic-strafe;
 *            fat enough and splashy enough that a near-miss still pays. Compared
 *            to laser: 1/5 the cadence, 2.5× the damage, splash 2.2. Energy 1.5
 *            vs laser 0.25 makes dumping plasma a commitment.
 * Leveling:  no plasma level table in POC2. aoeMul / damageMul from equipment
 *            (§7) scale the orb. Hull fireRateMul slows the already-low rate.
 * Graphics:  orange 0xfb923c; reads as "orb" vs cyan "needle" in <0.3s.
 * Pillars:   4 legibility; WPN-03 second weapon; WPN-04 arsenal; WPN-05 cost.
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/gameobjects/weapon/behaviours/plasma.test.ts
 * Runner: vitest
 * Mocks: EnergyPort, ShotPoolPort recording activate() payloads, WeaponConfig
 *        plasma slice, BehaviourCtx
 *
 * describe('PlasmaBehaviour')
 *   it('implements WeaponBehaviour')                                               // R1
 *   it('activates a WeaponShot from the pool (no other entity type)')              // R2
 *   it('writes aoeRadius 2.2 * aoeMul onto the spawn')                             // R3
 *   it('writes speed 14 as vz=-14, radius 0.22, lifetime 2.4, damage 2.5')         // catalog
 *   it('spends 1.5 energy and skips the shot when canAfford is false')             // R4, WPN-05
 *   it('sets cooldown to 1/1.6 after a successful spawn')                          // R5
 *   it('does not call takeDamage or iterate ctx.services.targets')                 // R7
 *   it('does not apply AoE while the orb is in flight')                            // R7, Acceptance
 *   it('skips spawn and does not burn cooldown when acquire() is null')            // R9
 *   it('update allocates no objects')                                              // R9
 *
 * Manual:
 *   A-manual-1. [manual] an orb detonating damages every hostile inside 2.2 once
 *               (needs F01 hooked — play-check after F01)
 *   A-manual-2. [manual] orange orb is distinct from the cyan laser at a glance
 *
 * Coverage: R1–R10 + card Acceptance (orb detonates once inside aoeRadius —
 * named [manual] until F01 is present; unit case asserts this class does not
 * apply the AoE itself).
 */
