# POC2 backlog — one entry per SDD card

> **Derived, not authored.** Every entry below is a card in [`.docs/plans/planning.spec.MD`](../.docs/plans/planning.spec.MD) §5. The card text is the task body; this file is only the order and the state. If a card changes, the hub changes first.
>
> **Entry format:** `SDD-{id} {Subject} — {requirement IDs} — requires {cards} — {change type}`
> **Change types** (hub §5.0): `port` · `class-ify` · `split` · `merge` · `new`
> **Order is a gate:** never open an entry whose `requires` list still has an unchecked box.
> **Done means** the §6.1 Definition of Done checklist passes, not "the code runs".

**Definition of Done, short form** (full text in the hub §6.1): spec written first · `interface` + `class` in a `kebab-case.ts` file · `update`/`syncRender`/`dispose` respected · every number from `BALANCE` · nothing allocated per frame · requirement IDs cited · `npm run verify` green · port fidelity against POC-1.

---

## Stage 0 — Scaffold

- [x] Folder tree per `phase-0-poc2.md` §8, configs (`tsconfig`, `vite`, `eslint`, `vitest`), three-area `index.html`, walking-skeleton `main.ts`
- [x] `npm run verify` and `npm run build` green, `dist/` emitting relative paths (`RUL-08` precondition)

---

## Stage A — Core & Pools

- [ ] **SDD-A01 Balancer** — `RUL-12` — requires — — `port` (+ type each section as an interface)
      `src/core/balancer.ts`. Add the new sections POC-1 never had: `ship.health`, `difficulty`, `score`, `drops`, `vfx`.
- [ ] **SDD-A02 Input** — `SHIP-01`, `SHIP-04` (Q07) — requires — — `class-ify`
      `src/core/input.ts` → `InputState`. Keep the `preventDefault` list, `blur` reset and synthetic `Shift+KeyX` combos.
- [ ] **SDD-A03 Math** — all, `RUL-13` — requires — — `new`
      `src/core/math.ts`. Extract `clamp`/`lerp`/`damp`/`DEG2RAD`/`distXZ`/`decayFactor` and the scratch vectors currently inlined in POC-1's `parallax`, `followCamera` and `shot`.
- [ ] **SDD-A04 GameLoop** — `RUL-01`, `RUL-13` — requires — — `split`
      `src/core/loop.ts` → `GameLoop`. Lift the rAF block out of POC-1's `main.ts`; add the pause gate `G11` needs and the ~15 Hz debugger sync sidecar.
- [ ] **SDD-A05 ObjectPool\<T\>** — `WPN-01`, `ENM-02`, `RES-03`, `RUL-13` — requires — — `split`
      `src/pools/object-pool.ts`. Generalise the `ShotPool` embedded in POC-1's `gameobjects/shot.ts`.

## Stage B — World dressing

- [ ] **SDD-B01 Camera** — RUL render — requires A01, A03 — `class-ify`
      `gameobjects/camera/game-camera.ts` → `GameCamera`. `rotation.order = 'YXZ'`, `applyConfig`.
- [ ] **SDD-B02 Parallax** — RUL render — requires A01, A03, B01 — `split`
      `gameobjects/parallax/` → `ParallaxLayer` + `ParallaxField`. Reproduce gains `0.15 → 0.09 → 0.03`.
- [ ] **SDD-B03 LimitBox** — RUL camera — requires A01, A03, B01 — `merge` + `class-ify`
      `gameobjects/limit-box/limit-box.ts` → `LimitBox`, merging POC-1's `followBox.ts` + `followCamera.ts`. Edge bounce, auto-recenter, Recenter Point, per-axis interrupt.
- [ ] **SDD-B04 Gizmos** — dev tool — requires A01, B01 — `class-ify`
      `gameobjects/gizmos/gizmos.ts`. World axes, playfield grid, camera axes; toggleable (Q09).

## Stage C — Player craft

- [ ] **SDD-C01 Ship** — `SHIP-01`, `SHIP-03`, `SHIP-06`, `RES-05` — requires A01, A03 — `class-ify`
      `gameobjects/ship/ship.ts` → `Ship extends THREE.Group`. Hull/thruster/tip mounts, hardpoints, ordnance, equipment, inventory.
- [ ] **SDD-C02 Controller** — `SHIP-01`, `SHIP-04` (Q07) — requires A01, A02, A03, B01, C01 — `split`
      `gameobjects/controller/` → `PlayerController` + `CameraController`. Force motion, tilt/bank; reads the degradation multipliers from C03.
- [ ] **SDD-C03 ShipHealth** — `SHIP-02`, `SHIP-05`, `SHIP-12`, `RUL-10` — requires A01, A03, C01 — `new`
      `gameobjects/ship/ship-health.ts`. Force Field absorbs before Integrity, delayed slow shield regen, hull levels 0–3 with `speedMul`/`accelMul`/`fireRateMul` (Q08). Emits `DamageOutcome`.

