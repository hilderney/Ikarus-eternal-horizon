# POC2 — development todo

> Functional tracker, same shape as the original POC-1 todo: **phases in playable order**.
> Specs are written. Tick an item only when §6.1 DoD passes (failing test first, then green `npm run verify` in `poc2/`).
>
> **How to read a line:** feature · `SDD-id` · [spec](../.docs/specs/README.md)
> **Port** = reproduce POC-1 feel with the same `BALANCE` numbers. **New** = no POC-1 reference.
> **Agents:** Orchestrator · Programming/Three.js · Game Design · TDD (hub §6.3).
>
> SDD card index (order gate): appendix below. Hub: [`.docs/plans/planning.spec.MD`](../.docs/plans/planning.spec.MD).

---

## Fase 0 — Base (camera, nave, parallax)

Scaffold is done. This phase is the POC-1 “feel” port: move the ship, camera follows, parallax sells speed.

- [x] Scaffold: folder tree, Vite/TS/eslint/vitest, three-area shell, `npm run verify` green
- [x] `BALANCE` as the only source of numbers (add `ship.health`, `difficulty`, `score`, `drops`, `vfx`) · `SDD-A01` · [balancer.spec.ts](../.docs/specs/balancer.spec.ts) · **port**
- [x] Input: keyboard + Gamepad API (left stick / RT fire / LB switch / Start pause) + dual-rumble haptics · `SDD-A02` · [input.spec.ts](../.docs/specs/input.spec.ts) · **port** (+ `D18`)
- [x] Input D19 follow-up: mouse buttons/wheel + `TouchSource` + `consumePress` (bomb / switchBomb / dash) · `SDD-A02` · [input.spec.ts](../.docs/specs/input.spec.ts) · **new** (`D19`)
- [x] Live session remaps in `area-inputs` (Keyboard / Mix / Gamepad / Touch) · `SDD-A02` / `SDD-G03` · [input.spec.ts](../.docs/specs/input.spec.ts) · **new**
- [x] Math helpers + scratch vectors (zero alloc) · `SDD-A03` · [math.spec.ts](../.docs/specs/math.spec.ts) · **new**
- [x] Game loop: rAF, `dt` clamp 0.05, pause gate, ~15 Hz debugger sidecar · `SDD-A04` · [game-loop.spec.ts](../.docs/specs/game-loop.spec.ts) · **new**
- [x] Generic `ObjectPool<T>` (exhaustion returns `null`, never allocates) · `SDD-A05` · [object-pool.spec.ts](../.docs/specs/object-pool.spec.ts) · **new**
- [x] Portrait 9:16 renderer, letterbox, relative paths · `SDD-G09` · [renderer.spec.ts](../.docs/specs/renderer.spec.ts) · **new**
- [x] Three-area layout `area-inputs · game-area · debugger-area`, collapse ≤760px · `SDD-G06` · [ui-areas.spec.ts](../.docs/specs/ui-areas.spec.ts) · **port**
- [x] Perspective camera (`YXZ`, live `applyConfig`) · `SDD-B01` · [game-camera.spec.ts](../.docs/specs/game-camera.spec.ts) · **port**
- [x] Ship as `THREE.Group` (modular airplane: hull hitbox + wings/shield/weapon/bombs/collector/converter) + **byte sheet** (`debugSnapshot` for G08: 0–255 pools, statuses, loadout, slot mods) · `SDD-C01` · [ship.spec.ts](../.docs/specs/ship.spec.ts) · **port**
- [x] Force motion (`accel`/`decel`/`brake`, `maxSpeed`) + tilt/bank + dash · four schemes via InputPort · `SDD-C02` · [controller.spec.ts](../.docs/specs/controller.spec.ts) · **port** (`D19`)
- [x] LimitBox: dead-zone follow, edge bounce, auto-recenter to Recenter Point · `SDD-B03` · [limit-box.spec.ts](../.docs/specs/limit-box.spec.ts) · **port**
- [x] Parallax: 3 layers pinned to camera, stars slide by `parallaxGain` · `SDD-B02` · [parallax.spec.ts](../.docs/specs/parallax.spec.ts) · **port**
- [x] Gizmos: world axes, playfield grid, camera axes (toggle, Q09) · `SDD-B04` · [gizmos.spec.ts](../.docs/specs/gizmos.spec.ts) · **port**
- [x] Run scene owns camera / parallax / limit-box / gizmos / ship and drives the loop · `SDD-G03` · [run-scene.spec.ts](../.docs/specs/run-scene.spec.ts) · **new**
- [x] Touch overlay: nipplejs stick + on-screen Fire/Bomb/Switch/Dash/Pause · `SDD-G12` · [touch-controls.spec.ts](../.docs/specs/touch-controls.spec.ts) · **new** (`D19`)

