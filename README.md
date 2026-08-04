# Ikarus Eternal Horizon
## Game Design Document (GDD) — v2.0

> Space shooter roguelite. Two-axis gameplay, 3D rendering, endless arcade pressure.

**Status:** pre-production (Gate G0) · **Stack:** TypeScript · Vite · Three.js  
**Operational source of truth:** `.docs/planning.spec.MD` (canonical names, decisions, gates, traceable requirements)

---

## 0. Technical Sheet

| Field | Detail |
|---|---|
| **Title** | Ikarus Eternal Horizon |
| **Genre** | Shooter roguelite / arcade shmup, 2.5D |
| **Perspective** | 3D rendering with **two-axis (X/Y) gameplay** — depth is visual only |
| **Tech** | TypeScript, Vite, HTML canvas, **Three.js** |
| **Visual style** | G0–G1: neon wireframe → G2+: low-poly flat-shaded neon |
| **Setting** | A single sector of open space: fleets, asteroid fields, bosses |
| **Modes** | **Normal** (full systems) · **Survivor** (one-shot from scratch) |
| **Play session** | Short, intense runs; no fixed ending — difficulty scales endlessly |
| **Platforms** | Web (Itch.io) → PC (Steam) |
| **Audience** | Arcade/shmup fans, short-session players, synthwave nostalgia |
| **References** | Star Fox 64 silhouettes, classic arcade shmups, synthwave/cyberpunk |

---

## 1. Synopsis and Pillars

### 1.1 Commercial Synopsis

> On the edge of a forgotten space sector, speed is your only armor.
>
> You pilot the **Ikarus Horizon**, a modular assault craft pushed through lethal asteroid fields and automated enemy fleets that never received a shutdown order. Your **Force Field** absorbs everything — until it doesn't. Once it collapses, hull damage starts eating your handling and your firepower.
>
> Harvest wreckage into **Energy** and equipment, build mid-run without ever leaving the fight for long, and choose what to spend: repair, firepower, or one devastating charge. Face MiniBosses every 50 kills, screen-filling Mega Asteroids every 100, and the Boss General every 500.
>
> Then do it again, faster. Weekly, monthly, annual, eternal — the leaderboard never forgets.

### 1.2 Design Pillars

1. **Visible risk, instant decisions** — Force Field, Integrity, Energy and resources are always readable.
2. **Tangible degradation, never binary punishment** — losing the shield changes the phase of play, it doesn't end the run.
3. **Progression without free time** — you pick a craft while paused, but **construction runs in real time**, one slot only. No powering up for free.
4. **Legibility at high speed** — silhouette and color must read the threat in under 0.3s.
5. **"One more kill" loop** — the run ends only on death; the goal is always the next milestone.
6. **Leaderboards as the meta** — Normal rewards system mastery, Survivor rewards raw skill.

### 1.3 Narrative Context (minimal, functional)

- **Sector:** the **Vangarde Sector**, an abandoned trade route left behind after an asteroid-mining megacorp collapsed.
- **The Pilot:** an independent pilot (anonymous by design, room for player projection) flying a prototype that rebuilds itself from combat wreckage.
- **The Enemies:** automated corporate security fleets — **Tanks**, **Warriors**, **Rogues** — that never got a deactivation order and grow more aggressive the more kills you rack up.
- **The Boss General:** the central command AI guarding the sector core.

Lore stays deliberately light: it flavors loading tips, store copy and achievement text without cutscenes. Open worldbuilding questions live in `.docs/lore-plan.spec.MD`.

---

## 2. Camera, Perspective and Play Space

- **Rendering:** real 3D scene (Three.js) with a fixed, tilted presentation angle that shows the ship's top face, rear thrusters and right side.
- **Gameplay plane:** free movement on **X and Y only**. Depth comes from scale and parallax — the player never flies "into" the screen; the world comes to them.
- **Playfield bounds:** safe margins for enemy spawns and HUD readability.
- **Parallax:** multiple background layers (stars, nebulae, station wreckage) at different speeds to sell velocity.

---

## 3. Controls and Interface

### 3.1 Control Scheme

| Action | Keyboard | Mouse |
|---|---|---|
| Movement | WASD or arrows | Pointer follow |
| Jet / thruster | J | — |
| Switch weapon | K | Scroll |
| Primary fire | L | Right click |
| Special Ordnance | — | Left click |
| Pause (inventory / craft / skills) | Esc | — |

