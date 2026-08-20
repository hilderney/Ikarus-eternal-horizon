/**
 * Live control remaps. BALANCE holds the defaults; InputState reads this table.
 */

import { BALANCE } from './balancer'

export type CombatBindAction =
  | 'fire'
  | 'bomb'
  | 'switchWeapon'
  | 'switchBomb'
  | 'dash'
  | 'pause'

export type KeyboardBindId =
  | 'moveXMinus'
  | 'moveXPlus'
  | 'moveZMinus'
  | 'moveZPlus'
  | 'fire'
  | 'bomb'
  | 'switchWeapon'
  | 'switchBomb'
  | 'dash'
  | 'pause'

export type GamepadButtonBindId =
  | 'fire'
  | 'bomb'
  | 'switchWeapon'
  | 'switchBomb'
  | 'dash'
  | 'pause'

export type MouseBindId = 'fireButton' | 'bombButton'

export type TouchSlotIndex = 0 | 1 | 2 | 3 | 4 | 5

export interface KeyboardBindings {
  moveXMinus: string
  moveXPlus: string
  moveZMinus: string
  moveZPlus: string
  fire: string
  bomb: string
  switchWeapon: string
  switchBomb: string
  dash: string
  pause: string
}

export interface MouseBindings {
  fireButton: number
  bombButton: number
}

export interface GamepadBindings {
  invertMoveZ: boolean
  axes: { moveX: number; moveZ: number }
  buttons: {
    fire: number
    bomb: number
    switchWeapon: number
    switchBomb: number
    dash: number
    pause: number
  }
}

export interface TouchBindings {
  slots: [
    CombatBindAction,
    CombatBindAction,
    CombatBindAction,
    CombatBindAction,
    CombatBindAction,
    CombatBindAction,
  ]
}

export interface InputBindings {
  keyboard: KeyboardBindings
  mouse: MouseBindings
  gamepad: GamepadBindings
  touch: TouchBindings
}

export const TOUCH_SLOT_DEFAULTS: TouchBindings['slots'] = [
  'fire',
  'bomb',
  'switchWeapon',
  'switchBomb',
  'dash',
  'pause',
]

export const KEYBOARD_BIND_IDS: readonly KeyboardBindId[] = [
  'moveZMinus',
  'moveZPlus',
  'moveXMinus',
  'moveXPlus',
  'fire',
  'bomb',
  'switchWeapon',
  'switchBomb',
  'dash',
  'pause',
]

export const GAMEPAD_BUTTON_BIND_IDS: readonly GamepadButtonBindId[] = [
  'fire',
  'bomb',
  'switchWeapon',
  'switchBomb',
  'dash',
  'pause',
]

export const MOUSE_BIND_IDS: readonly MouseBindId[] = ['fireButton', 'bombButton']

const PAD_BUTTON_LABELS = [
  'A',
  'B',
  'X',
  'Y',
  'LB',
  'RB',
  'LT',
  'RT',
  'Select',
  'Start',
  'L3',
  'R3',
  'D-Up',
  'D-Down',
  'D-Left',
  'D-Right',
] as const

const MOUSE_BUTTON_LABELS = ['Left', 'Middle', 'Right'] as const

export function createInputBindings(): InputBindings {
  return cloneInputBindings(defaultsFromBalance())
}

export function resetInputBindings(target: InputBindings): void {
  copyInputBindings(defaultsFromBalance(), target)
}

export function cloneInputBindings(source: InputBindings): InputBindings {
  return {
    keyboard: { ...source.keyboard },
    mouse: { ...source.mouse },
    gamepad: {
      invertMoveZ: source.gamepad.invertMoveZ,
      axes: { ...source.gamepad.axes },
      buttons: { ...source.gamepad.buttons },
    },
    touch: { slots: [...source.touch.slots] },
  }
}

export function assignKeyboard(bindings: InputBindings, id: KeyboardBindId, code: string): void {
  const map = bindings.keyboard
  const previous = map[id]
  if (previous === code) {
    return
  }
  for (const key of KEYBOARD_BIND_IDS) {
    if (key !== id && map[key] === code) {
      map[key] = previous
    }
  }
  map[id] = code
}

export function assignMouse(bindings: InputBindings, id: MouseBindId, button: number): void {
  const map = bindings.mouse
  const previous = map[id]
  if (previous === button) {
    return
  }
  for (const key of MOUSE_BIND_IDS) {
    if (key !== id && map[key] === button) {
      map[key] = previous
    }
  }
  map[id] = button
}

