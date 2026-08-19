/**
 * #tag/arch #tag/controls
 *
 * Card:         SDD-C02 PlayerController + CameraController
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: SHIP-01, SHIP-13 (POC2 play), SHIP-04 (mouse-as-buttons via D19;
 *               pointer-steer still deferred), SHIP-08 (dash *input* now; energy gate later)
 * Change type:  split
 * POC-1 origin: poc/src/systems/controllers.ts  — frozen reference (keyboard force + tilt)
 * Test file:    poc2/src/gameobjects/controller/controller.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      Input → ship force and the debug camera. Device-blind.
 *            PlayerController: analog force (accel/decel/brake, maxSpeed) from
 *            `InputPort.axis('moveX'|'moveZ')`, tilt/bank on rotation.z, and a
 *            kinematic dash impulse from `consumePress('dash')`.
 *            CameraController: IJKL/UO translation and Shift+IJKL/UO rotation
 *            (keyboard debug rig — not a pad / touch / mouse camera).
 *
 * Accepts four exclusive control schemes (D19) **only through InputPort**.
 * This class never imports nipplejs, never listens to pointer events, never
 * polls getGamepads(). A02 merges the schemes; G12 owns the touch overlay.
 *
 * Does not own: InputState wiring (A02), TouchControls DOM (G12), GameCamera
 *            object (B01), Ship mesh (C01), why motion is slower (C03) — it
 *            only reads speedMul/accelMul. Fire / bomb / switchWeapon /
 *            switchBomb (E07 / §7 bomb). Pause overlay (G11). Pointer-steer
 *            "mouse moves the ship" (SHIP-04 remainder). Dash Energy drain
 *            (SHIP-08 / D03) — this card only the velocity impulse + cooldown.
 * Player-facing: the POC-1 inertia and bank, plus a short dodge burst. Wrong
 *            accel/brake/tilt feels like a different game. Camera keys are a
 *            debug rig, not combat control.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-A01 Balancer  — BALANCE.controls.motion / tilt / camera / shipKeys /
 *                       gamepad / mouse / touch / dash
 *   SDD-A02 Input     — axis('moveX'|'moveZ'), isDown(code) including Shift+KeyX,
 *                       consumePress('dash'). D19 follow-up (mouse + virtual stick)
 *                       must land before schemes 3–4 actually move the ship.
 *   SDD-A03 Math      — clamp / integration helpers; no per-frame alloc
 *   SDD-B01 Camera    — pose the CameraController writes (position/rotation deg)
 *   SDD-C01 Ship      — applyTransform target
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-C03 ShipHealth — supplies speedMul/accelMul; controller must not import it
 *   SDD-G03 RunScene   — constructs both controllers and ticks them
 *   SDD-G08 Debugger   — live-edits BALANCE.controls the controllers read
 *   SDD-G12 TouchControls — overlay only; C02 still never sees nipplejs
 *   SDD-E07 FiringManager — fire / switchWeapon / bomb / switchBomb (not this class)
 *   SDD-G11 PauseScene    — pause (not this class)
 */

// ─── 9. Agent sign-off ───────────────────────────────────────────────────────
/**
 * Orchestrator : hub-v4.3 / 2026-08-18  four schemes via InputPort, D19
 * Programming  : hub-v4.3 / 2026-08-18  device-blind; dash consumePress; no nipplejs
 * Game Design  : hub-v4.3 / 2026-08-18  scheme table, dash placeholders, WASD+mouse
 * TDD          : hub-v4.3 / 2026-08-18  controller.test.ts green
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
 * Public surface. Ports first, then the classes. Constructor dependencies explicit.
 * No service locators. No globals besides BALANCE.
 * Pure logic — does not extend THREE. Writes ShipTransform / CameraPose only.
 * One public class per file: player-controller.ts · camera-controller.ts
 */

/** Port owned by SDD-A02. Copied so this spec is self-contained. */
export type CombatAction =
  | 'fire'
  | 'bomb'
  | 'switchWeapon'
  | 'switchBomb'
  | 'dash'
  | 'pause'

export interface InputPort {
  isDown(code: string): boolean
  axis(id: 'moveX' | 'moveZ'): number
  isPressed(action: CombatAction): boolean
  /**
   * Rising-edge, consumed this call. Dash / switch / bomb / pause use this.
   * Fire stays on isPressed (hold-to-fire).
   */
  consumePress(action: CombatAction): boolean
}

/** Port owned by SDD-C03. Injected — PlayerController never imports ShipHealth. */
export interface MotionModifiers {
  readonly speedMul: number
  readonly accelMul: number
}

