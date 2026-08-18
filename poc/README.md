# Ikarus: Eternal Horizon — POC-1 (frozen reference)

Proof of concept (spike, pre-G0) of the vertical slice planned in [`.docs/phases/phase-0-poc.md`](../.docs/phases/phase-0-poc.md).

> **Status: FROZEN.** POC-1 is no longer the place where the game grows. It is the **playable behavior reference** for [`poc2/`](../poc2/README.md), the project built against the architecture contract in [`.docs/plans/planning.spec.MD`](../.docs/plans/planning.spec.MD) (see its §0 reality check and §5.0 port map). Everything documented here is a **tuning contract**: the port must reproduce this feel with the same numbers, not reinvent it.
>
> Changes to POC-1 are limited to bug fixes that keep the reference honest. New features go to `poc2/`.

**Stack:** TypeScript · Vite · Three.js. Canonical balance source: `src/core/balancer.ts` (no gameplay numbers outside it).

---

## How to run

```bash
npm install
npm run dev     # Vite dev server
npm run build   # tsc + vite build -> dist/
npm run preview # preview the production build
```

---

## Controls

| Action | Keys |
|---|---|
| Move the **ship** (X/Z) | `W / A / S / D` |
| **Fire** the primary weapon | `Space` |
| **Switch weapon** | `F` |
| Move the **camera** (Z / X / Y) | `I / K` · `J / L` · `U / O` |
| Rotate the **camera** — pitch `down / up` | `Shift+K` / `Shift+I` |
| Rotate the **camera** — roll | `Shift+O` / `Shift+U` |
| Rotate the **camera** — yaw `right / left` | `Shift+L` / `Shift+J` |

> This map is **single and simultaneous**: there is no mode toggle. WASD always moves the ship; IJKL/UO move the camera and Shift+IJKL/UO rotate it, all at the same time. The follow box bounds the camera: when the ship touches an edge (`halfX`/`halfZ`) the camera follows, and when the ship is **idle** a smooth auto-recenter repositions the camera (moving interrupts it; it resumes after the ship stays still for `stillMs`) toward the **Recenter Point** — a **single fixed point relative to the box** (default `position {0,0,-1}`: on X at the box center, on Z one unit *inside* the base edge, `anchor.z + halfZ + z`). While the camera moves it displaces the parallax items by the layer's `parallaxGain` — the sense of perspective and motion.

> **Firing (weapons):** `Space` fires the active weapon (with that weapon's cadence and Energy cost); `F` (or the selector in the debug panel's **Weapons** tab) switches to the next weapon in the loadout. All 4 weapons drain the same Energy pool — `energy` in the balancer / panel.

### Ship movement and feel

- **Force-based movement** (`controls.motion`): each axis accelerates toward the input with `accel` (m/s²), decelerates to a stop with `decel` when keys are released, and brakes against the current direction with `brake` (stronger than `accel`) — pressing the opposite side makes the direction change snappier. Velocity is capped at `maxSpeed`.
- **Tilt / bank** (`controls.tilt`): turning (A/D) banks the ship on **`rotation.z`** up to `maxDeg` (22°, with configurable `axis`/`sign`) over a `riseMs` ramp (150 ms); on release it returns to zero in `fallMs` (200 ms).

### How parallax derives from movement

The sense of speed in the background is not computed from the ship — it **inherits from the camera's real movement**. The chain is:

1. **Ship by force** (`controllers.ts` — `axisVelocity`): input becomes acceleration (`accel`/`brake`), integrated each frame into `vx/vz` and capped by `maxSpeed`; `shipTransform.position` moves.
2. **Dead zone** (`followCamera.ts` / `followBox`): the ship moves **freely inside** the follow box (`halfX`/`halfZ`) around the anchor. While it does not touch an edge the camera stays put — the ship "navigates the box".
3. **Follow + recenter** (`followCamera.ts`):
   - **Edge follow with "bounce" (dead zone, X and Z):** when the ship touches or crosses the box edge (`halfX`/`halfZ`), the camera follows **smoothed** — it starts slow and settles at the target over `bounce.timeMs` (ms), instead of snapping. While recenter is active, edge follow is suspended on the same axis so the two systems never fight.
   - **Auto-recenter when idle (single Recenter Point):** whenever the ship is **still** (`moving` < `MOVE_EPS`) and off the rest point by more than `CENTER_EPS`, **inside or outside the box**, then after `recenter.delayMs` the camera slides by force (`recenter.accel`, capped at `recenter.maxSpeed`) — bringing the ship toward the **Recenter Point**, a fixed point relative to the box (`restLine.position`). Both axes derive rest from the *same* point (a direct ship→point path): **X** with `restOffset = position.x`; **Z** with `restOffset = position.z + halfZ` (measured from the base edge, `anchor.z + halfZ + z`). If the ship starts moving the force stops (`interrupt`) and only resumes after the ship has been still for `recenter.stillMs`; state is independent per axis (moving on Z does not interrupt the X recenter and vice versa).
   The center line (visual, `followBox.centerLine`) crosses the box vertically along Z, marking the lateral X center. The blue **Recenter Point** marker (`restLine`) sits exactly where the camera places the ship when recentering — X at the box middle, Z at `position.z` inside the base — and is live-editable in the panel (Follow Box tab → **Recenter Point**), moving marker **and** target together.
