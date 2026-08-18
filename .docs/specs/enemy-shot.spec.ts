/**
 * #tag/arch #tag/enemies #tag/weapons #tag/memory
 *
 * Card:         SDD-E03 EnemyShot
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: ENM-01, SHIP-05
 * Change type:  new
 * POC-1 origin: none (new) — reuses D01 Shot contract with a different layer
 * Test file:    poc2/src/gameobjects/shot/enemy-shot.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      The hostile projectile — `EnemyShot extends THREE.Mesh`. Same Shot
 *            contract and lifecycle as D01 WeaponShot (activate / update / effectiveDamage /
 *            decay / pooled). Collision layer is EnemyShot. Minimal until ranged
 *            patterns land in hub §7.
 * Does not own: enemy AI or fire cadence (E01/E05/§7), the weapon/bomb pools (E04),
 *            Force Field absorption (C03 via F04), the who-hits-whom matrix (F01).
 * Player-facing: a warm bolt that is a threat to the ship. If it chips hull while
 *            the shield is up, SHIP-05 is broken.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-A05 ObjectPool<T> — pooled slots
 *   SDD-D01 WeaponShot    — ShotSpawn / ShotPort copied, not forked
 *   SDD-E01 Enemy         — shooter identity; muzzle lives on the enemy
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-E04 ShotManager      — enemy origin pool
 *   SDD-F01 CollisionManager — Layer.EnemyShot → Player only
 *   SDD-F04 DamageResolver   — effectiveDamage() into ShipHealth (C03)
 *   SDD-C03 ShipHealth       — Force Field absorbs first (SHIP-05)
 */

// ─── 9. Agent sign-off ───────────────────────────────────────────────────────
/**
 * Orchestrator : hub-v4.1 / 2026-08-17  scope, requires, DoD
 * Programming  : hub-v4.1 / 2026-08-17  Shot contract parity with D01, Layer.EnemyShot
 * Game Design  : hub-v4.1 / 2026-08-17  warm bolt vs cyan laser, damage vs shield
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
 * Same Shot contract as D01. Do not add fields D01 does not have except `layer`.
 * Lib: Three.js (Mesh). Yuka aiming is §7 — not this card.
 */

/** Identical to D01 WeaponShot. Color is a constructor option, not spawn data. */
export interface ShotSpawn {
  readonly x: number
  readonly z: number
  readonly vx: number
  readonly vz: number
  readonly damage: number
  readonly lifetime: number
  readonly totalLifetime: number
  readonly radius: number
  readonly aoeRadius: number
  readonly range: number
  readonly decayPerUnit: number
}

export interface EnemyShotOptions {
  /** Presentation only. BALANCE.enemy.shot.color — never laser 0x22d3ee. */
  readonly color: number
}

export interface ShotPort {
  active: boolean
  x: number
  z: number
  vx: number
  vz: number
  damage: number
  lifetime: number
  radius: number
  aoeRadius: number
  range: number
  decayPerUnit: number
  totalLifetime: number
  spawnX: number
  spawnZ: number
  activate(spawn: ShotSpawn): void
  update(dt: number): void
  syncRender(): void
  deactivate(): void
  effectiveDamage(): number
  dispose(): void
}

export declare class EnemyShot extends THREE.Mesh implements ShotPort {
  constructor(options: EnemyShotOptions)

  /** F01 layer — the only intentional contract difference from WeaponShot. */
  readonly layer: 3
  active: boolean
  x: number
  z: number
  vx: number
  vz: number
  damage: number
  lifetime: number
  radius: number
  aoeRadius: number
  range: number
  decayPerUnit: number
  totalLifetime: number
  spawnX: number
  spawnZ: number

