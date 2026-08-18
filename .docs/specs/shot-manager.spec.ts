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
 * Owns:      Every projectile pool by origin. **This card is the only module
 *            that constructs, acquire/releases, updates, syncRenders, and
 *            disposes those pools** (D02 Weapon / Laser / Plasma only call
 *            acquire). This pass: a real WeaponShot pool; enemy and bomb
 *            origins exist with capacity 0 until E03 / WPN-06. Lifecycle,
 *            expiry, off-field release. Feeds F01 the live lists later.
 * Does not own: firing cadence / energy (E07/D03), who-hits-whom (F01), applying
 *            damage (F04), visuals (shots sync themselves), Weapon/Laser classes.
 * Player-facing: N/A as a visible object. Wrong ownership leaks shots off-screen
 *            (RUL-02) or wipes enemy bolts when the laser pool clears (cross-cleanup).
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-A01 Balancer      — catalog.poolSize, BALANCE.shot.despawn
 *   SDD-A05 ObjectPool<T> — generic pool
 *   SDD-D01 WeaponShot    — player projectile class
 *
 * Not a blocker this pass:
 *   SDD-E03 EnemyShot     — enemy origin stays capacity 0 until E03
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-D02 Weapon / Laser — asAcquirePort()
 *   SDD-D04 Plasma         — same port, spawn.color orange
 *   SDD-E07 FiringManager  — does not acquire; behaviours do via the port
 *   SDD-F01 CollisionManager — pools() / forEachActive
 *   SDD-G03 RunScene       — construct / dispose
 */

// ─── 9. Agent sign-off ───────────────────────────────────────────────────────
/**
 * Orchestrator : hub-v4.3 / 2026-08-18  owns weapon pool; E03 not a D02 blocker
 * Programming  : hub-v4.3 / 2026-08-18  ShotAcquirePort; scene.add on fill (D14)
 * Game Design  : hub-v4.3 / 2026-08-18  capacity max(loadout poolSize)=128; despawn
 * TDD          : hub-v4.3 / 2026-08-18  cases named; test file not yet written (red next)
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
 * Lib: none — pool orchestration only. THREE work stays inside D01.
 * G03 passes scene so the factory can scene.add each filled WeaponShot (D14).
 * Weapon / Laser / Plasma receive asAcquirePort() — they never hold the manager.
 */

export type ShotOrigin = 'weapon' | 'enemy' | 'bomb'

export interface ShotLike {
  active: boolean
  lifetime: number
  x: number
  z: number
  spawnX: number
  spawnZ: number
  range: number
  activate(spawn: unknown): void
  update(dt: number): void
  syncRender(): void
  deactivate(): void
}

export interface ObjectPoolPort<T> {
  readonly capacity: number
  acquire(): T | null
  release(item: T): void
  forEachActive(fn: (item: T) => void): void
  clear(): void
  dispose(): void
}

export interface ShotAcquirePort {
  acquire(): ShotLike | null
}

export interface ShotDespawn {
  readonly zNear: number
  readonly zFar: number
  readonly halfX: number
}

export interface ShotManagerOptions {
  readonly scene: { add(object: unknown): void; remove(object: unknown): void }
  readonly weaponFactory: () => ShotLike
  readonly weaponCapacity: number
  readonly despawn: ShotDespawn
  /** Defaults 0 until E03 / WPN-06. */
  readonly enemyFactory?: () => ShotLike
  readonly enemyCapacity?: number
  readonly bombFactory?: () => ShotLike
  readonly bombCapacity?: number
}

export declare class ShotManager {
  constructor(options: ShotManagerOptions)

