/**
 * #tag/arch #tag/layers #tag/managers
 *
 * Card:         SDD-F01 Collision layers + CollisionManager
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: WPN-02, RUL-02
 * Change type:  class-ify + extract matrix
 * POC-1 origin: poc/src/systems/collisionSystem.ts  — frozen reference
 * Test file:    poc2/src/systems/collision-manager.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      The frozen 6-layer set (D13) and the who-hits-whom **data** matrix.
 *            `CollisionManager` registers colliders, hit-tests per mask, and
 *            reports `HitPair`s. Detects only — F04 applies damage. AoE (D04) and
 *            beam/cone (D05/D06) query hooks live here. Friendly fire is impossible
 *            by construction (a layer never hits itself).
 * Does not own: damage (F04), shield vs hull (C03 — D13 forbids a hull/shield
 *            layer split), despawn (E04/E05/E06), magnet pull (F02).
 * Player-facing: shots kill hostiles; contact hurts the ship; own bullets never
 *            hurt the ship. A friendly-fire death is this card failing.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-A03 Math     — distXZ, scratch
 *   SDD-D01 WeaponShot — PlayerShot colliders / radius
 *   SDD-E01 Enemy      — Layer.Enemy / TargetHit seam
 *   SDD-E02 Meteor     — Layer.Meteor seam
 *
 * Type seam: E01/E02 implement ColliderPort using Layer from this spec.
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-F04 DamageResolver — consumes HitPairs
 *   SDD-F02 DropManager    — Player→Drop pairs (collect, not damage)
 *   SDD-D04/D05/D06        — queryRadius / queryCone / querySegment
 *   SDD-E07 FiringManager  — targets list
 */

// ─── 9. Agent sign-off ───────────────────────────────────────────────────────
/**
 * Orchestrator : hub-v4.1 / 2026-08-17  scope, requires, DoD, D13 freeze
 * Programming  : hub-v4.1 / 2026-08-17  Layer enum, HIT_MATRIX data, detect-only
 * Game Design  : hub-v4.1 / 2026-08-17  who-hits-whom table; no extra layers
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
 * Lib: none — math only; Three.js vectors/radius for the test.
 * D13: six layers frozen. No hull/shield split. No wall/environment until §7.
 * Matrix is data (HIT_MATRIX). Never `if (shot is laser && target is enemy)`.
 *
 * Folder: src/systems/collision-manager.ts + layers.ts
 */

export enum Layer {
  Player = 0,
  PlayerShot = 1,
  Enemy = 2,
  EnemyShot = 3,
  Meteor = 4,
  Drop = 5,
}

/** Who-hits-whom DATA. Empty array = hits nothing. Never encode this as `if` branches. */
export const HIT_MATRIX: Readonly<Record<Layer, readonly Layer[]>> = {
  [Layer.Player]: [Layer.Enemy, Layer.Meteor, Layer.Drop],
  [Layer.PlayerShot]: [Layer.Enemy, Layer.Meteor],
  [Layer.Enemy]: [Layer.Player],
  [Layer.EnemyShot]: [Layer.Player],
  [Layer.Meteor]: [Layer.Player, Layer.PlayerShot],
  [Layer.Drop]: [],
}

export interface ColliderPort {
  readonly layer: Layer
  active: boolean
  x: number
  z: number
  radius: number
}

export interface HitPair {
  readonly a: ColliderPort
  readonly b: ColliderPort
  readonly aLayer: Layer
  readonly bLayer: Layer
  /** True when the pair includes a projectile that should be released (non-pierce). */
  readonly consumeProjectile: boolean
}

export interface CollisionQuery {
  readonly x: number
  readonly z: number
  readonly radius: number
  readonly hits: readonly Layer[]
}

export interface ConeQuery {
  readonly x: number
  readonly z: number
  readonly dirX: number
  readonly dirZ: number
  readonly angleDeg: number
  readonly length: number
  readonly hits: readonly Layer[]
}

export interface CollisionManagerOptions {
  readonly matrix?: Readonly<Record<Layer, readonly Layer[]>>
}

export declare class CollisionManager {
  constructor(options?: CollisionManagerOptions)

  readonly targets: readonly ColliderPort[]
  registerTarget(t: ColliderPort): void
  unregisterTarget(t: ColliderPort): void
  /**
   * Detects pairs for this frame. `pools` are shot origins from E04.
   * Must not call applyDamage / takeDamage.
   */
  update(dt: number, pools: readonly { forEachActive(fn: (s: ColliderPort) => void): void }[]): readonly HitPair[]
  queryRadius(q: CollisionQuery): readonly ColliderPort[]
  queryCone(q: ConeQuery): readonly ColliderPort[]
  querySegment(ax: number, az: number, bx: number, bz: number, width: number, hits: readonly Layer[]): readonly ColliderPort[]
  clear(): void
}

