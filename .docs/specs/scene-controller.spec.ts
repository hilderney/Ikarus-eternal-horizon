/**
 * #tag/arch #tag/scenes #tag/memory
 *
 * Card:         SDD-G01 SceneController
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: RUL-01, RUL-03, RUL-04
 * Change type:  split
 * POC-1 origin: poc/src/main.ts (composition / rAF ownership) — frozen reference
 * Test file:    poc2/src/scenes/scene-controller.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      The single owner of screen transitions inside the game loop.
 *            `next(scene)` disposes the outgoing scene (every `dispose()` it
 *            created) before mounting the incoming one. Canonical flow is
 *            Title → Run → Result → Rankings → Title. Pause is an OVERLAY on
 *            Run, never a `next()` transition (SDD-G11).
 * Does not own: scene internals (G02–G05, G11), the rAF driver (A04), the
 *            three-area DOM shell (G06), or the WebGL canvas (G09).
 * Player-facing: a leaked mesh, listener or DOM node after a screen change;
 *            a pause that unloads the run; a loop that cannot return to Title.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-A04 GameLoop — pluggable `step(dt)`, start/stop, pause gate
 *   SDD-B01 GameCamera — exists so Run can mount a camera into the renderer
 *   SDD-G02 TitleScene — implements ScenePort
 *   SDD-G03 RunScene — implements ScenePort
 *   SDD-G04 ResultScene — implements ScenePort
 *   SDD-G05 RankingsScene — implements ScenePort
 *   SDD-G06 UI areas — persistent host (`#stage` + three area ids)
 *
 * Cycle note: G02–G05 require G01's `SceneRouter`. Specs ship together; G01
 * owns the protocol, scenes call `router.next(scene)`. Pause (G11) attaches
 * through `attachOverlay` / `detachOverlay` and is not in this requires list.
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-G02 / G04 / G05 — call `next` to leave the page
 *   SDD-G03 — mounted and disposed by `next`; overlay stays alive across pause
 *   SDD-G10 — `restart()` reconstructs Run via `next(fresh RunScene)`
 *   SDD-G11 — overlay attach/detach; never a scene swap
 *   SDD-A04 — receives this controller as the loop's `step`
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
/**
 * Public surface. Ports first, then the class. Constructor dependencies explicit.
 * No service locators. No globals besides BALANCE.
 */

/** Stable ids for full-screen scenes. Pause is not in this union. */
export type SceneId = 'title' | 'run' | 'result' | 'rankings'

/**
 * Every full-screen scene implements this. Menus no-op `update` / `syncRender`.
 * `dispose` must free every geometry, material, texture, DOM node and listener
 * the scene created — including children it constructed (D14 for Run).
 */
export interface ScenePort {
  readonly id: SceneId
  mount(): void
  update(dt: number): void
  syncRender(): void
  dispose(): void
}

/**
 * Overlay protocol used by PauseScene (G11). Not a ScenePort — it never
 * replaces `current`. Mounting it must not call `dispose()` on Run.
 */
export interface SceneOverlayPort {
  readonly kind: 'pause'
  mount(): void
  dispose(): void
}

/** The only way a scene asks to leave. Implemented by SceneController. */
export interface SceneRouter {
  next(scene: ScenePort): void
}

/** A04 surface this card consumes. */
export interface GameLoopPort {
  start(): void
  stop(): void
  setStep(step: (dt: number) => void): void
  setPaused(paused: boolean): void
  readonly paused: boolean
}

export interface SceneControllerOptions {
  readonly loop: GameLoopPort
}

export declare class SceneController implements SceneRouter {
  constructor(options: SceneControllerOptions)

  /** Currently mounted full-screen scene, or null before the first `next`. */
  readonly current: ScenePort | null

  /** Attached overlay (Pause), or null. Never disposed by `next` of a sibling. */
  readonly overlay: SceneOverlayPort | null

  /**
   * Dispose the outgoing scene fully, then `mount()` the incoming one.
   * No-ops a `next` of the same instance. Rejects if `scene` is already disposed.
   * Does not touch `overlay` — callers must `detachOverlay` before leaving Run.
   */
  next(scene: ScenePort): void

  /**
   * Mount a pause overlay on top of the current Run. Does not dispose Run.
   * Throws if `current` is not a Run scene.
   */
  attachOverlay(overlay: SceneOverlayPort): void

  /** Dispose the overlay only. Run stays mounted and frozen until the loop unpauses. */
  detachOverlay(): void

  /**
   * GameLoop step: `current.update(dt)` then `current.syncRender()`.
   * When `loop.paused` is true the loop must not call this (A04 pause gate).
   */
  step(dt: number): void

