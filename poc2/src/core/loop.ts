/**
 * SDD-A04 GameLoop — rAF driver, dt clamp, pause gate, debugger sidecar.
 * Does not poll gamepads (D18 / G03).
 */

import { BALANCE } from './balancer'

/** Pluggable clock so tests use fake timers instead of real rAF. */
export interface FrameClock {
  now(): number
  request(cb: (timeMs: number) => void): number
  cancel(id: number): void
}

export interface GameLoopOptions {
  readonly step: (dt: number) => void
  readonly sidecar?: () => void
  readonly clock?: FrameClock
}

const browserClock: FrameClock = {
  now(): number {
    return performance.now()
  },
  request(cb: (timeMs: number) => void): number {
    return requestAnimationFrame(cb)
  },
  cancel(id: number): void {
    cancelAnimationFrame(id)
  },
}

export class GameLoop {
  private readonly _step: (dt: number) => void
  private readonly _sidecar: (() => void) | undefined
  private readonly _clock: FrameClock
  private _running = false
  private _paused = false
  private _lastMs = 0
  private _syncAcc = 0
  private _rafId = 0

  constructor(options: GameLoopOptions) {
    this._step = options.step
    this._sidecar = options.sidecar
    this._clock = options.clock ?? browserClock
  }

  get running(): boolean {
    return this._running
  }

  get paused(): boolean {
    return this._paused
  }

  start(): void {
    if (this._running) {
      return
    }
    this._running = true
    this._lastMs = this._clock.now()
    this._rafId = this._clock.request(this._onFrame)
  }

  stop(): void {
    if (!this._running) {
      return
    }
    this._running = false
    if (this._rafId !== 0) {
      this._clock.cancel(this._rafId)
      this._rafId = 0
    }
  }

  setPaused(paused: boolean): void {
    if (this._paused === paused) {
      return
    }
    this._paused = paused
    if (!paused) {
      this._lastMs = this._clock.now()
    }
  }

  private readonly _onFrame = (timeMs: number): void => {
    this._rafId = 0
    if (!this._running) {
      return
    }

    const dt = Math.min((timeMs - this._lastMs) / 1000, BALANCE.loop.maxFrameDt)
    this._lastMs = timeMs

    if (!this._paused) {
      this._step(dt)
    }

    this._syncAcc += dt
    if (this._syncAcc >= 1 / BALANCE.loop.sidecarHz) {
      this._syncAcc = 0
      this._sidecar?.()
    }

    this._rafId = this._clock.request(this._onFrame)
  }
}
