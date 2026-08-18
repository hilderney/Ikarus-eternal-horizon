/**
 * SDD spec template — copy to `.docs/specs/{subject}.spec.ts` and fill in.
 *
 * #tag/arch  (+ the domain tags of the card)
 *
 * A spec is a design artifact, not shipped code: it is not compiled or imported by
 * `poc2/`. It exists so the contract is agreed *before* the class is written, and so a
 * reviewer can check the implementation against something other than the author's memory.
 *
 * Rules for writing one:
 *   - One spec per SDD card. Filename is the kebab-case subject (`ship-health.spec.ts`).
 *   - Copy the eight sections below in order; delete none of them. "N/A" is a valid answer,
 *     an empty section is not.
 *   - Interfaces here are the real signatures the implementation must expose. If the
 *     implementation needs to diverge, the spec is edited first.
 *   - Cite the card ID and every requirement ID from the card's `Maps:` line.
 *
 * Card:        SDD-{stage}{nn} {Subject}
 * Hub:         .docs/plans/planning.spec.MD §5 (card) · §6.1 (Definition of Done)
 * Requirements: {SHIP-nn, WPN-nn, ...}
 * Change type: port | class-ify | split | merge | new     (hub §5.0)
 * POC-1 origin: poc/src/{path} — or "none (new)"
 * Author / date: {name} / {YYYY-MM-DD}
 */

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * What this module owns, in two or three sentences. State the single concern.
 * Then state explicitly what it does NOT own, and which card owns that instead —
 * boundary mistakes are the expensive kind.
 *
 * Owns:      ...
 * Does not own: ... (owned by SDD-...)
 */

// ─── 2. Contract ─────────────────────────────────────────────────────────────
/**
 * The public surface. Ports this module implements or consumes come first, then the
 * class shape. Constructor dependencies are explicit — no service locators, no globals
 * beyond BALANCE.
 */

/** A port this module implements, so consumers depend on the interface, not the class. */
export interface SubjectPort {
  update(dt: number): void
  dispose(): void
}

/** Data handed in at construction. Everything numeric here traces back to BALANCE. */
export interface SubjectOptions {
  readonly example: number
}

/** The class shape. `extends THREE.X` when the domain object *is* its visual (hub §4). */
export declare class Subject implements SubjectPort {
  constructor(options: SubjectOptions /*, injected dependencies */)

  /** Logic only: movement, timers, damage, AI. No GPU work. */
  update(dt: number): void

  /** The only bridge to rendering: reads state, writes transforms/opacity/material. */
  syncRender(): void

  /** Frees every geometry, material, texture, DOM node and listener this class created. */
  dispose(): void
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 * The state that matters and why it exists. One line each. Include units and ranges —
 * "speed: units/s, capped at BALANCE.x.maxSpeed" beats "speed: number".
 *
 *   field       | type   | meaning / unit / range
 *   ------------|--------|-----------------------
 *   ...         | ...    | ...
 *
 * And the non-obvious methods, with their pre/post conditions.
 */

// ─── 4. BALANCE data ─────────────────────────────────────────────────────────
/**
 * Every number this module reads, by its path in `src/core/balancer.ts`, with the value
 * it starts at. If a number is not here, it must not appear in the implementation (RUL-12).
 * New sections needed by this card are declared here and added to SDD-A01.
 *
 *   BALANCE.{section}.{key}  =  {value}   // what it tunes
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 * The statements that must hold at all times, written so a reviewer can test each one.
 * These are the things a future change is most likely to break.
 *
 *   R1. ...
 *   R2. ...
 *
 * Include the memory rules that apply: what is pooled, what is created once, what
 * `dispose()` must reach.
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * What the visual is (geometry, material, blending, colour source) and exactly which
 * properties `syncRender()` writes. Nothing else may be written there.
 *
 * Visual:      ...
 * syncRender writes: position, rotation.z, material.opacity, scale — list them.
 * Never writes: ... (state that belongs to update())
 *
 * "N/A — no visual" is a valid answer for systems and managers.
 */

// ─── 7. Acceptance ───────────────────────────────────────────────────────────
/**
 * The card's Acceptance line, expanded into checks a second person can run. Mark each
 * as automated or manual; automated ones name the test file.
 *
 *   A1. [test: {subject}.test.ts] ...
 *   A2. [manual] ...
 *
 * For a port/class-ify/merge card, one check must be the side-by-side comparison against
 * POC-1 with identical BALANCE numbers.
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Upstream cards that must exist before this one starts, and what is consumed from each.
 * This must match the card's `Requires:` line in the hub; a mismatch is a documentation bug.
 *
 *   SDD-A01 Balancer  — the {section} config block
 *   SDD-A03 Math      — clamp, damp, scratch vectors
 *
 * Downstream consumers (informative — who breaks if this contract changes):
 *   SDD-... — consumes {what}
 */
