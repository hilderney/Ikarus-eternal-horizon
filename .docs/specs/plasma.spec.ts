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
 *            orbs with aoeRadius 2.2. Spawns D01 WeaponShot via E04
 *            ShotAcquirePort. Registers into the D02 seam. Does not invent a
 *            second entity type. AoE is resolved once per detonation by F01,
 *            not by this class (orbs still fly and expire without F01).
 * Does not own: Weapon device / catalog shape (D02 — this card adds one
 *            catalog row + one registerWeapon), EnergyManager (D03), shot
 *            pool (E04), collision/AoE (F01), DamageResolver (F04).
 * Player-facing: fat orange orbs, slow, that read as a different gun from
 *            the cyan needle. F / LB switches laser ↔ plasma (WPN-03).
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-D01 WeaponShot     — activate with aoeRadius > 0 and spawn.color
 *   SDD-D02 Weapon + Laser — WeaponBehaviour, catalog.plasma, registerWeapon
 *   SDD-D03 EnergyManager  — EnergyPort
 *   SDD-E04 ShotManager    — ShotAcquirePort (shared WeaponShot pool)
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-E07 FiringManager — loadout includes 'plasma'; cycleWeapon
 *   SDD-F01 CollisionManager — detonates once on impact or expiry (later)
 *   SDD-F04 DamageResolver — consumes the single AoE pulse F01 reports
 */

// ─── 9. Agent sign-off ───────────────────────────────────────────────────────
/**
 * Orchestrator : hub-v4.3 / 2026-08-18  E04 acquire; hits wait on F01; WPN-03
 * Programming  : hub-v4.3 / 2026-08-18  D01 ShotSpawn (no y); spawn.color orange
 * Game Design  : hub-v4.3 / 2026-08-18  POC-1 orb 14 / 2.4 / 0.22 / 2.2 / 1.5
 * TDD          : hub-v4.3 / 2026-08-18  cases named; test file not yet written (red next)
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
 * Orb visual is D01 WeaponShot (aoeRadius > 0). PlasmaBehaviour is not THREE.
 * Types owned by SDD-D02 are repeated so this spec is self-contained.
 */

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

export interface ShotSpawn {
  readonly x: number
  readonly z: number
  readonly vx: number
  readonly vz: number
  readonly damage: number
  readonly lifetime: number
  readonly totalLifetime: number
  readonly radius: number
  readonly aoeRadius: number
  readonly range: number
  readonly decayPerUnit: number
  readonly color?: number
}

export interface ShotAcquirePort {
  acquire(): { activate(spawn: ShotSpawn): void } | null
}

export declare class PlasmaBehaviour implements WeaponBehaviour {
  constructor(config: WeaponConfig, shots: ShotAcquirePort)

  update(ctx: BehaviourCtx): void
  dispose(): void
}

