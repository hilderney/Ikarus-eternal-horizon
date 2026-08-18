/**
 * #tag/arch #tag/controls
 *
 * Card:         SDD-A02 Input
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: SHIP-01, SHIP-04 (Q07: pointer deferred)
 * Change type:  class-ify
 * POC-1 origin: poc/src/core/input.ts  — frozen reference
 * Test file:    poc2/src/core/input.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      The keyboard input state machine. `class InputState` listens on an
 *            injected EventTarget (default `window`), tracks which codes are
 *            down, synthesizes `Shift+KeyX` combos, `preventDefault`s the
 *            BALANCE-declared control codes, and clears on `blur`.
 * Does not own: mapping keys to ship/camera motion (SDD-C02), fire/switch
 *            consumption (SDD-E07), pause overlay focus (SDD-G11), or pointer
 *            / gamepad (Q07 deferred; SHIP-13 later).
 * Player-facing: sticky keys after alt-tab, swallowed WASD, or Shift combos
 *            fighting IJKL all feel like broken controls.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Upstream: none.
 * Downstream:
 *   SDD-C02 Controller — isDown(shipKeys / camera.keys)
 *   SDD-E07 FiringManager — isDown(fireKey / switchKey)
 *   SDD-G11 PauseScene — overlay takes keyboard focus; this class still owns
 *                        the window listeners until dispose
 */

// ─── 9. Agent sign-off ───────────────────────────────────────────────────────
/**
 * Orchestrator : hub-v4.1 / 2026-08-17  scope, requires, DoD
 * Programming  : hub-v4.1 / 2026-08-17  contract, listeners, combo synthesis
 * Game Design  : hub-v4.1 / 2026-08-17  BALANCE.controls key map from POC-1
 * TDD          : hub-v4.1 / 2026-08-17  cases named; test file not yet written (red next)
 * Status: spec-complete
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Programming / Three.js
// ═════════════════════════════════════════════════════════════════════════════

/** Port consumers depend on — not the class. */
export interface InputPort {
  isDown(code: string): boolean
  dispose(): void
}

/** Construction data. Target is injected so tests do not need `window`. */
export interface InputStateOptions {
  /** Defaults to `window` in the browser. Tests pass a fake EventTarget. */
  readonly target?: EventTarget
  /**
   * Codes that call `preventDefault` on keydown. Built from
   * `BALANCE.controls` + `BALANCE.gameplay.fireKey` / `switchKey` plus
   * `ShiftLeft` / `ShiftRight`. Never a hardcoded gameplay list in the class.
   */
  readonly preventDefaultCodes: readonly string[]
}

export declare class InputState implements InputPort {
  constructor(options: InputStateOptions)

  /** True while `code` is in the down-set. Accepts raw codes and `Shift+KeyX`. */
  isDown(code: string): boolean

