/**
 * #tag/arch #tag/asteroids #tag/memory
 *
 * Card:         SDD-E02 Meteor
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: ENM-04, RES-01
 * Change type:  new
 * POC-1 origin: none (new)
 * Test file:    poc2/src/gameobjects/meteor/meteor.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      The asteroid game object — `Meteor extends THREE.Mesh`. Pooled. Inert
 *            drift on the play axes, hp and contact damage by size S/M/L, destructible
 *            by fire. Signals fragmentation; F02 spawns the fragments/loot.
 * Does not own: spawn lanes / schedule (E06), drop tables (F02), Mega Asteroid (hub §7
 *            ENM-07), collision matrix (F01), applying damage to the ship (F04).
 * Player-facing: a drifting rock that occupies a lane, hurts on contact, and breaks
 *            into loot when shot down. Wrong size/hp makes contact a one-shot or a joke.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-A01 Balancer — BALANCE.meteor.*
 *   SDD-A03 Math     — scratch vectors, distXZ
 *   SDD-A05 ObjectPool<T> — pooled slots
 *   SDD-F01 CollisionManager — ColliderPort / Layer.Meteor seam
 *
 * Type seam with F01 (same cycle as E01). Fragments/loot via F02 — Meteor emits
 * `wantsFragments`, it never constructs Drop instances.
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-E06 MeteorManager — pooling, lanes, fragmentation trigger
 *   SDD-F01 CollisionManager — Layer.Meteor
 *   SDD-F04 DamageResolver — DamageSink + contactDamage
 *   SDD-F02 DropManager    — RES-01 Metal Scrap on destroy
 */

// ─── 9. Agent sign-off ───────────────────────────────────────────────────────
/**
 * Orchestrator : hub-v4.1 / 2026-08-17  scope, requires, DoD
 * Programming  : hub-v4.1 / 2026-08-17  contract, size table, inert drift, pool lifecycle
 * Game Design  : hub-v4.1 / 2026-08-17  S/M/L hp+contact, metallic/ice outline
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
 * Lib: Three.js (SphereGeometry mesh, rotation visuals). Drift is first-party — no Yuka.
 */

export type MeteorSize = 'S' | 'M' | 'L'

export interface MeteorSpawn {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly vx: number
  readonly vz: number
  readonly size: MeteorSize
}

export interface MeteorOptions {
  readonly geometryBySize: Readonly<Record<MeteorSize, unknown>>
  readonly material: unknown
}

export declare class Meteor extends THREE.Mesh implements DamageSink {
  constructor(options: MeteorOptions)

  readonly layer: 4
  readonly size: MeteorSize
  active: boolean
  hp: number
  hpMax: number
  x: number
  y: number
  z: number
  vx: number
  vz: number
  radius: number
  readonly contactDamage: number
  /** Set true on killed; E06/F02 consume and clear. Meteor never spawns drops. */
  wantsFragments: boolean
  spin: number

  activate(spawn: MeteorSpawn): void
  deactivate(): void
  update(dt: number): void
  syncRender(): void
  applyDamage(amount: number, source: number): DamageOutcome
  isOffField(): boolean
  dispose(): void
}

export interface DamageSink {
  applyDamage(amount: number, source: number): DamageOutcome
}

