# Ikarus Eternal Horizon
## Game Design Document (GDD) — v1.0

---

## 0. Technical Sheet

| Field | Detail |
|---|---|
| **Title (provisional)** | Ikarus Eternal Horizon |
| **Genre** | Shoot 'em Up (Shmup) / Retro-Futuristic 2.5D Arcade |
| **Platforms** | Web (Itch.io — prototype) → PC (Steam) |
| **Perspective** | Pseudo-3D, two-point vanishing projection |
| **Visual Style** | Phase 2: Neon Wireframe → Phase 3+: Low-Poly Flat-Shaded Neon |
| **References** | Star Fox 64 designs, classic arcade shmups, synthwave/vaporwave aesthetic | Cyberpunk vibes
| **Play Session** | Short, intense runs (arcade loop, no fixed ending — difficulty scales infinitely) |
| **Target Audience** | Arcade/shmup fans, short-session players, retro-futuristic nostalgia |

---

## 1. Synopsis and Design Pillars

### 1.1 Commercial Synopsis

> On the edge of a forgotten space sector, speed is your only armor.
>
> In *Ikarus Eternal Horizon*, you take control of an advanced assault craft in a desperate push through lethal asteroid fields and relentless enemy fleets. Navigate a uniquely perspectived three-dimensional space where every enemy shot and every giant meteor on the horizon demands sharp reflexes and absolute precision.
>
> As your energy shield is drained to zero, the battle becomes a fight for survival: hull damage directly affects your craft's maneuvering systems and firepower. Collect resources from the wreckage of destroyed squadrons to repair your systems, reinforce your defenses, and craft devastating munitions mid-combat.
>
> Face hordes of tactical ships, dodge megameteors that fill the horizon, and confront lethal MiniBosses until the final showdown against the Boss General. Do you have what it takes to master the depths of space and carve your name onto the eternal leaderboard?

### 1.2 Narrative Context (Functional Minimal Lore)

An arcade shmup doesn't need a dense narrative, but it benefits from a "why" that justifies the infinite loop, resources, and enemies.

- **Sector:** An ancient interstellar trade route abandoned after the collapse of an asteroid-mining megacorporation — the **Vangarde Sector**.
- **The Pilot:** An independent pilot (customizable/anonymous, leaving room for player projection) flying the **Ikarus Horizon**, a modular ship prototype that adapts ("crafts" in real time) using wreckage from the fight itself.
- **The Enemies:** Automated remnants of corporate security fleets (**Tanks**, **Warriors**, **Rogues**) that never received a deactivation order — they patrol the sector forever, growing more aggressive the more kills you rack up (justifying infinite power creep: the swarm reacts to your presence).
- **The Boss General:** The central command AI of the old fleet, guarding the sector's core.

This lore is deliberately light — it flavors loading screens, Steam store page copy, and possible achievement text without requiring cutscenes or dialogue.

### 1.3 Design Pillars

1. **Visible risk, instant decisions** — the player always knows their state (shield/hull/resources) and makes split-second calls: shoot, dodge, or bank to collect a resource.
2. **Tangible degradation, never binary punishment** — losing the shield isn't "game over"; it's a shift in play phase (a wounded ship, still playable, more tense).
3. **Progression without pause** — all crafting/repair happens in real time, inside the action, with no menus that break the flow.
4. **Legibility at high speed** — enemy silhouettes, neon colors, and threat readability must work even at 100% game speed.
5. **"One more kill" loop** — like any arcade game, the session ends only when the player dies; the goal is always the next milestone (50/100/500 kills).

---

## 2. Camera, Perspective, and Play Space

- **Projection:** Pseudo-3D vector graphics rendered in Canvas 2D (or equivalent WebGL in the Steam version), with two vanishing points simulating depth.
- **Fixed player-ship angle:** A tilt that simultaneously reveals the top face (hatch/cockpit), the rear (thrusters), and the right side — the ship's visual signature.
- **Play plane:** Free movement on the projected X and Y axes; the sense of Z depth comes from scale/parallax, not from real movement along that axis (the player does not manually fly "into the screen" — the world comes to them, classic vertical/horizontal shmup with a 3D skin).
- **Screen bounds (Playfield Bounds):** Play area with a safety margin at the edges for enemy spawns and HUD readability; obstacles and enemies enter from the top/sides according to wave design.
- **Background parallax:** Multiple layers (distant stars, nebulae, station wreckage) at different speeds reinforcing the sense of high velocity.

---

## 3. Controls and Interface

