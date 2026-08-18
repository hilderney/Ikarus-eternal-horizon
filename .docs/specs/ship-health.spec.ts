/**
 * #tag/arch #tag/ship
 *
 * Card:         SDD-C03 ShipHealth (Force Field · Integrity · degradation)
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: SHIP-02, SHIP-05, SHIP-12, RUL-10
 * Change type:  new
 * POC-1 origin: none (new)
 * Test file:    poc2/src/gameobjects/ship/ship-health.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      The playable-pillar risk model. Integrity + Force Field pools,
 *            applyDamage routing (shield first), delayed shield regen, hullLevel
 *            0|1|2|3 from integrity thresholds, and the modifier triple
 *            { speedMul, accelMul, fireRateMul }. Emits DamageOutcome; never
 *            ends the run.
 * Does not own: the Ship Group (C01), the C01 byte sheet G08 displays
 *            (integrity/shield *current* migrate onto Ship.stats later),
 *            motion integration (C02 — it only reads multipliers), firing
 *            cadence (E07 — reads fireRateMul), damage detection (F01),
 *            applying hits from collisions (F04 calls us), run-end (G10
 *            listens to destroyed), HUD bars (G07).
 * Player-facing: shield drains before hull; after the shield breaks the craft
 *            gets sluggish and the gun slows. Integrity 0 is death — reported
 *            here, acted on by G10.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-A01 Balancer — BALANCE.ship.health (maxes, regen, thresholds, muls)
 *   SDD-A03 Math     — clamp
 *   SDD-C01 Ship     — composition host; health is not a THREE object
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-C02 Controller     — reads modifiers.speedMul / accelMul
 *   SDD-E07 FiringManager  — reads modifiers.fireRateMul
 *   SDD-F04 DamageResolver — the only caller of applyDamage
 *   SDD-F05 VfxManager     — reacts to shieldBroke / hullLevelChanged
 *   SDD-G07 HUD            — integrity / shield bars
 *   SDD-G10 RunState       — destroyed ends the run
 */

// ─── 9. Agent sign-off ───────────────────────────────────────────────────────
/**
 * Orchestrator : hub-v4.1 / 2026-08-17  scope, requires, DoD
 * Programming  : hub-v4.1 / 2026-08-17  contract, memory, THREE / view
 * Game Design  : hub-v4.1 / 2026-08-17  BALANCE, feel, leveling, graphics
 * TDD          : hub-v4.3 / 2026-08-18  ship-health.test.ts green
 *
 * DoD (§6.1): spec · tests red · shape · lifecycle · BALANCE · memory ·
 *             IDs · verify green · port fidelity
 * Status: done
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Programming / Three.js
// ═════════════════════════════════════════════════════════════════════════════

// ─── 2. Contract ─────────────────────────────────────────────────────────────
/**
 * Public surface. Ports first, then the class. Constructor dependencies explicit.
 * No service locators. No globals besides BALANCE.
 * Pure arithmetic — does not extend THREE. D13: no hull/shield collision layer.
 */

/** Frozen layer set (F01 / D13). Copied so this spec is self-contained. */
export type Layer = 'Player' | 'PlayerShot' | 'Enemy' | 'EnemyShot' | 'Meteor' | 'Drop'

export type HullLevel = 0 | 1 | 2 | 3

export interface DamageOutcome {
  readonly absorbedByShield: number
  readonly dealtToHull: number
  readonly shieldBroke: boolean
  readonly hullLevelChanged: boolean
  readonly destroyed: boolean
}

export interface HullModifiers {
  readonly speedMul: number
  readonly accelMul: number
  readonly fireRateMul: number
}

export interface DamageSink {
  applyDamage(amount: number, source: Layer): DamageOutcome
}

