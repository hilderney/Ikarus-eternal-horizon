/**
 * SDD-A05 ObjectPool<T> — pre-warmed, never grows (RUL-13).
 * Exhaustion returns null. Holders own scene add/remove (D14).
 */

export type PoolFactory<T> = () => T
export type PoolReset<T> = (item: T) => void
export type PoolDisposeItem<T> = (item: T) => void

export interface ObjectPoolOptions<T> {
  readonly capacity: number
  readonly factory: PoolFactory<T>
  readonly reset?: PoolReset<T>
  readonly disposeItem?: PoolDisposeItem<T>
}

export class ObjectPool<T> {
  readonly capacity: number

  private readonly _items: T[]
  private readonly _active: boolean[]
  private readonly _index: Map<T, number>
  private readonly _reset: PoolReset<T> | undefined
  private readonly _disposeItem: PoolDisposeItem<T> | undefined
  private _head = 0
  private _activeCount = 0
  private _disposed = false

  constructor(options: ObjectPoolOptions<T>) {
    this.capacity = options.capacity
    this._reset = options.reset
    this._disposeItem = options.disposeItem
    this._items = new Array<T>(options.capacity)
    this._active = new Array<boolean>(options.capacity)
    this._index = new Map()

    for (let i = 0; i < options.capacity; i++) {
      const item = options.factory()
      this._items[i] = item
      this._active[i] = false
      this._index.set(item, i)
    }
  }

  get activeCount(): number {
    return this._activeCount
  }

  acquire(): T | null {
    if (this._disposed || this._activeCount === this.capacity) {
      return null
    }

    const size = this.capacity
    for (let i = 0; i < size; i++) {
      const idx = (this._head + i) % size
      if (!this._active[idx]) {
        this._active[idx] = true
        this._head = (idx + 1) % size
        this._activeCount++
        return this._items[idx] as T
      }
    }
    return null
  }

  release(item: T): void {
    if (this._disposed) {
      return
    }
    const idx = this._index.get(item)
    if (idx === undefined || !this._active[idx]) {
      return
    }
    this._reset?.(item)
    this._active[idx] = false
    this._activeCount--
  }

  forEachActive(fn: (item: T) => void): void {
    for (let i = 0; i < this.capacity; i++) {
      if (this._active[i]) {
        fn(this._items[i] as T)
      }
    }
  }

  clear(): void {
    if (this._disposed) {
      return
    }
    for (let i = 0; i < this.capacity; i++) {
      if (this._active[i]) {
        this._reset?.(this._items[i] as T)
        this._active[i] = false
      }
    }
    this._activeCount = 0
  }

  dispose(): void {
    if (this._disposed) {
      return
    }
    this._disposed = true
    for (let i = 0; i < this._items.length; i++) {
      this._disposeItem?.(this._items[i] as T)
    }
    this._items.length = 0
    this._active.length = 0
    this._index.clear()
    this._activeCount = 0
  }
}
