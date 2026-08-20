/**
 * #tag/arch #tag/controls
 *
 * Card:         SDD-A02 Input
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: SHIP-01, SHIP-13 (POC2 play), SHIP-04 (D19: mouse buttons in;
 *               pointer-steer deferred)
 * Change type:  class-ify (+ Gamepad API + dual-rumble D18; mouse + touch source D19)
 * POC-1 origin: poc/src/core/input.ts  — frozen keyboard reference
 * Test file:    poc2/src/core/input.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      The input state machine for **four exclusive schemes (D19)**:
 *            (1) keyboard, (2) mix = keyboard + mouse buttons/wheel,
 *            (3) Gamepad API, (4) virtual stick + buttons via `TouchSource`
 *            (G12 / nipplejs — this class never imports nipplejs).
 *            **Exactly one scheme is active.** Default is **keyboard**.
 *            `setScheme` is how G11 pause switches devices. Escape always
 *            reports `pause` so the picker stays reachable.
 *            `class InputState` listens on an injected EventTarget (default
 *            `window`), tracks which codes are down, synthesizes `Shift+KeyX`
 *            combos, `preventDefault`s the BALANCE-declared control codes, and
 *            clears on `blur`. Once per `update(dt)` it polls `getGamepads()`
 *            (when scheme is gamepad), reads the touch source (when scheme is
 *            touch), applies deadzone / trigger threshold, and exposes analog
 *            axes + named actions. `rumble(preset)` plays `dual-rumble` on the
 *            active pad's `vibrationActuator`.
 * Does not own: mapping axes to ship/camera motion (SDD-C02), fire/bomb/switch
 *            consumption (SDD-E07), pause overlay chrome (SDD-G11 — this class
 *            only exposes scheme + pause), the touch overlay DOM (SDD-G12),
 *            pointer-steer (SHIP-04 remainder). Persistent save of remaps
 *            stays SHIP-13 G3; this pass is a live session table (InputBindings)
 *            edited from area-inputs.
 * Player-facing: sticky keys after alt-tab, swallowed WASD, Shift combos
 *            fighting IJKL, a dead stick, RT that never fires, a right-click
 *            that opens the browser menu instead of bombing, or rumble that
 *            throws on keyboard-only all feel like broken controls.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Upstream:
 *   SDD-A01 Balancer — BALANCE.controls.gamepad / mouse / touch,
 *                      BALANCE.haptics,
 *                      BALANCE.gameplay fire/switch/pause/bomb/switchBomb/dash keys
 * Downstream:
 *   SDD-C02 Controller — axis('moveX'|'moveZ') + consumePress('dash') + isDown(camera keys)
 *   SDD-E07 FiringManager — isPressed('fire'); consumePress('switchWeapon' | 'bomb' | 'switchBomb')
 *   SDD-F05 VfxManager — rumble(preset) on shield/hull/break/destroyed
 *   SDD-G03 RunScene — calls update(dt) at the start of step
 *   SDD-G11 PauseScene — consumePress('pause'); overlay still owns focus
 *   SDD-G12 TouchControls — produces TouchSource; this class only reads it
 */

// ─── 9. Agent sign-off ───────────────────────────────────────────────────────
/**
 * Orchestrator : hub-v4.3 / 2026-08-19  exclusive schemes; default keyboard; G11 picker
 * Programming  : hub-v4.3 / 2026-08-19  setScheme gates pad / mouse / touch / keys
 * Game Design  : hub-v4.3 / 2026-08-19  one device at a time; Escape always pauses
 * TDD          : hub-v4.3 / 2026-08-19  scheme isolation cases
 * Status: done
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Programming / Three.js
// ═════════════════════════════════════════════════════════════════════════════

/** Exclusive control schemes. Pause (G11) is the picker. Default: keyboard. */
export type ControlScheme = 'keyboard' | 'mix' | 'gamepad' | 'touch'
export type InputAction =
  | 'fire'
  | 'bomb'
  | 'switchWeapon'
  | 'switchBomb'
  | 'dash'
  | 'pause'

/** @deprecated D19 — alias of 'dash'. Remove when the A02 follow-up lands. */
export type LegacyInputAction = 'boost' | 'special'

/** C02 force dir. +moveX = KeyD / +X. +moveZ = KeyS / +Z (back). −moveZ = KeyW (forward). */
export type AxisId = 'moveX' | 'moveZ'

