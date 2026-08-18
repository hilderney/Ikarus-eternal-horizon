/**
 * #tag/arch #tag/controls
 *
 * Card:         SDD-C02 PlayerController + CameraController
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: SHIP-01, SHIP-04 (Q07 pointer deferred)
 * Change type:  split
 * POC-1 origin: poc/src/systems/controllers.ts  — frozen reference
 * Test file:    poc2/src/gameobjects/controller/controller.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      Input → force mapping for the ship and the debug camera.
 *            PlayerController: axis force (accel/decel/brake, maxSpeed) and
 *            tilt/bank on rotation.z. CameraController: IJKL/UO translation
 *            and Shift+IJKL/UO rotation.
 * Does not own: InputState wiring (A02), GameCamera object (B01), Ship mesh
 *            (C01), why motion is slower (C03) — it only reads speedMul/accelMul.
 *            Fire/switch (E07). Pointer control (SHIP-04) is deferred (Q07).
 * Player-facing: the POC-1 inertia and bank. Wrong accel/brake/tilt feels like
 *            a different game. Camera keys are a debug rig, not combat control.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-A01 Balancer  — BALANCE.controls.motion / tilt / camera / shipKeys
 *   SDD-A02 Input     — isDown(code), including synthetic Shift+KeyX
 *   SDD-A03 Math      — clamp / integration helpers; no per-frame alloc
 *   SDD-B01 Camera    — pose the CameraController writes (position/rotation deg)
 *   SDD-C01 Ship      — applyTransform target
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-C03 ShipHealth — supplies speedMul/accelMul; controller must not import it
 *   SDD-G03 RunScene   — constructs both controllers and ticks them
 *   SDD-G08 Debugger   — live-edits BALANCE.controls the controllers read
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
 * Public surface. Ports first, then the classes. Constructor dependencies explicit.
 * No service locators. No globals besides BALANCE.
 * Pure logic — does not extend THREE. Writes ShipTransform / CameraPose only.
 */

/** Port owned by SDD-A02. Copied so this spec is self-contained. */
export interface InputPort {
  isDown(code: string): boolean
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

  /** Integrates force on X/Z and ramps tilt. Writes transform. No GPU. */
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
 *   tiltCur          | number (deg)     | current bank; target = dirX * maxDeg * sign
 *   transform        | ShipTransform    | written each update: position.x/z, rotation.z
 *   modifiers        | MotionModifiers  | read every frame; never interpreted
 *
 * Non-obvious — PlayerController:
 *   Pre:  dt in seconds, clamped by A04 upstream.
 *   Axis: dir = (plus?1:0) - (minus?1:0) ∈ {-1,0,1}.
 *   Force: if dir==0 → coastToZero(decel); else if braking against velocity
 *          → brake; else accel. Then pushVelocity capped at effective maxSpeed.
 *   effective maxSpeed = motion.maxSpeed * modifiers.speedMul
 *   effective accel    = motion.accel    * modifiers.accelMul
 *   brake/decel are NOT multiplied (hub: maxSpeed/accel only).
 *   Tilt: rise rate = maxDeg/(riseMs/1000), fall rate = maxDeg/(fallMs/1000).
 *   axis 'z' writes transform.rotation.z (POC-1 default).
 *
 * Non-obvious — CameraController:
 *   Translation: pose.position += dir * moveSpeed * dt on x/y/z.
 *   Rotation:    pose.rotation += dir * rotSpeed * dt (degrees).
 *   Combos: isDown('Shift+KeyI') etc. Base KeyI still moves while Shift rotates
 *           because A02 synthesises the combo without removing the base code —
 *           CameraController binds rot to the combo codes, move to the base codes.
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. Ship control is continuous force, not teleport or instantaneous velocity.
 *   R2. Opposite input while moving uses brake (120), not accel (60).
 *   R3. Released axis coasts with decel (60) to exactly 0 (no sign flip through 0).
 *   R4. Speed never exceeds maxSpeed * speedMul. Accel used is accel * accelMul.
 *       The controller does not know why the multipliers changed.
 *   R5. Tilt ramps to dirX * maxDeg * sign in riseMs; settles to 0 in fallMs.
 *       Default axis is 'z', sign is -1.
 *   R6. PlayerController writes transform only (position x/z, tilt axis). It
 *       never calls Ship.setEquippedWeapon, never reads health fields.
 *   R7. CameraController maps IJKL/UO to move and Shift+IJKL/UO to rot.
 *       moveSpeed 12, rotSpeed 45. No mode toggle — ship and camera coexist.
 *   R8. Pointer/mouse ship control is out of scope (Q07 deferred). No pointer
 *       branch in either class.
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
 * Port from POC-1 (do not retune until a playtest says so):
 *   BALANCE.controls.motion.maxSpeed = 12     // cruise; hull mul scales this
 *   BALANCE.controls.motion.accel    = 60     // m/s² into the stick
 *   BALANCE.controls.motion.decel    = 60     // coast to rest
 *   BALANCE.controls.motion.brake    = 120    // reverse stick bites twice as hard
 *   BALANCE.controls.tilt.axis       = 'z'
 *   BALANCE.controls.tilt.sign       = -1     // bank into the turn
 *   BALANCE.controls.tilt.maxDeg     = 22     // readable, not a roll
 *   BALANCE.controls.tilt.riseMs     = 150    // snap into the bank
 *   BALANCE.controls.tilt.fallMs     = 200    // slightly slower settle
 *   BALANCE.controls.shipKeys        = { A/D = X, W/S = Z }
 *
 * Camera debug rig:
 *   BALANCE.controls.camera.moveSpeed = 12
 *   BALANCE.controls.camera.rotSpeed  = 45    // deg/s
 *   BALANCE.controls.camera.keys      =
 *     I = +Z, K = −Z, J = −X, L = +X, U = +Y, O = −Y
 *     Shift+K = +rotX, Shift+I = −rotX
 *     Shift+U = +rotZ, Shift+O = −rotZ
 *     Shift+J = +rotY, Shift+L = −rotY
 *
 * Default modifiers (healthy hull, C03 level 0):
 *   speedMul = 1, accelMul = 1
 *   C03 later injects [1, 0.85, 0.7, 0.5] — this card does not own those values.
 *
 * Feel:      POC-1 force + bank is the law. Brake makes direction changes snappy
 *            without making tap-strafes feel like ice. 22° bank is a silhouette
 *            cue, not a flight-sim roll. Camera rig is for framing, not combat.
 * Leveling:  hull levels scale maxSpeed/accel via injected multipliers (C03).
 *            Controller has no hull-level table.
 * Graphics:  N/A — tilt is presented by C01.
 * Pillars:   playable pillar fragment "move on X/Y". Q07: pointer deferred;
 *            keyboard-only in POC2 (SHIP-04 should, not must, this gate).
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/gameobjects/controller/controller.test.ts
 * Runner: vitest
 * Mocks: InputPort stub (Set of codes), ShipTransform object, CameraPose object,
 *        BALANCE.controls slice, MotionModifiers {1,1} and a damaged {0.5,0.5}
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
 *   it('has no pointer or mouse code path')                                        // R8, Q07
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
 *
 * Coverage: R1–R10 + card Acceptance (POC-1 inertia + bank preserved) + Q07.
 */
