/**
 * #tag/arch #tag/hud #tag/memory
 *
 * Card:         SDD-G10 RunState + ScoreManager
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: RUL-03, RUL-07, RUL-11, SHIP-02
 * Change type:  new
 * POC-1 origin: none (new) — POC-1 had no score, death or restart
 * Test file:    poc2/src/systems/run-state.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      The lifecycle of one run — `running | paused | over` — the kill
 *            counter, elapsed time, and the `RunSummary` handed to ResultScene.
 *            ScoreManager accumulates score per killed source and applies
 *            multipliers (no-damage streak, fast wave clear). Listens to F04
 *            (`killed`, `destroyed`) and C03 (`destroyed` ends the run). Feeds
 *            F03 (difficulty), G07 (border HUD) and G04 (result). Local best
 *            persisted per mode (Q10: localStorage inside this module).
 *            **The only module allowed to end a run.** `restart()` reconstructs
 *            the Run scene through G01 rather than mutating live objects.
 * Does not own: applying damage (F04 / C03), scene construction (G03), HUD
 *            presentation (G07), difficulty spawn rates (F03 reads kills here).
 * Player-facing: Integrity 0 that does not show Result; a restart that keeps
 *            old enemies; a best score that dies on reload.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-A01 Balancer — BALANCE.score (+ persistence key)
 *   SDD-A04 GameLoop — pause gate used when phase === 'paused'
 *   SDD-C03 ShipHealth — `destroyed` (Integrity 0)
 *   SDD-F04 DamageResolver — `killed` / `destroyed` events
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-F03 DifficultyManager — reads kills
 *   SDD-G07 HUD — border score / kills / high
 *   SDD-G04 ResultScene — RunSummary
 *   SDD-G05 RankingsScene — LocalBoardsPort
 *   SDD-G03 RunScene — watches phase === 'over' then router.next(result)
 *   SDD-G11 PauseScene — pause / resume / restart / quit
 *   SDD-G01 SceneController — restart = next(fresh RunScene)
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

import type { ScenePort, SceneRouter } from './scene-controller.spec'
import type {
  LocalBoardEntry,
  LocalBoardsPort,
  RankingMode,
  RankingPeriod,
} from './rankings-scene.spec'

export type RunPhase = 'running' | 'paused' | 'over'
export type RunEndCause = 'destroyed' | 'quit'

export interface RunSummary {
  readonly score: number
  readonly kills: number
  readonly elapsedMs: number
  readonly cause: RunEndCause
  readonly best: number
  readonly isNewBest: boolean
}

export type ScoreSource = 'enemy' | 'meteor' | 'miniBoss' | 'megaAsteroid' | 'boss'

export interface ScoreEvent {
  readonly source: ScoreSource
}

export interface RunStateOptions {
  readonly score: ScoreManagerPort
  readonly storage?: BestScoreStorage
  readonly mode?: RankingMode
  readonly now?: () => number
}

export interface BestScoreStorage {
  load(mode: RankingMode): number
  save(mode: RankingMode, best: number): void
}

export interface RunStatePort {
  readonly phase: RunPhase
  readonly kills: number
  readonly elapsedMs: number
  readonly summary: RunSummary | null
  pause(): void
  resume(): void
  /** The only legal way a run ends. Idempotent after 'over'. */
  end(cause: RunEndCause): void
  /**
   * Reconstructs Run via G01. Pre: caller supplies a factory that returns a
   * *new* RunScene. This method does not mutate live world objects.
   */
  restart(router: SceneRouter, createRun: () => ScenePort): void
  onKilled(event: ScoreEvent): void
  onShipDestroyed(): void
  update(dt: number): void
}

export interface ScoreManagerPort {
  readonly score: number
  readonly kills: number
  readonly noDamageStreak: number
  onKilled(event: ScoreEvent): void
  onPlayerHit(): void
  reset(): void
}

export declare class ScoreManager implements ScoreManagerPort {
  constructor()
  readonly score: number
  readonly kills: number
  readonly noDamageStreak: number
  onKilled(event: ScoreEvent): void
  onPlayerHit(): void
  reset(): void
}

export declare class LocalStorageBestScore implements BestScoreStorage {
  constructor(prefix?: string)
  load(mode: RankingMode): number
  save(mode: RankingMode, best: number): void
}

