/**
 * #tag/arch #tag/controls
 *
 * Card:         SDD-G12 TouchControls
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: SHIP-01, SHIP-13 (POC2 play), D19 scheme 4
 * Change type:  new
 * POC-1 origin: none (new) — POC-1 was keyboard-only
 * Test file:    poc2/src/ui/touch-controls/touch-controls.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      The on-screen combat overlay for phones and tablets — a static
 *            nipplejs joystick (move X/Z) plus HTML buttons for fire, bomb,
 *            switchWeapon, switchBomb, dash, pause. Writes a TouchSource that
 *            A02 merges with keyboard / pad / mouse. Show/hide from
 *            BALANCE.controls.touch.enabled ('auto' | true | false).
 * Does not own: axis/action merge (A02), force integration (C02), fire
 *            consumption (E07), pause overlay (G11), HUD chrome (G07 —
 *            HUD stays pointer-events: none). Persistent remap (SHIP-13 G3).
 * Player-facing: a missing stick on a phone, buttons that cover the ship, or
 *            a desktop overlay that steals clicks all feel like broken controls.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Upstream:
 *   SDD-A01 Balancer — BALANCE.controls.touch (size, color, deadzone, enabled)
 *   SDD-A02 Input    — TouchSource port (injected; G12 is the producer)
 *   SDD-G06 UI areas — mounts into game-area, above the canvas, below HUD
 * Downstream:
 *   SDD-G03 RunScene — constructs / setVisible / disposes
 *   SDD-C02 Controller — reads the merged axes; never imports this class
 */

// ─── 9. Agent sign-off ───────────────────────────────────────────────────────
/**
 * Orchestrator : hub-v4.3 / 2026-08-18  scope, requires, D19 scheme 4
 * Programming  : hub-v4.3 / 2026-08-18  nipple factory inject, dispose destroy()
 * Game Design  : hub-v4.3 / 2026-08-18  static stick, button layout, auto-hide
 * TDD          : hub-v4.3 / 2026-08-18  touch-controls.test.ts green
 *
 * DoD (§6.1): spec · tests red · shape · lifecycle · BALANCE · memory ·
 *             IDs · verify green · port fidelity
 * Status: done
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Programming / Three.js
// ═════════════════════════════════════════════════════════════════════════════

// ─── 2. Contract ─────────────────────────────────────────────────────────────
/**
 * Lib: nipplejs (install on this card — hub §4.1). HTML/CSS for buttons.
 * Factory injected so tests never load the real joystick.
 */

export type TouchAction =
  | 'fire'
  | 'bomb'
  | 'switchWeapon'
  | 'switchBomb'
  | 'dash'
  | 'pause'

/** Written by this class; read by SDD-A02 each update(dt). */
export interface TouchSource {
  readonly axisX: number
  readonly axisZ: number
  isPressed(action: TouchAction): boolean
}

export interface NippleMove {
  readonly vector: { readonly x: number; readonly y: number }
  readonly force: number
}

export interface NippleHandle {
  on(event: 'move', fn: (evt: unknown, data: NippleMove) => void): void
  on(event: 'end', fn: () => void): void
  destroy(): void
}

export interface NippleFactory {
  (zone: HTMLElement): NippleHandle
}

export interface TouchControlsOptions {
  readonly host: HTMLElement
  readonly source: TouchSource & {
    setAxis(x: number, z: number): void
    setPressed(action: TouchAction, down: boolean): void
  }
  /** Defaults to nipplejs.create({ mode: 'static', ...BALANCE.controls.touch }). */
  readonly nipple?: NippleFactory
  readonly enabled: 'auto' | boolean
  readonly stickSize: number
  readonly stickColor: string
}

export declare class TouchControls {
  constructor(options: TouchControlsOptions)

