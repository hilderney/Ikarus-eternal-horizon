import { describe, expect, it } from 'vitest'
import { BALANCE } from './balancer'
import {
  assignGamepadButton,
  assignKeyboard,
  assignMouse,
  assignTouchSlot,
  createInputBindings,
  formatGamepadButton,
  formatKeyCode,
  formatMouseButton,
  isKeyboardBound,
  resetInputBindings,
} from './input-bindings'

describe('createInputBindings', () => {
  it('clones BALANCE keyboard, mouse and gamepad defaults', () => {
    const bindings = createInputBindings()
    expect(bindings.keyboard.fire).toBe(BALANCE.gameplay.fireKey)
    expect(bindings.keyboard.moveZMinus).toBe(BALANCE.controls.shipKeys.moveZMinus)
    expect(bindings.mouse.fireButton).toBe(BALANCE.controls.mouse.fireButton)
    expect(bindings.gamepad.buttons.fire).toBe(BALANCE.controls.gamepad.buttons.fire)
    expect(bindings.touch.slots).toEqual(['fire', 'bomb', 'switchWeapon', 'switchBomb', 'dash', 'pause'])
    bindings.keyboard.fire = 'KeyG'
    expect(BALANCE.gameplay.fireKey).toBe('KeyF')
  })
})

describe('assignKeyboard', () => {
  it('writes the new code and swaps a colliding bind', () => {
    const bindings = createInputBindings()
    assignKeyboard(bindings, 'fire', 'KeyE')
    expect(bindings.keyboard.fire).toBe('KeyE')
    expect(bindings.keyboard.bomb).toBe('KeyT')
  })
})

describe('assignMouse', () => {
  it('swaps colliding mouse buttons', () => {
    const bindings = createInputBindings()
    assignMouse(bindings, 'fireButton', 2)
    expect(bindings.mouse.fireButton).toBe(2)
    expect(bindings.mouse.bombButton).toBe(0)
  })
})

describe('assignGamepadButton', () => {
  it('swaps colliding pad indices', () => {
    const bindings = createInputBindings()
    assignGamepadButton(bindings, 'fire', 0)
    expect(bindings.gamepad.buttons.fire).toBe(0)
    expect(bindings.gamepad.buttons.bomb).toBe(3)
  })
})

describe('assignTouchSlot', () => {
  it('swaps overlay slots that share an action', () => {
    const bindings = createInputBindings()
    assignTouchSlot(bindings, 0, 'dash')
    expect(bindings.touch.slots[0]).toBe('dash')
    expect(bindings.touch.slots[4]).toBe('fire')
  })
})

describe('resetInputBindings', () => {
  it('restores BALANCE defaults', () => {
    const bindings = createInputBindings()
    assignKeyboard(bindings, 'fire', 'KeyG')
    resetInputBindings(bindings)
    expect(bindings.keyboard.fire).toBe('KeyF')
  })
})

describe('formatters', () => {
  it('labels keys, mouse buttons and W3C pad indices', () => {
    expect(formatKeyCode('KeyW')).toBe('W')
    expect(formatKeyCode('ControlLeft')).toBe('LCtrl')
    expect(formatMouseButton(0)).toBe('Left')
    expect(formatGamepadButton(7)).toBe('RT')
    expect(isKeyboardBound(createInputBindings(), 'Space')).toBe(true)
    expect(isKeyboardBound(createInputBindings(), 'KeyG')).toBe(true)
    expect(isKeyboardBound(createInputBindings(), 'KeyE')).toBe(false)
  })
})