4. **Parallax** (`parallax.ts`): each frame, every layer measures the **camera position Δ** on any axis (`camDX/DY/DZ` between frames) and displaces its stars in the **opposite direction**, multiplied by the layer's `parallaxGain` — a perspective/motion **gain**: the higher `parallaxGain`, the more the grid items "slide" when the camera moves:
   `star −= Δcamera × parallaxGain × (1 ± jitter)`.
   The grids (pinned to the camera position, with independent orientation/rotation) stay put; only the stars "slide" over them — that is what produces depth. On top of that, stars have their own flight along Z (`speed`) with wrap (`zNearWrap`, `zFar`).

**Practical result:** with the camera still, the background does not react to ship movement inside the box. Motion parallax happens whenever the camera moves: (a) edge follow when the ship touches the box (X/Z), (b) recenter when the ship goes idle (after `recenter.delayMs`, closing on the Recenter Point), or (c) the IJKL/UO keys. Each layer is placed in depth by its `position` relative to the camera (currently `Y = −300 → −350 → −400`, all with `gridSize` 1000), and how much its stars "slide" with camera movement is the `parallaxGain` factor (currently `0.15 → 0.09 → 0.03`, back layer to front layer). The depth scale is directly `position` + `gridSize` + `parallaxGain`.

---

## What POC-1 delivered

### Scene and render (`src/main.ts`, `src/gameobjects/`)
- **Fixed portrait 9:16 canvas** — internal buffer 540×960 (`BALANCE.layout.playfield`), centered in the window and sized by screen height (`height: min(100vh,100%)`); the **side columns fill the remaining space** (control legend on the left, debug panel on the right); at ≤760px the columns disappear and the canvas fills the width.
- **Ship** (`ship.ts`) — neon wireframe box + half-cone thruster with `.update(dt)` flicker, transform applied through `applyTransform`.
- **Camera** (`cameraRig.ts`) — `PerspectiveCamera` with `rotation.order = 'YXZ'`, config applied by `applyConfig` (FOV/aspect/near/far/position/rotation).
- **Follow Box** (`followBox.ts`) — `LineLoop` drawn on the XZ plane around a configurable center (position) with half-width/half-depth; the camera **dead zone** (`followCamera.ts`) uses the same center/size — resize and reposition live from the panel. Recenter re-centers the ship when it goes idle, inside or outside the box, closing on the **Recenter Point** (blue `restLine` marker): a single fixed point relative to the box — X at the center, Z at `position.z` inside the base edge (`anchor.z + halfZ + z`).
- **Parallax** (`parallax.ts`) — horizontal layers parallel to the ship's base, **pinned to the camera position** (not its rotation: each grid keeps its own editable rotation). Each layer has a grid (`gridSize`, `gridOpacity`) and stars that react to the camera Δ with `parallaxGain`, plus their own flight along Z (`speed`, `zNearWrap`, `zFar`). Configurable per layer.
- **Gizmos** (`gizmos.ts`) — world axes (XY Z), playfield grid and camera axes (sprite labels), tracking the camera every frame.

### Overlays (DOM on top of the canvas)
- **Ship coordinates** (`shipCoords.ts`) — `X / Y / Z` label projected "over the ship"; maps world→screen with `vector.project` + the canvas `getBoundingClientRect` (letterbox-safe), clamped to the margins, hidden when behind the camera.
- **Energy bar** (`energyHud.ts`) — floating HUD over the ship showing the Energy pool (`ENERGY current/max` + fill bar). Same projection pattern as `shipCoords`; updated every frame from `energy.current / energy.max`.
- **Debug panel** (`debugControls.ts` + the static markup in `index.html`) — right column, organized in **navigable tabs** (Cam · Ship · Follow Box · Parallax · **Weapons**): fixed header with live position readouts (ship/camera) and a footer **Reset** button. Sliders/spins/vectors edit the game's **shared objects** (single source of truth) and sync both ways: editing the HTML applies to the game (`applyCamera`/`applyShip`/`applyParallax`), and the game writes back at ~15 Hz via `sync()`, skipping whichever control the user has focused or is dragging.
- **Weapons tab** — selector for the ship's **active weapon** (laser/plasma/beam/mjolnir; switch via the selector or the `F` key), weapon modifiers (damage ×, rate ×, Energy ×, crit, pulses, AoE, beam width, cone) and the **Energy** pool (max/regen). The `mods` feed `firing.ts` without touching weapon code.
- **Control legend** — left column, static in `index.html`.

