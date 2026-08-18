/**
 * #tag/arch #tag/memory
 *
 * Card:         SDD-G08 Debugger panel
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: dev tool (Q09) — no locked player requirement
 * Change type:  split
 * POC-1 origin: poc/src/systems/debugControls.ts (501 lines, five tabs)
 *               — frozen reference
 * Test file:    poc2/src/ui/debugger/debugger.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      The debugger-area tuning surface. Tabbed panels Cam / Ship /
 *            LimitBox / Parallax / Weapons: sliders + spins + vectors bound
 *            to shared objects (BALANCE slices + scene objects). Two-way
 *            sync throttled at ~15 Hz, skipping the focused control. Reset
 *            restores captured defaults. Laser L1–L10 presets. Split one
 *            module per tab (POC-1 was a monolith). Q09: ship behind
 *            `import.meta.env.DEV` so the Itch path can omit it.
 * Does not own: the values' meaning (A01 / B01–B04 / C01 / D02), gizmos
 *            drawing (B04), the area shell (G06), the 15 Hz sidecar clock
 *            (A04 exposes a hook; this class is the consumer).
 * Player-facing: N/A in production. In DEV, a slider that does not move the
 *            game, or a Reset that does not Reset, wastes a tuning session.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-A01 Balancer — typed slices the tabs bind to
 *   SDD-G06 UI areas — `#debugger-area` host
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-G03 RunScene — constructs only when DEV / factory non-null (Q09)
 *   SDD-A04 GameLoop — ~15 Hz sync sidecar calls `debugger.sync()`
 *   Tab modules — CamTab / ShipTab / LimitBoxTab / ParallaxTab / WeaponsTab
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

export type DebuggerTabId = 'cam' | 'ship' | 'limit-box' | 'parallax' | 'weapons'

export interface DebuggerTab {
  readonly id: DebuggerTabId
  mount(panel: HTMLElement): void
  /** Push model → controls unless the control is focused. */
  sync(): void
  /** Restore this tab's captured defaults. */
  reset(): void
  dispose(): void
}

/** Shared objects the tabs write through. Production passes live BALANCE slices. */
export interface DebuggerBinds {
  readonly camera: object
  readonly shipTransform: object
  readonly shipApply: () => void
  readonly cameraApply: () => void
  readonly parallax: object
  readonly parallaxApply: () => void
  readonly limitBox: object
  readonly follow: object
  readonly recenterPoint: object
  readonly controls: object
  readonly weapons: {
    readonly catalog: object
    readonly loadout: readonly string[]
    activeId(): string
    setActive(id: string): void
    readonly mods: object
    readonly energy: { max: number; regenPerSec: number; current: number }
    applyLaserLevel(level: number): void
  }
}

export interface DebuggerOptions {
  readonly host: HTMLElement
  readonly binds: DebuggerBinds
  readonly tabs: readonly DebuggerTab[]
  /** When false (production / Q09), mount is a no-op. Default: import.meta.env.DEV */
  readonly enabled?: boolean
}

export interface DebuggerPort {
  updateReadout(ship: { x: number; y: number; z: number }, camera: { x: number; y: number; z: number }): void
  sync(): void
  reset(): void
  dispose(): void
}

export declare class Debugger implements DebuggerPort {
  constructor(options: DebuggerOptions)
  updateReadout(ship: { x: number; y: number; z: number }, camera: { x: number; y: number; z: number }): void
  sync(): void
  reset(): void
  dispose(): void
}

export declare class CamTab implements DebuggerTab {
  constructor(binds: DebuggerBinds)
  readonly id: DebuggerTabId
  mount(panel: HTMLElement): void
  sync(): void
  reset(): void
  dispose(): void
}

export declare class ShipTab implements DebuggerTab {
  constructor(binds: DebuggerBinds)
  readonly id: DebuggerTabId
  mount(panel: HTMLElement): void
  sync(): void
  reset(): void
  dispose(): void
}

export declare class LimitBoxTab implements DebuggerTab {
  constructor(binds: DebuggerBinds)
  readonly id: DebuggerTabId
  mount(panel: HTMLElement): void
  sync(): void
  reset(): void
  dispose(): void
}

export declare class ParallaxTab implements DebuggerTab {
  constructor(binds: DebuggerBinds)
  readonly id: DebuggerTabId
  mount(panel: HTMLElement): void
  sync(): void
  reset(): void
  dispose(): void
}

