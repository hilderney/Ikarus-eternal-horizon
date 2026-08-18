/**
 * #tag/arch #tag/memory
 *
 * Card:         SDD-A04 GameLoop
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: RUL-01, RUL-13
 * Change type:  split
 * POC-1 origin: poc/src/main.ts (rAF block, MAX_FRAME_DT, SYNC_INTERVAL)  — frozen reference
 * Test file:    poc2/src/core/game-loop.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      `class GameLoop` — the rAF driver. Clamps `dt` to MAX_FRAME_DT,
 *            calls the injected `step(dt)` once per frame, exposes start/stop,
 *            a pause gate for G11, and a ~15 Hz debugger sidecar that does not
 *            live on the gameplay step.
 * Does not own: scene contents, render, what `step` does (G01/G03 inject it),
 *            or the debugger UI (G08). Hit-stop (F05) uses the same pause gate;
 *            this class does not know why it is paused.
 * Player-facing: a hitch after a tab-switch must not fling the ship; pause
 *            must freeze the field without killing the canvas.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Upstream: none.
 * Downstream:
 *   SDD-G01 SceneController / SDD-G03 RunScene — inject step(dt)
 *   SDD-G11 PauseScene — setPaused(true) gates step; rAF keeps running
 *   SDD-G08 Debugger — sidecar hook (~15 Hz)
 *   SDD-F05 VfxManager — hit-stop via the pause gate, never by sleeping
 *   SDD-G10 RunState — running | paused | over is a consumer of this gate
 */

// ─── 9. Agent sign-off ───────────────────────────────────────────────────────
/**
 * Orchestrator : hub-v4.1 / 2026-08-17  scope, requires, DoD
 * Programming  : hub-v4.1 / 2026-08-17  contract, clock injection, pause gate
 * Game Design  : hub-v4.1 / 2026-08-17  MAX_FRAME_DT and sidecar cadence
 * TDD          : hub-v4.1 / 2026-08-17  cases named; test file not yet written (red next)
 * Status: spec-complete
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Programming / Three.js
// ═════════════════════════════════════════════════════════════════════════════

/** Pluggable clock so tests use fake timers instead of real rAF. */
export interface FrameClock {
  now(): number
  request(cb: (timeMs: number) => void): number
  cancel(id: number): void
}

export interface GameLoopOptions {
  /** Logic + render for the active scene. Called with clamped dt (seconds). */
  readonly step: (dt: number) => void
  /**
   * Optional debugger sync. Invoked at sidecarHz while the loop is started,
   * including while paused (G08 stays live on the overlay).
   */
  readonly sidecar?: () => void
  /** Injected clock. Defaults to performance.now + requestAnimationFrame. */
  readonly clock?: FrameClock
}

export declare class GameLoop {
  constructor(options: GameLoopOptions)

  /** Arm rAF. Idempotent. Records `now` so the first dt is not a hitch. */
  start(): void

  /** Cancel rAF. Idempotent. Does not call step. */
  stop(): void

  /**
   * Pause gate (G11 / F05 hit-stop). While true, rAF continues but `step` is
   * not called. Next unpause uses a fresh `last` so dt does not catch up.
   */
  setPaused(paused: boolean): void

