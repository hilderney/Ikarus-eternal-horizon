/**
 * #tag/arch #tag/ship #tag/memory
 *
 * Card:         SDD-C01 Ship
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: SHIP-01, SHIP-03, SHIP-06, RES-05
 * Change type:  class-ify
 * POC-1 origin: poc/src/gameobjects/ship.ts  — frozen reference
 * Test file:    poc2/src/gameobjects/ship/ship.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      The player craft as a modular THREE.Group — hull, accent, thruster,
 *            weapon tip, hardpoints, ordnance, equipment, inventory, and the
 *            **ship sheet** G08 reads: pose, byte stats (0–255), statuses,
 *            equipped item + owned lists (weapons, bombs, wings, shield fits,
 *            armor, energy collector, energy converter).
 * Does not own: motion/tilt (C02), applyDamage routing (C03 — writes integrity
 *            / shield once wired), firing (E07), energy spend/regen (D03 — writes
 *            energy once wired), camera (B01), drop magnet (F02).
 * Player-facing: the cyan/indigo silhouette and thruster flicker. The debugger
 *            Ship tab is the designer-facing sheet of the same object.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-A01 Balancer — BALANCE.ship.visual, BALANCE.thruster, inventory caps
 *   SDD-A03 Math     — DEG2RAD for applyTransform (degrees → radians)
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-C02 Controller     — applyTransform / pose write
 *   SDD-C03 ShipHealth     — composed on the ship; does not own the Group
 *   SDD-D02 Weapon         — muzzle / setEquippedWeapon tip colour+radius
 *   SDD-E07 FiringManager  — ship pose + hardpoints
 *   SDD-F02 DropManager    — inventory.tryAdd (RES-05 caps)
 *   SDD-G03 RunScene       — constructs, scene-adds, disposes the Group
 *   SDD-G07 HUD            — inventory counts + byte-pool bars (after wire)
 *   SDD-G08 Debugger      — Ship tab binds ShipDebugPort
 *   SDD-G09 Renderer       — imports Ship directly into the graph
 *   SDD-G11 PauseScene     — read-only inventory + equipped weapon / shield
 */

// ─── 9. Agent sign-off ───────────────────────────────────────────────────────
/**
 * Orchestrator : hub-v4.3 / 2026-08-18  ship sheet 0–255, loadout lists, G08 port
 * Programming  : hub-v4.3 / 2026-08-18  ShipDebugPort; combat still C03/D03 until wired
 * Game Design  : hub-v4.3 / 2026-08-18  byte pools start max 100, hard cap 255
 * TDD          : hub-v4.3 / 2026-08-18  debugSnapshot cases added
 *
 * DoD (§6.1): spec · tests red · shape · lifecycle · BALANCE · memory ·
 *             IDs · verify green · port fidelity
 * Status: done (Ship tab) · later tabs pending
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Programming / Three.js
// ═════════════════════════════════════════════════════════════════════════════

// ─── 2. Contract ─────────────────────────────────────────────────────────────
/**
 * Public surface. Ports first, then the class. Constructor dependencies explicit.
 * No service locators. No globals besides BALANCE.
 * `extends THREE.Group` — the domain object *is* its visual (hub §4).
 */

export type ResourceId = 'metalScrap' | 'prismaticCrystal' | 'denseCore' | 'darkMatter'

export type WeaponId = 'laser' | 'plasma' | 'beam' | 'mjolnir'

export type BombId = 'pulseNova' | 'swarmTorpedo' | 'starKiller'

export interface ShipVisual {
  readonly size: { readonly w: number; readonly h: number; readonly d: number }
  readonly wireframeColor: number
  readonly accentColor: number
  readonly thrusterColor: number
}

export interface ThrusterVisual {
  readonly position: { readonly y: number }
  readonly length: number
  readonly width: number
}

export interface ShipTransform {
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  scale: number
}

export interface WeaponSlot {
  readonly index: number
  readonly equipped: WeaponId | null
}

export interface BombSlot {
  readonly index: number
  readonly equipped: BombId | null
  readonly charges: number
}

export interface Equipment {
  readonly id: string
}

/** Integer 0..BALANCE.ship.stats.byteCap (255). */
export interface BytePool {
  current: number
  max: number
}

export interface ShipStats {
  agility: BytePool
  deflection: BytePool
  integrity: BytePool
  shield: BytePool
  precision: BytePool
  energy: BytePool
}

export interface ShipStatus {
  flickering: boolean
  dashing: boolean
  recovering: boolean
}

export type WingId = 'standard' | 'agility' | 'armored'
export type ShieldFitId = 'light' | 'standard' | 'heavy'
export type ArmorId = 'light' | 'standard' | 'heavy'
export type EnergyCollectorId = 'passive' | 'wide'
export type EnergyConverterId = 'scrap' | 'crystal'

