# POC-1 — delivered scope (frozen snapshot)

> **This is not a roadmap.** POC-1 is frozen. This file records what the spike actually delivered and what it deliberately did not, so the port to POC2 knows exactly which behavior already exists as a reference.
>
> **Live backlog:** [`poc2/todo.md`](../poc2/todo.md) — one entry per SDD card.
> **Build order and cards:** [`.docs/plans/planning.spec.MD`](../.docs/plans/planning.spec.MD) §5.
> **Port map (which POC-1 file becomes which card):** the same document, §5.0.

---

## Delivered

### Camera, motion and world dressing
- [x] `limitBox` makes the camera follow the ship (dead zone with `halfX`/`halfZ`) → ports to `SDD-B03`
- [x] Ship tilt/bank while moving (`rotation.z`, `riseMs`/`fallMs`) → `SDD-C02`
- [x] Smooth force-based ship movement (`accel`/`decel`/`brake`, `maxSpeed`) → `SDD-C02`
- [x] Parallax grids pinned to the camera position, 3 layers with independent rotation → `SDD-B02`
- [x] Camera movement displaces the parallax stars by `parallaxGain` (depth and speed cue) → `SDD-B02`
- [x] Smooth edge follow with `bounce.timeMs`, plus auto-recenter to the Recenter Point when the ship goes idle → `SDD-B03`
- [x] Perspective camera rig with live `applyConfig` (FOV/near/far/position/rotation) → `SDD-B01`
- [x] Gizmos: world axes, playfield grid, camera axes with sprite labels → `SDD-B04`
- [x] Fixed portrait 9:16 canvas (540×960) with letterbox centering and the 3-area layout → `SDD-G06` / `SDD-G09`

### Weapons and combat primitives
- [x] Pooled laser projectile game object, fired from the ship's nose → `SDD-D01`
- [x] Shots lose damage with distance and expire (25% steps on opacity **and** damage) → `SDD-D01`
- [x] Typed weapon catalog + registry DLC seam (`Record<WeaponId, factory>`) → `SDD-D02`
- [x] All four weapons implemented: **Laser** (`SDD-D02`), **Plasma** AoE orbs (`SDD-D04`), **Beam** continuous DPS (`SDD-D05`), **Mjolnir** piercing cone (`SDD-D06`)
- [x] Laser levels **L1–L10** presets with `totalShots = forward + 2 × perSide = level` → `SDD-D02`
- [x] Active weapon switch (cyclic on `F` + panel selector) → `SDD-E07`
- [x] Energy pool (`start`/`max`/`current`/`regenPerSec`) gating every shot → `SDD-D03`
- [x] Layered projectile × target collision with plasma AoE and a target registry → `SDD-F01`
- [x] Floating Energy bar HUD projected over the ship → `SDD-G07`

### Tooling
- [x] Central input state with `preventDefault` list, `blur` reset and synthetic `Shift+KeyX` combos → `SDD-A02`
- [x] `BALANCE` as the single source of every gameplay number → `SDD-A01`
- [x] Debug panel with 5 tabs, live readouts, two-way ~15 Hz sync and Reset → `SDD-G08`
- [x] Ship coordinate label projected world→screen, letterbox-safe → `SDD-G07`
- [x] Test targets to validate collision and damage → retired once `SDD-E01`/`SDD-E02` land

---

## Deliberately not in POC-1

Each line is owned by a POC2 card; none of this behavior exists as a reference, so it gets designed from the card rather than ported.

- **Damage model** — Force Field absorbing before Integrity, slow shield regen, hull degradation tiers → `SDD-C03`, `SDD-F04` (`SHIP-02`, `SHIP-05`, `SHIP-12`, `RUL-10`)
- **Enemies** — spawn areas, Warrior behavior, enemy hitbox, enemy projectiles, destruction → `SDD-E01`, `SDD-E03`, `SDD-E05` (`ENM-01`, `ENM-02`)
- **Meteors** — spawn, sizes, fragmentation on hit, contact damage → `SDD-E02`, `SDD-E06` (`ENM-04`)
- **Drops and collection** — drop tables, magnet radius, inventory counts → `SDD-F02` (`RES-01`, `RES-02`, `RES-03`)
- **Feedback and juice** — pooled explosions, hit flash, screen shake, hit-stop, damage vignette → `SDD-F05` (`RUL-13`)
- **Score and run lifecycle** — kills, score, multipliers, game over, restart, local best → `SDD-G10` (`RUL-03`, `RUL-07`, `RUL-11`)
- **Screens** — title, run, result, rankings and the pause/inventory overlay → `SDD-G01`–`SDD-G05`, `SDD-G11` (`RUL-04`)
- **Difficulty** — kill-driven ramp and the 50/100/500 milestones → `SDD-F03` (`RUL-06`, `RUL-09`)
- **Generic infrastructure** — `ObjectPool<T>`, `GameLoop`, `core/math.ts` (POC-1 has a shot-specific pool and an inlined rAF) → `SDD-A03`, `SDD-A04`, `SDD-A05`
- **Special Ordnance, equipment, craft, skills** → §7 of the hub (`WPN-06`, `EQP-`, `SHIP-07`, `SHIP-11`, `RUL-05`)
- **Audio** — no SFX, music or stingers → §7 Audio (Howler, post-G1)
- **Pointer control** — keyboard only → `SHIP-04`, open question Q07
- **Persistence and packaging validation** → `SDD-G09`, `SDD-G10` (`RUL-07`, `RUL-08`)

---

## Dev-tool ideas raised during the spike

Carried forward as candidates, not commitments. None blocks a gate.

- Darkness zone: objects on the player layer only become visible past a Z distance.
- On-screen debug tags grouped by subject (ship, limit box and motion, camera, parallax grids).
- Larger input controls in the debugger panel.
- Bind more live values into the debugger in real time.

The first three feed `SDD-G08`; the darkness zone would be a `SDD-B02`/`SDD-G09` render experiment.