**Fase 0 done when:** ship flies with POC-1 inertia and bank; camera follows the box with bounce + recenter; three parallax speeds read at a glance.

---

## Fase 1 — Disparos e dano (Force Field + Integrity)

POC-1 had pooled laser + energy + hit-test against dummies. POC2 adds the real risk model.

- [x] Pooled laser bolt from the ship nose; decay 100→75→50→25 on opacity **and** damage · `SDD-D01` · [weapon-shot.spec.ts](../.docs/specs/weapon-shot.spec.ts) · **port**
- [x] Tune cadence / speed / energy from `BALANCE` only (no literals in fire code) · `SDD-A01` / `SDD-D02`
- [x] Energy pool gates every shot; regen; fire blocks at 0 · `SDD-D03` · [energy-manager.spec.ts](../.docs/specs/energy-manager.spec.ts) · **port**
- [x] Weapon device + Laser + L1–L12 (`totalShots = level`) + registry seam · `SDD-D02` · [weapon.spec.ts](../.docs/specs/weapon.spec.ts) · **port**
- [x] Space or RT fires; `F` or LB switches weapon · `SDD-E07` · [firing-manager.spec.ts](../.docs/specs/firing-manager.spec.ts) · **port** (+ `D18`)
- [x] Shot manager owns pools by origin · `SDD-E04` · [shot-manager.spec.ts](../.docs/specs/shot-manager.spec.ts) · **new**
- [x] Collision by layers (matrix is data; no friendly fire) · `SDD-F01` · [collision-manager.spec.ts](../.docs/specs/collision-manager.spec.ts) · **port**
- [x] Ship hitbox on layer `Player` · `SDD-C01` / `SDD-F01`
- [x] Laser hitbox on layer `PlayerShot` · `SDD-D01` / `SDD-F01`
- [x] Force Field absorbs first; Integrity only after shield is 0 · `SDD-C03` · [ship-health.spec.ts](../.docs/specs/ship-health.spec.ts) · **new**
- [x] Slow shield regen after `regenDelayMs` with no hits · `SDD-C03`
- [x] Wire D03 combat onto C01 energy pool (regen only while recovering; G08 slider is live energy) · `SDD-D03` / `SDD-C01`
- [ ] Wire C03 combat onto C01 0–255 integrity/shield pools · `SDD-C01` / `SDD-C03`
- [x] DamageResolver is the only `applyDamage` caller · `SDD-F04` · [damage-resolver.spec.ts](../.docs/specs/damage-resolver.spec.ts) · **new**
- [ ] Hit feedback: flash, shake cap, shield-hit vs hull-hit, dual-rumble presets (sfx later) · `SDD-F05` · [vfx-manager.spec.ts](../.docs/specs/vfx-manager.spec.ts) · **new** (+ `D18`)

**Fase 1 done when:** holding Space drains Energy, bolts fade with range, a hit eats the shield before the hull.

---

## Fase 2 — Meteoros

