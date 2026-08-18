/**
 * #tag/arch #tag/resources #tag/memory
 *
 * Card:         SDD-F02 DropManager
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: RES-01, RES-02, RES-03, RES-04, RES-05
 * Change type:  new
 * POC-1 origin: none (new)
 * Test file:    poc2/src/systems/drop-manager.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      Drop tables per killed source, pooled fragment spawn, magnet-radius
 *            pull toward the ship, collection into C01 inventory counts, stock caps
 *            (surplus not collected). Layer.Drop colliders for F01 Player→Drop.
 * Does not own: inventory storage internals (C01), Meteor fragmentation geometry
 *            (E02/E06 flags wantsFragments), HUD counters (G07 reads inventory),
 *            equipment-as-item (RES-06 / §7).
 * Player-facing: wrecks sprinkle Metal Scrap that slides in at 2.5 world units and
 *            ticks the counter. Cap-full scrap sitting on the field is correct;
 *            vanishing loot or heap growth is not.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-A01 Balancer — drops.magnetRadius 2.5, metalScrapChance 0.4, stockCaps
 *   SDD-A03 Math     — distXZ, damp
 *   SDD-A05 ObjectPool<T> — fragment pool (RES-03)
 *   SDD-C01 Ship     — InventoryPort + position for magnet
 *   SDD-F01 CollisionManager — Player→Drop pairs / Layer.Drop
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-E06 MeteorManager — FragmentSink
 *   SDD-F04 DamageResolver — killed events as an alternate spawn trigger
 *   SDD-G07 HUD            — resource counters
 *   SDD-G11 Pause inventory — read-only counts
 */

// ─── 9. Agent sign-off ───────────────────────────────────────────────────────
/**
 * Orchestrator : hub-v4.1 / 2026-08-17  scope, requires, DoD
 * Programming  : hub-v4.1 / 2026-08-17  tables, magnet, caps, pooled Drop fragments
 * Game Design  : hub-v4.1 / 2026-08-17  2.5 / 0.4, five-type table, stock caps
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
 * Lib: none for rules; Three.js Mesh for the pooled Drop fragment.
 * One public runtime class `DropManager`; `Drop` is the pooled fragment it owns
 * (implementation may live in drop.ts next to the manager).
 */

export type ResourceId =
  | 'metalScrap'
  | 'prismaticCrystal'
  | 'denseCore'
  | 'darkMatter'
  | 'equipment'

export type DropSource = 'enemy' | 'meteor' | 'miniBoss' | 'megaAsteroid' | 'boss'

export interface DropTableEntry {
  readonly id: ResourceId
  readonly chance: number
  readonly min: number
  readonly max: number
}

export interface InventoryPort {
  count(id: ResourceId): number
  cap(id: ResourceId): number
  /** Returns the amount actually accepted (0 if at cap). */
  tryAdd(id: ResourceId, amount: number): number
}

export interface MagnetTargetPort {
  readonly x: number
  readonly z: number
}

export interface DropSpawn {
  readonly x: number
  readonly z: number
  readonly id: ResourceId
  readonly amount: number
}

export declare class Drop extends THREE.Mesh {
  readonly layer: 5
  active: boolean
  id: ResourceId
  amount: number
  x: number
  z: number
  radius: number
  activate(spawn: DropSpawn): void
  deactivate(): void
  update(dt: number, pull: { x: number; z: number; speed: number } | null): void
  syncRender(): void
  dispose(): void
}

export interface DropManagerOptions {
  readonly pool: { acquire(): Drop | null; release(d: Drop): void; forEachActive(fn: (d: Drop) => void): void; dispose(): void }
  readonly inventory: InventoryPort
  readonly magnet: MagnetTargetPort
  readonly colliders: { registerTarget(t: Drop): void; unregisterTarget(t: Drop): void }
}

export declare class DropManager {
  constructor(options: DropManagerOptions)

  /** E06 FragmentSink + F04 killed hook. */
  onSourceKilled(source: DropSource, x: number, z: number): void
  onMeteorDestroyed(meteor: { x: number; z: number; size: 'S' | 'M' | 'L' }): void
  collect(drop: Drop): void
  update(dt: number): void
  syncRender(): void
  liveCount(): number
  dispose(): void
}

