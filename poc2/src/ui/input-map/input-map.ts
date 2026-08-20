/**
 * SDD-G03 area-inputs — editable control map per scheme (keyboard / mix / gamepad / touch).
 */

import type { ControlScheme, GamepadSnap, GamepadSource } from '../../core/input'
import {
  GAMEPAD_BUTTON_BIND_IDS,
  KEYBOARD_BIND_IDS,
  assignGamepadButton,
  assignKeyboard,
  assignMouse,
  assignTouchSlot,
  createInputBindings,
  formatGamepadButton,
  formatKeyCode,
  formatMouseButton,
  resetInputBindings,
  type CombatBindAction,
  type GamepadButtonBindId,
  type InputBindings,
  type KeyboardBindId,
  type MouseBindId,
  type TouchSlotIndex,
} from '../../core/input-bindings'

export interface InputMapOptions {
  readonly bindings?: InputBindings
  readonly gamepads?: GamepadSource
  readonly onChange?: () => void
}

const SCHEMES: readonly { readonly id: ControlScheme; readonly label: string }[] = [
  { id: 'keyboard', label: 'Keyboard' },
  { id: 'mix', label: 'Mix' },
  { id: 'gamepad', label: 'Gamepad' },
  { id: 'touch', label: 'Touch' },
]

const KEY_ROWS: readonly { readonly id: KeyboardBindId; readonly label: string }[] = [
  { id: 'moveZMinus', label: 'Forward' },
  { id: 'moveZPlus', label: 'Back' },
  { id: 'moveXMinus', label: 'Left' },
  { id: 'moveXPlus', label: 'Right' },
  { id: 'fire', label: 'Fire' },
  { id: 'bomb', label: 'Bomb' },
  { id: 'switchWeapon', label: 'Switch weapon' },
  { id: 'switchBomb', label: 'Switch bomb' },
  { id: 'dash', label: 'Dash' },
  { id: 'pause', label: 'Pause' },
]

const MOUSE_ROWS: readonly { readonly id: MouseBindId; readonly label: string }[] = [
  { id: 'fireButton', label: 'Fire' },
  { id: 'bombButton', label: 'Bomb' },
]

const PAD_ROWS: readonly { readonly id: GamepadButtonBindId; readonly label: string }[] = [
  { id: 'fire', label: 'Fire' },
  { id: 'bomb', label: 'Bomb' },
  { id: 'switchWeapon', label: 'Switch weapon' },
  { id: 'switchBomb', label: 'Switch bomb' },
  { id: 'dash', label: 'Dash' },
  { id: 'pause', label: 'Pause' },
]

const TOUCH_ACTIONS: readonly CombatBindAction[] = [
  'fire',
  'bomb',
  'switchWeapon',
  'switchBomb',
  'dash',
  'pause',
]

const TOUCH_LABELS: Record<CombatBindAction, string> = {
  fire: 'Fire',
  bomb: 'Bomb',
  switchWeapon: 'Switch weapon',
  switchBomb: 'Switch bomb',
  dash: 'Dash',
  pause: 'Pause',
}

type ListenKind = 'key' | 'mouse' | 'pad'

interface ListenState {
  readonly kind: ListenKind
  readonly el: HTMLButtonElement
  readonly heldPad: ReadonlySet<number>
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

function firstPad(source: GamepadSource): GamepadSnap | null {
  const pads = source.getGamepads()
  let first: GamepadSnap | null = null
  for (const pad of pads) {
    if (!pad) {
      continue
    }
    if (!first) {
      first = pad
    }
    if (pad.mapping === 'standard') {
      return pad
    }
  }
  return first
}

function heldPadButtons(source: GamepadSource): Set<number> {
  const held = new Set<number>()
  const pad = firstPad(source)
  if (!pad) {
    return held
  }
  pad.buttons.forEach((button, index) => {
    if (button.pressed || button.value >= 0.35) {
      held.add(index)
    }
  })
  return held
}

export class InputMap {
  private readonly _bindings: InputBindings
  private readonly _gamepads: GamepadSource
  private readonly _onChange: (() => void) | undefined
  private readonly _selects = new Map<string, HTMLSelectElement | HTMLInputElement>()
  private _root: HTMLElement | null = null
  private _scheme: ControlScheme = 'keyboard'
  private _listen: ListenState | null = null
  private _disposed = false

