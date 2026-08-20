# POC2 SDD + TDD specs

One file per Stage A–G card. Template: [`_template.spec.ts`](./_template.spec.ts).
Hub: [`.docs/plans/planning.spec.MD`](../plans/planning.spec.MD) §5 · §6.3.

POC-1 is frozen. These specs describe **`poc2/` only**.

| Card | Spec | Test file (red next) |
|---|---|---|
| A01 | [balancer.spec.ts](./balancer.spec.ts) | `poc2/src/core/balancer.test.ts` |
| A02 | [input.spec.ts](./input.spec.ts) | `poc2/src/core/input.test.ts` |
| A03 | [math.spec.ts](./math.spec.ts) | `poc2/src/core/math.test.ts` |
| A04 | [game-loop.spec.ts](./game-loop.spec.ts) | `poc2/src/core/game-loop.test.ts` |
| A05 | [object-pool.spec.ts](./object-pool.spec.ts) | `poc2/src/pools/object-pool.test.ts` |
| B01 | [game-camera.spec.ts](./game-camera.spec.ts) | `poc2/src/gameobjects/camera/game-camera.test.ts` |
| B02 | [parallax.spec.ts](./parallax.spec.ts) | `poc2/src/gameobjects/parallax/parallax.test.ts` |
| B03 | [limit-box.spec.ts](./limit-box.spec.ts) | `poc2/src/gameobjects/limit-box/limit-box.test.ts` |
| B04 | [gizmos.spec.ts](./gizmos.spec.ts) | `poc2/src/gameobjects/gizmos/gizmos.test.ts` |
| C01 | [ship.spec.ts](./ship.spec.ts) | `poc2/src/gameobjects/ship/ship.test.ts` |
| C02 | [controller.spec.ts](./controller.spec.ts) | `poc2/src/gameobjects/controller/controller.test.ts` |
| C03 | [ship-health.spec.ts](./ship-health.spec.ts) | `poc2/src/gameobjects/ship/ship-health.test.ts` |
| D01 | [weapon-shot.spec.ts](./weapon-shot.spec.ts) | `poc2/src/gameobjects/shot/weapon-shot.test.ts` |
| D02 | [weapon.spec.ts](./weapon.spec.ts) | `poc2/src/gameobjects/weapon/weapon.test.ts`, `weapon-levels.test.ts`, `laser-levels.test.ts`, `catalog.test.ts` |
| D03 | [energy-manager.spec.ts](./energy-manager.spec.ts) | `poc2/src/systems/energy-manager.test.ts` |
| D04 | [plasma.spec.ts](./plasma.spec.ts) | `poc2/src/gameobjects/weapon/behaviours/plasma.test.ts` |
| D05 | [beam.spec.ts](./beam.spec.ts) | `poc2/src/gameobjects/weapon/behaviours/beam.test.ts` |
| D06 | [mjolnir.spec.ts](./mjolnir.spec.ts) | `poc2/src/gameobjects/weapon/behaviours/mjolnir.test.ts` |
| E01 | [enemy.spec.ts](./enemy.spec.ts) | `poc2/src/gameobjects/enemy/enemy.test.ts` |
| E02 | [meteor.spec.ts](./meteor.spec.ts) | `poc2/src/gameobjects/meteor/meteor.test.ts` |
| E03 | [enemy-shot.spec.ts](./enemy-shot.spec.ts) | `poc2/src/gameobjects/shot/enemy-shot.test.ts` |
| E04 | [shot-manager.spec.ts](./shot-manager.spec.ts) | `poc2/src/systems/shot-manager.test.ts` |
| E05 | [enemy-manager.spec.ts](./enemy-manager.spec.ts) | `poc2/src/systems/enemy-manager.test.ts` |
| E06 | [meteor-manager.spec.ts](./meteor-manager.spec.ts) | `poc2/src/systems/meteor-manager.test.ts` |
| E07 | [firing-manager.spec.ts](./firing-manager.spec.ts) | `poc2/src/systems/firing-manager.test.ts` |
| F01 | [collision-manager.spec.ts](./collision-manager.spec.ts) | `poc2/src/systems/collision-manager.test.ts` |
| F02 | [drop-manager.spec.ts](./drop-manager.spec.ts) | `poc2/src/systems/drop-manager.test.ts` |
| F03 | [difficulty-manager.spec.ts](./difficulty-manager.spec.ts) | `poc2/src/systems/difficulty-manager.test.ts` |
| F04 | [damage-resolver.spec.ts](./damage-resolver.spec.ts) | `poc2/src/systems/damage-resolver.test.ts` |
| F05 | [vfx-manager.spec.ts](./vfx-manager.spec.ts) | `poc2/src/systems/vfx-manager.test.ts` |
| G01 | [scene-controller.spec.ts](./scene-controller.spec.ts) | `poc2/src/scenes/scene-controller.test.ts` |
| G02 | [title-scene.spec.ts](./title-scene.spec.ts) | `poc2/src/scenes/title-scene.test.ts` |
| G03 | [run-scene.spec.ts](./run-scene.spec.ts) | `poc2/src/scenes/run-scene.test.ts` |
| G04 | [result-scene.spec.ts](./result-scene.spec.ts) | `poc2/src/scenes/result-scene.test.ts` |
| G05 | [rankings-scene.spec.ts](./rankings-scene.spec.ts) | `poc2/src/scenes/rankings-scene.test.ts` |
| G06 | [ui-areas.spec.ts](./ui-areas.spec.ts) | `poc2/src/ui/areas.test.ts` |
| G07 | [hud.spec.ts](./hud.spec.ts) | `poc2/src/ui/hud.test.ts` |
| G08 | [debugger.spec.ts](./debugger.spec.ts) | `poc2/src/ui/debugger/debugger.test.ts` |
| G09 | [renderer.spec.ts](./renderer.spec.ts) | `poc2/src/render/renderer.test.ts` |
| G10 | [run-state.spec.ts](./run-state.spec.ts) | `poc2/src/systems/run-state.test.ts` |
| G11 | [pause-scene.spec.ts](./pause-scene.spec.ts) | `poc2/src/scenes/pause-scene.test.ts` |
| G12 | [touch-controls.spec.ts](./touch-controls.spec.ts) | `poc2/src/ui/touch-controls/touch-controls.test.ts` |

