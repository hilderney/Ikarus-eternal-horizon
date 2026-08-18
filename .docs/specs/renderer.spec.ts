/**
 * #tag/arch #tag/memory
 *
 * Card:         SDD-G09 Renderer
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: RUL-02, RUL-08
 * Change type:  new
 * POC-1 origin: poc/src/main.ts (WebGLRenderer + Scene construction) — frozen reference
 * Test file:    poc2/src/render/renderer.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      `THREE.WebGLRenderer` + the root `THREE.Scene`. Portrait 9:16
 *            playfield from `BALANCE.layout.playfield` (540×960), letterbox
 *            centering inside `#game-area`, resize/aspect. `render(camera)`
 *            each frame. Local domain classes import into this scene graph
 *            (no surrogate view models). Relative paths so the Itch `dist/`
 *            opens from `file://` (RUL-08).
 * Does not own: camera rig (B01, scene-owned by G03), HUD DOM (G07), area
 *            shell (G06), scene transitions (G01). Off-area despawn is F01 /
 *            E05 / E06; this card only keeps the *canvas* letterboxed.
 * Player-facing: a stretched playfield, a blurry canvas, or a black Itch
 *            page from an absolute `/src/...` path.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-A01 Balancer — layout.playfield 540×960
 *   SDD-B01 GameCamera — PerspectiveCamera whose aspect this class keeps in
 *            sync with the playfield
 *   SDD-C01 Ship — first domain object imported into the root scene (proves
 *            the "local classes import directly" rule)
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-G03 RunScene — attach/detach canvas, render(camera) per frame
 *   SDD-G07 HUD — projector uses this canvas's bounding rect
 *   SDD-G01 — canvas must be gone when Run disposes (via G03)
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

export interface PlayfieldSize {
  readonly width: number
  readonly height: number
}

export interface GameCameraAspectPort {
  setAspect(aspect: number): void
}

export interface GameRendererPort {
  readonly canvas: HTMLCanvasElement
  readonly scene: unknown
  attach(host: HTMLElement): void
  detach(): void
  resize(): void
  render(camera: unknown): void
  dispose(): void
}

export interface GameRendererOptions {
  readonly playfield?: PlayfieldSize
  readonly camera?: GameCameraAspectPort
  readonly pixelRatioCap?: number
}

export declare class GameRenderer implements GameRendererPort {
  constructor(options?: GameRendererOptions)

  readonly canvas: HTMLCanvasElement
  /** Root THREE.Scene. Domain objects are added by their owners (G03 / managers). */
  readonly scene: unknown

  /** Append canvas to `#game-area`. Idempotent. */
  attach(host: HTMLElement): void

  /** Remove canvas from its host. Does not dispose the renderer. */
  detach(): void

  /**
   * Keep internal buffer at playfield width×height (updateStyle=false).
   * CSS letterboxes via aspect-ratio 9/16. Updates camera aspect.
   */
  resize(): void

  render(camera: unknown): void

  /** dispose renderer + context; drop resize listener. */
  dispose(): void
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   renderer     | THREE.WebGLRenderer | antialias true; setPixelRatio capped
 *   scene        | THREE.Scene         | background from BALANCE.render
 *   canvas       | HTMLCanvasElement   | renderer.domElement
 *   playfield    | 540×960             | BALANCE.layout.playfield
 *
 *   constructor — setSize(width, height, false); pixelRatio = min(dpr, cap)
 *   attach      — host.appendChild(canvas); listen resize
 *   resize      — setSize(playfield, false); camera.setAspect(w/h)
 *   render      — renderer.render(scene, camera)
 *   dispose     — renderer.dispose(); detach; remove listener
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. Drawing buffer is exactly BALANCE.layout.playfield (540×960).
 *       `setSize(..., false)` so CSS, not the buffer, handles letterbox.
 *   R2. Canvas CSS is portrait 9:16, centered in `#game-area` (existing
 *       poc2/src/style.css). JS does not set canvas.style.width to the window.
 *   R3. pixelRatio is `min(devicePixelRatio, BALANCE.render.pixelRatioCap)`
 *       (POC-1 cap = 2).
 *   R4. `resize()` updates camera aspect to width/height of the playfield,
 *       not the window.
 *   R5. Relative paths (RUL-08): this module never assigns an absolute URL
 *       (`http://`, `https://`, root-absolute `/src/`). index.html already
 *       uses `./src/main.ts`.
 *   R6. Memory: one renderer, one scene, one resize listener. dispose()
 *       releases the GL context. Per-frame allocation: none.
 *   R7. Domain classes are imported by G03 into `scene`, not wrapped in a
 *       view-model layer.
 *   R8. Off-area despawn (RUL-02) is not this class's job; the canvas simply
 *       must not grow with window size and leak a huge buffer.
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      THREE.WebGLRenderer + THREE.Scene
 * Inheritance: composition (this class is not a Scene)
 * syncRender writes: N/A — `render()` presents the already-synced graph
 * Never writes: object transforms, BALANCE gameplay, HUD DOM
 * Scene ownership: root Scene is owned here; children are added/removed by
 *                  G03 / managers / pools (D14)
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 *   BALANCE.layout.playfield.width   = 540   // portrait 9:16
 *   BALANCE.layout.playfield.height  = 960
 *
 * New section (add to SDD-A01):
 *   BALANCE.render.background        = 0x05040a  // POC-1 scene.background
 *   BALANCE.render.pixelRatioCap     = 2         // POC-1 Math.min(dpr, 2)
 *   BALANCE.render.antialias         = true
 *
 * Feel:      A pixel-crisp portrait window floating in the void. Side columns
 *            eat leftover desktop width; the fight never letterboxes *inside*
 *            the 540×960 — the black bars live *around* it. Stretching to
 *            fill the monitor would break the tuned camera (B01) and the HUD
 *            projector (G07).
 * Leveling:  N/A
 * Graphics:  Void #05040a (slightly cooler than shell --bg #05060d so the
 *            canvas reads as "space" against the chrome). `image-rendering:
 *            pixelated` already on `poc2/src/style.css` canvas. Neon world
 *            inside (ship cyan/indigo) is owned by C01 / F05, not here.
 * Pillars:   4 (legibility — stable framing) · RUL-08 Itch packaging
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/render/renderer.test.ts
 * Runner: vitest
 * Mocks: three.js WebGLRenderer stub (setSize/setPixelRatio/render/dispose/
 *        domElement), GameCameraAspectPort spy, a host HTMLElement
 *
 * describe('GameRenderer')
 *   it('sets the drawing buffer to 540×960 with updateStyle false')         // R1
 *   it('caps pixelRatio at BALANCE.render.pixelRatioCap')                   // R3
 *   it('resize sets camera aspect to 540/960')                              // R4
 *   it('attach appends the canvas to the host')                             // R2
 *   it('detach removes the canvas without disposing')                       // R6
 *   it('dispose releases the renderer and the resize listener')             // R6
 *   it('render forwards (scene, camera) to WebGLRenderer.render')           // present
 *   it('does not assign an absolute URL to any resource')                   // R5, RUL-08
 *
 * Manual:
 *   A-manual-1. [manual] canvas is pixel-crisp, centred, 9:16 inside game-area
 *   A-manual-2. [manual] `dist/` opened from file:// loads with no absolute path
 *               (RUL-08)
 *   A-manual-3. [manual] worst-case field (Mega + wave) stays frame-stable
 *
 * Coverage: R1–R8 + card Acceptance (pixel-crisp centred canvas; relative
 * paths) + RUL-02 (buffer does not grow with the window) + RUL-08.
 */
