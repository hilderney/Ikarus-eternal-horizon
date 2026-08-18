// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Scene } from 'three'
import { BALANCE } from '../core/balancer'
import { GameRenderer, type GlRendererPort } from './renderer'
import source from './renderer.ts?raw'

function makeGl(): {
  readonly gl: GlRendererPort
  readonly setSize: ReturnType<typeof vi.fn>
  readonly setPixelRatio: ReturnType<typeof vi.fn>
  readonly render: ReturnType<typeof vi.fn>
  readonly dispose: ReturnType<typeof vi.fn>
} {
  const canvas = document.createElement('canvas')
  const setSize = vi.fn()
  const setPixelRatio = vi.fn()
  const render = vi.fn()
  const dispose = vi.fn()
  return {
    setSize,
    setPixelRatio,
    render,
    dispose,
    gl: {
      domElement: canvas,
      setSize,
      setPixelRatio,
      render,
      dispose,
    },
  }
}

describe('GameRenderer', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('sets the drawing buffer to 540×960 with updateStyle false', () => {
    const gl = makeGl()
    const renderer = new GameRenderer({ gl: gl.gl })
    expect(gl.setSize).toHaveBeenCalledWith(540, 960, false)
    renderer.dispose()
  })

  it('caps pixelRatio at BALANCE.render.pixelRatioCap', () => {
    const gl = makeGl()
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 3 })
    const renderer = new GameRenderer({ gl: gl.gl, pixelRatioCap: BALANCE.render.pixelRatioCap })
    expect(gl.setPixelRatio).toHaveBeenCalledWith(2)
    renderer.dispose()
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 })
  })

  it('resize sets camera aspect to 540/960', () => {
    const gl = makeGl()
    const camera = { setAspect: vi.fn() }
    const renderer = new GameRenderer({ gl: gl.gl, camera })
    camera.setAspect.mockClear()
    renderer.resize()
    expect(camera.setAspect).toHaveBeenCalledWith(540 / 960)
    expect(gl.setSize).toHaveBeenLastCalledWith(540, 960, false)
    renderer.dispose()
  })

  it('attach appends the canvas to the host', () => {
    const gl = makeGl()
    const host = document.createElement('div')
    document.body.append(host)
    const renderer = new GameRenderer({ gl: gl.gl })
    renderer.attach(host)
    expect(host.contains(renderer.canvas)).toBe(true)
    renderer.attach(host)
    expect(host.querySelectorAll('canvas')).toHaveLength(1)
    renderer.dispose()
  })

  it('detach removes the canvas without disposing', () => {
    const gl = makeGl()
    const host = document.createElement('div')
    document.body.append(host)
    const renderer = new GameRenderer({ gl: gl.gl })
    renderer.attach(host)
    renderer.detach()
    expect(host.contains(renderer.canvas)).toBe(false)
    expect(gl.dispose).not.toHaveBeenCalled()
    renderer.dispose()
  })

  it('dispose releases the renderer and the resize listener', () => {
    const gl = makeGl()
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const renderer = new GameRenderer({ gl: gl.gl })
    renderer.attach(document.body)
    expect(add).toHaveBeenCalledWith('resize', expect.any(Function))
    renderer.dispose()
    expect(gl.dispose).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function))
    renderer.dispose()
    expect(gl.dispose).toHaveBeenCalledTimes(1)
  })

  it('render forwards (scene, camera) to WebGLRenderer.render', () => {
    const gl = makeGl()
    const renderer = new GameRenderer({ gl: gl.gl })
    const cam = {}
    renderer.render(cam)
    expect(gl.render).toHaveBeenCalledWith(renderer.scene, cam)
    expect(renderer.scene).toBeInstanceOf(Scene)
    renderer.dispose()
  })

  it('does not assign an absolute URL to any resource', () => {
    expect(source).not.toMatch(/https?:\/\//)
    expect(source).not.toMatch(/['"]\/src\//)
  })
})
