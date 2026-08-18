/**
 * #tag/arch #tag/layers #tag/ship
 *
 * Card:         SDD-F04 DamageResolver
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: WPN-02, SHIP-02, SHIP-05, RUL-13
 * Change type:  new
 * POC-1 origin: none (new) — POC-1 applied damage inside collisionSystem.ts
 * Test file:    poc2/src/systems/damage-resolver.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      The single place a detected hit becomes damage. Consumes F01 HitPairs,
 *            reads effectiveDamage() from shots or contactDamage from Enemy/Meteor,
 *            calls DamageSink.applyDamage, emits shieldHit / hullHit / shieldBroke /
 *            killed / destroyed. One hit pair resolves once per frame.
 * Does not own: hit-testing (F01), hull/shield math internals (C03), VFX (F05),
 *            score/kills (G10), drop spawn (F02). Emits only — never reaches upward.
 * Player-facing: a laser kills an enemy once; contact drains shield then hull;
 *            double-kills, hull chips through a live shield, or silent deaths are bugs.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-A01 Balancer — no literals; contact/shot numbers live on the sources
 *   SDD-C03 ShipHealth — DamageSink + DamageOutcome for the player
 *   SDD-E01 Enemy — DamageSink.takeDamage/applyDamage
 *   SDD-E02 Meteor — DamageSink
 *   SDD-F01 CollisionManager — HitPair stream
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-F05 VfxManager  — listens to events
 *   SDD-G07 HUD         — bar flicker
 *   SDD-G10 RunState    — killed / destroyed (only G10 ends a run)
 *   SDD-F02 DropManager — killed enemy/meteor
 */

// ─── 9. Agent sign-off ───────────────────────────────────────────────────────
/**
 * Orchestrator : hub-v4.1 / 2026-08-17  scope, requires, DoD
 * Programming  : hub-v4.1 / 2026-08-17  DamageSink, events, once-per-pair, no VFX/score
 * Game Design  : hub-v4.1 / 2026-08-17  shield-then-hull feel, one event per hit
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
 * Lib: none — pure rule application.
 * Events over back-references (hub §8): this class emits; F05/G07/G10 listen.
 */

export enum Layer {
  Player = 0,
  PlayerShot = 1,
  Enemy = 2,
  EnemyShot = 3,
  Meteor = 4,
  Drop = 5,
}

/** C03 ship outcome, plus `killed` for Enemy/Meteor (always false on ShipHealth). */
export interface DamageOutcome {
  readonly absorbedByShield: number
  readonly dealtToHull: number
  readonly shieldBroke: boolean
  readonly hullLevelChanged: boolean
  readonly destroyed: boolean
  readonly killed: boolean
}

export interface DamageSink {
  applyDamage(amount: number, source: Layer): DamageOutcome
}

export type DamageEventKind =
  | 'shieldHit'
  | 'hullHit'
  | 'shieldBroke'
  | 'killed'
  | 'destroyed'

export interface DamageEvent {
  readonly kind: DamageEventKind
  readonly sink: DamageSink
  readonly source: Layer
  readonly amount: number
  readonly outcome: DamageOutcome
}

export interface ShotDamagePort {
  readonly layer: Layer
  active: boolean
  effectiveDamage(): number
}

export interface ContactDamagePort {
  readonly layer: Layer
  readonly contactDamage: number
  readonly active: boolean
}

export interface HitPair {
  readonly a: { readonly layer: Layer; active: boolean }
  readonly b: { readonly layer: Layer; active: boolean }
  readonly aLayer: Layer
  readonly bLayer: Layer
}

export type DamageListener = (e: DamageEvent) => void

export declare class DamageResolver {
  constructor()

  on(listener: DamageListener): () => void
  /**
   * Resolves each pair once. Skips Layer.Drop. Never spawns meshes or writes score.
   * Returns the events emitted this call (scratch buffer).
   */
  resolve(pairs: readonly HitPair[]): readonly DamageEvent[]
  /** Test helper: same-frame pair id set is empty after each resolve. */
  resetFrame(): void
}

