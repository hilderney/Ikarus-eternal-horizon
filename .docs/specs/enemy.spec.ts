/**
 * #tag/arch #tag/enemies #tag/memory
 *
 * Card:         SDD-E01 Enemy
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: ENM-01, ENM-02
 * Change type:  new
 * POC-1 origin: poc/src/gameobjects/testTarget.ts  — retire on landing (frozen; do not edit)
 * Test file:    poc2/src/gameobjects/enemy/enemy.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      The generic enemy game object — one public class `Enemy extends THREE.Mesh`.
 *            Pooled. HP, damage intake, Yuka drift-toward-player, TargetHit (team 'enemy',
 *            radius), off-field despawn flag. First Yuka card: install `yuka` here.
 * Does not own: spawn schedule / live list (E05), collision matrix (F01), applying
 *            damage to others (F04), drops (F02), archetypes Tank/Warrior/Rogue (hub §7).
 *            This card ships one generic silhouette only.
 * Player-facing: a neon hostile that enters from the deep field, closes in, dies to
 *            shots, and vanishes off-screen. Wrong tint reads as the player ship.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-A01 Balancer — BALANCE.enemy.* numbers
 *   SDD-A03 Math     — scratch vectors, distXZ, clamp
 *   SDD-A05 ObjectPool<T> — acquire/release; Enemy is never `new`ed in update
 *   SDD-F01 CollisionManager — TargetHit / ColliderPort / Layer.Enemy seam
 *
 * Type seam with F01: Enemy implements TargetHit + ColliderPort. The cycle
 * E01 ⇄ F01 is types first, then both classes.
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-E03 EnemyShot   — muzzle / team of the shooter
 *   SDD-E05 EnemyManager — pooling, Yuka EntityManager, spawn/despawn
 *   SDD-F01 CollisionManager — Layer.Enemy colliders
 *   SDD-F04 DamageResolver — DamageSink.applyDamage
 *   SDD-F02 DropManager    — killed source for drop tables
 *   SDD-F05 VfxManager     — killed burst
 */

// ─── 9. Agent sign-off ───────────────────────────────────────────────────────
/**
 * Orchestrator : hub-v4.1 / 2026-08-17  scope, requires, DoD
 * Programming  : hub-v4.1 / 2026-08-17  contract, Yuka vehicle, pool lifecycle, THREE.Mesh
 * Game Design  : hub-v4.1 / 2026-08-17  BALANCE.enemy, generic silhouette, distinct tint
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
 * `extends THREE.Mesh` — the enemy *is* its visual (hub §4).
 * Lib: Three.js (Mesh) + Yuka (Vehicle + SeekBehavior) — first Yuka install.
 */

export type TeamId = 'player' | 'enemy'

/** Spatial / identity port consumed by F01 and D02/D05/D06 hit queries. */
export interface TargetHit {
  readonly team: TeamId
  active: boolean
  x: number
  z: number
  radius: number
  takeDamage(amount: number): void
}

/** F04 is the only combat caller. Enemy forwards TargetHit.takeDamage here. */
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

export interface EnemySpawn {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly hp?: number
  readonly radius?: number
  readonly maxSpeed?: number
}

export interface SeekTargetPort {
  readonly x: number
  readonly z: number
}

export interface EnemyOptions {
  readonly geometry: unknown
  readonly material: unknown
  readonly seekTarget: SeekTargetPort
}

export declare class Enemy extends THREE.Mesh implements TargetHit, DamageSink {
  constructor(options: EnemyOptions)

  readonly team: 'enemy'
  readonly layer: 2
  active: boolean
  hp: number
  hpMax: number
  x: number
  y: number
  z: number
  radius: number
  readonly contactDamage: number
  /** Yuka Vehicle; steering SeekBehavior toward seekTarget. Not a THREE object. */
  readonly vehicle: {
    position: { x: number; y: number; z: number }
    maxSpeed: number
    update(dt: number): void
  }