export declare class RunState implements RunStatePort, LocalBoardsPort {
  constructor(options: RunStateOptions)
  readonly phase: RunPhase
  readonly kills: number
  readonly elapsedMs: number
  readonly summary: RunSummary | null
  pause(): void
  resume(): void
  end(cause: RunEndCause): void
  restart(router: SceneRouter, createRun: () => ScenePort): void
  onKilled(event: ScoreEvent): void
  onShipDestroyed(): void
  update(dt: number): void
  best(mode: RankingMode, period: RankingPeriod): LocalBoardEntry | null
  list(mode: RankingMode, period: RankingPeriod): readonly LocalBoardEntry[]
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   phase           | RunPhase     | running on construct
 *   kills           | number       | F04 killed events
 *   elapsedMs       | number       | accumulates dt*1000 only while running
 *   summary         | RunSummary   | null until end(); frozen thereafter
 *   score           | ScoreManager | BALANCE.score tables
 *   best            | number       | loaded from storage at construct
 *
 *   onKilled        — score.onKilled; kills += 1; ignored if phase !== 'running'
 *   onShipDestroyed — end('destroyed')  (C03 / F04)
 *   end(cause)      — phase='over'; build RunSummary; persist best if greater
 *   pause/resume    — only from 'running'↔'paused'; no-op if 'over'
 *   restart         — router.next(createRun()); does not call end()
 *   update(dt)      — elapsed only when phase==='running'
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. The only module that sets phase to `'over'` or builds a RunSummary.
 *       C03 / F04 emit; they never navigate and never write summary.
 *   R2. `end` is idempotent: a second call does not replace summary, does not
 *       double-write storage.
 *   R3. Score values and multiplier thresholds come from BALANCE.score.
 *       No numeric literals for points in this module (RUL-12 / RUL-11).
 *   R4. `onKilled` while not `running` is ignored (paused / over).
 *   R5. `elapsedMs` does not advance while paused or over.
 *   R6. Local best uses Q10 localStorage, key from BALANCE.score.storageKey
 *       plus mode. Survives reload (RUL-07, RNK-01).
 *   R7. `isNewBest` is true iff this run's score > previously stored best
 *       (strictly greater). Equal does not sting.
 *   R8. `restart(router, createRun)` calls `router.next(createRun())` and
 *       never mutates the previous world's objects (G01 disposes them).
 *   R9. Integrity 0 path: `onShipDestroyed()` → `end('destroyed')`.
 *   R10. Memory: no GPU. Per-frame allocation: none in `update`. Summary
 *        object allocated once on end.
 *   R11. `onPlayerHit` breaks the no-damage streak (multiplier drops back
 *        to 1 until a new streak qualifies).
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      N/A — pure logic. G07 presents the numbers; G04 presents the
 *              summary.
 * Inheritance: N/A
 * syncRender writes: N/A
 * Never writes: THREE, DOM (storage is the only I/O)
 * Scene ownership: N/A
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 * From SDD-A01 (placeholders until first playtest):
 *   BALANCE.score.enemy              = 100
 *   BALANCE.score.meteor             = 25
 *   BALANCE.score.miniBoss           = 2500
 *   BALANCE.score.megaAsteroid       = 5000
 *   BALANCE.score.boss               = 25000
 *   BALANCE.score.noDamageStreakMul  = 1.5
 *
 * New keys (add to SDD-A01):
 *   BALANCE.score.noDamageStreakAt   = 10    // kills without a hull/shield hit
 *   BALANCE.score.fastWaveClearMul   = 1.25  // reserved; F03 wave hook later
 *   BALANCE.score.fastWaveClearMs    = 15000
 *   BALANCE.score.storageKey         = 'ikarus.poc2.best'  // Q10; per-mode suffix
 *
 * Formula (POC2):
 *   points = BALANCE.score[source]
 *   if noDamageStreak >= noDamageStreakAt: points *= noDamageStreakMul
 *   score += floor(points)
 *   kills += 1 per killed hostile (enemy or meteor or boss)
 *
 * Feel:      Every kill should tick the border HUD (pillar 5). Death is
 *            immediate — Integrity 0 is Result, not a linger. Restart is a
 *            *new* run with the same chance, never a repaired corpse.
 *            Beating your best is the only meta that persists (D08 / RUL-07).
 * Leveling:  multipliers reward clean play, not a power curve. Hull level
 *            does not change score tables.
 * Graphics:  N/A here. 7-digit pad and NEW BEST sting live on G07 / G04.
 * Pillars:   5 one more kill · 6 leaderboards as meta · SHIP-02 die
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/systems/run-state.test.ts
 * Runner: vitest
 * Mocks: in-memory BestScoreStorage, fake now()/dt, SceneRouter spy,
 *        BALANCE.score slice. Do not mock ScoreManager — test it directly.
 *
 * describe('ScoreManager')
 *   it('adds BALANCE.score.enemy on an enemy kill')                         // R3, RUL-11
 *   it('adds BALANCE.score.meteor on a meteor kill')                        // R3
 *   it('applies noDamageStreakMul after noDamageStreakAt unbroken kills')   // R3, R11
 *   it('onPlayerHit resets the streak so the next kill is unmultiplied')    // R11
 *   it('reset zeroes score, kills and streak')                              // restart
 *
 * describe('RunState')
 *   it('starts in phase running with zero kills and elapsed')               // construct
 *   it('update advances elapsedMs only while running')                      // R5
 *   it('pause then update does not advance elapsedMs')                      // R5, RUL-04
 *   it('onKilled while paused is ignored')                                  // R4
 *   it('onShipDestroyed ends the run with cause destroyed')                 // R9, SHIP-02
 *   it('end is the only path that sets phase over and builds a summary')    // R1
 *   it('end is idempotent and does not double-write storage')               // R2
 *   it('summary matches {score,kills,elapsedMs,cause,best,isNewBest}')      // contract
 *   it('isNewBest is true only when score > stored best')                   // R7
 *   it('persists best through storage.load after save')                     // R6, RUL-07
 *   it('restart calls router.next with a freshly created Run scene')        // R8
 *   it('quit end("quit") produces summary.cause quit without a kill')       // G11
 *
 * Manual:
 *   A-manual-1. [manual] die → Result numbers match the border HUD
 *   A-manual-2. [manual] reload the page — HIGH on the next run equals last best
 *
 * Coverage: R1–R11 + card Acceptance (kills/score in HUD via G07 contract;
 * Integrity 0 → result; restart clean; best survives reload) + RUL-03/07/11
 * + SHIP-02.
 */