export function assignGamepadButton(
  bindings: InputBindings,
  id: GamepadButtonBindId,
  button: number,
): void {
  const map = bindings.gamepad.buttons
  const previous = map[id]
  if (previous === button) {
    return
  }
  for (const key of GAMEPAD_BUTTON_BIND_IDS) {
    if (key !== id && map[key] === button) {
      map[key] = previous
    }
  }
  map[id] = button
}

export function assignTouchSlot(
  bindings: InputBindings,
  index: TouchSlotIndex,
  action: CombatBindAction,
): void {
  const slots = bindings.touch.slots
  const previous = slots[index]
  if (previous === action) {
    return
  }
  const swapAt = slots.indexOf(action)
  slots[index] = action
  if (swapAt >= 0 && swapAt !== index) {
    slots[swapAt] = previous
  }
}

export function isKeyboardBound(bindings: InputBindings, code: string): boolean {
  const keys = bindings.keyboard
  return (
    keys.moveXMinus === code ||
    keys.moveXPlus === code ||
    keys.moveZMinus === code ||
    keys.moveZPlus === code ||
    keys.fire === code ||
    keys.bomb === code ||
    keys.switchWeapon === code ||
    keys.switchBomb === code ||
    keys.dash === code ||
    keys.pause === code
  )
}

export function formatKeyCode(code: string): string {
  if (code === 'Space') {
    return 'Space'
  }
  if (code === 'ControlLeft') {
    return 'LCtrl'
  }
  if (code === 'ControlRight') {
    return 'RCtrl'
  }
  if (code === 'ShiftLeft') {
    return 'LShift'
  }
  if (code === 'ShiftRight') {
    return 'RShift'
  }
  if (code === 'AltLeft') {
    return 'LAlt'
  }
  if (code === 'AltRight') {
    return 'RAlt'
  }
  if (code.startsWith('Key') && code.length === 4) {
    return code.slice(3)
  }
  if (code.startsWith('Digit') && code.length === 6) {
    return code.slice(5)
  }
  if (code.startsWith('Arrow')) {
    return code.slice(5)
  }
  return code
}

export function formatMouseButton(button: number): string {
  return MOUSE_BUTTON_LABELS[button] ?? `Btn ${button}`
}

export function formatGamepadButton(index: number): string {
  return PAD_BUTTON_LABELS[index] ?? `Btn ${index}`
}

function defaultsFromBalance(): InputBindings {
  const gp = BALANCE.controls.gamepad
  const keys = BALANCE.controls.shipKeys
  const mouse = BALANCE.controls.mouse
  const play = BALANCE.gameplay
  return {
    keyboard: {
      moveXMinus: keys.moveXMinus,
      moveXPlus: keys.moveXPlus,
      moveZMinus: keys.moveZMinus,
      moveZPlus: keys.moveZPlus,
      fire: play.fireKey,
      bomb: play.bombKey,
      switchWeapon: play.switchKey,
      switchBomb: play.switchBombKey,
      dash: play.dashKey,
      pause: play.pauseKey,
    },
    mouse: {
      fireButton: mouse.fireButton,
      bombButton: mouse.bombButton,
    },
    gamepad: {
      invertMoveZ: gp.invertMoveZ,
      axes: { moveX: gp.axes.moveX, moveZ: gp.axes.moveZ },
      buttons: {
        fire: gp.buttons.fire,
        bomb: gp.buttons.bomb,
        switchWeapon: gp.buttons.switchWeapon,
        switchBomb: gp.buttons.switchBomb,
        dash: gp.buttons.dash,
        pause: gp.buttons.pause,
      },
    },
    touch: { slots: [...TOUCH_SLOT_DEFAULTS] },
  }
}

function copyInputBindings(source: InputBindings, target: InputBindings): void {
  Object.assign(target.keyboard, source.keyboard)
  Object.assign(target.mouse, source.mouse)
  target.gamepad.invertMoveZ = source.gamepad.invertMoveZ
  Object.assign(target.gamepad.axes, source.gamepad.axes)
  Object.assign(target.gamepad.buttons, source.gamepad.buttons)
  for (let i = 0; i < source.touch.slots.length; i += 1) {
    const action = source.touch.slots[i]
    if (action) {
      target.touch.slots[i] = action
    }
  }
}