export declare class WeaponsTab implements DebuggerTab {
  constructor(binds: DebuggerBinds)
  readonly id: DebuggerTabId
  mount(panel: HTMLElement): void
  sync(): void
  reset(): void
  dispose(): void
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 * Files (one public class per file):
 *   ui/debugger/debugger.ts
 *   ui/debugger/cam-tab.ts
 *   ui/debugger/ship-tab.ts
 *   ui/debugger/limit-box-tab.ts
 *   ui/debugger/parallax-tab.ts
 *   ui/debugger/weapons-tab.ts
 *
 *   defaults    | structuredClone of binds at mount | Reset source
 *   focused     | document.activeElement skip         | two-way sync
 *
 *   sync        — for each control, skip if it is document.activeElement,
 *                 else refresh from the bound object
 *   reset       — Object.assign binds from defaults, then refresh every control
 *   WeaponsTab  — buttons L1..L10 call binds.weapons.applyLaserLevel(n)
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. Five tabs, five modules. Adding a tab does not edit an existing tab
 *       file (only debugger.ts composition).
 *   R2. Two-way: editing a slider/spin writes the bound object immediately
 *       and calls the matching apply hook. Sync pulls model → view at
 *       BALANCE.debug.syncHz (~15 Hz, POC-1 SYNC_INTERVAL 0.066).
 *   R3. `sync()` skips any control that is `document.activeElement`.
 *   R4. Reset restores the snapshot taken at mount, then apply hooks run.
 *   R5. WeaponsTab exposes Laser presets L1–L10 that call applyLaserLevel.
 *   R6. Q09: when `enabled === false`, mount writes nothing into the host
 *       and sync/reset are no-ops. Production Itch build passes false
 *       (or omits constructing Debugger).
 *   R7. Memory: DOM created on mount, removed on dispose. Per-frame
 *       allocation: none on sync (reuse row handles). No GPU.
 *   R8. Debugger never participates in collision or scoring.
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      HTML/CSS panel inside `#debugger-area`. No THREE meshes.
 * Inheritance: N/A
 * syncRender writes: N/A — `sync()` is a throttled DOM refresh, not a GPU bridge
 * Never writes: gameplay rules; it mutates BALANCE *tuning slices* and live
 *               object config which gameplay already reads
 * Scene ownership: host is G06 debugger-area; RunScene disposes Debugger
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 * New section (add to SDD-A01):
 *   BALANCE.debug.syncHz  = 15  // POC-1 0.066 s ≈ 15.15 Hz; name the intent
 *
 * Tab contents (port POC-1; do not retune ranges until a playtest says so):
 *   Cam       — fov, near, far, position xyz, rotation xyz (YXZ)
 *   Ship      — transform pos/rot/scale, motion maxSpeed/accel/decel/brake,
 *               tilt maxDeg/riseMs/fallMs
 *   LimitBox  — halfX/halfZ, bounce.timeMs, recenter delay/still/accel/maxSpeed,
 *               restLine position
 *   Parallax  — per-layer speed, parallaxGain, jitter, wrap
 *   Weapons   — active id, energy max/regen, laser forward/diag/spreads,
 *               L1–L10 presets (D02 LASER_LEVELS)
 *
 * Feel:      A tuner, not a toy. Moving a slider must move the game on the
 *            next frame. Reset is sacred — a designer who cannot get back to
 *            POC-1 numbers will invent new ones. Sync that overwrites the
 *            focused field is a bug (R3).
 * Leveling:  L1–L10 presets are the only leveling UI in POC2.
 * Graphics:  Neon panel matching POC-1 `.debug-panel`:
 *              background rgba(8,8,24,0.85) · border #2af0ff · text #b7e6ff
 *              tabs hairline cyan, active fill rgba(34,211,238,0.25)
 *              sliders accent-color #22d3ee · spins #0a0a1e
 *            Hidden on ≤760px with the column (G06). Hidden entirely when
 *            Q09 production flag is off.
 * Pillars:   none locked — this is a development instrument for pillars 1–4
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/ui/debugger/debugger.test.ts
 * Runner: vitest
 * Mocks: host HTMLElement, DebuggerBinds with mutable plain objects,
 *        five lightweight DebuggerTab fakes plus one real tab (WeaponsTab
 *        for L1–L10). jsdom activeElement for the skip test.
 *
 * describe('Debugger')
 *   it('mounts five tab panels cam/ship/limit-box/parallax/weapons')        // R1
 *   it('writes a slider change into the bound object immediately')          // R2, Acceptance
 *   it('sync skips the focused slider and refreshes the others')            // R3
 *   it('reset restores mount-time defaults and calls apply hooks')          // R4, Acceptance
 *   it('enabled:false mounts nothing and no-ops sync/reset')                // R6, Q09
 *   it('dispose removes the panel from the host')                           // R7
 *
 * describe('WeaponsTab')
 *   it('L1..L10 buttons call applyLaserLevel with 1..10')                   // R5
 *   it('does not import CamTab or edit LimitBox binds')                     // R1
 *
 * describe('tab isolation')
 *   it('each tab id is unique and matches DebuggerTabId')                   // R1
 *
 * Manual:
 *   A-manual-1. [manual] Cam fov slider visibly changes the view
 *   A-manual-2. [manual] Reset after dragging ship speed returns POC-1 12
 *   A-manual-3. [manual] production build (Q09) shows an empty debugger-area
 *
 * Coverage: R1–R8 + Acceptance (live sliders, Reset, 15 Hz skip-focused,
 * L1–L10, one module per tab, Q09 flag).
 */
