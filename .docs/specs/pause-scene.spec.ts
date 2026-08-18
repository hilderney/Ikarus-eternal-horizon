/**
 * #tag/scenes #tag/ship #tag/hud
 *
 * Card:         SDD-G11 PauseScene + Inventory
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: RUL-04, SHIP-06
 * Change type:  new
 * POC-1 origin: none (new) — POC-1 had no pause
 * Test file:    poc2/src/scenes/pause-scene.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      The Esc pause overlay on top of Run. Full-screen HTML/CSS,
 *            no canvas work. Gates `GameLoop.step` through A04 while keeping
 *            the Run canvas mounted. Shows a read-only inventory (resources
 *            collected this run, from C01), the equipped weapon, and hull /
 *            shield state. Actions: Resume, Restart, Quit-to-Title, routed
 *            through G01 / G10. CraftSlot surface is declared here and filled
 *            in §7 — it must not function in POC2.
 * Does not own: ending the run's scoring (G10.end), reconstructing Run
 *            (G01.next), the rAF clock reset on unpause (A04), mutating
 *            inventory (C01 / F02).
 * Player-facing: Esc that dumps the run; unpause that teleports the ship
 *            (dt catch-up); an inventory the player cannot trust.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-A02 Input — Esc / consume so the overlay owns focus
 *   SDD-A04 GameLoop — pause gate; unpause must not apply a catch-up dt
 *   SDD-C01 Ship — read-only inventory + equipped weapon
 *   SDD-G01 SceneController — attachOverlay / detachOverlay / next
 *   SDD-G06 UI areas — overlay hosts over the stage (not a column swap)
 *   SDD-G10 RunState — pause / resume / restart / end('quit')
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-G03 RunScene — stays mounted and undisposed for the overlay lifetime
 *   §7 CraftSlot — mounts into the declared slot on this overlay
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

import type {
  GameLoopPort,
  SceneController,
  SceneOverlayPort,
  ScenePort,
  SceneRouter,
} from './scene-controller.spec'
import type { RunStatePort } from './run-state.spec'
import type { InventoryRead } from './hud.spec'

export interface PauseInputPort {
  isDown(code: string): boolean
  consume(code: string): void
}

export interface PauseShipRead {
  readonly inventory: InventoryRead
  readonly weaponName: string
  readonly integrity: number
  readonly integrityMax: number
  readonly shield: number
  readonly shieldMax: number
}

export interface PauseSceneOptions {
  readonly host: HTMLElement
  readonly loop: GameLoopPort
  readonly runState: RunStatePort
  readonly controller: Pick<SceneController, 'attachOverlay' | 'detachOverlay'> & SceneRouter
  readonly input: PauseInputPort
  readonly ship: PauseShipRead
  readonly createRun: () => ScenePort
  readonly createTitle: () => ScenePort
}

export declare class PauseScene implements SceneOverlayPort {
  constructor(options: PauseSceneOptions)

  readonly kind: 'pause'

  /**
   * Open the overlay: attachOverlay, loop.setPaused(true), runState.pause().
   * Does not dispose Run. Idempotent if already open.
   */
  mount(): void

  /** Resume path without going through mount. */
  resume(): void

  restart(): void

  quit(): void

  /** Removes overlay DOM + listeners. Does not dispose Run. */
  dispose(): void
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   kind        | 'pause'          | overlay discriminant (not a SceneId)
 *   open        | boolean          | mount/resume/quit/restart clear it
 *   root        | HTMLElement      | full-screen overlay appended to host
 *
 *   mount    — overlay DOM; loop paused; runState.paused; focus trap
 *   resume   — detachOverlay; loop.setPaused(false); runState.resume();
 *              dispose overlay DOM. Run instance unchanged.
 *   restart  — detachOverlay; runState.restart(router, createRun)
 *              (G01 next disposes Run)
 *   quit     — detachOverlay; runState.end('quit'); router.next(createTitle())
 *              (G01 next disposes Run). Result is skipped on quit-to-title.
 *   CraftSlot — empty <section data-slot="craft"> declared, disabled, labelled
 *               COMING ONLINE (filled in §7)
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. Pause is an overlay, not a ScenePort. `kind === 'pause'`. It is never
 *       passed to `next()`.
 *   R2. `mount()` does not call dispose on Run and does not detach the canvas.
 *   R3. `mount()` calls `loop.setPaused(true)` and `runState.pause()` so
 *       GameLoop.step is gated (A04). Overlay HTML still receives events.
 *   R4. `resume()` calls `loop.setPaused(false)` and `runState.resume()`.
 *       Unpause must not apply a catch-up dt — A04 resets its last-frame
 *       timestamp. This class must not inject a fake dt.
 *   R5. Inventory, weapon and hull/shield are read-only snapshots at mount
 *       (re-read on mount, never written).
 *   R6. Esc (BALANCE.scenes.pause.toggleKey) toggles pause/resume. While
 *       open, the overlay owns keyboard focus (input.consume on the toggle
 *       and action keys) so Run does not fire weapons through the menu.
 *   R7. Restart reconstructs via G10.restart → G01.next(fresh Run). Quit
 *       ends with cause 'quit' then next(Title).
 *   R8. Memory: overlay DOM on mount, removed on dispose/resume/restart/quit.
 *       No GPU, no THREE. Per-frame allocation: none (event-driven).
 *   R9. CraftSlot is present in the DOM and disabled. Clicking it does nothing.
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      HTML/CSS full-screen overlay. No THREE. Canvas stays visible
 *              underneath (frozen last frame).
 * Inheritance: N/A
 * syncRender writes: N/A
 * Never writes: ship inventory, health, score, world transforms
 * Scene ownership: overlay node on `host` (typically `#stage`); RunScene
 *                  remains the D14 owner of the world
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 * New keys (add to SDD-A01):
 *   BALANCE.scenes.pause.toggleKey    = 'Escape'
 *   BALANCE.scenes.pause.resumeKey    = 'Escape'   // same key closes
 *   BALANCE.scenes.pause.restartKey   = 'KeyR'
 *   BALANCE.scenes.pause.quitKey      = 'KeyQ'
 *
 * Feel:      Time stops. The ship hangs in the neon void under a smoked
 *            glass panel. Unpausing continues the *same* breath — no lurch,
 *            no dt burst that slams the ship into a meteor (RUL-04).
 *            Inventory is a glance (SHIP-06), not a management screen; craft
 *            waits in §7 so POC2 pause cannot stall the loop with a build.
 * Leveling:  N/A (read-only). CraftSlot declared for later real-time build.
 * Graphics:  Full-screen HTML/CSS overlay, neon chrome:
 *              backdrop  rgba(5,6,13,0.72)
 *              panel     #0a0d18, hairline #4de2ff, glow 0 0 24px cyan
 *              title     PAUSED  letter-spaced
 *              rows      Metal Scrap · weapon name · Force Field · Integrity
 *              buttons   Resume / Restart / Quit  — monospace, cyan border
 *              CraftSlot dashed dim box, text-dim, not a CTA
 *            Read in <0.3s. Focus ring on the first button (Resume).
 * Pillars:   3 (craft chosen on pause — surface only) · 1 (state still
 *            readable) · RUL-04
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/scenes/pause-scene.test.ts
 * Runner: vitest
 * Mocks: host HTMLElement, GameLoopPort, RunStatePort, SceneController
 *        overlay + router spies, PauseInputPort, PauseShipRead fixture,
 *        createRun / createTitle factories. Fake timers not required if
 *        dt catch-up is asserted via loop.setPaused and a spy that the
 *        overlay never calls step(largeDt).
 *
 * describe('PauseScene')
 *   it('kind is pause and is not a ScenePort id')                           // R1
 *   it('mount attaches overlay without disposing or detaching Run')         // R2, RUL-04
 *   it('mount sets loop.paused and runState.pause')                         // R3
 *   it('resume unpauses the loop and runState and removes overlay DOM')     // R4
 *   it('resume does not call loop.step or pass a catch-up dt')              // R4
 *   it('renders metalScrap, weapon name, shield and integrity read-only')   // R5, SHIP-06
 *   it('does not mutate ship.inventory when Resume is clicked')             // R5
 *   it('Escape consumes the key and toggles resume')                        // R6
 *   it('while open, fire key is consumed and does not reach Run')           // R6
 *   it('Restart calls runState.restart with a fresh Run factory')           // R7
 *   it('Quit ends the run with cause quit then next(title)')                // R7
 *   it('CraftSlot is in the DOM and click does not throw or navigate')      // R9
 *   it('dispose removes overlay listeners and DOM but not the canvas')      // R8
 *
 * Manual:
 *   A-manual-1. [manual] Esc freezes parallax/ship; Esc again continues with
 *               no position jump after a several-second wait
 *   A-manual-2. [manual] collected Metal Scrap listed on pause matches HUD
 *
 * Coverage: R1–R9 + card Acceptance (Esc freezes the field and lists
 * resources; unpause continues the same run without a movement jump) +
 * RUL-04, SHIP-06.
 */