export interface MotionConfig {
  readonly maxSpeed: number
  readonly accel: number
  readonly decel: number
  readonly brake: number
}

export interface DashConfig {
  readonly speedMul: number
  readonly durationMs: number
  readonly cooldownMs: number
}

export interface TiltConfig {
  readonly axis: 'y' | 'z'
  readonly sign: 1 | -1
  readonly maxDeg: number
  readonly riseMs: number
  readonly fallMs: number
}

export interface ShipKeys {
  readonly moveXMinus: string
  readonly moveXPlus: string
  readonly moveZMinus: string
  readonly moveZPlus: string
}

export interface CameraKeys {
  readonly moveZPlus: string
  readonly moveZMinus: string
  readonly moveXMinus: string
  readonly moveXPlus: string
  readonly moveYPlus: string
  readonly moveYMinus: string
  readonly rotXPlus: string
  readonly rotXMinus: string
  readonly rotZPlus: string
  readonly rotZMinus: string
  readonly rotYPlus: string
  readonly rotYMinus: string
}

export interface CameraControlConfig {
  readonly moveSpeed: number
  readonly rotSpeed: number
  readonly keys: CameraKeys
}

/** Logical pose C01 reads. Rotation in degrees (POC-1). */
export interface ShipTransform {
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
  scale: number
}

/** Logical pose B01 reads. Rotation in degrees. */
export interface CameraPose {
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number }
}

export interface PlayerControllerOptions {
  readonly input: InputPort
  readonly transform: ShipTransform
  readonly motion: MotionConfig
  readonly dash: DashConfig
  readonly tilt: TiltConfig
  readonly keys: ShipKeys
  readonly modifiers: MotionModifiers
}

export interface CameraControllerOptions {
  readonly input: InputPort
  readonly pose: CameraPose
  readonly config: CameraControlConfig
}

export declare class PlayerController {
  constructor(options: PlayerControllerOptions)

  /** Integrates force on X/Z, ramps tilt, applies dash. Writes transform. No GPU. */
  update(dt: number): void

  dispose(): void
}

export declare class CameraController {
  constructor(options: CameraControllerOptions)

  /** Integrates IJKL/UO move and Shift-combo rot onto pose. No GPU. */
  update(dt: number): void

