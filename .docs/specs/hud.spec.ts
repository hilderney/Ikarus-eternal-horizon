/**
 * #tag/hud #tag/ship #tag/memory
 *
 * Card:         SDD-G07 HUD
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: RUL-03, SHIP-05, SHIP-06, SHIP-09, RES-02
 * Change type:  merge
 * POC-1 origin: poc/src/systems/energyHud.ts + poc/src/systems/shipCoords.ts
 *               — frozen reference (duplicated projector; merge into one)
 * Test file:    poc2/src/ui/hud.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      All run HUD widgets. Floating bars over the ship — Force Field,
 *            Integrity, Energy — plus the ship coordinate label (world→screen
 *            via `project` + canvas rect, letterbox-safe, edge-clamped),
 *            weapon chip, resource counters, and the border HUD (score /
 *            kills / high) fed by G10. Reacts to F04 events by flickering
 *            the bar that was hit. One shared projector (POC-1 duplicated it
 *            in shipCoords + energyHud). HUD reads state, never mutates it.
 * Does not own: health math (C03), energy spend (D03), score accumulation
 *            (G10), damage application (F04), camera (B01), ship transform
 *            (C01). Audio stingers and radio waveform are §7.
 * Player-facing: unreadable bars break pillar 1. A label that leaves the
 *            letterbox, a shield bar that lies, or a score that does not
 *            tick is a failed run UI.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-A01 Balancer — BALANCE.hud + pools / score
 *   SDD-B01 GameCamera — PerspectiveCamera for project()
 *   SDD-C01 Ship — world position + inventory + equipped weapon
 *   SDD-C03 ShipHealth — integrity / shield reads
 *   SDD-D03 EnergyManager — energy current / max
 *   SDD-G10 RunState + ScoreManager — score, kills, best
 *
 * Listens (not a requires-blocker; wired by G03):
 *   SDD-F04 DamageResolver — `shieldHit` / `hullHit` flicker events
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-G03 RunScene — constructs/disposes HUD, calls update after logic
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

export interface Vec3Read {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface ScreenPoint {
  readonly left: number
  readonly top: number
}

/**
 * One projector shared by every floating widget. Reuses a single scratch
 * Vector3. Returns null when the point is behind the camera (projected.z > 1).
 */
export interface WorldToScreenProjector {
  project(world: Vec3Read): ScreenPoint | null
}

export interface ProjectableCamera {
  projectWorld(world: Vec3Read, out: { x: number; y: number; z: number }): void
}

export declare class CanvasProjector implements WorldToScreenProjector {
  constructor(camera: ProjectableCamera, canvas: HTMLCanvasElement)
  project(world: Vec3Read): ScreenPoint | null
}

export interface HealthRead {
  readonly integrity: number
  readonly integrityMax: number
  readonly shield: number
  readonly shieldMax: number
}

export interface EnergyRead {
  readonly current: number
  readonly max: number
}

export interface InventoryRead {
  readonly metalScrap: number
}

export interface BorderHudRead {
  readonly score: number
  readonly kills: number
  readonly best: number
}

export type HudHitChannel = 'shield' | 'hull'

export interface HudSources {
  readonly shipPosition: () => Vec3Read
  readonly health: () => HealthRead
  readonly energy: () => EnergyRead
  readonly weaponName: () => string
  readonly inventory: () => InventoryRead
  readonly border: () => BorderHudRead
}

export interface HudOptions {
  readonly canvas: HTMLCanvasElement
  readonly projector: WorldToScreenProjector
  readonly sources: HudSources
}

export interface HudPort {
  /** Read-only present. Never mutates sources. */
  update(): void
  /** F04 hit — flicker the matching bar. Energy is not a hit channel. */
  onDamage(channel: HudHitChannel): void
  dispose(): void
}