/** Keys of BALANCE.haptics.presets. */
export type RumblePreset =
  | 'shieldHit'
  | 'hullHit'
  | 'shieldBreak'
  | 'destroyed'
  | 'fireLaser'

/** Port consumers depend on — not the class. */
export interface InputPort {
  /** Poll pads + touch source. Keyboard/mouse are event-driven; this must still be cheap and alloc-free. */
  update(dt: number): void
  isDown(code: string): boolean
  /**
   * −1..1 after deadzone (and invertMoveZ on moveZ).
   * Only the **active scheme** writes axes. Mouse never writes axes.
   */
  axis(id: AxisId): number
  /** True while the action is held on the active scheme. Fire uses this (hold-to-fire). */
  isPressed(action: InputAction): boolean
  /** Rising edge, consumed by this call. Bomb / switch / dash / pause use this. */
  consumePress(action: InputAction): boolean
  /** Fire-and-forget dual-rumble. No-ops without an actuator. Never throws. */
  rumble(preset: RumblePreset): void
  readonly scheme: ControlScheme
  setScheme(scheme: ControlScheme): void
  readonly connectedPadCount: number
  dispose(): void
}

/** Minimal Gamepad surface so tests do not need a real navigator. */
export interface HapticActuatorPort {
  playEffect(
    type: 'dual-rumble',
    params: {
      startDelay: number
      duration: number
      strongMagnitude: number
      weakMagnitude: number
    },
  ): Promise<'complete' | 'preempted'>
}

export interface GamepadButtonSnap {
  readonly value: number
  readonly pressed: boolean
}

export interface GamepadSnap {
  readonly axes: readonly number[]
  readonly buttons: readonly GamepadButtonSnap[]
  readonly mapping: string
  readonly vibrationActuator: HapticActuatorPort | null
}

export interface GamepadSource {
  getGamepads(): readonly (GamepadSnap | null)[]
}

/** Produced by SDD-G12. Injected so A02 never imports nipplejs. */
export interface TouchSource {
  readonly axisX: number
  readonly axisZ: number
  isPressed(action: InputAction): boolean
}

/** Construction data. Target and pad/touch sources are injected so tests do not need `window`. */
export interface InputStateOptions {
  /** Defaults to `window` in the browser. Tests pass a fake EventTarget. */
  readonly target?: EventTarget
  /**
   * Codes that call `preventDefault` on keydown. Built from
   * `BALANCE.controls` + `BALANCE.gameplay` action keys
   * plus `ShiftLeft` / `ShiftRight`. Never a hardcoded gameplay list in the class.
   */
  readonly preventDefaultCodes: readonly string[]
  /**
   * Defaults to `() => navigator.getGamepads()` in the browser.
   * Tests pass a stub. Missing / empty list = keyboard-only.
   */
  readonly gamepads?: GamepadSource
  /** Defaults to a zeroed stub. G12 supplies the live overlay. */
  readonly touch?: TouchSource
}

export declare class InputState implements InputPort {
  constructor(options: InputStateOptions)

