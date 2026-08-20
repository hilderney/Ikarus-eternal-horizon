// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BALANCE } from './balancer'
import {
  InputState,
  buildPreventDefaultCodes,
  type GamepadButtonSnap,
  type GamepadSnap,
  type GamepadSource,
} from './input'
import {
  assignGamepadButton,
  assignKeyboard,
  createInputBindings,
} from './input-bindings'

function makeTarget(): EventTarget {
  const el = document.createElement('div')
  document.body.append(el)
  return el
}

function dispatchKey(
  target: EventTarget,
  type: 'keydown' | 'keyup',
  code: string,
  init: Partial<KeyboardEventInit> = {},
): KeyboardEvent {
  const event = new KeyboardEvent(type, {
    code,
    bubbles: true,
    cancelable: true,
    ...init,
  })
  target.dispatchEvent(event)
  return event
}

function makeButtons(count: number, fill?: (i: number) => GamepadButtonSnap): GamepadButtonSnap[] {
  return Array.from({ length: count }, (_, i) =>
    fill ? fill(i) : { value: 0, pressed: false },
  )
}

function makePad(partial: {
  axes?: number[]
  buttons?: GamepadButtonSnap[]
  mapping?: string
  vibrationActuator?: GamepadSnap['vibrationActuator']
}): GamepadSnap {
  return {
    mapping: partial.mapping ?? 'standard',
    axes: partial.axes ?? [0, 0],
    buttons: partial.buttons ?? makeButtons(10),
    vibrationActuator: partial.vibrationActuator ?? null,
  }
}

function createTestInput(gamepads?: GamepadSource): { input: InputState; target: EventTarget } {
  const target = makeTarget()
  const input = new InputState({
    target,
    preventDefaultCodes: buildPreventDefaultCodes(),
    gamepads,
  })
  return { input, target }
}