export declare class Hud implements HudPort {
  constructor(options: HudOptions)
  update(): void
  onDamage(channel: HudHitChannel): void
  dispose(): void
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   projector     | WorldToScreenProjector | shared; created once
 *   bar.shield    | HTMLElement            | Force Field fill + label
 *   bar.integrity | HTMLElement            | Integrity fill + label
 *   bar.energy    | HTMLElement            | Energy fill + label
 *   coords        | HTMLElement            | `X ..  Y ..  Z ..`
 *   weapon        | HTMLElement            | equipped weapon chip
 *   resources     | HTMLElement            | Metal Scrap counter
 *   border        | HTMLElement            | SCORE / KILLS / HIGH
 *   scratch       | Vector3                | reused by CanvasProjector
 *
 *   project     — world.project(camera) → canvas.getBoundingClientRect()
 *                 → clamp into rect ± BALANCE.hud.margin
 *                 → hide widget if projected.z > 1
 *   update      — reads sources, writes text/width/transform only
 *   onDamage    — adds a flicker class for BALANCE.hud.flickerMs
 *   dispose     — removes every HUD node and timer
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. One CanvasProjector instance is shared by Force Field, Integrity,
 *       Energy and the coordinate label. No second `new Vector3` per widget.
 *   R2. Projection uses the canvas bounding rect (letterbox-safe), not the
 *       window. Left/top are clamped to [rect.left+margin, rect.right-margin]
 *       and [rect.top+margin, rect.bottom-margin].
 *   R3. `update()` reads sources and writes DOM. It never calls spend, never
 *       applyDamage, never increments score, never writes inventory.
 *   R4. Force Field bar width = shield/shieldMax; Integrity = integrity/
 *       integrityMax; Energy = current/max. Each is clamped to [0, 1].
 *   R5. `onDamage('shield')` flickers only the Force Field bar;
 *       `onDamage('hull')` flickers only the Integrity bar.
 *   R6. Border HUD shows score, kills and best from G10 (RUL-03).
 *   R7. Resource counter shows Metal Scrap from C01 inventory (SHIP-06, RES-02).
 *   R8. Weapon chip shows the equipped weapon name (read-only).
 *   R9. Memory: DOM + one scratch vector created once. dispose removes nodes
 *       and clears flicker timers. Per-frame allocation: none (no string
 *       concat via template that allocates beyond the necessary textContent
 *       write; reuse format buffers where practical).
 *   R10. Widgets are `pointer-events: none` and must not steal game input.
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      HTML/CSS overlays (fixed / transformed) + THREE project() for
 *              positions. No mesh.
 * Inheritance: N/A (not a THREE object)
 * syncRender writes: N/A — `update()` *is* the present step (DOM). Called
 *              from RunScene after logic, before or after THREE.syncRender;
 *              never from inside a manager.
 * Never writes: health, energy, score, inventory, ship position
 * Scene ownership: HUD nodes are appended to document.body (POC-1) or to
 *                  game-area; RunScene disposes the Hud
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 * New section (add to SDD-A01):
 *   BALANCE.hud.margin            = 12     // letterbox clamp; POC-1 coords=12,
 *                                          // energy=10 — unify so bars never
 *                                          // kiss the black bars
 *   BALANCE.hud.barOffsetY        = 24     // POC-1 energyHud BAR_OFFSET_Y
 *   BALANCE.hud.coordsOffsetY     = 28     // POC-1 shipCoords LABEL_OFFSET_Y
 *   BALANCE.hud.flickerMs         = 120    // hit sting; readable, not seizure
 *   BALANCE.hud.barWidthPx        = 96     // POC-1 .hud-energy width
 *
 * Pool numbers (owned by other cards, displayed here):
 *   BALANCE.ship.health.integrityMax / shieldMax
 *   BALANCE.gameplay.energy.max
 *   BALANCE.score.*  (totals come from G10, not re-derived)
 *
 * Feel:      Pillar 1 — Force Field, Integrity and Energy are always readable
 *            without hunting. Shield drains first (SHIP-05); the bar that was
 *            hit is the one that flashes. Score/kills tick on the border so
 *            the player feels the "one more kill" pull (RUL-03). POC-1 only
 *            had Energy + coords; Force Field / Integrity / border / chip /
 *            scrap are new but must sit on the same projector so they do not
 *            drift apart.
 * Leveling:  N/A (HUD does not scale). Hull level is visible as Integrity
 *            fill, not as extra chrome.
 * Graphics:  Neon overlays, <0.3s read, pointer-events none.
 *              Force Field  fill  #22d3ee → #2dd4ff  (cyan, same as POC-1 energy)
 *              Integrity    fill  #f43f5e → #fb7185  (rose — hull pain)
 *              Energy       fill  #22d3ee → #2dd4ff
 *              coords       #7ce4ff on rgba(8,8,24,0.7) + cyan hairline
 *              border       SCORE/KILLS left, HIGH right, 7-digit pad
 *              flicker      opacity strobe + brighter box-shadow, same colour
 *            Floating stack (above ship, offsets from BALANCE.hud):
 *              Integrity, Force Field, Energy, then coords, then weapon + scrap.
 *            Letterbox: never draw into the unused window chrome — clamp to
 *            the canvas rect. Hide if behind camera.
 * Pillars:   1 visible risk · 2 tangible degradation (Integrity colour) ·
 *            4 legibility · 5 score/kills border
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/ui/hud.test.ts
 * Runner: vitest
 * Mocks: fake ProjectableCamera writing known NDC, a canvas with a stub
 *        getBoundingClientRect ({left:100,top:50,width:540,height:960}),
 *        HudSources returning controllable pools, fake timers for flicker
 *
 * describe('CanvasProjector')
 *   it('maps NDC (0,0) to the canvas centre plus rect offset')              // R2
 *   it('clamps projected points into the canvas rect ± margin')             // R2
 *   it('returns null when projected.z > 1')                                 // R2
 *   it('does not allocate a new Vector3 per project call')                  // R1, R9
 *
 * describe('Hud')
 *   it('shares one projector across bars and coords')                       // R1, merge
 *   it('sets Force Field fill from shield/shieldMax')                       // R4, SHIP-05
 *   it('sets Integrity fill from integrity/integrityMax')                   // R4, SHIP-05
 *   it('sets Energy fill from current/max')                                 // R4, SHIP-09
 *   it('update does not mutate health, energy, inventory or border sources') // R3
 *   it('onDamage("shield") flickers only the Force Field bar')              // R5
 *   it('onDamage("hull") flickers only the Integrity bar')                  // R5
 *   it('border shows score, kills and best')                                // R6, RUL-03
 *   it('resource counter shows metalScrap')                                 // R7, SHIP-06, RES-02
 *   it('weapon chip shows the equipped name')                               // R8
 *   it('dispose removes every HUD node from the document')                  // R9
 *   it('coords text formats world X/Y/Z to two decimals')                   // port fidelity
 *
 * Manual:
 *   A-manual-1. [manual] bars follow the ship and never draw on the letterbox
 *   A-manual-2. [manual] a shield hit flickers cyan; a hull hit flickers rose
 *
 * Coverage: R1–R10 + Acceptance (live bars, letterbox-safe labels, flicker,
 * one projector, read-only) + RUL-03, SHIP-05/06/09, RES-02.
 */