- [ ] Spawn areas at playfield edges · `SDD-E06` · [meteor-manager.spec.ts](../.docs/specs/meteor-manager.spec.ts) · **new**
- [ ] Meteor game objects, sizes S / M / L, hp by size · `SDD-E02` · [meteor.spec.ts](../.docs/specs/meteor.spec.ts) · **new**
- [ ] Meteor hitbox on layer `Meteor` · `SDD-F01`
- [ ] Laser hit removes hp by shot `effectiveDamage()` · `SDD-F04`
- [ ] Destroy instance via pool release + `dispose()` · `SDD-A05` / `SDD-E06`
- [ ] Simple destruction burst (pooled wireframe / particles) · `SDD-F05`
- [ ] Meteor contact damages Force Field then Integrity · `SDD-F04` / `SDD-C03`
- [ ] Large meteors split into smaller fragments on destruction · `SDD-E06`

**Fase 2 done when:** meteors occupy lanes, can be shot or dodged, and contact hurts the ship.

---

## Fase 3 — Drop de recursos

- [x] Drops on meteor (and later enemy) kill: Metal Scrap, Prismatic Crystal, Dense Core · `SDD-F02` · [drop-manager.spec.ts](../.docs/specs/drop-manager.spec.ts) · **new**
- [x] Drop game objects, layer `Drop`, magnet radius pull · `SDD-F02`
- [x] Collection adds to ship inventory counts · `SDD-C01` / `SDD-F02`
- [ ] Collection feedback (pitch per type; audio §7) · `SDD-G07` / §7 Audio

**Fase 3 done when:** wreckage magnet-pulls in and the inventory count ticks up.

---

## Fase 4 — Inimigos (Warrior / pré-bestiário)

- [ ] Spawn areas: two side lanes ahead of the playfield · `SDD-E05` · [enemy-manager.spec.ts](../.docs/specs/enemy-manager.spec.ts) · **new**
- [ ] Generic enemy (Warrior stand-in); Tank / Rogue stay §7 · `SDD-E01` · [enemy.spec.ts](../.docs/specs/enemy.spec.ts) · **new** · *install Yuka here*
- [ ] Drift-toward-player motion · `SDD-E01`
- [x] Enemy hitbox on layer `Enemy` · `SDD-F01`
- [x] Laser hit removes hp · `SDD-F04`
- [ ] Destroy via pool + `dispose()` · `SDD-E05`
- [ ] Destruction burst · `SDD-F05`
- [x] Contact or enemy shot damages Force Field then Integrity · `SDD-F04` / `SDD-C03`
- [ ] Basic enemy projectile, layer `EnemyShot` · `SDD-E03` · [enemy-shot.spec.ts](../.docs/specs/enemy-shot.spec.ts) · **new**
- [x] Resource drop on enemy kill · `SDD-F02`
- [ ] Retire POC-1 `testTarget.ts` once E01/E02 are live

**Fase 4 done when:** enemies enter from the deep field, die to shots, and can hurt the ship.

---

## Fase 5 — Degradação por Integridade

- [x] Hull levels 0–3 from integrity thresholds (100–75 / 75–50 / 50–25 / under 25) · `SDD-C03` · Q08
- [ ] Integrity state slows displacement (`speedMul` / `accelMul` on the controller) · `SDD-C02`
- [ ] Integrity state slows fire rate (`fireRateMul` on FiringManager) · `SDD-E07`
- [ ] HUD makes each penalty readable · `SDD-G07`

**Fase 5 done when:** a broken shield changes the *phase* of play — the ship feels wounded, not just numbered.

---

## Fase 6 — Armas variadas

POC-1 already shipped all four. This phase is the class-ify port plus energy/switch already wired in Fase 1.

- [ ] **Plasma** — slow orbs, AoE on impact or expiry · `SDD-D04` · [plasma.spec.ts](../.docs/specs/plasma.spec.ts) · **port**
- [ ] **Beam** — continuous DPS while held, energy per second · `SDD-D05` · [beam.spec.ts](../.docs/specs/beam.spec.ts) · **port**
- [ ] **Mjolnir** — piercing electric cone · `SDD-D06` · [mjolnir.spec.ts](../.docs/specs/mjolnir.spec.ts) · **port**
- [ ] Switch active weapon; cadence and Energy cost differ per weapon · `SDD-E07` / `SDD-D03`