export declare function registerPlasma(): void

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   field      | type    | meaning
 *   -----------|---------|------------------------------------------------
 *   cooldown   | s       | 1 / (rate * rateMul) after a successful spawn
 *   config.orb | OrbSpec | required; constructor throws if missing
 *
 * Non-obvious:
 *   update: cooldown -= dt; if !holding or cooldown>0 return.
 *   cost = energyPerShot * energyMul; if !canAfford return; spend.
 *   acquire(); if null return without setting cooldown (POC-1: no cooldown
 *   burn on pool miss — one orb, unlike laser volley).
 *   activate ShotSpawn:
 *     x/z = muzzle; vx = 0; vz = -orb.speed;
 *     damage = config.damage * damageMul;
 *     lifetime = totalLifetime = orb.lifetime; radius = orb.radius;
 *     aoeRadius = orb.aoeRadius * aoeMul;
 *     decayPerUnit = orb.damageDecayPerUnit;
 *     range = orb.speed * orb.lifetime;
 *     color = config.color (0xfb923c).
 *   THIS CLASS DOES NOT call takeDamage and does not iterate targets.
 *   F01 applies AoE once when the orb hits or expires. Until F01, orbs
 *   fly, fade, and E04 releases them on lifetime≤0 — splash is a no-op.
 *   dispose: no GPU of its own (shots belong to E04).
 *   registerPlasma() calls registerWeapon('plasma', factory) once.
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. PlasmaBehaviour implements WeaponBehaviour.
 *   R2. The orb is a pooled WeaponShot, not a new entity type.
 *   R3. Spawn writes aoeRadius from catalog * aoeMul (default 2.2).
 *   R4. Energy gate: no spawn when !canAfford(1.5 * energyMul).
 *   R5. Cadence: cooldown = 1 / (1.6 * rateMul) after a successful spawn.
 *   R6. vz = -speed (14); vx = 0. No homing. Play plane y = 0 (D01).
 *   R7. AoE damage is NOT applied here. No takeDamage, no target loop.
 *       F01 detonates once per impact/expiry (never per-frame while flying).
 *   R8. registerWeapon('plasma', factory) + catalog row — Weapon class
 *       unchanged (D12).
 *   R9. Per-frame allocation: none. dispose() is a no-op for GPU.
 *   R10. poolSize 32 is a catalog hint. E04 sizes the shared WeaponShot pool
 *        to max(loadout poolSizes) = 128. Plasma does not construct a pool.
 *   R11. spawn.color is 0xfb923c so a bolt acquired after a laser shot
 *        recolours on activate.
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      D01 WeaponShot mesh, colour 0xfb923c, radius 0.22
 *              (thickness 0.44). Additive brick like laser, fatter and slower.
 * Inheritance: N/A (behaviour). The shot extends THREE.Mesh.
 * syncRender writes: N/A here — WeaponShot.syncRender presents the orb
 * Never writes: hostile HP
 * Scene ownership: E04 (pool fill). This class never scene.add.
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 * Numbers live on WEAPONS.plasma in catalog.ts (A01 re-exports):
 *   id / displayName / color     = 'plasma' / 'Plasma' / 0xfb923c
 *   rate / energyPerShot / damage = 1.6 / 1.5 / 2.5
 *   profile / poolSize           = 'orb' / 32
 *   muzzleOffset                 = { x: 0, y: 0, z: -1.4 }
 *   orb.speed / radius / lifetime = 14 / 0.22 / 2.4
 *   orb.aoeRadius                = 2.2
 *   orb.damageDecayPerUnit       = 0.01
 *
 * Loadout: BALANCE.weapons.loadout = ['laser', 'plasma']
 *
 * Feel:      The "second gun" (WPN-03). Slow enough to miss if you panic-strafe;
 *            fat enough that a near-miss will pay once F01 exists. Compared
 *            to laser: ~1/5 the cadence, 2.5× the damage, splash 2.2. Energy
 *            1.5 vs laser 0.25 makes dumping plasma a commitment (~2.4/s vs
 *            regen 8).
 * Leveling:  no plasma level table in POC2. aoeMul / damageMul from equipment
 *            (§7) scale the orb. Hull fireRateMul slows the already-low rate.
 * Graphics:  orange 0xfb923c; reads as "orb" vs cyan "needle" in <0.3s.
 * Pillars:   4 legibility; WPN-03 second weapon; WPN-05 cost.
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/gameobjects/weapon/behaviours/plasma.test.ts
 * Runner: vitest
 * Mocks: EnergyPort, ShotAcquirePort recording activate() payloads, WeaponConfig
 *        plasma slice, BehaviourCtx. No Scene, no F01.
 *
 * describe('PlasmaBehaviour')
 *   it('implements WeaponBehaviour')                                               // R1
 *   it('activates a WeaponShot from the acquire port (no other entity type)')      // R2
 *   it('writes aoeRadius 2.2 * aoeMul onto the spawn')                             // R3
 *   it('writes vz=-14, radius 0.22, lifetime 2.4, damage 2.5, color 0xfb923c')     // catalog, R11
 *   it('does not write a y field on ShotSpawn')                                    // R6, D01
 *   it('spends 1.5 energy and skips the shot when canAfford is false')             // R4, WPN-05
 *   it('sets cooldown to 1/1.6 after a successful spawn')                          // R5
 *   it('does not call takeDamage')                                                 // R7
 *   it('does not apply AoE while the orb is in flight')                            // R7
 *   it('skips spawn and does not burn cooldown when acquire() is null')            // R9
 *   it('update allocates no objects')                                              // R9
 *
 * describe('registerPlasma')
 *   it('registerWeapon("plasma", factory) lets Weapon construct without a switch') // R8, D12
 *
 * Manual:
 *   A-manual-1. [manual] an orb detonating damages every hostile inside 2.2 once
 *               (needs F01 — play-check after F01)
 *   A-manual-2. [manual] orange orb is distinct from the cyan laser at a glance
 *   A-manual-3. [manual] F / LB swaps laser ↔ plasma without stalling fire
 *
 * Coverage: R1–R11 + card Acceptance (unit: this class does not apply AoE;
 * splash [manual] until F01).
 */
