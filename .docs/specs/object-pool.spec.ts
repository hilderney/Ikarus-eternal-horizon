/**
 * #tag/arch #tag/memory
 *
 * Card:         SDD-A05 ObjectPool<T>
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: WPN-01, ENM-02, RES-03, RUL-13
 * Change type:  split
 * POC-1 origin: poc/src/gameobjects/shot.ts (ShotPool half)  — frozen reference
 * Test file:    poc2/src/pools/object-pool.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      Generic `ObjectPool<T>`. Pre-warms `capacity` items via an
 *            injected factory at construction. `acquire()` returns a free
 *            item or `null` — it never allocates. `release` / `forEachActive`
 *            / `clear` / `dispose` are the whole lifecycle.
 * Does not own: scene.add/remove (the holder — ShotManager, EnemyManager,
 *            DropManager — owns the graph, D14), per-type reset visuals
 *            (the injected reset/disposeItem callbacks), or BALANCE sizes
 *            (callers pick capacity).
 * Player-facing: none directly. Exhaustion drops shots; a leak stutters
 *            the worst-case wave (RUL-13).
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Upstream: none.
 * Downstream:
 *   SDD-D01 WeaponShot / SDD-E04 ShotManager — player bolts (WPN-01)
 *   SDD-E01 Enemy / SDD-E05 EnemyManager — pooled hostiles (ENM-02)
 *   SDD-E03 EnemyShot — pooled incoming fire
 *   SDD-F02 DropManager — pooled fragments (RES-03)
 *   SDD-F05 VfxManager — pooled bursts (RUL-13)
 */

// ─── 9. Agent sign-off ───────────────────────────────────────────────────────
/**
 * Orchestrator : hub-v4.1 / 2026-08-17  scope, requires, DoD
 * Programming  : hub-v4.1 / 2026-08-17  contract, factory injection, no grow
 * Game Design  : hub-v4.1 / 2026-08-17  N/A feel — capacity is the caller's BALANCE
 * TDD          : hub-v4.2 / 2026-08-18  object-pool.test.ts green (10/10)
 * Status: done
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Programming / Three.js
// ═════════════════════════════════════════════════════════════════════════════

export type PoolFactory<T> = () => T
export type PoolReset<T> = (item: T) => void
export type PoolDisposeItem<T> = (item: T) => void

export interface ObjectPoolOptions<T> {
  /** Hard cap. Factory is invoked exactly this many times in the constructor. */
  readonly capacity: number
  /** Injected. Called only during construction (and never again). */
  readonly factory: PoolFactory<T>
  /** Called on release and on clear, before the item returns to the free list. */
  readonly reset?: PoolReset<T>
  /** Called once per item from dispose(). Frees GPU / listeners the item owns. */
  readonly disposeItem?: PoolDisposeItem<T>
}

export declare class ObjectPool<T> {
  constructor(options: ObjectPoolOptions<T>)

  /** Next free item, or null when every slot is active. Never allocates. */
  acquire(): T | null

  /** Return `item` to the free list after reset(). Unknown / double-release is a no-op. */
  release(item: T): void

  /** Iterate currently acquired items only. `fn` must not acquire/release. */
  forEachActive(fn: (item: T) => void): void

  /** Release every active item (reset + free). Does not dispose GPU. */
  clear(): void

  /** disposeItem every slot (active and free), then empty the pool. */
  dispose(): void

  readonly capacity: number
  readonly activeCount: number
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   field          | type     | meaning / unit / range
 *   ---------------|----------|----------------------------------------------
 *   _items         | T[]      | length === capacity; filled in constructor
 *   _active        | boolean[]| parallel flags, or a free-list of indices
 *   _head          | number   | round-robin cursor (POC-1 ShotPool style)
 *   capacity       | number   | immutable after construct
 *   activeCount    | number   | 0..capacity
 *
 * Factory: invoked `capacity` times in the constructor, then never.
 * acquire: scan from _head for an inactive slot; on hit, mark active, bump
 *          head, return the item. If none free, return null.
 * release: if the item is in _items and active, reset?.(item), mark inactive.
 * clear:   release every active item.
 * dispose: disposeItem?.(item) for each, then drop references (length 0).
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. The constructor calls factory exactly `capacity` times and never
 *       again — including after exhaustion, acquire, release, or clear.
 *   R2. acquire() returns null when activeCount === capacity. It does not
 *       grow, does not call factory, does not throw.
 *   R3. release returns the item to the free list; a subsequent acquire may
 *       yield the same object identity (reuse). reset is called on release.
 *   R4. forEachActive visits each currently acquired item once and skips free ones.
 *   R5. clear() drops activeCount to 0 without calling disposeItem.
 *   R6. dispose() calls disposeItem once per constructed item and leaves
 *       acquire() returning null / activeCount 0 / capacity conceptually spent.
 *   R7. Double-release and release of a foreign object are no-ops.
 *   R8. Memory: pooled. Per-frame allocation: none on acquire/release/
 *       forEachActive/clear. The factory's allocations happen at construct.
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      N/A — generic container. Items may be meshes; the pool does
 *              not add them to a scene (D14: holder owns add/remove).
 * Inheritance: N/A
 * syncRender writes: N/A
 * Never writes: item gameplay state (reset callback may)
 * Scene ownership: holder (Ship | Manager | RunScene), never the pool
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 * N/A for feel — ObjectPool is infrastructure. Capacities are declared by
 * the consuming card and live in BALANCE (to be added on those cards):
 *
 *   BALANCE.pools.weaponShots   // D01 / E04 — laser volley worst case
 *   BALANCE.pools.enemyShots    // E03
 *   BALANCE.pools.enemies       // E05 / ENM-02
 *   BALANCE.pools.meteors       // E06
 *   BALANCE.pools.drops         // F02 / RES-03
 *   BALANCE.pools.vfx           // F05 / RUL-13
 *
 * This card does not pick those numbers. Exhaustion must be visible as
 * "that shot did not fire" (null), never as a hitch from `new`.
 *
 * Feel:      holding fire for 30 s and a Mega + full wave stay frame-stable
 *            because nothing is allocated per spawn (RUL-13, WPN-01).
 * Leveling:  N/A.
 * Graphics:  N/A.
 * Pillars:   4 (legibility / no stutter) and 5 (pressure that escalates
 *            without melting the heap).
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/pools/object-pool.test.ts
 * Runner: vitest
 * Mocks: factory = () => ({ id: n++ }) with a call counter; reset/disposeItem spies.
 *
 * describe('ObjectPool')
 *   it('calls factory exactly capacity times in the constructor')            // R1
 *   it('does not call factory on acquire, release, clear, or exhaustion')    // R1, R2
 *   it('returns null when the pool is exhausted instead of allocating')      // R2, Acceptance
 *   it('reuses the same object identity after release')                      // R3, WPN-01
 *   it('calls reset on release before the item is acquirable again')         // R3
 *   it('forEachActive visits only acquired items, once each')                // R4
 *   it('clear releases all actives without calling disposeItem')             // R5
 *   it('dispose calls disposeItem once per item')                            // R6
 *   it('double-release is a no-op')                                          // R7
 *   it('acquire/release do not grow arrays or allocate')                     // R8, RUL-13
 *
 * Manual:
 *   A-manual-1. [manual] hold fire 30 s (D01 + this pool): heap does not
 *               climb (WPN-01, card Acceptance).
 *
 * Coverage: R1–R8 + card Acceptance (exhaustion → null, never allocate) +
 *           WPN-01 / ENM-02 / RES-03 / RUL-13.
 */
