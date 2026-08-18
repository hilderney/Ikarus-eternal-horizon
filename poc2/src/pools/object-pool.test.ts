import { describe, expect, it, vi } from 'vitest'
import { ObjectPool } from './object-pool'

interface Token {
  id: number
  resetCount: number
}

function makePool(capacity: number) {
  let nextId = 0
  const factory = vi.fn((): Token => ({ id: nextId++, resetCount: 0 }))
  const reset = vi.fn((item: Token) => {
    item.resetCount += 1
  })
  const disposeItem = vi.fn()
  const pool = new ObjectPool({ capacity, factory, reset, disposeItem })
  return { pool, factory, reset, disposeItem }
}

describe('ObjectPool', () => {
  it('calls factory exactly capacity times in the constructor', () => {
    const { factory, pool } = makePool(4)
    expect(factory).toHaveBeenCalledTimes(4)
    expect(pool.capacity).toBe(4)
    expect(pool.activeCount).toBe(0)
  })

  it('does not call factory on acquire, release, clear, or exhaustion', () => {
    const { pool, factory } = makePool(2)
    const a = pool.acquire()
    const b = pool.acquire()
    expect(pool.acquire()).toBeNull()
    if (a) {
      pool.release(a)
    }
    pool.clear()
    expect(factory).toHaveBeenCalledTimes(2)
    expect(b).not.toBeNull()
  })

  it('returns null when the pool is exhausted instead of allocating', () => {
    const { pool } = makePool(2)
    expect(pool.acquire()).not.toBeNull()
    expect(pool.acquire()).not.toBeNull()
    expect(pool.acquire()).toBeNull()
    expect(pool.activeCount).toBe(2)
  })

  it('reuses the same object identity after release', () => {
    const { pool } = makePool(1)
    const first = pool.acquire()
    expect(first).not.toBeNull()
    pool.release(first as Token)
    const second = pool.acquire()
    expect(second).toBe(first)
  })

  it('calls reset on release before the item is acquirable again', () => {
    const { pool, reset } = makePool(1)
    const item = pool.acquire() as Token
    expect(reset).not.toHaveBeenCalled()
    pool.release(item)
    expect(reset).toHaveBeenCalledTimes(1)
    expect(reset).toHaveBeenCalledWith(item)
    expect(item.resetCount).toBe(1)
  })

  it('forEachActive visits only acquired items, once each', () => {
    const { pool } = makePool(3)
    const a = pool.acquire() as Token
    const b = pool.acquire() as Token
    const seen: Token[] = []
    pool.forEachActive((item) => {
      seen.push(item)
    })
    expect(seen).toHaveLength(2)
    expect(seen).toContain(a)
    expect(seen).toContain(b)
  })

  it('clear releases all actives without calling disposeItem', () => {
    const { pool, reset, disposeItem } = makePool(3)
    pool.acquire()
    pool.acquire()
    pool.clear()
    expect(pool.activeCount).toBe(0)
    expect(reset).toHaveBeenCalledTimes(2)
    expect(disposeItem).not.toHaveBeenCalled()
    expect(pool.acquire()).not.toBeNull()
  })

  it('dispose calls disposeItem once per item', () => {
    const { pool, disposeItem } = makePool(3)
    pool.acquire()
    pool.dispose()
    expect(disposeItem).toHaveBeenCalledTimes(3)
    expect(pool.activeCount).toBe(0)
    expect(pool.acquire()).toBeNull()
  })

  it('double-release is a no-op', () => {
    const { pool, reset } = makePool(1)
    const item = pool.acquire() as Token
    pool.release(item)
    pool.release(item)
    expect(reset).toHaveBeenCalledTimes(1)
    pool.release({ id: 99, resetCount: 0 })
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it('acquire/release do not grow arrays or allocate', () => {
    const { pool, factory } = makePool(2)
    const setSpy = vi.spyOn(globalThis, 'Set')
    const a = pool.acquire()
    const b = pool.acquire()
    pool.release(a as Token)
    pool.acquire()
    pool.forEachActive(() => undefined)
    pool.clear()
    expect(b).not.toBeNull()
    expect(factory).toHaveBeenCalledTimes(2)
    expect(setSpy).not.toHaveBeenCalled()
    setSpy.mockRestore()
  })
})
