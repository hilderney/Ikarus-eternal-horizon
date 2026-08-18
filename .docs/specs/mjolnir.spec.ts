/**
 * #tag/arch #tag/weapons #tag/memory
 *
 * Card:         SDD-D06 MjolnirBehaviour + ConeVisual
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: WPN-04, WPN-05
 * Change type:  class-ify
 * POC-1 origin: poc/src/weapons/behaviours/mjolnir.ts + poc/src/gameobjects/cone.ts
 * Test file:    poc2/src/gameobjects/weapon/behaviours/mjolnir.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      class MjolnirBehaviour — piercing electric cone, hold-to-fire
 *            DPS, energy per second. class ConeVisual extends THREE.Mesh —
 *            created once, scaled in syncRender. Hit-query selects every
 *            target inside angle AND distance; a hit never consumes the cone.
 * Does not own: Weapon device / catalog / registry (D02 — one row + one
 *            registerWeapon), EnergyManager (D03), CollisionManager (F01
 *            hosts the cone query hook), DamageResolver (F04).
 * Player-facing: a green wedge in front of the ship that zaps everything
 *            inside it at once. If the first enemy "eats" the cone, the card
 *            has failed the pierce rule.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-A03 Math           — tan/angle, no alloc
 *   SDD-D02 Weapon + Laser — WeaponBehaviour, catalog.cone, registerWeapon
 *   SDD-D03 EnergyManager  — EnergyPort (per-second spend)
 *   SDD-F01 CollisionManager — cone hit-query hook
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-E07 FiringManager — holding Space drives MjolnirBehaviour.update
 *   SDD-F04 DamageResolver — tick damage from the overlap set
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
 * Public surface. Ports first, then the classes. Constructor dependencies explicit.
 * No service locators. No globals besides BALANCE.
 * ConeVisual extends THREE.Mesh — the visual *is* the mesh (hub §4).
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

export interface TargetHit {
  team: 'player' | 'enemy'
  active: boolean
  x: number
  z: number
  radius: number
  takeDamage(amount: number): void
}

export interface WeaponModifiers {
  damageMul: number
  energyMul: number
  coneMul: number
}

export interface BehaviourCtx {
  dt: number
  holding: boolean
  muzzle: Vec3Like
  services: { energy: EnergyPort; targets: readonly TargetHit[] }
  mods: WeaponModifiers
}

export interface ConeSpec {
  readonly angleDeg: number
  readonly length: number
  readonly ticksPerSec: number
  readonly dps: number
  readonly energyPerSec: number
}

export interface WeaponConfig {
  readonly id: 'mjolnir'
  readonly color: number
  readonly cone?: ConeSpec
}

export declare class ConeVisual extends THREE.Mesh {
  constructor(color: number)

  setFiring(firing: boolean): void
  setPose(muzzle: Vec3Like, length: number, angleRad: number): void

  syncRender(): void
  hide(): void
  dispose(): void
}

export declare class MjolnirBehaviour implements WeaponBehaviour {
  constructor(config: WeaponConfig, visual: ConeVisual)

  update(ctx: BehaviourCtx): void
  syncRender(): void
  dispose(): void
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   field     | type       | meaning
 *   ----------|------------|--------------------------------
 *   visual    | ConeVisual | created once, never per frame
 *   firing    | boolean    | holding AND canAfford
 *   length    | world      | spec.length (18)
 *   angleRad  | rad        | spec.angleDeg (50) × DEG2RAD
 *
 * MjolnirBehaviour.update:
 *   cost = energyPerSec * energyMul * dt.
 *   if !holding OR !canAfford: setFiring(false); return.
 *   spend(cost).
 *   For EACH enemy TargetHit (pierce — do not break on first hit):
 *     dz = muzzle.z - t.z; skip if dz < 0 or dz > length
 *     maxHalf = tan(angleRad) * dz + t.radius
 *     |t.x - muzzle.x| <= maxHalf  → takeDamage(dps * damageMul * dt)
 *   ticksPerSec 30 is the design sample rate; damage × dt matches D05/hub.
 *
 * ConeVisual:
 *   ConeGeometry(1, 1, 12, 1, true), rotateX(π/2), DoubleSide, additive,
 *   opacity 0.5, depthWrite false, color 0x34d399.
 *   syncRender: radius = tan(angleRad) * length; scale.set(radius, radius, length);
 *   mesh local z = -length/2; group/this position = muzzle; visible = firing.
 *   Constructor does not scene.add.
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. MjolnirBehaviour implements WeaponBehaviour. No projectile is spawned.
 *   R2. Energy is charged per second: spend(2.2 * energyMul * dt).
 *       energyPerShot is 0 and must not be read.
 *   R3. ConeVisual is constructed once. update() never `new`s a Mesh/Geometry.
 *   R4. syncRender is the only writer of scale, position, visible, colour.
 *   R5. A hit never consumes the cone. Every overlapping hostile in the same
 *       pulse takes damage (pierce).
 *   R6. Inside-cone test uses BOTH angle (tan(angleRad)*dz) AND distance
 *       (0 ≤ dz ≤ length). Both numbers come from BALANCE.catalog.cone.
 *   R7. coneMul (if used) scales length and/or angle from equipment — default 1.
 *       POC-1 did not scale the cone; default path is unscaled spec values.
 *   R8. Friendly (team==='player') never hit. Inactive targets skipped.
 *   R9. Releasing fire or energy starve hides the visual this frame.
 *   R10. registerWeapon('mjolnir', factory) + catalog row; Weapon unchanged.
 *   R11. dispose() disposes ConeVisual geometry + material.
 *   R12. Per-frame allocation: none.
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      THREE.Mesh · ConeGeometry(1,1,12,1,true) rotated X π/2
 *              MeshBasicMaterial color 0x34d399, transparent, opacity 0.5,
 *              AdditiveBlending, depthWrite false, DoubleSide
 * Inheritance: ConeVisual extends THREE.Mesh
 * syncRender writes: this.scale, this.position, this.visible, material.color
 * Never writes: energy, target HP, "consumed" state (there is none)
 * Scene ownership: added/removed by Weapon / RunScene (holder)
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 *   BALANCE.weapons.catalog.mjolnir.id            = 'mjolnir'
 *   BALANCE.weapons.catalog.mjolnir.displayName   = 'Mjolnir'
 *   BALANCE.weapons.catalog.mjolnir.color         = 0x34d399
 *   BALANCE.weapons.catalog.mjolnir.rate          = 1      // unused
 *   BALANCE.weapons.catalog.mjolnir.energyPerShot = 0      // unused — per-second
 *   BALANCE.weapons.catalog.mjolnir.damage        = 0      // unused — dps
 *   BALANCE.weapons.catalog.mjolnir.profile       = 'cone'
 *   BALANCE.weapons.catalog.mjolnir.poolSize      = 4      // unused by this behaviour
 *   BALANCE.weapons.catalog.mjolnir.muzzleOffset  = { x: 0, y: 0, z: -1.4 }
 *   cone.angleDeg     = 50
 *   cone.length       = 18
 *   cone.ticksPerSec  = 30
 *   cone.dps          = 5
 *   cone.energyPerSec = 2.2
 *
 * Feel:      The crowd-control gun. Shorter than Beam (18 vs 26) but wide
 *            (50°), so a pack in front of the ship all cook together. Pierce
 *            is the fantasy — the front tank does not shield the backline.
 *            dps 5 is below Beam's 6 because it hits many. Energy 2.2/s sits
 *            between laser comfort and beam hunger.
 * Leveling:  no mjolnir level table in POC2. coneMul reserved for §7.
 *            Hull fireRateMul does not apply (no cadence).
 * Graphics:  mint 0x34d399 additive open cone. Distinct from violet beam
 *            column and cyan needles in <0.3s (pillar 4). Open (open-ended
 *            ConeGeometry) so the player sees through it.
 * Pillars:   WPN-04 arsenal; WPN-05 energy-per-second; 4 legibility.
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/gameobjects/weapon/behaviours/mjolnir.test.ts
 * Runner: vitest
 * Mocks: EnergyPort, multiple TargetHit stubs, THREE Mesh/ConeGeometry stubs,
 *        WeaponConfig.cone slice
 *
 * describe('MjolnirBehaviour')
 *   it('spawns no WeaponShot / does not acquire from a pool')                      // R1
 *   it('spends energyPerSec * dt (2.2 * dt) while holding and able')               // R2, WPN-05
 *   it('does not spend and hides when canAfford is false')                         // R2, R9
 *   it('damages every overlapping enemy in the same pulse (pierce)')               // R5, Acceptance
 *   it('does not stop iterating after the first hit')                              // R5
 *   it('rejects a target outside angleDeg 50 at the same distance')                // R6
 *   it('rejects a target beyond length 18 even if inside the angle')               // R6
 *   it('does not damage team === player')                                          // R8
 *   it('deals dps * dt (5 * dt) per overlapping enemy')                            // R5
 *   it('does not construct a new Mesh in update')                                  // R3, R12
 *
 * describe('ConeVisual')
 *   it('extends THREE.Mesh and creates ConeGeometry/material once')                // R3
 *   it('syncRender scales radius to tan(angleRad)*length and length along z')      // R4
 *   it('syncRender hides the mesh when not firing')                                // R9
 *   it('dispose frees geometry and material')                                      // R11
 *
 * Manual:
 *   A-manual-1. [manual] two hostiles stacked in the wedge both take the pulse
 *   A-manual-2. [manual] green cone is distinct from the violet beam at a glance
 *
 * Coverage: R1–R12 + card Acceptance (every hostile inside the cone takes
 * damage in the same pulse; hit never consumes the cone).
 */
