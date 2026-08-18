/**
 * #tag/scenes #tag/hud
 *
 * Card:         SDD-G04 ResultScene
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: RUL-03
 * Change type:  new
 * POC-1 origin: none (new) — POC-1 had no game-over screen
 * Test file:    poc2/src/scenes/result-scene.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      The Result full-page HTML/CSS screen shown when a run ends.
 *            Reads a `RunSummary` from G10 — `{ score, kills, elapsedMs,
 *            cause, best, isNewBest }` — and renders it. Continue advances
 *            to Rankings via G01. No canvas logic.
 * Does not own: computing the summary (G10), persisting the best (G10),
 *            Rankings layout (G05), ending the run (G10), disposing Run (G01).
 * Player-facing: the verdict. Wrong numbers feel like a stolen run; a missing
 *            NEW BEST sting kills pillar 6.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-G01 SceneController — SceneRouter + ScenePort
 *   SDD-G06 UI areas — three-area host
 *   SDD-G10 RunState + ScoreManager — RunSummary contract
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-G01 — mounts/disposes this scene
 *   SDD-G05 — next scene on Continue
 *   SDD-G03 — Run navigates here when phase becomes 'over'
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
import type { RunSummary } from './run-state.spec'

export interface ResultSceneOptions {
  readonly areas: UiAreasPort
  readonly router: SceneRouter
  readonly summary: RunSummary
  readonly createRankings: () => ScenePort
  /** Optional — skip Rankings and jump to Title. */
  readonly createTitle?: () => ScenePort
}

export declare class ResultScene implements ScenePort {
  constructor(options: ResultSceneOptions)

  readonly id: SceneId

  mount(): void
  update(dt: number): void
  syncRender(): void
  dispose(): void
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   id        | 'result'
 *   summary   | RunSummary | frozen snapshot from G10; never mutated here
 *   root      | HTMLElement | markup in game-area
 *
 *   Continue  — router.next(createRankings())
 *   Title     — router.next(createTitle()) when provided (Quit-style)
 *   dispose   — strips every node this class appended
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. `id` is the literal `'result'`.
 *   R2. The scene reads `summary` and never mutates it, never writes
 *       localStorage, never touches score internals (G10 owns those).
 *   R3. Mounted markup includes score, kills, elapsedMs, cause, best.
 *       When `isNewBest` is true a NEW BEST marker is present; when false
 *       it is absent.
 *   R4. No <canvas>, no THREE.
 *   R5. Continue (button + BALANCE.scenes.result.continueKey) calls
 *       `router.next(createRankings())` exactly once.
 *   R6. `update` / `syncRender` are no-ops.
 *   R7. Memory: DOM on mount, gone on dispose. Per-frame allocation: none.
 *   R8. `areas.setMode('menu')` on mount.
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      HTML/CSS neon verdict panel. No THREE.
 * Inheritance: N/A
 * syncRender writes: N/A
 * Never writes: RunSummary fields, localStorage, BALANCE.score
 * Scene ownership: nodes appended into G06 areas
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 *   BALANCE.scenes.result.continueKey  = 'Enter'
 *   BALANCE.score.*                    = consumed only as already-totalled
 *                                        numbers inside RunSummary (G10)
 *
 * Display formatting (presentation, not scoring rules):
 *   score     → 7-digit zero-padded (README HUD: 0098450)
 *   kills     → integer
 *   elapsedMs → mm:ss.t
 *   cause     → 'destroyed' reads as HULL FAILURE; 'quit' reads as ABORTED
 *   best      → same 7-digit pad
 *
 * Feel:      Instant verdict after death. The player should know in <0.3s
 *            whether they beat themselves. NEW BEST is a cyan sting, not a
 *            fireworks hold. One Enter to Rankings — the loop must not stall.
 * Leveling:  N/A (the summary is already final)
 * Graphics:  Full-page HTML/CSS, three areas:
 *              area-inputs    — Enter Continue
 *              game-area      — cause headline, score stack, NEW BEST badge
 *              debugger-area  — empty of sliders
 *            Palette: void #05060d, neon #4de2ff, danger #f43f5e for
 *            HULL FAILURE, dim #6a769a for ABORTED. Monospace. Hairline box.
 *            Badge: cyan border + glow only when isNewBest.
 * Pillars:   5 (die → result → another run) · 6 (best as meta)
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/scenes/result-scene.test.ts
 * Runner: vitest
 * Mocks: UiAreasPort fixtures, SceneRouter, createRankings factory,
 *        a frozen RunSummary fixture
 *
 * describe('ResultScene')
 *   it('reports id "result"')                                               // R1
 *   it('renders score, kills, elapsedMs, cause and best from the summary')  // R3, RUL-03
 *   it('shows a NEW BEST marker only when isNewBest is true')               // R3
 *   it('does not mutate the summary object')                                // R2
 *   it('does not write localStorage')                                       // R2
 *   it('mount does not insert a canvas')                                    // R4
 *   it('Continue calls router.next with the rankings scene once')           // R5
 *   it('Enter key continues once')                                          // R5
 *   it('update and syncRender are no-ops')                                  // R6
 *   it('dispose removes every appended node and listener')                  // R7
 *
 * Manual:
 *   A-manual-1. [manual] HULL FAILURE + NEW BEST read in <0.3s
 *   A-manual-2. [manual] death in Run lands on Result with the live HUD numbers
 *
 * Coverage: R1–R8 + card Acceptance (HTML/CSS; reads RunSummary; RUL-03).
 */