Gamepad support (Xbox, PlayStation, Steam Deck) with remapping ships in **G3**: left stick moves, right trigger fires, bumper switches weapon, left trigger boosts, face button launches the special.

### 3.2 HUD

```
+-------------------------------------------------------------------+
| SCORE: 0098450 | KILLS: 142                        HIGH: 250000   |
|                                                                   |
|                 [Pilot Name]                                      |
|                 [INTEGRITY:  ||||||||||||    ]                    |
|                 [FORCE FIELD:||||||||||||||||]                    |
|                 [ENERGY:     |||||||||       ]                    |
|                 [Weapon: Laser | Nova Bomb x3 | Craft: 62%]       |
+-------------------------------------------------------------------+
```

- **Border HUD (fixed):** score, kills, high score of the current mode.
- **Floating HUD (follows the ship):** Integrity, Force Field, Energy, equipped weapon, special charges, resources, CraftSlot progress.
- **Damage feedback:** red vignette plus flicker on the bar that was hit; distinct SFX for shield hits versus hull hits.
- **Threat indicators:** edge arrows and an audio stinger before a MiniBoss or Mega Asteroid enters the field.

---

## 4. Core Mechanics

### 4.1 Ship Attributes

| Attribute | Role |
|---|---|
| **Integrity** (hull) | Health. Hits 0 → run over. Does **not** regenerate on its own |
| **Force Field** | Absorbs all damage until depleted; slow passive regen |
| **Speed** | Agility across the playfield |
| **Energy** | Operational fuel: weapons, jets and crafting all draw from it |
| **Weapon** | One active primary weapon slot |
| **Missiles** | Special Ordnance charges |
| **Inventory** | Resources and equipment |

**Jet/thruster:** temporary boost with its own reserve, recharging when unused.

### 4.2 Damage and Degradation

| State | Effect |
|---|---|
| Force Field > 0 | Absorbs shots, collisions and debris |
| Force Field = 0 | Damage hits Integrity |
| Hull level 1 | Gradual loss of agility |
| Hull level 2 | Reduced fire rate and efficiency |
| Hull level 3 | Ship adrift, minimal control |
| Integrity = 0 | Destruction — end of run |

### 4.3 Resources

| Resource | Rarity | Main use |
|---|---|---|
| **Metal Scrap** | Common | Hull repair, basic crafts |
| **Prismatic Crystal** | Uncommon | Weapon and tech projects |
| **Dense Core** | Rare | Advanced upgrades |
| **Dark Matter** | Special | High-tier recipes |
| **Equipment** | Epic | A ready-made item |

Fragments are pulled in by a magnet radius; collection has its own audio pitch per type.

### 4.4 Crafting and the Energy Economy

Everything active costs **Energy**.

| Rule | Value |
|---|---|
| Menu (inventory / craft / skills) | **Pause** |
| Build progress | **Real time**, continues once unpaused |
| Simultaneous CraftSlots | **1** — exclusive |
| Materials | Committed when the recipe starts |
| While a slot is busy | No other craft can begin |

Energy sources: **Reactive Panels** (slow passive gathering) and **Nuclear Reversor** (materials → Energy). The same pool feeds movement, fire and construction, so crafting during a heavy wave has to hurt.

### 4.5 Weapons

| Weapon | Profile | Rate | Damage | Energy |
|---|---|---|---|---|
| **Laser** (default) | Straight projectiles | High | Low | Minimal |
| **Plasma** | Slow orbs, medium AoE | Low | Medium (area) | Moderate |
| **Beam** | Continuous scaling DPS | Continuous | Scaling /s | High |
| **Mjolnir** | Piercing electric cone | Medium | High (cone AoE) | High |

### 4.6 Special Ordnance

| Special | Effect | Craftable item |
|---|---|---|
| **Pulse Nova** | Expanding wave: stuns common ships and destroys enemy projectiles | Nova Bomb |
| **Swarm Torpedo** | Multiple homing missiles on the nearest targets | Wasp Cluster |
| **Star Killer** | Gravity anomaly that pulls in ships, enemy fire and nearby asteroids, then detonates | Singularity Bomb |

### 4.7 Equipment