**Fase 6 done when:** F cycles Laser → Plasma → Beam → Mjolnir and each reads as a different gun.

---

## Fase 7 — Bomba (Special Ordnance)

Out of POC2 scope (hub §7, `WPN-06`). Kept here so the POC-1 list is not silently dropped.

- [ ] Expanding wave that clears enemy shots and deals area damage · §7 Bomb
- [ ] Limited Nova Bomb charges on the HUD · §7 / `SDD-G07` seam
- [ ] Screen flash / shockwave / shake / hit-stop · `SDD-F05` seam
- [ ] Gain charges via drop or resource · `SDD-F02` seam

---

## Fase 8 — Equipamentos

Out of POC2 scope (hub §7, `EQP-`, `SHIP-10`).

- [ ] Quantum Deflectors — raise Force Field capacity · §7
- [ ] Gravity Assist Engine — raise speed / agility · §7
- [ ] Equip / install into a ship slot · `SDD-C01` seam
- [ ] Effects stack onto ship attributes · §7

---

## Fase 9 — HUD do jogo

- [ ] Floating Force Field, Integrity, Energy bars (shared world→screen projector) · `SDD-G07` · [hud.spec.ts](../.docs/specs/hud.spec.ts) · **merge**
- [ ] Score and kill count (border HUD) · `SDD-G07` / `SDD-G10`
- [ ] Active weapon chip (bomb charges when Fase 7 lands) · `SDD-G07`
- [ ] Collected-resource counters · `SDD-G07` / `SDD-F02`
- [ ] Bar that was hit flickers · `SDD-G07` / `SDD-F04`

**Fase 9 done when:** every bar tracks a live pool and the label never leaves the frame.

---

## Fase 10 — Pausa com inventário

- [x] Esc pauses; **control scheme picker** (Keyboard / Mix / Gamepad / Touch, default keyboard) · `SDD-G11` / `SDD-A02` · [pause-scene.spec.ts](../.docs/specs/pause-scene.spec.ts) · **new** (`D19`)
- [ ] Esc or Start pauses without disposing the Run (inventory / restart / quit still pending) · `SDD-G11`
- [ ] Inventory: resources collected this run (read-only) · `SDD-G11` / `SDD-C01`
- [ ] Equipped weapon + hull/shield state on the overlay · `SDD-G11`
- [ ] Resume / Restart / Quit to title · `SDD-G11` / `SDD-G01` / `SDD-G10`

**Fase 10 done when:** Esc or Start freezes the fight, lists scrap, and unpausing continues the same run.

---

## Fase 11 — Tela inicial e fluxo de cenas

- [ ] Scene controller: dispose outgoing, mount next · `SDD-G01` · [scene-controller.spec.ts](../.docs/specs/scene-controller.spec.ts) · **new**
- [ ] Title screen (Play — shop/ranking buttons as they land) · `SDD-G02` · [title-scene.spec.ts](../.docs/specs/title-scene.spec.ts) · **new**
- [ ] Result screen reads `RunSummary` · `SDD-G04` · [result-scene.spec.ts](../.docs/specs/result-scene.spec.ts) · **new**
- [ ] Integrity 0 → result with score → restart is a clean run · `SDD-G10` · [run-state.spec.ts](../.docs/specs/run-state.spec.ts) · **new**

**Fase 11 done when:** Title → Run → Result → Title is navigable with no leaked GPU objects.

---

## Fase 12 — Loja

POC-1 listed a shop. GDD meta is Bounty Board + cosmetics, not a mid-run power shop. **Out of POC2** (hub §7, `D08`).

- [ ] Hub shop / Bounty Board between runs · §7
- [ ] Spend resources on equipment / weapons / bombs · §7 · never mid-run combat power
- [ ] Persist meta (cosmetics, best score) · `SDD-G10` Q10 / §7

---

## Fase 13 — Pontuação e ranking