describe('InputState keyboard', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reports isDown true after keydown and false after keyup', () => {
    const { input, target } = createTestInput()
    dispatchKey(target, 'keydown', 'KeyW')
    expect(input.isDown('KeyW')).toBe(true)
    dispatchKey(target, 'keyup', 'KeyW')
    expect(input.isDown('KeyW')).toBe(false)
    input.dispose()
  })

  it('clears every code on blur, including Shift synthetics', () => {
    const { input, target } = createTestInput()
    dispatchKey(target, 'keydown', 'ShiftLeft')
    dispatchKey(target, 'keydown', 'KeyI')
    expect(input.isDown('Shift+KeyI')).toBe(true)
    target.dispatchEvent(new Event('blur'))
    expect(input.isDown('KeyI')).toBe(false)
    expect(input.isDown('Shift+KeyI')).toBe(false)
    input.dispose()
  })

  it('synthesizes Shift+KeyX while ShiftLeft is held', () => {
    const { input, target } = createTestInput()
    dispatchKey(target, 'keydown', 'ShiftLeft')
    dispatchKey(target, 'keydown', 'KeyK')
    expect(input.isDown('Shift+KeyK')).toBe(true)
    input.dispose()
  })

  it('synthesizes Shift+KeyX while ShiftRight is held', () => {
    const { input, target } = createTestInput()
    dispatchKey(target, 'keydown', 'ShiftRight')
    dispatchKey(target, 'keydown', 'KeyU')
    expect(input.isDown('Shift+KeyU')).toBe(true)
    input.dispose()
  })

  it('removes both KeyX and Shift+KeyX on keyup of KeyX', () => {
    const { input, target } = createTestInput()
    dispatchKey(target, 'keydown', 'ShiftLeft')
    dispatchKey(target, 'keydown', 'KeyJ')
    dispatchKey(target, 'keyup', 'KeyJ')
    expect(input.isDown('KeyJ')).toBe(false)
    expect(input.isDown('Shift+KeyJ')).toBe(false)
    input.dispose()
  })

  it('keeps the base key down alongside the Shift combo', () => {
    const { input, target } = createTestInput()
    dispatchKey(target, 'keydown', 'ShiftLeft')
    dispatchKey(target, 'keydown', 'KeyI')
    expect(input.isDown('KeyI')).toBe(true)
    expect(input.isDown('Shift+KeyI')).toBe(true)
    input.dispose()
  })

  it('lets WASD, IJKL and Shift+IJKL coexist in the same down-set', () => {
    const { input, target } = createTestInput()
    dispatchKey(target, 'keydown', 'KeyW')
    dispatchKey(target, 'keydown', 'KeyA')
    dispatchKey(target, 'keydown', 'KeyD')
    dispatchKey(target, 'keydown', 'KeyS')
    dispatchKey(target, 'keydown', 'KeyI')
    dispatchKey(target, 'keydown', 'KeyJ')
    dispatchKey(target, 'keydown', 'KeyK')
    dispatchKey(target, 'keydown', 'KeyL')
    dispatchKey(target, 'keydown', 'ShiftLeft')
    dispatchKey(target, 'keydown', 'KeyI')
    expect(input.isDown('KeyW')).toBe(true)
    expect(input.isDown('KeyL')).toBe(true)
    expect(input.isDown('Shift+KeyI')).toBe(true)
    input.dispose()
  })

  it('calls preventDefault on listed codes and not on others', () => {
    const { input, target } = createTestInput()
    const prevented = dispatchKey(target, 'keydown', 'KeyW')
    const allowed = dispatchKey(target, 'keydown', 'KeyH')
    expect(prevented.defaultPrevented).toBe(true)
    expect(allowed.defaultPrevented).toBe(false)
    input.dispose()
  })

  it('does not write axes from mousemove (pointer-steer is out)', () => {
    const { input, target } = createTestInput()
    input.update(0.016)
    expect(input.axis('moveX')).toBe(0)
    target.dispatchEvent(new MouseEvent('mousemove', { clientX: 80, clientY: 12, bubbles: true }))
    input.update(0.016)
    expect(input.axis('moveX')).toBe(0)
    expect(input.axis('moveZ')).toBe(0)
    input.dispose()
  })

  it('dispose removes listeners so later events are ignored', () => {
    const { input, target } = createTestInput()
    dispatchKey(target, 'keydown', 'KeyW')
    expect(input.isDown('KeyW')).toBe(true)
    input.dispose()
    dispatchKey(target, 'keydown', 'KeyD')
    expect(input.isDown('KeyD')).toBe(false)
    expect(input.isDown('KeyW')).toBe(false)
  })

  it('isDown does not allocate (no new Set / array per call)', () => {
    const { input, target } = createTestInput()
    dispatchKey(target, 'keydown', 'KeyW')
    const setSpy = vi.spyOn(globalThis, 'Set')
    input.isDown('KeyW')
    input.isDown('KeyW')
    expect(setSpy).not.toHaveBeenCalled()
    setSpy.mockRestore()
    input.dispose()
  })

  it('matches POC-1 combo spelling Shift+KeyI (not ShiftLeft+KeyI)', () => {
    const { input, target } = createTestInput()
    dispatchKey(target, 'keydown', 'ShiftLeft')
    dispatchKey(target, 'keydown', 'KeyI')
    expect(input.isDown('Shift+KeyI')).toBe(true)
    expect(input.isDown('ShiftLeft+KeyI')).toBe(false)
    input.dispose()
  })
})

