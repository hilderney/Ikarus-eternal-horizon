/**
 * #tag/arch #tag/memory
 *
 * Card:         SDD-B04 Gizmos
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: dev tool (no locked requirement; Q09 shipping)
 * Change type:  class-ify
 * POC-1 origin: poc/src/gameobjects/gizmos.ts  — frozen reference
 * Test file:    poc2/src/gameobjects/gizmos/gizmos.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      `class Gizmos` — world axes (X/Y/Z lines + sprite labels), a
 *            playfield GridHelper, and camera axes (cx/cy/cz sprites) that
 *            copy the camera pose each frame. Toggleable. Dev tool only.
 * Does not own: the camera (B01), collision (F01), gameplay, or the
 *            debugger panel that flips the toggle (G08). Q09 decides whether
 *            the Itch build includes this at all (`import.meta.env.DEV`).
 * Player-facing: N/A in a production build. In DEV, leftover gizmos after
 *            toggle-off are visual noise; gizmos that collide would be a bug.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Upstream:
 *   SDD-A01 Balancer — playfield size for the grid (and optional gizmos slice)
 *   SDD-B01 Camera — camera.position / quaternion copied onto camera-axes
 * Downstream:
 *   SDD-G03 RunScene — constructs / disposes (D14)
 *   SDD-G08 Debugger — setEnabled / setVisible toggle (Q09)
 *   SDD-G09 Renderer — Q09 may omit this module from the Itch path
 */

// ─── 9. Agent sign-off ───────────────────────────────────────────────────────
/**
 * Orchestrator : hub-v4.1 / 2026-08-17  scope, requires, DoD
 * Programming  : hub-v4.1 / 2026-08-17  contract, sprites, toggle, dispose
 * Game Design  : hub-v4.1 / 2026-08-17  axis colours, grid, Q09 toggle
 * TDD          : hub-v4.2 / 2026-08-18  gizmos.test.ts green
 * Status: done
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Programming / Three.js
// ═════════════════════════════════════════════════════════════════════════════

import type * as THREE from 'three'

export interface GizmosOptions {
  readonly camera: THREE.Camera
  /** World-XZ grid extent. Traces to BALANCE.gizmos.gridSize (POC-1: 1000). */
  readonly gridSize: number
  readonly gridDivisions: number
  readonly gridColor: number
  readonly gridY: number
  readonly gridOpacity: number
  readonly worldAxisSize: number
  readonly cameraAxisSize: number
}

export interface GizmosPort {
  update(dt: number): void
  syncRender(): void
  setEnabled(enabled: boolean): void
  dispose(): void
}

export declare class Gizmos implements GizmosPort {
  constructor(options: GizmosOptions)

  readonly group: THREE.Group
  readonly enabled: boolean

  /** Logic: none. Tracking the camera is a render concern. */
  update(_dt: number): void

  /**
   * Copies camera world position + quaternion onto the camera-axes child.
   * World axes and the grid stay at the origin / gridY.
   */
  syncRender(): void

  /**
   * Toggle (Q09 / G08). false: group.visible = false. Does not dispose.
   * true: group.visible = true. Never participates in collision either way.
   */
  setEnabled(enabled: boolean): void

