/**
 * #tag/arch #tag/scenes
 *
 * Card:         SDD-G06 UI areas
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: RUL-08
 * Change type:  port
 * POC-1 origin: poc/index.html + poc/src/style.css (3-area shell) — frozen reference
 * Test file:    poc2/src/ui/areas.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      Assembly of the persistent run/menu layout
 *            `area-inputs (left) · game-area (canvas/menu) · debugger-area
 *            (right)`. The three ids are already scaffolded in
 *            `poc2/index.html`. This module binds to them, exposes a typed
 *            port, switches menu vs run mode, and relies on CSS to collapse
 *            the side columns at ≤760px.
 * Does not own: canvas creation (G09), HUD overlays (G07), debugger widgets
 *            (G08), scene markup (G02–G05, G11), BALANCE numbers (A01) beyond
 *            the collapse breakpoint declaration.
 * Player-facing: on a phone the side columns vanish and the 9:16 pane remains;
 *            on desktop the input map and debugger stay in view. A missing
 *            id is a boot failure, not a silent empty page.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-A01 Balancer — `BALANCE.layout` (playfield) + collapse breakpoint
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-G01 — host for every scene
 *   SDD-G02 / G03 / G04 / G05 / G11 — fill the three areas
 *   SDD-G07 — positions floating HUD against game-area's canvas rect
 *   SDD-G08 — mounts into debugger-area
 *   SDD-G09 — attaches the canvas to game-area
 */

// ─── 9. Agent sign-off ───────────────────────────────────────────────────────
/**
 * Orchestrator : hub-v4.1 / 2026-08-17  scope, requires, DoD
 * Programming  : hub-v4.1 / 2026-08-17  contract, memory, THREE / view
 * Game Design  : hub-v4.1 / 2026-08-17  BALANCE, feel, leveling, graphics
 * TDD          : hub-v4.3 / 2026-08-18  areas.test.ts green
 * Status: done
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Programming / Three.js
// ═════════════════════════════════════════════════════════════════════════════

// ─── 2. Contract ─────────────────────────────────────────────────────────────

export type AreaMode = 'menu' | 'run'

export interface UiAreasPort {
  readonly stage: HTMLElement
  readonly inputs: HTMLElement
  readonly game: HTMLElement
  readonly debugger: HTMLElement
  readonly mode: AreaMode
  setMode(mode: AreaMode): void
  dispose(): void
}

export interface UiAreasOptions {
  readonly document?: Document
}

export declare class UiAreas implements UiAreasPort {
  constructor(options?: UiAreasOptions)

  readonly stage: HTMLElement
  readonly inputs: HTMLElement
  readonly game: HTMLElement
  readonly debugger: HTMLElement
  readonly mode: AreaMode

  /**
   * `menu` — scenes own copy inside all three columns.
   * `run`  — area-inputs is the live key map; game-area holds the canvas;
   *          debugger-area holds G08 (or stays empty in production).
   */
  setMode(mode: AreaMode): void

  /** Does not remove the scaffold ids. Clears `data-mode` back to default. */
  dispose(): void
}

/** Canonical ids — must match poc2/index.html. */
export const AREA_IDS = {
  stage: 'stage',
  inputs: 'area-inputs',
  game: 'game-area',
  debugger: 'debugger-area',
} as const

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   stage     | HTMLElement | `#stage` flex row
 *   inputs    | HTMLElement | `#area-inputs`
 *   game      | HTMLElement | `#game-area`
 *   debugger  | HTMLElement | `#debugger-area`
 *   mode      | AreaMode    | reflected as data-mode on #stage
 *
 *   constructor — queries ids; throws if any node is missing
 *   setMode     — writes data-mode; does not rebuild the tree
 *   dispose     — no node removal (scaffold is owned by index.html)
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. Constructor throws if `#stage`, `#area-inputs`, `#game-area` or
 *       `#debugger-area` is missing.
 *   R2. This class never creates those ids — they are scaffolded in
 *       poc2/index.html. Binding is query-only.
 *   R3. Side columns collapse at `BALANCE.layout.collapsePx` (760) via CSS
 *       `@media (max-width: 760px)` already in poc2/src/style.css. JS does
 *       not `display:none` them itself.
 *   R4. `setMode` writes `data-mode="menu"|"run"` on `#stage` and nowhere else.
 *   R5. Memory: created-once. No GPU. dispose does not detach the scaffold.
 *       Per-frame allocation: none (this class is not in the tick).
 *   R6. Relative paths only (RUL-08): this module does not emit absolute URLs.
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      HTML/CSS flex layout. No THREE.
 * Inheritance: N/A
 * syncRender writes: N/A
 * Never writes: canvas size (G09), HUD positions (G07)
 * Scene ownership: the scaffold is document-owned; scenes append/remove
 *                  *children* of the three areas
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 *   BALANCE.layout.playfield   = { width: 540, height: 960 }  // G09
 *   BALANCE.layout.collapsePx  = 760  // POC-1 @media; Itch phones hide chrome
 *   BALANCE.layout.areaWidth   = 17rem  // --area-width in poc2/src/style.css
 *
 * Feel:      Desktop is a cockpit: legend left, playfield centre, tuning
 *            right. Narrow screens are the playfield only — the fight must
 *            remain playable without the debugger (Q09). POC-1 already did
 *            this split; port it, do not redesign.
 * Leveling:  N/A
 * Graphics:  Neon chrome already on :root:
 *              --bg #05060d · --panel-bg #0a0d18 · --line #1d2440
 *              --neon #4de2ff · --text #b9c6e6 · --text-dim #6a769a
 *            Columns 17rem, hairline borders, monospace 12px.
 *            Empty-area `::before` hint is scaffold-only; scenes replace it
 *            by filling the node (CSS `:empty` no longer matches).
 * Pillars:   4 (legibility — playfield stays centred) · RUL-08 packaging
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/ui/areas.test.ts
 * Runner: vitest
 * Mocks: jsdom document with #stage / #area-inputs / #game-area /
 *        #debugger-area (copy the scaffold ids). Second fixture missing an id.
 *
 * describe('UiAreas')
 *   it('binds to #stage, #area-inputs, #game-area, #debugger-area')         // R1, R2
 *   it('throws when any scaffold id is missing')                            // R1
 *   it('does not create duplicate area nodes')                              // R2
 *   it('setMode("run") writes data-mode="run" on #stage')                   // R4
 *   it('setMode("menu") writes data-mode="menu" on #stage')                 // R4
 *   it('exposes collapse breakpoint 760 from BALANCE.layout.collapsePx')    // R3
 *   it('dispose leaves the scaffold ids in the document')                   // R5
 *
 * Manual:
 *   A-manual-1. [manual] viewport >760px shows three columns
 *   A-manual-2. [manual] viewport ≤760px hides area-inputs and debugger-area
 *               and keeps game-area centred (RUL-08 / Itch phones)
 *
 * Coverage: R1–R6 + card Acceptance (3-area layout in Run; columns hide on
 * narrow screens) + RUL-08.
 */
