/**
 * #tag/arch #tag/controls
 *
 * Card:         SDD-B01 Camera
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: RUL render
 * Change type:  class-ify
 * POC-1 origin: poc/src/gameobjects/cameraRig.ts  — frozen reference
 * Test file:    poc2/src/gameobjects/camera/game-camera.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      `class GameCamera` — the viewing rig. Mounts a
 *            `THREE.PerspectiveCamera` (`rotation.order = 'YXZ'`), applies
 *            BALANCE.camera through `applyConfig` (fov / near / far /
 *            position / rotation in degrees), and exposes the camera for
 *            the renderer, gizmos, and HUD projectors.
 * Does not own: follow / dead-zone motion (SDD-B03 LimitBox writes the
 *            camera's world XZ), parallax (B02 reads the camera), gizmos
 *            (B04), screen shake application (Q11: F05 computes, B01 may
 *            apply later — not this card), or the WebGLRenderer (G09).
 * Player-facing: framing that hides the ship's silhouette, a rolled horizon,
 *            or a clipped nose all break "top + right + rear" readability.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Upstream:
 *   SDD-A01 Balancer — BALANCE.camera + layout.playfield for aspect
 *   SDD-A03 Math — DEG2RAD
 * Downstream:
 *   SDD-B02 Parallax — reads camera.position each frame
 *   SDD-B03 LimitBox — mutates camera world XZ via applyConfig / position
 *   SDD-B04 Gizmos — copies camera matrix onto camera-axes sprites
 *   SDD-G03 RunScene — constructs / disposes (D14)
 *   SDD-G07 HUD — world→screen project
 *   SDD-G09 Renderer — render(scene, camera)
 */

// ─── 9. Agent sign-off ───────────────────────────────────────────────────────
/**
 * Orchestrator : hub-v4.1 / 2026-08-17  scope, requires, DoD
 * Programming  : hub-v4.1 / 2026-08-17  contract, YXZ, applyConfig, dispose
 * Game Design  : hub-v4.1 / 2026-08-17  DYNAMIC VIEW numbers from POC-1
 * TDD          : hub-v4.1 / 2026-08-17  cases named; test file not yet written (red next)
 * Status: spec-complete
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Programming / Three.js
// ═════════════════════════════════════════════════════════════════════════════

import type * as THREE from 'three'

export interface Vec3Params {
  readonly x: number
  readonly y: number
  readonly z: number
}

/** Construction / applyConfig payload. Rotation is DEGREES. Traces to BALANCE.camera. */
export interface CameraConfig {
  readonly fov: number
  readonly position: Vec3Params
  readonly rotation: Vec3Params
  readonly near: number
  readonly far: number
  readonly aspect: number
}

export interface GameCameraPort {
  readonly camera: THREE.PerspectiveCamera
  applyConfig(config: CameraConfig): void
  syncRender(): void
  dispose(): void
}

/**
 * Mounts (does not extend) PerspectiveCamera — hub §3 / phase-0-poc2 §3.
 * The domain object owns the camera; the camera is the visual.
 */
export declare class GameCamera implements GameCameraPort {
  constructor(config: CameraConfig)

  readonly camera: THREE.PerspectiveCamera

  /**
   * Writes fov/near/far/aspect, updateProjectionMatrix, position, and
   * euler (degrees × DEG2RAD, order YXZ) onto the mounted camera.
   * Also stores the config so syncRender can re-apply.
   */
  applyConfig(config: CameraConfig): void

  /** Logic: none this card. LimitBox / Controller mutate the stored config. */
  update(_dt: number): void

  /** Writes the stored config onto the PerspectiveCamera. No rules. */
  syncRender(): void

