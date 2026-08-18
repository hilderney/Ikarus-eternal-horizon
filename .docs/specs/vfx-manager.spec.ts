/**
 * #tag/arch #tag/memory
 *
 * Card:         SDD-F05 VfxManager
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: RUL-13
 * Change type:  new
 * POC-1 origin: none (new)
 * Test file:    poc2/src/systems/vfx-manager.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      Pooled feedback for F04 events — wireframe bursts (enemy/meteor/ship),
 *            hit flash on the target, screen-shake **offset** (capped), hit-stop of
 *            a few frames via A04's pause gate (never sleep), hull damage vignette,
 *            and dual-rumble presets via `InputPort.rumble` (D18).
 *            Q11: this class **computes** the shake offset; B01 **applies** it to
 *            the camera.
 * Does not own: damage (F04), camera transform (B01), the game loop (A04 — we only
 *            request freeze frames), score popups (G10/G07), Gamepad API (A02).
 * Player-facing: kills pop, hits flash, the world shudders a little, never so much
 *            that silhouettes smear. Worst case (Mega + full wave) stays readable
 *            and frame-stable (RUL-13).
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-A01 Balancer — BALANCE.vfx.shake.maxAmplitude 0.18, hitStopFrames 3, haptics.presets
 *   SDD-A02 Input    — rumble(preset); no-op when no actuator
 *   SDD-A03 Math     — damp, clamp, scratch
 *   SDD-A04 GameLoop — pause / hit-stop gate (not sleep)
 *   SDD-A05 ObjectPool<T> — burst particles
 *   SDD-F04 DamageResolver — event subscription
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-B01 GameCamera — reads shakeOffset each frame (Q11)
 *   SDD-G03 RunScene   — construct / dispose / overlay root for vignette
 *   SDD-G07 HUD        — must not duplicate hit flash
 */

// ─── 9. Agent sign-off ───────────────────────────────────────────────────────
/**
 * Orchestrator : hub-v4.2 / 2026-08-17  rumble consumer, D18
 * Programming  : hub-v4.2 / 2026-08-17  HapticPort, map event kind → preset
 * Game Design  : hub-v4.2 / 2026-08-17  shield tick vs hull kick vs destroy
 * TDD          : hub-v4.2 / 2026-08-17  cases named; test file not yet written (red next)
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
 * Lib: Three.js (pooled Points / LineSegments bursts) + HTML/CSS (vignette overlay).
 */

export interface Vec3Scratch {
  x: number
  y: number
  z: number
}

export interface HitStopPort {
  /** Freeze GameLoop.step for `frames` rAF ticks. Must not sleep the thread. */
  freeze(frames: number): void
}

export interface DamageEventLike {
  readonly kind: 'shieldHit' | 'hullHit' | 'shieldBroke' | 'killed' | 'destroyed'
  readonly amount: number
  readonly x?: number
  readonly z?: number
}

export interface HapticPort {
  rumble(preset: 'shieldHit' | 'hullHit' | 'shieldBreak' | 'destroyed' | 'fireLaser'): void
}

export interface VfxManagerOptions {
  readonly loop: HitStopPort
  readonly haptics: HapticPort
  readonly burstPool: { acquire(): BurstPort | null; release(b: BurstPort): void; forEachActive(fn: (b: BurstPort) => void): void; dispose(): void }
  readonly vignetteEl: HTMLElement | null
}

export interface BurstPort {
  activate(x: number, z: number, scale: number, color: number): void
  update(dt: number): void
  syncRender(): void
  active: boolean
  dispose(): void
}

export declare class VfxManager {
  constructor(options: VfxManagerOptions)