export interface DamageOutcome {
  readonly absorbedByShield: number
  readonly dealtToHull: number
  readonly shieldBroke: boolean
  readonly hullLevelChanged: boolean
  readonly destroyed: boolean
  readonly killed: boolean
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   field           | type        | meaning / unit / range
 *   ----------------|-------------|--------------------------------
 *   size            | S|M|L       | locked at activate from BALANCE.meteor.sizes
 *   hp / hpMax      | number      | size table
 *   vx, vz          | world/sec   | inert; never seeks the player
 *   radius          | world       | size table; hit = visual
 *   contactDamage   | number      | F04 on Meteor→Player
 *   wantsFragments  | boolean     | edge toward F02; not a spawn
 *   spin            | rad         | visual only; integrated in update
 *   layer           | Layer.Meteor (4)
 *
 *   activate — copies size stats from BALANCE; hp=hpMax; wantsFragments=false.
 *   applyDamage — hp-=amount; at 0: killed, active=false, wantsFragments=true.
 *   update — x+=vx*dt, z+=vz*dt, spin+=BALANCE.meteor.spinRadPerSec*dt. No AI.
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. Meteor extends THREE.Mesh.
 *   R2. Size S/M/L is the only combat fork; hp, radius, contactDamage come from
 *       BALANCE.meteor.sizes[size] at activate — never literals.
 *   R3. Motion is inert drift on the play axes (Three XZ). No seek, no Yuka.
 *   R4. applyDamage kills once at hp<=0 and sets wantsFragments; never constructs Drop.
 *   R5. Contact damage scales with size (S < M < L) and is read-only after activate.
 *   R6. Memory: pooled. deactivate keeps GPU. dispose() on pool teardown only.
 *   R7. Per-frame allocation: none.
 *   R8. isOffField uses BALANCE.meteor.despawn; Meteor does not release itself.
 *   R9. syncRender writes position, rotation (spin on X and Y), opacity from hp/hpMax.
 *   R10. Mega Asteroid is out of this class (ENM-07 / §7).
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      THREE.Mesh · SphereGeometry per size (shared 3 geos) · MeshBasicMaterial
 *              wireframe metallic/ice + outline glow colour from BALANCE.meteor.outlineColor
 * Inheritance: extends THREE.Mesh
 * syncRender writes: position, rotation.x/y (spin), material.opacity, visible
 * Never writes: hp, vx/vz, wantsFragments
 * Scene ownership: MeteorManager / ObjectPool
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 * New section (declare on SDD-A01). Ice/Rocky/Metallic density is G2; G1 is size only.
 *
 *   BALANCE.meteor.sizes.S = { hp: 4,  radius: 0.5, contactDamage: 8,  scrapMin: 1, scrapMax: 1 }
 *   BALANCE.meteor.sizes.M = { hp: 10, radius: 0.9, contactDamage: 16, scrapMin: 1, scrapMax: 2 }
 *   BALANCE.meteor.sizes.L = { hp: 22, radius: 1.4, contactDamage: 28, scrapMin: 2, scrapMax: 3 }
 *   BALANCE.meteor.driftSpeed     = { min: 1.5, max: 3.5 }  // slower than enemy speed 4
 *   BALANCE.meteor.spinRadPerSec  = 0.6                     // readable tumble, not a blur
 *   BALANCE.meteor.color          = 0x94a3b8                // metallic ice
 *   BALANCE.meteor.outlineColor   = 0x7dd3fc                // ice outline glow
 *   BALANCE.meteor.y              = 0
 *   BALANCE.meteor.despawn        = { zNear: 12, zFar: -28, halfX: 14 }
 *   BALANCE.meteor.poolSize       = 24
 *
 * Feel:      Obstacle, not hunter. Occupies a lane; shoot or dodge. L contact (28) is
 *            a real Force Field chunk (50 max) without one-shotting a full shield.
 *            S is clutter; L is a reposition demand.
 * Leveling:  E06 spawn mix and F03 rate; Mega at 100 kills is F03/E06/§7, not hp here.
 * Graphics:  Metallic/ice wireframe sphere, cyan-ice outline glow — never ship cyan
 *            fill, never enemy rose. Size is the silhouette (<0.3s: pebble / boulder / hulk).
 * Pillars:   4 legibility · 1 visible risk · 5 one-more-kill (loot on break, RES-01).
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/gameobjects/meteor/meteor.test.ts
 * Runner: vitest
 * Mocks: BALANCE.meteor slice, THREE.Mesh/SphereGeometry stubs
 *
 * describe('Meteor')
 *   it('extends THREE.Mesh')                                                          // R1
 *   it('activate S/M/L copies hp, radius, contactDamage from BALANCE.sizes')           // R2, ENM-04
 *   it('update drifts by vx/vz*dt and does not seek a target')                         // R3
 *   it('applyDamage at hp 0 sets killed, inactive, wantsFragments once')               // R4, RES-01
 *   it('does not construct a Drop or call DropManager')                                // R4
 *   it('contactDamage S < M < L')                                                      // R5
 *   it('deactivate recycles without dispose; dispose frees slot material')             // R6
 *   it('update allocates nothing')                                                     // R7
 *   it('isOffField past meteor.despawn bounds')                                        // R8
 *   it('syncRender writes position and spin rotation only')                            // R9
 *   it('has no mega or density (Ice/Rocky/Metallic) branch')                           // R10
 *   it('drifts in a lane, dies to shots, contactDamage readable (acceptance)')         // ENM-04
 *
 * Manual:
 *   A-manual-1. [manual] metallic/ice outline reads vs enemy rose and ship cyan <0.3s
 *
 * Coverage: R1–R10 + ENM-04 + RES-01 + card Acceptance.
 */
