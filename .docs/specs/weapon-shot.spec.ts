/**
 * #tag/arch #tag/weapons #tag/memory
 *
 * Card:         SDD-D01 WeaponShot
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: WPN-01, SHIP-03, RUL-02, D13
 * Change type:  class-ify
 * POC-1 origin: poc/src/gameobjects/shot.ts  — frozen reference (shot half; pool is A05)
 * Test file:    poc2/src/gameobjects/shot/weapon-shot.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      The pooled player-projectile mesh. `activate(spawn)` copies the
 *            ballistic payload; `update(dt)` integrates XZ + lifetime;
 *            `effectiveDamage()` is damage × A03 `decayFactor`; `syncRender`
 *            writes position / opacity / scale; `deactivate` / `dispose`.
 * Does not own: ObjectPool (A05), ShotManager release on expiry/hit (E04),
 *            collision (F01), damage apply (F04), cadence / volley / energy
 *            (D02, D03, E07). EnemyShot / BombShot clone this contract later
 *            (E03 / §7) with a different `layer`.
 * Player-facing: bolt thickness equals the hit diameter; fade 100→25% over
 *            the lifetime so remaining punch is readable as brightness.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-A01 Balancer — catalog colour / poolSize (kinematics arrive on ShotSpawn)
 *   SDD-A03 Math     — decayFactor(elapsed in [0,1]); distXZ for range fallback
 *   SDD-A05 ObjectPool — acquire/release; WeaponShot is the pooled T
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-D02 Weapon / Laser — fills ShotSpawn (speed 30, lifetime 1, radius, color)
 *   SDD-D04 Plasma         — same class, aoeRadius > 0
 *   SDD-E04 ShotManager    — owns the pool; release on lifetime≤0 or hit
 *   SDD-E07 FiringManager  — does not touch this class (goes through D02)
 *   SDD-F01 CollisionManager — reads WeaponShotPort (x, z, radius, aoeRadius,
 *            effectiveDamage, layer PlayerShot)
 *   SDD-F04 DamageResolver — effectiveDamage() at the hit
 *   SDD-E03 EnemyShot      — pattern clone, layer EnemyShot
 *
 * Not a requires-blocker: G03 / RunScene adds pooled meshes (D14).
 */

// ─── 9. Agent sign-off ───────────────────────────────────────────────────────
/**
 * Orchestrator : hub-v4.3 / 2026-08-18  scope, requires, D13 layer, D14 add
 * Programming  : hub-v4.3 / 2026-08-18  A03 elapsed decay, unit XY geometry,
 *                                       update/syncRender split vs POC-1
 * Game Design  : hub-v4.3 / 2026-08-18  ShotSpawn is the number pipe; L1 laser
 *                                       table; no second catalog on this card
 * TDD          : hub-v4.3 / 2026-08-18  cases named; test file not yet written (red next)
 *
 * DoD (§6.1): spec · tests red · shape · lifecycle · BALANCE · memory ·
 *             IDs · verify green · port fidelity
 * Status: implemented
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Programming / Three.js
// ═════════════════════════════════════════════════════════════════════════════

// ─── 2. Contract ─────────────────────────────────────────────────────────────
/**
 * Public surface. Ports first, then the class. Constructor dependencies explicit.
 * No service locators. No BALANCE reads on the hot path — kinematics live on
 * ShotSpawn (D02 writes them). `extends THREE.Mesh` — the bolt *is* its visual.
 * D14: constructor never scene.add(this).
 */

/** Frozen layer set (F01 / D13). Copied so this spec is self-contained. */
export type Layer = 'Player' | 'PlayerShot' | 'Enemy' | 'EnemyShot' | 'Meteor' | 'Drop'

/** F01 / F04 read this. The Mesh is the visual, not the collision API. */
export interface WeaponShotPort {
  readonly active: boolean
  readonly layer: Layer
  readonly x: number
  readonly z: number
  readonly radius: number
  readonly aoeRadius: number
  effectiveDamage(): number
}

/**
 * Payload copied on activate. D02 (Laser / Plasma) is the only writer.
 * POC-1 also had `y` and wrote the mesh inside `update` — both drop here:
 * visual Y is always 0; GPU writes wait for syncRender.
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
  /** Catalog colour. Optional: constructor colour stays if omitted. */
  readonly color?: number
}