  /** Stops the loop, detaches overlay, disposes `current`. */
  dispose(): void
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   current     | ScenePort | null     | mounted full-screen scene
 *   overlay     | SceneOverlayPort | null | pause overlay; not a transition
 *   loop        | GameLoopPort     | injected rAF driver; this class is its step
 *
 *   next(scene)        — pre: scene !== current; post: previous.dispose() ran,
 *                        current === scene, scene.mount() ran exactly once
 *   attachOverlay(o)   — pre: current.id === 'run' and overlay === null
 *   detachOverlay()    — post: overlay disposed, current still the same Run
 *   step(dt)           — forwards to current only; overlay is event-driven HTML
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. `next(scene)` always calls `dispose()` on the outgoing scene before
 *       `mount()` on the incoming one. Order is observable.
 *   R2. After `next`, no object created by the outgoing scene remains reachable
 *       from the controller (no leaked ScenePort, no retained overlay).
 *   R3. Canonical navigation is Title → Run → Result → Rankings → Title.
 *       The controller does not enforce the graph (scenes choose the next
 *       instance) but never invents extra full-screen states.
 *   R4. Pause is an overlay: `attachOverlay` / `detachOverlay` never call
 *       `current.dispose()`. Returning from pause resumes the same Run instance.
 *   R5. The controller registers itself as `loop.setStep(this.step)` in the
 *       constructor and `loop.start()`s. `dispose()` stops the loop.
 *   R6. Memory: created-once controller; scenes are created by callers and
 *       disposed by `next` / `dispose`. Per-frame allocation: none.
 *   R7. `next` of a scene while an overlay is attached throws — G11 must
 *       detach (or the overlay's Quit/Restart path detaches) first so Run's
 *       `dispose` is the only teardown.
 *   R8. `step(dt)` does not clamp dt (A04 already clamped). No catch-up burst
 *       is applied here; G11 + A04 own the unpause clock reset.
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      N/A — no mesh of its own. Forwards `syncRender` to `current`.
 * Inheritance: N/A (pure orchestration)
 * syncRender writes: none (delegated)
 * Never writes: scene state, BALANCE, score, pause flags
 * Scene ownership: this class owns which ScenePort is mounted; it does not
 *                  `scene.add` any THREE object (D14: RunScene does)
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 * No gameplay numbers. Transitions are instant (no fade, no hold) so a death
 * returns the player to Result in the same beat as Integrity hitting 0.
 *
 *   BALANCE.scenes.fadeMs  =  0   // declared so a later polish pass does not
 *                                 // invent a literal; POC2 is a hard cut
 *
 * Feel:      The run loop is a door that always opens the same way: Title is
 *            the breath, Run is the fight, Result is the verdict, Rankings is
 *            the brag, Title again. Pause must feel like time stopped, not
 *            like the world was thrown away (G11). Compare to POC-1: there
 *            were no screens — this card adds the meta-loop around the same
 *            playfield.
 * Leveling:  N/A
 * Graphics:  N/A at the controller. Each scene owns its HTML/CSS or canvas.
 *            Cuts are black-void (`--bg: #05060d`); no interstitial art.
 * Pillars:   5 ("one more kill" — death returns a result, then another run)
 *            6 (leaderboards as meta — Rankings sits on the loop)
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/scenes/scene-controller.test.ts
 * Runner: vitest (`npm run test` in poc2/)
 * Mocks: GameLoopPort (fake start/stop/setStep/setPaused), ScenePort spies
 *        with mount/update/syncRender/dispose, SceneOverlayPort spy
 *
 * describe('SceneController')
 *   it('registers itself as the GameLoop step and starts the loop')          // R5
 *   it('next(scene) disposes the outgoing scene before mounting the next')   // R1, Acceptance
 *   it('next(scene) leaves current equal to the incoming scene')             // R1
 *   it('a full Title→Run→Result→Rankings→Title cycle disposes each outgoing') // R3, RUL-03
 *   it('returns to Title after Rankings without leaking the previous scene') // R2, Acceptance
 *   it('attachOverlay does not dispose the Run scene')                       // R4, RUL-04
 *   it('detachOverlay disposes only the overlay and keeps the same Run')     // R4
 *   it('throws when next() is called while an overlay is attached')          // R7
 *   it('throws when attachOverlay is called and current is not run')         // R4
 *   it('step(dt) forwards update then syncRender to current in that order')  // R8, RUL-01
 *   it('step allocates nothing beyond the call (no array/object literals)')  // R6
 *   it('dispose stops the loop, detaches overlay and disposes current')      // R5, R6
 *
 * Manual:
 *   A-manual-1. [manual] play Title→Run→die→Result→Rankings→Title and confirm
 *               the renderer canvas is gone on Title and present on Run
 *   A-manual-2. [manual] Esc pause / Esc resume keeps ship position and score
 *
 * Coverage: R1–R8 + card Acceptance ("every transition disposes fully; loop
 * returns to Title") + RUL-01 / RUL-03 / RUL-04.
 */