  /** Removes every listener this instance added. Safe to call twice. */
  dispose(): void
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   field                | type            | meaning / unit / range
 *   ---------------------|-----------------|----------------------------------
 *   _keys                | Set<string>     | currently-down codes + synthetics
 *   _shiftPressed        | boolean         | either ShiftLeft or ShiftRight down
 *   _target              | EventTarget     | listener host
 *   preventDefaultCodes  | readonly string[] | codes that eat the browser default
 *
 *   isDown(code)  — O(1) has(); does not consume; does not allocate.
 *   dispose()     — removeEventListener for keydown, keyup, blur; clear the set.
 *
 * Keydown: add e.code; if Shift is already down and e.code is not a Shift key,
 * add `Shift+${e.code}` as well. The base code stays in the set (R4).
 * Keyup: delete e.code and `Shift+${e.code}`; if the released code is a Shift
 * key, set `_shiftPressed = false`.
 * Blur: `_keys.clear()` and `_shiftPressed = false`.
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. isDown(code) is true after keydown of that code and false after keyup.
 *   R2. blur clears every code, including synthetics; isDown is false for all.
 *   R3. While ShiftLeft or ShiftRight is down, keydown of KeyX also records
 *       the synthetic code `Shift+KeyX`. Keyup of KeyX removes both KeyX and
 *       `Shift+KeyX`.
 *   R4. Combos never shadow the base key: with Shift+I held, isDown('KeyI')
 *       and isDown('Shift+KeyI') are both true (WASD + IJKL + Shift+IJKL coexist).
 *   R5. keydown on a code in preventDefaultCodes calls preventDefault().
 *       Codes outside the list do not.
 *   R6. Pointer / mouse is out of scope (Q07 deferred). No pointer listeners.
 *   R7. Memory: created-once. dispose must reach: keydown, keyup, blur listeners.
 *   R8. Per-frame allocation: none. isDown does not allocate. The down-set is
 *       mutated in event handlers only.
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      N/A — no visual
 * Inheritance: N/A (pure logic)
 * syncRender writes: N/A
 * Never writes: N/A
 * Scene ownership: N/A
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 * This module does not invent key names. The preventDefault / isDown vocabulary
 * is the union of these A01 paths (POC-1 values):
 *
 *   BALANCE.controls.shipKeys.moveXMinus   = 'KeyA'     // strafe left
 *   BALANCE.controls.shipKeys.moveXPlus    = 'KeyD'     // strafe right
 *   BALANCE.controls.shipKeys.moveZMinus   = 'KeyW'     // forward (screen-up)
 *   BALANCE.controls.shipKeys.moveZPlus    = 'KeyS'     // back
 *   BALANCE.controls.camera.keys.moveZPlus = 'KeyI'
 *   BALANCE.controls.camera.keys.moveZMinus= 'KeyK'
 *   BALANCE.controls.camera.keys.moveXMinus= 'KeyJ'
 *   BALANCE.controls.camera.keys.moveXPlus = 'KeyL'
 *   BALANCE.controls.camera.keys.moveYPlus = 'KeyU'
 *   BALANCE.controls.camera.keys.moveYMinus= 'KeyO'
 *   BALANCE.controls.camera.keys.rotXPlus  = 'Shift+KeyK'
 *   BALANCE.controls.camera.keys.rotXMinus = 'Shift+KeyI'
 *   BALANCE.controls.camera.keys.rotZPlus  = 'Shift+KeyU'
 *   BALANCE.controls.camera.keys.rotZMinus = 'Shift+KeyO'
 *   BALANCE.controls.camera.keys.rotYPlus  = 'Shift+KeyJ'
 *   BALANCE.controls.camera.keys.rotYMinus = 'Shift+KeyL'
 *   BALANCE.gameplay.fireKey               = 'Space'
 *   BALANCE.gameplay.switchKey             = 'KeyF'
 *
 * preventDefaultCodes also includes 'ShiftLeft' and 'ShiftRight' so the combo
 * generator can see them. Arrow keys are not on the ship/camera map in POC-1
 * DYNAMIC VIEW; do not add them unless A01 grows them.
 *
 * Feel:      simultaneous ship (WASD) and camera (IJKL/UO) with Shift-rotate
 *            on the camera cluster. No mode toggle. Alt-tab must not leave
 *            a stuck Shift or WASD (blur clear). Matches POC-1.
 * Leveling:  N/A — input does not scale.
 * Graphics:  N/A.
 * Pillars:   1 (instant decision — the ship answers the key the same frame)
 *            and the move-on-X/Y fragment of the playable pillar (`SHIP-01`).
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * Protocol: write `input.test.ts` FIRST. `npm run test` must FAIL for the
 * named cases (red). Programming then implements until green.
 *
 * File: poc2/src/core/input.test.ts
 * Runner: vitest (`npm run test` in poc2/)
 * Mocks: fake EventTarget (no window required); BALANCE slice not needed —
 *        pass preventDefaultCodes explicitly
 *
 * describe('InputState')
 *   it('reports isDown true after keydown and false after keyup')            // R1
 *   it('clears every code on blur, including Shift synthetics')              // R2
 *   it('synthesizes Shift+KeyX while ShiftLeft is held')                     // R3
 *   it('synthesizes Shift+KeyX while ShiftRight is held')                    // R3
 *   it('removes both KeyX and Shift+KeyX on keyup of KeyX')                  // R3
 *   it('keeps the base key down alongside the Shift combo')                  // R4, Acceptance
 *   it('lets WASD, IJKL and Shift+IJKL coexist in the same down-set')        // R4, SHIP-01
 *   it('calls preventDefault on listed codes and not on others')             // R5
 *   it('does not attach pointer or mouse listeners')                         // R6, Q07
 *   it('dispose removes listeners so later events are ignored')              // R7
 *   it('isDown does not allocate (no new Set / array per call)')             // R8
 *   it('matches POC-1 combo spelling Shift+KeyI (not ShiftLeft+KeyI)')       // port fidelity
 *
 * Manual:
 *   A-manual-1. [manual] alt-tab away mid-hold; return; ship must not keep
 *               drifting (blur clear).
 *
 * Coverage: R1–R8 + card Acceptance ("WASD + IJKL + Shift+IJKL co-exist") + Q07.
 */
