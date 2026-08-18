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

class FakeTarget extends EventTarget {}

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

function createTestInput(gamepads?: GamepadSource): { input: InputState; target: FakeTarget } {
  const target = new FakeTarget()
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
    const allowed = dispatchKey(target, 'keydown', 'KeyQ')
    expect(prevented.defaultPrevented).toBe(true)
    expect(allowed.defaultPrevented).toBe(false)
    input.dispose()
  })

  it('does not attach pointer or mouse listeners', () => {
    const target = new FakeTarget()
    const addSpy = vi.spyOn(target, 'addEventListener')
    const input = new InputState({
      target,
      preventDefaultCodes: buildPreventDefaultCodes(),
      gamepads: { getGamepads: () => [] },
    })
    const types = addSpy.mock.calls.map(([type]) => type)
    expect(types).not.toContain('pointerdown')
    expect(types).not.toContain('mousedown')
    expect(types).not.toContain('mousemove')
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
      target: new FakeTarget(),
      preventDefaultCodes: [],
      gamepads: { getGamepads: () => [inside] },
    })
    inputInside.update(0.016)
    expect(inputInside.axis('moveX')).toBe(0)

    const inputFull = new InputState({
      target: new FakeTarget(),
      preventDefaultCodes: [],
      gamepads: { getGamepads: () => [full] },
    })
    inputFull.update(0.016)
    expect(inputFull.axis('moveX')).toBeCloseTo(1, 5)
    inputInside.dispose()
    inputFull.dispose()
  })

  it('stick-up (axis 1 = -1) yields axis moveZ < 0 when invertMoveZ is false', () => {
    const pad = makePad({ axes: [0, -1] })
    const input = new InputState({
      target: new FakeTarget(),
      preventDefaultCodes: [],
      gamepads: { getGamepads: () => [pad] },
    })
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
    input.update(0.016)
    dispatchKey(target, 'keydown', 'KeyA')
    expect(input.axis('moveX')).toBe(1)
    input.dispose()
  })

  it('isPressed fire is true when RT value >= triggerThreshold', () => {
    const threshold = BALANCE.controls.gamepad.triggerThreshold
    const buttons = makeButtons(10)
    buttons[7] = { value: threshold, pressed: false }
    const input = new InputState({
      target: new FakeTarget(),
      preventDefaultCodes: [],
      gamepads: { getGamepads: () => [makePad({ buttons })] },
    })
    input.update(0.016)
    expect(input.isPressed('fire')).toBe(true)
    input.dispose()
  })

  it('isPressed fire is true when Space is down with no pad', () => {
    const { input, target } = createTestInput({ getGamepads: () => [] })
    input.update(0.016)
    dispatchKey(target, 'keydown', 'Space')
    expect(input.isPressed('fire')).toBe(true)
    input.dispose()
  })

  it('isPressed switchWeapon is true when LB is pressed', () => {
    const buttons = makeButtons(10)
    buttons[4] = { value: 0, pressed: true }
    const input = new InputState({
      target: new FakeTarget(),
      preventDefaultCodes: [],
      gamepads: { getGamepads: () => [makePad({ buttons })] },
    })
    input.update(0.016)
    expect(input.isPressed('switchWeapon')).toBe(true)
    input.dispose()
  })

  it('isPressed pause is true when Start is pressed', () => {
    const buttons = makeButtons(10)
    buttons[9] = { value: 0, pressed: true }
    const input = new InputState({
      target: new FakeTarget(),
      preventDefaultCodes: [],
      gamepads: { getGamepads: () => [makePad({ buttons })] },
    })
    input.update(0.016)
    expect(input.isPressed('pause')).toBe(true)
    input.dispose()
  })

  it('connectedPadCount counts non-null snapshots', () => {
    const input = new InputState({
      target: new FakeTarget(),
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
      target: new FakeTarget(),
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
      target: new FakeTarget(),
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
      target: new FakeTarget(),
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
      target: new FakeTarget(),
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
      target: new FakeTarget(),
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