  update(dt: number): void
  isDown(code: string): boolean
  axis(id: AxisId): number
  isPressed(action: InputAction): boolean
  consumePress(action: InputAction): boolean
  rumble(preset: RumblePreset): void
  readonly scheme: ControlScheme
  setScheme(scheme: ControlScheme): void
  readonly connectedPadCount: number
  dispose(): void
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   field                | type            | meaning / unit / range
 *   ---------------------|-----------------|----------------------------------
 *   _keys                | Set<string>     | currently-down codes + synthetics
 *   _shiftPressed        | boolean         | either ShiftLeft or ShiftRight down
 *   _target              | EventTarget     | listener host
 *   _gamepads            | GamepadSource   | poll host
 *   _touch               | TouchSource     | G12 overlay; zeros if hidden
 *   _pad                 | GamepadSnap|null| first standard (else first non-null)
 *   _axisX / _axisZ      | number          | last merged analog, −1..1
 *   _mouseButtons        | bitmask         | MouseEvent.button currently down
 *   _edges               | flags           | rising edges waiting for consumePress
 *   preventDefaultCodes  | readonly string[] | codes that eat the browser default
 *
 *   update(dt)    — poll getGamepads() + touch source; pick active pad; write
 *                   analog after deadzone; latch rising edges. dt unused for
 *                   pad sampling (W3C snapshot is already current).
 *   isDown(code)  — O(1) has(); does not consume; does not allocate.
 *   axis(id)      — pad stick if |stick|>0, else touch stick if |stick|>0,
 *                   else keyboard digital −1/0/1. Mouse never writes axes.
 *   isPressed(a)  — keyboard OR pad OR mouse button OR touch button, held.
 *   consumePress(a)— true once per rising edge (key/pad/mouse/touch/wheel notch).
 *   rumble(p)     — playEffect('dual-rumble', BALANCE.haptics.presets[p]).
 *                   Do not await. Swallow rejection. No-op if disabled / no actuator.
 *   dispose()     — removeEventListener for keydown, keyup, blur, pointer/mouse,
 *                   wheel, contextmenu, gamepadconnected, gamepaddisconnected;
 *                   clear the set.
 *
 * Keydown: add e.code; if Shift is already down and e.code is not a Shift key,
 * add `Shift+${e.code}` as well. The base code stays in the set (R4).
 * Keyup: delete e.code and `Shift+${e.code}`; if the released code is a Shift
 * key, set `_shiftPressed = false`.
 * Blur: `_keys.clear()` and `_shiftPressed = false`; mouse buttons up; edges
 * dropped. Pad/touch axes stay until the next update() (pads do not blur).
 *
 * Mouse: button 0 fire, 2 bomb, 1 switchBomb. Wheel notch → switchWeapon edge.
 * contextmenu preventDefault while bomb is bound to button 2.
 *
 * Active pad: prefer mapping === 'standard'; else first non-null snapshot.
 * Deadzone (per axis): |v| < dz → 0; else rescale (v − sign(v)*dz) / (1 − dz).
 * invertMoveZ: after deadzone, moveZ = invert ? −raw : raw. Default false (Q12).
 * Analog trigger (RT/LT): pressed when button.value >= triggerThreshold.
 * Digital buttons: pressed when pressed === true OR value >= triggerThreshold.
 *
 * W3C standard indices (BALANCE.controls.gamepad, do not hardcode in the class):
 *   axes 0/1 left stick; buttons 7 RT fire, 4 LB switchWeapon, 5 RB switchBomb,
 *   9 Start pause, 6 LT dash, 0 South/A bomb.
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
 *   R6. Pointer-steer (mouse moves the ship) is out of scope (SHIP-04 remainder).
 *       Mouse *buttons and wheel* are in (D19 scheme 3). Listeners: pointerdown /
 *       pointerup / pointercancel / wheel / contextmenu. No mousemove → axis.
 *   R7. Memory: created-once. dispose must reach: keydown, keyup, blur,
 *       pointerdown, pointerup, pointercancel, wheel, contextmenu,
 *       gamepadconnected, gamepaddisconnected listeners.
 *   R8. Per-frame allocation: none. isDown / axis / isPressed / consumePress /
 *       update do not allocate. The down-set is mutated in event handlers only.
 *       Pad/touch poll writes scalars. rumble may allocate the effect params
 *       object once per call (not per frame).
 *   R9. Exactly one scheme is active (`keyboard` | `mix` | `gamepad` | `touch`).
 *        Default `keyboard`. Mix = keyboard + mouse buttons/wheel. Mouse never
 *        writes axes. Inactive schemes do not write axis or combat actions.
 *        Escape always latches pause so G11 can open from any scheme.
 *   R10. |axis| < deadzone becomes 0; remaining range is rescaled to [−1, 1].
 *   R11. isPressed('fire') follows the active scheme: Space (keyboard/mix),
 *        Mouse0 (mix only), RT (gamepad), touch Fire (touch). Same split for
 *        bomb / switch / dash. consumePress('pause') is pauseKey (always) or
 *        Start (gamepad) or touch Pause (touch).
 *   R12. rumble() no-ops when haptics.enabled is false, connectedPadCount is 0,
 *        or vibrationActuator is null. It never throws.
 *   R13. rumble() calls playEffect('dual-rumble', { startDelay: 0, duration,
 *        strongMagnitude, weakMagnitude }) from BALANCE.haptics.presets[preset].
 *        A new call may preempt an in-flight effect (browser).
 *   R14. update(dt) must be called by G03 each step. GameLoop does not poll pads.
 *   R15. connectedPadCount is the number of non-null snapshots from getGamepads().
 *   R16. consumePress returns true at most once per rising edge. A held button
 *        does not retrigger. Wheel: mix scheme only; one edge per notch.
 *   R18. Combat binds are live `InputBindings` cloned from BALANCE. Keyboard
 *        / mix share the keyboard map; mix adds mouse buttons + wheel;
 *        gamepad uses the pad map; touch overlay slots remap G12 actions.
 *        Assigning a colliding bind swaps. Escape always latches pause.
 */
// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      N/A — no visual
 * Inheritance: N/A (pure logic)
 * syncRender writes: N/A
 * Never writes: N/A
 * Scene ownership: N/A — constructed at boot; G03 ticks update(dt)
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 * Keyboard vocabulary is the union of these A01 paths (POC-1 values):
 *
 *   BALANCE.controls.shipKeys.moveXMinus   = 'KeyA'     // strafe left
 *   BALANCE.controls.shipKeys.moveXPlus    = 'KeyD'     // strafe right
 *   BALANCE.controls.shipKeys.moveZMinus   = 'KeyW'     // forward (screen-up)
 *   BALANCE.controls.shipKeys.moveZPlus    = 'KeyS'     // back
 *   BALANCE.controls.camera.keys.*         = IJKL / UO + Shift combos (debug rig)
 *   BALANCE.gameplay.fireKey               = 'KeyF'
 *   BALANCE.gameplay.switchKey             = 'KeyG'
 *   BALANCE.gameplay.pauseKey              = 'Escape'
 *   BALANCE.gameplay.bombKey               = 'KeyE'
 *   BALANCE.gameplay.switchBombKey         = 'KeyQ'
 *   BALANCE.gameplay.dashKey               = 'ControlLeft'
 *
 * preventDefaultCodes also includes 'ShiftLeft' and 'ShiftRight' so the combo
 * generator can see them. Arrow keys are not on the ship/camera map in POC-1
 * DYNAMIC VIEW; do not add them unless A01 grows them.
 *
 * Gamepad (W3C standard mapping — Xbox / DualShock / generic):
 *
 *   BALANCE.controls.gamepad.deadzone          = 0.18
 *   BALANCE.controls.gamepad.triggerThreshold  = 0.35
 *   BALANCE.controls.gamepad.invertMoveZ       = false   // Q12: stick-up = W
 *   BALANCE.controls.gamepad.axes.moveX        = 0
 *   BALANCE.controls.gamepad.axes.moveZ        = 1
 *   BALANCE.controls.gamepad.buttons.fire      = 3       // Y
 *   BALANCE.controls.gamepad.buttons.switchWeapon = 2    // X
 *   BALANCE.controls.gamepad.buttons.switchBomb   = 5    // RB
 *   BALANCE.controls.gamepad.buttons.pause     = 9       // Start
 *   BALANCE.controls.gamepad.buttons.dash      = 6       // LT (SHIP-08 energy later)
 *   BALANCE.controls.gamepad.buttons.bomb      = 0       // South / A
 *
 * Mouse mix (scheme 3 — WASD still flies; cursor does not):
 *
 *   BALANCE.controls.mouse.fireButton       = 0   // left, hold
 *   BALANCE.controls.mouse.bombButton       = 2   // right, edge
 *   BALANCE.controls.mouse.switchBombButton = 1   // middle, edge
 *   wheel notch                             → switchWeapon edge (no extra BALANCE id)
 *
 * Touch overlay numbers live on BALANCE.controls.touch (G12).
 *
 * Haptics (dual-rumble magnitudes 0..1, duration ms):
 *
 *   BALANCE.haptics.enabled = true
 *   shieldHit    { durationMs: 40,  strongMagnitude: 0.12, weakMagnitude: 0.35 }
 *   hullHit      { durationMs: 80,  strongMagnitude: 0.45, weakMagnitude: 0.28 }
 *   shieldBreak  { durationMs: 180, strongMagnitude: 0.85, weakMagnitude: 0.50 }
 *   destroyed    { durationMs: 420, strongMagnitude: 1.00, weakMagnitude: 0.70 }
 *   fireLaser    { durationMs: 16,  strongMagnitude: 0.00, weakMagnitude: 0.08 }
 *                // Q13: E07 skips this for Laser; preset exists for later weapons
 *
 * Feel:      one device at a time. Boot is keyboard (Space fires, click does
 *            not). Mix adds mouse buttons/wheel on top of WASD. Gamepad is the
 *            pad alone. Touch is the overlay alone. Escape always opens pause
 *            so the player can switch. IJKL remains a keyboard debug rig.
 * Leveling:  N/A — input does not scale. Hull slowdown is C02/E07 reading C03.
 * Graphics:  N/A (overlay chrome is G12).
 * Pillars:   1 (instant decision — the ship answers the same frame)
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
 * Mocks: fake EventTarget (no window required); GamepadSource stub with
 *        axes/buttons/actuator; pass preventDefaultCodes explicitly
 *
 * describe('InputState keyboard')
 *   it('reports isDown true after keydown and false after keyup')            // R1
 *   it('clears every code on blur, including Shift synthetics')              // R2
 *   it('synthesizes Shift+KeyX while ShiftLeft is held')                     // R3
 *   it('synthesizes Shift+KeyX while ShiftRight is held')                    // R3
 *   it('removes both KeyX and Shift+KeyX on keyup of KeyX')                  // R3
 *   it('keeps the base key down alongside the Shift combo')                  // R4, Acceptance
 *   it('lets WASD, IJKL and Shift+IJKL coexist in the same down-set')        // R4, SHIP-01
 *   it('calls preventDefault on listed codes and not on others')             // R5
 *   it('does not write axes from mousemove (pointer-steer is out)')         // R6, SHIP-04
 *   it('dispose removes listeners so later events are ignored')              // R7
 *   it('isDown does not allocate (no new Set / array per call)')             // R8
 *   it('matches POC-1 combo spelling Shift+KeyI (not ShiftLeft+KeyI)')       // port fidelity
 *
 * describe('InputState gamepad')
 *   it('axis moveX is 0 inside the deadzone and rescales outside')           // R10
 *   it('stick-up (axis 1 = -1) yields axis moveZ < 0 when invertMoveZ is false') // R9, Q12
 *   it('keyboard fills axis when the stick is at rest')                      // R9
 *   it('stick wins the axis when |stick| > 0 after deadzone')                // gamepad scheme
 *   it('isPressed fire is true when RT value >= triggerThreshold')           // gamepad
 *   it('isPressed fire is true when Space is down with no pad')              // R11
 *   it('isPressed switchWeapon is true when LB is pressed')                  // R11
 *   it('isPressed pause is true when Start is pressed')                      // R11
 *   it('connectedPadCount counts non-null snapshots')                        // R15
 *   it('update does not allocate')                                           // R8, R14
 *
 * describe('InputState rumble')
 *   it('rumble no-ops and does not throw when there is no actuator')         // R12
 *   it('rumble no-ops when haptics.enabled is false')                        // R12
 *   it('rumble calls playEffect dual-rumble with the shieldHit preset')      // R13
 *   it('a second rumble may preempt the first (playEffect called twice)')    // R13
 *
 * describe('InputState scheme')
 *   it('defaults to keyboard')                                              // R9
 *   it('keyboard scheme ignores mouse fire')                                // R9, R11
 *   it('mix scheme lets WASD move and left-click fire')                     // R9, R11
 *   it('gamepad scheme ignores Space fire and uses RT')                     // R9, R11
 *   it('touch scheme uses TouchSource axis and ignores WASD')                // R9
 *   it('Escape still latches pause on a non-keyboard scheme')                // R11
 *
 * describe('InputState live remaps')
 *   it('keyboard fire follows bindings.keyboard.fire')                       // R18
 *   it('gamepad fire follows remapped button index')                         // R18
 *
 * describe('InputState D19 mouse + touch')
 *   it('left mouse button holds fire; right button consumePress bomb once')  // mix
 *   it('prevents contextmenu when bomb is bound to button 2')                // mix
 *   it('wheel notch consumePress switchWeapon once per delta')               // mix
 *   it('touch stick fills axis on the touch scheme')                         // R9
 *   it('gamepad stick is ignored on the touch scheme')                       // R9
 *   it('consumePress dash is true for ControlLeft and for LT')               // R11
 *
 * Manual:
 *   A-manual-1. [manual] alt-tab away mid-hold; return; ship must not keep
 *               drifting (blur clear).
 *   A-manual-2. [manual] with Gamepad selected: left stick flies, RT fires;
 *               WASD and left-click do nothing until Mix / Keyboard is picked.
 *   A-manual-3. [manual] shield-hit buzzes; keyboard-only never throws.
 *   A-manual-4. [manual] Mix: WASD + left-click fires; right-click bombs;
 *               wheel switches; cursor does not drag the ship.
 *   A-manual-5. [manual] pause overlay radios switch the active scheme.
 *
 * Coverage: R1–R17 + exclusive schemes + D18 + D19.
 */