### Input (`src/core/input.ts`)
- Central key state with `preventDefault` on a controlled list; `blur` clears the state.
- **Shift+Key combos**: while Shift (left or right) is held, synthetic `Shift+KeyX` codes are produced (e.g. `Shift+KeyI`). That allows mapping camera rotation to Shift+IJKL/UO without colliding with camera movement (bare IJKL/UO).

### Weapons (modular weapon architecture)
- **`core/weaponsCatalog.ts`** — typed `WeaponConfig` + the `WEAPONS` catalog (Laser, Plasma, Beam, Mjolnir), pure data imported by `BALANCE`. Each weapon declares a profile (`projectile`/`orb`/`beam`/`cone`), damage, cadence, Energy cost, pool size and its projectile/beam/cone spec.
- **`weapons/behaviour.ts`** — the Strategy interface (`WeaponBehaviour`), `WeaponServices` (Energy + targets), `WeaponModifiers` and `defaultModifiers()`.
- **`weapons/weapon.ts`** — the device game object: creates its own pool and delegates to the behaviour from the registry.
- **`weapons/registry.ts`** — `Record<WeaponId, factory>` — the **DLC seam**: adding a weapon = 1 catalog entry + 1 registry entry (+ `registerWeapon`).
- **`weapons/laserLevels.ts`** — `LASER_LEVELS` presets **L1–L10** + `applyLaserLevel(cfg, level)`. The invariant is `totalShots = forwardShots + 2 × diagonalShotsPerSide = level`, so the pulse count always equals the level:

| Level | Forward | Per side | Total | Damage | Rate | Energy/shot |
|---|---|---|---|---|---|---|
| 1 | 1 | 0 | 1 | 1.0 | 8.0 | 0.25 |
| 2 | 2 | 0 | 2 | 1.1 | 8.5 | 0.27 |
| 3 | 3 | 0 | 3 | 1.3 | 9.0 | 0.30 |
| 4 | 4 | 0 | 4 | 1.5 | 9.5 | 0.33 |
| 5 | 3 | 1 | 5 | 1.8 | 10.0 | 0.36 |
| 6 | 4 | 1 | 6 | 2.1 | 10.5 | 0.40 |
| 7 | 3 | 2 | 7 | 2.5 | 11.0 | 0.44 |
| 8 | 4 | 2 | 8 | 3.0 | 11.5 | 0.48 |
| 9 | 3 | 3 | 9 | 3.6 | 12.0 | 0.52 |
| 10 | 4 | 3 | 10 | 4.3 | 12.5 | 0.56 |

  Constant across levels: `speed 30`, `lifetime 1` (range 30), `diagonalAngleDeg 22`, `forwardSpread 0.55`; `radius` grows 0.12 → 0.165. Levels are editable live in the panel's Weapons tab.
- **`weapons/behaviours/{laser,plasma,beam,mjolnir}.ts`** — the 4 weapons. Laser/Plasma spawn projectiles from the pool; Beam/Mjolnir are continuous visuals with a per-frame hit query (damage per second).
- **`gameobjects/shot.ts`** (pooled projectile, damage decaying with distance), **`gameobjects/beam.ts`** / **`gameobjects/cone.ts`** (visuals), **`gameobjects/testTarget.ts`** (test target).
- **`systems/firing.ts`** — input → fire, Energy gate, cyclic/selector weapon switch (`setActive`).
- **`systems/collisionSystem.ts`** — projectile × target collision by layer (with plasma AoE) and target registration.
- **`systems/energy.ts`** — the Energy pool (`EnergyPort` + `EnergySystem`): `start`/`max`/`current` and `regenPerSec`; `spend()`/`canAfford()` are used by every shot (and later by jets/dash). Visual bar in `systems/energyHud.ts`.

---

## Architecture (as built)

