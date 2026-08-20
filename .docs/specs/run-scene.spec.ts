/**
 * #tag/arch #tag/scenes #tag/managers #tag/memory
 *
 * Card:         SDD-G03 RunScene
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: RUL-01, RUL-03
 * Change type:  split
 * POC-1 origin: poc/src/main.ts (world construction + frame body) — frozen reference
 * Test file:    poc2/src/scenes/run-scene.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      The playable run. Owns the canvas + `game-area`. Constructs and
 *            disposes camera, parallax, limit-box, gizmos (D14: scene-owned)
 *            plus the ship, controllers, TouchControls (G12) and every manager. Drives the body of
 *            `GameLoop.step` while mounted: **input.update(dt)** → update →
 *            managers → collision → syncRender → renderer.render. Wires
 *            `area-inputs` (active input map) and `debugger-area`.
 * Does not own: the rAF driver (A04), screen transitions (G01), HTML menus
 *            (G02/G04/G05), pause overlay markup (G11). Ending a run is G10;
 *            this scene only reacts when G10 says `over`.
 * Player-facing: the game. A leak on leave means the next Title still shows
 *            stars. A missed dispose means GPU memory grows every restart.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-A02 Input — update(dt) polled at the start of this scene's step
 *   Stage C — C01 Ship, C02 Controller, C03 ShipHealth
 *   Stage D — D01–D06 weapons / energy
 *   Stage E — E01–E07 enemies / meteors / shots / firing
 *   Stage F — F01–F05 collision / drops / difficulty / damage / vfx
 *   SDD-G06 UI areas — three-area host
 *   SDD-G07 HUD — floating + border widgets
 *   SDD-G09 Renderer — WebGLRenderer + root Scene, letterbox canvas
 *
 * Constructed here but listed on other cards (not in this requires line):
 *   SDD-G08 Debugger — DEV-only, mounted into debugger-area (Q09)
 *   SDD-G10 RunState — kill/score/end; restart goes through G01
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-G01 — mounts/disposes this ScenePort
 *   SDD-G11 — overlays this scene without disposing it
 *   SDD-G07 / G08 / G10 — live only while this scene is mounted
 */

// ─── 9. Agent sign-off ───────────────────────────────────────────────────────
/**
 * Orchestrator : hub-v4.2 / 2026-08-17  input.update first in step, D18
 * Programming  : hub-v4.2 / 2026-08-17  InputPort on options
 * Game Design  : hub-v4.2 / 2026-08-17  pad map in area-inputs
 * TDD          : hub-v4.3 / 2026-08-18  run-scene.test.ts green
 * Status: done
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Programming / Three.js
// ═════════════════════════════════════════════════════════════════════════════

// ─── 2. Contract ─────────────────────────────────────────────────────────────

import type { SceneId, ScenePort, SceneRouter } from './scene-controller.spec'
import type { UiAreasPort } from './ui-areas.spec'
import type { GameRendererPort } from './renderer.spec'
import type { HudPort } from './hud.spec'
import type { RunStatePort } from './run-state.spec'
import type { InputPort } from './input.spec'

/** Disposable world object constructed by this scene (D14 + managers). */
export interface Disposable {
  dispose(): void
}

export interface Steppable {
  update(dt: number): void
}

export interface RenderSyncable {
  syncRender(): void
}

/**
 * Factories injected so tests can substitute fakes. Production passes the
 * real class constructors. RunScene calls each factory once on `mount`.
 */
