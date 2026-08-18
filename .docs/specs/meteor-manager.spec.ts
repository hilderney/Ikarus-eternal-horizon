/**
 * #tag/arch #tag/asteroids #tag/managers #tag/memory
 *
 * Card:         SDD-E06 MeteorManager
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: ENM-04
 * Change type:  new
 * POC-1 origin: none (new)
 * Test file:    poc2/src/systems/meteor-manager.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      Asteroid population — spawn, inert-drift tick, fragmentation trigger,
 *            pooling, shared lanes with E05. Scales spawn mix/rate from F03.
 *            Registers Layer.Meteor colliders.
 * Does not own: Meteor class (E02), Drop construction (F02 — consumes wantsFragments),
 *            Mega Asteroid event body (ENM-07 / §7), difficulty math (F03).
 * Player-facing: rocks sharing the field with enemies; shot-down rocks pay fragments.
 *            A meteor-only corridor or a pile of off-screen spheres is a miss.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-A01 Balancer — BALANCE.meteor.*
 *   SDD-A05 ObjectPool<T>
 *   SDD-E02 Meteor
 *   SDD-F03 DifficultyManager — spawnRateMul, pendingMilestone 'megaAsteroid'
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-F01 CollisionManager
 *   SDD-F02 DropManager — wantsFragments
 *   SDD-G03 RunScene
 */

// ─── 9. Agent sign-off ───────────────────────────────────────────────────────
/**
 * Orchestrator : hub-v4.1 / 2026-08-17  scope, requires, DoD
 * Programming  : hub-v4.1 / 2026-08-17  pool, lanes, fragment flag, F03 rate
 * Game Design  : hub-v4.1 / 2026-08-17  S/M/L mix, shared lanes, mega flag only
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
 * Lib: none for orchestration (first-party). Three.js add/remove of Meteor meshes.
 * Drift lives on E02; this class does not add seek.
 */

export type MeteorSize = 'S' | 'M' | 'L'

export interface DifficultyPort {
  readonly spawnRateMul: number
  readonly patternId: string
  readonly pendingMilestone: 'miniBoss' | 'megaAsteroid' | 'boss' | null
}

export interface ColliderRegistryPort {
  registerTarget(t: unknown): void
  unregisterTarget(t: unknown): void
}

export interface ObjectPoolPort<T> {
  readonly capacity: number
  acquire(): T | null
  release(item: T): void
  forEachActive(fn: (item: T) => void): void
  clear(): void
  dispose(): void
}

export interface MeteorLike {
  active: boolean
  size: MeteorSize
  wantsFragments: boolean
  activate(spawn: unknown): void
  update(dt: number): void
  syncRender(): void
  isOffField(): boolean
  deactivate(): void
}

export interface FragmentSink {
  /** F02. Called once per killed meteor; manager then clears wantsFragments. */
  onMeteorDestroyed(meteor: MeteorLike): void
}

export interface MeteorManagerOptions {
  readonly pool: ObjectPoolPort<MeteorLike>
  readonly difficulty: DifficultyPort
  readonly colliders: ColliderRegistryPort
  readonly fragments: FragmentSink
  readonly scene: { add(obj: unknown): void; remove(obj: unknown): void }
}

export declare class MeteorManager {
  constructor(options: MeteorManagerOptions)