describe('InputState gamepad', () => {
  it('axis moveX is 0 inside the deadzone and rescales outside', () => {
    const dz = BALANCE.controls.gamepad.deadzone
    const inside = makePad({ axes: [dz * 0.5, 0] })
    const full = makePad({ axes: [1, 0] })
    const inputInside = new InputState({
      target: makeTarget(),
      preventDefaultCodes: [],
      gamepads: { getGamepads: () => [inside] },
    })
    inputInside.update(0.016)
    expect(inputInside.axis('moveX')).toBe(0)

    const inputFull = new InputState({
      target: makeTarget(),
      preventDefaultCodes: [],
      gamepads: { getGamepads: () => [full] },
    })
    inputFull.setScheme('gamepad')
    inputFull.update(0.016)
    expect(inputFull.axis('moveX')).toBeCloseTo(1, 5)
    inputInside.dispose()
    inputFull.dispose()
  })

  it('stick-up (axis 1 = -1) yields axis moveZ < 0 when invertMoveZ is false', () => {
    const pad = makePad({ axes: [0, -1] })
    const input = new InputState({
      target: makeTarget(),
      preventDefaultCodes: [],
      gamepads: { getGamepads: () => [pad] },
    })
    input.setScheme('gamepad')
    input.update(0.016)
    expect(input.axis('moveZ')).toBeLessThan(0)
    input.dispose()
  })

  it('keyboard fills axis when the stick is at rest', () => {
    const { input, target } = createTestInput({ getGamepads: () => [makePad({ axes: [0, 0] })] })
    input.update(0.016)
    dispatchKey(target, 'keydown', 'KeyW')
    expect(input.axis('moveZ')).toBe(-1)
    input.dispose()
  })

  it('stick wins the axis when |stick| > 0 after deadzone', () => {
    const pad = makePad({ axes: [1, 0] })
    const { input, target } = createTestInput({ getGamepads: () => [pad] })
    input.setScheme('gamepad')
    input.update(0.016)
    dispatchKey(target, 'keydown', 'KeyA')
    expect(input.axis('moveX')).toBe(1)
    input.dispose()
  })

  it('isPressed fire is true when Y is pressed', () => {
    const buttons = makeButtons(10)
    buttons[3] = { value: 0, pressed: true }
    const input = new InputState({
      target: makeTarget(),
      preventDefaultCodes: [],
      gamepads: { getGamepads: () => [makePad({ buttons })] },
    })
    input.setScheme('gamepad')
    input.update(0.016)
    expect(input.isPressed('fire')).toBe(true)
    input.dispose()
  })

  it('isPressed fire is true when KeyF is down with no pad', () => {
    const { input, target } = createTestInput({ getGamepads: () => [] })
    input.update(0.016)
    dispatchKey(target, 'keydown', 'KeyF')
    expect(input.isPressed('fire')).toBe(true)
    input.dispose()
  })

  it('isPressed switchWeapon is true when X is pressed', () => {
    const buttons = makeButtons(10)
    buttons[2] = { value: 0, pressed: true }
    const input = new InputState({
      target: makeTarget(),
      preventDefaultCodes: [],
      gamepads: { getGamepads: () => [makePad({ buttons })] },
    })
    input.setScheme('gamepad')
    input.update(0.016)
    expect(input.isPressed('switchWeapon')).toBe(true)
    input.dispose()
  })

  it('isPressed pause is true when Start is pressed', () => {
    const buttons = makeButtons(10)
    buttons[9] = { value: 0, pressed: true }
    const input = new InputState({
      target: makeTarget(),
      preventDefaultCodes: [],
      gamepads: { getGamepads: () => [makePad({ buttons })] },
    })
    input.setScheme('gamepad')
    input.update(0.016)
    expect(input.isPressed('pause')).toBe(true)
    input.dispose()
  })

  it('connectedPadCount counts non-null snapshots', () => {
    const input = new InputState({
      target: makeTarget(),
      preventDefaultCodes: [],
      gamepads: {
        getGamepads: () => [makePad({}), null, makePad({ mapping: 'unknown' })],
      },
    })
    input.update(0.016)
    expect(input.connectedPadCount).toBe(2)
    input.dispose()
  })

  it('update does not allocate', () => {
    const input = new InputState({
      target: makeTarget(),
      preventDefaultCodes: [],
      gamepads: { getGamepads: () => [makePad({ axes: [0.5, -0.5] })] },
    })
    const setSpy = vi.spyOn(globalThis, 'Set')
    input.update(0.016)
    input.update(0.016)
    expect(setSpy).not.toHaveBeenCalled()
    setSpy.mockRestore()
    input.dispose()
  })
})

