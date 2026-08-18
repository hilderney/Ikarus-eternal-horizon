// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BALANCE } from '../../core/balancer'
import type { NippleFactory, NippleHandle, NippleMove } from './touch-controls'
import { TouchControls, createTouchPad } from './touch-controls'
import source from './touch-controls.ts?raw'

interface FakeNipple {
  readonly factory: NippleFactory
  readonly destroy: ReturnType<typeof vi.fn>
  readonly zone: { current: HTMLElement | undefined }
  emitMove(data: NippleMove): void
  emitEnd(): void
}

function makeFakeNipple(): FakeNipple {
  let moveFn: ((evt: unknown, data: NippleMove) => void) | undefined
  let endFn: (() => void) | undefined
  const destroy = vi.fn()
  const zone: { current: HTMLElement | undefined } = { current: undefined }

  const handle: NippleHandle = {
    on(event, fn) {
      if (event === 'move') {
        moveFn = fn as (evt: unknown, data: NippleMove) => void
      } else {
        endFn = fn as () => void
      }
    },
    destroy,
  }

  return {
    destroy,
    zone,
    factory: (el) => {
      zone.current = el
      return handle
    },
    emitMove(data) {
      moveFn?.(null, data)
    },
    emitEnd() {
      endFn?.()
    },
  }
}

function button(host: HTMLElement, action: string): HTMLElement {
  const el = host.querySelector(`[data-action="${action}"]`)
  if (!(el instanceof HTMLElement)) {
    throw new Error(`expected button for ${action}`)
  }
  return el
}

function mount(nipple: NippleFactory = makeFakeNipple().factory): {
  controls: TouchControls
  host: HTMLElement
  source: ReturnType<typeof createTouchPad>
} {
  const host = document.createElement('div')
  host.style.position = 'relative'
  document.body.append(host)
  const source = createTouchPad()
  const controls = new TouchControls({
    host,
    source,
    nipple,
    enabled: true,
    stickSize: BALANCE.controls.touch.stickSize,
    stickColor: BALANCE.controls.touch.stickColor,
  })
  return { controls, host, source }
}

describe('TouchControls', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('constructs a nipple in the left zone via the injected factory', () => {
    const fake = makeFakeNipple()
    const { controls, host } = mount(fake.factory)
    const zone = fake.zone.current
    expect(zone).toBeInstanceOf(HTMLElement)
    if (!(zone instanceof HTMLElement)) {
      return
    }
    expect(host.contains(zone)).toBe(true)
    expect(zone.style.pointerEvents).toBe('auto')
    const overlay = zone.parentElement
    expect(overlay?.style.pointerEvents).toBe('none')
    expect(Number.parseFloat(zone.style.left)).toBe(0)
    expect(Number.parseFloat(zone.style.bottom)).toBe(0)
    controls.dispose()
  })

  it('maps nipple vector (0,1) to axisZ < 0', () => {
    const fake = makeFakeNipple()
    const { controls, source } = mount(fake.factory)
    fake.emitMove({ vector: { x: 0, y: 1 }, force: 1 })
    expect(source.axisX).toBe(0)
    expect(source.axisZ).toBeLessThan(0)
    controls.dispose()
  })

  it('zeros axes under the touch deadzone', () => {
    const fake = makeFakeNipple()
    const { controls, source } = mount(fake.factory)
    fake.emitMove({ vector: { x: 0.1, y: 0.1 }, force: 0.14 })
    expect(Math.hypot(0.1, 0.1)).toBeLessThan(BALANCE.controls.touch.deadzone)
    expect(source.axisX).toBe(0)
    expect(source.axisZ).toBe(0)
    controls.dispose()
  })

  it('Fire pointerdown sets isPressed fire; pointerup clears it', () => {
    const { controls, host, source } = mount()
    const fire = button(host, 'fire')
    fire.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    expect(source.isPressed('fire')).toBe(true)
    fire.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    expect(source.isPressed('fire')).toBe(false)
    controls.dispose()
  })

  it('Bomb pointerdown is a tap that A02 can consume as an edge', () => {
    const { controls, host, source } = mount()
    const bomb = button(host, 'bomb')
    expect(source.isPressed('bomb')).toBe(false)
    bomb.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    expect(source.isPressed('bomb')).toBe(true)
    bomb.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
    expect(source.isPressed('bomb')).toBe(false)
    controls.dispose()
  })

  it('hidden overlay snaps axes to 0 and releases buttons', () => {
    const fake = makeFakeNipple()
    const { controls, host, source } = mount(fake.factory)
    fake.emitMove({ vector: { x: 1, y: 0 }, force: 1 })
    button(host, 'fire').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    expect(source.axisX).not.toBe(0)
    expect(source.isPressed('fire')).toBe(true)
    controls.setVisible(false)
    expect(controls.visible).toBe(false)
    expect(source.axisX).toBe(0)
    expect(source.axisZ).toBe(0)
    expect(source.isPressed('fire')).toBe(false)
    controls.dispose()
  })

  it('dispose calls nipple.destroy and removes the overlay node', () => {
    const fake = makeFakeNipple()
    const { controls, host } = mount(fake.factory)
    const overlay = host.firstElementChild
    expect(overlay).toBeInstanceOf(HTMLElement)
    controls.dispose()
    expect(fake.destroy).toHaveBeenCalledTimes(1)
    expect(host.contains(overlay)).toBe(false)
    controls.dispose()
    expect(fake.destroy).toHaveBeenCalledTimes(1)
  })

  it('does not import three', () => {
    expect(source).not.toMatch(/from ['"]three['"]/)
    expect(source).not.toMatch(/\bTHREE\b/)
    expect(source).not.toMatch(/scene\.add\(/)
  })
})