export interface ShipLoadout {
  equippedWeapon: WeaponId | null
  weapons: readonly WeaponId[]
  equippedBomb: BombId | null
  bombs: readonly BombId[]
  equippedWings: WingId | null
  wings: readonly WingId[]
  equippedShield: ShieldFitId | null
  shields: readonly ShieldFitId[]
  equippedArmor: ArmorId | null
  armors: readonly ArmorId[]
  equippedEnergyCollector: EnergyCollectorId | null
  energyCollectors: readonly EnergyCollectorId[]
  equippedEnergyConverter: EnergyConverterId | null
  energyConverters: readonly EnergyConverterId[]
}

/** G08 Ship tab binds this. Pose is live transform; stats are the byte sheet. */
export interface ShipDebugPort {
  readonly position: { x: number; y: number; z: number }
  readonly rotation: { x: number; y: number; z: number }
  readonly stats: ShipStats
  readonly status: ShipStatus
  readonly loadout: ShipLoadout
}

export interface Inventory {
  count(id: ResourceId): number
  cap(id: ResourceId): number
  /** Returns the amount actually stored. Surplus above cap is rejected (RES-05). */
  tryAdd(id: ResourceId, amount: number): number
}

export interface ShipOptions {
  readonly visual: ShipVisual
  readonly thruster: ThrusterVisual
  readonly inventoryCaps: Readonly<Record<ResourceId, number>>
}

export declare class Ship extends THREE.Group {
  constructor(options: ShipOptions)

  readonly hardpoints: readonly WeaponSlot[]
  readonly ordnance: readonly BombSlot[]
  readonly equipment: readonly Equipment[]
  readonly inventory: Inventory
  readonly weaponTip: THREE.Mesh
  readonly transform: ShipTransform
  readonly stats: ShipStats
  readonly status: ShipStatus
  readonly loadout: ShipLoadout

  /** Writes logical pose. Degrees in `rotation` (POC-1). Radians applied in syncRender. */
  applyTransform(transform: ShipTransform): void

  /** Recolours and rescales the muzzle tip. Does not swap the Weapon device (E07). */
  setEquippedWeapon(color: number, radius: number): void

  /** Slot mutation lives here. Callers never write `hardpoints[i].equipped`. */
  equipWeapon(slotIndex: number, id: WeaponId): void
  unequipWeapon(slotIndex: number): void
  equipBomb(slotIndex: number, id: BombId, charges: number): void
  unequipBomb(slotIndex: number): void
  attachEquipment(item: Equipment): void
  detachEquipment(id: string): void

  /** C02 writes dash; E07 writes shooting so recovering can be derived. */
  setDashing(value: boolean): void
  setShooting(value: boolean): void
  setFlickering(value: boolean): void

  /** Snapshot for G08. Same object identity for stats/status across calls. */
  debugSnapshot(): ShipDebugPort

  /** Logic: accumulate flicker time. No GPU work. */
  update(dt: number): void

  /** Writes this.position / this.rotation / this.scale and thruster.scale. */
  syncRender(): void