  /** Does not dispose the camera's GPU (PerspectiveCamera has none). */
  dispose(): void
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   field     | type                   | meaning / unit / range
 *   ----------|------------------------|------------------------------------
 *   camera    | PerspectiveCamera      | mounted visual; order YXZ
 *   _config   | CameraConfig           | last applied (degrees)
 *
 * applyConfig:
 *   camera.fov/near/far/aspect ← cfg; camera.updateProjectionMatrix()
 *   camera.position.set(cfg.position.x, y, z)
 *   camera.rotation.set(cfg.rotation.x * DEG2RAD, y * DEG2RAD, z * DEG2RAD)
 *   constructor calls applyConfig(config) after setting rotation.order = 'YXZ'.
 *
 * Scene add/remove is D14: RunScene adds `camera` to the scene (or not —
 * PerspectiveCamera need not live in the graph to render). POC-1 did
 * scene.add(camera). Match that: constructor does not add; RunScene does.
 * dispose is a no-op on GPU and does not scene.remove (the owner does).
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. camera is a THREE.PerspectiveCamera. rotation.order === 'YXZ'.
 *   R2. applyConfig writes fov, near, far, aspect and calls
 *       updateProjectionMatrix().
 *   R3. applyConfig writes position in world units from cfg.position.
 *   R4. applyConfig writes rotation in radians = cfg.rotation degrees × DEG2RAD.
 *   R5. Default config (BALANCE.camera + playfield aspect) yields DYNAMIC VIEW:
 *       fov 85, position {3,14,6}, rotation {-55,24,-14} deg, near 5, far 10000,
 *       aspect 540/960.
 *   R6. Framing invariant: from that pose the ship at origin is seen from
 *       above, starboard, and aft (top + right + rear). Tested as euler/pos
 *       equality plus a [manual] silhouette check.
 *   R7. Memory: created-once. PerspectiveCamera allocates no geometry.
 *       dispose is safe to call; no leaked listeners.
 *   R8. Per-frame allocation: none in applyConfig / syncRender / update.
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      THREE.PerspectiveCamera · no mesh · no material
 * Inheritance: composition — mounts PerspectiveCamera (does not extend it)
 * syncRender writes: camera.fov, near, far, aspect, projection matrix,
 *                    position, rotation
 * Never writes: follow-anchor / ship transform (B03 / C01)
 * Scene ownership: RunScene (D14) adds/removes the camera
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 * Port from POC-1 DYNAMIC VIEW (do not retune until a playtest says so):
 *
 *   BALANCE.camera.fov          = 85
 *   BALANCE.camera.position     = { x: 3, y: 14, z: 6 }
 *   BALANCE.camera.rotation     = { x: -55, y: 24, z: -14 }   // degrees
 *   BALANCE.camera.near         = 5
 *   BALANCE.camera.far          = 10000
 *   BALANCE.layout.playfield    = { width: 540, height: 960 } // aspect 0.5625
 *
 * Cockpit / top-view presets in POC-1 balancer.ts are comments only — not
 * this card. Debugger (G08) may live-edit the same config object.
 *
 * Feel:      a 2.5D shmup read — the ship sits low in frame, playfield
 *            stretching away, starboard flank and engines visible. Matches
 *            POC-1 DYNAMIC VIEW exactly.
 * Leveling:  N/A.
 * Graphics:  near 5 keeps the near-plane off the hull; far 10000 holds the
 *            parallax zFar -2000. Pillar 4: silhouette readable <0.3 s.
 * Pillars:   4 (legibility). Framing rule: always show top, right, rear.
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/gameobjects/camera/game-camera.test.ts
 * Runner: vitest
 * Mocks: real THREE.PerspectiveCamera (three is a Stage A dep). BALANCE.camera
 *        slice or a literal CameraConfig matching the numbers below.
 *
 * describe('GameCamera')
 *   it('mounts a PerspectiveCamera with rotation.order YXZ')                 // R1
 *   it('applyConfig writes fov, near, far, aspect and updates projection')   // R2
 *   it('applyConfig writes world position from config.position')             // R3
 *   it('applyConfig converts rotation degrees through DEG2RAD')              // R4
 *   it('defaults to fov 85 at {3,14,6} / {-55,24,-14} deg, near 5 far 10000')// R5, port
 *   it('uses playfield aspect 540/960')                                      // R5
 *   it('applyConfig / syncRender allocate nothing per call')                 // R8
 *   it('dispose is safe and does not throw')                                 // R7
 *
 * Manual:
 *   A-manual-1. [manual] default pose shows the ship's top, right side and
 *               rear (card Acceptance / R6).
 *
 * Coverage: R1–R8 + card Acceptance ("ship visible and readable in default
 *           camera") + port fidelity vs POC-1 DYNAMIC VIEW.
 */
