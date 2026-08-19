/**
 * #tag/arch #tag/energy
 *
 * Card:         SDD-D03 EnergyManager
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: SHIP-09, WPN-05, SHIP-08 (dash spends this pool; dedicated jet reserve later)
 * Change type:  class-ify
 * POC-1 origin: poc/src/systems/energy.ts  — frozen reference
 * Test file:    poc2/src/systems/energy-manager.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      The shared Energy pool { current, max, regenPerSec }. Ports
 *            canAfford / spend / update(regen). Every weapon and C02 dash
 *            draws from this one pool.
 * Does not own: fire input (E07), weapon cadence (D02+), HUD bar (G07),
 *            BALANCE numbers (A01). No visual of any kind.
 * Player-facing: the Energy bar dropping per shot/second and refusing fire
 *            at 0. Wrong regen makes weapons feel free or starved.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-A01 Balancer — BALANCE.gameplay.energy { start, max, regenPerSec }
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-D02 Weapon / Laser — canAfford/spend per shot (this pass)
 *   SDD-D04 Plasma         — canAfford/spend per orb (this pass)
 *   SDD-D05 Beam           — canAfford/spend per second (G2)
 *   SDD-D06 Mjolnir        — canAfford/spend per second (G2)
 *   SDD-E07 FiringManager  — injects EnergyPort into BehaviourCtx
 *   SDD-C02 PlayerController — dash spend on successful snap (L1–L12)
 *   SDD-G07 HUD            — reads current/max
 *   SHIP-08 jet            — dedicated reserve still later; dash uses this pool
 */

// ─── 9. Agent sign-off ───────────────────────────────────────────────────────
/**
 * Orchestrator : hub-v4.3 / 2026-08-18  unchanged port; D02/D04 consume EnergyPort
 * Programming  : hub-v4.3 / 2026-08-18  no THREE; HUD reads current/max on the class
 * Game Design  : hub-v4.3 / 2026-08-19  100/100/8; laser L1 cost 1 vs regen 8 is even
 * TDD          : hub-v4.3 / 2026-08-19  pool bind + recovering gate green
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
 * Public surface. Ports first, then the class. Constructor dependencies explicit.
 * No service locators. No globals besides BALANCE.
 * Pure arithmetic — no THREE.
 */

export interface EnergyPort {
  canAfford(cost: number): boolean
  spend(cost: number): void
}

export interface EnergyPool {
  current: number
  max: number
}

export interface EnergyConfig {
  readonly start: number
  readonly max: number
  readonly regenPerSec: number
}

export interface EnergyManagerOptions {
  readonly config: EnergyConfig
  readonly pool?: EnergyPool
  readonly canRegen?: () => boolean
}

export declare class EnergyManager implements EnergyPort {
  constructor(options: EnergyManagerOptions)

  readonly current: number
  readonly max: number
  readonly regenPerSec: number

  /** true iff current >= cost. cost ≤ 0 is always affordable. */
  canAfford(cost: number): boolean

  /** current = max(0, current - cost). Does not clamp above max. */
  spend(cost: number): void

  /** current = min(max, current + regenPerSec * dt) when canRegen() is true. */
  update(dt: number): void

  dispose(): void
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   field         | type   | meaning / unit / range
 *   --------------|--------|-----------------------
 *   current       | number | 0..max; start at config.start
 *   max           | number | BALANCE.gameplay.energy.max
 *   regenPerSec   | number | energy / second while not spent this frame
 *
 * Non-obvious:
 *   canAfford does not spend. Behaviours must check then spend (no rollback).
 *   spend of more than current floors at 0 (no negative energy).
 *   spend starts a recoveringMs delay (BALANCE.ship.cooldowns.recoveringMs).
 *   Regen runs only when that delay is 0 and canRegen() is true (recovering).
 *   Fire-blocked-at-0 is a canAfford(cost) false when current < cost, which
 *   at current === 0 is true for any cost > 0. This class does not know about
 *   weapons; E07/D02 ask the port.
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 *   R1. Implements EnergyPort { canAfford, spend }.
 *   R2. Constructor sets current = start, which equals max in the starting BALANCE.
 *   R3. canAfford(cost) is current >= cost. Never throws.
 *   R4. spend subtracts cost and clamps to [0, +∞) from below only.
 *   R5. update regenerates regenPerSec * dt, clamped to max, only when
 *       the recoveringMs delay is 0 and canRegen() is true (default always;
 *       run binds ship.status.recovering). spend starts that delay.
 *   R6. current never exceeds max and never goes below 0.
 *   R7. At current === 0, canAfford(any positive cost) is false — fire blocks.
 *   R8. Memory: no GPU. Per-frame allocation: none.
 *   R9. No visual, no HUD writes, no THREE imports.
 *   R10. Optional pool is the C01 stats.energy object; spend/update write through it.
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      N/A — no visual
 * Inheritance: N/A (pure logic)
 * syncRender writes: N/A
 * Scene ownership: N/A
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 *   BALANCE.gameplay.energy.start       = 100
 *   BALANCE.gameplay.energy.max         = 100
 *   BALANCE.gameplay.energy.regenPerSec = 8
 *
 * Starting loadout drain (for feel, not this class's table):
 *   Laser L1: 1 per volley × 8/s  = 8/s  — regen 8 is break-even
 *   Plasma : 1.5 per orb  × 1.6/s ≈ 2.4/s — still comfortable
 *   Beam   : 3/s                       — noticeable; dump-and-pause
 *   Mjolnir: 2.2/s                     — between laser L1 and beam
 *
 * Feel:      Energy is a pacing resource, not a hard magazine. Laser L1 is
 *            break-even vs regen 8; higher laser levels dump the pool.
 *            Beam/Mjolnir force bursts. Hitting 0 is a silence, not a crash —
 *            regen of 8 brings an L1 volley back in 0.125 s.
 * Leveling:  N/A here. Weapon energyPerShot/PerSec live in D02 catalog;
 *            hull fireRateMul (C03) changes cadence, not this pool.
 * Graphics:  N/A. G07 draws the bar.
 * Pillars:   1 visible risk (the bar); WPN-05 cost-per-config.
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * File: poc2/src/systems/energy-manager.test.ts
 * Runner: vitest
 * Mocks: BALANCE.gameplay.energy slice — no THREE
 *
 * describe('EnergyManager')
 *   it('implements EnergyPort with canAfford and spend')                           // R1
 *   it('starts at current = max = 100')                                            // R2, POC-1
 *   it('exposes regenPerSec = 8')                                                  // R5, POC-1
 *   it('canAfford returns true when current >= cost and false otherwise')          // R3
 *   it('spend subtracts cost and never goes below 0')                              // R4, R6
 *   it('update regenerates 8 per second clamped to max')                           // R5
 *   it('canAfford(0.25) is false when current is 0')                               // R7, WPN-05
 *   it('canAfford(0) is true even at current 0')                                   // R3
 *   it('update/spend allocate no objects')                                         // R8
 *   it('module does not import three')                                             // R9
 *   it('spend and regen write through the bound C01 energy pool')                  // R10
 *   it('spend starts recoveringMs delay before regen')                             // R5, C01 cooldowns
 *   it('update skips regen when canRegen is false')                                // R5
 *
 * Manual:
 *   A-manual-1. [manual] laser drain is visible on the HUD bar (G07)
 *   A-manual-2. [manual] at 0, holding fire produces no shots until regen covers cost
 *
 * Coverage: R1–R9 + card Acceptance (laser drains; 0 blocks fire).
 */