### 3.1 Control Scheme (Keyboard + Mouse)

| Action | Keyboard | Mouse |
|---|---|---|
| Movement | WASD or Arrow Keys | Pointer (ship follows the cursor) |
| Boost / Thruster (Jet) | J *(consumes energy, does not fire)* | — |
| Switch Weapon | K | Mouse Scroll |
| Laser Fire (Basic) | L | Right Click |
| Launch Bomb | — | Left Click |
| Menu / Inventory / Pause | Esc | — |

> **Phase 7** adds native support for **Xbox, PlayStation, and Steam Deck**, with remapping of:
> - Left stick → movement
> - Right trigger → fire
> - Bumper → switch weapon
> - Left trigger → jet/thruster
> - Face button → bomb

### 3.2 HUD (Heads-Up Display)

Two interface layers, blending **retro arcade** (fixed) and **floating MMO** (contextual) styles:

```
+-------------------------------------------------------------------+
| SCORE: 0098450 | KILLS: 142                        HIGH: 250000   |
|                                                                   |
|                                                                   |
|                 [Player Name]                                     |
|                 [HP:  ||||||||||||    ]                           |
|                 [SHD: ||||||||||||||||]                           |
|                 [Weapon: Laser Lvl 2 | Bombs: 3]                  |
|                                                                   |
+-------------------------------------------------------------------+
```

- **Border HUD (fixed, top of screen):** Retro/arcade neon font — current score, kill count, current high score.
- **Dynamic Player HUD (floating, follows the ship):** Player name, HP bar (hull), shield energy bar (slightly transparent), equipped weapon icons, and bomb/resource count.
- **Damage feedback:** Red vignette at the screen edges + flicker on the matching bar when shield/hull is hit.
- **Off-screen threat indicators:** Arrows/icons at the edges signaling an approaching MiniBoss or Mega Asteroid before they enter the field of view.

---

## 4. Core Mechanics

### 4.1 Movement and Player Ship

- Ship in a block/box shape (Phase 2), evolving into a faceted polygonal model (Phase 3+).
- Free X/Y movement with light inertia (drift) to add weight without hurting responsiveness.
- **Jet/Thruster:** Temporary speed boost that consumes its own energy reserve (separate from the shield), recharging gradually when unused.

### 4.2 Shield and Hull System

| State | Effect |
|---|---|
| **Shield 100% → 1%** | Absorbs all damage (shots, collisions, debris, asteroids). No penalty to the ship. |
| **Shield 0%, Hull intact** | Damage begins affecting the hull directly. |
| **Hull Damage Level 1** | Gradual loss of agility/movement speed. |
| **Hull Damage Level 2** | Reduced fire rate and firing efficiency. |
| **Hull Damage Level 3** | Ship adrift — minimal control, imminent destruction. |
| **Hull at 0%** | Ship destruction — end of run. |

- The shield regenerates slowly over time (low passive regen) and can be **actively repaired** with collected resources (partial instant repair).
- Hull damage **does not regenerate on its own** — only via resource repairs, reinforcing the rising tension of a long run.

### 4.3 Resource Collection and Real-Time Crafting

- Destroyed enemies and asteroids drop **Resource Fragments** (collectible particles, lightly attracted toward the ship within a "magnet" radius).
- **Resource types (expansion proposal over the original material):**
  - **Structural Alloy** (common asteroid drop) → hull repair.
  - **Energy Core** (common ship drop) → shield repair/recharge.
  - **Tactical Component** (rare MiniBoss drop) → craft bombs and weapon upgrades.
- **Real-time craft:** once the required threshold of a resource is reached, the player can activate it (contextual key or automatic at 100%) without opening a menu, keeping the action flowing.
- Unused resources **slowly decay** if the player goes too long without taking damage or crafting (light anti-hoarding pressure), or have a storage cap (to be defined in playtest).

### 4.4 Weapons and Combat Progression

- **Default weapon:** Laser (straight-fire, medium rate of fire).
- **Weapon switch:** Cycles through the arsenal unlocked/crafted during the run (e.g. laser, spread shot, homing missile — to expand in Phase 3).
- **Bombs:** Limited resource, area damage, useful against megameteors and swarms — restocked via crafting.
- **In-run upgrades:** Temporary weapon improvements tied to rare resources (do not persist between runs, reinforcing the arcade character — between-run persistence is limited to cosmetic/leaderboard meta-progression; see section 8).

---

## 5. Progression Loop and Difficulty

Difficulty scales with the **kill counter**, both continuously (speed, durability, and enemy variety gradually increase) and by **milestones** (special events):

