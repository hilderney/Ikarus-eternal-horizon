# Ikarus: Eternal Horizon — POC2

The active build. POC2 grows the tuned prototype into a codebase that expands **by adding modules**, not by piling responsibilities onto existing files.

**Planning hub (source of truth):** [`.docs/plans/planning.spec.MD`](../.docs/plans/planning.spec.MD) — canonical names, requirement index (§3.5), SDD cards in build order (§5), Definition of Done (§6.1).
**Architecture contract:** [`.docs/phases/phase-0-poc2.md`](../.docs/phases/phase-0-poc2.md).
**Behavior reference:** [`poc/README.md`](../poc/README.md) — POC-1, frozen. Camera, parallax, limit-box, ship feel and the four weapons are **ported without behavior change**; that document is the tuning contract.
**Backlog:** [`todo.md`](./todo.md) — one entry per SDD card.

**Stack:** TypeScript · Vite · Three.js. Yuka joins at `SDD-E01` (enemy steering), Howler post-G1 (audio). No library is installed before the card that needs it.

---

## How to run

```bash
npm install
npm run dev        # Vite dev server
npm run build      # tsc + vite build -> dist/
npm run preview    # preview the production build

npm run typecheck  # tsc --noEmit
npm run lint       # eslint src
npm run test       # vitest run
npm run verify     # all three — the gate every card must pass (hub §6.1)
```

`npm run verify` is green on an empty scaffold, so it stays a real signal from the first card onward.

---

## State

**Stage A is done** (Balancer, Input, Math, GameLoop, ObjectPool). Next slice is **`SDD-B01` Camera**. `src/main.ts` is still a walking skeleton until G01/G03. Follow the build order in the hub §5 / the graph in §10.

---

## The rules that make this project different from POC-1

POC-1 was a flat spike of factory functions. POC2 follows the **pattern constructor** — decision `D11` in the hub:

1. **`interface` + `class` + module.** One concern per class, one public class per file, `kebab-case.ts` named after the class, dependencies injected in the constructor. No barrel files.
2. **Extend Three.js, don't hide it.** `Ship extends THREE.Group`; `Enemy` / `Shot` / `Meteor` extend `THREE.Mesh`; the camera class mounts its `PerspectiveCamera`. Local classes import straight into the scene graph — no mesh-factory layer.
3. **Model/View by structure.** `update(dt)` runs logic only. `syncRender()` is the single bridge: it reads logic state and writes *only* transforms, opacity and material. Rendering never invents state; logic never does GPU work.
4. **`dispose()` on every destruction.** Every geometry, material, texture, DOM node and listener a class creates, it frees. Destruction without `dispose()` is a bug.
5. **Zero per-frame allocation in hot paths.** Anything spawned during a frame comes from `ObjectPool<T>` (`SDD-A05`).
6. **`BALANCE` is the only source of numbers** (`src/core/balancer.ts`). A gameplay constant outside it is a code smell — and `RUL-12` failing.
7. **Collision is data.** The layer mask matrix in `systems/layers.ts` decides who hits whom; never add a `can-hit` branch in code.
8. **Events over back-references.** `DamageResolver` emits; HUD, VFX and RunState listen. A system never reaches upward into its consumer.
9. **English everywhere** — code, comments, commits, docs, backlog.

---

## Folder tree

Mirrors [`phase-0-poc2.md`](../.docs/phases/phase-0-poc2.md) §8. Folders carry a `.gitkeep` until their first card lands.

```
poc2/
  index.html                     # three-area shell: area-inputs · game-area · debugger-area
  vite.config.ts                 # base './' — relative paths for Itch (RUL-08)
  eslint.config.js               # named-exports-only, type-imports, strict equality
  vitest.config.ts               # src/**/*.test.ts
  src/
    main.ts                      # bootstrap (walking skeleton until SDD-G01/G03)
    style.css                    # three-area layout, ≤760px collapse
    core/                        # balancer · input · math · loop            (A01-A04)
    pools/                       # object-pool                                (A05)
    gameobjects/
      camera/  parallax/  limit-box/  gizmos/                                (B01-B04)
      ship/         # ship · ship-health                                     (C01, C03)
      controller/   # player-controller · camera-controller                   (C02)
      weapon/       # weapon · catalog · registry · laser-levels · behaviours (D02, D04-D06)
      shot/         # weapon-shot · enemy-shot · bomb-shot                    (D01, E03)
      enemy/  meteor/                                                        (E01, E02)
      equipment/  bomb/          # reserved (§7)
    systems/                     # managers: energy · shot · enemy · meteor · firing
                                 # collision · drop · difficulty · damage-resolver
                                 # vfx · run-state · score                    (D03, E04-E07, F01-F05, G10)
    scenes/                      # scene-controller · title · run · result · rankings · pause
                                 #                                           (G01-G05, G11)
    ui/                          # areas · hud · debugger/                    (G06-G08)
    render/                      # renderer                                   (G09)
    audio/                       # reserved (post-G1, Howler)
    assets/                      # reserved
```

---

## Adding a card

1. Orchestrator: spec at `.docs/specs/{subject}.spec.ts` from [`_template.spec.ts`](../.docs/specs/_template.spec.ts) — Stage A–G specs already exist.
2. Programming fills contract / memory / view. Game Design fills BALANCE / feel / leveling / graphics. TDD names cases.
3. Confirm every `requires` entry is checked in [`todo.md`](./todo.md).
4. **TDD writes `{subject}.test.ts` first** — `npm run test` must fail for the right reason.
5. Programming implements until green. TDD re-runs `npm run verify`. Orchestrator ticks §6.1.

Agent rules: hub §6.3 and [`.cursor/rules/poc2-sdd-agents.mdc`](../.cursor/rules/poc2-sdd-agents.mdc).

For a `port` / `class-ify` / `merge` card (hub §5.0), "done" also means POC2 reproduces POC-1's observable behavior with the same `BALANCE` numbers. Run both side by side.