  /** Laser / Plasma bind this. Origin is frozen to 'weapon'. */
  asAcquirePort(): ShotAcquirePort
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
 *   weaponPool  | pool    | D01 WeaponShot · capacity = max(loadout poolSizes) = 128
 *   enemyPool   | pool    | capacity 0 this pass; E03 later fills it
 *   bombPool    | pool    | capacity 0 until WPN-06; acquire('bomb') returns null
 *
 *   Constructor fills the weapon pool, scene.add each mesh, reset = deactivate.
 *   asAcquirePort — { acquire: () => this.acquire('weapon') } for D02/D04.
 *   acquire — returns null on exhaustion (A05 rule); never `new`s a shot in update.
 *   update  — forEachActive: shot.update(dt); then expire:
 *             weapon origin → lifetime<=0 OR distXZ(spawn) >= range
 *             enemy/bomb    → lifetime<=0 OR world AABB (zNear/zFar/halfX).
 *             Player bolts must NOT die on a fixed world plane (the playfield
 *             follows the ship). Does not call F01/F04.
 *   pools() — [weapon, enemy, bomb] in stable order for F01.
 *   clear('weapon') must leave enemy/bomb actives untouched (no cross-cleanup).
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. Three origin pools exist; enemy/bomb may be size 0 but the origin key is valid.
 *   R2. acquire/release never cross origins — a WeaponShot cannot enter the enemy pool.
 *   R3. clear(origin) / weapon-pool exhaustion does not deactivate other origins.
 *   R4. update releases weapon shots with lifetime<=0 or dist-from-spawn >= range.
 *       World AABB (BALANCE.shot.despawn) is enemy/bomb only — never a laser wall
 *       in world space (RUL-02 still holds via lifetime/range).
 *   R5. update does not hit-test, apply damage, or spawn VFX.
 *   R6. Memory: pools only. Per-frame allocation: none (no arrays built in update).
 *   R7. pools() returns the same three references every call (F01 may store them).
 *   R8. acquire returns null when that origin is exhausted — no growth (WPN-01).
 *   R9. syncRender only forwards to active shots; manager has no mesh.
 *   R10. dispose() disposes all three pools exactly once and scene.remove each mesh.
 *   R11. Weapon / Laser / Plasma do not construct or dispose this pool.
 *   R12. Constructor does the scene.add of filled shots; D01 does not.
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      N/A — no visual
 * Inheritance: N/A (pure logic)
 * syncRender writes: forwards to each active shot.syncRender()
 * Never writes: shot lifetime / pool membership
 * Scene ownership: this manager scene.adds on fill and scene.removes on dispose
 *                  (D14). RunScene owns the manager instance.
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 * No new feel numbers. Pool sizes live on the catalog; despawn lives on A01:
 *   BALANCE.weapons.catalog.laser.poolSize  = 128
 *   BALANCE.weapons.catalog.plasma.poolSize = 32
 *   weaponCapacity = max(loadout map poolSize) = 128 this pass
 *   BALANCE.shot.despawn = { zNear: 16, zFar: -32, halfX: 16 }
 *     // slightly looser than enemy despawn so bolts can leave the field cleanly
 *   enemy / bomb capacity = 0 until those cards
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
 * Mocks: fake ShotLike factory (no real THREE required if factory returns a stub);
 *        scene { add, remove } spies; BALANCE.shot.despawn
 *
 * describe('ShotManager')
 *   it('exposes weapon, enemy and bomb origin pools')                                 // R1
 *   it('scene.add is called once per filled weapon shot (not per acquire)')           // R12, D14
 *   it('asAcquirePort().acquire() is the weapon origin')                              // R11
 *   it('acquire(weapon) never returns a shot that lives in the enemy pool')           // R2
 *   it('clear(weapon) leaves enemy actives alive (no cross-cleanup)')                 // R3
 *   it('update releases a shot whose lifetime elapsed')                               // R4, WPN-01
 *   it('does not kill a weapon shot at the world zFar plane (range is from spawn)')   // R4
 *   it('releases a weapon shot that has travelled its range from the fire point')     // R4
 *   it('lets a weapon shot fired further forward travel the same range')              // R4
 *   it('update releases an enemy shot past world despawn bounds')                     // R4, RUL-02
 *   it('update does not call a CollisionManager or DamageSink')                       // R5
 *   it('update allocates no arrays or shots')                                         // R6
 *   it('pools() returns the same three references across calls')                      // R7
 *   it('acquire returns null when that origin is exhausted')                          // R8, WPN-01
 *   it('syncRender forwards to actives and has no own mesh')                          // R9
 *   it('dispose disposes all three pools and scene.remove each filled mesh')          // R10
 *   it('shots of all sources coexist without cross-cleanup (acceptance)')             // card
 *
 * Manual:
 *   A-manual-1. [manual] hold fire 30s — no GC spike, bolts despawn off-field
 *
 * Coverage: R1–R12 + WPN-01 + RUL-02 + card Acceptance.
 */
