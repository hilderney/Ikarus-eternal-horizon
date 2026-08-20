/**
 * #tag/arch #tag/memory
 *
 * Card:         SDD-G08 Debugger panel
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: dev tool (Q09) — no locked player requirement
 * Change type:  split
 * POC-1 origin: poc/src/systems/debugControls.ts (501 lines, five tabs)
 *               — frozen reference
 * Test file:    poc2/src/ui/debugger/debugger.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      The debugger-area tuning surface. **One tab per subject.** This
 *            pass implements **Ship** (pose / pools / statuses) and **Equips**
 *            (loadout + equipped weapon level + dash level). Later tabs: Cam, LimitBox,
 *            Parallax, Weapons catalog, Energy, Shots, Collision — each a
 *            module, composed only in debugger.ts. Two-way sync ~15 Hz, skip
 *            focused control, Reset. Q09: `import.meta.env.DEV`.
 * Does not own: the values' meaning (A01 / C01 / C02 / C03 / D02 / D03),
 *            gizmos (B04), the area shell (G06), the 15 Hz sidecar (A04).
 * Player-facing: N/A in production. In DEV, Ship + Equips must show the same
 *            sheet and weapon the sim uses — a second invented table is a bug.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-A01 Balancer — typed slices the tabs bind to
 *   SDD-C01 Ship     — ShipDebugPort (this pass: Ship tab)
 *   SDD-G06 UI areas — `#debugger-area` host
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-G03 RunScene — constructs only when DEV / factory non-null (Q09)
 *   SDD-A04 GameLoop — ~15 Hz sync sidecar calls `debugger.sync()`
 *
 * Later tabs (not this pass): Cam, LimitBox, Parallax, Weapons, Energy, Shots, Collision.
 */

// ─── 9. Agent sign-off ───────────────────────────────────────────────────────
/**
 * Orchestrator : hub-v4.3 / 2026-08-18  one tab per subject; Ship first
 * Programming  : hub-v4.3 / 2026-08-19  ShipTab + EquipsTab; weapon + dash level
 * Game Design  : hub-v4.3 / 2026-08-19  loadout lives on Equips; laser/dash L1–L12
 * TDD          : hub-v4.3 / 2026-08-19  debugger.test.ts (Ship + Equips)
 *
 * DoD (§6.1): spec · tests red · shape · lifecycle · BALANCE · memory ·
 *             IDs · verify green · port fidelity
 * Status: done (Ship + Equips) · later tabs pending
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Programming / Three.js
// ═════════════════════════════════════════════════════════════════════════════

// ─── 2. Contract ─────────────────────────────────────────────────────────────

export type DebuggerTabId =
  | 'ship'
  | 'equips'
  | 'cam'
  | 'limit-box'
  | 'parallax'
  | 'weapons'
  | 'energy'
  | 'shots'
  | 'collision'

export interface DebuggerTab {
  readonly id: DebuggerTabId
  mount(panel: HTMLElement): void
  /** Push model → controls unless the control is focused. */
  sync(): void
  /** Restore this tab's captured defaults. */
  reset(): void
  dispose(): void
}

/** Shared objects the tabs write through. Production passes live BALANCE slices. */
/** Live C01 sheet plus the setters the form needs. Later tabs add optional binds. */
export interface DebuggerShipBind {
  snapshot(): {
    readonly position: { x: number; y: number; z: number }
    readonly rotation: { x: number; y: number; z: number }
    readonly stats: {
      agility: { current: number; max: number }
      deflection: { current: number; max: number }
      integrity: { current: number; max: number }
      shield: { current: number; max: number }
      precision: { current: number; max: number }
      energy: { current: number; max: number }
    }
    readonly status: {
      flickering: boolean
      dashing: boolean
      shooting: boolean
      recovering: boolean
    }
    readonly loadout: {
      equippedWeapon: string | null
      weapons: readonly string[]
      equippedBomb: string | null
      bombs: readonly string[]
      equippedWings: string | null
      wings: readonly string[]
      equippedShield: string | null
      shields: readonly string[]
      equippedArmor: string | null
      armors: readonly string[]
      equippedEnergyCollector: string | null
      energyCollectors: readonly string[]
      equippedEnergyConverter: string | null
      energyConverters: readonly string[]
    }
  }
  applyTransform(): void
  setFlickering(value: boolean): void
  setDashing(value: boolean): void
  setShooting(value: boolean): void
  equipWeapon(id: string | null): void
  equipBomb(id: string | null): void
  equipWings(id: string | null): void
  equipShield(id: string | null): void
  equipArmor(id: string | null): void
  equipEnergyCollector(id: string | null): void
  equipEnergyConverter(id: string | null): void
}

