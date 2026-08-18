/**
 * #tag/arch #tag/difficulty #tag/managers
 *
 * Card:         SDD-F03 DifficultyManager
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: RUL-06, RUL-09, ENM-09
 * Change type:  new
 * POC-1 origin: none (new)
 * Test file:    poc2/src/systems/difficulty-manager.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      Kill-driven roguelite scaling. Reads the kill counter from G10.
 *            Milestones 50 MiniBoss / 100 Mega Asteroid / 500 Boss General.
 *            Post-500 **pattern** scaling, not just HP/damage. Multiplies spawn
 *            rates via spawnRateMulPerKill 0.002. Feeds E05/E06.
 * Does not own: the kill counter itself (G10), spawning MiniBoss/Mega/Boss bodies
 *            (E05/E06/§7 consume flags), enemy hp (E01), score (G10).
 * Player-facing: the run gets denser; at 50/100/500 something named happens; past
 *            500 the *shape* of pressure changes. A wall of HP-sponges with the
 *            same pattern is this card failing ENM-09.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-A01 Balancer — difficulty.miniBossAt/megaAsteroidAt/bossAt/spawnRateMulPerKill
 *   SDD-G10 RunState + ScoreManager — kill counter (read-only)
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-E05 EnemyManager  — spawnRateMul, patternId, pendingMilestone
 *   SDD-E06 MeteorManager — same
 *   SDD-G07 HUD           — optional milestone telegraph later (ENM-05 / §7)
 */

// ─── 9. Agent sign-off ───────────────────────────────────────────────────────
/**
 * Orchestrator : hub-v4.1 / 2026-08-17  scope, requires, DoD
 * Programming  : hub-v4.1 / 2026-08-17  kill read, milestones, patternId, mul formula
 * Game Design  : hub-v4.1 / 2026-08-17  50/100/500, 0.002, pattern cycle not HP
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
 * Lib: none — scheduling math only.
 */

export type MilestoneId = 'miniBoss' | 'megaAsteroid' | 'boss'

export type PatternId = 'spread' | 'lane' | 'pincer' | 'rain'

export interface KillCounterPort {
  readonly kills: number
}

export interface DifficultySnapshot {
  readonly kills: number
  readonly spawnRateMul: number
  readonly patternId: PatternId
  readonly pendingMilestone: MilestoneId | null
  readonly cycleIndex: number
}

export interface DifficultyManagerOptions {
  readonly kills: KillCounterPort
}

export declare class DifficultyManager {
  constructor(options: DifficultyManagerOptions)

  readonly spawnRateMul: number
  readonly patternId: PatternId
  readonly pendingMilestone: MilestoneId | null
  readonly cycleIndex: number
  /** Pull kills, recompute mul/pattern, arm milestone if a threshold was crossed. */
  update(dt: number): void
  /** E05/E06 call after they have consumed (or ignored) the flag. */
  consumeMilestone(): MilestoneId | null
  snapshot(): DifficultySnapshot
  /** G10 restart — zeros pending, recomputes from kills=0. */
  reset(): void
}