  constructor(options: InputMapOptions = {}) {
    this._bindings = options.bindings ?? createInputBindings()
    this._gamepads = options.gamepads ?? defaultGamepadSource()
    this._onChange = options.onChange
  }

  get bindings(): InputBindings {
    return this._bindings
  }

  mount(host: HTMLElement): void {
    this.dispose()
    this._disposed = false
    const root = document.createElement('div')
    root.className = 'input-map'

    const title = document.createElement('h2')
    title.className = 'input-map-title'
    title.textContent = 'Controls'
    root.append(title)

    const tabs = document.createElement('nav')
    tabs.className = 'input-map-tabs'
    const panels = document.createElement('div')
    panels.className = 'input-map-panels'

    for (const entry of SCHEMES) {
      const radio = document.createElement('input')
      radio.type = 'radio'
      radio.name = 'input-map-scheme'
      radio.id = `input-map-${entry.id}`
      radio.value = entry.id
      radio.className = 'input-map-tab-input'
      radio.checked = entry.id === this._scheme
      radio.addEventListener('change', () => {
        if (!radio.checked) {
          return
        }
        this._setScheme(entry.id)
      })
      root.append(radio)

      const label = document.createElement('label')
      label.htmlFor = radio.id
      label.textContent = entry.label
      if (entry.id === this._scheme) {
        label.classList.add('is-active')
      }
      tabs.append(label)

      const panel = document.createElement('section')
      panel.className = 'input-map-panel'
      panel.dataset.scheme = entry.id
      if (entry.id === this._scheme) {
        panel.classList.add('is-active')
      }
      this._fillPanel(panel, entry.id)
      panels.append(panel)
    }

    const reset = document.createElement('button')
    reset.type = 'button'
    reset.className = 'input-map-reset'
    reset.textContent = 'Reset binds'
    reset.addEventListener('click', () => {
      this.reset()
    })

    root.append(tabs, panels, reset)
    host.replaceChildren(root)
    this._root = root
    this._syncLabels()
  }

  update(dt: number): void {
    void dt
    if (this._disposed || this._listen?.kind !== 'pad') {
      return
    }
    const pad = firstPad(this._gamepads)
    if (!pad) {
      return
    }
    for (let i = 0; i < pad.buttons.length; i += 1) {
      const button = pad.buttons[i]
      if (!button) {
        continue
      }
      const down = button.pressed || button.value >= 0.35
      if (!down || this._listen.heldPad.has(i)) {
        continue
      }
      const id = this._listen.el.dataset.bindId as GamepadButtonBindId | undefined
      if (!id || !GAMEPAD_BUTTON_BIND_IDS.includes(id)) {
        return
      }
      assignGamepadButton(this._bindings, id, i)
      this._stopListen()
      this._syncLabels()
      this._onChange?.()
      return
    }
  }

  reset(): void {
    this._stopListen()
    resetInputBindings(this._bindings)
    this._syncLabels()
    this._onChange?.()
  }

  dispose(): void {
    this._stopListen()
    this._root?.remove()
    this._root = null
    this._selects.clear()
    this._disposed = true
  }