  /**
   * Frees every line geometry/material and every sprite CanvasTexture +
   * SpriteMaterial. Owner removes `group` from the scene.
   */
  dispose(): void
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   field         | type         | meaning / unit / range
 *   --------------|--------------|------------------------------------------
 *   group         | THREE.Group  | worldAxes + grid + cameraAxes
 *   _worldAxes    | THREE.Group  | X/Y/Z lines + 'X'/'Y'/'Z' sprites
 *   _grid         | GridHelper   | playfield, y = gridY
 *   _cameraAxes   | THREE.Group  | cx/cy/cz lines + sprites; follows camera
 *   _camera       | THREE.Camera | read-only pose source
 *   enabled       | boolean      | group.visible
 *
 * Axis colours (POC-1): x 0xff4455, y 0x55ff77, z 0x55aaff.
 * Labels: CanvasTexture 128², SpriteMaterial depthWrite false.
 * Lines: LineBasicMaterial opacity 0.1, frustumCulled false.
 * Collision: no Layer, no Raycaster, no onBeforeRender hit. Never added to
 * CollisionManager. meshes/lines are visual-only.
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. The group contains world axes, a playfield grid, and camera axes
 *       with sprite labels (X/Y/Z and cx/cy/cz).
 *   R2. syncRender copies camera.position and camera.quaternion onto the
 *       camera-axes child (POC-1 also updateWorldMatrix(true, false)).
 *   R3. setEnabled(false) hides the group (visible === false) without
 *       removing GPU resources. setEnabled(true) shows it again.
 *   R4. Gizmos never register a collision layer, never implement a hit
 *       radius, and are not passed to CollisionManager.
 *   R5. Q09: construction is the caller's choice (RunScene / DEV flag).
 *       This class always supports toggle; it does not read import.meta.env.
 *   R6. Memory: created-once. dispose must reach every BufferGeometry,
 *       LineBasicMaterial, CanvasTexture, SpriteMaterial, GridHelper
 *       geometry/material.
 *   R7. Per-frame allocation: none in update / syncRender (copy position
 *       and quaternion in place; no clone()).
 *   R8. After dispose, no texture or material this class created remains
 *       undisposed (Acceptance: toggle-off is hide; dispose is the scene
 *       teardown that leaves nothing in the graph — owner also group.remove).
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      THREE.Group
 *                · world axes — Line + Sprite labels
 *                · GridHelper (playfield)
 *                · camera axes — Line + Sprite labels
 * Inheritance: composition
 * syncRender writes: cameraAxes.position, cameraAxes.quaternion
 * Never writes: camera transform, gameplay state
 * Scene ownership: RunScene (D14) adds `group`
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 * Dev-tool numbers. Declare a `BALANCE.gizmos` slice on A01 (or read the
 * playfield / parallax gridSize). POC-1 literals:
 *
 *   BALANCE.gizmos.gridSize        = 1000
 *   BALANCE.gizmos.gridDivisions   = 1000
 *   BALANCE.gizmos.gridColor       = 0x2b6fd8
 *   BALANCE.gizmos.gridY           = -1
 *   BALANCE.gizmos.gridOpacity     = 0          // hidden until G08 raises it
 *   BALANCE.gizmos.worldAxisSize   = 4
 *   BALANCE.gizmos.cameraAxisSize  = 2.2
 *   BALANCE.gizmos.axis.x          = 0xff4455
 *   BALANCE.gizmos.axis.y          = 0x55ff77
 *   BALANCE.gizmos.axis.z          = 0x55aaff
 *   BALANCE.gizmos.lineOpacity     = 0.1
 *
 * Q09: Itch build may omit this class behind `import.meta.env.DEV` (owned
 * by G08/G09). While present, G08 toggles setEnabled.
 *
 * Feel:      N/A for players. For developers: axes and grid make DYNAMIC
 *            VIEW framing and LimitBox edges obvious.
 * Leveling:  N/A.
 * Graphics:  RGB axis convention, low opacity, sprite letters. Must never
 *            compete with the ship silhouette (pillar 4) — default grid
 *            opacity 0, line opacity 0.1.
 * Pillars:   none for the player. Serves the team during B01/B03 tuning.
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/gameobjects/gizmos/gizmos.test.ts
 * Runner: vitest
 * Mocks: real THREE.Camera (or PerspectiveCamera) + Group. BALANCE.gizmos
 *        slice or GizmosOptions literals matching §4. CanvasTexture needs
 *        a document; jsdom or a stubbed document.createElement('canvas').
 *
 * describe('Gizmos')
 *   it('builds world axes, a playfield grid, and camera axes with sprites')  // R1
 *   it('syncRender copies camera position and quaternion onto camera axes')  // R2, Acceptance
 *   it('setEnabled(false) hides the group without disposing textures')       // R3
 *   it('setEnabled(true) shows the group again')                             // R3
 *   it('does not expose a collision layer or hit radius')                    // R4
 *   it('does not read import.meta.env (Q09 is the caller\'s gate)')          // R5
 *   it('dispose disposes line geos/mats and sprite textures/mats')           // R6, R8
 *   it('syncRender does not allocate')                                       // R7
 *   it('uses gridSize 1000, worldAxisSize 4, cameraAxisSize 2.2')            // port
 *
 * Manual:
 *   A-manual-1. [manual] toggle off from the debugger: no axes/grid remain
 *               visible in the scene (card Acceptance).
 *   A-manual-2. [manual] camera fly: camera-axes sprites stay glued to the
 *               camera; world axes stay at the origin.
 *
 * Coverage: R1–R8 + card Acceptance (axes/grid track; toggle-off leaves no
 *           visible object) + Q09 noted as caller-owned.
 */
