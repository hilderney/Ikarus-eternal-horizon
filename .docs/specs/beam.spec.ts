/**
 * #tag/arch #tag/weapons #tag/memory
 *
 * Card:         SDD-D05 BeamBehaviour + BeamVisual
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: WPN-04, WPN-05
 * Change type:  class-ify
 * POC-1 origin: poc/src/weapons/behaviours/beam.ts + poc/src/gameobjects/beam.ts
 * Test file:    poc2/src/gameobjects/weapon/behaviours/beam.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      class BeamBehaviour — hold-to-fire hitscan DPS, energy charged
 *            per second (not per shot), no projectile. class BeamVisual
 *            extends THREE.Mesh — created once, scaled/faded in syncRender.
 * Does not own: Weapon device / catalog / registry (D02 — one row + one
 *            registerWeapon), EnergyManager (D03), CollisionManager (F01
 *            hosts the hit-query hook), DamageResolver (F04).
 * Player-facing: a violet column that stays up while you hold fire and eats
 *            Energy continuously. If it flickers into a new mesh every frame
 *            the card has failed memory.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-A03 Math           — clamp / no alloc overlap test
 *   SDD-D02 Weapon + Laser — WeaponBehaviour, catalog.beam, registerWeapon
 *   SDD-D03 EnergyManager  — EnergyPort (per-second spend)
 *   SDD-F01 CollisionManager — beam hit-query hook against registered targets
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-E07 FiringManager — holding Space drives BeamBehaviour.update
 *   SDD-F04 DamageResolver — tick damage from the overlap set
 */

// ─── 9. Agent sign-off ───────────────────────────────────────────────────────
/**
 * Orchestrator : hub-v4.3 / 2026-08-18  G2 — catalog row only this pass; no factory
 * Programming  : hub-v4.1 / 2026-08-17  contract kept; F01 hit-query not this pass
 * Game Design  : hub-v4.3 / 2026-08-18  numbers live in D02 catalog.ts (POC-1 port)
 * TDD          : hub-v4.1 / 2026-08-17  cases named; do not write tests this pass
 *
 * DoD (§6.1): spec · tests red · shape · lifecycle · BALANCE · memory ·
 *             IDs · verify green · port fidelity
 * Status: spec-complete (G2 deferred — catalog only)
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Programming / Three.js
// ═════════════════════════════════════════════════════════════════════════════

// ─── 2. Contract ─────────────────────────────────────────────────────────────
/**
 * Public surface. Ports first, then the classes. Constructor dependencies explicit.
 * No service locators. No globals besides BALANCE.
 * BeamVisual extends THREE.Mesh — the visual *is* the mesh (hub §4).
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
  beamWidthMul: number
}

export interface BehaviourCtx {
  dt: number
  holding: boolean
  muzzle: Vec3Like
  services: { energy: EnergyPort; targets: readonly TargetHit[] }
  mods: WeaponModifiers
}

export interface BeamSpec {
  readonly width: number
  readonly length: number
  readonly ticksPerSec: number
  readonly dps: number
  readonly energyPerSec: number
}

export interface WeaponConfig {
  readonly id: 'beam'
  readonly color: number
  readonly beam?: BeamSpec
}

export declare class BeamVisual extends THREE.Mesh {
  constructor(color: number)

  /** Logic flag consumed by syncRender — no GPU in the setter. */
  setFiring(firing: boolean): void
  setPose(muzzle: Vec3Like, length: number, width: number): void

  syncRender(): void
  hide(): void
  dispose(): void
}

export declare class BeamBehaviour implements WeaponBehaviour {
  constructor(config: WeaponConfig, visual: BeamVisual)