export interface RunWorldFactory {
  camera(): Disposable & Steppable & RenderSyncable
  parallax(): Disposable & Steppable & RenderSyncable
  limitBox(): Disposable & Steppable & RenderSyncable
  gizmos(): Disposable & Steppable & RenderSyncable
  ship(): Disposable & Steppable & RenderSyncable
  playerController(): Steppable
  cameraController(): Steppable
  energy(): Steppable & Disposable
  shotManager(): Steppable & Disposable
  enemyManager(): Steppable & Disposable
  meteorManager(): Steppable & Disposable
  firingManager(): Steppable & Disposable
  collisionManager(): Steppable & Disposable
  dropManager(): Steppable & Disposable
  difficultyManager(): Steppable & Disposable
  damageResolver(): Steppable & Disposable
  vfxManager(): Steppable & Disposable
  hud(): HudPort
  runState(): RunStatePort
  /** Omitted or returns null outside DEV (Q09). */
  debugger?(): (Steppable & Disposable) | null
}

export interface InputMapPort {
  mount(host: HTMLElement): void
  update?(dt: number): void
  dispose(): void
}

export interface RunSceneOptions {
  readonly areas: UiAreasPort
  readonly renderer: GameRendererPort
  readonly router: SceneRouter
  readonly world: RunWorldFactory
  readonly input: Pick<InputPort, 'update'>
  readonly inputMap: InputMapPort
  /** Result scene factory — called once when runState.phase becomes 'over'. */
  readonly createResult: () => ScenePort
}

export declare class RunScene implements ScenePort {
  constructor(options: RunSceneOptions)

  readonly id: SceneId

