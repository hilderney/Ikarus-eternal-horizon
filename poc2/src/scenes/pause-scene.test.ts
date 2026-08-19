// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ControlScheme } from '../core/input'
import { PauseScene } from './pause-scene'

function makeInput(scheme: ControlScheme = 'keyboard') {
  let current = scheme
  return {
    get scheme() {
      return current
    },
    setScheme: vi.fn((next: ControlScheme) => {
      current = next
    }),
    update: vi.fn(),
    consumePress: vi.fn(() => false),
  }
}

afterEach(() => {
  document.body.replaceChildren()
})

describe('PauseScene', () => {
  it('kind is pause and is not a ScenePort id', () => {
    const pause = new PauseScene({
      host: document.body,
      loop: { setPaused: vi.fn() },
      input: makeInput(),
    })
    expect(pause.kind).toBe('pause')
  })

  it('mount sets loop paused and shows scheme radios with keyboard selected', () => {
    const loop = { setPaused: vi.fn() }
    const pause = new PauseScene({
      host: document.body,
      loop,
      input: makeInput('keyboard'),
    })
    pause.mount()
    expect(loop.setPaused).toHaveBeenCalledWith(true)
    const radios = [...document.querySelectorAll<HTMLInputElement>('input[name="control-scheme"]')]
    expect(radios.map((el) => el.value)).toEqual(['keyboard', 'mix', 'gamepad', 'touch'])
    expect(radios.find((el) => el.checked)?.value).toBe('keyboard')
    pause.dispose()
  })

  it('scheme radios call setScheme and keep a single selection', () => {
    const input = makeInput('keyboard')
    const onSchemeChange = vi.fn()
    const pause = new PauseScene({
      host: document.body,
      loop: { setPaused: vi.fn() },
      input,
      onSchemeChange,
    })
    pause.mount()
    const mix = document.querySelector<HTMLInputElement>('input[value="mix"]')
    if (!mix) {
      throw new Error('missing mix radio')
    }
    mix.click()
    expect(input.setScheme).toHaveBeenCalledWith('mix')
    expect(onSchemeChange).toHaveBeenCalledWith('mix')
    expect(document.querySelectorAll<HTMLInputElement>('input[name="control-scheme"]:checked')).toHaveLength(
      1,
    )
    pause.dispose()
  })

  it('resume unpauses the loop and removes overlay DOM', () => {
    const loop = { setPaused: vi.fn() }
    const pause = new PauseScene({
      host: document.body,
      loop,
      input: makeInput(),
    })
    pause.mount()
    expect(document.querySelector('.pause-overlay')).not.toBeNull()
    pause.resume()
    expect(loop.setPaused).toHaveBeenCalledWith(false)
    expect(document.querySelector('.pause-overlay')).toBeNull()
    expect(pause.open).toBe(false)
  })
})
