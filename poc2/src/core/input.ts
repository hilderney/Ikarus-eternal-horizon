/**
 * SDD-A02 Input — keyboard + Gamepad API + mouse buttons/wheel + TouchSource (D19).
 * Port of POC-1 keyboard behaviour; pad poll/rumble are D18; mouse/touch are D19.
 */

import { BALANCE } from './balancer'
import {
  createInputBindings,
  isKeyboardBound,
  type InputBindings,
} from './input-bindings'

/** Exclusive control schemes. Pause (G11) is the picker. Default: keyboard. */
export type ControlScheme = 'keyboard' | 'mix' | 'gamepad' | 'touch'

/** Logical actions. The active scheme resolves these (D19). */
export type InputAction =
  | 'fire'
  | 'bomb'
  | 'switchWeapon'
  | 'switchBomb'
  | 'dash'
  | 'pause'

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
  readonly target?: EventTarget
  readonly preventDefaultCodes: readonly string[]
  readonly gamepads?: GamepadSource
  readonly touch?: TouchSource
  readonly scheme?: ControlScheme
  /** Live remaps. Defaults to a clone of BALANCE. */
  readonly bindings?: InputBindings
  /** Defaults to BALANCE.haptics.enabled. Tests may override. */
  readonly hapticsEnabled?: boolean
}

const FIRE_BIT = 1
const BOMB_BIT = 2
const SWITCH_WEAPON_BIT = 4
const SWITCH_BOMB_BIT = 8
const DASH_BIT = 16
const PAUSE_BIT = 32

const ZERO_TOUCH: TouchSource = {
  axisX: 0,
  axisZ: 0,
  isPressed(): boolean {
    return false
  },
}

function actionBit(action: InputAction): number {
  switch (action) {
    case 'fire':
      return FIRE_BIT
    case 'bomb':
      return BOMB_BIT
    case 'switchWeapon':
      return SWITCH_WEAPON_BIT
    case 'switchBomb':
      return SWITCH_BOMB_BIT
    case 'dash':
      return DASH_BIT
    case 'pause':
      return PAUSE_BIT
  }
}

function applyDeadzone(value: number, deadzone: number): number {
  if (Math.abs(value) < deadzone) {
    return 0
  }
  const sign = value < 0 ? -1 : 1
  return (sign * (Math.abs(value) - deadzone)) / (1 - deadzone)
}

function defaultGamepadSource(): GamepadSource {
  return {
    getGamepads(): readonly (GamepadSnap | null)[] {
      if (typeof navigator !== 'undefined' && navigator.getGamepads) {
        return navigator.getGamepads() as unknown as readonly (GamepadSnap | null)[]
      }
      return []
    },
  }
}

/** Union of ship, camera, gameplay and Shift codes from BALANCE — for preventDefault. */
export function buildPreventDefaultCodes(): readonly string[] {
  const codes = new Set<string>([
    ...Object.values(BALANCE.controls.shipKeys),
    ...Object.values(BALANCE.controls.camera.keys),
    BALANCE.gameplay.fireKey,
    BALANCE.gameplay.switchKey,
    BALANCE.gameplay.pauseKey,
    BALANCE.gameplay.bombKey,
    BALANCE.gameplay.switchBombKey,
    BALANCE.gameplay.dashKey,
    'ShiftLeft',
    'ShiftRight',
  ])
  return [...codes]
}

export class InputState implements InputPort {
  private readonly _keys = new Set<string>()
  private _shiftPressed = false
  private readonly _target: EventTarget
  private readonly _gamepads: GamepadSource
  private readonly _touch: TouchSource
  private readonly _preventDefaultCodes: ReadonlySet<string>
  private readonly _hapticsEnabled: boolean
  private readonly _bindings: InputBindings
  private _scheme: ControlScheme
  private _pad: GamepadSnap | null = null
  private _padAxisX = 0
  private _padAxisZ = 0
  private _connectedPadCount = 0
  private _mouseButtons = 0
  private _prevBits = 0
  private _edgeBits = 0
  private _disposed = false

