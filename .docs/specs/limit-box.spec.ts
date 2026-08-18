/**
 * #tag/arch #tag/controls #tag/memory
 *
 * Card:         SDD-B03 LimitBox
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: RUL camera
 * Change type:  merge + class-ify
 * POC-1 origin: poc/src/gameobjects/followBox.ts + poc/src/systems/followCamera.ts
 *               — frozen reference
 * Test file:    poc2/src/gameobjects/limit-box/limit-box.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      `class LimitBox` — merge of POC-1 followBox (visual dead-zone)
 *            and followCamera (per-axis bounce + auto-recenter). The box
 *            keeps the camera centered on the ship: inside the halfX/halfZ
 *            the camera stays put; on the edge it eases with bounce; when
 *            the ship idles, each axis recenters toward the Recenter Point.
 * Does not own: the camera object (B01 mounts it; this writes XZ onto the
 *            shared CameraConfig / camera position), ship motion (C02),
 *            or debugger widgets (G08).
 * Player-facing: a camera that slides while the ship is inside the box, or
 *            that refuses to recenter when the ship parks, feels drunk.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Upstream:
 *   SDD-A01 Balancer — BALANCE.ship.follow + ship.followBox
 *   SDD-A03 Math — clamp, damp (bounce settle), DEG2RAD unused
 *   SDD-B01 Camera — CameraConfig.position.x/z written by this class
 * Downstream:
 *   SDD-C02 Controller — ship position is the input; this does not read keys
 *   SDD-G03 RunScene — constructs / disposes (D14)
 *   SDD-G08 Debugger — live halfX/halfZ / bounce / recenter / restLine
 */

// ─── 9. Agent sign-off ───────────────────────────────────────────────────────
/**
 * Orchestrator : hub-v4.1 / 2026-08-17  scope, requires, DoD
 * Programming  : hub-v4.1 / 2026-08-17  contract, per-axis state, visuals
 * Game Design  : hub-v4.1 / 2026-08-17  follow + restLine numbers from POC-1
 * TDD          : hub-v4.1 / 2026-08-17  cases named; test file not yet written (red next)
 * Status: spec-complete
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Programming / Three.js
// ═════════════════════════════════════════════════════════════════════════════

export interface Vec3Params {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface BounceConfig {
  readonly timeMs: number
}

export interface RecenterConfig {
  readonly delayMs: number
  readonly stillMs: number
  readonly accel: number
  readonly maxSpeed: number
}

export interface FollowConfig {
  readonly halfX: number
  readonly halfZ: number
  readonly bounce: BounceConfig
  readonly recenter: RecenterConfig
}

export interface FollowBoxVisualConfig {
  readonly color: number
  readonly opacity: number
  readonly position: Vec3Params
  readonly centerLine: { readonly color: number; readonly opacity: number }
  readonly restLine: {
    readonly color: number
    readonly opacity: number
    readonly position: Vec3Params
    readonly width: number
    readonly height: number
  }
}

export interface LimitBoxOptions {
  readonly follow: FollowConfig
  readonly visual: FollowBoxVisualConfig
  /** Shared with GameCamera — this class writes position.x / position.z. */
  readonly cameraConfig: { position: { x: number; y: number; z: number } }
}

export interface ShipPosition {
  readonly x: number
  readonly z: number
}

export interface LimitBoxPort {
  update(ship: ShipPosition, dt: number): void
  syncRender(): void
  setVisible(visible: boolean): void
  dispose(): void
}

export declare class LimitBox implements LimitBoxPort {
  constructor(options: LimitBoxOptions)

  /** World XZ of the box centre (anchor). */
  readonly anchor: { x: number; z: number }

  /**
   * Per-axis bounce + recenter. Writes cameraConfig.position.x/z by the
   * delta of the anchor. Does not write camera.y or rotation.
   */
  update(ship: ShipPosition, dt: number): void

  /**
   * Writes LineLoop corners, centerLine, restLine from anchor + halfX/halfZ
   * + restLine.position. Rest Z = anchor.z + halfZ + restLine.position.z
   * (Z measured from the base edge). Rest X = anchor.x + restLine.position.x.
   */
  syncRender(): void

