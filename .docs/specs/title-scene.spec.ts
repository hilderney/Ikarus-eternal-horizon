/**
 * #tag/scenes #tag/hud
 *
 * Card:         SDD-G02 TitleScene
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: RUL-03
 * Change type:  new
 * POC-1 origin: none (new) — POC-1 had a single always-running scene
 * Test file:    poc2/src/scenes/title-scene.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      The Title full-page HTML/CSS screen. It organizes the three
 *            persistent areas (`area-inputs` · `game-area` · `debugger-area`)
 *            into a menu layout, presents the game identity, and starts a run
 *            by asking G01 to `next` a fresh RunScene. No canvas logic.
 * Does not own: SceneController (G01), the area DOM ids (G06), Run construction
 *            (G03), Rankings content (G05), WebGL (G09).
 * Player-facing: the first thing a player sees. A broken Title means no way
 *            into a run; a Title that still shows the last run's canvas is a
 *            leak.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-G01 SceneController — `SceneRouter.next` + ScenePort protocol
 *   SDD-G06 UI areas — `#area-inputs`, `#game-area`, `#debugger-area`
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-G01 — mounts/disposes this scene
 *   SDD-G03 — created when Start Run fires
 *   SDD-G05 — optional Rankings entry from this screen
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

export interface TitleSceneOptions {
  readonly areas: UiAreasPort
  readonly router: SceneRouter
  /** Caller supplies the Run instance (or a factory) so G02 never `new`s G03. */
  readonly createRun: () => ScenePort
  /** Optional — Rankings button. Omit to hide the control. */
  readonly createRankings?: () => ScenePort
}

export declare class TitleScene implements ScenePort {
  constructor(options: TitleSceneOptions)

  readonly id: SceneId

  /** Fills the three areas with menu markup. No canvas, no THREE import. */
  mount(): void

  /** Event-driven page — no-op. */
  update(dt: number): void

  /** No GPU work. */
  syncRender(): void

  /** Removes every DOM node and listener this class appended into the areas. */
  dispose(): void
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   id          | 'title'     | ScenePort discriminant
 *   areas       | UiAreasPort | G06 host; never created here
 *   router      | SceneRouter | G01
 *   root        | HTMLElement | menu root appended into game-area on mount
 *
 *   Start Run   — post: router.next(createRun()) exactly once per click/key
 *   Rankings    — post: router.next(createRankings()) when the factory exists
 *   dispose     — post: area-inputs / game-area / debugger-area contain no
 *                 node this class created; listeners gone
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. `id` is the literal `'title'`.
 *   R2. `mount()` writes HTML into the three G06 areas and does not create a
 *       <canvas> or import three.
 *   R3. Start Run (button + BALANCE.scenes.title.startKey) calls
 *       `router.next(createRun())` exactly once (re-entry ignored until remount).
 *   R4. `update` and `syncRender` are no-ops.
 *   R5. Memory: DOM created on mount, fully removed on dispose. No GPU.
 *       Per-frame allocation: none (no tick work).
 *   R6. `areas.setMode('menu')` is called on mount so side columns show menu
 *       copy rather than the run input map.
 *   R7. Rankings control is absent when `createRankings` is omitted.
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      HTML/CSS only. No THREE.
 * Inheritance: N/A (pure DOM scene)
 * syncRender writes: N/A
 * Never writes: Run state, BALANCE gameplay numbers, canvas size
 * Scene ownership: markup lives in G06 areas; TitleScene owns the nodes it
 *                  appends and must remove them on dispose
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 *   BALANCE.scenes.fadeMs                = 0          // hard cut (G01)
 *   BALANCE.scenes.title.startKey        = 'Enter'    // also clickable CTA
 *   BALANCE.scenes.title.rankingsKey     = 'KeyR'
 *
 * Feel:      A cold hangar breath before the dive. The player should be in a
 *            run within one key. No lore dump, no settings wall. POC-1 had
 *            no Title — this is new, but it must not delay the playable pillar.
 * Leveling:  N/A
 * Graphics:  Full-page neon wireframe menu.
 *            Palette (css variables already on :root in poc2/src/style.css):
 *              --bg        #05060d   void
 *              --panel-bg  #0a0d18   columns
 *              --neon      #4de2ff   title lockup / CTA glow
 *              --neon-dim  #2a7f96   idle chrome
 *              --text      #b9c6e6
 *            Layout of the three areas on Title:
 *              area-inputs    — key legend (Enter Start · R Rankings)
 *              game-area      — wordmark "IKARUS" / "ETERNAL HORIZON" + Start Run
 *              debugger-area  — build/version line; empty of sliders
 *            CTA: hairline cyan border, monospace, glow on focus. Read in <0.3s.
 *            No canvas, no ship silhouette on this screen (that is Run).
 * Pillars:   5 (the door back into another run) · 6 (Rankings reachable here)
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/scenes/title-scene.test.ts
 * Runner: vitest
 * Mocks: UiAreasPort with three real HTMLElement fixtures, SceneRouter spy,
 *        createRun / createRankings factories returning stub ScenePorts
 *
 * describe('TitleScene')
 *   it('reports id "title"')                                                // R1
 *   it('mount fills area-inputs, game-area and debugger-area with markup')   // R2, R6
 *   it('mount does not insert a canvas element')                            // R2, Acceptance
 *   it('Start Run button calls router.next with the created Run scene once') // R3, RUL-03
 *   it('pressing BALANCE.scenes.title.startKey starts a run once')          // R3
 *   it('Rankings button is omitted when createRankings is not provided')    // R7
 *   it('Rankings button calls router.next with the rankings scene')         // R7
 *   it('update and syncRender do not throw and do not mutate the DOM')      // R4
 *   it('dispose removes every node this scene appended to the three areas') // R5
 *   it('dispose removes the Enter / KeyR listeners')                        // R5
 *   it('calling mount after dispose rebuilds a fresh menu')                 // R5
 *
 * Manual:
 *   A-manual-1. [manual] wordmark + Start Run read in <0.3s on a 540×960 pane
 *   A-manual-2. [manual] columns collapse ≤760px with the CTA still reachable
 *
 * Coverage: R1–R7 + card Acceptance (full-page HTML/CSS, three areas, start
 * run, no canvas logic) + RUL-03.
 */