export interface DebuggerWeaponsBind {
  level(): number
  setLevel(level: number): void
}

export interface DebuggerBinds {
  readonly ship: DebuggerShipBind
  readonly weapons: DebuggerWeaponsBind
  readonly dash: DebuggerWeaponsBind
  readonly camera?: object
  readonly cameraApply?: () => void
  readonly parallax?: object
  readonly parallaxApply?: () => void
  readonly limitBox?: object
  readonly follow?: object
  readonly recenterPoint?: object
  readonly controls?: object
}

export interface DebuggerOptions {
  readonly host: HTMLElement
  readonly binds: DebuggerBinds
  readonly tabs: readonly DebuggerTab[]
  /** When false (production / Q09), mount is a no-op. Default: import.meta.env.DEV */
  readonly enabled?: boolean
}

export interface DebuggerPort {
  updateReadout(ship: { x: number; y: number; z: number }, camera: { x: number; y: number; z: number }): void
  sync(): void
  reset(): void
  dispose(): void
}

export declare class Debugger implements DebuggerPort {
  constructor(options: DebuggerOptions)
  updateReadout(ship: { x: number; y: number; z: number }, camera: { x: number; y: number; z: number }): void
  sync(): void
  reset(): void
  dispose(): void
}

export declare class EquipsTab implements DebuggerTab {
  constructor(binds: DebuggerBinds)
  readonly id: DebuggerTabId
  mount(panel: HTMLElement): void
  sync(): void
  reset(): void
  dispose(): void
}

export declare class CamTab implements DebuggerTab {
  constructor(binds: DebuggerBinds)
  readonly id: DebuggerTabId
  mount(panel: HTMLElement): void
  sync(): void
  reset(): void
  dispose(): void
}

export declare class ShipTab implements DebuggerTab {
  constructor(binds: DebuggerBinds)
  readonly id: DebuggerTabId
  mount(panel: HTMLElement): void
  sync(): void
  reset(): void
  dispose(): void
}

export declare class LimitBoxTab implements DebuggerTab {
  constructor(binds: DebuggerBinds)
  readonly id: DebuggerTabId
  mount(panel: HTMLElement): void
  sync(): void
  reset(): void
  dispose(): void
}

export declare class ParallaxTab implements DebuggerTab {
  constructor(binds: DebuggerBinds)
  readonly id: DebuggerTabId
  mount(panel: HTMLElement): void
  sync(): void
  reset(): void
  dispose(): void
}