export declare function layersHit(from: Layer, to: Layer, matrix?: Readonly<Record<Layer, readonly Layer[]>>): boolean

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   field      | type      | meaning / unit / range
 *   -----------|-----------|-----------------------
 *   HIT_MATRIX | data      | PlayerShot→Enemy,Meteor; Player→Enemy,Meteor,Drop;
 *              |           | EnemyShot→Player; Enemy→Player; Meteor→Player,PlayerShot
 *   targets    | colliders | registered bodies (ship, enemies, meteors, drops)
 *   pairs      | HitPair[] | scratch, reused; unique unordered pair per frame
 *
 *   layersHit(from,to) — matrix[from].includes(to). Symmetric gameplay (Meteor↔PlayerShot)
 *                        is two directed entries, not a special case in code.
 *   update — circle vs circle on XZ; skip !active; skip friendly (not in matrix).
 *            Player→Drop pairs are reported (F02 collect); F04 must ignore Drop.
 *   queryRadius — D04 Plasma AoE hook (hits Enemy+Meteor).
 *   queryCone   — D06 Mjolnir hook.
 *   querySegment — D05 Beam hook.
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. Layer has exactly the six D13 members: Player, PlayerShot, Enemy,
 *       EnemyShot, Meteor, Drop. No Hull, no Shield, no Wall.
 *   R2. HIT_MATRIX is data. layersHit is a table lookup, not a type switch.
 *   R3. PlayerShot hits Enemy and Meteor only.
 *   R4. Player hits Enemy, Meteor, Drop only.
 *   R5. EnemyShot hits Player only.
 *   R6. Enemy hits Player only.
 *   R7. Meteor hits Player and PlayerShot only.
 *   R8. No layer hits itself (friendly fire impossible).
 *   R9. PlayerShot does not hit Player; EnemyShot does not hit Enemy or Meteor.
 *   R10. update never calls applyDamage / takeDamage / score / VFX.
 *   R11. Inactive colliders are ignored. Unregistered off-field bodies do not hit (RUL-02).
 *   R12. One unordered pair per (a,b) per frame — no PlayerShot↔Meteor double row.
 *   R13. queryRadius / queryCone / querySegment use the same matrix filter (`hits`).
 *   R14. Per-frame allocation: none in update (scratch HitPair buffer, rewind length).
 *   R15. registerTarget is idempotent; unregister of a missing target is a no-op.
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      N/A — no visual
 * Inheritance: N/A (pure logic)
 * syncRender writes: N/A
 * Scene ownership: N/A
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 * No combat numbers here — radii live on the colliders (D01/E01/E02/C01/F02).
 * The matrix *is* the design:
 *
 *   PlayerShot → Enemy, Meteor     // your fire kills threats and rocks
 *   Player     → Enemy, Meteor, Drop // body-check + collect
 *   EnemyShot  → Player            // incoming fire; C03 absorbs (not a layer)
 *   Enemy      → Player            // contact
 *   Meteor     → Player, PlayerShot // rock blocks shots and the hull
 *
 * D13: Force Field vs Integrity is C03's rule, not a seventh/eighth layer.
 * Feel:      The field is readable: cyan bolts only hurt rose/ice, rose bolts only
 *            hurt the ship, rocks are dumb mass. Friendly fire would break trust.
 * Leveling:  N/A — mask does not change with hull or kills.
 * Graphics:  N/A
 * Pillars:   1 visible risk (what can hurt you is the other colour) · 4 legibility.
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/systems/collision-manager.test.ts
 * Runner: vitest
 * Mocks: fake ColliderPort fixtures per layer, fake shot pool, A03 distXZ
 *
 * describe('Layer / HIT_MATRIX')
 *   it('freezes exactly six layers and has no Hull or Shield member')                 // R1, D13
 *   it('layersHit is a matrix lookup (PlayerShot vs Enemy true, vs Player false)')    // R2
 *
 * describe('CollisionManager')
 *   it('PlayerShot overlaps Enemy ⇒ one HitPair')                                     // R3, WPN-02
 *   it('PlayerShot overlaps Meteor ⇒ one HitPair')                                    // R3
 *   it('Player overlaps Enemy, Meteor, Drop')                                         // R4
 *   it('EnemyShot overlaps Player ⇒ HitPair, overlaps Enemy ⇒ none')                  // R5, R9
 *   it('Enemy overlaps Player ⇒ HitPair')                                             // R6
 *   it('Meteor overlaps Player and PlayerShot')                                       // R7
 *   it('Enemy vs Enemy and PlayerShot vs PlayerShot yield no pairs')                  // R8
 *   it('PlayerShot vs Player yields no pair (friendly fire)')                         // R9
 *   it('update does not call applyDamage or takeDamage')                              // R10
 *   it('inactive or unregistered colliders do not generate pairs')                    // R11, RUL-02
 *   it('Meteor↔PlayerShot overlapping reports one pair not two')                      // R12
 *   it('queryRadius returns Enemy+Meteor inside radius and skips Player')             // R13, D04 hook
 *   it('queryCone and querySegment honour the hits mask')                             // R13, D05/D06
 *   it('update reuses the HitPair buffer (length rewind, same array ref)')            // R14
 *   it('registerTarget twice does not duplicate; unregister missing is safe')         // R15
 *   it('shots damage only hostiles; contact damages the ship (acceptance)')           // card
 *
 * Port fidelity (class-ify):
 *   it('circle test is hypot(dx,dz) <= rA+rB like POC-1 collisionSystem')             // port
 *   it('does not apply damage (deliberate split from POC-1; F04 owns that)')          // port delta
 *
 * Manual:
 *   A-manual-1. [manual] play: own laser never chips the Force Field
 *
 * Coverage: R1–R15 + WPN-02 + RUL-02 + D13 + card Acceptance + port.
 */