| Equipment | Effect |
|---|---|
| **Reactive Panels** | Generates Energy slowly and passively |
| **Nuclear Reversor** | Converts materials into Energy |
| **Gravity Assist Engine** | Raises movement speed with Jets |
| **Quantum Deflectors** | Raises Force Field capacity |
| **Laser Cannons** | Laser pulse count: 1, 2, 3, 5, 8, 13, 21 |
| **Plasma Cannon** | Larger plasma explosion radius |
| **Beam Emitter** | Wider beam, higher DPS |
| **Storm Maker** | Denser, longer, stronger Mjolnir |

### 4.8 Skills (Tech Tree)

Opened while paused. Three branches, expandable via DLC.

| Branch | Focus |
|---|---|
| **Engineering** | Max Integrity, speed, inventory space, lower craft energy cost |
| **Power Flow** | Lower Jet/weapon energy drain, faster Force Field regen |
| **Weaponry** | Damage, crit chance, fire rate, weapon effects |

---

## 5. Progression Loop and Difficulty

Difficulty scales with the **kill counter**, continuously and by milestone.

```
[  50 Kills] ──► MiniBoss (Tank, Warrior or Rogue) + escort
[ 100 Kills] ──► Mega Asteroid (25–33% of the screen)
[ 500 Kills] ──► Boss General + 2 MiniBosses + wave
[  post-500] ──► cycle repeats, varying attack patterns
```

Scaling past 500 must change **shot patterns**, not just HP and damage — repetition reads as unfairness.

---

## 6. Bestiary

### 6.1 Common Enemies

| Type | Behavior | Tactical role |
|---|---|---|
| **Tank** | Very tough, slow | Living shield, blocks lines of fire |
| **Warrior** | High projectile volume | Constant pressure, forces movement |
| **Rogue** | Fragile, fast, actively dodges | Lethal if ignored, demands precision |

Silhouette rule: each archetype must be recognizable in under 0.3s — Tanks wide and dense, Warriors balanced with visible gun points, Rogues thin wedges.

### 6.2 Environmental Obstacles

| Type | Behavior |
|---|---|
| Small / Medium / Large Asteroid | Inert drift; damage scales with size and density (Ice, Rocky, Metallic) |
| **Mega Asteroid** | Fills 25–33% of the screen, sheds fragments when hit, pays out heavily |

### 6.3 Bosses

| Boss | Traits |
|---|---|
| **MiniBoss Tank** | Extreme damage sponge, shields the squadron |
| **MiniBoss Warrior** | Insane fire rate, escorted |
| **MiniBoss Rogue** | Extreme speed, lethal bursts |
| **Boss General** | Peak durability, phased attack patterns, 2 MiniBosses plus a wave |

---

## 7. Modes, Scoring and Leaderboards

### 7.1 Game Modes

| Mode | Systems | Proposition |
|---|---|---|
| **Normal** | Craft, skills, full arsenal, equipment | Master the systems |
| **Survivor** | **One-shot from scratch**: base hull and shield, no inherited inventory, Laser only, craft and skills off | Pure skill |

### 7.2 Scoring

- Cumulative score for enemies, asteroids and events (MiniBoss, Mega Asteroid and Boss General are worth far more).
- **Multipliers** for performance, such as no-damage streaks and fast wave clears.

### 7.3 Leaderboards

Four time windows per mode — **8 boards total**, never mixed:

| Window | Reset |
|---|---|
| **Weekly** | Every week |
| **Monthly** | Every month |
| **Annual** | Every calendar year |
| **Eternal** | Never |

Canonical timezone is **UTC**; a run counts toward the window in which it ended. Local bests ship in G1, Steam boards in G3. Top ranks earn cosmetic titles and badges — never combat power.

### 7.4 Achievements

15 to 30 Steam achievements spanning kill goals, survival, efficiency (for example, clearing the Boss General without taking damage), mechanic exploration (using every weapon in one run) and Survivor milestones. Server-wide "first player in the world" achievements need a custom backend and are parked as post-1.0.

---

## 8. Meta-Progression

- **Persists between runs:** high scores, achievements, cosmetics (neon ship skins, thruster trail colors) and a light credits system for visual unlocks.
- **Does not persist:** weapons, equipment, resources, skills and hull damage — every run starts on equal footing so leaderboards stay fair.

---

## 9. Art Direction

### 9.1 G0–G1 — Wireframe Prototype

Neon wireframe blocks with no solid fill. The point is validating movement, collision, HUD readability and sense of speed — not fidelity.

### 9.2 G2+ — Low-Poly Retro-Futuristic