- [ ] Cumulative score for kills / meteors / events · `SDD-G10` · [run-state.spec.ts](../.docs/specs/run-state.spec.ts)
- [ ] Multipliers (no-damage streak, fast clear) · `SDD-G10` (`RUL-11`)
- [ ] Local best score survives reload · `SDD-G10` (`RUL-07`, Q10)
- [ ] Local arcade table · `SDD-G05` · [rankings-scene.spec.ts](../.docs/specs/rankings-scene.spec.ts) · **new**
- [x] Difficulty ramp by kills; milestones 50 / 100 / 500 · `SDD-F03` · [difficulty-manager.spec.ts](../.docs/specs/difficulty-manager.spec.ts) · **new**

**Fase 13 done when:** the HUD score rises, death shows a result, and the best score is still there after F5.

---

## Fase 14 — Fechamento / Itch.io

- [x] Debugger: **Ship** (pose, 0–255 pools, statuses) + **Equips** (loadout + weapon/dash level 1–12 + module slots) two-way ~15 Hz, Reset · `SDD-G08` · [debugger.spec.ts](../.docs/specs/debugger.spec.ts) · **port**
- [ ] Debugger remaining tabs: Cam / LimitBox / Parallax / Weapons catalog / Energy / Shots / Collision · `SDD-G08`
- [ ] Ship XYZ label, letterbox-safe · `SDD-G07`
- [ ] All gameplay numbers still only in `BALANCE` · `SDD-A01` (`RUL-12`)
- [x] Web package: `index.html` relative paths, responsive canvas · `SDD-G09` (`RUL-08`)
- [ ] Game over: score, restart, back to title · `SDD-G04` / `SDD-G10`
- [ ] 3–8 min session, no bugs, no frame drop (pooling on every hot path) · `SDD-A05` / `SDD-F05` (`RUL-13`)
- [ ] Resolve Q09 (debugger + gizmos in the shipped build?)
- [ ] Resolve Q10 (localStorage vs dedicated persistence) before G1

**Fase 14 done when:** G0 exit criteria hold, then G1 packaging is a zip that opens on Itch.

### Gate checkpoints

- [ ] **G0** — X/Y move, pooled Laser, one enemy, Force Field → Integrity, score, death, restart, wireframe
- [ ] **G1** — Itch build, asteroid drops, local best, essential audio (§7), pooled bullets and particles

---

## Extras / dev tools (optional, do not block)

From the POC-1 spike. None of these is a gate.

- [ ] Darkness zone: player-layer objects appear only past a Z distance · `SDD-B02` / `SDD-G09` experiment
- [ ] On-screen debug tags by subject (ship, limit box, camera, parallax) · `SDD-G08`
- [ ] Larger debugger inputs · `SDD-G08`
- [ ] Bind more live values into the debugger · `SDD-G08`

---

## Appendix — SDD card order (implementation gate)

Never start a card whose `requires` are still open. Specs: [`.docs/specs/README.md`](../.docs/specs/README.md).

| Stage | Cards |
|---|---|
| A Core | A01 Balancer → A02 Input → A03 Math → A04 GameLoop → A05 ObjectPool |
| B World | B01 Camera → B02 Parallax · B03 LimitBox · B04 Gizmos |
| C Craft | C01 Ship → C02 Controller · C03 ShipHealth |
| D Combat | D01 WeaponShot · D03 Energy → **E04 ShotManager** → D02 Weapon+Laser → D04 Plasma · D05 Beam · D06 Mjolnir (G2 catalog-only) |
| E Pressure | E01 Enemy · E02 Meteor · E03 EnemyShot → E04 ShotManager · E07 Firing → E05 EnemyManager · E06 MeteorManager |
| F Interact | F01 Collision → F04 DamageResolver → F05 Vfx · F02 Drops · F03 Difficulty (needs G10) |
| G Meta | G09 Renderer · G06 Areas · G10 RunState · G07 HUD · G08 Debugger · G01 SceneController · G03 Run · G02 Title · G04 Result · G05 Rankings · G11 Pause · G12 TouchControls |

Suggested first slice: **A01 → A03 → A05 → A02 → A04 → B01 → C01 → C02 → B03 → B02 → G09 → G03** (Fase 0 playable).