  private _fillPanel(panel: HTMLElement, scheme: ControlScheme): void {
    if (scheme === 'keyboard' || scheme === 'mix') {
      if (scheme === 'mix') {
        this._note(panel, 'Keyboard keys + mouse. Wheel up switches bomb, wheel down switches weapon.')
      }
      this._group(panel, scheme === 'mix' ? 'Keyboard' : 'Keys')
      for (const row of KEY_ROWS) {
        this._bindButton(panel, `keyboard.${row.id}`, row.label, 'key', row.id)
      }
    }
    if (scheme === 'mix') {
      this._group(panel, 'Mouse')
      for (const row of MOUSE_ROWS) {
        this._bindButton(panel, `mouse.${row.id}`, row.label, 'mouse', row.id)
      }
    }
    if (scheme === 'gamepad') {
      this._group(panel, 'Stick')
      this._number(panel, 'gamepad.axes.moveX', 'Move X axis', () => this._bindings.gamepad.axes.moveX, (value) => {
        this._bindings.gamepad.axes.moveX = value
      })
      this._number(panel, 'gamepad.axes.moveZ', 'Move Z axis', () => this._bindings.gamepad.axes.moveZ, (value) => {
        this._bindings.gamepad.axes.moveZ = value
      })
      this._checkbox(panel, 'gamepad.invertMoveZ', 'Invert move Z', () => this._bindings.gamepad.invertMoveZ, (value) => {
        this._bindings.gamepad.invertMoveZ = value
      })
      this._group(panel, 'Buttons')
      for (const row of PAD_ROWS) {
        this._bindButton(panel, `gamepad.${row.id}`, row.label, 'pad', row.id)
      }
    }
    if (scheme === 'touch') {
      this._note(panel, 'Left stick moves. Buttons below remap overlay actions.')
      this._group(panel, 'Overlay buttons')
      for (let i = 0; i < 6; i += 1) {
        this._touchSlot(panel, i as TouchSlotIndex)
      }
    }
  }

  private _group(host: HTMLElement, label: string): void {
    const el = document.createElement('h3')
    el.className = 'input-map-group'
    el.textContent = label
    host.append(el)
  }

  private _note(host: HTMLElement, text: string): void {
    const el = document.createElement('p')
    el.className = 'input-map-note'
    el.textContent = text
    host.append(el)
  }

  private _bindButton(
    host: HTMLElement,
    path: string,
    label: string,
    kind: ListenKind,
    id: string,
  ): void {
    const row = document.createElement('div')
    row.className = 'input-bind'
    const name = document.createElement('span')
    name.textContent = label
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.bind = path
    button.dataset.bindKind = kind
    button.dataset.bindId = id
    button.addEventListener('click', () => {
      this._startListen(button, kind)
    })
    row.append(name, button)
    host.append(row)
  }

  private _touchSlot(host: HTMLElement, index: TouchSlotIndex): void {
    const row = document.createElement('div')
    row.className = 'input-bind'
    const name = document.createElement('span')
    name.textContent = `Slot ${index + 1}`
    const select = document.createElement('select')
    select.dataset.bind = `touch.slots.${index}`
    for (const action of TOUCH_ACTIONS) {
      const option = document.createElement('option')
      option.value = action
      option.textContent = TOUCH_LABELS[action]
      select.append(option)
    }
    select.addEventListener('change', () => {
      assignTouchSlot(this._bindings, index, select.value as CombatBindAction)
      this._syncLabels()
      this._onChange?.()
    })
    row.append(name, select)
    host.append(row)
    this._selects.set(`touch.slots.${index}`, select)
  }

  private _number(
    host: HTMLElement,
    path: string,
    label: string,
    read: () => number,
    write: (value: number) => void,
  ): void {
    const row = document.createElement('div')
    row.className = 'input-bind'
    const name = document.createElement('span')
    name.textContent = label
    const input = document.createElement('input')
    input.type = 'number'
    input.min = '0'
    input.max = '3'
    input.step = '1'
    input.dataset.bind = path
    input.value = String(read())
    input.addEventListener('input', () => {
      write(Number.parseInt(input.value, 10) || 0)
      this._onChange?.()
    })
    row.append(name, input)
    host.append(row)
    this._selects.set(path, input)
  }

  private _checkbox(
    host: HTMLElement,
    path: string,
    label: string,
    read: () => boolean,
    write: (value: boolean) => void,
  ): void {
    const row = document.createElement('label')
    row.className = 'input-bind'
    const name = document.createElement('span')
    name.textContent = label
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.dataset.bind = path
    input.checked = read()
    input.addEventListener('change', () => {
      write(input.checked)
      this._onChange?.()
    })
    row.append(name, input)
    host.append(row)
    this._selects.set(path, input)
  }

