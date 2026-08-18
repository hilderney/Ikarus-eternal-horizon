/**
 * #tag/arch #tag/memory
 *
 * Card:         SDD-B02 Parallax
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: RUL render
 * Change type:  split
 * POC-1 origin: poc/src/gameobjects/parallax.ts  — frozen reference
 * Test file:    poc2/src/gameobjects/parallax/parallax.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      `class ParallaxLayer` (one layer: grid + star Points) and
 *            `class ParallaxField` (owns the set of 3). Camera Δ between
 *            frames shifts stars opposite × parallaxGain × per-star jitter.
 *            Layer groups are pinned to the camera position + layer offset.
 *            Own Z flight with wrap at zNearWrap / zFar.
 * Does not own: the camera (B01), limit-box motion that moves the camera
 *            (B03), scene construction (G03 / D14).
 * Player-facing: if all three layers slide at one rate, depth is gone; if
 *            grids detach from the camera, the sky tears.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Upstream:
 *   SDD-A01 Balancer — BALANCE.parallax.layers[]
 *   SDD-A03 Math — DEG2RAD (layer euler), scratch Vector3
 *   SDD-B01 Camera — PerspectiveCamera.position sampled each update
 * Downstream:
 *   SDD-G03 RunScene — constructs / disposes the field (D14)
 *   SDD-G08 Debugger — live applyConfig per layer
 */

// ─── 9. Agent sign-off ───────────────────────────────────────────────────────
/**
 * Orchestrator : hub-v4.1 / 2026-08-17  scope, requires, DoD
 * Programming  : hub-v4.1 / 2026-08-17  contract, Δ-shift, wrap, dispose
 * Game Design  : hub-v4.1 / 2026-08-17  DYNAMIC VIEW three-layer numbers
 * TDD          : hub-v4.2 / 2026-08-18  parallax.test.ts green
 * Status: done
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

export interface ParallaxLayerConfig {
  readonly name: string
  readonly count: number
  readonly speed: number
  readonly speedJitter: number
  readonly parallaxGain: number
  readonly size: number
  readonly color: number
  readonly alpha: number
  readonly position: Vec3Params
  readonly rotation: Vec3Params
  readonly gridSize: number
  readonly gridColor: number
  readonly gridOpacity: number
  readonly zNearWrap: number
  readonly zFar: number
}

export interface ParallaxLayerPort {
  update(dt: number, camera: THREE.PerspectiveCamera): void
  syncRender(): void
  applyConfig(config: ParallaxLayerConfig): void
  dispose(): void
}

/**
 * One layer. Owns a THREE.Group with GridHelper + Points.
 * File: poc2/src/gameobjects/parallax/parallax-layer.ts
 */
export declare class ParallaxLayer implements ParallaxLayerPort {
  constructor(config: ParallaxLayerConfig)

  readonly group: THREE.Group
  readonly name: string

  /**
   * Logic: sample camera Δ, shift star X/Y/Z opposite × gain × speed[i],
   * wrap X/Y in the grid, advance Z by speed * speed[i] * dt, reset stars
   * that pass zNearWrap. First frame records camera pos and applies 0 Δ.
   */
  update(dt: number, camera: THREE.PerspectiveCamera): void

  /**
   * Writes: group.position = camera.position + cfg.position;
   *         group.rotation from cfg.rotation degrees;
   *         position attribute needsUpdate.
   */
  syncRender(): void

  /** Rebuild grid always; rebuild Points only if count changed. */
  applyConfig(config: ParallaxLayerConfig): void

  /** Frees Points geometry/material and GridHelper geometry/material. */
  dispose(): void
}

/**
 * Owns the three layers. File: poc2/src/gameobjects/parallax/parallax-field.ts
 */
export declare class ParallaxField {
  constructor(layers: readonly ParallaxLayerConfig[])

  readonly layers: readonly ParallaxLayer[]