## Stage D — Combat primitives

- [ ] **SDD-D01 WeaponShot** — `WPN-01`, `SHIP-03`, `RUL-02` — requires A01, A03, A05 — `class-ify`
      `gameobjects/shot/weapon-shot.ts` → `WeaponShot extends THREE.Mesh`. 25% decay steps on opacity *and* damage; thickness `2 × radius`.
- [ ] **SDD-D03 EnergyManager** — `SHIP-09`, `WPN-05` — requires A01 — `class-ify`
      `systems/energy-manager.ts` → `EnergyManager implements EnergyPort`.
- [ ] **SDD-D02 Weapon device + Laser** — `WPN-01`, `WPN-04`, `WPN-05`, `SHIP-03` — requires A01, A03, A05, D01, D03 — `port` + `class-ify`
      `gameobjects/weapon/` → `Weapon`, `WeaponBehaviour`, `catalog.ts`, `registry.ts` (seam `D12`), `laser-levels.ts` (L1–L10), `behaviours/laser.ts`.
- [ ] **SDD-D04 Plasma** — `WPN-03`, `WPN-04`, `WPN-05` — requires A05, D01, D02, D03, F01 — `class-ify`
      `gameobjects/weapon/behaviours/plasma.ts`. Slow orbs, AoE resolved once per detonation.
- [ ] **SDD-D05 Beam** — `WPN-04`, `WPN-05` — requires A03, D02, D03, F01 — `class-ify`
      `behaviours/beam.ts` + `beam-visual.ts`. Energy charged per second; DPS by hit query.
- [ ] **SDD-D06 Mjolnir** — `WPN-04`, `WPN-05` — requires A03, D02, D03, F01 — `class-ify`
      `behaviours/mjolnir.ts` + `cone-visual.ts`. Piercing cone, angle + distance test.

## Stage E — World & pressure

- [ ] **SDD-E01 Enemy** — `ENM-01`, `ENM-02` — requires A01, A03, A05, F01 — `new`
      `gameobjects/enemy/` → `Enemy extends THREE.Mesh`, pooled, drift toward the player. **Install Yuka here.** Retires POC-1's `testTarget.ts`.
- [ ] **SDD-E02 Meteor** — `ENM-04`, `RES-01` — requires A01, A03, A05, F01 — `new`
      `gameobjects/meteor/` → `Meteor extends THREE.Mesh`, hp by size, contact damage by size.
- [ ] **SDD-E03 EnemyShot** — `ENM-01`, `SHIP-05` — requires A05, D01, E01 — `new`
      `gameobjects/shot/enemy-shot.ts`, layer `EnemyShot`.
- [ ] **SDD-E04 ShotManager** — `WPN-01`, `RUL-02` — requires A05, D01, E03 — `new`
      `systems/shot-manager.ts`. Owns every projectile pool by origin.
- [ ] **SDD-E07 FiringManager** — `WPN-03`, `WPN-05`, `SHIP-03`, `SHIP-12` — requires A01, A02, C01, C03, D02, D03, F01 — `class-ify`
      `systems/firing-manager.ts`. Fire input, energy gate, weapon switch, `fireRateMul` from C03.
- [ ] **SDD-E05 EnemyManager** — `ENM-01`, `ENM-02`, `RUL-02` — requires A01, A03, A05, E01, F03 — `new`
      `systems/enemy-manager.ts`. Spawn schedule, patterns, pooling, despawn; Yuka steering orchestration.
- [ ] **SDD-E06 MeteorManager** — `ENM-04` — requires A01, A05, E02, F03 — `new`
      `systems/meteor-manager.ts`. Spawn, drift, fragmentation, lanes mixed with enemy waves.

## Stage F — Interaction

- [ ] **SDD-F01 Collision layers + CollisionManager** — `WPN-02`, `RUL-02` — requires A03, D01, E01, E02 — `class-ify` + extract matrix
      `systems/collision-manager.ts` + `layers.ts`. 6 layers frozen by `D13`; the matrix is data. Detects only — never applies damage.
- [ ] **SDD-F04 DamageResolver** — `WPN-02`, `SHIP-02`, `SHIP-05`, `RUL-13` — requires A01, C03, E01, E02, F01 — `new`
      `systems/damage-resolver.ts`. The only place a hit becomes damage; emits `shieldHit`/`hullHit`/`shieldBroke`/`killed`/`destroyed`.
- [ ] **SDD-F05 VfxManager** — `RUL-13` — requires A01, A03, A04, A05, F04 — `new`
      `systems/vfx-manager.ts`. Pooled wireframe bursts, hit flash, capped shake, hit-stop via the loop gate, hull vignette (Q11).