describe('InputState rumble', () => {
  it('rumble no-ops and does not throw when there is no actuator', () => {
    const input = new InputState({
      target: makeTarget(),
      preventDefaultCodes: [],
      gamepads: { getGamepads: () => [makePad({})] },
    })
    input.update(0.016)
    expect(() => input.rumble('shieldHit')).not.toThrow()
    input.dispose()
  })

  it('rumble no-ops when haptics.enabled is false', () => {
    const playEffect = vi.fn().mockResolvedValue('complete')
    const input = new InputState({
      target: makeTarget(),
      preventDefaultCodes: [],
      hapticsEnabled: false,
      gamepads: {
        getGamepads: () => [
          makePad({ vibrationActuator: { playEffect } }),
        ],
      },
    })
    input.update(0.016)
    input.rumble('shieldHit')
    expect(playEffect).not.toHaveBeenCalled()
    input.dispose()
  })

  it('rumble calls playEffect dual-rumble with the shieldHit preset', () => {
    const playEffect = vi.fn().mockResolvedValue('complete')
    const input = new InputState({
      target: makeTarget(),
      preventDefaultCodes: [],
      gamepads: {
        getGamepads: () => [
          makePad({ vibrationActuator: { playEffect } }),
        ],
      },
    })
    input.update(0.016)
    input.rumble('shieldHit')
    expect(playEffect).toHaveBeenCalledWith('dual-rumble', {
      startDelay: 0,
      duration: BALANCE.haptics.presets.shieldHit.durationMs,
      strongMagnitude: BALANCE.haptics.presets.shieldHit.strongMagnitude,
      weakMagnitude: BALANCE.haptics.presets.shieldHit.weakMagnitude,
    })
    input.dispose()
  })

  it('a second rumble may preempt the first (playEffect called twice)', () => {
    const playEffect = vi.fn().mockResolvedValue('preempted')
    const input = new InputState({
      target: makeTarget(),
      preventDefaultCodes: [],
      gamepads: {
        getGamepads: () => [
          makePad({ vibrationActuator: { playEffect } }),
        ],
      },
    })
    input.update(0.016)
    input.rumble('shieldHit')
    input.rumble('hullHit')
    expect(playEffect).toHaveBeenCalledTimes(2)
    input.dispose()
  })
})

describe('InputState D19 mouse + touch', () => {
  it('left mouse button holds fire; right button consumePress bomb once', () => {
    const { input, target } = createTestInput()
    input.setScheme('mix')
    target.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true, cancelable: true }))
    expect(input.isPressed('fire')).toBe(true)
    target.dispatchEvent(new PointerEvent('pointerdown', { button: 2, bubbles: true, cancelable: true }))
    expect(input.consumePress('bomb')).toBe(true)
    expect(input.consumePress('bomb')).toBe(false)
    target.dispatchEvent(new PointerEvent('pointerup', { button: 0, bubbles: true, cancelable: true }))
    expect(input.isPressed('fire')).toBe(false)
    input.dispose()
  })

  it('prevents contextmenu when bomb is bound to button 2', () => {
    const { input, target } = createTestInput()
    input.setScheme('mix')
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    target.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    input.dispose()
  })

  it('wheel up consumePress switchBomb once; wheel down switchWeapon once', () => {
    const { input, target } = createTestInput()
    input.setScheme('mix')
    target.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, bubbles: true, cancelable: true }))
    expect(input.consumePress('switchBomb')).toBe(true)
    expect(input.consumePress('switchBomb')).toBe(false)
    target.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true }))
    expect(input.consumePress('switchWeapon')).toBe(true)
    expect(input.consumePress('switchWeapon')).toBe(false)
    input.dispose()
  })

  it('touch stick fills axis on the touch scheme', () => {
    const touch = {
      axisX: 1,
      axisZ: 0,
      isPressed: () => false,
    }
    const input = new InputState({
      target: makeTarget(),
      preventDefaultCodes: [],
      gamepads: { getGamepads: () => [makePad({ axes: [0, 0] })] },
      touch,
    })
    input.setScheme('touch')
    input.update(0.016)
    expect(input.axis('moveX')).toBeCloseTo(1, 5)
    input.dispose()
  })

  it('gamepad stick is ignored on the touch scheme', () => {
    const touch = {
      axisX: -1,
      axisZ: 0,
      isPressed: () => false,
    }
    const input = new InputState({
      target: makeTarget(),
      preventDefaultCodes: [],
      gamepads: { getGamepads: () => [makePad({ axes: [1, 0] })] },
      touch,
    })
    input.setScheme('touch')
    input.update(0.016)
    expect(input.axis('moveX')).toBeCloseTo(-1, 5)
    input.dispose()
  })

  it('consumePress dash is true for Space and for RB', () => {
    const { input, target } = createTestInput({ getGamepads: () => [] })
    dispatchKey(target, 'keydown', 'Space')
    expect(input.consumePress('dash')).toBe(true)
    expect(input.consumePress('dash')).toBe(false)
    input.dispose()

    const buttons = makeButtons(10)
    buttons[5] = { value: 0, pressed: true }
    const padInput = new InputState({
      target: makeTarget(),
      preventDefaultCodes: [],
      gamepads: { getGamepads: () => [makePad({ buttons })] },
    })
    padInput.setScheme('gamepad')
    padInput.update(0.016)
    expect(padInput.consumePress('dash')).toBe(true)
    padInput.update(0.016)
    expect(padInput.consumePress('dash')).toBe(false)
    padInput.dispose()
  })
})