  /** Disposes every child geometry and material this class created. */
  dispose(): void
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   field / method        | type            | meaning / unit / range
 *   ----------------------|-----------------|--------------------------------
 *   this (Group)          | THREE.Group     | scene node; hull/accent/thruster/tip children
 *   hardpoints            | WeaponSlot[]    | primary-weapon mounts; mutated only via equip*
 *   ordnance              | BombSlot[]      | special-charge mounts; §7 fills types
 *   equipment             | Equipment[]     | declared empty; §7 EQP- populates
 *   inventory             | Inventory       | four resources + caps (RES-05)
 *   weaponTip             | THREE.Mesh      | sphere at the bow; colour/radius from setEquippedWeapon
 *   transform             | ShipTransform   | logical pose; rotation in degrees
 *   stats                 | ShipStats       | byte pools 0–255; start current=max=100
 *   status                | ShipStatus      | flickering, dashing, recovering
 *   loadout               | ShipLoadout     | equipped + owned lists (G08)
 *   debugSnapshot         | () => port      | pose + stats + status + loadout
 *   applyTransform        | (t) => void     | copies pose; does not scene.add
 *   setEquippedWeapon     | (hex, r) => void| tipMat.color + tip.scale = max(0.03, r)
 *   update(dt)            | logic           | time += dt for flicker
 *   syncRender            | view            | Group pose + thruster.scale.y flicker
 *   dispose               | memory          | hull, accent, thruster, tip geo+mat
 *
 * Non-obvious:
 *   Pre:  constructor does not scene.add(this) — RunScene (G03) owns add/remove (D14).
 *   Post: dispose leaves the Group empty of GPU resources; safe to scene.remove.
 *   Inv:  hardpoints/ordnance/equipment arrays are not replaced; entries change via methods.
 *   Inv:  every stats.*.current and stats.*.max is an integer in [0, byteCap].
 *   Inv:  status.recovering === !shooting && !status.flickering (derived, not stored).
 *   Inv:  loadout.equippedWeapon is hardpoints[0].equipped; weapons list is owned ids.
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. Ship extends THREE.Group. Hull, accent, thruster cone, weapon-tip sphere
 *       are children created in the constructor.
 *   R2. Nothing outside Ship mutates hardpoints, ordnance, equipment, or inventory
 *       storage — only Ship methods (equip*/tryAdd) write those.
 *   R3. applyTransform copies position/rotation(degrees)/scale onto the logical
 *       transform; syncRender writes this.position, this.rotation (radians via
 *       A03 DEG2RAD), this.scale.
 *   R4. setEquippedWeapon(color, radius) sets tip material colour and
 *       scale = max(0.03, radius). It does not construct a Weapon.
 *   R5. update(dt) accumulates thruster flicker time and counts down status
 *       flickering (BALANCE.ship.stats.flickerMs). Thruster scale is applied in
 *       syncRender: scale.y = 0.72 + 0.28 * sin(t*42) * sin(t*13 + 1.3)
 *       (POC-1 port). X/Z scale stay 1.
 *   R6. Memory: geometries and materials created once. dispose() must reach
 *       hull geo/mat, accent geo/mat, thruster geo/mat, tip geo/mat.
 *   R7. Per-frame allocation: none.
 *   R8. inventory.tryAdd never stores above cap; surplus is not converted here
 *       (RES-05: reject). Metal Scrap is the SHIP-06 minimum resource.
 *   R9. Destruction of the Group without dispose() is a bug.
 *   R10. Byte pools: BALANCE.ship.stats.byteCap = 255. At spawn every pool has
 *        current = max = 100 (agility, deflection, integrity, shield, precision,
 *        energy). current and max never exceed byteCap. Integrity 0 is still
 *        death — C03 reports it once wired to this sheet.
 *   R11. status.flickering is true after spawn for flickerMs and after a hit
 *        (F04/C03 will call setFlickering). status.dashing is C02 via setDashing.
 *        status.recovering is true only when not shooting and not flickering —
 *        that is the gate for energy gain (D03).
 *   R12. Loadout lists are owned gear. Equipped* is the active slot. Starting
 *        weapons list = BALANCE.weapons.loadout; bombs/wings/shields/armors/
 *        collectors/converters start empty until §7. Shield *fit* (ShieldFitId)
 *        is equipment; stats.shield is the Force Field pool (not the same thing).
 *   R13. debugSnapshot() does not allocate: it returns a stable view object.
 *        G08 must not invent a second table of ship numbers.
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      THREE.Group
 *              · hull  BoxGeometry(w,h,d) MeshBasicMaterial wireframe 0x22d3ee opacity 0.9
 *              · accent BoxGeometry(w*0.82,h*0.82,d*0.82) MeshBasicMaterial 0x6d28d9 opacity 0.45
 *              · thruster ConeGeometry(width, length) MeshBasicMaterial 0x60c5ff additive
 *                depthWrite false, transparent; local position.y = BALANCE.thruster.position.y
 *              · tip SphereGeometry MeshBasicMaterial, default colour laser cyan
 * Inheritance: extends THREE.Group
 * syncRender writes: this.position, this.rotation, this.scale, thruster.scale
 * Never writes: slot contents, inventory, health
 * Scene ownership: added/removed by RunScene (G03). Ship never scene.add(this).
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 *   BALANCE.ship.visual.size            = { w: 1.5, h: 1, d: 2 }   // readable shmup brick
 *   BALANCE.ship.visual.wireframeColor  = 0x22d3ee                 // hull wire; <0.3s read
 *   BALANCE.ship.visual.accentColor     = 0x6d28d9                 // indigo fill
 *   BALANCE.ship.visual.thrusterColor   = 0x60c5ff                 // additive jet
 *   BALANCE.thruster.position.y         = -0.55                    // jet sits under the hull
 *   BALANCE.thruster.length             = 0.5
 *   BALANCE.thruster.width              = 0.3
 *   BALANCE.ship.transform              = { position {0,0,0}, rotation {0,0,0}, scale: 1 }
 *
 * Inventory caps — new A01 section (RES-05). Placeholders until F02 playtest:
 *   BALANCE.ship.inventory.caps.metalScrap         = 999
 *   BALANCE.ship.inventory.caps.prismaticCrystal   = 99
 *   BALANCE.ship.inventory.caps.denseCore          = 49
 *   BALANCE.ship.inventory.caps.darkMatter         = 9
 *
 * Byte sheet (G08 Ship tab — A01 BALANCE.ship.stats):
 *   byteCap     = 255
 *   flickerMs   = 400   // spawn i-frames / hit flicker
 *   agility, deflection, integrity, shield, precision, energy
 *               = { current: 100, max: 100 } at spawn
 *
 *   agility     — acceleration to move (C02 later)
 *   deflection  — chance to take less damage (F04 later)
 *   integrity   — HP; 0 is death (C03)
 *   shield      — Force Field; absorbs before integrity (C03)
 *   precision   — + chance to hit (E07/F01 later)
 *   energy      — weapon pool (D03; regen only while recovering)
 *
 * Until C03/D03 consume this sheet, combat still uses BALANCE.ship.health
 * (integrityMax 100, shieldMax 50) and BALANCE.gameplay.energy. G08 shows
 * the sheet — not a third table.
 *
 * Feel:      POC-1 silhouette is the law — same brick, same cyan/indigo, same
 *            flickering additive jet. Weapon switch must recolour the bow tip
 *            in one frame so the loadout is readable without a HUD glance.
 * Leveling:  N/A for the mesh. Hull degradation is C03; weapon levels are D02.
 *            Inventory counts grow via F02; caps are the only leveling here.
 * Graphics:  wireframe hull + darker accent + additive thruster. Palette is
 *            the player-identity colour (cyan) against indigo. Tip sphere is
 *            the weapon colour (laser 0x22d3ee at spawn).
 * Pillars:   4 legibility at high speed; 1 visible risk (the craft is the HUD
 *            anchor); SHIP-06 inventory is the collect pillar fragment.
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * Protocol: write ship.test.ts FIRST. `npm run test` must FAIL for the named
 * cases (red). Programming then implements until green.
 *
 * File: poc2/src/gameobjects/ship/ship.test.ts
 * Runner: vitest (`npm run test` in poc2/)
 * Mocks: THREE stubs (Group/Mesh/BoxGeometry/ConeGeometry/SphereGeometry/
 *        MeshBasicMaterial), BALANCE.ship.visual + BALANCE.thruster slice
 *
 * describe('Ship')
 *   it('extends THREE.Group and constructs hull, accent, thruster, weaponTip as children') // R1
 *   it('does not expose writable hardpoints/ordnance/equipment arrays')                    // R2
 *   it('equipWeapon writes the slot; a direct array mutation API does not exist')          // R2, SHIP-03
 *   it('applyTransform stores degrees and syncRender writes radians onto this.rotation')   // R3
 *   it('setEquippedWeapon recolours the tip and scales it to max(0.03, radius)')           // R4, SHIP-03
 *   it('update(dt) does not assign thruster.scale; syncRender applies the flicker formula') // R5
 *   it('thruster flicker uses 0.72 + 0.28 * sin(t*42) * sin(t*13 + 1.3) on scale.y')        // R5, port
 *   it('dispose() disposes hull, accent, thruster and tip geometry and material')          // R6
 *   it('update/syncRender allocate no objects')                                            // R7
 *   it('inventory.tryAdd stores Metal Scrap and rejects surplus above cap')                // R8, SHIP-06, RES-05
 *   it('inventory.tryAdd on a full stack returns 0 and leaves the count unchanged')        // R8, RES-05
 *   it('constructor does not call scene.add')                                              // D14
 *   it('visual size is 1.5 × 1 × 2 and hull material colour is 0x22d3ee wireframe')        // port fidelity
 *   it('thruster sits at y=-0.55 with length 0.5 and width 0.3, additive 0x60c5ff')         // BALANCE.thruster
 *   it('byte pools start at current=max=100 with byteCap 255')                             // R10
 *   it('debugSnapshot exposes position, rotation, stats, status, loadout')                 // R13, G08
 *   it('debugSnapshot returns the same stats/status object identity across calls')         // R13
 *   it('recovering is true when not shooting and not flickering')                          // R11
 *   it('setDashing / setShooting / setFlickering update status for the debugger')          // R11
 *   it('loadout.weapons starts as BALANCE.weapons.loadout; equippedWeapon tracks slot 0')  // R12
 *   it('wings/shields/armors/collectors/converters start empty')                           // R12, §7
 *
 * Manual:
 *   A-manual-1. [manual] ship is readable as the player craft in the default camera
 *   A-manual-2. [manual] switching weapon recolours the bow tip in one frame
 *
 * Coverage: R1–R13 + card Acceptance (moves within bounds is C02; weapon change
 * updates the tip; no GPU leaks on dispose; G08 can bind the sheet).
 */