  mount(): void
  update(dt: number): void
  syncRender(): void
  dispose(): void
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   id            | 'run'
 *   camera        | B01     | scene-owned (D14)
 *   parallax      | B02     | scene-owned (D14)
 *   limitBox      | B03     | scene-owned (D14)
 *   gizmos        | B04     | scene-owned (D14); DEV / Q09
 *   ship          | C01     | scene-owned
 *   managers[]    | C02,D03,E04–E07,F01–F05 | scene-owned populations
 *   hud           | G07     | reads only
 *   runState      | G10     | only module that ends the run
 *   debugger      | G08     | optional, debugger-area
 *
 *   mount     — constructs world via factory, areas.setMode('run'), appends
 *               canvas into game-area (renderer.attach), input map into
 *               area-inputs, debugger into debugger-area
 *   update    — **input.update(dt)** → controllers → ship → limit-box/camera →
 *               managers → collision → damage → vfx → runState. If
 *               runState.phase === 'over', router.next(createResult()) once
 *   syncRender — every RenderSyncable then renderer.render(camera)
 *   dispose   — reverse order: hud/debugger, managers, ship, gizmos,
 *               limit-box, parallax, camera; renderer.detach canvas; input map
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. `id` is the literal `'run'`.
 *   R2. D14: camera, parallax, limit-box and gizmos are constructed by this
 *       scene on mount and disposed by this scene on dispose. Managers do not
 *       own them.
 *   R3. `update(dt)` is logic only. GPU / transform writes wait for `syncRender`.
 *   R4. Frame order: **input.update** → controllers → ship → follow/limit-box →
 *       camera → parallax → energy → firing → enemy/meteor/shot managers →
 *       collision → damage → drops → vfx → runState → hud.read. Then
 *       `syncRender` then `render`. GameLoop never polls pads.
 *   R5. When `runState.phase` becomes `'over'`, this scene calls
 *       `router.next(createResult())` exactly once (G10 ends the run; G01
 *       disposes this scene).
 *   R6. Memory: every factory product is disposed on `dispose()`. Pools live
 *       inside their managers and are cleared there. Per-frame allocation: none
 *       on the hot path (no `[]` / `{}` / `new` in `update` / `syncRender`).
 *   R7. `areas.setMode('run')` on mount. Canvas is the only child this scene
 *       adds to `game-area` (HUD overlays are G07, positioned over the canvas
 *       rect, not replacing it). `area-inputs` hosts the editable InputMap
 *       (keyboard / mix / gamepad / touch). Remaps write live InputBindings
 *       that A02 reads; BALANCE stays the default table. `update(dt)` polls
 *       pad-listen. Escape still pauses.
 *   R8. Debugger factory is skipped when it returns null (Q09 production).
 *   R9. Pause (G11) does not call `dispose`. Unpause continues the same
 *       instances. This class does not consume Esc.
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      composition — root THREE.Scene lives on G09; this class adds
 *              camera-rig contents, parallax, limit-box, gizmos, ship, and
 *              lets managers add pooled meshes.
 * Inheritance: N/A (the scene is not a THREE.Scene; G09 owns that)
 * syncRender writes: delegated to children (transforms / opacity / material)
 * Never writes: health, score, energy, pause, BALANCE
 * Scene ownership: this class is the D14 owner for camera/parallax/limit-box/
 *                  gizmos and the owner of ship + managers
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 * Run consumes numbers owned by other cards; it does not invent any.
 *
 *   BALANCE.layout.playfield  = { width: 540, height: 960 }  // G09 letterbox
 *   BALANCE.camera.*          = POC-1 dynamic view            // B01
 *   BALANCE.gameplay.*        = fire/switch/energy            // D03 E07
 *   BALANCE.controls.*        = motion + tilt + gamepad           // C02 A02
 *   BALANCE.haptics.*         = rumble presets                    // F05
 *   BALANCE.ship.*            = follow / visual / health      // C01 C03 B03
 *   BALANCE.score.*           = G10
 *   BALANCE.difficulty.*      = F03
 *
 * Feel:      POC-1 motion, camera, parallax and laser are the law. The Run
 *            screen is the three-area shell with a portrait 9:16 pane in the
 *            middle. Death must cut to Result without a hitch (pillar 5).
 * Leveling:  weapon levels D02; hull levels C03 — this scene only hosts them.
 * Graphics:  canvas pixel-crisp, letterboxed; area-inputs shows an editable
 *            map per scheme (Keyboard / Mix / Gamepad / Touch). Click a bind
 *            then press a key, mouse button, or pad button. Touch slots pick
 *            overlay actions. Reset restores BALANCE defaults. Neon chrome
 *            (`--neon` #4de2ff, monospace). No extra vignette here
 *            (F05 owns hull vignette).
 * Pillars:   1 visible risk (HUD) · 4 legibility at speed · 5 one more kill
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/scenes/run-scene.test.ts
 * Runner: vitest
 * Mocks: UiAreasPort fixtures, GameRendererPort, SceneRouter, RunWorldFactory
 *        of spies (each factory returns a disposable/steppable fake),
 *        RunStatePort with a settable phase, HudPort, InputMapPort
 *
 * describe('RunScene')
 *   it('reports id "run"')                                                  // R1
 *   it('mount constructs camera, parallax, limit-box and gizmos via factory') // R2, D14
 *   it('mount constructs ship and every manager via factory')               // R2
 *   it('mount sets areas mode to run and attaches the canvas to game-area') // R7
 *   it('mount writes the input map into area-inputs')                       // R7
 *   it('update calls input.update(dt) before controllers')                  // R4, D18
 *   it('update then syncRender then renderer.render on a step')             // R3, R4, RUL-01
 *   it('update does not call renderer.render')                              // R3
 *   it('when runState.phase becomes over, next(result) fires once')         // R5, RUL-03
 *   it('dispose disposes camera, parallax, limit-box, gizmos, ship, managers, hud') // R6
 *   it('dispose detaches the canvas and clears area-inputs')                // R6, R7
 *   it('skips debugger construction when the factory returns null')         // R8, Q09
 *   it('a second mount after dispose constructs a fresh world')             // R6, G10 restart
 *
 * Manual:
 *   A-manual-1. [manual] Title→Run shows the POC-1 camera feel and 3 parallax rates
 *   A-manual-2. [manual] restart (G10) leaves no leftover meshes in the scene graph
 *
 * Coverage: R1–R9 + card Acceptance (full cycle with no leaked object; canvas
 * + game-area owned; D14 scene-owned dressing; GameLoop.step body) + RUL-01/03.
 */