export declare function damageAmount(pair: HitPair): number
export declare function sinkOf(pair: HitPair): DamageSink | null
export declare function sourceLayer(pair: HitPair): Layer

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   field     | type            | meaning / unit / range
 *   ----------|-----------------|-----------------------
 *   listeners | set             | F05 / G07 / G10; unsubscribe via returned fn
 *   seen      | pair-key set    | cleared at start of resolve (one pair / frame)
 *
 *   damageAmount — PlayerShot/EnemyShot → effectiveDamage(); Enemy/Meteor → contactDamage.
 *   sinkOf       — the DamageSink on the *hit* side (Player C03, Enemy, Meteor).
 *                  Drop → null (F02's channel).
 *   resolve      — skip inactive, skip Drop, skip duplicate pair key, skip amount<=0.
 *                  outcome = sink.applyDamage(amount, source).
 *                  emit: absorbedByShield>0 → shieldHit; dealtToHull>0 → hullHit;
 *                  shieldBroke → shieldBroke; killed → killed; destroyed → destroyed.
 *                  A single resolve may emit several kinds (shieldBroke+hullHit).
 *                  One *pair* still once; kinds are facets of that one applyDamage.
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. No other module in poc2/src applies combat damage (grep applyDamage / takeDamage
 *       callers = this class + tests + C03/E01/E02 implementations).
 *   R2. resolve never constructs THREE objects, never touches score/kills, never
 *       calls VfxManager. It only emit()s.
 *   R3. Each unordered (a,b) pair is applied at most once per resolve/frame.
 *   R4. Layer.Drop pairs are ignored (collection is F02).
 *   R5. PlayerShot → Enemy/Meteor uses shot.effectiveDamage() (WPN-02).
 *   R6. EnemyShot → Player uses shot.effectiveDamage() into C03 (SHIP-05).
 *   R7. Enemy/Meteor → Player uses contactDamage into C03.
 *   R8. C03 outcome absorbedByShield>0 emits shieldHit; dealtToHull>0 emits hullHit;
 *       shieldBroke emits shieldBroke; destroyed emits destroyed exactly when
 *       integrity hits 0 (SHIP-02). Enemy/Meteor hp 0 emits killed, not destroyed.
 *   R9. applyDamage is called once per pair even if multiple kinds emit.
 *   R10. Inactive endpoints are skipped.
 *   R11. Per-frame allocation: none (event scratch, pair-key scratch).
 *   R12. Listeners are invoked synchronously during resolve; a listener must not
 *        call resolve (re-entrancy ignored or thrown in dev).
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
 * No unique numbers — F04 is a pipe. Amounts come from:
 *   BALANCE.enemy.generic.contactDamage = 15
 *   BALANCE.meteor.sizes.*.contactDamage = 8 / 16 / 28
 *   BALANCE.enemy.shot.damage            = 8
 *   D02 laser damage                     = 1 (× decay)
 *   BALANCE.ship.health.shieldMax        = 50
 *   BALANCE.ship.health.integrityMax     = 100
 *
 * Feel:      One hit = one read. Shield ticks first (SHIP-05); hull ticks only
 *            through an empty Force Field. Enemies die once (WPN-02). The player
 *            should never see two explosions or a hull flash while the shield bar
 *            is still full.
 * Leveling:  N/A — multipliers live on C03 / F03 / weapons, not here.
 * Graphics:  N/A (F05 paints the events).
 * Pillars:   1 visible risk · 2 tangible degradation · 4 one-event-per-hit clarity.
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/systems/damage-resolver.test.ts
 * Runner: vitest
 * Mocks: fake DamageSink (ship + enemy + meteor), fake HitPair, fake ShotDamagePort
 *
 * describe('DamageResolver')
 *   it('is the only production caller of applyDamage in a wiring fake')               // R1
 *   it('does not call a VfxManager or ScoreManager spy')                              // R2, RUL-13
 *   it('the same pair twice in one resolve applies once')                             // R3
 *   it('ignores a Player-Drop pair')                                                  // R4
 *   it('PlayerShot vs Enemy applies shot.effectiveDamage and emits killed at 0 hp')   // R5, WPN-02
 *   it('EnemyShot vs Player applies into the ship sink')                              // R6, SHIP-05
 *   it('Enemy contact vs Player uses contactDamage')                                  // R7
 *   it('emits shieldHit when absorbedByShield > 0 and not hullHit')                   // R8, SHIP-05
 *   it('emits hullHit only when dealtToHull > 0')                                     // R8
 *   it('emits shieldBroke when outcome.shieldBroke')                                  // R8
 *   it('emits destroyed when the ship sink reports destroyed (integrity 0)')          // R8, SHIP-02
 *   it('emits killed not destroyed when an enemy sink reports killed')                // R8
 *   it('one applyDamage per pair even if shieldBroke and hullHit both emit')          // R9
 *   it('skips pairs with an inactive endpoint')                                       // R10
 *   it('resolve returns the same events array reference across frames')               // R11
 *   it('a listener that calls resolve is ignored or throws (no re-entrant apply)')    // R12
 *   it('a laser hit kills an enemy exactly once (acceptance)')                        // card, WPN-02
 *   it('enemy contact drains shield then hull (acceptance)')                          // card, SHIP-05
 *
 * Manual:
 *   A-manual-1. [manual] every visible hit produces exactly one flash (F05 play-check)
 *
 * Coverage: R1–R12 + WPN-02 + SHIP-02 + SHIP-05 + RUL-13 + card Acceptance.
 */