export interface WeaponShotOptions {
  /** Presentation default (laser 0x22d3ee). Activate may override via spawn.color. */
  readonly color: number
}

export declare class WeaponShot extends THREE.Mesh implements WeaponShotPort {
  constructor(options: WeaponShotOptions)

  readonly layer: 'PlayerShot'
  readonly active: boolean
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

  /** Logic: x += vx*dt, z += vz*dt, lifetime -= dt. No GPU. */
  update(dt: number): void

  /** Writes this.position, material.opacity, this.scale. */
  syncRender(): void

  deactivate(): void

  /** damage × shotDecay(this). shotDecay uses A03 decayFactor(elapsed). */
  effectiveDamage(): number

  dispose(): void
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   field             | type     | meaning / unit / range
 *   ------------------|----------|--------------------------------
 *   layer             | PlayerShot | D13; never EnemyShot on this class
 *   active            | boolean  | pooled occupancy (getter; activate/deactivate)
 *   x, z              | world    | gameplay plane (visual y = 0)
 *   vx, vz            | m/s      | ballistic, no accel
 *   damage            | number   | spawn damage (pre-decay)
 *   lifetime          | s        | remaining; ≤0 ⇒ E04 release
 *   totalLifetime     | s        | spawn lifetime; decay clock
 *   radius            | world    | hit radius; visual width = 2×radius
 *   aoeRadius         | world    | 0 laser; Plasma >0 (D04)
 *   range             | world    | speed × lifetime (D02)
 *   decayPerUnit      | 1/unit   | last-resort fade when no lifetime/range
 *   spawnX/Z          | world    | activate copies x/z
 *
 * Non-obvious:
 *   activate copies spawn, sets visible, opacity 1, active true, y = 0.
 *   If spawn.color is set, material.color.setHex(spawn.color).
 *   update never writes this.position / opacity / scale — syncRender does
 *   (POC-1 wrote the mesh inside update; that split is the class-ify).
 *   deactivate: active=false, visible=false. Does not dispose GPU.
 *   Pool release = deactivate. dispose() only when the pool itself dies.
 *
 * shotDecay (file-private helper, not a second public export — A03 already
 * owns decayFactor(elapsed)):
 *   if totalLifetime > 0: elapsed = clamp(1 - lifetime/totalLifetime, 0, 1)
 *                         return decayFactor(elapsed)
 *   else dist = distXZ(x,z, spawnX,spawnZ)
 *     if range > 0: return decayFactor(dist/range)
 *     else return max(0, 1 - decayPerUnit * dist)
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. WeaponShot extends THREE.Mesh. Geometry/material created once in the
 *       constructor (pool fill), never per activate.
 *   R2. Pooled: activate/deactivate only. Exhaustion is A05 returning null;
 *       D01 never `new`s in update.
 *   R3. effectiveDamage() === damage * shotDecay(this).
 *   R4. Time decay uses A03 decayFactor(elapsed) with
 *       elapsed = 1 - lifetime/totalLifetime, clamped to [0, 1]:
 *         elapsed ≤ 0.25 → 1.00
 *         elapsed ≤ 0.50 → 0.75
 *         elapsed ≤ 0.75 → 0.50
 *         else           → 0.25
 *       Opacity in syncRender equals the same factor. Damage and fade share it.
 *   R5. Laser shots spawn with aoeRadius 0. This class does not force that —
 *       D02 writes 0; D04 writes >0. activate copies the field verbatim.
 *   R6. Visual width (scale.x and scale.y) = 2 * radius so bolt width equals
 *       hit diameter. scale.z stays 1. Geometry XY is 1×1 so there is no
 *       hidden SHOT_BASE_WIDTH (POC-1 used 0.09 and divided; do not port it).
 *   R7. syncRender writes position (x, 0, z), material.opacity, scale only.
 *   R8. update writes x, z, lifetime only. Off-field despawn is E04/F01
 *       (RUL-02). lifetime ≤ 0 does not self-deactivate — E04 releases.
 *   R9. Memory: dispose() frees geometry + material. Per-frame allocation: none.
 *   R10. Constructor does not scene.add(this). ObjectPool factory / E04 / G03
 *        own add/remove (D14).
 *   R11. layer is the literal 'PlayerShot'. It does not change per activate.
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      THREE.Mesh · BoxGeometry(1, 1, 0.7) · MeshBasicMaterial
 *              transparent, AdditiveBlending, depthWrite false
 *              colour from constructor / spawn.color (laser 0x22d3ee)
 *              brick length 0.7 is the POC-1 silhouette (presentation, not BALANCE)
 * Inheritance: extends THREE.Mesh
 * syncRender writes: this.position, material.opacity, this.scale
 * Never writes: damage, lifetime, active, aoeRadius, layer
 * Scene ownership: added/removed by ObjectPool holder ShotManager (A05 / E04)
 *                  or G03 until E04 exists. This class never scene.add.
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 * D01 does not invent a second table and does not read kinematics from
 * BALANCE on the hot path. D02 writes ShotSpawn from WeaponConfig.projectile
 * + LASER_LEVELS. Until D02 lands, tests build ShotSpawn from this L1 row.
 *
 * Already in A01 (consumed as constructor colour / future pool capacity):
 *   BALANCE.weapons.catalog.laser.color     = 0x22d3ee
 *   BALANCE.weapons.catalog.laser.damage    = 1
 *   BALANCE.weapons.catalog.laser.poolSize  = 128
 *   BALANCE.weapons.catalog.laser.profile   = 'projectile'
 *
 * Filled on ShotSpawn by D02 (L1 laser — POC-1 / hub D02 R8):
 *   speed         = 30     // world units / s
 *   lifetime      = 1      // s  → range = 30
 *   radius        = 0.12   // hit + visual half-width; levels raise it
 *   aoeRadius     = 0      // laser never splash
 *   vx, vz        = from volley (forward vz = −speed)
 *   decayPerUnit  = 0      // unused while totalLifetime > 0
 *
 * Decay (feel): 100% → 75% → 50% → 25% in lifetime quarters via A03.
 * A bolt at the far end still hits, as a quarter-power spark. Opacity *is*
 * the damage number (pillar 4). Decay steps do not change with laser level.
 *
 * Feel:      POC-1 bolts — short, fast, additive cyan bricks. Thickness must
 *            match the hit so a graze the player sees is a graze the sim took.
 * Leveling:  radius / damage / volley come from LASER_LEVELS (D02). This card
 *            only presents whatever ShotSpawn it was given.
 * Graphics:  additive brick, no trail. Fade is the only VFX this card owns.
 *            Geometry length 0.7 keeps the POC-1 brick; XY is unit so scale
 *            2×radius is the whole width story.
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
 * Mocks: real THREE Mesh/BoxGeometry/MeshBasicMaterial (Stage A dep).
 *        Real A03 decayFactor / distXZ. ObjectPool not required for unit tests.
 *
 * describe('WeaponShot')
 *   it('extends THREE.Mesh and creates geometry/material once')                 // R1
 *   it('activate copies ShotSpawn and sets active/visible')                     // R2
 *   it('effectiveDamage equals damage × A03 decayFactor(elapsed)')              // R3, R4
 *   it('decay rungs are 1.00 / 0.75 / 0.50 / 0.25 at lifetime quarters')        // R4
 *   it('syncRender opacity matches decayFactor')                                // R4
 *   it('laser-style spawn with aoeRadius 0 keeps aoeRadius 0 after activate')   // R5
 *   it('visual scale.x/y equals 2 × radius (bolt width = hit diameter)')        // R6, Acceptance
 *   it('update integrates x += vx*dt, z += vz*dt and decrements lifetime')      // R8
 *   it('update does not write position, opacity or scale')                      // R7, class-ify
 *   it('syncRender writes position.x/z at y=0 and does not mutate damage')      // R7
 *   it('deactivate hides the mesh and clears active without disposing GPU')     // R2
 *   it('dispose frees geometry and material')                                   // R9
 *   it('update/syncRender allocate no objects')                                 // R9
 *   it('constructor does not scene.add')                                        // R10, D14
 *   it('layer is PlayerShot')                                                   // R11, D13
 *   it('a speed-30 lifetime-1 shot travels 30 units in 1s')                     // port fidelity
 *
 * Manual:
 *   A-manual-1. [manual] bolt width reads as the hit cylinder
 *   A-manual-2. [manual] fade 100→25% over one second is obvious in flight
 *
 * Coverage: R1–R11 + card Acceptance (width = diameter; fade per quarter)
 * + port fidelity (30 u/s).
 */
