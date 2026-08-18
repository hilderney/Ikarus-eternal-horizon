/**
 * #tag/arch #tag/weapons #tag/memory
 *
 * Card:         SDD-D01 WeaponShot
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: WPN-01, SHIP-03, RUL-02
 * Change type:  class-ify
 * POC-1 origin: poc/src/gameobjects/shot.ts  — frozen reference (shot half; pool generalises to A05)
 * Test file:    poc2/src/gameobjects/shot/weapon-shot.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      The pooled player-projectile mesh. activate(spawn), ballistic
 *            update (x/z + lifetime), decayFactor-driven effectiveDamage,
 *            syncRender of position/opacity/scale, deactivate/dispose.
 * Does not own: ObjectPool (A05), ShotManager (E04), collision (F01), damage
 *            apply (F04), weapon cadence/spawn (D02+). EnemyShot / BombShot
 *            reuse this contract later (E03 / §7) with different layers.
 * Player-facing: bolt thickness equals the hit diameter; fade 100→25% over
 *            the lifetime so damage-at-range is readable as opacity.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-A01 Balancer — weapon projectile numbers via D02 catalog (speed/lifetime)
 *   SDD-A03 Math     — decayFactor (25% steps), distXZ, scratch vectors
 *   SDD-A05 ObjectPool — acquire/release; WeaponShot is the pooled T
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-D02 Weapon / Laser — activate() per bolt
 *   SDD-D04 Plasma         — same class with aoeRadius > 0
 *   SDD-E04 ShotManager    — owns the pool; release on expiry/hit
 *   SDD-F01 CollisionManager — reads x,z,radius,aoeRadius,effectiveDamage
 *   SDD-E03 EnemyShot      — pattern clone
 */

// ─── 9. Agent sign-off ───────────────────────────────────────────────────────
/**
 * Orchestrator : hub-v4.1 / 2026-08-17  scope, requires, DoD
 * Programming  : hub-v4.1 / 2026-08-17  contract, memory, THREE / view
 * Game Design  : hub-v4.1 / 2026-08-17  BALANCE, feel, leveling, graphics
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
 * Public surface. Ports first, then the class. Constructor dependencies explicit.
 * No service locators. No globals besides BALANCE.
 * `extends THREE.Mesh` — the domain object *is* its visual (hub §4).
 */

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

export interface WeaponShotOptions {
  /** Presentation only — not a gameplay number. Catalog colour (D02). */
  readonly color: number
}

export declare class WeaponShot extends THREE.Mesh {
  constructor(options: WeaponShotOptions)

  active: boolean
  x: number
  z: number
  vx: number
  vz: number
  damage: number
  lifetime: number
  radius: number
  aoeRadius: number
  decayPerUnit: number
  range: number
  totalLifetime: number
  spawnX: number
  spawnZ: number

  activate(spawn: ShotSpawn): void

  /** Logic: integrate x/z, decrement lifetime. No GPU. */
  update(dt: number): void

  /** Writes this.position, material.opacity, this.scale. */
  syncRender(): void

  deactivate(): void

  /** damage × decayFactor (A03). */
  effectiveDamage(): number

  dispose(): void
}

/**
 * Time-based 25% steps over totalLifetime; else range quarters; else
 * max(0, 1 - decayPerUnit * dist). Lives in A03; signature repeated here
 * so D01 tests can assert the contract the shot consumes.
 */