describe('InputState scheme', () => {
  it('defaults to keyboard', () => {
    const { input } = createTestInput()
    expect(input.scheme).toBe('keyboard')
    input.dispose()
  })

  it('keyboard scheme ignores mouse fire', () => {
    const { input, target } = createTestInput()
    target.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true, cancelable: true }))
    expect(input.isPressed('fire')).toBe(false)
    input.dispose()
  })

  it('mix scheme lets WASD move and left-click fire', () => {
    const { input, target } = createTestInput()
    input.setScheme('mix')
    dispatchKey(target, 'keydown', 'KeyD')
    expect(input.axis('moveX')).toBe(1)
    target.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true, cancelable: true }))
    expect(input.isPressed('fire')).toBe(true)
    input.dispose()
  })

  it('gamepad scheme ignores keyboard fire and uses Y', () => {
    const buttons = makeButtons(10)
    const { input, target } = createTestInput({ getGamepads: () => [makePad({ buttons })] })
    input.setScheme('gamepad')
    input.update(0.016)
    dispatchKey(target, 'keydown', 'KeyF')
    expect(input.isPressed('fire')).toBe(false)
    buttons[3] = { value: 0, pressed: true }
    input.update(0.016)
    expect(input.isPressed('fire')).toBe(true)
    input.dispose()
  })

  it('touch scheme uses TouchSource axis and ignores WASD', () => {
    const touch = {
      axisX: 0.9,
      axisZ: 0,
      isPressed: () => false,
    }
    const target = makeTarget()
    const input = new InputState({
      target,
      preventDefaultCodes: buildPreventDefaultCodes(),
      touch,
    })
    input.setScheme('touch')
    dispatchKey(target, 'keydown', 'KeyD')
    input.update(0.016)
    const dz = BALANCE.controls.touch.deadzone
    expect(input.axis('moveX')).toBeCloseTo((0.9 - dz) / (1 - dz), 5)
    input.dispose()
  })

  it('Escape still latches pause on a non-keyboard scheme', () => {
    const { input, target } = createTestInput()
    input.setScheme('gamepad')
    dispatchKey(target, 'keydown', 'Escape')
    expect(input.isPressed('pause')).toBe(true)
    expect(input.consumePress('pause')).toBe(true)
    input.dispose()
  })
})

describe('InputState live remaps', () => {
  it('keyboard fire follows bindings.keyboard.fire', () => {
    const bindings = createInputBindings()
    const target = makeTarget()
    const input = new InputState({
      target,
      preventDefaultCodes: buildPreventDefaultCodes(),
      bindings,
    })
    dispatchKey(target, 'keydown', 'KeyF')
    expect(input.isPressed('fire')).toBe(true)
    dispatchKey(target, 'keyup', 'KeyF')
    assignKeyboard(bindings, 'fire', 'KeyG')
    dispatchKey(target, 'keydown', 'KeyF')
    expect(input.isPressed('fire')).toBe(false)
    dispatchKey(target, 'keydown', 'KeyG')
    expect(input.isPressed('fire')).toBe(true)
    input.dispose()
  })

  it('gamepad fire follows remapped button index', () => {
    const bindings = createInputBindings()
    assignGamepadButton(bindings, 'fire', 1)
    const buttons = makeButtons(10)
    buttons[1] = { value: 1, pressed: true }
    const input = new InputState({
      target: makeTarget(),
      preventDefaultCodes: [],
      gamepads: { getGamepads: () => [makePad({ buttons })] },
      bindings,
    })
    input.setScheme('gamepad')
    input.update(0.016)
    expect(input.isPressed('fire')).toBe(true)
    input.dispose()
  })
})