  update(ctx: BehaviourCtx): void
  syncRender(): void
  dispose(): void
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   field          | type        | meaning
 *   ---------------|-------------|--------------------------------
 *   visual         | BeamVisual  | created once (Weapon/registry), never per frame
 *   firing         | boolean     | holding AND canAfford(energyPerSec*energyMul*dt)
 *   width          | world       | spec.width * beamWidthMul
 *   length         | world       | spec.length (26)
 *
 * BeamBehaviour.update:
 *   cost = energyPerSec * energyMul * dt.   // per second, not per shot
 *   if !holding OR !canAfford(cost): setFiring(false); return. No spend.
 *   spend(cost).
 *   Overlap test vs each enemy TargetHit:
 *     dz = muzzle.z - t.z; skip if dz < 0 or dz > length
 *     |t.x - muzzle.x| <= width/2 + t.radius  → hit
 *   Damage tick = dps * damageMul * dt (hub: damage × dt). ticksPerSec=60
 *   is the design sample rate; at 60 fps this is one tick per frame.
 *   Hit application: call takeDamage(tick) on overlapping enemies as the
 *   F01/F04 seam (POC-1). F04 later becomes the sole applier; the overlap
 *   math stays here.
 *
 * BeamVisual:
 *   BoxGeometry(1,1,1) + MeshBasicMaterial additive, opacity 0.75, depthWrite false.
 *   syncRender: if firing, visible=true, scale.set(width,width,length),
 *   position at (muzzle.x, muzzle.y, muzzle.z - length/2); else visible=false.
 *   Constructor does not scene.add — RunScene/Weapon holder adds the mesh.
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. BeamBehaviour implements WeaponBehaviour. No projectile is spawned.
 *   R2. Energy is charged per second: spend(energyPerSec * energyMul * dt).
 *       energyPerShot in the catalog is 0 and must not be read.
 *   R3. BeamVisual is constructed once. update() never `new`s a Mesh/Geometry.
 *   R4. syncRender is the only writer of scale, position, visible, colour.
 *   R5. Damage while overlapping is dps * dt * damageMul. Holding 1s at dps 6
 *       deals 6 to a stationary target in the column.
 *   R6. Hit test is a forward slab: 0 ≤ (muzzle.z - t.z) ≤ length and
 *       |dx| ≤ width/2 + radius. Friendly (team==='player') never hit.
 *   R7. Releasing fire or running out of energy hides the visual this frame.
 *   R8. registerWeapon('beam', factory) + catalog row; Weapon unchanged (D12).
 *   R9. dispose() disposes BeamVisual geometry + material.
 *   R10. Per-frame allocation: none.
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      THREE.Mesh · BoxGeometry(1,1,1) · MeshBasicMaterial
 *              color 0xa78bfa, transparent, opacity 0.75, AdditiveBlending,
 *              depthWrite false
 * Inheritance: BeamVisual extends THREE.Mesh
 * syncRender writes: this.scale, this.position, this.visible, material.color
 * Never writes: energy, target HP
 * Scene ownership: added/removed by Weapon / RunScene (holder), not by update()
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 *   BALANCE.weapons.catalog.beam.id           = 'beam'
 *   BALANCE.weapons.catalog.beam.displayName  = 'Beam'
 *   BALANCE.weapons.catalog.beam.color        = 0xa78bfa
 *   BALANCE.weapons.catalog.beam.rate         = 1      // unused (no shots)
 *   BALANCE.weapons.catalog.beam.energyPerShot= 0      // unused — per-second instead
 *   BALANCE.weapons.catalog.beam.damage       = 0      // unused — dps instead
 *   BALANCE.weapons.catalog.beam.profile      = 'beam'
 *   BALANCE.weapons.catalog.beam.poolSize     = 4      // unused by this behaviour
 *   BALANCE.weapons.catalog.beam.muzzleOffset = { x: 0, y: 0, z: -1.4 }
 *   beam.width        = 0.35
 *   beam.length       = 26
 *   beam.ticksPerSec  = 60
 *   beam.dps          = 6
 *   beam.energyPerSec = 3
 *
 * Feel:      A hold-down hose. Compared to laser (burst needles) and plasma
 *            (slow bombs) this is the "track the target" gun. Energy 3/s vs
 *            regen 8/s means you can hold a long time but not forever if you
 *            also panicked-boost later (SHIP-08 seam). dps 6 vs laser ~8 dps
 *            at L1 (1×8) is slightly weaker per second but has no travel time
 *            and no decay — it wins on moving targets you can paint.
 * Leveling:  no beam level table in POC2. beamWidthMul / damageMul from
 *            equipment (§7). Hull fireRateMul does not apply (no cadence).
 * Graphics:  violet 0xa78bfa additive column. Width 0.35 reads as a blade,
 *            length 26 reaches deep field. Pillar 4: colour ≠ laser cyan,
 *            ≠ plasma orange, ≠ mjolnir green.
 * Pillars:   WPN-04 arsenal; WPN-05 energy-per-second; 4 legibility.
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/gameobjects/weapon/behaviours/beam.test.ts
 * Runner: vitest
 * Mocks: EnergyPort, TargetHit stubs, THREE Mesh stubs, WeaponConfig.beam slice
 *
 * describe('BeamBehaviour')
 *   it('spawns no WeaponShot / does not acquire from a pool')                      // R1
 *   it('spends energyPerSec * dt (3 * dt) while holding and able')                 // R2, WPN-05
 *   it('does not spend and hides when canAfford is false')                         // R2, R7
 *   it('does not spend when holding is false')                                     // R7
 *   it('deals dps * dt to an overlapping enemy (6 * dt at defaults)')              // R5, Acceptance
 *   it('does not damage a target outside the length-26 slab')                      // R6
 *   it('does not damage team === player')                                          // R6
 *   it('does not construct a new Mesh in update')                                  // R3, R10
 *
 * describe('BeamVisual')
 *   it('extends THREE.Mesh and creates geometry/material once')                    // R3
 *   it('syncRender scales to (width, width, length) and places z = muzzle.z - length/2') // R4
 *   it('syncRender hides the mesh when not firing')                                // R7
 *   it('dispose frees geometry and material')                                      // R9
 *
 * Manual:
 *   A-manual-1. [manual] holding fire paints a continuous violet column
 *   A-manual-2. [manual] energy bar drains smoothly, not in shot-sized steps
 *
 * Coverage: R1–R10 + card Acceptance (continuous drain; DPS while overlapping).
 */
