/**
 * #tag/arch #tag/controls
 *
 * Card:         SDD-A02 Input
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: SHIP-01, SHIP-13 (POC2 play), SHIP-04 (Q07: pointer deferred)
 * Change type:  class-ify (+ Gamepad API + dual-rumble, D18)
 * POC-1 origin: poc/src/core/input.ts  — frozen keyboard reference
 * Test file:    poc2/src/core/input.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      The input state machine for **keyboard + Gamepad API**. `class
 *            InputState` listens on an injected EventTarget (default `window`),
 *            tracks which codes are down, synthesizes `Shift+KeyX` combos,
 *            `preventDefault`s the BALANCE-declared control codes, and clears
 *            on `blur`. Once per `update(dt)` it polls `getGamepads()`, applies
 *            deadzone / trigger threshold, and exposes analog axes + named
 *            actions. `rumble(preset)` plays `dual-rumble` on the active pad's
 *            `vibrationActuator`.
 * Does not own: mapping axes to ship/camera motion (SDD-C02), fire/switch
 *            consumption (SDD-E07), pause overlay focus (SDD-G11), pointer
 *            (Q07 deferred), or persistent remap / Steam Input (SHIP-13 G3).
 * Player-facing: sticky keys after alt-tab, swallowed WASD, Shift combos
 *            fighting IJKL, a dead stick, RT that never fires, or rumble that
 *            throws on keyboard-only all feel like broken controls.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Upstream:
 *   SDD-A01 Balancer — BALANCE.controls.gamepad, BALANCE.haptics,
 *                      BALANCE.gameplay.fireKey / switchKey / pauseKey
 * Downstream:
 *   SDD-C02 Controller — axis('moveX'|'moveZ') + isDown(camera keys)
 *   SDD-E07 FiringManager — isPressed('fire' | 'switchWeapon')
 *   SDD-F05 VfxManager — rumble(preset) on shield/hull/break/destroyed
 *   SDD-G03 RunScene — calls update(dt) at the start of step
 *   SDD-G11 PauseScene — isPressed('pause'); overlay still owns consume/focus
 */

// ─── 9. Agent sign-off ───────────────────────────────────────────────────────
/**
 * Orchestrator : hub-v4.2 / 2026-08-17  scope, requires, DoD, D18
 * Programming  : hub-v4.2 / 2026-08-17  contract, pad poll, rumble no-op, inject
 * Game Design  : hub-v4.2 / 2026-08-17  W3C map, deadzone, trigger, haptic presets
 * TDD          : hub-v4.2 / 2026-08-17  cases named; test file not yet written (red next)
 * Status: spec-complete
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Programming / Three.js
// ═════════════════════════════════════════════════════════════════════════════

/** Logical actions. Keyboard codes and pad buttons both resolve here. */
export type InputAction =
  | 'fire'
  | 'switchWeapon'
  | 'pause'
  | 'boost'
  | 'special'

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
  /** Poll pads. Keyboard is event-driven; this must still be cheap and alloc-free. */
  update(dt: number): void
  isDown(code: string): boolean
  /** −1..1 after deadzone (and invertMoveZ on moveZ). Keyboard fills ±1 when stick is 0. */
  axis(id: AxisId): number
  /** True while the action is held (keyboard code OR pad button/trigger). */
  isPressed(action: InputAction): boolean
  /** Fire-and-forget dual-rumble. No-ops without an actuator. Never throws. */
  rumble(preset: RumblePreset): void
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

/** Construction data. Target and pad source are injected so tests do not need `window`. */
export interface InputStateOptions {
  /** Defaults to `window` in the browser. Tests pass a fake EventTarget. */
  readonly target?: EventTarget
  /**
   * Codes that call `preventDefault` on keydown. Built from
   * `BALANCE.controls` + `BALANCE.gameplay.fireKey` / `switchKey` / `pauseKey`
   * plus `ShiftLeft` / `ShiftRight`. Never a hardcoded gameplay list in the class.
   */
  readonly preventDefaultCodes: readonly string[]
  /**
   * Defaults to `() => navigator.getGamepads()` in the browser.
   * Tests pass a stub. Missing / empty list = keyboard-only.
   */
  readonly gamepads?: GamepadSource
}

export declare class InputState implements InputPort {
  constructor(options: InputStateOptions)