  readonly liveCount: number
  spawnOne(size?: MeteorSize, at?: { x: number; z: number }): MeteorLike | null
  update(dt: number): void
  syncRender(): void
  forEachLive(fn: (m: MeteorLike) => void): void
  clear(): void
  dispose(): void
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   field     | type    | meaning / unit / range
 *   ----------|---------|-----------------------
 *   liveCount | int     | active meteors
 *   spawnAcc  | sec     | toward next spawn
 *   sizeMix   | weights | BALANCE.meteor.spawn.weights {S,M,L}
 *
 *   spawnOne — acquire; activate with size from mix (or arg), vx/vz from driftSpeed
 *              range, x snapped to shared lanesX (same array as E05).
 *   update   — timer like E05 using meteor.spawn.intervalSec / spawnRateMul.
 *              tick each meteor; off-field → release; wantsFragments → fragments
 *              .onMeteorDestroyed then release (do not spawn Drop here).
 *   Mega     — pendingMilestone==='megaAsteroid' is stored/exposed; do not spawn
 *              a Mega class (ENM-07 / §7).
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. Spawns on a timer scaled by F03.spawnRateMul into shared lanesX.
 *   R2. Size is rolled from BALANCE.meteor.spawn.weights (S/M/L), not a single size.
 *   R3. Pooled; exhaustion returns null; liveCount ≤ pool.capacity.
 *   R4. Off-field meteors release the same frame (RUL-02, even though card Maps is ENM-04).
 *   R5. wantsFragments ⇒ FragmentSink.onMeteorDestroyed exactly once, then release.
 *   R6. Does not construct Drop, Enemy, or Mega Asteroid.
 *   R7. Per-frame allocation: none.
 *   R8. Register/unregister with F01 on spawn/release.
 *   R9. Drift is E02's job — manager must not add seek toward the player.
 *   R10. dispose clears colliders and the pool.
 *   R11. pendingMilestone 'megaAsteroid' does not allocate a fourth size.
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      N/A as a manager — Meteor meshes are the visual
 * Inheritance: N/A
 * syncRender writes: forwards Meteor.syncRender()
 * Never writes: wantsFragments (except clearing after the sink call in update)
 * Scene ownership: this manager adds/removes Meteor meshes
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 * New keys (declare on SDD-A01):
 *   BALANCE.meteor.spawn.intervalSec = 2.4   // slower than enemies (1.6) — rocks punctuate
 *   BALANCE.meteor.spawn.weights     = { S: 0.5, M: 0.35, L: 0.15 }
 *   BALANCE.enemy.spawn.lanesX       = [-4, -2, 0, 2, 4]  // SAME array — mixed field
 *   BALANCE.meteor.driftSpeed        = { min: 1.5, max: 3.5 }
 *   BALANCE.meteor.poolSize          = 24
 *
 * Feel:      Shared sky. A lane with an enemy and a rock is the point — not a
 *            meteor weather layer behind the fight. L is rare enough to be an event;
 *            S is clutter. Destroying one must visibly pay (F02).
 * Leveling:  F03 rate. Mega@100 is a milestone flag, not hp inflation of L.
 * Graphics:  N/A (E02 ice/metal). Mixing lanes is the readability rule — player
 *            never has to ask "which game is this object in".
 * Pillars:   4 legibility · 1 visible risk · 5 loot-on-kill loop (ENM-04 / RES-01).
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/systems/meteor-manager.test.ts
 * Runner: vitest
 * Mocks: pool, DifficultyPort, colliders, FragmentSink, scene, BALANCE.meteor
 *
 * describe('MeteorManager')
 *   it('spawns on intervalSec / spawnRateMul into a lanesX x')                        // R1, ENM-04
 *   it('rolled sizes over many spawns include S, M and L')                            // R2
 *   it('returns null on pool exhaustion without allocating')                          // R3
 *   it('releases isOffField meteors the same update')                                 // R4
 *   it('calls FragmentSink once when wantsFragments is true then releases')           // R5, ENM-04
 *   it('does not construct Drop or a Mega class')                                     // R6, R11
 *   it('update allocates nothing')                                                    // R7
 *   it('registerTarget on spawn, unregisterTarget on release')                        // R8
 *   it('does not write meteor vx/vz toward the seek target')                          // R9
 *   it('dispose clears the pool and colliders')                                       // R10
 *   it('pendingMilestone megaAsteroid does not spawn a fourth size')                  // R11
 *   it('asteroids share the field with enemies and match difficulty (acceptance)')    // card
 *
 * Manual:
 *   A-manual-1. [manual] meteors and enemies occupy the same lanes, not two bands
 *
 * Coverage: R1–R11 + ENM-04 + card Acceptance.
 */