  readonly visible: boolean
  setVisible(visible: boolean): void
  /** Apply 'auto': visible when the pointer is coarse or ontouchstart exists. */
  syncVisibility(): void
  dispose(): void
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   field / method     | type        | meaning
 *   -------------------|-------------|--------------------------------
 *   _root              | HTMLElement | overlay; pointer-events none except stick+buttons
 *   _zone              | HTMLElement | nipplejs host, bottom-left
 *   _nipple            | NippleHandle| created once; destroy() on dispose
 *   source.setAxis     | (x,z)       | nipple vector → A02. x = vector.x;
 *                                    | z = −vector.y so stick-up = W = −Z
 *   source.setPressed  | (action,b)  | pointerdown/up on each button
 *   fire button        | hold        | pointerdown true, pointerup/cancel false
 *   bomb/switch/dash/pause | edge  | A02 latches consumePress from down
 *
 * nipplejs: mode 'static', restJoystick true, position 50%/50% of the zone.
 * Tests pass a fake NippleFactory that records destroy().
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. One nipple instance, created in the constructor (or on first show).
 *       dispose() calls destroy() exactly once and removes the overlay node.
 *   R2. Stick-up (nipple vector.y > 0) writes axisZ < 0 (same as W / Q12).
 *   R3. |vector| under BALANCE.controls.touch.deadzone writes (0, 0).
 *   R4. Buttons do not use keyboard codes. They only setPressed on TouchSource.
 *   R5. Overlay pointer-events: none; stick zone and buttons are auto.
 *       G07 HUD remains pointer-events none and must not cover the buttons.
 *   R6. enabled 'auto': visible on coarse pointer or ontouchstart; hidden on
 *       fine desktop. enabled true/false forces the overlay.
 *   R7. Hidden overlay must not emit axes or actions (axes snap to 0, buttons up).
 *   R8. Per-frame allocation: none. nipplejs move callback writes two scalars.
 *   R9. No THREE. No scene.add. Host is G06 game-area.
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      HTML overlay — left static joystick, right column of six buttons
 *              labelled Fire / Bomb / Wpn / Bomb× / Dash / Pause.
 * Inheritance: N/A
 * syncRender:  N/A — DOM. setVisible / syncVisibility is the present step.
 * Scene ownership: G03 constructs and disposes. This class never scene.add.
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 *   BALANCE.controls.touch.enabled    = 'auto'
 *   BALANCE.controls.touch.stickSize  = 120
 *   BALANCE.controls.touch.stickColor = '#22d3ee'
 *   BALANCE.controls.touch.deadzone   = 0.18   // match pad deadzone
 *
 * Layout: joystick bottom-left, safe-area inset; buttons bottom-right in two
 * columns (Fire+Bomb hold/edge cluster, then switch/dash/pause). Hit targets
 * ≥44px. Cyan/indigo to match the ship, 0.55 overlay opacity so the field
 * stays readable.
 * Feel:      the nipple must feel like the left stick after deadzone — same
 *            ship, not a snappier digital d-pad. Fire is hold; the rest are taps.
 * Leveling:  N/A.
 * Graphics:  HTML/CSS; no canvas joystick. Pillar 4 (legible at speed) and
 *            the move-on-X/Y fragment on a phone.
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/ui/touch-controls/touch-controls.test.ts
 * Runner: vitest (`// @vitest-environment jsdom`)
 * Mocks: NippleFactory stub, fake host, mutable TouchSource
 *
 * describe('TouchControls')
 *   it('constructs a nipple in the left zone via the injected factory')          // R1
 *   it('maps nipple vector (0,1) to axisZ < 0')                                  // R2, Q12
 *   it('zeros axes under the touch deadzone')                                    // R3
 *   it('Fire pointerdown sets isPressed fire; pointerup clears it')              // R4
 *   it('Bomb pointerdown is a tap that A02 can consume as an edge')              // R4
 *   it('hidden overlay snaps axes to 0 and releases buttons')                    // R7
 *   it('dispose calls nipple.destroy and removes the overlay node')              // R1
 *   it('does not import three')                                                  // R9
 *
 * Manual:
 *   A-manual-1. [manual] phone portrait: stick left, buttons right, ship readable
 *   A-manual-2. [manual] desktop fine pointer: overlay hidden, mouse clicks reach the game
 *
 * Coverage: R1–R9 + D19 scheme 4.
 */