- [ ] **SDD-F02 DropManager** — `RES-01`, `RES-02`, `RES-03`, `RES-04`, `RES-05` — requires A01, A03, A05, C01, F01 — `new`
      `systems/drop-manager.ts`. Drop tables, magnet radius, inventory counts, stock caps.
- [ ] **SDD-F03 DifficultyManager** — `RUL-06`, `RUL-09`, `ENM-09` — requires A01, G10 — `new`
      `systems/difficulty-manager.ts`. Kill-driven ramp, milestones 50/100/500, pattern scaling past 500.

## Stage G — Presentation & meta

- [ ] **SDD-G09 Renderer** — `RUL-02`, `RUL-08` — requires A01, B01, C01 — `new`
      `render/renderer.ts`. `WebGLRenderer` + root scene, portrait 9:16, letterbox centering, resize.
- [ ] **SDD-G06 UI areas** — `RUL-08` — requires A01 — `port`
      `ui/areas.ts`. Assemble `area-inputs · game-area · debugger-area`; ≤760px collapse.
- [ ] **SDD-G10 RunState + ScoreManager** — `RUL-03`, `RUL-07`, `RUL-11`, `SHIP-02` — requires A01, A04, C03, F04 — `new`
      `systems/run-state.ts` + `score-manager.ts`. Kills, score, multipliers, run end, restart, local best (Q10). The only module that ends a run.
- [ ] **SDD-G07 HUD** — `RUL-03`, `SHIP-05`, `SHIP-06`, `SHIP-09`, `RES-02` — requires A01, B01, C01, C03, D03, G10 — `merge`
      `ui/hud.ts`. Force Field / Integrity / Energy bars, coordinate label, weapon chip, resource counters, border score/kills. One shared world→screen projector (POC-1 duplicated it).
- [ ] **SDD-G08 Debugger panel** — dev tool (Q09) — requires A01, G06 — `split`
      `ui/debugger/`. One module per tab (Cam / Ship / Limit Box / Parallax / Weapons); two-way ~15 Hz sync, Reset, laser level presets.
- [ ] **SDD-G11 PauseScene + Inventory** — `RUL-04`, `SHIP-06` — requires A02, A04, C01, G01, G06, G10 — `new`
      `scenes/pause-scene.ts`. Esc overlay gating the loop without disposing the Run; read-only inventory; Resume/Restart/Quit.
- [ ] **SDD-G01 SceneController** — `RUL-01`, `RUL-03`, `RUL-04` — requires A04, B01, G02–G06 — `split`
      `scenes/scene-controller.ts`. `next(scene)` disposes the outgoing scene fully; pause is an overlay, not a transition.
- [ ] **SDD-G03 RunScene** — `RUL-01`, `RUL-03` — requires B–F, G06, G07, G09 — `split`
      `scenes/run-scene.ts`. Owns and disposes camera/parallax/limit-box/gizmos (`D14`) plus ship and all managers; drives `GameLoop.step`.
- [ ] **SDD-G02 TitleScene** — `RUL-03` — requires G01, G06 — `new`
- [ ] **SDD-G04 ResultScene** — `RUL-03` — requires G01, G06, G10 — `new`
      Reads `RunSummary` from G10.
- [ ] **SDD-G05 RankingsScene** — `RNK-` (local slice) — requires G01, G06, G10 — `new`

---

## Gate checkpoints

- [ ] **G0 exit** — X/Y movement, pooled laser, one enemy, simple health, score, death and restart, wireframe visuals.
      Cards: A01–A05, B01–B03, C01–C03, D01–D03, E01, E04, E05, E07, F01, F04, G09, G10, G03.
- [ ] **G1 exit** — Itch web build with relative paths, Force Field vs Integrity, asteroid drops, local best score, essential audio, pooled bullets and particles.
      Adds: E02, E06, F02, F03, F05, G01, G02, G04, G06, G07, G11 + §7 Audio and §7 craft repair.
- [ ] Resolve **Q09** (debugger and gizmos in the shipped build?) before the first Itch packaging attempt.
- [ ] Resolve **Q10** (best-score persistence) before G1.

---

## Out of scope for POC2

Declared in the hub §7, not planned in detail: Special Ordnance and bombs (`WPN-06`), equipment slots (`SHIP-10`, `EQP-`), craft/CraftSlot and skills (`SHIP-07`, `SHIP-11`, `RUL-05`), jet/dash (`SHIP-08`), enemy archetypes and bosses (`ENM-03`, `ENM-05`–`ENM-08`), online rankings (`RNK-`), audio beyond the G1 essentials, Survivor mode (`D16`), gamepad and settings persistence (`SHIP-13`, `RUL-14`), narrative delivery systems (Bounty Board, AI narrator, sector bands, flavor text — G2).