export interface ShipHealthConfig {
  readonly integrityMax: number
  readonly shieldMax: number
  readonly shieldRegenPerSec: number
  readonly regenDelayMs: number
  readonly hullThresholds: readonly [number, number, number]
  readonly speedMul: readonly [number, number, number, number]
  readonly accelMul: readonly [number, number, number, number]
  readonly fireRateMul: readonly [number, number, number, number]
}

export interface ShipHealthOptions {
  readonly config: ShipHealthConfig
}

export declare class ShipHealth implements DamageSink {
  constructor(options: ShipHealthOptions)

  readonly integrity: number
  readonly integrityMax: number
  readonly shield: number
  readonly shieldMax: number
  readonly hullLevel: HullLevel
  readonly modifiers: HullModifiers

  /** Routes to Force Field first; remainder to Integrity. Never writes fields from outside. */
  applyDamage(amount: number, source: Layer): DamageOutcome

  /** Delayed shield regen. Integrity is never increased here. */
  update(dt: number): void

  dispose(): void
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   field              | type          | meaning / unit / range
 *   -------------------|---------------|--------------------------------
 *   integrity          | 0..integrityMax | hull HP; 0 ⇒ destroyed
 *   shield             | 0..shieldMax    | Force Field HP; absorbs first
 *   hullLevel          | 0|1|2|3        | derived, never stored independently
 *   modifiers          | HullModifiers   | indexed by hullLevel from BALANCE
 *   _regenClockMs      | number          | ms since last damage; private
 *   _destroyedEmitted  | boolean         | destroyed is true at most once
 *
 * Non-obvious:
 *   applyDamage(amount < 0) is a no-op (treat as 0).
 *   Shield absorb: absorbed = min(amount, shield); shield -= absorbed.
 *   Remainder goes to integrity. shieldBroke true iff shield was >0 and is now 0.
 *   hullLevel from integrity/integrityMax vs thresholds [0.75, 0.50, 0.25]:
 *     > 0.75 → 0;  > 0.50 → 1;  > 0.25 → 2;  else 3.
 *   hullLevelChanged true iff derived level differs from pre-hit level.
 *   destroyed true iff integrity reaches 0 on this call AND it was >0 before.
 *   Subsequent applyDamage after death: integrity stays 0, destroyed false.
 *   update: if shield < max and clock >= regenDelayMs, shield += regenPerSec*dt
 *           clamped to shieldMax. Any applyDamage resets the clock to 0.
 *   source is recorded for F04/F05; it does not change routing (D13).
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. Damage enters only through applyDamage. Callers never write integrity
 *       or shield fields.
 *   R2. Force Field absorbs first. Integrity is touched only after shield is 0,
 *       including remainder in the same call that broke the shield (SHIP-05).
 *   R3. Integrity never self-regens. update() must not increase integrity.
 *   R4. Shield regen starts only after regenDelayMs with no further hits, at
 *       shieldRegenPerSec. A new hit resets the delay.
 *   R5. hullLevel is 0|1|2|3 from thresholds 0.75 / 0.50 / 0.25 of integrityMax.
 *   R6. modifiers.speedMul/accelMul/fireRateMul equal the BALANCE row for the
 *       current hullLevel. C02/E07 read these; they do not recompute.
 *   R7. DamageOutcome always returns the five flags. destroyed is reported,
 *       never acted on (no scene teardown, no loop stop). G10 ends the run.
 *   R8. destroyed is emitted at most once per instance (integrity 0 crossing).
 *   R9. Memory: no GPU. Per-frame allocation: none (reuse one outcome object
 *       or return a plain object that tests may copy — hot path: reuse).
 *   R10. All numbers come from BALANCE.ship.health (RUL-12). Q08 owns the curve.
 *        C01 BALANCE.ship.stats is the G08 sheet; this class does not read it
 *        until the combat-wire pass. Do not retune these numbers now.
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      N/A — no visual (G07 draws the bars)
 * Inheritance: N/A (pure logic)
 * syncRender writes: N/A
 * Scene ownership: N/A — composed on Ship, not a child mesh
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 * Q08 placeholders — tune at first playtest, do not invent a second table.
 * Combat still uses this section. C01 `BALANCE.ship.stats.integrity/shield`
 * (0–255, spawn 100/100) is what G08 shows; wiring C03 onto those pools is
 * a listed next step, not this pass.
 *   BALANCE.ship.health.integrityMax       = 100
 *   BALANCE.ship.health.shieldMax          = 50
 *   BALANCE.ship.health.shieldRegenPerSec  = 2      // slow; losing the shield matters
 *   BALANCE.ship.health.regenDelayMs       = 1500   // a beat of vulnerability
 *   BALANCE.ship.health.hullThresholds     = [0.75, 0.50, 0.25]
 *   BALANCE.ship.health.speedMul           = [1, 0.85, 0.7, 0.5]
 *   BALANCE.ship.health.accelMul           = [1, 0.85, 0.7, 0.5]
 *   BALANCE.ship.health.fireRateMul        = [1, 0.9, 0.75, 0.55]
 *
 * Hull bands (integrity / 100):
 *   Level 0  100–75   full agility, full cadence
 *   Level 1   75–50   -15% speed/accel, -10% fire
 *   Level 2   50–25   -30% speed/accel, -25% fire
 *   Level 3   25–0    -50% speed/accel, -45% fire  — limping, still shooting
 *
 * Feel:      Losing the Force Field is a phase change, not a death sentence
 *            (pillar 2). The ship should feel heavier and the laser slower
 *            at each band, never binary "you can't play". Shield regen is
 *            slow enough that hiding for 1.5s is a decision, not a reflex.
 * Leveling:  this *is* the hull-level system (SHIP-12, RUL-10). Weapon levels
 *            are D02 and are independent.
 * Graphics:  N/A here. G07 must show shield draining first, then hull, with
 *            a flicker on the bar that was hit (F04 event).
 * Pillars:   1 visible risk; 2 tangible degradation; playable pillar fragment
 *            "shield→integrity risk".
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/gameobjects/ship/ship-health.test.ts
 * Runner: vitest
 * Mocks: BALANCE.ship.health slice (no THREE)
 *
 * describe('ShipHealth')
 *   it('starts at integrity 100 and shield 50')                                    // A01 values
 *   it('routes damage into the Force Field before Integrity')                      // R2, SHIP-05
 *   it('spills remainder onto Integrity in the same call that breaks the shield')  // R2
 *   it('sets shieldBroke true only on the call that drives shield 50→0')           // R2
 *   it('never increases integrity in update()')                                    // R3
 *   it('does not regen shield during the 1500ms delay after a hit')                // R4
 *   it('regens shield at 2/s after the delay, clamped to shieldMax')               // R4
 *   it('resets the regen delay when a new hit lands during regen')                 // R4
 *   it('reports hullLevel 0 above 75, 1 above 50, 2 above 25, 3 at or below 25')   // R5, RUL-10
 *   it('exposes speedMul [1, 0.85, 0.7, 0.5] indexed by hullLevel')                // R6, SHIP-12
 *   it('exposes matching accelMul and fireRateMul [1, 0.9, 0.75, 0.55]')           // R6
 *   it('sets hullLevelChanged when a hit crosses a threshold')                     // R7
 *   it('emits destroyed exactly once when integrity reaches 0')                    // R8, SHIP-02
 *   it('does not call any run-end or scene API when destroyed')                    // R7
 *   it('rejects field writes — only applyDamage mutates pools')                    // R1
 *   it('update/applyDamage allocate no objects on the hot path')                   // R9
 *
 * Manual:
 *   A-manual-1. [manual] shield bar drains first; hull only after it hits zero
 *   A-manual-2. [manual] crossing a hull band is perceptible in motion and cadence
 *
 * Coverage: R1–R10 + card Acceptance (shield then hull; threshold degrades
 * motion and fire; integrity 0 emits destroyed once).
 */