- Flat-shaded 3D models, aggressive angular silhouettes, no high-res textures.
- Neon glow on polygon edges and joints.
- Thrusters with light trails and dense particles.
- Distinct polygonal shapes per archetype for instant reading.
- Palette: deep blue/purple space, cyan/blue player ship, enemies color-coded (Tank amber, Warrior red, Rogue green/magenta), asteroids in metallic and ice tones with outline glow.

---

## 10. Audio

- **Soundtrack:** high-tempo synthwave; intensity shifts on MiniBoss, Mega Asteroid and Boss General events.
- **SFX:** percussive laser fire; clearly different shield-hit and hull-hit sounds; satisfying collection "ping" with pitch per resource; layered explosions that scale from common ships to the Boss General.
- **Warnings:** a distinct stinger before a Mega Asteroid or MiniBoss enters the field.

---

## 11. Feel and Performance

- **Screen shake** proportional to impact, with a hard intensity cap that never compromises readability.
- **Hit-stop** for a few frames on major impacts.
- **Parallax layers** of stars, planets and nebulae.
- **Object pooling** for bullets, particles, enemies and fragments; no per-frame allocation in update or collision paths. The worst case — a Mega Asteroid event during a full wave — must stay frame-stable.

---

## 12. Development Roadmap

Four product gates, each shipping a playable vertical slice.

| Gate | Deliverable | Exit criteria |
|---|---|---|
| **G0** Vertical Slice | Local playable prototype | X/Y movement, pooled Laser, one enemy, simple health, score, death and restart, wireframe visuals |
| **G1** Itch Prototype | Web build on Itch.io | `index.html` at root with relative paths and responsive canvas, Force Field vs Integrity, Metal Scrap repair in the CraftSlot, asteroid drops, local best score, essential audio, pooled bullets and particles |
| **G2** Professional Build | Full product | Complete bestiary, 50/100/500 milestones, Mega Asteroid, Boss General, full arsenal and Special Ordnance, Energy economy, Survivor mode, low-poly neon art, event audio, balance numbers locked |
| **G3** Steam 1.0 | Publishable PC build | Steam runtime, gamepad with remapping, 8 leaderboards, 15–30 achievements, Steam Cloud, store assets, Steam Deck checklist |

**Ordering rule:** never start required work for the next gate while the current one is incomplete, aside from short technical spikes.

### 12.1 Web Packaging Requirements (G1)

- Entry file must be `index.html` at the project root.
- Assets referenced only through relative paths (`./script.js`), never absolute local paths.
- Responsive canvas that adapts to the window without clipping the HUD or the playfield.

---

## 13. Design Risks and Validation

1. **Difficulty past 500 kills** — scale patterns, not just numbers.
2. **Drop rates** — too scarce breaks the repair loop, too generous kills the tension.
3. **Energy economy** — crafting, firing and boosting must genuinely compete.
4. **Hull damage curve** — how many hits per level, and how obvious each penalty feels.
5. **Weapon balance** — no weapon should be strictly dominant across contexts.
6. **Worst-case legibility** — Mega Asteroid plus a full wave must stay readable.
7. **Leaderboard fairness** — Normal and Survivor must never share a board.

---

## 14. Documentation Map

Detailed, versioned planning lives in `.docs/`, with `#tag/*` markers for fast search. That folder is currently git-ignored, so searches need `rg --no-ignore "#tag/weapons" .docs`.

| Document | Scope |
|---|---|
| `planning.spec.MD` | Hub: canonical names, decisions, systems map, gates, requirement index |
| `spaceship-plan.spec.MD` | Ship attributes, Energy, CraftSlot, skills, controls |
| `weapons-plan.spec.MD` | Primary weapons and Special Ordnance |
| `resources-plan.spec.MD` | Drop table and collection economy |
| `equipments-plan.spec.MD` | Equipment and craft recipes |
| `enemys-plan.spec.MD` | Bestiary, bosses, asteroids |
| `game-rules-plan.spec.MD` | Run loop, damage rules, HUD, performance, packaging |
| `ranking-plan.spec.MD` | Leaderboards and Survivor mode |
| `achievements-plan.spec.MD` | Steam achievements and stats |
| `lore-plan.spec.MD` | Open worldbuilding questions |

Requirements are traceable per domain (`SHIP-01`, `WPN-04`, `RUL-09`, …) and feed task generation.

---

*Living document. Sections 4, 5, 7 and 13 get revisited after the first G1 playtests.*