  readonly paused: boolean
  readonly running: boolean
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   field          | type        | meaning / unit / range
 *   ---------------|-------------|------------------------------------------
 *   _step          | (dt)=>void  | injected scene tick
 *   _sidecar       | ()=>void    | optional ~15 Hz hook
 *   _clock         | FrameClock  | now in ms; request/cancel
 *   _running       | boolean     | rAF armed
 *   _paused        | boolean     | step gated
 *   _lastMs        | number      | previous frame timestamp (ms)
 *   _syncAcc       | number      | seconds accumulated toward sidecar
 *   _rafId         | number      | handle for cancel
 *
 * Frame:
 *   dt = min((now - last) / 1000, BALANCE.loop.maxFrameDt)
 *   last = now
 *   if !paused: step(dt)
 *   syncAcc += dt; if syncAcc >= 1/sidecarHz: syncAcc = 0; sidecar?.()
 *   request next frame
 *
 * start() sets lastMs = clock.now() before the first request so dt₀ is ~0.
 * setPaused(false) also resets lastMs = clock.now() (no catch-up burst).
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. start() schedules rAF (or the injected clock.request). stop() cancels
 *       it and leaves running === false. start after stop works again.
 *   R2. Each frame dt passed to step is in seconds and never exceeds
 *       BALANCE.loop.maxFrameDt (POC-1 MAX_FRAME_DT = 0.05).
 *   R3. While paused, step is not invoked; rAF / clock.request still fires.
 *   R4. Unpausing does not deliver a catch-up dt: the first step after
 *       unpause sees a frame-sized dt, not wall-clock-while-paused.
 *   R5. sidecar fires at ~BALANCE.loop.sidecarHz (POC-1 SYNC_INTERVAL = 0.066)
 *       while running, including while paused. It is not called from step.
 *   R6. The loop never allocates on the frame path (no new closures, arrays,
 *       or objects inside the rAF callback).
 *   R7. Memory: created-once. stop() must reach the pending rAF cancel.
 *       No GPU, no DOM. No dispose beyond stop().
 *   R8. Per-frame allocation: none.
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      N/A — no visual. The injected step owns render.
 * Inheritance: N/A (pure logic)
 * syncRender writes: N/A
 * Never writes: gameplay state
 * Scene ownership: N/A — G03 owns the scene; this owns the clock
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 * New A01 section (declare here, add to SDD-A01):
 *
 *   BALANCE.loop.maxFrameDt   = 0.05     // seconds. POC-1 MAX_FRAME_DT.
 *                                        // a 2 s tab-hide becomes one 50 ms step
 *                                        // so the ship does not teleport
 *   BALANCE.loop.sidecarHz    = 15       // debugger two-way sync. POC-1 used
 *                                        // SYNC_INTERVAL = 0.066 ≈ 15.15 Hz
 *
 * Feel:      the sim is stable under hitches (pillar 4 / RUL-13). Pause is a
 *            freeze, not a teardown — unpause continues the same run with no
 *            motion jump (G11, RUL-04). Debugger readouts stay live at ~15 Hz
 *            so tuning during pause still works.
 * Leveling:  N/A.
 * Graphics:  N/A — the loop does not draw.
 * Pillars:   4 (legibility / frame-stability). Serves RUL-01 (loop) and RUL-13
 *            (worst-case stays frame-stable).
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/core/game-loop.test.ts
 * Runner: vitest
 * Mocks: injected FrameClock (fake timers / manual now + request queue).
 *        BALANCE.loop stub { maxFrameDt: 0.05, sidecarHz: 15 } or the real
 *        A01 values once balancer exists.
 *
 * describe('GameLoop')
 *   it('start schedules a frame and stop cancels it')                        // R1
 *   it('clamps dt to maxFrameDt 0.05 on a long hitch')                       // R2, RUL-01
 *   it('passes dt in seconds, not milliseconds')                             // R2
 *   it('does not call step while paused but keeps requesting frames')        // R3, G11
 *   it('does not catch up dt after unpause')                                 // R4, G11
 *   it('invokes sidecar at ~15 Hz even while paused')                        // R5
 *   it('does not allocate inside the frame callback')                        // R6, R8, RUL-13
 *   it('stop cancels the pending frame so step is not called after stop')    // R7
 *   it('records last timestamp on start so the first dt is not a hitch')     // port fidelity
 *
 * Manual:
 *   A-manual-1. [manual] hide the tab for 2 s, return: ship must not jump
 *               (dt clamp).
 *   A-manual-2. [manual] Esc pause / unpause: field frozen, then continues
 *               with no burst (G11 play-check; gate lives here).
 *
 * Coverage: R1–R8 + card Acceptance (frame-stable; pause halts step without
 *           stopping rAF) + RUL-01 + RUL-13.
 */