```
poc/
  index.html                      # flex shell: legend (left) · #app (canvas) · #panel (right) + debug tab markup
  src/
    main.ts                       # bootstrap, rAF loop (dt clamp), system composition, throttled panel sync()
    style.css                     # portrait layout + neon theme + panel tabs
    core/
      balancer.ts                 # BALANCE: every number/setting
      input.ts                    # keyboard state
      weaponsCatalog.ts           # WEAPONS: typed catalog of the primary weapons (Laser/Plasma/Beam/Mjolnir)
    gameobjects/
      cameraRig.ts                # PerspectiveCamera + applyConfig
      ship.ts                     # wireframe ship + thruster
      parallax.ts                 # 3 parallax layers
      followBox.ts                # dead-zone box (LineLoop)
      gizmos.ts                   # world axes, grid, camera axes
      shot.ts                     # pooled projectile (laser/plasma) + ShotPool
      beam.ts                     # continuous beam visual (Beam)
      cone.ts                     # piercing cone visual (Mjolnir)
      testTarget.ts               # test target (validates collision/damage)
    weapons/
      weapon.ts                   # weapon device: pool + behaviour
      behaviour.ts                # Strategy interface + WeaponServices/WeaponModifiers
      registry.ts                 # Record<WeaponId, factory> — DLC seam
      laserLevels.ts              # LASER_LEVELS L1-L10 + applyLaserLevel()
      behaviours/
        laser.ts                  # pooled straight projectiles, distance decay
        plasma.ts                 # slow orbs, AoE on collision/expiry
        beam.ts                   # continuous DPS by hit query
        mjolnir.ts                # piercing cone by hit query
    systems/
      controllers.ts              # input -> ship movement (accel/tilt) + camera
      followCamera.ts             # dead-zone follow (anchor = box center)
      shipCoords.ts               # X/Y/Z label over the ship
      energyHud.ts                # floating Energy bar over the ship
      debugControls.ts            # debug panel (tabs, sliders/readouts/reset, two-way sync)
      firing.ts                   # firing, Energy gate, weapon switch/selector
      collisionSystem.ts          # projectile × target collision + AoE + target registry
      energy.ts                   # Energy pool (EnergyPort)
```

**Pattern actually used here:** game objects in the shape `init → update(dt) → syncRender → dispose`, built as **factory functions** returning interface-typed handles, with `BALANCE` as the single source of numbers and zero allocation per frame in hot paths.

**Note for POC2:** the factory-function convention is **legacy, not a template**. New code follows the *pattern constructor* (`interface` + `class` + module, with domain classes inheriting their Three.js base) — decision `D11` in [`planning.spec.MD`](../.docs/plans/planning.spec.MD) §9, detailed in [`phase-0-poc2.md`](../.docs/phases/phase-0-poc2.md) §2. The lifecycle and the `BALANCE`/memory rules carry over unchanged.

---

## Where the numbers live

Everything in `src/core/balancer.ts`:

| Block | What it controls |
|---|---|
| `layout.playfield` | Base resolution of the portrait canvas |
| `controls.shipKeys / motion / tilt / camera` | Key map, force (accel/decel/brake) + `maxSpeed`, bank (degrees + ms) and camera move/rot speed |
| `gameplay` | The **Energy** pool (start/max/regen) and the **fire/switch** keys (Space/F) |
| `weapons.catalog` / `weapons.loadout` | Typed catalog (the 4 weapons' data in `weaponsCatalog.ts`) and the cyclic switch order |
| `ship.transform / follow / followBox` | Start position; follow box (halfX/halfZ), smooth edge "bounce" (`bounce.timeMs`) and smooth auto-recenter when idle (`recenter`: delay/still/accel/maxSpeed) toward the **Recenter Point** (`restLine.position`: X relative to the center, Z relative to the base `anchor.z + halfZ + z`); box position/style + center line (`centerLine`) + `restLine` marker (color/opacity, position/width/height) |
| `ship.visual` | Ship/thruster wireframe dimensions and colors |
| `camera` | FOV, initial position/rotation, near/far |
| `parallax.layers[]` | Per layer: count, star speed/scroll, `parallaxGain` (reaction to the camera Δ), position relative to the camera and grid rotation, grid size (`gridSize`) and opacity (`gridOpacity`), flight depths (`zNearWrap`/`zFar`) |
| `thruster` | Jet position/dimensions |

---

## Notes / state

- Spike owed to `phase-0-poc.md`: some features (coordinate label, portrait layout, follow box, gizmos) are **dev tools / previews** — no locked `*.spec.MD` requirement.
- **Weapons**: the modular architecture is complete (catalog + registry + behaviours + firing + collision + energy + laser levels). Test targets (`testTarget.ts`) exist only to validate collision/damage; real enemies and meteors are POC2 scope (`SDD-E01`/`SDD-E02`).
- **Not in POC-1** (all assigned to POC2 cards): Force Field / Integrity and damage resolution (`SDD-C03`, `SDD-F04`), score / kills / game over / restart (`SDD-G10`), pause and inventory (`SDD-G11`), drops and collection (`SDD-F02`), explosions and screen feedback (`SDD-F05`), scene flow (`SDD-G01`), audio (§7), persistence.
- The GDD and the planning live in `.docs/` — see the [documentation map](../README.md#18-documentation-map). Historically that folder was git-ignored; search with `rg --no-ignore "#tag/weapons" .docs` if your checkout still ignores it.