  private readonly _onKeyDown = (event: Event): void => {
    const e = event as KeyboardEvent
    if (this._preventDefaultCodes.has(e.code) || isKeyboardBound(this._bindings, e.code)) {
      e.preventDefault()
    }
    this._keys.add(e.code)
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      this._shiftPressed = true
    } else if (this._shiftPressed) {
      this._keys.add(`Shift+${e.code}`)
    }
    this._latchHeld()
  }

  private readonly _onKeyUp = (event: Event): void => {
    const e = event as KeyboardEvent
    this._keys.delete(e.code)
    this._keys.delete(`Shift+${e.code}`)
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      this._shiftPressed = false
    }
    this._latchHeld()
  }

  private readonly _onBlur = (): void => {
    this._keys.clear()
    this._shiftPressed = false
    this._mouseButtons = 0
    this._prevBits = 0
    this._edgeBits = 0
  }

  private readonly _onPointerDown = (event: Event): void => {
    const e = event as PointerEvent
    this._mouseButtons |= 1 << e.button
    this._latchHeld()
  }

  private readonly _onPointerUp = (event: Event): void => {
    const e = event as PointerEvent
    this._mouseButtons &= ~(1 << e.button)
    this._latchHeld()
  }

  private readonly _onPointerCancel = (): void => {
    this._mouseButtons = 0
    this._latchHeld()
  }

  private readonly _onWheel = (event: Event): void => {
    if (this._scheme !== 'mix') {
      return
    }
    const e = event as WheelEvent
    if (e.deltaY === 0) {
      return
    }
    e.preventDefault()
    this._edgeBits |= e.deltaY < 0 ? SWITCH_BOMB_BIT : SWITCH_WEAPON_BIT
  }

  private readonly _onContextMenu = (event: Event): void => {
    if (this._scheme !== 'mix' || this._bindings.mouse.bombButton !== 2) {
      return
    }
    event.preventDefault()
  }

  private readonly _onGamepadConnected = (): void => {
    // Pad list refreshes on the next update(dt).
  }

  private readonly _onGamepadDisconnected = (): void => {
    // Pad list refreshes on the next update(dt).
  }

  constructor(options: InputStateOptions) {
    this._preventDefaultCodes = new Set(options.preventDefaultCodes)
    this._target = options.target ?? window
    this._gamepads = options.gamepads ?? defaultGamepadSource()
    this._touch = options.touch ?? ZERO_TOUCH
    this._hapticsEnabled = options.hapticsEnabled ?? BALANCE.haptics.enabled
    this._bindings = options.bindings ?? createInputBindings()
    this._scheme = options.scheme ?? 'keyboard'

    this._target.addEventListener('keydown', this._onKeyDown)
    this._target.addEventListener('keyup', this._onKeyUp)
    this._target.addEventListener('blur', this._onBlur)
    this._target.addEventListener('pointerdown', this._onPointerDown)
    this._target.addEventListener('pointerup', this._onPointerUp)
    this._target.addEventListener('pointercancel', this._onPointerCancel)
    this._target.addEventListener('wheel', this._onWheel, { passive: false })
    this._target.addEventListener('contextmenu', this._onContextMenu)
    this._target.addEventListener('gamepadconnected', this._onGamepadConnected)
    this._target.addEventListener('gamepaddisconnected', this._onGamepadDisconnected)
  }

  update(dt: number): void {
    void dt
    const pads = this._gamepads.getGamepads()
    this._connectedPadCount = 0
    this._pad = null

    for (const pad of pads) {
      if (pad) {
        this._connectedPadCount++
      }
    }

    for (const pad of pads) {
      if (!pad) {
        continue
      }
      if (!this._pad) {
        this._pad = pad
      }
      if (pad.mapping === 'standard') {
        this._pad = pad
        break
      }
    }

    const gp = this._bindings.gamepad
    const deadzone = BALANCE.controls.gamepad.deadzone
    if (this._pad) {
      const rawX = this._pad.axes[gp.axes.moveX] ?? 0
      let rawZ = this._pad.axes[gp.axes.moveZ] ?? 0
      this._padAxisX = applyDeadzone(rawX, deadzone)
      rawZ = applyDeadzone(rawZ, deadzone)
      this._padAxisZ = gp.invertMoveZ ? -rawZ : rawZ
    } else {
      this._padAxisX = 0
      this._padAxisZ = 0
    }

    this._latchHeld()
  }

  isDown(code: string): boolean {
    return this._keys.has(code)
  }

  axis(id: AxisId): number {
    if (this._scheme === 'gamepad') {
      return id === 'moveX' ? this._padAxisX : this._padAxisZ
    }

    if (this._scheme === 'touch') {
      const dz = BALANCE.controls.touch.deadzone
      return id === 'moveX'
        ? applyDeadzone(this._touch.axisX, dz)
        : applyDeadzone(this._touch.axisZ, dz)
    }

    const keys = this._bindings.keyboard
    if (id === 'moveX') {
      let dir = 0
      if (this._keys.has(keys.moveXPlus)) {
        dir += 1
      }
      if (this._keys.has(keys.moveXMinus)) {
        dir -= 1
      }
      return dir
    }

    let dir = 0
    if (this._keys.has(keys.moveZPlus)) {
      dir += 1
    }
    if (this._keys.has(keys.moveZMinus)) {
      dir -= 1
    }
    return dir
  }

  isPressed(action: InputAction): boolean {
    if (action === 'pause' && this._keys.has('Escape')) {
      return true
    }

    const gp = this._bindings.gamepad
    const keys = this._bindings.keyboard
    const mouse = this._bindings.mouse
    const useKeys = this._usesKeys()
    const mouseOn = this._scheme === 'mix'
    const padOn = this._scheme === 'gamepad'
    const touchOn = this._scheme === 'touch'

    let held = touchOn && this._touch.isPressed(action)

    switch (action) {
      case 'fire':
        held =
          held ||
          (useKeys && this._keys.has(keys.fire)) ||
          (padOn && this._isPadButtonPressed(gp.buttons.fire)) ||
          (mouseOn && this._isMouseDown(mouse.fireButton))
        break
      case 'bomb':
        held =
          held ||
          (useKeys && this._keys.has(keys.bomb)) ||
          (padOn && this._isPadButtonPressed(gp.buttons.bomb)) ||
          (mouseOn && this._isMouseDown(mouse.bombButton))
        break
      case 'switchWeapon':
        held =
          held ||
          (useKeys && this._keys.has(keys.switchWeapon)) ||
          (padOn && this._isPadButtonPressed(gp.buttons.switchWeapon))
        break
      case 'switchBomb':
        held =
          held ||
          (useKeys && this._keys.has(keys.switchBomb)) ||
          (padOn && this._isPadButtonPressed(gp.buttons.switchBomb))
        break
      case 'dash':
        held =
          held ||
          (useKeys && this._keys.has(keys.dash)) ||
          (padOn && this._isPadButtonPressed(gp.buttons.dash))
        break
      case 'pause':
        held =
          held ||
          (useKeys && this._keys.has(keys.pause)) ||
          (padOn && this._isPadButtonPressed(gp.buttons.pause))
        break
    }

    return held
  }

  get scheme(): ControlScheme {
    return this._scheme
  }

  setScheme(scheme: ControlScheme): void {
    if (scheme === this._scheme) {
      return
    }
    this._scheme = scheme
    this._mouseButtons = 0
    this._prevBits = 0
    this._edgeBits = 0
    this._latchHeld()
  }

  consumePress(action: InputAction): boolean {
    const bit = actionBit(action)
    if ((this._edgeBits & bit) === 0) {
      return false
    }
    this._edgeBits &= ~bit
    return true
  }

  rumble(preset: RumblePreset): void {
    if (!this._hapticsEnabled || !this._pad?.vibrationActuator) {
      return
    }
    const effect = BALANCE.haptics.presets[preset]
    void this._pad.vibrationActuator
      .playEffect('dual-rumble', {
        startDelay: 0,
        duration: effect.durationMs,
        strongMagnitude: effect.strongMagnitude,
        weakMagnitude: effect.weakMagnitude,
      })
      .catch(() => {
        // Browser may reject missing actuator — never throw (R12).
      })
  }

  get connectedPadCount(): number {
    return this._connectedPadCount
  }

  get bindings(): InputBindings {
    return this._bindings
  }

  dispose(): void {
    if (this._disposed) {
      return
    }
    this._disposed = true
    this._target.removeEventListener('keydown', this._onKeyDown)
    this._target.removeEventListener('keyup', this._onKeyUp)
    this._target.removeEventListener('blur', this._onBlur)
    this._target.removeEventListener('pointerdown', this._onPointerDown)
    this._target.removeEventListener('pointerup', this._onPointerUp)
    this._target.removeEventListener('pointercancel', this._onPointerCancel)
    this._target.removeEventListener('wheel', this._onWheel)
    this._target.removeEventListener('contextmenu', this._onContextMenu)
    this._target.removeEventListener('gamepadconnected', this._onGamepadConnected)
    this._target.removeEventListener('gamepaddisconnected', this._onGamepadDisconnected)
    this._keys.clear()
    this._shiftPressed = false
    this._mouseButtons = 0
    this._prevBits = 0
    this._edgeBits = 0
    this._pad = null
  }

  private _latchHeld(): void {
    let bits = 0
    if (this.isPressed('fire')) {
      bits |= FIRE_BIT
    }
    if (this.isPressed('bomb')) {
      bits |= BOMB_BIT
    }
    if (this.isPressed('switchWeapon')) {
      bits |= SWITCH_WEAPON_BIT
    }
    if (this.isPressed('switchBomb')) {
      bits |= SWITCH_BOMB_BIT
    }
    if (this.isPressed('dash')) {
      bits |= DASH_BIT
    }
    if (this.isPressed('pause')) {
      bits |= PAUSE_BIT
    }
    this._edgeBits |= bits & ~this._prevBits
    this._prevBits = bits
  }

  private _usesKeys(): boolean {
    return this._scheme === 'keyboard' || this._scheme === 'mix'
  }

  private _isMouseDown(button: number): boolean {
    return (this._mouseButtons & (1 << button)) !== 0
  }

  private _isPadButtonPressed(index: number): boolean {
    const button = this._pad?.buttons[index]
    if (!button) {
      return false
    }
    const threshold = BALANCE.controls.gamepad.triggerThreshold
    return button.pressed || button.value >= threshold
  }
}