  update(dt: number, camera: THREE.PerspectiveCamera): void
  syncRender(): void
  applyConfig(index: number, config: ParallaxLayerConfig): void
  dispose(): void
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   field        | type          | meaning / unit / range
 *   -------------|----------------|------------------------------------------
 *   group        | THREE.Group    | grid + points; pinned to camera
 *   _cfg         | LayerConfig    | last applied
 *   _positions   | Float32Array   | count * 3, created once
 *   _speeds      | Float32Array   | 1 ± speedJitter per star, created once
 *   _lastCam     | {x,y,z} | flag | previous camera position
 *   points       | THREE.Points   | AdditiveBlending, depthWrite false
 *   grid         | THREE.GridHelper | divisions = max(2, round(gridSize/6))
 *
 * Star shift (POC-1):
 *   pos.x -= camDX * gain * speeds[i]
 *   pos.y -= camDY * gain * speeds[i]
 *   pos.z -= camDZ * gain * speeds[i]
 *   pos.z += speed * speeds[i] * dt
 * Wrap X at ± gridSize/2 by ± gridSize; wrap Y at ± gridSize*0.25 by ± gridSize*0.5.
 * Reset when pos.z > zNearWrap: randomize inside the box [zNearWrap, zFar].
 *
 * ParallaxField.update/syncRender/dispose iterate layers. Length is 3.
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. ParallaxField constructs exactly 3 layers from BALANCE.parallax.layers
 *       (background_stars, solar_system, debris) in that order.
 *   R2. Camera Δ shifts stars opposite the camera, scaled by parallaxGain *
 *       per-star speed[i]. A camera that does not move produces 0 parallax
 *       shift (first frame included).
 *   R3. The layer group is pinned to camera.position + cfg.position every
 *       syncRender. Grids therefore travel with the camera.
 *   R4. Three distinct parallaxGain / speed pairs: the player can read three
 *       depths at a glance. Values are the DYNAMIC VIEW set in §4, not the
 *       hub's outdated 0.15→0.09→0.03 note.
 *   R5. Stars wrap in X/Y on the grid and recycle on Z when they pass zNearWrap.
 *   R6. applyConfig updates material color/size/opacity without allocating
 *       when count is unchanged; count change rebuilds the buffer.
 *   R7. Memory: created-once per layer. dispose must reach: Points geometry,
 *       PointsMaterial, GridHelper geometry, GridHelper material, and drop
 *       the group. Field.dispose disposes every layer.
 *   R8. Per-frame allocation: none. No `new` in update/syncRender. Positions
 *       and speeds are the construct-time Float32Arrays.
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      THREE.Group → THREE.Points (AdditiveBlending, transparent,
 *              depthWrite false, sizeAttenuation) + THREE.GridHelper
 *              (transparent, depthWrite false, opacity from BALANCE)
 * Inheritance: composition (owns Group; does not extend Points)
 * syncRender writes: group.position, group.rotation, position.needsUpdate
 * Never writes: camera transform, BALANCE
 * Scene ownership: RunScene adds layer.group (or field root) (D14)
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 * Port from POC-1 DYNAMIC VIEW (`BALANCE.parallax.layers`). The live numbers
 * — not the commented COCKPIT/TOP blocks, not the hub's 0.15→0.09→0.03 line.
 *
 * Shared:
 *   gridSize = 1000 · zFar = -2000 · zNearWrap = 0 · speedJitter = 0.5
 *   size = 1 · alpha = 0.5 · rotation {0,0,0} · position.x = 0 · position.z = 100
 *   gridColor = 0x555555 · gridOpacity = 0
 *
 *   [0] background_stars
 *       count        = 400
 *       speed        = 0.2 * 0.015     = 0.003
 *       parallaxGain = 0.015 * 0.015   = 0.000225
 *       color        = 0xa5e8ff        // cool white
 *       position.y   = -600
 *
 *   [1] solar_system
 *       count        = 300
 *       speed        = 0.2 * 15        = 3
 *       parallaxGain = 0.015 * 15      = 0.225
 *       color        = 0xd97706        // amber
 *       position.y   = -300
 *
 *   [2] debris
 *       count        = 150
 *       speed        = 0.2 * 20        = 4
 *       parallaxGain = 0.015 * 20      = 0.3
 *       color        = 0x7c68ff        // violet
 *       position.y   = -150
 *
 * Feel:      camera motion slides three skies at three obvious rates; the
 *            grids stay glued to the camera so the star field is a texture
 *            on depth, not a world-locked mesh. Matches POC-1 DYNAMIC VIEW.
 * Leveling:  N/A.
 * Graphics:  additive points, no depth write, three hues (white / amber /
 *            violet) so depth reads in <0.3 s (pillar 4). Grid opacity 0
 *            in production; G08 can raise it.
 * Pillars:   4 (legibility of speed and depth).
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/gameobjects/parallax/parallax.test.ts
 * Runner: vitest
 * Mocks: real THREE (Points, Group, GridHelper, PerspectiveCamera). BALANCE
 *        parallax.layers slice or a fixture matching §4.
 *
 * describe('ParallaxField')
 *   it('constructs three layers named background_stars, solar_system, debris') // R1
 *   it('pins each layer group to camera.position + layer.position')          // R3
 *   it('uses DYNAMIC VIEW gains 0.000225 / 0.225 / 0.3 and y -600/-300/-150') // R4, port
 *   it('uses gridSize 1000 and zFar -2000 on every layer')                   // R4, port
 *   it('dispose frees points and grid resources on every layer')             // R7
 *
 * describe('ParallaxLayer')
 *   it('applies zero star shift on the first update (no last-camera yet)')   // R2
 *   it('shifts stars opposite a camera Δ scaled by parallaxGain')            // R2, Acceptance
 *   it('wraps stars on X at ±gridSize/2')                                    // R5
 *   it('recycles a star whose z exceeds zNearWrap')                          // R5
 *   it('applyConfig with same count does not allocate a new geometry')       // R6
 *   it('update/syncRender do not allocate')                                  // R8
 *
 * Manual:
 *   A-manual-1. [manual] fly the camera: three distinct slide rates, grids
 *               glued to the view (card Acceptance).
 *
 * Coverage: R1–R8 + card Acceptance (three distinct rates, smooth) + port
 *           fidelity vs POC-1 DYNAMIC VIEW numbers.
 */