```
[50 Kills]  ──► MiniBoss (Warrior, Rogue, or Tank) + escort
[100 Kills] ──► Mega Asteroid (occupies up to 33% of the screen)
[500 Kills] ──► Boss General + 2 MiniBosses + Escort
```

- **Every 50 kills:** Random MiniBoss (Warrior, Rogue, or Tank) with an escort of smaller ships.
- **Every 100 kills:** Environmental event — Giant Meteor covering 25–33% of the screen, forcing repositioning while you destroy the fragments it sheds.
- **Every 500 kills:** SuperBoss Event — Boss General + 2 MiniBosses + large wave of small ships.
- **Subsequent cycles (after 500):** the 50/100 milestones keep repeating with progressively stronger enemies (stat and shot-pattern variation), and the 500 milestone scales in difficulty each time (e.g. 500, 1000, 1500...) — the exact power-scaling curve should be tuned in playtest (see section 11).

---

## 6. Bestiary

### 6.1 Common Enemies

| Type | Behavior | Tactical Role |
|---|---|---|
| **Tank** | Very tough, slow | Living shield, protects other ships, blocks line of fire |
| **Warrior** | Firepower-focused, high projectile volume | Constant pressure, forces player movement |
| **Rogue** | Fragile, fast, actively dodges | Few shots, but lethal; demands precision and timing |

### 6.2 Environmental Obstacles

| Type | Behavior |
|---|---|
| **Small/Medium/Large Asteroid** | Inactive, drifting; damage scales with size/density (Ice, Rocky, Metallic); good resource drops |
| **Mega Asteroid** | 25–33% of the screen; very tough; when hit, launches smaller asteroids; when destroyed, grants massive resources and score |

### 6.3 Bosses and Sub-Bosses

| Boss | Traits |
|---|---|
| **MiniBoss Warrior** | Very tough, insane fire rate, escorted |
| **MiniBoss Rogue** | Extreme speed, lethal and rapid shots |
| **MiniBoss Tank** | Extreme damage sponge, serves as a shield for the squadron |
| **Boss General** | Maximum challenge — extreme durability, complex attack patterns, accompanied by 2 MiniBosses + small ships |

> **Silhouette guideline:** each archetype must be recognizable in under 0.3s on screen, even at high speed — Tanks = wide, dense forms; Warriors = balanced forms with many visible firing points; Rogues = thin, aerodynamic, "wedge"-like forms.

---

## 7. Scoring, Leaderboards, and Achievements

### 7.1 Scoring

- Cumulative score for destroying enemies, asteroids, and completing events (MiniBoss, Mega Asteroid, and Boss General are worth significantly more).
- **Multipliers/boosts** triggered by performance (e.g. destroying targets in a row without taking damage — "no-damage streak" — or clearing a wave quickly).

### 7.2 Leaderboards

- **Local** boards (saved in browser/PC) and **Cloud** boards (Steam, Phase 8).
- Categories: **Weekly, Monthly, Annual, Eternal (All-Time)**.
- In-game rewards/recognition tied to top leaderboard ranks (cosmetic title, profile badge).

### 7.3 Achievements (Phase 9)

- 15 to 30 fun, varied achievements: kill goals, survival, efficiency (e.g. "Defeat the Boss without taking damage"), mechanic exploration (e.g. "Use every weapon in a single run").
- **Unique/Global Achievements:** tied to server milestones, e.g. *"The First Pilot"* — first global player to destroy the Mega Asteroid.

---

## 8. Meta-Progression (Between Runs)

> Point not detailed in the original material — proposal for a minimal structure that gives a sense of progress without undermining the "short, intense run" arcade character:

- **Persistent between runs:** high scores, achievements, unlocked cosmetics (alternate neon ship skins, differently colored thruster trails), perhaps a simple "credits" system earned per run to unlock visual variants.
- **Not persistent:** weapon upgrades, resources, hull damage level — everything resets each run, keeping the challenge equal for fair leaderboard purposes.

---

## 9. Art Direction

### 9.1 Phase 2 — Wireframe Prototype

- Ships and enemies represented as **neon wireframe boxes/blocks**, with no solid fill.
- Total focus on validating gameplay, collision, HUD readability, and sense of movement — not visual fidelity.

### 9.2 Phase 3+ — Low-Poly Retro-Futuristic (Star Fox 64 style)

