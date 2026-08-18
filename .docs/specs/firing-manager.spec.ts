/**
 * #tag/arch #tag/weapons #tag/managers
 *
 * Card:         SDD-E07 FiringManager
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: WPN-03, WPN-05, SHIP-03, SHIP-12, SHIP-13 (POC2 play)
 * Change type:  class-ify
 * POC-1 origin: poc/src/systems/firing.ts  — frozen reference
 * Test file:    poc2/src/systems/firing-manager.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      Input → fire. Constructs and owns the active `Weapon` via the D02
 *            registry seam (D12): FiringManager consumes the registry, never owns
 *            it. Cyclic + selector switch. Energy gate via D03. Applies `fireRateMul`
 *            from C03 into weapon mods. `isPressed('fire')` (Space, RT, left-click, or
 *            touch Fire) fires; `consumePress('switchWeapon')` (F, LB, wheel, or touch)
 *            switches. Bomb / switchBomb use the same port; the bomb device is §7.
 *            Does not rumble Laser pulses (Q13).
 * Does not own: weapon catalog/registry (D02), energy pool arithmetic (D03), shot
 *            pools (E04), collision (F01), hull math (C03 — only reads fireRateMul),
 *            haptics (F05).
 * Player-facing: holding Space or RT shoots; F or LB cycles weapons without stalling
 *            fire; empty Energy clicks dry; a wounded hull shoots slower (SHIP-12).
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-A01 Balancer     — fireKey Space, switchKey KeyF, loadout, gamepad buttons
 *   SDD-A02 Input        — isPressed('fire'); consumePress('switchWeapon' | 'bomb' | 'switchBomb')
 *   SDD-C01 Ship         — muzzle / position
 *   SDD-C03 ShipHealth   — modifiers.fireRateMul
 *   SDD-D02 Weapon+Laser — registry, Weapon.update(ctx)
 *   SDD-D03 EnergyManager — EnergyPort canAfford/spend
 *   SDD-F01 CollisionManager — targets list for beam/cone queries
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-G03 RunScene — wires input/ship/energy/health/registry
 *   SDD-G07 HUD      — active weapon chip
 *   SDD-G08 Debugger — weapon selector
 */

// ─── 9. Agent sign-off ───────────────────────────────────────────────────────
/**
 * Orchestrator : hub-v4.2 / 2026-08-17  isPressed fire/switch, D18
 * Programming  : hub-v4.2 / 2026-08-17  D12 consume-registry, no fireLaser rumble
 * Game Design  : hub-v4.2 / 2026-08-17  Space/RT hold, F/LB edge
 * TDD          : hub-v4.2 / 2026-08-17  cases named; test file not yet written (red next)
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
 * Lib: none — behavior wiring; Three.js vectors only (muzzle scratch).
 * D12: adding a weapon = 1 catalog entry + 1 registry entry. This class is not edited.
 */

export type WeaponId = 'laser' | 'plasma' | 'beam' | 'mjolnir'

export interface InputPort {
  isDown(code: string): boolean
  isPressed(action: 'fire' | 'switchWeapon' | 'bomb' | 'switchBomb'): boolean
  consumePress(action: 'fire' | 'switchWeapon' | 'bomb' | 'switchBomb'): boolean
}

export interface EnergyPort {
  canAfford(cost: number): boolean
  spend(cost: number): void
}

export interface FireRateMulPort {
  readonly modifiers: { readonly fireRateMul: number }
}

export interface MuzzlePort {
  readonly position: { x: number; y: number; z: number }
}

export interface WeaponModifiers {
  damageMul: number
  rateMul: number
  energyMul: number
  critChance: number
  pulses: number
  aoeMul: number
  beamWidthMul: number
  coneMul: number
}

export interface BehaviourCtx {
  dt: number
  holding: boolean
  muzzle: { x: number; y: number; z: number }
  services: { energy: EnergyPort; targets: readonly unknown[] }
  mods: WeaponModifiers
}

export interface WeaponPort {
  readonly id: WeaponId
  readonly config: { readonly muzzleOffset: { x: number; y: number; z: number } }
  update(ctx: BehaviourCtx): void
  dispose(): void
}

export interface WeaponRegistryPort {
  create(id: WeaponId): WeaponPort
}

export interface FiringManagerOptions {
  readonly input: InputPort
  readonly ship: MuzzlePort
  readonly energy: EnergyPort
  readonly health: FireRateMulPort
  readonly registry: WeaponRegistryPort
  readonly targets: readonly unknown[]
  readonly loadout: readonly WeaponId[]
  readonly fireKey: string
  readonly switchKey: string
}

export declare class FiringManager {
  constructor(options: FiringManagerOptions)