export declare function spawnRateMulAt(kills: number, perKill: number): number
export declare function patternIdAt(kills: number, bossAt: number, cycle: readonly PatternId[]): PatternId

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   field             | type     | meaning / unit / range
 *   ------------------|----------|-----------------------
 *   spawnRateMul      | number   | 1 + kills * spawnRateMulPerKill (min 1)
 *   patternId         | PatternId| from BALANCE.difficulty.patterns; changes post-500
 *   pendingMilestone  | id|null  | armed once when kills crosses 50/100/500 (and +500n)
 *   cycleIndex        | int      | floor(kills / bossAt) — 0 before first boss
 *
 *   spawnRateMulAt(k, p) = 1 + k * p. At 500 and p=0.002 → 2.0.
 *   patternIdAt — if kills < bossAt return patterns[0]; else
 *                 patterns[floor((kills - bossAt) / patternStep) % patterns.length].
 *                 patternStep = BALANCE.difficulty.patternStepKills (50).
 *   consumeMilestone — returns current pending and sets it null (one-shot).
 *   Milestones also fire on later cycles: 550 MiniBoss, 600 Mega, 1000 Boss, …
 *   i.e. kills % 500 === 50 / 100 / 0 (with 0 meaning Boss, and kills>=500).
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. spawnRateMul === 1 + kills * BALANCE.difficulty.spawnRateMulPerKill (0.002).
 *   R2. MiniBoss pending arms when kills reaches 50, 550, 1050, … (RUL-09).
 *   R3. MegaAsteroid pending arms at 100, 600, 1100, …
 *   R4. Boss pending arms at 500, 1000, 1500, … (not at 0).
 *   R5. A milestone is armed at most once per crossing; consumeMilestone clears it.
 *   R6. Before 500 kills patternId is the base pattern (spread). It does not cycle.
 *   R7. After 500, patternId changes on patternStepKills boundaries — not hpMul.
 *       There is no enemyHpMul / contactMul on this class (ENM-09).
 *   R8. Does not spawn entities, apply damage, or write G10.kills.
 *   R9. Per-frame allocation: none (snapshot() may reuse one object).
 *   R10. reset() restores mul=1, pattern base, pending=null.
 *   R11. update(dt) ignores dt for the formula (kills are discrete); dt is accepted
 *        so RunScene can tick it uniformly.
 *   R12. spawnRateMul is never < 1.
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
 * A01 already declared the milestones and 0.002; this card adds pattern keys:
 *   BALANCE.difficulty.miniBossAt           = 50
 *   BALANCE.difficulty.megaAsteroidAt       = 100
 *   BALANCE.difficulty.bossAt               = 500
 *   BALANCE.difficulty.spawnRateMulPerKill  = 0.002  // 500 kills → 2× spawn rate
 *   BALANCE.difficulty.patternStepKills     = 50     // post-500 pattern swap cadence
 *   BALANCE.difficulty.patterns             = ['spread', 'lane', 'pincer', 'rain']
 *
 * Feel:      Continuous squeeze (rate mul) plus named beats (50/100/500). After the
 *            first Boss the *choreography* changes every 50 kills so veterans cannot
 *            sleepwalk the same weave. HP stays on E01/E02 — if the designer later
 *            wants spongier tanks, that is an archetype card, not a silent mul here.
 * Leveling:  this *is* the leveling of the run. E05/E06 read mul+patternId.
 *            MiniBoss/Mega/Boss *bodies* are §7; G0/G1 still fire the flags so HUD
 *            / telegraph / later spawners have a seam.
 * Graphics:  N/A (sector palette is B02/§7). PatternId may later tint spawn side.
 * Pillars:   5 one-more-kill · 1 visible escalating risk · ENM-09 fairness (patterns).
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/systems/difficulty-manager.test.ts
 * Runner: vitest
 * Mocks: KillCounterPort { kills }, BALANCE.difficulty
 *
 * describe('DifficultyManager')
 *   it('spawnRateMul is 1 + kills * 0.002 (0→1, 500→2)')                              // R1, RUL-06
 *   it('arms miniBoss at 50 and 550')                                                 // R2, RUL-09
 *   it('arms megaAsteroid at 100 and 600')                                            // R3, RUL-09
 *   it('arms boss at 500 and 1000, never at 0')                                       // R4, RUL-09
 *   it('consumeMilestone returns the id once then null')                              // R5
 *   it('patternId is spread for kills 0..499')                                        // R6
 *   it('patternId changes at 500 and again at 550 (patternStep 50)')                  // R7, ENM-09
 *   it('exposes no hpMul / damageMul field')                                          // R7, ENM-09
 *   it('does not increment kills or spawn an enemy')                                  // R8
 *   it('snapshot() returns the same object reference')                                // R9
 *   it('reset() returns mul 1, base pattern, pending null')                           // R10
 *   it('update(dt) with a fixed kill count does not change mul (dt unused)')          // R11
 *   it('spawnRateMul is never below 1 for kills=0')                                   // R12
 *   it('intensity escalates and patterns change past 500 (acceptance)')               // card
 *
 * Manual:
 *   A-manual-1. [manual] a long run past 500 feels like new patterns, not thicker HP
 *
 * Coverage: R1–R12 + RUL-06 + RUL-09 + ENM-09 + card Acceptance.
 */
