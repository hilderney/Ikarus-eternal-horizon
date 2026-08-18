/**
 * #tag/arch #tag/managers #tag/memory
 *
 * Card:         SDD-E04 ShotManager
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: WPN-01, RUL-02
 * Change type:  new
 * POC-1 origin: none (new) — owns the pools D01 / E03 acquire from; bomb slot declared
 * Test file:    poc2/src/systems/shot-manager.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      Every projectile pool by origin — weapon (D01), enemy (E03), bomb
 *            (declared empty until hub §7 WPN-06). Acquisition, lifecycle, expiry,
 *            off-field release. Feeds CollisionManager the live shot lists.
 * Does not own: firing cadence / energy (E07/D03), who-hits-whom (F01), applying
 *            damage (F04), visuals (shots sync themselves).
 * Player-facing: N/A as a visible object. Wrong ownership leaks shots off-screen
 *            (RUL-02) or wipes enemy bolts when the laser pool clears (cross-cleanup).
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-A05 ObjectPool<T> — generic pool
 *   SDD-D01 WeaponShot    — player projectile class
 *   SDD-E03 EnemyShot     — hostile projectile class
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-E07 FiringManager    — acquireWeaponShot
 *   SDD-E05 EnemyManager     — acquireEnemyShot (when §7 fires)
 *   SDD-F01 CollisionManager — pools() / forEachActive
 *   SDD-G03 RunScene         — construct / dispose
 */

// ─── 9. Agent sign-off ───────────────────────────────────────────────────────
/**
 * Orchestrator : hub-v4.1 / 2026-08-17  scope, requires, DoD
 * Programming  : hub-v4.1 / 2026-08-17  three origin pools, expiry, no cross-cleanup
 * Game Design  : hub-v4.1 / 2026-08-17  N/A visual; pool sizes from D01/E03
 * TDD          : hub-v4.1 / 2026-08-17  cases named; test file not yet written (red next)
 *
 * DoD (§6.1): spec · tests red · shape · lifecycle · BALANCE · memory ·
 *             IDs · verify green · port fidelity
 * Status: spec-complete
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Programming / Three.js
// ═════════════════════════════════════════════════════════════════════════════

// ─── 2. Contract ─────────────────────────────────────────────────────────────
/**
 * Lib: none — pool orchestration only. THREE work stays inside D01/E03.
 */

export type ShotOrigin = 'weapon' | 'enemy' | 'bomb'

export interface ShotLike {
  active: boolean
  lifetime: number
  x: number
  z: number
  activate(spawn: unknown): void
  update(dt: number): void
  syncRender(): void
  deactivate(): void
  isOffField?(): boolean
}

export interface ObjectPoolPort<T> {
  readonly capacity: number
  acquire(): T | null
  release(item: T): void
  forEachActive(fn: (item: T) => void): void
  clear(): void
  dispose(): void
}

export interface ShotManagerOptions {
  readonly weaponPool: ObjectPoolPort<ShotLike>
  readonly enemyPool: ObjectPoolPort<ShotLike>
  readonly bombPool: ObjectPoolPort<ShotLike>
  readonly despawn: { readonly zNear: number; readonly zFar: number; readonly halfX: number }
}

export declare class ShotManager {
  constructor(options: ShotManagerOptions)