  private _startListen(el: HTMLButtonElement, kind: ListenKind): void {
    this._stopListen()
    this._listen = { kind, el, heldPad: heldPadButtons(this._gamepads) }
    el.classList.add('is-listening')
    el.textContent = kind === 'key' ? 'Press a key' : kind === 'mouse' ? 'Click a button' : 'Press a button'
    if (kind === 'key') {
      window.addEventListener('keydown', this._onListenKey, true)
    } else if (kind === 'mouse') {
      window.addEventListener('pointerdown', this._onListenMouse, true)
    }
  }

  private _stopListen(): void {
    if (!this._listen) {
      return
    }
    this._listen.el.classList.remove('is-listening')
    window.removeEventListener('keydown', this._onListenKey, true)
    window.removeEventListener('pointerdown', this._onListenMouse, true)
    this._listen = null
  }

  private readonly _onListenKey = (event: KeyboardEvent): void => {
    event.preventDefault()
    event.stopImmediatePropagation()
    if (event.code === 'Escape') {
      this._stopListen()
      this._syncLabels()
      return
    }
    const id = this._listen?.el.dataset.bindId as KeyboardBindId | undefined
    if (!id || !KEYBOARD_BIND_IDS.includes(id)) {
      this._stopListen()
      return
    }
    assignKeyboard(this._bindings, id, event.code)
    this._stopListen()
    this._syncLabels()
    this._onChange?.()
  }

  private readonly _onListenMouse = (event: PointerEvent): void => {
    event.preventDefault()
    event.stopImmediatePropagation()
    const id = this._listen?.el.dataset.bindId as MouseBindId | undefined
    if (!id) {
      this._stopListen()
      return
    }
    assignMouse(this._bindings, id, event.button)
    this._stopListen()
    this._syncLabels()
    this._onChange?.()
  }

  private _setScheme(scheme: ControlScheme): void {
    this._stopListen()
    this._scheme = scheme
    if (!this._root) {
      return
    }
    for (const panel of this._root.querySelectorAll('.input-map-panel')) {
      panel.classList.toggle('is-active', panel.getAttribute('data-scheme') === scheme)
    }
    for (const label of this._root.querySelectorAll('.input-map-tabs label')) {
      const htmlFor = label.getAttribute('for')
      label.classList.toggle('is-active', htmlFor === `input-map-${scheme}`)
    }
  }

  private _syncLabels(): void {
    if (!this._root) {
      return
    }
    for (const id of KEYBOARD_BIND_IDS) {
      const label = formatKeyCode(this._bindings.keyboard[id])
      for (const el of this._root.querySelectorAll<HTMLButtonElement>(`button[data-bind="keyboard.${id}"]`)) {
        if (this._listen?.el !== el) {
          el.textContent = label
        }
      }
    }
    for (const id of ['fireButton', 'bombButton'] as const) {
      const el = this._root.querySelector<HTMLButtonElement>(`button[data-bind="mouse.${id}"]`)
      if (el && this._listen?.el !== el) {
        el.textContent = formatMouseButton(this._bindings.mouse[id])
      }
    }
    for (const id of GAMEPAD_BUTTON_BIND_IDS) {
      const el = this._root.querySelector<HTMLButtonElement>(`button[data-bind="gamepad.${id}"]`)
      if (el && this._listen?.el !== el) {
        el.textContent = formatGamepadButton(this._bindings.gamepad.buttons[id])
      }
    }
    const axisX = this._selects.get('gamepad.axes.moveX')
    if (axisX instanceof HTMLInputElement) {
      axisX.value = String(this._bindings.gamepad.axes.moveX)
    }
    const axisZ = this._selects.get('gamepad.axes.moveZ')
    if (axisZ instanceof HTMLInputElement) {
      axisZ.value = String(this._bindings.gamepad.axes.moveZ)
    }
    const invert = this._selects.get('gamepad.invertMoveZ')
    if (invert instanceof HTMLInputElement) {
      invert.checked = this._bindings.gamepad.invertMoveZ
    }
    for (let i = 0; i < 6; i += 1) {
      const select = this._selects.get(`touch.slots.${i}`)
      const action = this._bindings.touch.slots[i]
      if (select instanceof HTMLSelectElement && action) {
        select.value = action
      }
    }
  }
}
