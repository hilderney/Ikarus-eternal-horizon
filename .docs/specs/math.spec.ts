/**
 * #tag/arch #tag/memory
 *
 * Card:         SDD-A03 Math
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: all, RUL-13
 * Change type:  new
 * POC-1 origin: none (new) — extracts inline math from poc/src/systems/followCamera.ts,
 *               poc/src/gameobjects/shot.ts, poc/src/gameobjects/cameraRig.ts,
 *               poc/src/gameobjects/parallax.ts  — frozen reference only
 * Test file:    poc2/src/core/math.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      Stateless numeric helpers used on every hot path: clamp, lerp,
 *            damp, DEG2RAD, distXZ, decayFactor, and three scratch Vector3s
 *            reused in-place. Pure functions, no class, no BALANCE reads.
 * Does not own: gameplay numbers (A01), camera/ship integration (B01/C02),
 *            shot lifetime (D01 consumes decayFactor), or any THREE mesh.
 * Player-facing: wrong decay steps make the laser look like it randomly
 *            weakens; scratch-vector reuse bugs teleport objects.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Upstream: none. Three.js is already a Stage A dependency (scratch Vector3).
 * Downstream:
 *   SDD-B01 GameCamera — DEG2RAD for euler
 *   SDD-B02 Parallax — scratch vectors, wrap math
 *   SDD-B03 LimitBox — clamp, damp (bounce settle)
 *   SDD-C02 Controller — clamp on speed
 *   SDD-D01 WeaponShot — decayFactor for opacity and effectiveDamage
 *   SDD-F01 CollisionManager — distXZ
 *   SDD-F05 VfxManager — damp on shake
 */

// ─── 9. Agent sign-off ───────────────────────────────────────────────────────
/**
 * Orchestrator : hub-v4.1 / 2026-08-17  scope, requires, DoD
 * Programming  : hub-v4.1 / 2026-08-17  contract, scratch reuse, zero alloc
 * Game Design  : hub-v4.1 / 2026-08-17  decay steps = laser damage readability
 * TDD          : hub-v4.1 / 2026-08-17  cases named; test file not yet written (red next)
 * Status: spec-complete
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Programming / Three.js
// ═════════════════════════════════════════════════════════════════════════════

import type { Vector3 } from 'three'

/** Degrees → radians. `Math.PI / 180`. */
export declare const DEG2RAD: number

/** Inclusive clamp. */
export declare function clamp(v: number, min: number, max: number): number

/** Linear interpolate. t is not clamped. */
export declare function lerp(a: number, b: number, t: number): number

/**
 * Exponential damp toward target.
 * `current + (target - current) * (1 - Math.exp(-lambda * dt))`.
 * Matches POC-1 followCamera `settle`. lambda is the rate (1/s).
 */
export declare function damp(current: number, target: number, lambda: number, dt: number): number

/** Planar distance on XZ. `Math.hypot(ax - bx, az - bz)`. */
export declare function distXZ(ax: number, az: number, bx: number, bz: number): number

/**
 * Laser (and shot) damage/opacity factor from normalised elapsed time in [0, 1].
 *   elapsed <= 0.25 → 1
 *   elapsed <= 0.50 → 0.75
 *   elapsed <= 0.75 → 0.5
 *   else            → 0.25
 * Callers map `1 - lifetime/totalLifetime` (or `dist/range`) into elapsed.
 */
export declare function decayFactor(elapsed: number): number

/**
 * Module-level scratch Vector3s. Created once. Callers must not retain a
 * reference across frames or across helper calls — contents are overwritten.
 */
