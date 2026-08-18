/**
 * SDD + TDD spec template (POC2 only).
 *
 * Copy to `.docs/specs/{subject}.spec.ts` and fill every section.
 * This file is a design artifact: it is NOT compiled or imported by `poc2/`.
 *
 * Pipeline (hub §6.3, D17):
 *   1. Orchestrator  — header, scope, requires, DoD
 *   2. Programming   — contract, fields, memory/lifecycle, syncRender
 *   3. Game Design   — BALANCE, feel, leveling, graphics
 *   4. TDD           — executable cases; write the failing test file BEFORE code
 *
 * Rules:
 *   - One spec per SDD card. Filename = kebab-case subject (`ship-health.spec.ts`).
 *   - Copy every section. "N/A" is valid. Empty is not.
 *   - Interfaces here ARE the signatures the implementation must expose.
 *   - Tests live in `poc2/src/**/{subject}.test.ts`. Specs stay in `.docs/specs/`.
 *   - Never open a spec or a PR against `poc/` (frozen).
 *
 * #tag/arch  (+ domain tags of the card)
 *
 * Card:         SDD-{stage}{nn} {Subject}
 * Hub:          .docs/plans/planning.spec.MD §5 (card) · §6.1 (DoD) · §6.3 (agents)
 * Requirements: {SHIP-nn, WPN-nn, ...}
 * Change type:  port | class-ify | split | merge | new
 * POC-1 origin: poc/src/{path}  OR  none (new)   — reference only, not a workstream
 * Test file:    poc2/src/{folder}/{subject}.test.ts
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Orchestrator
// ═════════════════════════════════════════════════════════════════════════════

// ─── 1. Scope ────────────────────────────────────────────────────────────────
/**
 * Owns:      {single concern, two or three sentences}
 * Does not own: {what, owned by SDD-...}
 * Player-facing: {what the player notices if this is wrong — or N/A}
 */

// ─── 8. Requires ─────────────────────────────────────────────────────────────
/**
 * Must match the card. A mismatch is a documentation bug.
 *
 * Upstream (must exist before this starts):
 *   SDD-A01 Balancer — {what is consumed}
 *
 * Downstream (who breaks if this contract changes):
 *   SDD-... — consumes {what}
 */

// ─── 9. Agent sign-off ───────────────────────────────────────────────────────
/**
 * Orchestrator : {name / date}  scope, requires, DoD, todo.md
 * Programming  : {name / date}  contract, memory, THREE / view
 * Game Design  : {name / date}  BALANCE, feel, leveling, graphics
 * TDD          : {name / date}  cases named; test file written red
 *
 * DoD (§6.1): spec · tests red · shape · lifecycle · BALANCE · memory ·
 *             IDs · verify green · port fidelity
 * Status: draft | spec-complete | tests-red | implemented | done
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Programming / Three.js
// ═════════════════════════════════════════════════════════════════════════════

// ─── 2. Contract ─────────────────────────────────────────────────────────────
/**
 * Public surface. Ports first, then the class. Constructor dependencies explicit.
 * No service locators. No globals besides BALANCE.
 * `extends THREE.X` when the domain object *is* its visual (hub §4).
 */

/** Port consumers depend on — not the class. */
export interface SubjectPort {
  update(dt: number): void
  dispose(): void
}

/** Construction data. Every number traces to BALANCE. */
export interface SubjectOptions {
  readonly example: number
}

export declare class Subject implements SubjectPort {
  constructor(options: SubjectOptions)

  /** Logic only. No GPU work. */
  update(dt: number): void

  /** Reads logic, writes transforms / opacity / material only. */
  syncRender(): void

  /** Frees every geometry, material, texture, DOM node, listener this class created. */
  dispose(): void
}

// ─── 3. Key fields and methods ───────────────────────────────────────────────
/**
 *   field       | type   | meaning / unit / range
 *   ------------|--------|-----------------------
 *   ...         | ...    | ...
 *
 * Non-obvious methods — pre/post conditions, one line each.
 */

// ─── 5. Rules and invariants ─────────────────────────────────────────────────
/**
 * Testable statements. TDD turns each Rn into a case.
 *
 *   R1. ...
 *   R2. Memory: pooled | created-once | dispose must reach {list}
 *   R3. Per-frame allocation: none | {exception}
 */

// ─── 6. View / syncRender ────────────────────────────────────────────────────
/**
 * Visual:      THREE.{Mesh|Group|Points|LineLoop|N/A} · geometry · material · blending · colour source
 * Inheritance: extends THREE.{X} | composition | N/A (pure logic)
 * syncRender writes: {position, rotation.z, material.opacity, scale — list them}
 * Never writes: {state that belongs to update()}
 * Scene ownership: added/removed by {Ship | Manager | RunScene | pool} (D14)
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: Game Design
// ═════════════════════════════════════════════════════════════════════════════

// ─── 4. BALANCE, feel, leveling, graphics ────────────────────────────────────
/**
 * Every number this module reads, by path in `src/core/balancer.ts`, with the
 * starting value AND why. If a number is not here it must not appear in code (RUL-12).
 * New sections are declared here and added to SDD-A01.
 *
 *   BALANCE.{section}.{key}  =  {value}   // why / feel
 *
 * Feel:      {what the player should feel; compare to POC-1 if port/class-ify/merge}
 * Leveling:  {how this scales with weapon level / hull level / kill count — or N/A}
 * Graphics:  {silhouette, palette, <0.3s read, opacity/decay as readable damage — or N/A}
 * Pillars:   {which of the 6 design pillars this card serves}
 */

// ═════════════════════════════════════════════════════════════════════════════
// AGENT: TDD
// ═════════════════════════════════════════════════════════════════════════════

// ─── 7. Acceptance → executable cases ────────────────────────────────────────
/**
 * Protocol: write `{subject}.test.ts` FIRST. `npm run test` must FAIL for the
 * named cases (red). Programming then implements until green. TDD re-runs
 * `npm run verify`. Do not implement production logic in the TDD agent.
 *
 * File: poc2/src/{folder}/{subject}.test.ts
 * Runner: vitest (`npm run test` in poc2/)
 * Mocks: {BALANCE slice, THREE stubs, clocks — list them}
 *
 * describe('{Subject}')
 *   it('{R1 — invariant in one sentence}')           // maps R1
 *   it('{R2 — ...}')                                 // maps R2
 *   it('{acceptance line as a predicate}')           // maps card Acceptance
 *   it('{port fidelity vs POC-1 numbers}')           // port/class-ify/merge only
 *   it('{dispose frees resources / pool does not grow}')
 *
 * Manual (named, not skipped silently):
 *   A-manual-1. [manual] {play-check that needs a human}
 *
 * Coverage rule: every R{n} in §5 and every Acceptance bullet has a case or a
 * named [manual] line.
 */