  setVisible(visible: boolean): void
  dispose(): void
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   field            | type        | meaning / unit / range
 *   -----------------|----------------|--------------------------------------
 *   anchor           | {x,z}          | box centre, world XZ
 *   _axisX / _axisZ  | AxisState      | independent (R4)
 *   AxisState        |                | centering, interrupted, velocity,
 *                    |                | delayMs, stillMs, last, anchor
 *   loop             | THREE.LineLoop | dead-zone rectangle
 *   centerLine       | THREE.Line     | Z spine of the box
 *   restLine         | THREE.LineSegments | Recenter Point cross
 *
 * Per axis, POC-1 followCamera (port this):
 *   MOVE_EPS = 0.01, CENTER_EPS = 0.25  (implementation tolerances, not BALANCE)
 *   moving = |ship - last| > MOVE_EPS
 *   bounce settleRate = -ln(0.02) / (bounce.timeMs / 1000)
 *   If NOT centering: anchor = damp(anchor, edgeTarget(ship, anchor, half), rate, dt)
 *   rest = ship - restOffset
 *     restOffset.x = restLine.position.x
 *     restOffset.z = restLine.position.z + halfZ     // Z from base edge
 *   If centering: movement interrupts (centering=false, interrupted=true,
 *     velocity=0). Else accelerate toward rest, clamp |v| to
 *     min(maxSpeed, |err|*5), stop when |err| < CENTER_EPS.
 *   If interrupted: stillMs accumulates while idle; at stillMs, clear interrupt.
 *   If !centering && !interrupted && |err| > CENTER_EPS: delayMs accumulates
 *     while idle; at delayMs, enter centering. Motion zeros delayMs.
 *
 * R1: edge follow (the damp-to-edgeTarget) is skipped while centering on
 *     that axis — `if (!state.centering) { settle edge }`.
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. Edge-follow is suspended on an axis while that axis is centering.
 *   R2. Inside the box (|ship - anchor| <= half on both axes) and not
 *       centering, the camera XZ does not move.
 *   R3. Crossing an edge eases the anchor with bounce.timeMs settle — not a
 *       snap. The camera XZ tracks the anchor delta.
 *   R4. X and Z are independent: interrupting X does not interrupt Z.
 *   R5. Recenter Point: rest X = anchor.x + restLine.position.x;
 *       rest Z = anchor.z + halfZ + restLine.position.z (from the base edge).
 *   R6. Auto-recenter starts after delayMs of idling off the rest point;
 *       uses accel / maxSpeed; movement interrupts; interrupted axes wait
 *       stillMs of idling before they may delay again.
 *   R7. Memory: created-once. dispose must reach: LineLoop, center Line,
 *       rest LineSegments — each geometry + material. RunScene removes from
 *       the scene (or this.dispose does scene-safe GPU free; owner removes).
 *   R8. Per-frame allocation: none in update / syncRender. Corner buffers
 *       are the construct-time Float32Arrays with needsUpdate = true.
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      THREE.LineLoop (box) + THREE.Line (center) + THREE.LineSegments
 *              (rest cross). LineBasicMaterial, transparent, frustumCulled false.
 *              Colours / opacities from BALANCE.ship.followBox.
 * Inheritance: composition
 * syncRender writes: the three geometry position attributes (world XZ, y from
 *                    visual.position.y)
 * Never writes: AxisState, ship position, camera rotation / y
 * Scene ownership: RunScene (D14)
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 * Port from POC-1 (do not retune until a playtest says so):
 *
 *   BALANCE.ship.follow.halfX              = 6
 *   BALANCE.ship.follow.halfZ              = 8
 *   BALANCE.ship.follow.bounce.timeMs      = 500
 *   BALANCE.ship.follow.recenter.delayMs   = 1500
 *   BALANCE.ship.follow.recenter.stillMs   = 800
 *   BALANCE.ship.follow.recenter.accel     = 3
 *   BALANCE.ship.follow.recenter.maxSpeed  = 12
 *
 *   BALANCE.ship.followBox.position        = { x: 0, y: 0, z: -3 }  // initial anchor
 *   BALANCE.ship.followBox.color           = 0xf0ab4a
 *   BALANCE.ship.followBox.opacity         = 0.1
 *   BALANCE.ship.followBox.centerLine      = { color: 0x50e3c2, opacity: 0.1 }
 *   BALANCE.ship.followBox.restLine.color  = 0x2d6bff
 *   BALANCE.ship.followBox.restLine.opacity= 0.9
 *   BALANCE.ship.followBox.restLine.position = { x: 0, y: 0, z: -1 }
 *       // X relative to box centre; Z from the BASE EDGE
 *       // (anchor.z + halfZ + z) → with halfZ 8, rest sits 7 units forward of centre
 *   BALANCE.ship.followBox.restLine.width  = 2
 *   BALANCE.ship.followBox.restLine.height = 4
 *
 * Feel:      fly around inside a generous dead-zone with no camera motion;
 *            kiss an edge and the world eases (500 ms bounce), never snaps;
 *            park and after 1.5 s the camera slides the Recenter Point onto
 *            the ship; twitch to cancel. Same as POC-1.
 * Leveling:  N/A. Hull slowdown (C03) changes how fast the ship reaches the
 *            edge; the box numbers stay put.
 * Graphics:  amber box, teal spine, blue rest cross. Debug-visible; gameplay
 *            does not depend on seeing them. Pillar 4: the playfield reads
 *            as a stable stage, not a chasing camera.
 * Pillars:   1 (the box is the readable "safe stage") and 4 (no camera pop).
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/gameobjects/limit-box/limit-box.test.ts
 * Runner: vitest
 * Mocks: real THREE line objects (or a thin stub). BALANCE.ship.follow +
 *        followBox slice. cameraConfig = { position: { x:0, y:14, z:6 } }.
 *
 * describe('LimitBox')
 *   it('does not move the camera while the ship stays inside the box')       // R2, Acceptance
 *   it('eases the camera when the ship crosses an edge (bounce, not snap)')  // R3, Acceptance
 *   it('suspends edge-follow on an axis while that axis is centering')       // R1
 *   it('treats X and Z interrupts independently')                            // R4
 *   it('places rest Z at anchor.z + halfZ + restLine.position.z')            // R5
 *   it('places rest X at anchor.x + restLine.position.x')                    // R5
 *   it('starts recenter after delayMs of idle off the rest point')           // R6, Acceptance
 *   it('interrupts recenter when the ship moves on that axis')               // R6, Acceptance
 *   it('waits stillMs after interrupt before delay can start again')         // R6
 *   it('uses halfX 6, halfZ 8, bounce 500, delay 1500, still 800, accel 3')  // port
 *   it('uses restLine.position {0,0,-1}')                                    // port
 *   it('syncRender writes loop / center / rest without allocating')          // R8
 *   it('dispose frees the three geometries and materials')                   // R7
 *
 * Manual:
 *   A-manual-1. [manual] fly inside the box: camera still; kiss the edge:
 *               ease; stop: recenter to the blue cross; twitch: cancel.
 *
 * Coverage: R1–R8 + card Acceptance (navigate without camera move; edge
 *           bounce; idle recenter; movement interrupts) + port fidelity.
 */