export declare function decayFactor(shot: {
  readonly lifetime: number
  readonly totalLifetime: number
  readonly x: number
  readonly z: number
  readonly spawnX: number
  readonly spawnZ: number
  readonly range: number
  readonly decayPerUnit: number
}): number

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   field             | type     | meaning / unit / range
 *   ------------------|----------|--------------------------------
 *   active            | boolean  | pooled occupancy
 *   x, z              | world    | gameplay plane (y visual = 0)
 *   vx, vz            | m/s      | ballistic, no accel
 *   damage            | number   | spawn damage (pre-decay)
 *   lifetime          | s        | remaining; ≤0 ⇒ release (E04)
 *   totalLifetime     | s        | spawn lifetime; decay clock
 *   radius            | world    | hit radius; visual thickness = 2×radius
 *   aoeRadius         | world    | 0 for laser; Plasma sets >0 (D04)
 *   range             | world    | speed × lifetime (catalog)
 *   decayPerUnit      | 1/unit   | fallback when totalLifetime==0
 *   spawnX/Z          | world    | activate copies x/z
 *
 * Non-obvious:
 *   activate copies spawn, sets visible, opacity 1, active true. y = 0.
 *   Colour is constructor material; activate may setHex if spawn carries a
 *   visual colour via a side channel on the mesh material (catalog colour).
 *   update never sets this.position — syncRender does.
 *   deactivate: active=false, visible=false. Does not dispose GPU.
 *   Pool release = deactivate. dispose() only when the pool itself dies.
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. WeaponShot extends THREE.Mesh. Geometry/material created once in the
 *       constructor (pool fill), never per activate.
 *   R2. Pooled: activate/deactivate only. Exhaustion is A05 returning null;
 *       D01 never `new`s in update.
 *   R3. effectiveDamage() === damage * decayFactor(this).
 *   R4. Decay over totalLifetime elapsed = 1 - lifetime/totalLifetime:
 *         elapsed ≤ 0.25 → 1.00
 *         elapsed ≤ 0.50 → 0.75
 *         elapsed ≤ 0.75 → 0.50
 *         else           → 0.25
 *       Opacity in syncRender equals the same factor. Damage and fade share it.
 *   R5. Laser shots spawn with aoeRadius 0.
 *   R6. Visual thickness (scale.x and scale.y) = 2 * radius so bolt width
 *       equals hit diameter. scale.z stays 1 (length is geometry).
 *   R7. syncRender writes position (x, 0, z), material.opacity, scale only.
 *   R8. update writes x,z,lifetime only. Off-field despawn is E04/F01 (RUL-02),
 *       not a self-kill besides lifetime ≤ 0.
 *   R9. Memory: dispose() frees geometry + material. Per-frame allocation: none.
 *   R10. Constructor does not scene.add(this) — pool/ShotManager/RunScene owns add.
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      THREE.Mesh · BoxGeometry · MeshBasicMaterial
 *              transparent, AdditiveBlending, depthWrite false
 *              colour from catalog (laser 0x22d3ee)
 * Inheritance: extends THREE.Mesh
 * syncRender writes: this.position, material.opacity, this.scale
 * Never writes: damage, lifetime, active, aoeRadius
 * Scene ownership: added/removed by ObjectPool / ShotManager (A05 / E04)
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 * Laser projectile (D02 catalog; D01 consumes, does not declare a second copy):
 *   BALANCE.weapons.catalog.laser.projectile.speed    = 30
 *   BALANCE.weapons.catalog.laser.projectile.lifetime = 1     // range 30
 *   BALANCE.weapons.catalog.laser.projectile.radius   = 0.12  // L1; levels raise it
 *   BALANCE.weapons.catalog.laser.color               = 0x22d3ee
 *   aoeRadius                                         = 0     // laser never splash
 *
 * Decay (feel): 100% → 75% → 50% → 25% in lifetime quarters. A bolt at the
 * far end still hits, but it looks and hits as a quarter-power spark. Opacity
 * *is* the damage number (pillar 4).
 *
 * Feel:      POC-1 bolts — short, fast, additive cyan bricks. Thickness must
 *            match the hit so a graze the player sees is a graze the sim took.
 * Leveling:  radius / damage come from LASER_LEVELS (D02). Decay steps do not
 *            change with level.
 * Graphics:  additive brick, no trail. Fade is the only VFX this card owns.
 * Pillars:   4 legibility; WPN-01 pooled fire; RUL-02 nothing accumulates
 *            off-field (lifetime + E04 release).
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/gameobjects/shot/weapon-shot.test.ts
 * Runner: vitest
 * Mocks: THREE Mesh/BoxGeometry/MeshBasicMaterial stubs, A03 decayFactor
 *        (or the real math module), ObjectPool not required for unit tests
 *
 * describe('WeaponShot')
 *   it('extends THREE.Mesh and creates geometry/material once')                    // R1
 *   it('activate copies ShotSpawn and sets active/visible')                        // R2
 *   it('effectiveDamage equals damage × decayFactor')                              // R3
 *   it('decayFactor is 1.00 / 0.75 / 0.50 / 0.25 at lifetime quarters')            // R4
 *   it('syncRender opacity matches decayFactor')                                   // R4
 *   it('laser-style spawn with aoeRadius 0 keeps aoeRadius 0 after activate')      // R5
 *   it('visual scale.x/y equals 2 × radius (bolt width = hit diameter)')           // R6, Acceptance
 *   it('update integrates x += vx*dt, z += vz*dt and decrements lifetime')         // R8
 *   it('syncRender writes position.x/z and does not mutate damage')                // R7
 *   it('deactivate hides the mesh and clears active without disposing GPU')        // R2
 *   it('dispose frees geometry and material')                                      // R9
 *   it('update/syncRender allocate no objects')                                    // R9
 *   it('constructor does not scene.add')                                           // R10
 *   it('a speed-30 lifetime-1 shot travels 30 units in 1s')                        // port fidelity
 *
 * Manual:
 *   A-manual-1. [manual] bolt width reads as the hit cylinder
 *   A-manual-2. [manual] fade 100→25% over one second is obvious in flight
 *
 * Coverage: R1–R10 + card Acceptance (width = diameter; fade per quarter).
 */