- **Ships (player and enemies):** flat-shaded 3D models, no high-resolution textures, aggressive angular silhouettes.
- Same perspective and angle as Phase 2 (top + rear + right side), now with three-dimensional detail: angled wings, faceted cockpits, thruster openings, and exposed weapons.
- **Neon/Glow shaders** on polygon edges and joints, tying lighting into the space theme.
- **Thrusters:** light trails and dense particles from geometric exhausts.
- **Bestiary:** distinct polygonal forms per archetype (Rogues with thin wedge wings; Tanks with dense, faceted structures) for instant readability in combat.
- **Meteors:** irregular geometries with multiple semi-mirrored faces reflecting shot light.
- **Suggested color palette:** deep blue/purple space background; player ship in neon cyan/blue; enemies color-coded by archetype (e.g. Tank = orange/amber, Warrior = red, Rogue = green/magenta) for instant tactical reading; asteroids in neutral metallic/ice tones with outline glow.

---

## 10. Audio (Guideline — not detailed in the original material)

- **Soundtrack:** instrumental synthwave/retrowave, high tempo, intensity varying with events (MiniBoss, Mega Asteroid, and Boss General get their own themes or intensity variations).
- **SFX:**
  - Laser fire: short, percussive sound with light spatial reverb.
  - Shield hit vs. hull hit: distinct sounds (the latter more "metallic"/damaged) to reinforce state reading without relying only on the HUD.
  - Resource collect: satisfying "ping," with pitch variation by resource type.
  - Explosions: different layers for common ships, MiniBosses, and Boss General (the Boss explosion should be a larger audio/visual event, with a light impact pause — "juice").
- **Warning audio feedback:** distinct sonic stinger when a Mega Asteroid or MiniBoss is about to enter the field.

---

## 11. "Juice" and Polish (Feel)

- **Screen Shake:** proportional to explosion force/damage taken; must never compromise playfield readability (hard intensity cap).
- **Thruster particles:** continuous emission from the rear face, intensified while Jet is in use.
- **Space parallax:** layers of stars/planets/nebulae at different speeds.
- **Light hit-stop** (a few frames of pause) on major impacts (MiniBoss/Boss) to give weight to the hit.
- **Performance guideline:** clean particle loop with object pooling and active removal of dead particles from memory — critical to keep a stable framerate in large waves (especially Mega Asteroid events, which spawn many simultaneous fragments).

---

## 12. Development Roadmap

| Phase | Deliverable |
|---|---|
| **Phase 1** | Scope, rules, and GDD (this document) |
| **Phase 2** | Concept validation — controllable prototype: movement, shooting, random enemies, wireframe aesthetic |
| **Phase 3** | Refinement — shots, explosions, background (3D space objects), final low-poly art, point collection |
| **Phase 4** | Packaging for Itch.io (`index.html` at root, relative paths, responsive canvas) |
| **Phase 5** | Full resource collection and real-time crafting system |
| **Phase 6** | Portability and packaging for Steam |
| **Phase 7** | Full gamepad support (Xbox, PlayStation, Steam Deck) |
| **Phase 8** | Online leaderboards via Steam API |
| **Phase 9** | Achievement system (15–30 achievements) |
| **Phase 10** | Steam Cloud Save (audio/video settings and high scores) |

### 12.1 Technical Requirements — Phase 4 (Itch.io)

- Main file must be named `index.html`.
- No absolute paths — all assets (scripts, styles, sounds) referenced via relative paths (`./script.js`, `./style.css`), never local system paths (`C:/Users/...`).
- Responsive canvas that adapts to window size without clipping the HUD or playable area on smaller screens.

---

## 13. Design Risks and Playtest Validation Points

> Section added to close the GDD with a critical view — points the original document does not yet define numerically and that need tuning:

1. **Difficulty curve after 500 kills:** how to scale infinitely without becoming unfair or repetitive (shot-pattern variation, not just "more HP/more damage").
2. **Resource drop-rate balance:** too scarce and the repair loop breaks; too plentiful and hull-damage tension disappears.
3. **Resource storage cap and decay:** define whether they exist, and at what rate, to avoid risk-free passive stockpiling.
4. **Hull damage curve:** how many hits at each "Level" (1/2/3) before destruction, and whether that changes with upgrades.
5. **Weapon-switch frequency vs. arsenal balance:** ensure no weapon is strictly dominant.
6. **Legibility at peak screen clutter** (Mega Asteroid + simultaneous enemy wave): test whether HUD and colors stay readable in the worst visual pollution case.

---

*Living document — sections 5, 8, and 13 should be reviewed after the first playable Phase 2 tests.*