  activate(spawn: EnemySpawn): void
  deactivate(): void
  /** Logic: Yuka seek, hp, off-field flag. No GPU. */
  update(dt: number): void
  /** Writes position / rotation / opacity / visible only. */
  syncRender(): void
  /** TargetHit — forwards to applyDamage(amount, Layer.EnemyShot|PlayerShot). */
  takeDamage(amount: number): void
  applyDamage(amount: number, source: number): DamageOutcome
  /** True when |x| or z is outside BALANCE.enemy.despawn. E05 releases. */
  isOffField(): boolean
  /** Pool teardown only — not called on release. Frees this slot's material. */
  dispose(): void
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   field          | type     | meaning / unit / range
 *   ---------------|----------|-----------------------
 *   team           | 'enemy'  | TargetHit; never 'player'
 *   layer          | Layer.Enemy (2) | F01 matrix key
 *   active         | boolean  | pooled-live; false ⇒ ignored by F01
 *   hp / hpMax     | number   | BALANCE.enemy.generic.hp; 0 ⇒ killed
 *   x, z           | world    | play axes (hub D01 X/Y ≡ Three XZ; Y = height)
 *   radius         | world    | hit + visual half-extent
 *   contactDamage  | number   | F04 reads this on Enemy→Player
 *   vehicle        | Yuka     | SeekBehavior; maxSpeed from BALANCE
 *
 *   activate   — pre: inactive slot. post: hp=hpMax, active, vehicle at spawn, visible.
 *   deactivate — pre: any. post: active=false, visible=false, hp=0; GPU kept.
 *   takeDamage — F04 path; never called from F01. killed when hp<=0.
 *   isOffField — despawn predicate for E05; this class does not release itself.
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. Enemy extends THREE.Mesh (the mesh *is* the enemy).
 *   R2. Implements TargetHit with team === 'enemy' and radius from BALANCE.
 *   R3. takeDamage / applyDamage reduce hp; hp<=0 ⇒ active=false, killed=true, once.
 *   R4. Drift uses a Yuka Vehicle + SeekBehavior toward SeekTargetPort (player).
 *   R5. update(dt) never allocates and never writes material/geometry; syncRender
 *       writes position (from vehicle), rotation.y, opacity only.
 *   R6. Memory: pooled. activate/deactivate recycle the slot. dispose() only on
 *       pool teardown. Shared BoxGeometry created once by E05; per-slot material.
 *   R7. Per-frame allocation: none (Yuka vectors are instance fields / scratch).
 *   R8. isOffField() is true outside BALANCE.enemy.despawn; Enemy does not release.
 *   R9. contactDamage is read-only from BALANCE; Enemy never damages the ship itself.
 *   R10. Archetype is generic only — no Tank/Warrior/Rogue branch in this class (§7).
 *   R11. Retires poc/src/gameobjects/testTarget.ts as the hit dummy; TargetHit lives here.
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      THREE.Mesh · BoxGeometry (shared) · MeshBasicMaterial wireframe
 *              · colour BALANCE.enemy.generic.color · no additive (distinct from shots)
 * Inheritance: extends THREE.Mesh
 * syncRender writes: position (x,y,z), rotation.y (facing seek), material.opacity (hp/hpMax), visible
 * Never writes: hp, vehicle.position, active, BALANCE
 * Scene ownership: added/removed by EnemyManager / ObjectPool (D14 — managers own populations)
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 * New section (declare on SDD-A01). Starting values — tune at first playtest, not before.
 *
 *   BALANCE.enemy.generic.hp             = 8      // L1 laser dmg 1 ⇒ ~8 bolts / ~1s at rate 8
 *   BALANCE.enemy.generic.radius         = 0.7    // larger than ship half-width; readable box
 *   BALANCE.enemy.generic.speed          = 4      // < ship maxSpeed 12 — kiteable
 *   BALANCE.enemy.generic.contactDamage  = 15     // 50 shield ⇒ ~4 contacts to break Force Field
 *   BALANCE.enemy.generic.color          = 0xf43f5e // neon rose — MUST ≠ ship cyan 0x22d3ee
 *   BALANCE.enemy.generic.y              = 0      // play-plane height
 *   BALANCE.enemy.spawn.zFar             = -20    // deep field (ahead)
 *   BALANCE.enemy.spawn.halfX            = 7      // slightly wider than follow.halfX 6
 *   BALANCE.enemy.despawn.zNear          = 12     // past the ship / camera
 *   BALANCE.enemy.despawn.halfX          = 14     // off the sides
 *   BALANCE.enemy.poolSize               = 32     // E05; G0 one-type population
 *
 * Feel:      Closes in, not a turret. Pressure is presence + contact, not bullet hell
 *            (EnemyShot is E03, ranged patterns §7). TTK is one committed volley at L1.
 * Leveling:  E05 scales spawn rate via F03, not this class's hp. Archetypes Tank
 *            (amber, slow, high hp) / Warrior (red, guns) / Rogue (green-magenta wedge)
 *            are §7 — this generic uses the Warrior-like balanced box so ENM-06 can
 *            swap skin later without changing the silhouette contract.
 * Graphics:  Neon wireframe rose on a dense box. Silhouette readable <0.3s vs cyan
 *            ship. Opacity tracks hp (readable damage, pillar 2). No fill (G0 wireframe).
 * Pillars:   4 legibility · 5 one-more-kill pressure · 1 visible risk (it is coming).
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * Protocol: write enemy.test.ts FIRST. `npm run test` must FAIL for the named cases.
 * File: poc2/src/gameobjects/enemy/enemy.test.ts
 * Runner: vitest (`npm run test` in poc2/)
 * Mocks: BALANCE.enemy slice, THREE.Mesh/BoxGeometry/MeshBasicMaterial stub,
 *        Yuka Vehicle/SeekBehavior stub, SeekTargetPort {x:0,z:0}
 *
 * describe('Enemy')
 *   it('extends THREE.Mesh')                                                          // R1
 *   it('implements TargetHit with team enemy and BALANCE radius')                     // R2, ENM-01
 *   it('applyDamage reduces hp and sets killed+inactive once at hp 0')                // R3
 *   it('takeDamage forwards to applyDamage')                                          // R3, R11
 *   it('update steers a Yuka Vehicle toward the seek target')                         // R4
 *   it('syncRender writes mesh.position from vehicle and does not mutate hp')         // R5
 *   it('activate then deactivate recycles the slot without dispose')                  // R6, ENM-02
 *   it('dispose frees this slot material; release path does not')                     // R6
 *   it('update allocates no objects (Object.keys / no `new` in hot path spy)')        // R7
 *   it('isOffField is true past despawn.zNear / despawn.halfX')                       // R8, ENM-01
 *   it('exposes contactDamage from BALANCE and never calls into ShipHealth')          // R9
 *   it('has no archetype field or Tank/Warrior/Rogue branch')                         // R10
 *   it('spawns, closes in, dies from shots, despawns off-field (acceptance)')         // ENM-01
 *
 * Manual:
 *   A-manual-1. [manual] neon rose reads as hostile vs ship cyan in <0.3s
 *   A-manual-2. [manual] poc/src/gameobjects/testTarget.ts is not imported by poc2
 *
 * Coverage: R1–R11 + ENM-01 + ENM-02 + card Acceptance.
 */