  update(dt: number): void
  isDown(code: string): boolean
  axis(id: AxisId): number
  isPressed(action: InputAction): boolean
  rumble(preset: RumblePreset): void
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
 *   _pad                 | GamepadSnap|null| first standard (else first non-null)
 *   _axisX / _axisZ      | number          | last polled stick, −1..1
 *   preventDefaultCodes  | readonly string[] | codes that eat the browser default
 *
 *   update(dt)    — poll getGamepads(); pick active pad; write axes after deadzone.
 *                   dt unused for sampling (W3C snapshot is already current).
 *   isDown(code)  — O(1) has(); does not consume; does not allocate.
 *   axis(id)      — stick if |stick| > 0, else keyboard digital −1/0/1.
 *   isPressed(a)  — keyboard code for that action OR pad button/trigger.
 *   rumble(p)     — playEffect('dual-rumble', BALANCE.haptics.presets[p]).
 *                   Do not await. Swallow rejection. No-op if disabled / no actuator.
 *   dispose()     — removeEventListener for keydown, keyup, blur,
 *                   gamepadconnected, gamepaddisconnected; clear the set.
 *
 * Keydown: add e.code; if Shift is already down and e.code is not a Shift key,
 * add `Shift+${e.code}` as well. The base code stays in the set (R4).
 * Keyup: delete e.code and `Shift+${e.code}`; if the released code is a Shift
 * key, set `_shiftPressed = false`.
 * Blur: `_keys.clear()` and `_shiftPressed = false`. Pad axes stay until the
 * next update() (pads do not blur).
 *
 * Active pad: prefer mapping === 'standard'; else first non-null snapshot.
 * Deadzone (per axis): |v| < dz → 0; else rescale (v − sign(v)*dz) / (1 − dz).
 * invertMoveZ: after deadzone, moveZ = invert ? −raw : raw. Default false (Q12).
 * Analog trigger (RT/LT): pressed when button.value >= triggerThreshold.
 * Digital buttons: pressed when pressed === true OR value >= triggerThreshold.
 *
 * W3C standard indices (BALANCE.controls.gamepad, do not hardcode in the class):
 *   axes 0/1 left stick; buttons 7 RT fire, 4 LB switch, 9 Start pause,
 *   6 LT boost, 0 South/A special.
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
 *   R7. Memory: created-once. dispose must reach: keydown, keyup, blur,
 *       gamepadconnected, gamepaddisconnected listeners.
 *   R8. Per-frame allocation: none. isDown / axis / isPressed / update do not
 *       allocate. The down-set is mutated in event handlers only. Pad poll
 *       writes scalars. rumble may allocate the effect params object once per
 *       call (not per frame).
 *   R9. Keyboard and gamepad coexist. No mode toggle. Stick wins an axis when
 *       |stick| > 0 after deadzone; otherwise keyboard digital fills it.
 *   R10. |axis| < deadzone becomes 0; remaining range is rescaled to [−1, 1].
 *   R11. isPressed('fire') is true for fireKey OR RT (button 7) above threshold.
 *        isPressed('switchWeapon') for switchKey OR LB (button 4).
 *        isPressed('pause') for pauseKey OR Start (button 9).
 *   R12. rumble() no-ops when haptics.enabled is false, connectedPadCount is 0,
 *        or vibrationActuator is null. It never throws.
 *   R13. rumble() calls playEffect('dual-rumble', { startDelay: 0, duration,
 *        strongMagnitude, weakMagnitude }) from BALANCE.haptics.presets[preset].
 *        A new call may preempt an in-flight effect (browser).
 *   R14. update(dt) must be called by G03 each step. GameLoop does not poll pads.
 *   R15. connectedPadCount is the number of non-null snapshots from getGamepads().
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
 *   BALANCE.gameplay.fireKey               = 'Space'
 *   BALANCE.gameplay.switchKey             = 'KeyF'
 *   BALANCE.gameplay.pauseKey              = 'Escape'
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
 *   BALANCE.controls.gamepad.buttons.fire      = 7       // RT
 *   BALANCE.controls.gamepad.buttons.switchWeapon = 4    // LB
 *   BALANCE.controls.gamepad.buttons.pause     = 9       // Start
 *   BALANCE.controls.gamepad.buttons.boost     = 6       // LT (SHIP-08 later)
 *   BALANCE.controls.gamepad.buttons.special   = 0       // South / A (bombs §7)
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
 * Feel:      simultaneous ship (WASD or left stick) and camera (IJKL/UO) with
 *            Shift-rotate on the camera cluster. No mode toggle. Alt-tab must
 *            not leave a stuck Shift or WASD (blur clear). Stick-up is forward
 *            like W. RT is hold-to-fire like Space. Deadzone 0.18 kills idle
 *            drift without eating fine aim. Shield ticks buzz the weak motor;
 *            hull hits kick the strong motor; destroy is a long rumble.
 *            Matches POC-1 keyboard; pad is additive (D18).
 * Leveling:  N/A — input does not scale. Hull slowdown is C02/E07 reading C03.
 * Graphics:  N/A.
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
 *   it('does not attach pointer or mouse listeners')                         // R6, Q07
 *   it('dispose removes listeners so later events are ignored')              // R7
 *   it('isDown does not allocate (no new Set / array per call)')             // R8
 *   it('matches POC-1 combo spelling Shift+KeyI (not ShiftLeft+KeyI)')       // port fidelity
 *
 * describe('InputState gamepad')
 *   it('axis moveX is 0 inside the deadzone and rescales outside')           // R10
 *   it('stick-up (axis 1 = -1) yields axis moveZ < 0 when invertMoveZ is false') // R9, Q12
 *   it('keyboard fills axis when the stick is at rest')                      // R9
 *   it('stick wins the axis when |stick| > 0 after deadzone')                // R9
 *   it('isPressed fire is true when RT value >= triggerThreshold')           // R11
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
 * Manual:
 *   A-manual-1. [manual] alt-tab away mid-hold; return; ship must not keep
 *               drifting (blur clear).
 *   A-manual-2. [manual] Xbox/DualShock: left stick flies, RT fires, LB
 *               switches, Start pauses; WASD still works with the pad plugged.
 *   A-manual-3. [manual] shield-hit buzzes; keyboard-only never throws.
 *
 * Coverage: R1–R15 + card Acceptance (WASD+IJKL coexist; stick moves; RT fires;
 * rumble when actuator present) + Q07 + D18.
 */