  /** Q11: B01 adds this to the camera; F05 never writes camera.position. */
  readonly shakeOffset: Vec3Scratch
  handle(event: DamageEventLike): void
  update(dt: number): void
  syncRender(): void
  dispose(): void
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   field        | type     | meaning / unit / range
 *   -------------|----------|-----------------------
 *   shakeOffset  | vec3     | computed, capped; B01 applies (Q11)
 *   shakeAmp     | world    | current amplitude, ≤ BALANCE.vfx.shake.maxAmplitude
 *   vignette     | 0..1     | hullHit raises; decays per second
 *   burstPool    | pool     | wireframe explosion slots
 *
 *   handle(killed|destroyed) — acquire burst at event x,z; bump shake; hit-stop
 *                              only on destroyed / killed-of-large (see BALANCE).
 *   handle(hullHit) — flash + vignette; handle(shieldHit) — flash only, smaller shake.
 *   handle(shieldBroke) — rumble('shieldBreak'); handle(destroyed) — rumble('destroyed').
 *   handle(shieldHit) — rumble('shieldHit'); handle(hullHit) — rumble('hullHit').
 *   Enemy/meteor killed does **not** rumble (Q13: hits on the ship, not every kill).
 *   update — decay shakeAmp by BALANCE.vfx.shake.decayPerSec; write shakeOffset
 *            from two sin/cos phases (instance fields, no alloc). Tick bursts.
 *   freeze — loop.freeze(BALANCE.vfx.hitStopFrames) on destroyed; never setTimeout.
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. Every burst comes from the pool; handle() never `new`s a mesh (RUL-13).
 *   R2. shakeOffset magnitude ≤ BALANCE.vfx.shake.maxAmplitude (0.18) at all times.
 *   R3. hit-stop uses HitStopPort.freeze(hitStopFrames) — no sleep, no busy-wait.
 *   R4. hitStopFrames === 3 from BALANCE; freeze is requested on destroyed, not on
 *       every shieldHit.
 *   R5. Q11: this class never assigns GameCamera.position / camera.position.
 *   R6. Vignette opacity tracks hullHit only, clamped to BALANCE.vfx.vignetteMax.
 *   R7. Per-frame allocation: none.
 *   R8. Pool exhaustion skips the burst (no fallback allocate).
 *   R9. dispose releases bursts, clears shakeOffset, resets vignette.
 *   R10. Does not apply damage or write score.
 *   R11. syncRender writes burst transforms/opacity only; shakeOffset is logic state
 *        read by B01 (not a mesh).
 *   R12. handle(shieldHit|hullHit|shieldBroke|destroyed) calls haptics.rumble with
 *        the matching preset. killed (enemy/meteor) does not rumble. Missing
 *        actuator is A02's no-op — this class still calls rumble.
 *   R13. Does not call rumble('fireLaser') (Q13 / E07).
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      pooled THREE.Points or LineSegments wireframe bursts (additive);
 *              HTML overlay for vignette (G03 provides the element)
 * Inheritance: composition (manager ≠ Mesh)
 * syncRender writes: burst position/opacity/scale; vignetteEl.style.opacity
 * Never writes: camera.position (Q11), hp, score
 * Scene ownership: RunScene adds burst meshes via the pool; vignette is DOM
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 * A01 already declared the cap; this card adds the rest (declare on SDD-A01):
 *   BALANCE.vfx.shake.maxAmplitude = 0.18   // hard readability cap (GDD §15)
 *   BALANCE.vfx.shake.decayPerSec  = 4      // settles in ~few tenths of a second
 *   BALANCE.vfx.hitStopFrames      = 3      // "a few frames" — not a freeze-frame
 *   BALANCE.vfx.burstPoolSize      = 24
 *   BALANCE.vfx.burstLifetimeSec   = 0.35
 *   BALANCE.vfx.flashOpacity       = 0.55
 *   BALANCE.vfx.vignetteMax        = 0.45   // hull-only; never blacks out the field
 *   BALANCE.vfx.shakeOn            = { shieldHit: 0.04, hullHit: 0.10, killed: 0.12, destroyed: 0.18 }
 *   BALANCE.haptics.presets        = shieldHit / hullHit / shieldBreak / destroyed / fireLaser
 *
 * Feel:      Juice without lying. A kill pops; a hull hit bruises the frame; a
 *            shield tick is a sparkle not a quake — and a weak-motor buzz. Hull
 *            hits kick the strong motor. Mega+wave must stay readable
 *            (pillar 4) — the cap exists so stacked events cannot add past 0.18.
 * Leveling:  burst scale may read source size later; G0 uses a single scale.
 * Graphics:  wireframe bursts in the victim's tint (enemy rose / meteor ice / ship
 *            cyan). Vignette is crimson, edges only. Silhouettes stay <0.3s readable
 *            during shake.
 * Pillars:   4 legibility · 2 tangible degradation (hull vignette) · 5 kill-feedback.
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/systems/vfx-manager.test.ts
 * Runner: vitest
 * Mocks: HitStopPort, HapticPort, burst ObjectPool, vignette HTMLElement, BALANCE.vfx,
 *        fake DamageEventLike
 *
 * describe('VfxManager')
 *   it('killed acquires a burst from the pool and never news a mesh')                 // R1, RUL-13
 *   it('shakeOffset hypot is always ≤ 0.18 even after stacked destroyed events')      // R2
 *   it('destroyed calls loop.freeze(3) and never setTimeout/sleep')                   // R3, R4
 *   it('shieldHit does not request hit-stop')                                         // R4
 *   it('does not write camera.position (Q11 — offset only)')                          // R5
 *   it('hullHit raises vignette; shieldHit does not')                                 // R6
 *   it('vignette opacity never exceeds vignetteMax')                                  // R6
 *   it('update allocates nothing')                                                    // R7
 *   it('exhausted burst pool skips the spawn (acquire null)')                         // R8
 *   it('dispose zeros shakeOffset and releases bursts')                               // R9
 *   it('does not call DamageSink or ScoreManager')                                    // R10
 *   it('syncRender does not mutate shakeOffset')                                      // R11
 *   it('shieldHit rumbles shieldHit; killed does not rumble')                         // R12, D18
 *   it('destroyed rumbles destroyed')                                                 // R12
 *   it('never rumbles fireLaser')                                                     // R13, Q13
 *   it('killing an enemy shows a burst with no extra allocation (acceptance)')        // card
 *
 * Manual:
 *   A-manual-1. [manual] Mega+wave (or 24 simultaneous kills) stays readable, no smear
 *
 * Coverage: R1–R13 + RUL-13 + Q11 + D18 + card Acceptance.
 */
