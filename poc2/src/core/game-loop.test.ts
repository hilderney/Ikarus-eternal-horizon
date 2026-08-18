import { afterEach, describe, expect, it, vi } from 'vitest'
import { BALANCE } from './balancer'
import { GameLoop, type FrameClock } from './loop'

class FakeClock implements FrameClock {
  time = 0
  private _nextId = 1
  private readonly _pending = new Map<number, (timeMs: number) => void>()

  now(): number {
    return this.time
  }

  request(cb: (timeMs: number) => void): number {
    const id = this._nextId++
    this._pending.set(id, cb)
    return id
  }

  cancel(id: number): void {
    this._pending.delete(id)
  }

  get pendingCount(): number {
    return this._pending.size
  }

  tick(deltaMs: number): void {
    this.time += deltaMs
    const scheduled = [...this._pending.values()]
    this._pending.clear()
    for (const cb of scheduled) {
      cb(this.time)
    }
  }
}

describe('GameLoop', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('start schedules a frame and stop cancels it', () => {
    const clock = new FakeClock()
    const step = vi.fn()
    const loop = new GameLoop({ step, clock })
    expect(loop.running).toBe(false)
    loop.start()
    expect(loop.running).toBe(true)
    expect(clock.pendingCount).toBe(1)
    loop.start()
    expect(clock.pendingCount).toBe(1)
    loop.stop()
    expect(loop.running).toBe(false)
    expect(clock.pendingCount).toBe(0)
  })

  it('clamps dt to maxFrameDt 0.05 on a long hitch', () => {
    const clock = new FakeClock()
    const step = vi.fn()
    const loop = new GameLoop({ step, clock })
    loop.start()
    clock.tick(2000)
    expect(step).toHaveBeenCalledTimes(1)
    expect(step.mock.calls[0]?.[0]).toBe(BALANCE.loop.maxFrameDt)
    loop.stop()
  })

  it('passes dt in seconds, not milliseconds', () => {
    const clock = new FakeClock()
    const step = vi.fn()
    const loop = new GameLoop({ step, clock })
    loop.start()
    clock.tick(16)
    expect(step.mock.calls[0]?.[0]).toBeCloseTo(0.016, 8)
    expect(step.mock.calls[0]?.[0]).toBeLessThan(1)
    loop.stop()
  })

  it('does not call step while paused but keeps requesting frames', () => {
    const clock = new FakeClock()
    const step = vi.fn()
    const loop = new GameLoop({ step, clock })
    loop.start()
    loop.setPaused(true)
    expect(loop.paused).toBe(true)
    clock.tick(16)
    clock.tick(16)
    expect(step).not.toHaveBeenCalled()
    expect(clock.pendingCount).toBe(1)
    loop.stop()
  })

  it('does not catch up dt after unpause', () => {
    const clock = new FakeClock()
    const step = vi.fn()
    const loop = new GameLoop({ step, clock })
    loop.start()
    clock.tick(16)
    loop.setPaused(true)
    clock.tick(2000)
    loop.setPaused(false)
    clock.tick(16)
    const lastDt = step.mock.calls[step.mock.calls.length - 1]?.[0]
    expect(lastDt).toBeCloseTo(0.016, 8)
    expect(lastDt).toBeLessThan(0.05)
    loop.stop()
  })

  it('invokes sidecar at ~15 Hz even while paused', () => {
    const clock = new FakeClock()
    const step = vi.fn()
    const sidecar = vi.fn()
    const loop = new GameLoop({ step, clock, sidecar })
    loop.start()
    loop.setPaused(true)
    for (let i = 0; i < 5; i++) {
      clock.tick(16)
    }
    expect(step).not.toHaveBeenCalled()
    expect(sidecar).toHaveBeenCalled()
    loop.stop()
  })

  it('does not allocate inside the frame callback', () => {
    const clock = new FakeClock()
    const loop = new GameLoop({ step: () => undefined, clock })
    loop.start()
    clock.tick(16)
    const setSpy = vi.spyOn(globalThis, 'Set')
    clock.tick(16)
    clock.tick(16)
    expect(setSpy).not.toHaveBeenCalled()
    setSpy.mockRestore()
    loop.stop()
  })

  it('stop cancels the pending frame so step is not called after stop', () => {
    const clock = new FakeClock()
    const step = vi.fn()
    const loop = new GameLoop({ step, clock })
    loop.start()
    loop.stop()
    clock.tick(16)
    expect(step).not.toHaveBeenCalled()
  })

  it('records last timestamp on start so the first dt is not a hitch', () => {
    const clock = new FakeClock()
    clock.time = 5000
    const step = vi.fn()
    const loop = new GameLoop({ step, clock })
    loop.start()
    clock.tick(16)
    expect(step.mock.calls[0]?.[0]).toBeCloseTo(0.016, 8)
    loop.stop()
  })

  it('does not call getGamepads (pad poll belongs to A02 via G03)', () => {
    const getGamepads = vi.fn(() => [])
    vi.stubGlobal('navigator', { getGamepads })
    const clock = new FakeClock()
    const loop = new GameLoop({ step: () => undefined, clock })
    loop.start()
    clock.tick(16)
    clock.tick(16)
    expect(getGamepads).not.toHaveBeenCalled()
    loop.stop()
  })
})
