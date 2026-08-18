/**
 * SDD-A02 Input — keyboard + Gamepad API + dual-rumble haptics (D18).
 * Port of POC-1 keyboard behaviour; pad poll and rumble are POC2 additions.
 */

import { BALANCE } from './balancer'

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
  update(dt: number): void
  isDown(code: string): boolean
  axis(id: AxisId): number
  isPressed(action: InputAction): boolean
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
  readonly target?: EventTarget
  readonly preventDefaultCodes: readonly string[]
  readonly gamepads?: GamepadSource
  /** Defaults to BALANCE.haptics.enabled. Tests may override. */
  readonly hapticsEnabled?: boolean
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
  private readonly _preventDefaultCodes: ReadonlySet<string>
  private readonly _hapticsEnabled: boolean
  private _pad: GamepadSnap | null = null
  private _axisX = 0
  private _axisZ = 0
  private _connectedPadCount = 0
  private _disposed = false

  private readonly _onKeyDown = (event: Event): void => {
    const e = event as KeyboardEvent
    if (this._preventDefaultCodes.has(e.code)) {
      e.preventDefault()
    }
    this._keys.add(e.code)
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      this._shiftPressed = true
    } else if (this._shiftPressed) {
      this._keys.add(`Shift+${e.code}`)
    }
  }

  private readonly _onKeyUp = (event: Event): void => {
    const e = event as KeyboardEvent
    this._keys.delete(e.code)
    this._keys.delete(`Shift+${e.code}`)
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      this._shiftPressed = false
    }
  }

  private readonly _onBlur = (): void => {
    this._keys.clear()
    this._shiftPressed = false
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
    this._hapticsEnabled = options.hapticsEnabled ?? BALANCE.haptics.enabled

    this._target.addEventListener('keydown', this._onKeyDown)
    this._target.addEventListener('keyup', this._onKeyUp)
    this._target.addEventListener('blur', this._onBlur)
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

    const gp = BALANCE.controls.gamepad
    if (this._pad) {
      const rawX = this._pad.axes[gp.axes.moveX] ?? 0
      let rawZ = this._pad.axes[gp.axes.moveZ] ?? 0
      this._axisX = applyDeadzone(rawX, gp.deadzone)
      rawZ = applyDeadzone(rawZ, gp.deadzone)
      this._axisZ = gp.invertMoveZ ? -rawZ : rawZ
    } else {
      this._axisX = 0
      this._axisZ = 0
    }
  }

  isDown(code: string): boolean {
    return this._keys.has(code)
  }

  axis(id: AxisId): number {
    const stick = id === 'moveX' ? this._axisX : this._axisZ
    if (stick !== 0) {
      return stick
    }

    const keys = BALANCE.controls.shipKeys
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
    const gp = BALANCE.controls.gamepad
    const gameplay = BALANCE.gameplay

    switch (action) {
      case 'fire':
        return this._keys.has(gameplay.fireKey) || this._isPadButtonPressed(gp.buttons.fire)
      case 'switchWeapon':
        return (
          this._keys.has(gameplay.switchKey) || this._isPadButtonPressed(gp.buttons.switchWeapon)
        )
      case 'pause':
        return this._keys.has(gameplay.pauseKey) || this._isPadButtonPressed(gp.buttons.pause)
      case 'boost':
        return this._isPadButtonPressed(gp.buttons.boost)
      case 'special':
        return this._isPadButtonPressed(gp.buttons.special)
      default:
        return false
    }
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

  dispose(): void {
    if (this._disposed) {
      return
    }
    this._disposed = true
    this._target.removeEventListener('keydown', this._onKeyDown)
    this._target.removeEventListener('keyup', this._onKeyUp)
    this._target.removeEventListener('blur', this._onBlur)
    this._target.removeEventListener('gamepadconnected', this._onGamepadConnected)
    this._target.removeEventListener('gamepaddisconnected', this._onGamepadDisconnected)
    this._keys.clear()
    this._shiftPressed = false
    this._pad = null
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