Each spec has four signed sections: **Orchestrator**, **Programming / Three.js**, **Game Design**, **TDD**. Stages A–B, C01–C03, D01–D06, E01 (Warrior + EnemyMovementManager), E04–E05 (triple spawn + BattleField + gate), G06, G08 (Ship + Equips + SpawnArea + Parallax), G09, G03 and G12 are **done**. D04–D06 register all four guns with unified `WeaponLevelRow` L1–12 (`weapon-levels.ts`). **SpawnArea** is three red volumes (`spawnLeft` / `spawnRight` / `spawnFront`); **EnemyGate** (amber, y=0) is the synchronizedLerp waypoint before seekChase (3 entry X per band: left←spawnLeft, middle←spawnFront, right←spawnRight). **BattleField** culls pool-released leavers. F01 hit-query still pending — beam/mjolnir use inline `HitTarget` loop until then; plasma AoE splash and shot→enemy / enemy→ship damage wait on F01. Fase 0 is playable; **F** / **Y** fires laser, **G** / **X** cycles weapons. The debugger-area shows Ship, Equips, **SpawnArea** and **Parallax** in DEV. Equips exposes editable weapon stats per level. D03 energy is the same pool as `ship.stats.energy`. **area-inputs** remaps live `InputBindings` (Escape still pauses).

## Next steps (playable order)

1. **G08 remaining tabs** after Ship / Equips / SpawnArea / Parallax: Camera · LimitBox · Weapons catalog · Energy · Shots · Collision.
2. **Wire C03 combat onto the byte pools.** Integrity/shield become the same 0–255 pools the Ship tab shows. Energy is already bound (D03).
3. **Statuses.** `flickering` / `shooting` / `dashing` / `recovering` timers live in `BALANCE.ship.cooldowns`. Dash is allowed when energy remains and `status.dashing` is false. Energy regen waits `recoveringMs` after spend and only while `recovering`.
4. **F01 Collision** — Player / PlayerShot hitboxes, plasma splash, wire beam/mjolnir + shots to Enemy. Then F04 / F05 / G07 HUD bars.
5. **G11 Pause** inventory / restart / quit (scheme picker is live). Yuka seek on E01.

C01 ship sheet is live (`debugSnapshot`). G08 **Ship**, **Equips**, **SpawnArea** and **Parallax** tabs are mounted in `#debugger-area` (DEV).
