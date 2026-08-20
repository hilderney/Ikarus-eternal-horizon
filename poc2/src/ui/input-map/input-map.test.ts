// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createInputBindings } from '../../core/input-bindings'
import { InputMap } from './input-map'

function bindButton(host: HTMLElement, path: string): HTMLButtonElement {
  const el = host.querySelector<HTMLButtonElement>(`button[data-bind="${path}"]`)
  if (!el) {
    throw new Error(`missing bind ${path}`)
  }
  return el
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('InputMap', () => {
  it('shows four scheme tabs and default keyboard fire F', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const map = new InputMap()
    map.mount(host)
    const radios = [...host.querySelectorAll<HTMLInputElement>('input[name="input-map-scheme"]')]
    expect(radios.map((el) => el.value)).toEqual(['keyboard', 'mix', 'gamepad', 'touch'])
    expect(bindButton(host, 'keyboard.fire').textContent).toBe('F')
    expect(bindButton(host, 'keyboard.moveZMinus').textContent).toBe('W')
    map.dispose()
  })

  it('click-to-rebind writes keyboard.fire and swaps bomb if needed', () => {
    const bindings = createInputBindings()
    const host = document.createElement('div')
    document.body.append(host)
    const map = new InputMap({ bindings })
    map.mount(host)
    bindButton(host, 'keyboard.fire').click()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true, cancelable: true }))
    expect(bindings.keyboard.fire).toBe('KeyE')
    expect(bindings.keyboard.bomb).toBe('KeyT')
    expect(bindButton(host, 'keyboard.fire').textContent).toBe('E')
    expect(bindButton(host, 'keyboard.bomb').textContent).toBe('T')
    map.dispose()
  })

  it('Escape while listening cancels without changing the bind', () => {
    const bindings = createInputBindings()
    const host = document.createElement('div')
    document.body.append(host)
    const map = new InputMap({ bindings })
    map.mount(host)
    bindButton(host, 'keyboard.fire').click()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true, cancelable: true }))
    expect(bindings.keyboard.fire).toBe('KeyF')
    expect(bindButton(host, 'keyboard.fire').textContent).toBe('F')
    map.dispose()
  })

  it('mix mouse fire listen captures the next pointer button', () => {
    const bindings = createInputBindings()
    const host = document.createElement('div')
    document.body.append(host)
    const map = new InputMap({ bindings })
    map.mount(host)
    const mix = host.querySelector<HTMLInputElement>('input[value="mix"]')
    mix?.click()
    bindButton(host, 'mouse.fireButton').click()
    window.dispatchEvent(new PointerEvent('pointerdown', { button: 1, bubbles: true, cancelable: true }))
    expect(bindings.mouse.fireButton).toBe(1)
    expect(bindButton(host, 'mouse.fireButton').textContent).toBe('Middle')
    map.dispose()
  })

  it('gamepad fire listen captures the next pad button on update', () => {
    const bindings = createInputBindings()
    const buttons = Array.from({ length: 10 }, () => ({ value: 0, pressed: false }))
    const host = document.createElement('div')
    document.body.append(host)
    const map = new InputMap({
      bindings,
      gamepads: {
        getGamepads: () => [
          {
            mapping: 'standard',
            axes: [0, 0],
            buttons,
            vibrationActuator: null,
          },
        ],
      },
    })
    map.mount(host)
    host.querySelector<HTMLInputElement>('input[value="gamepad"]')?.click()
    expect(bindButton(host, 'gamepad.fire').textContent).toBe('Y')
    bindButton(host, 'gamepad.fire').click()
    buttons[1] = { value: 1, pressed: true }
    map.update(0.016)
    expect(bindings.gamepad.buttons.fire).toBe(1)
    expect(bindButton(host, 'gamepad.fire').textContent).toBe('B')
    map.dispose()
  })

  it('touch slot select swaps overlay actions and notifies onChange', () => {
    const bindings = createInputBindings()
    const onChange = vi.fn()
    const host = document.createElement('div')
    document.body.append(host)
    const map = new InputMap({ bindings, onChange })
    map.mount(host)
    host.querySelector<HTMLInputElement>('input[value="touch"]')?.click()
    const select = host.querySelector<HTMLSelectElement>('select[data-bind="touch.slots.0"]')
    if (!select) {
      throw new Error('missing touch slot')
    }
    expect(select.value).toBe('fire')
    select.value = 'dash'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    expect(bindings.touch.slots[0]).toBe('dash')
    expect(bindings.touch.slots[4]).toBe('fire')
    expect(onChange).toHaveBeenCalled()
    map.dispose()
  })

  it('reset restores BALANCE defaults', () => {
    const bindings = createInputBindings()
    const host = document.createElement('div')
    document.body.append(host)
    const map = new InputMap({ bindings })
    map.mount(host)
    bindButton(host, 'keyboard.fire').click()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyG', bubbles: true, cancelable: true }))
    host.querySelector<HTMLButtonElement>('.input-map-reset')?.click()
    expect(bindings.keyboard.fire).toBe('KeyF')
    expect(bindButton(host, 'keyboard.fire').textContent).toBe('F')
    map.dispose()
  })
})