  activate(spawn: ShotSpawn): void
  update(dt: number): void
  syncRender(): void
  deactivate(): void
  effectiveDamage(): number
  dispose(): void
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   field     | type   | meaning / unit / range
 *   ----------|--------|-----------------------
 *   layer     | Layer.EnemyShot (3) | F01: hits Player only
 *   (rest)    | = D01  | copy ShotSpawn / decayFactor 25% lifetime steps
 *
 *   effectiveDamage — damage × decayFactor (D01 rule). F04 reads this; this class
 *                     never calls ShipHealth.
 *   aoeRadius — 0 for G0 enemy bolts. AoE hostile orbs are §7.
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. EnemyShot extends THREE.Mesh and implements the D01 ShotPort.
 *   R2. layer is Layer.EnemyShot (3), never PlayerShot.
 *   R3. activate/update/effectiveDamage/decay match D01 (25% lifetime steps on
 *       opacity and damage when totalLifetime>0).
 *   R4. Memory: pooled by E04. deactivate ≠ dispose.
 *   R5. Per-frame allocation: none.
 *   R6. Does not apply damage. F04 routes EnemyShot→Player into C03.applyDamage.
 *   R7. Force Field absorbs before Integrity (SHIP-05) — asserted with a C03 fake;
 *       this class only supplies effectiveDamage and layer.
 *   R8. aoeRadius is 0 in G0. No homing (Yuka aiming = §7).
 *   R9. syncRender writes position, opacity (decay), scale (2×radius thickness).
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      THREE.Mesh · BoxGeometry (shared with D01 proportions) · MeshBasicMaterial
 *              additive · BALANCE.enemy.shot.color (warm) — never laser 0x22d3ee
 * Inheritance: extends THREE.Mesh
 * syncRender writes: position, material.opacity, scale (thickness = 2 × radius)
 * Never writes: lifetime, damage, layer
 * Scene ownership: ShotManager enemy pool
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 * New keys under BALANCE.enemy.shot (declare on SDD-A01). G0 values — ranged
 * cadence is §7; these numbers exist so a spawned bolt is already fair.
 *
 *   BALANCE.enemy.shot.speed     = 10     // < laser 30; readable incoming
 *   BALANCE.enemy.shot.damage    = 8      // 50 shield ⇒ ~7 hits to break; not a sniper
 *   BALANCE.enemy.shot.lifetime  = 2      // range ≈ 20 world units
 *   BALANCE.enemy.shot.radius    = 0.14   // slightly fatter than laser 0.12
 *   BALANCE.enemy.shot.color     = 0xfb7185 // warm rose bolt vs player cyan 0x22d3ee
 *   BALANCE.enemy.shot.poolSize  = 64     // E04
 *   BALANCE.enemy.shot.aoeRadius = 0
 *
 * Feel:      Incoming threat, not a reverse laser. Slow enough to dodge, fat enough
 *            to read. Hitting the ship must feel like a shield hit first (SHIP-05).
 * Leveling:  §7 fire patterns / MiniBoss cadence. This card does not scale damage
 *            with F03 — F03 may later multiply via E05, not here.
 * Graphics:  Additive warm rose. Distinct from cyan PlayerShot at a glance (<0.3s).
 *            Thickness = 2 × radius (D01 parity).
 * Pillars:   1 visible risk · 2 tangible degradation (shield then hull, via F04) · 4 legibility.
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/gameobjects/shot/enemy-shot.test.ts
 * Runner: vitest
 * Mocks: BALANCE.enemy.shot, THREE stubs, D01 decayFactor if extracted to A03
 *
 * describe('EnemyShot')
 *   it('extends THREE.Mesh and satisfies ShotPort')                                   // R1
 *   it('exposes layer EnemyShot not PlayerShot')                                      // R2, ENM-01
 *   it('effectiveDamage follows D01 25% lifetime decay steps')                        // R3
 *   it('activate/deactivate recycle without dispose')                                  // R4
 *   it('update allocates nothing')                                                    // R5
 *   it('never calls applyDamage or ShipHealth')                                       // R6
 *   it('a fake C03 sink absorbs EnemyShot damage on shield before hull')              // R7, SHIP-05
 *   it('aoeRadius is 0 and velocity is ballistic (no seek)')                          // R8
 *   it('syncRender thickness equals 2 × radius')                                      // R9
 *   it('an activated bolt reaching the player reports EnemyShot→Player (acceptance)') // ENM-01
 *
 * Manual:
 *   A-manual-1. [manual] warm rose bolt vs cyan laser is distinct <0.3s
 *
 * Coverage: R1–R9 + ENM-01 + SHIP-05 + card Acceptance.
 */