export declare function rollTable(table: readonly DropTableEntry[], rand: () => number): readonly { id: ResourceId; amount: number }[]

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   field     | type     | meaning / unit / range
 *   ----------|----------|-----------------------
 *   tables    | data     | BALANCE.drops.tables[source]
 *   magnetR   | world    | 2.5
 *   magnetSpd | world/s  | BALANCE.drops.magnetSpeed
 *   pool      | Drop[]   | BALANCE.drops.poolSize
 *
 *   onSourceKilled — rollTable; for each grant acquire+activate; skip if pool null.
 *   update — if distXZ(drop, ship) <= magnetRadius, pull (no alloc); if F01 collect
 *            pair or dist <= drop.radius + shipRadius, collect().
 *   collect — inventory.tryAdd; if accepted>0 release; if 0 leave on field (RES-05).
 *   Drop.layer = Layer.Drop (5).
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. Destroyed enemy/meteor rolls BALANCE.drops.tables[source] (RES-01, RES-04).
 *   R2. Enemy Metal Scrap uses metalScrapChance 0.4; meteor table chance is 1.0 for scrap.
 *   R3. Fragments are pooled; exhaustion skips a spawn; liveCount ≤ pool.capacity (RES-03).
 *   R4. dist ≤ magnetRadius pulls toward the ship at magnetSpeed (RES-02).
 *   R5. Collection calls inventory.tryAdd and releases only on accepted>0 (RES-02).
 *   R6. At cap, tryAdd returns 0 and the fragment stays active (RES-05).
 *   R7. Full five ResourceIds exist on the table type; G0/G1 unused chances may be 0
 *       but the keys are present (RES-04).
 *   R8. Per-frame allocation: none (roll results written into a scratch grant list).
 *   R9. Off-field drops recycle to the pool (RUL-02 adjacency).
 *   R10. Does not write score or apply damage.
 *   R11. Drop extends THREE.Mesh; syncRender writes position/opacity only.
 *   R12. Magnet uses A03 distXZ; no per-drop `new Vector3`.
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      Drop extends THREE.Mesh · small Box/Octahedron · MeshBasicMaterial
 *              colour per ResourceId (BALANCE.drops.colors) · additive spark
 * Inheritance: Drop extends THREE.Mesh; manager is logic
 * syncRender writes: Drop position, opacity (pulse), visible
 * Never writes: inventory counts (C01), BALANCE
 * Scene ownership: DropManager pool add/remove
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 * A01 already has magnetRadius + metalScrapChance; this card fills the table (A01 add):
 *   BALANCE.drops.magnetRadius      = 2.5
 *   BALANCE.drops.magnetSpeed       = 8      // snaps in without teleporting
 *   BALANCE.drops.metalScrapChance  = 0.4    // enemy table
 *   BALANCE.drops.fragmentRadius    = 0.22
 *   BALANCE.drops.poolSize          = 64
 *   BALANCE.drops.despawn            = { zNear: 12, halfX: 14 }
 *   BALANCE.drops.stockCaps = {
 *     metalScrap: 99, prismaticCrystal: 40, denseCore: 20, darkMatter: 8, equipment: 4
 *   }
 *   BALANCE.drops.tables.enemy = [
 *     { id: 'metalScrap', chance: 0.4, min: 1, max: 1 },
 *     { id: 'prismaticCrystal', chance: 0, min: 0, max: 0 }, // G2
 *   ]
 *   BALANCE.drops.tables.meteor = [
 *     { id: 'metalScrap', chance: 1, min: 1, max: 2 },
 *   ]
 *   BALANCE.drops.tables.miniBoss / megaAsteroid / boss — keys present, G1 chances 0
 *   BALANCE.drops.colors = {
 *     metalScrap: 0xc4b5a5, prismaticCrystal: 0xc084fc, denseCore: 0xfbbf24,
 *     darkMatter: 0x7c3aed, equipment: 0x34d399
 *   }
 *
 * Feel:      Common scrap is a regular drip (0.4 on ships, always on rocks) — enough
 *            to feed G1 repair, not a vacuum cleaner. Magnet 2.5 is a courtesy, not
 *            a screen-wide suck. Caps make hoarding visible: the gem sits there.
 * Leveling:  rarity ramps via tables / F03 sources (MiniBoss etc. §7), not magnet size.
 * Graphics:  dull-metal scrap vs purple crystal vs gold core — readable <0.3s by colour.
 *            Tiny wireframe chips, not enemy-scale boxes.
 * Pillars:   5 one-more-kill (loot) · 3 progression without dead time · 4 legibility.
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/systems/drop-manager.test.ts
 * Runner: vitest
 * Mocks: BALANCE.drops, InventoryPort, MagnetTargetPort, Drop pool, colliders, rng
 *
 * describe('DropManager')
 *   it('onMeteorDestroyed always rolls metalScrap from the meteor table')             // R1, RES-01
 *   it('onSourceKilled(enemy) grants metalScrap with chance 0.4 (rng stub 0.39/0.41)') // R2
 *   it('pool exhaustion skips a spawn and liveCount stays at size')                   // R3, RES-03
 *   it('a drop inside magnetRadius moves toward the ship')                            // R4, RES-02
 *   it('collect calls tryAdd and releases when accepted > 0')                         // R5, RES-02
 *   it('when tryAdd returns 0 the drop stays active')                                 // R6, RES-05
 *   it('tables expose all five ResourceIds')                                          // R7, RES-04
 *   it('update allocates no Vector3 / arrays')                                        // R8, R12
 *   it('off-field drops are released')                                                // R9
 *   it('does not call DamageSink or ScoreManager')                                    // R10
 *   it('Drop extends THREE.Mesh with layer Drop')                                     // R11
 *   it('destroyed enemies/asteroids drop fragments that magnet in (acceptance)')      // card
 *
 * Manual:
 *   A-manual-1. [manual] approaching scrap pulls in; HUD count ticks; SFX later (G1 audio)
 *
 * Coverage: R1–R12 + RES-01..05 + card Acceptance.
 */
