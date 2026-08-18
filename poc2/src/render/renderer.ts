/**
 * SDD-G09 Renderer — WebGLRenderer + root Scene, 540×960 letterbox canvas.
 */

import { Color, Scene, WebGLRenderer } from 'three'
import type { Camera } from 'three'
import { BALANCE } from '../core/balancer'

export interface PlayfieldSize {
  readonly width: number
  readonly height: number
}

export interface GameCameraAspectPort {
  setAspect(aspect: number): void
}

/** Minimal GL surface so tests never construct a real WebGLRenderer. */
export interface GlRendererPort {
  readonly domElement: HTMLCanvasElement
  setSize(width: number, height: number, updateStyle?: boolean): void
  setPixelRatio(ratio: number): void
  render(scene: Scene, camera: Camera): void
  dispose(): void
}

export interface GameRendererPort {
  readonly canvas: HTMLCanvasElement
  readonly scene: Scene
  attach(host: HTMLElement): void
  detach(): void
  resize(): void
  render(camera: unknown): void
  dispose(): void
}

export interface GameRendererOptions {
  readonly playfield?: PlayfieldSize
  readonly camera?: GameCameraAspectPort
  readonly pixelRatioCap?: number
  readonly gl?: GlRendererPort
}

export class GameRenderer implements GameRendererPort {
  readonly scene: Scene
  private readonly _gl: GlRendererPort
  private readonly _playfield: PlayfieldSize
  private readonly _camera: GameCameraAspectPort | undefined
  private readonly _onResize = (): void => {
    this.resize()
  }
  private _listening = false
  private _disposed = false

  constructor(options: GameRendererOptions = {}) {
    this._playfield = options.playfield ?? BALANCE.layout.playfield
    this._camera = options.camera
    this.scene = new Scene()
    this.scene.background = new Color(BALANCE.render.background)

    this._gl =
      options.gl ??
      new WebGLRenderer({
        antialias: BALANCE.render.antialias,
        alpha: false,
      })

    const cap = options.pixelRatioCap ?? BALANCE.render.pixelRatioCap
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1
    this._gl.setPixelRatio(Math.min(dpr, cap))
    this.resize()
  }

  get canvas(): HTMLCanvasElement {
    return this._gl.domElement
  }

  attach(host: HTMLElement): void {
    if (this.canvas.parentElement !== host) {
      host.append(this.canvas)
    }
    if (!this._listening && typeof window !== 'undefined') {
      window.addEventListener('resize', this._onResize)
      this._listening = true
    }
  }

  detach(): void {
    this.canvas.remove()
  }

  resize(): void {
    this._gl.setSize(this._playfield.width, this._playfield.height, false)
    this._camera?.setAspect(this._playfield.width / this._playfield.height)
  }

  render(camera: unknown): void {
    this._gl.render(this.scene, camera as Camera)
  }

  dispose(): void {
    if (this._disposed) {
      return
    }
    this._disposed = true
    if (this._listening && typeof window !== 'undefined') {
      window.removeEventListener('resize', this._onResize)
      this._listening = false
    }
    this.detach()
    this._gl.dispose()
  }
}