  acquire(origin: ShotOrigin): ShotLike | null
  release(origin: ShotOrigin, shot: ShotLike): void
  /** Live pools F01 iterates — never a merged destructive list. */
  pools(): readonly ObjectPoolPort<ShotLike>[]
  pool(origin: ShotOrigin): ObjectPoolPort<ShotLike>
  /** Ticks active shots, releases lifetime<=0 or off-field. Does not hit-test. */
  update(dt: number): void
  syncRender(): void
  /** Clears one origin. Must not touch the others. */
  clear(origin: ShotOrigin): void
  clearAll(): void
  dispose(): void
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   field       | type    | meaning / unit / range
 *   ------------|---------|-----------------------
 *   weaponPool  | pool    | D01 WeaponShot · capacity from catalog poolSize (128 laser)
 *   enemyPool   | pool    | E03 EnemyShot · BALANCE.enemy.shot.poolSize (64)
 *   bombPool    | pool    | empty / capacity 0 until WPN-06; acquire('bomb') returns null
 *
 *   acquire — returns null on exhaustion (A05 rule); never `new`s a shot in update.
 *   update  — forEachActive: shot.update(dt); if lifetime<=0 or off-field → release.
 *             Does not call CollisionManager or DamageResolver.
 *   pools() — [weapon, enemy, bomb] in stable order for F01.
 *   clear('weapon') must leave enemy/bomb actives untouched (no cross-cleanup).
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. Three origin pools exist; bomb may be size 0 but the origin key is valid.
 *   R2. acquire/release never cross origins — a WeaponShot cannot enter the enemy pool.
 *   R3. clear(origin) / weapon-pool exhaustion does not deactivate other origins.
 *   R4. update releases shots with lifetime<=0 (expiry) or off-field (RUL-02).
 *   R5. update does not hit-test, apply damage, or spawn VFX.
 *   R6. Memory: pools only. Per-frame allocation: none (no arrays built in update).
 *   R7. pools() returns the same three references every call (F01 may store them).
 *   R8. acquire returns null when that origin is exhausted — no growth (WPN-01).
 *   R9. syncRender only forwards to active shots; manager has no mesh.
 *   R10. dispose() disposes all three pools exactly once.
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      N/A — no visual
 * Inheritance: N/A (pure logic)
 * syncRender writes: forwards to each active shot.syncRender()
 * Never writes: shot lifetime / pool membership
 * Scene ownership: RunScene owns the manager; pools own scene add/remove of shots
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 * No new feel numbers. Pool sizes live on the projectile cards:
 *   BALANCE.weapons.catalog[id].poolSize  // D01 / D02 (laser 128)
 *   BALANCE.enemy.shot.poolSize           = 64
 *   BALANCE.bomb.shot.poolSize            = 0   // declared, unused until §7
 *   BALANCE.shot.despawn                  = { zNear: 16, zFar: -32, halfX: 16 }
 *     // slightly looser than enemy despawn so bolts can leave the field cleanly
 *
 * Feel:      N/A as an object. Player notices leaks (bolts hanging off-field) or
 *            a laser volley wiping incoming enemy fire — both bugs.
 * Leveling:  N/A
 * Graphics:  N/A
 * Pillars:   4 (frame-stable field, RUL-13 via pools) · 5 (pressure needs both origins live).
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/systems/shot-manager.test.ts
 * Runner: vitest
 * Mocks: fake ObjectPoolPort<ShotLike> per origin, BALANCE.shot.despawn
 *
 * describe('ShotManager')
 *   it('exposes weapon, enemy and bomb origin pools')                                 // R1
 *   it('acquire(weapon) never returns a shot that lives in the enemy pool')           // R2
 *   it('clear(weapon) leaves enemy actives alive (no cross-cleanup)')                 // R3, acceptance
 *   it('update releases a shot whose lifetime elapsed')                               // R4, WPN-01
 *   it('update releases a shot past despawn bounds')                                  // R4, RUL-02
 *   it('update does not call a CollisionManager or DamageSink')                       // R5
 *   it('update allocates no arrays or shots')                                         // R6
 *   it('pools() returns the same three references across calls')                      // R7
 *   it('acquire returns null when that origin is exhausted')                          // R8, WPN-01
 *   it('syncRender forwards to actives and has no own mesh')                          // R9
 *   it('dispose disposes all three pools')                                            // R10
 *   it('shots of all sources coexist without cross-cleanup (acceptance)')             // card
 *
 * Manual:
 *   A-manual-1. [manual] hold fire 30s + dummy enemy bolts — no GC spike, no wipe
 *
 * Coverage: R1–R10 + WPN-01 + RUL-02 + card Acceptance.
 */