export declare class WeaponsTab implements DebuggerTab {
  constructor(binds: DebuggerBinds)
  readonly id: DebuggerTabId
  mount(panel: HTMLElement): void
  sync(): void
  reset(): void
  dispose(): void
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 * Files (one public class per file). This pass: debugger.ts + ship-tab.ts
 * + equips-tab.ts.
 * Later: cam-tab, limit-box-tab, parallax-tab, weapons-tab, energy/shots/collision.
 *
 *   defaults    | structuredClone of ship/equips snapshot at mount | Reset source
 *   focused     | document.activeElement skip                 | two-way sync
 *
 *   sync        — for each control, skip if it is document.activeElement,
 *                 else refresh from binds
 *   reset       — restore mount-time snapshot, then apply hooks
 *   ShipTab     — pose, six byte pools, three statuses; id is 'ship'
 *   EquipsTab   — loadout lists + equipped weapon level 1–12 + dash level 1–12; id is 'equips'
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. One module per tab. Adding a tab does not edit an existing tab file
 *       (only debugger.ts composition), except when a subject moves (loadout
 *       left Ship for Equips). This pass mounts **Ship** then **Equips**.
 *   R2. Two-way: editing a slider/spin writes the bound object immediately
 *       and calls the matching apply hook. Sync pulls model → view at
 *       BALANCE.debug.syncHz (~15 Hz, POC-1 SYNC_INTERVAL 0.066).
 *   R3. `sync()` skips any control that is `document.activeElement`.
 *   R4. Reset restores the snapshot taken at mount, then apply hooks run.
 *   R5. ShipTab shows pose, six byte pools, three statuses. EquipsTab shows
 *       every loadout field plus equipped weapon level (LASER_LEVELS 1–12)
 *       via FiringManager.setWeaponLevel and dash level (DASH_LEVELS 1–12)
 *       via PlayerController.setDashLevel. Module selects call Ship.equip*
 *       so BALANCE.ship.modules mods apply. Neither invents a second table.
 *   R6. Q09: when `enabled === false`, mount writes nothing into the host
 *       and sync/reset are no-ops.
 *   R7. Memory: DOM created on mount, removed on dispose. Per-frame
 *       allocation: none on sync. No GPU.
 *   R8. Debugger never participates in collision or scoring.
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      HTML/CSS panel inside `#debugger-area`. No THREE meshes.
 * Inheritance: N/A
 * syncRender writes: N/A — `sync()` is a throttled DOM refresh, not a GPU bridge
 * Never writes: gameplay rules; it mutates BALANCE *tuning slices* and live
 *               object config which gameplay already reads
 * Scene ownership: host is G06 debugger-area; RunScene disposes Debugger
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 * New section (add to SDD-A01):
 *   BALANCE.debug.syncHz  = 15  // POC-1 0.066 s ≈ 15.15 Hz; name the intent
 *
 * Tab contents:
 *   Ship — from C01 ShipDebugPort:
 *     position xyz, rotation xyz (degrees)
 *     agility / deflection / integrity / shield / precision / energy
 *       each current + max, slider 0–255, spawn 100/100
 *     status_flickering, status_dashing, status_shooting, status_recovering
 *   Equips — same loadout objects the sim reads, plus live weapon and dash level:
 *     equippedWeapon + weapons[]  (equipWeapon / FiringManager.setActive)
 *     weapon level 1–12           (FiringManager.setWeaponLevel → applyWeaponLevel)
 *     weapon stats (editable)       (EquipsTab reads stats()/patchStat per profile)
 *     dash level 1–12             (PlayerController.setDashLevel → DASH_LEVELS)
 *     equippedBomb + bombs[]
 *     equippedWings + wings[]
 *     equippedShield + shields[]   // fit module, not Force Field pool
 *     equippedArmor + armors[]
 *     equippedEnergyCollector + energyCollectors[]
 *     equippedEnergyConverter + energyConverters[]
 *   Later: Cam, LimitBox, Parallax, Weapons catalog, Energy, Shots, Collision.
 *
 * Feel:      A tuner, not a toy. Moving a Ship slider must move the sheet
 *            the sim reads. Reset is sacred.
 * Leveling:  byte max grows with equipment later; spawn max is 100 / 255.
 * Graphics:  Neon panel matching POC-1 `.debug-panel`:
 *              background rgba(8,8,24,0.85) · border #2af0ff · text #b7e6ff
 *              tabs hairline cyan, active fill rgba(34,211,238,0.25)
 *              sliders accent-color #22d3ee · spins #0a0a1e
 *            Hidden on ≤760px with the column (G06). Hidden entirely when
 *            Q09 production flag is off.
 * Pillars:   none locked — this is a development instrument for pillars 1–4
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/ui/debugger/debugger.test.ts
 * Runner: vitest
 * Mocks: host HTMLElement, DebuggerBinds with a live ShipDebugPort,
 *        ShipTab as the first real tab. jsdom activeElement for the skip test.
 *
 * describe('Debugger')
 *   it('mounts the Ship tab first (id ship)')                               // R1
 *   it('mounts Equips as the second tab')                                   // R1
 *   it('enabled:false mounts nothing and no-ops sync/reset')                // R6, Q09
 *   it('dispose removes the panel from the host')                           // R7
 *
 * describe('ShipTab')
 *   it('shows position and rotation from ShipDebugPort')                    // R5
 *   it('shows agility/deflection/integrity/shield/precision/energy 0–255')  // R5
 *   it('shows flickering, dashing, shooting, recovering flags')             // R5
 *   it('does not host loadout controls (Equips tab owns them)')             // R5
 *   it('writes a slider change into the bound stats pool immediately')      // R2
 *   it('sync skips the focused slider')                                     // R3
 *   it('reset restores mount-time ship sheet defaults')                     // R4
 *   it('does not import CamTab or invent a second number table')            // R1, R5
 *
 * describe('EquipsTab')
 *   it('shows equippedWeapon and the weapons list')                         // R5
 *   it('shows bomb/wings/shield-fit/armor/collector/converter equipped+list') // R5
 *   it('shows equipped weapon level 1–12 from the live firing bind')        // R5, D02
 *   it('shows dash level 1–12 from the live controller bind')               // R5, C02
 *   it('writes equippedWeapon into the ship bind')                          // R2
 *   it('reset restores mount-time loadout and weapon level')                // R4
 *   it('does not import ShipTab form groups')                               // R1
 *
 * Manual:
 *   A-manual-1. [manual] Ship tab current/max match the flying craft
 *   A-manual-2. [manual] dragging integrity current updates the sheet live
 *   A-manual-3. [manual] Equips weapon level 12 fans 12 laser bolts
 *   A-manual-4. [manual] production build (Q09) shows an empty debugger-area
 *
 * Coverage: R1–R8 + Ship + Equips Acceptance. Other tabs: later passes.
 */