  readonly mods: WeaponModifiers
  activeId(): WeaponId
  weapon(): WeaponPort
  setActive(id: WeaponId): void
  cycleWeapon(): void
  update(dt: number): void
  dispose(): void
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   field      | type     | meaning / unit / range
 *   -----------|----------|-----------------------
 *   mods       | WeaponModifiers | rateMul overwritten each update from C03
 *   loadout    | WeaponId[] | BALANCE.weapons.loadout; F/LB cycles this, not the full catalog
 *
 *   update — edge-detect isPressed('switchWeapon') (was-up, now-down) → cycleWeapon.
 *            muzzle = ship.position + weapon.config.muzzleOffset (scratch vec, no alloc).
 *            mods.rateMul = health.modifiers.fireRateMul.
 *            weapon.update({ dt, holding: isPressed('fire'), muzzle, services, mods }).
 *            Energy gate is inside the behaviour via EnergyPort — this class does not
 *            duplicate canAfford, but must pass the port (WPN-05).
 *   setActive / cycleWeapon — dispose previous Weapon, registry.create(next). D12.
 *   dispose — weapon.dispose().
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. isPressed('fire') while holding calls weapon.update with holding=true
 *       (Space and RT both satisfy this via A02).
 *   R2. isPressed('switchWeapon') edge-triggers cycleWeapon; holding F/LB does
 *       not spin the loadout.
 *   R3. cycleWeapon / setActive dispose the previous Weapon and create via registry.
 *   R4. setActive ignores ids not in loadout; does not throw.
 *   R5. Each update writes mods.rateMul from C03 fireRateMul (SHIP-12). No other
 *       module writes rateMul during fire.
 *   R6. EnergyPort is the only spend path; at 0 energy the behaviour must not
 *       acquire shots (WPN-05). FiringManager still calls update (no early return
 *       that would stall regen-adjacent behaviour).
 *   R7. Switching does not skip a fire window beyond the new weapon's own rate
 *       (WPN-03 — no extra cooldown invented here).
 *   R8. Memory: one Weapon at a time. Muzzle vec is an instance field. Per-frame
 *       allocation: none.
 *   R9. Does not own the D02 registry or catalog (D12).
 *   R10. Does not call CollisionManager.update — E04/F01 own that (POC-1 firing.ts
 *        did; this is the deliberate split).
 *   R11. loadout of length 1: switch is a no-op.
 *   R12. Does not call rumble('fireLaser') for Laser (Q13).
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      N/A — no visual
 * Inheritance: N/A (pure logic)
 * syncRender writes: N/A (Weapon/Laser own bolt visuals via D01)
 * Never writes: ship transform, energy.current, hull hp
 * Scene ownership: RunScene constructs FiringManager; Weapon may add bolts via E04
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 * Port from POC-1 / A01 — do not retune:
 *   BALANCE.gameplay.fireKey            = 'Space'   // A02 maps to action 'fire'
 *   BALANCE.gameplay.switchKey          = 'KeyF'    // A02 maps to action 'switchWeapon'
 *   BALANCE.controls.gamepad.buttons.fire          = 7  // RT
 *   BALANCE.controls.gamepad.buttons.switchWeapon  = 4  // LB
 *   BALANCE.weapons.loadout             = ['laser', 'plasma']   // WPN-03 this pass
 *   BALANCE.gameplay.energy             = { start: 100, max: 100, regenPerSec: 8 }
 *   BALANCE.ship.health.fireRateMul     = [1, 0.9, 0.75, 0.55]  // hull 0/1/2/3
 *   Laser catalog (D02): rate 8, energyPerShot 0.25, damage 1
 *
 * Feel:      POC-1 firing is the law. Space **or RT** is continuous hold-to-fire, not tap.
 *            F **or LB** is a clean swap — the next weapon speaks immediately at its own
 *            cadence. Hull degradation is felt as a slower stream, not a jam.
 * Leveling:  weapon level is D02 LASER_LEVELS; hull level is C03. This card only
 *            multiplies rate. Energy cost is D03 × catalog.
 * Graphics:  N/A
 * Pillars:   1 visible risk (dry energy) · 2 tangible degradation (slow fire) · 5 loop.
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/systems/firing-manager.test.ts
 * Runner: vitest
 * Mocks: InputPort, EnergyPort, FireRateMulPort, WeaponRegistryPort, MuzzlePort,
 *        BALANCE gameplay/loadout keys
 *
 * describe('FiringManager')
 *   it('holding Space calls weapon.update with holding true')                         // R1, SHIP-03
 *   it('holding RT (isPressed fire) calls weapon.update with holding true')           // R1, D18
 *   it('KeyF edge cycles the loadout once per press')                                 // R2, WPN-03
 *   it('LB edge cycles the loadout once per press')                                   // R2, D18
 *   it('does not call rumble fireLaser on a Laser pulse')                             // R12, Q13
 *   it('cycleWeapon disposes the previous weapon and registry.creates the next')      // R3
 *   it('setActive ignores an id outside the loadout')                                 // R4
 *   it('copies health.modifiers.fireRateMul into mods.rateMul every update')          // R5, SHIP-12
 *   it('passes EnergyPort into ctx.services; empty energy still calls update')        // R6, WPN-05
 *   it('a fake behaviour acquires no shot when canAfford is false')                   // R6, WPN-05
 *   it('switch does not apply an extra cooldown (next weapon.update is immediate)')   // R7, WPN-03
 *   it('reuses one muzzle scratch object across updates')                             // R8
 *   it('does not register weapons on the registry (D12 consume-only)')                // R9
 *   it('does not call CollisionManager.update')                                       // R10
 *   it('switch is a no-op when loadout length is 1')                                  // R11
 *   it('Space fires, F switches, energy gate, damaged hull slows cadence (acceptance)')
 *
 * Port fidelity (class-ify):
 *   it('fireKey/switchKey default to Space and KeyF like POC-1 firing.ts')            // port
 *   it('muzzle = ship.position + config.muzzleOffset')                                // port
 *
 * Manual:
 *   A-manual-1. [manual] hull level 3 fire stream is obviously slower than level 0
 *
 * Coverage: R1–R12 + WPN-03 + WPN-05 + SHIP-03 + SHIP-12 + SHIP-13 + card Acceptance + port.
 */
