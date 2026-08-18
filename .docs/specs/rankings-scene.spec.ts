/**
 * #tag/scenes #tag/ranking
 *
 * Card:         SDD-G05 RankingsScene
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: RNK-01 (local slice; RNK-02 should)
 * Change type:  new
 * POC-1 origin: none (new)
 * Test file:    poc2/src/scenes/rankings-scene.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      The Rankings full-page HTML/CSS screen. POC2 ships the *local*
 *            slice of the boards: Normal Eternal best (RNK-01) plus optional
 *            client-side Weekly/Monthly/Annual windows in UTC (RNK-02).
 *            Steam 8-board upload (RNK-06+) is §7 / G3 and out of this card.
 *            Continue returns to Title via G01. No canvas logic.
 * Does not own: writing bests (G10 / Q10 localStorage), scoring (G10),
 *            Survivor boards (RNK-03/05, §7), Steam (RNK-06).
 * Player-facing: a board that forgets the best on reload is a broken promise
 *            (RUL-07 lives in G10; this screen must *show* that best).
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-G01 SceneController — SceneRouter + ScenePort
 *   SDD-G06 UI areas — three-area host
 *   SDD-G10 RunState + ScoreManager — local best + board snapshot
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-G01 — mounts/disposes this scene
 *   SDD-G02 / G04 — navigate here
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

import type { SceneId, ScenePort, SceneRouter } from './scene-controller.spec'
import type { UiAreasPort } from './ui-areas.spec'

export type RankingPeriod = 'weekly' | 'monthly' | 'annual' | 'eternal'
export type RankingMode = 'normal'

/** One local row. Sort is owned by the reader (score ↓, kills ↓, elapsed ↑). */
export interface LocalBoardEntry {
  readonly score: number
  readonly kills: number
  readonly elapsedMs: number
  readonly endedAt: string
  readonly mode: RankingMode
  readonly period: RankingPeriod
}

export interface LocalBoardsPort {
  /** Best Eternal Normal row, or null when the player has never finished a run. */
  best(mode: RankingMode, period: RankingPeriod): LocalBoardEntry | null
  /** Recent local runs for the period, already sorted, newest-window first. */
  list(mode: RankingMode, period: RankingPeriod): readonly LocalBoardEntry[]
}

export interface RankingsSceneOptions {
  readonly areas: UiAreasPort
  readonly router: SceneRouter
  readonly boards: LocalBoardsPort
  readonly createTitle: () => ScenePort
}

export declare class RankingsScene implements ScenePort {
  constructor(options: RankingsSceneOptions)

  readonly id: SceneId

  mount(): void
  update(dt: number): void
  syncRender(): void
  dispose(): void
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   id          | 'rankings'
 *   boards      | LocalBoardsPort | G10 persistence snapshot (read-only)
 *   period      | RankingPeriod   | default 'eternal' (RNK-01)
 *
 *   Tab click   — re-renders list from boards.list(mode, period)
 *   Continue    — router.next(createTitle())
 *   dispose     — strips appended nodes + listeners
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. `id` is the literal `'rankings'`.
 *   R2. Default view is Normal × Eternal (RNK-01). Empty state is a named
 *       placeholder, not a throw.
 *   R3. The scene reads `LocalBoardsPort` and never writes storage.
 *   R4. Period tabs Weekly / Monthly / Annual / Eternal are present. Switching
 *       a tab shows `boards.list('normal', period)` (RNK-02 should).
 *   R5. Survivor tabs are not in POC2 (RNK-03 is G2). No Steam chrome.
 *   R6. No <canvas>, no THREE.
 *   R7. Continue (button + BALANCE.scenes.rankings.continueKey) calls
 *       `router.next(createTitle())` exactly once.
 *   R8. `update` / `syncRender` are no-ops.
 *   R9. Memory: DOM on mount, gone on dispose. Per-frame allocation: none.
 *   R10. `areas.setMode('menu')` on mount.
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      HTML/CSS neon board. No THREE.
 * Inheritance: N/A
 * syncRender writes: N/A
 * Never writes: localStorage, scores, BALANCE
 * Scene ownership: nodes appended into G06 areas
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 *   BALANCE.scenes.rankings.continueKey  = 'Enter'
 *   BALANCE.scenes.rankings.defaultPeriod = 'eternal'
 *   BALANCE.score.*                      = not re-applied here; rows are final
 *
 * Tie-break (display order, matching ranking-plan §2): score ↓, kills ↓,
 * elapsedMs ↑. G10 stores; this scene must not re-sort differently.
 *
 * Timezone: windows are UTC (D10). UI may show local time with a UTC note.
 *
 * Feel:      A quiet brag screen, not a stall. The best number is the largest
 *            type on the page. Enter dumps the player back at Title so the
 *            next run starts immediately (pillar 5 + 6).
 * Leveling:  N/A
 * Graphics:  Full-page HTML/CSS, three areas:
 *              area-inputs    — Enter Title · period tab keys 1–4
 *              game-area      — period tabs + list (rank, score, kills, time)
 *              debugger-area  — "LOCAL · UTC" note; no sliders
 *            Palette: void #05060d, neon #4de2ff, dim #6a769a.
 *            Active tab: filled cyan border. Empty board: "NO TRANSMISSIONS".
 *            Top row (best) gets a hairline glow. Monospace 7-digit scores.
 * Pillars:   6 (leaderboards as meta)
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/scenes/rankings-scene.test.ts
 * Runner: vitest
 * Mocks: UiAreasPort fixtures, SceneRouter, LocalBoardsPort with seeded rows
 *        (including an empty-board case)
 *
 * describe('RankingsScene')
 *   it('reports id "rankings"')                                             // R1
 *   it('defaults to Normal Eternal and shows boards.best')                  // R2, RNK-01
 *   it('shows an empty-state placeholder when best is null')                // R2
 *   it('does not write localStorage')                                       // R3
 *   it('period tabs request list(normal, period) from the port')            // R4, RNK-02
 *   it('does not render Survivor tabs')                                     // R5
 *   it('mount does not insert a canvas')                                    // R6
 *   it('Continue calls router.next with the title scene once')              // R7
 *   it('update and syncRender are no-ops')                                  // R8
 *   it('dispose removes every appended node and listener')                  // R9
 *
 * Manual:
 *   A-manual-1. [manual] after a NEW BEST Result, Rankings shows that score
 *   A-manual-2. [manual] reload the tab — Eternal best is still there (G10)
 *
 * Coverage: R1–R10 + RNK-01 (+ RNK-02 tabs) + card Acceptance (local slice).
 */