  dispose(): void
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   field            | type             | meaning / unit / range
 *   -----------------|------------------|--------------------------------
 *   vx, vz           | number (m/s)     | ship velocity per axis; cap at maxSpeed*speedMul
 *                       (during dash the cap is maxSpeed*speedMul*dash.speedMul)
 *   tiltCur          | number (deg)     | current bank; target = dirX * maxDeg * sign
 *   dashMs           | number           | remaining dash duration; 0 = idle
 *   dashCdMs         | number           | remaining cooldown; consumePress ignored while > 0
 *   transform        | ShipTransform    | written each update: position.x/z, rotation.z
 *   modifiers        | MotionModifiers  | read every frame; never interpreted
 *
 * Non-obvious — PlayerController:
 *   Pre:  dt in seconds, clamped by A04 upstream.
 *   Axis: dirX = input.axis('moveX'), dirZ = input.axis('moveZ') ∈ [−1, 1].
 *         A02 already merged stick + keyboard + nipple; this class does not
 *         read shipKeys for motion (shipKeys remain on the options bag for
 *         debug dumps only).
 *   Force: if dir==0 → coastToZero(decel); else if braking against velocity
 *          → brake * |dir|; else accel * |dir|. Then pushVelocity capped at
 *          effective maxSpeed. Analog magnitude scales accel/brake.
 *   effective maxSpeed = motion.maxSpeed * modifiers.speedMul
 *   effective accel    = motion.accel    * modifiers.accelMul
 *   brake/decel are NOT multiplied (hub: maxSpeed/accel only).
 *   Tilt: rise rate = maxDeg/(riseMs/1000), fall rate = maxDeg/(fallMs/1000).
 *   axis 'z' writes transform.rotation.z (POC-1 default).
 *   Dash: on consumePress('dash') and dashCdMs===0, set dashMs = durationMs,
 *         dashCdMs = cooldownMs, and snap (vx,vz) along the current dir
 *         (if dir==0, along current velocity; if still, no-op). While dashMs>0
 *         the speed cap is effective maxSpeed * dash.speedMul. Energy is not
 *         spent here (SHIP-08 later).
 *
 * Non-obvious — CameraController:
 *   Translation: pose.position += dir * moveSpeed * dt on x/y/z.
 *   Rotation:    pose.rotation += dir * rotSpeed * dt (degrees).
 *   Combos: isDown('Shift+KeyI') etc. Base KeyI still moves while Shift rotates
 *           because A02 synthesises the combo without removing the base code —
 *           CameraController binds rot to the combo codes, move to the base codes.
 *   Keyboard-only by design (debug rig). Pad/touch/mouse do not drive the camera.
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. Ship control is continuous force, not teleport or instantaneous velocity
 *       (except the dash snap, which is a bounded impulse).
 *   R2. Opposite input while moving uses brake (120), not accel (60).
 *   R3. Released axis coasts with decel (60) to exactly 0 (no sign flip through 0).
 *   R4. Speed never exceeds maxSpeed * speedMul (or that × dash.speedMul during
 *       dash). Accel used is accel * accelMul. The controller does not know why
 *       the multipliers changed.
 *   R5. Tilt ramps to dirX * maxDeg * sign in riseMs; settles to 0 in fallMs.
 *       Default axis is 'z', sign is -1.
 *   R6. PlayerController writes transform only (position x/z, tilt axis). It
 *       never calls Ship.setEquippedWeapon, never reads health fields, never
 *       consumes fire / bomb / switchWeapon / switchBomb / pause.
 *   R7. CameraController maps IJKL/UO to move and Shift+IJKL/UO to rot.
 *       moveSpeed 12, rotSpeed 45. No mode toggle — ship and camera coexist.
 *   R8. Device-blind (D19). No mouse / pointer / gamepad / nipplejs branch in
 *       either class. Pointer-steer (mouse moves the ship) stays deferred.
 *   R11. Motion dirs come from axis(), not from isDown(shipKeys). Stick,
 *        keyboard, and virtual nipple already coexist inside A02. |dir| scales
 *        accel.
 *   R12. Dash starts only on consumePress('dash') while cooldown is 0.
 *        A held dash button does not retrigger. Cooldown starts at dash start.
 *   R9. Memory: no GPU. Per-frame allocation: none (no new Vector3).
 *   R10. dispose() drops input references; nothing to free on GPU.
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      N/A — no visual
 * Inheritance: N/A (pure logic)
 * syncRender writes: N/A — C01 Ship.syncRender and B01 GameCamera.applyConfig
 *                    present the poses these classes write
 * Scene ownership: N/A
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 * Four schemes, one vocabulary. No exclusive mode — sources OR together.
 * Movement is analog (stick / nipple) or digital ±1 (WASD). Mouse never steers.
 *
 *   Action          Hold / edge   Keyboard (1)     Gamepad (2)        Mouse mix (3)           Touch (4)
 *   --------------  ------------  ---------------  -----------------  ----------------------  -------------------
 *   move X/Z        analog/digital WASD            left stick         WASD                    nipplejs static stick
 *   fire            HOLD          Space            RT 7               Mouse0 left             Fire button
 *   bomb            EDGE          KeyE             South/A 0          Mouse2 right            Bomb button
 *   switchWeapon    EDGE          KeyF             LB 4               Wheel notch             Switch-W button
 *   switchBomb      EDGE          KeyQ             RB 5               Mouse1 middle           Switch-B button
 *   dash            EDGE          ControlLeft      LT 6               ControlLeft (keyboard)  Dash button
 *   pause           EDGE          Escape           Start 9            Escape                  Pause button
 *
 * Scheme 1 — Keyboard: POC-1 WASD + Space + F, plus E / Q / Ctrl / Esc.
 *             Shift stays the camera-rot modifier (IJKL/UO). Do not bind dash
 *             to Shift.
 * Scheme 2 — Gamepad: D18 W3C map; RB added for switchBomb; LT is dash
 *             (was "boost"); South/A is bomb (was "special").
 * Scheme 3 — Keyboard + mouse: WASD still flies; left/right/wheel/middle are
 *             combat. Cursor position is ignored (SHIP-04 pointer-steer = no).
 * Scheme 4 — Touch: G12 overlay. nipplejs static stick, bottom-left; action
 *             buttons bottom-right. Hidden when BALANCE.controls.touch.enabled
 *             is 'auto' and the pointer is fine (desktop).
 *
 * Port from POC-1 (do not retune until a playtest says so):
 *   BALANCE.controls.motion.maxSpeed = 12
 *   BALANCE.controls.motion.accel    = 60
 *   BALANCE.controls.motion.decel    = 60
 *   BALANCE.controls.motion.brake    = 120
 *   BALANCE.controls.tilt.axis       = 'z'
 *   BALANCE.controls.tilt.sign       = -1
 *   BALANCE.controls.tilt.maxDeg     = 22
 *   BALANCE.controls.tilt.riseMs     = 150
 *   BALANCE.controls.tilt.fallMs     = 200
 *   BALANCE.controls.shipKeys        = { A/D = X, W/S = Z }
 *
 * Dash — placeholders until SHIP-08 energy playtest:
 *   BALANCE.controls.dash.speedMul    = 2.2
 *   BALANCE.controls.dash.durationMs  = 140
 *   BALANCE.controls.dash.cooldownMs  = 750
 *
 * Camera debug rig (unchanged):
 *   BALANCE.controls.camera.moveSpeed = 12
 *   BALANCE.controls.camera.rotSpeed  = 45
 *   I = +Z, K = −Z, J = −X, L = +X, U = +Y, O = −Y
 *   Shift+K = +rotX, Shift+I = −rotX, Shift+U = +rotZ, Shift+O = −rotZ,
 *   Shift+J = +rotY, Shift+L = −rotY
 *
 * Default modifiers (healthy hull, C03 level 0):
 *   speedMul = 1, accelMul = 1
 *   C03 later injects [1, 0.85, 0.7, 0.5] — this card does not own those values.
 *
 * Feel:      POC-1 force + bank is the law. Brake makes direction changes snappy
 *            without making tap-strafes feel like ice. 22° bank is a silhouette
 *            cue, not a flight-sim roll. Dash is a readable dodge, not a teleport;
 *            140 ms at 2.2× still reads as the same craft. Camera rig is for
 *            framing, not combat. Keyboard + pad + mouse + touch must feel like
 *            the same ship.
 * Leveling:  hull levels scale maxSpeed/accel via injected multipliers (C03).
 *            Dash duration/cooldown do not scale with hull in G0.
 * Graphics:  N/A — tilt is presented by C01; touch chrome is G12.
 * Pillars:   playable pillar fragment "move on X/Y". D19 four schemes.
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/gameobjects/controller/controller.test.ts
 * Runner: vitest
 * Mocks: InputPort stub (Set of codes + axis values + consumePress queue),
 *        ShipTransform object, CameraPose object, BALANCE.controls slice,
 *        MotionModifiers {1,1} and a damaged {0.5,0.5}
 *
 * describe('PlayerController')
 *   it('accelerates along +X at accel 60 and caps at maxSpeed 12')                 // R1, R4, port
 *   it('uses brake 120 when input opposes current velocity')                       // R2
 *   it('coasts to exactly 0 with decel 60 when input is released')                 // R3
 *   it('scales maxSpeed and accel by injected speedMul/accelMul and nothing else') // R4
 *   it('does not import or name ShipHealth')                                       // R4, R6
 *   it('banks rotation.z toward dirX * 22 * -1, reaching target in 150ms')         // R5
 *   it('settles tilt back to 0 in 200ms when input is released')                   // R5
 *   it('writes transform.position.x/z and does not write y')                       // R6, SHIP-01
 *   it('does not import nipplejs, mouse event names, or getGamepads')              // R8, D19
 *   it('does not consume fire, bomb, switchWeapon, switchBomb, or pause')          // R6
 *   it('uses axis moveX/moveZ rather than isDown of shipKeys')                     // R11, D18
 *   it('half-stick (|axis|=0.5) accelerates at half of accel 60')                  // R11 analog
 *   it('nipple-sized axis 1,-1 is indistinguishable from a full stick')            // R11, D19 scheme 4
 *   it('consumePress dash snaps speed along dir and ignores a held button')        // R12
 *   it('dash is ignored while cooldown is active')                                 // R12
 *   it('update(dt) allocates no objects')                                          // R9
 *
 * describe('CameraController')
 *   it('KeyI increases pose.position.z at moveSpeed 12')                           // R7
 *   it('KeyU / KeyO move +Y / −Y at moveSpeed 12')                                 // R7
 *   it('Shift+KeyI rotates rotX down at rotSpeed 45 without a mode toggle')        // R7
 *   it('WASD ship keys are ignored by CameraController')                           // R7 coexist
 *
 * Manual:
 *   A-manual-1. [manual] WASD inertia + bank matches POC-1 by eye
 *   A-manual-2. [manual] IJKL/UO + Shift combos frame the ship without stealing WASD
 *   A-manual-3. [manual] Xbox/DualShock left stick feels like WASD after deadzone
 *   A-manual-4. [manual] WASD + left-click fires; right-click is bomb; wheel switches
 *               weapon; the cursor does not drag the ship
 *   A-manual-5. [manual] phone: nipple moves the ship; on-screen Fire holds a stream
 *
 * Coverage: R1–R12 + card Acceptance (POC-1 inertia + bank preserved) + D19.
 */