export declare const scratchV3A: Vector3
export declare const scratchV3B: Vector3
export declare const scratchV3C: Vector3

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   symbol        | type     | meaning / unit / range
 *   --------------|----------|-----------------------------------------------
 *   DEG2RAD       | number   | π/180, dimensionless
 *   clamp         | fn       | returns [min, max]
 *   lerp          | fn       | a + (b-a)*t
 *   damp          | fn       | exp smoothing; dt in seconds, lambda in 1/s
 *   distXZ        | fn       | world units on the play plane
 *   decayFactor   | fn       | {1, 0.75, 0.5, 0.25} from elapsed
 *   scratchV3A..C | Vector3  | reused; never `new Vector3()` on a hot path
 *
 * No class. No update / syncRender / dispose. This module is functions + consts.
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. clamp(v, min, max) returns min when v < min, max when v > max, else v.
 *   R2. lerp(a, b, 0) === a; lerp(a, b, 1) === b; lerp(a, b, 0.5) === (a+b)/2.
 *   R3. damp(current, current, λ, dt) === current; damp moves toward target
 *       and never overshoots for λ > 0, dt > 0.
 *   R4. DEG2RAD * 180 === Math.PI (within float epsilon).
 *   R5. distXZ is the 2D hypot on X/Z and ignores Y.
 *   R6. decayFactor: elapsed <= 0.25 → 1; <= 0.5 → 0.75; <= 0.75 → 0.5; else 0.25.
 *       Boundaries 0.25 / 0.5 / 0.75 sit on the higher rung (inclusive upper).
 *   R7. Memory: created-once (module consts). Scratch Vector3s are the same
 *       instances for the life of the module. No dispose.
 *   R8. Per-frame allocation: none. None of the functions allocate. Callers
 *       that need a Vector3 use scratchV3A/B/C, never `new`.
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      N/A — no visual
 * Inheritance: N/A (pure functions)
 * syncRender writes: N/A
 * Never writes: N/A
 * Scene ownership: N/A
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 * N/A for motion feel — these are unitless helpers. Numbers they consume
 * (bounce.timeMs, maxSpeed, …) belong to the calling card's BALANCE block.
 *
 * The one designed curve:
 *   decayFactor 25% steps over normalised lifetime
 *     0.00–0.25 → 1.00   // bolt is full damage and full opacity
 *     0.25–0.50 → 0.75
 *     0.50–0.75 → 0.50
 *     0.75–1.00 → 0.25   // readable fade, never 0 (still a threat)
 *
 * Feel:      the laser does not "die" — it steps down in four readable
 *            rungs. Opacity and effectiveDamage share this factor (D01).
 *            That is the damage-at-range readability of pillar 4.
 * Leveling:  N/A here. D02 laser levels change shot count/spread, not this curve.
 * Graphics:  opacity = decayFactor; the player reads remaining punch from
 *            brightness in <0.3 s.
 * Pillars:   4 (legibility at high speed) — decay is the laser damage readability.
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/core/math.test.ts
 * Runner: vitest
 * Mocks: none — pure functions. THREE.Vector3 is real (three is a Stage A dep).
 *
 * describe('math')
 *   it('clamps below min, above max, and passes through the interior')       // R1
 *   it('lerps endpoints and midpoint')                                       // R2
 *   it('damps toward target without overshooting')                           // R3
 *   it('exports DEG2RAD as PI/180')                                          // R4
 *   it('distXZ ignores Y and matches hypot(dx, dz)')                         // R5
 *   it('decayFactor is 1 at elapsed 0 and 0.25')                             // R6
 *   it('decayFactor is 0.75 at elapsed 0.26 and 0.5')                        // R6
 *   it('decayFactor is 0.5 at elapsed 0.51 and 0.75')                        // R6
 *   it('decayFactor is 0.25 at elapsed 0.76 and 1')                          // R6
 *   it('scratchV3A/B/C are stable Vector3 identities across calls')          // R7, Acceptance
 *   it('clamp/lerp/damp/distXZ/decayFactor do not allocate')                 // R8, RUL-13
 *
 * Manual:
 *   A-manual-1. [manual] N/A — fully unit-testable.
 *
 * Coverage: R1–R8 + card Acceptance ("exported vectors are scratch").
 */
