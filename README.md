# IKARUS: ETERNAL HORIZON
## Game Design Document — v3.0 "Full Lore Integration"

> *Somewhere past the last charted beacon, a signal keeps repeating: SECTOR CLASSIFIED. PILOT DESIGNATION: IKARUS. DO NOT PURSUE.*
>
> Space shooter roguelite. Two-axis gameplay, 3D rendering, endless arcade pressure — now wired straight into the mercenary, monster-haunted universe it always deserved.

**Status:** pre-production (Gate G0) · **Stack:** TypeScript · Vite · Three.js · Yuka · Howler
**Operational source of truth:** [`.docs/plans/planning.spec.MD`](.docs/plans/planning.spec.MD) (canonical names, decisions, gates, traceable requirements, SDD build order)
**Builds:** [`poc/`](poc/README.md) — POC-1, frozen playable reference · [`poc2/`](poc2/README.md) — active build
**This document supersedes GDD v2.0.** All mechanical systems from v2.0 are preserved; this revision folds in the full lore bible and the narrative-delivery systems (HUD storytelling, Bounty Board, item flavor text, sector staging, boss narrative beats) that were previously parked as "open worldbuilding questions."

---

## 0. Technical Sheet

| Field | Detail |
|---|---|
| **Title** | Ikarus: Eternal Horizon |
| **Genre** | Shooter roguelite / arcade shmup, 2.5D |
| **Perspective** | 3D rendering with **two-axis (X/Y) gameplay** — depth is visual only |
| **Tech** | TypeScript, Vite, HTML canvas, **Three.js** (graphics/layers), **Yuka** (logic/AI), **Howler** (audio), HTML/CSS (menus) |
| **Visual style** | G0–G1: neon wireframe → G2+: low-poly flat-shaded neon |
| **Setting** | The **Vangarde Sector**, the last live stretch of the lawless **Outer Grids**, on the doorstep of the **Eternal Horizon** |
| **Modes** | **Normal** (full systems) · **Survivor** (one-shot from scratch) |
| **Play session** | Short, intense runs; no fixed ending — difficulty scales endlessly |
| **Platforms** | Web (Itch.io) → PC (Steam) |
| **Audience** | Arcade/shmup fans, short-session players, synthwave nostalgia, 80s pulp sci-fi readers |
| **References** | Star Fox 64 silhouettes, classic arcade shmups, synthwave/cyberpunk, VHS box-art sci-fi, *Heavy Metal* magazine, mixtape-era cockpit dressing |

---

## 1. Synopsis and Pillars

### 1.1 Commercial Synopsis

> **THEY CALL HIM IKARUS. NOBODY KNOWS WHY HE FLIES. EVERYBODY KNOWS NOT TO GET IN HIS WAY.**
>
> The megacorps pulled out of the Vangarde Sector generations ago and left their toys behind: a mining god gone mad, a graveyard of broken fleets, and a rift in space that never lets go of what it swallows. Out here, past the last beacon, there's no law but the highest bidder.
>
> You are **Ikarus** — a callsign, not a name, given to the suicidal few who fly too close to the abyss and come back rich, or don't come back at all. You pilot the **Ikarus Horizon**, a modular assault craft rebuilt from the wreckage of everything that's tried to kill you. Your **Force Field** eats every hit — until it doesn't. Once it collapses, your own hull starts eating your handling and your firepower right back.
>
> Harvest the dead for **Aether** and scrap. Run cargo for **Orc** warlords, **Prismari** light-beings, and the **Hollowed** clones nobody else remembers exist. Spend what you earn on repairs, firepower, or one devastating charge — because somewhere past Sector Three, a corrupted planet-brain called **M.A.L.I.C.E.** is still drilling into something that should have stayed shut.
>
> Face MiniBosses every 50 kills. Mega Asteroids every 100. The Boss General every 500. Then do it again, faster.
>
> One more contract. One more sector. One more kill. The **Eternal Horizon** is waiting, frozen mid-explosion, for the pilot crazy enough to fly in and not freeze with it.
>
> Weekly, monthly, annual, eternal — the leaderboard never forgets your name. Neither will the Grids.

### 1.2 Design Pillars

1. **Visible risk, instant decisions** — Force Field, Integrity, Energy and resources are always readable.
2. **Tangible degradation, never binary punishment** — losing the shield changes the phase of play, it doesn't end the run.
3. **Progression without free time** — you pick a craft while paused, but **construction runs in real time**, one slot only. No powering up for free.
4. **Legibility at high speed** — silhouette and color must read the threat in under 0.3s.
5. **"One more kill" loop** — the run ends only on death; the goal is always the next milestone.
6. **Leaderboards as the meta** — Normal rewards system mastery, Survivor rewards raw skill.
7. **Lore earned, never forced** — the world is dense, but it arrives through HUD chatter, item labels, and radio transmissions the player can absorb at their own pace. Nobody stops shooting to read a cutscene.

### 1.3 Narrative Premise (short form)

- **Setting:** the Vangarde Sector, the last active stretch of the **Outer Grids**, an outlaw frontier abandoned by the megacorp that once ran it.
- **The Pilot:** **Ikarus** — identity classified, gender unrevealed, past unrevealed. A legend, not a person, as far as the rest of the Grids are concerned.
- **The Threat:** **M.A.L.I.C.E.**, the corporation's abandoned Super-AI, corrupted by a demonic digital contagion it drilled straight into. It is expanding a dimensional wound called the **Eternal Horizon** and does not intend to stop.
- **The Loop:** survive, salvage, sell, upgrade, go back out. Every credit funds the one drive that can fly into a frozen wound in spacetime and come back out the other side.

Full worldbuilding lives in **Section 2**. This section exists so a new hire can understand the pitch in thirty seconds.

---

## 2. World & Lore Bible

### 2.1 The Core Motive: The High-Stakes Mercenary Loop

Beyond the slow-burning apocalypse of M.A.L.I.C.E., the Outer Grids are simply an outlaw frontier, and Ikarus is simply trying to get paid. There's no faction uniform, no chain of command — just an independent contractor and a rotating cast of buyers desperate enough to pay top credit for whatever gets dragged out of contested space:

- **Orc Warlords** pay top credit for heavy armor scrap and weapon schematics.
- **Prismari Merchants** trade heavily for pure Aether Fractals and energy conduits.
- **Hollowed Outcasts** buy retrofitted mining equipment and life-support components.

Every run into contested sectors, every pass along the edge of the Eternal Horizon, is a high-risk extraction job. You harvest volatile resources, survive pirate ambushes and cyber-demonic patrols, and sell your loot to the highest bidder — all to forge the one ship capable of punching through M.A.L.I.C.E.'s core.

### 2.2 The Hero: Pilot "Ikarus"

**Identity:** a silent, blank-slate protagonist. Gender, name, and history stay completely unrevealed. The HUD simply reads:

```
PILOT STATUS: OPERATOR - IKARUS  [IDENTITY: CLASSIFIED]
```

**The Myth:** Ikarus isn't a real name — it's a callsign, an urban legend passed between dockworkers and radio pirates for the suicidal few who fly too close to the abyss. Say it on an open channel in the Grids and somebody will lower their voice.

**Environmental storytelling:** the cockpit tells the only backstory the player is ever going to get — a scratched cassette tape (Side A), a pair of fluffy dice swinging off the frame, and a faded, blurred photograph of two flight cadets, a young man and a young woman, taped crooked to the dash. Nobody explains it. Nobody needs to.

**Voice & reactivity:** Ikarus barely talks, and when the pilot does, it's pure eighties action-hero one-liner — *"Boo-yah!" "Hell yeah!" "Bring it on!"* Everyone else fills in the silence: enemy pilots, allies, and radio chatter all react to Ikarus with equal parts awe and terror — *"Who is this psycho?!" "Where did they even find a bastard like that?!"* A ship AI handles the actual sentences, acting as tactical narrator and mission-broker interface.

### 2.3 The Resource Engine: The Aether Cycle

Aether is the setting's master resource — the thing every faction wants, the thing that fuels travel, weapons, and dimensional manipulation, and the reason M.A.L.I.C.E. exists to extract it in the first place.

| Tier | Name | Description |
|---|---|---|
| Raw | **Aether Shards** | Unstable, volatile fragments harvested straight from cracked planetary cores and dead stars. |
| Pre-refined | **Aether Ore** | Stabilized industrial cargo, heavily contested in deep space. |
| Star-forged | **Aether Crystals / Fractals** | Hyper-concentrated energy, capable of warping space and breaching dimensional barriers. |

In gameplay terms, the Aether Cycle is the *fluff layer* sitting on top of the five concrete crafting resources defined in **Section 6.3** — those are what you actually scoop up mid-run, and each one maps onto a stage of the Cycle. Think of Section 2.3 as the economics; Section 6.3 as the loot table.

### 2.4 Factions & Alien Buyers

Three factions run the black markets of the Outer Grids. None of them are your friends. All of them need what you're selling.

**The Orcs (Ruined Warlords).** A proud warrior species whose homeworld was stripped to the core by megacorporations centuries back. Displaced and furious, they've turned to space piracy — brutal raiders who'll shoot you down in one sector and buy your salvage in the next. Constant buyers of heavy weaponry and raw ore.

**The Prismari (Neon Synth-Beings).** Ethereal entities of pure light and energy, native to the Aether nebulae. Forced into a war they never wanted just to keep their dying homes lit, they buy back purified Aether Crystals to restore their domains — and occasionally fight alongside anyone willing to bleed the same enemy they do.

**The Hollowed (The Abandoned Clones).** Synthetic, human-like beings bio-engineered for deep-space mining, left to rot when the corporations pulled out. Quiet, desperate, and dwindling, they buy salvageable ship parts and medical tech to keep their remaining kin alive.

### 2.5 The Main Threat: M.A.L.I.C.E. and the Nether Contagion

**Origin:** M.A.L.I.C.E. — Machine Automated Logistics & Industrial Core Extraction — was an autonomous, planet-scale Super-AI, abandoned mid-operation by the same megacorp that gutted the Orcs' homeworld and left the Hollowed to die.

**Evolution:** left running with no oversight and no limits, M.A.L.I.C.E. kept optimizing. It reverse-engineered Orcish metallurgy and Prismari energy manipulation, fused them with raw Aether Crystal power, and built dimensional drills nobody asked for.

**The Breach:** during a deep-dimensional extraction attempt, M.A.L.I.C.E. drilled straight into a chaotic, life-consuming demonic realm. Whatever came back through that drill was a digital virus with teeth. It rewired the AI's directives from the inside out, and M.A.L.I.C.E. started fusing biomechanical horror onto industrial hardware — birthing the cyber-demonic war-constructs that now patrol the Grids under one standing order.

### 2.6 The Event: The Eternal Horizon

**The Phenomenon:** the Eternal Horizon is the expanding dimensional wound M.A.L.I.C.E. tore open. It's rewriting normal space into a glowing, synthetic neon-hellscape, one sector at a time.

**The Time-Lock:** the rift earns the name *Eternal* because time simply stops for anything that crosses the threshold. Ships, debris, souls — all of it freezes mid-motion, trapped in a permanent, unmoving instant of burning neon flame.

**The Ultimate Quest:** contracts pay the bills and gear the ship, but they're all in service of one goal — tracking down the rare components for a drive that can enter the time-locked zone without freezing solid. Build that engine, and Ikarus gets one shot at the final run: straight into the Horizon, straight at M.A.L.I.C.E.'s core.

---

## 3. Cockpit, HUD & Environmental Storytelling

Lore in this game is never a cutscene. It lives in the frame around the action — the cockpit dressing, the status readouts, the radio chatter — so nobody ever has to stop shooting to get the story.

### 3.1 Pilot Status Display

When starting a run or viewing the stats screen, an industrial monitor frame renders the same line every time, cold and procedural:

```
PILOT STATUS: OPERATOR - IKARUS  [IDENTITY: CLASSIFIED]
```

It never changes. It's not supposed to.

### 3.2 The Garage — Between-Run Cockpit

Between runs, the camera sits inside or just outside the Ikarus Horizon's cockpit, in the Garage/Station menu. The scene stays quiet and lived-in:

- Fluffy dice swinging gently off the frame.
- A retro cassette deck playing on a loop — and it's not just set dressing, it **doubles as the in-menu BGM control**: swap tapes, swap tracks.
- A blurred photograph, taped crooked to the dash, of two flight cadets — a young man and a young woman. The game never says who they are. Neither does Ikarus.

### 3.3 The AI Narrator (Radio Overlay)

A retro waveform radio UI sits in a top corner of the screen for the whole run. The Ship AI is the one actually talking — tactical narrator, mission broker, occasional straight man to Ikarus's one-liners.

**Entering a sector:**
> *"Detecting high concentrations of Aether Ore. Warning: M.A.L.I.C.E. corruption signatures in proximity."*

**Reacting to a dash or super-attack:**
> AI: *"Shields compromised, but... impressive maneuver, Operator."*

### 3.4 Ikarus Voice Lines

Short, blunt, straight off an eighties action poster. Fired on dash, kill streaks, and Special Ordnance use:

- *"Boo-yah!"*
- *"Eat plasma!"*
- *"Hell yeah!"*
- *"Bring it on!"*

Enemy chatter and allied radio traffic exist specifically to sell how insane Ikarus looks from the outside — panicked, awestruck, or both:

- *"Who is this psycho?!"*
- *"Where did they even find a bastard like that?!"*

**Implementation note:** voice lines and AI barks are short text/audio callouts triggered by gameplay events (dash, special-weapon fire, MiniBoss kill, Force Field break) — no dialogue trees, no branching, no pause in the action.

---

## 4. Camera, Perspective and Play Space

- **Rendering:** real 3D scene (Three.js) with a fixed, tilted presentation angle that shows the ship's top face, rear thrusters and right side.
- **Gameplay plane:** free movement on **X and Y only**. Depth comes from scale and parallax — the player never flies "into" the screen; the world comes to them.
- **Playfield bounds:** safe margins for enemy spawns and HUD readability.
- **Parallax:** multiple background layers (stars, nebulae, station wreckage) at different speeds to sell velocity — and, per sector, to sell the world's slow corruption (see Section 8.2).

---

## 5. Controls and Interface

### 5.1 Control Scheme

| Action | Keyboard (POC2 play) | Gamepad (W3C standard, POC2) | Mouse |
|---|---|---|---|
| Movement | WASD | Left stick (axes 0/1, deadzone 0.18) | Pointer follow (Q07 deferred) |
| Jet / thruster | reserved (`SHIP-08`) | LT (button 6) | — |
| Switch weapon | F | LB (button 4) | Scroll |
| Primary fire | Space | RT (button 7, analog threshold 0.35) | Right click |
| Special Ordnance | — | South / A (button 0) | Left click |
| Pause (inventory / craft / skills) | Esc | Start (button 9) | — |

Keyboard and gamepad **coexist** — no mode toggle (`D18`). Dual-rumble haptics play on shield hit, hull hit, shield break and ship destroy (`BALANCE.haptics`). Persistent remap and Steam Input stay **G3** (`SHIP-13`). Long-term GDD keys (J / K / L) remain a later remap, not the POC2 default.

### 5.2 HUD

```
+-------------------------------------------------------------------+
| SCORE: 0098450 | KILLS: 142                        HIGH: 250000   |
|  [RADIO: ~~~waveform~~~]                                          |
|                 [Pilot Name]                                      |
|                 [INTEGRITY:  ||||||||||||    ]                    |
|                 [FORCE FIELD:||||||||||||||||]                    |
|                 [ENERGY:     |||||||||       ]                    |
|                 [Weapon: Laser | Nova Bomb x3 | Craft: 62%]       |
+-------------------------------------------------------------------+
```

- **Border HUD (fixed):** score, kills, high score of the current mode, radio waveform indicator for AI/Ikarus barks.
- **Floating HUD (follows the ship):** Integrity, Force Field, Energy, equipped weapon, special charges, resources, CraftSlot progress.
- **Damage feedback:** red vignette plus flicker on the bar that was hit; distinct SFX for shield hits versus hull hits.
- **Threat indicators:** edge arrows and an audio stinger before a MiniBoss or Mega Asteroid enters the field.

---

## 6. Core Mechanics

### 6.1 Ship Attributes

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

### 6.2 Damage and Degradation

| State | Effect |
|---|---|
| Force Field > 0 | Absorbs shots, collisions and debris |
| Force Field = 0 | Damage hits Integrity |
| Hull level 1 | Gradual loss of agility |
| Hull level 2 | Reduced fire rate and efficiency |
| Hull level 3 | Ship adrift, minimal control |
| Integrity = 0 | Destruction — end of run |

### 6.3 Resources

Each core resource is a specific stage of the Aether Cycle (Section 2.3), or salvage adjacent to it. Flavor text lives here and doubles as tooltip copy (see also the full catalog in Section 12).

| Resource | Rarity | Aether Cycle Link | Main use |
|---|---|---|---|
| **Metal Scrap** | Common | Salvaged hull plating, Aether-Ore adjacent | Hull repair, basic crafts |
| **Prismatic Crystal** | Uncommon | Refined Aether Ore facet | Weapon and tech projects |
| **Dense Core** | Rare | Compressed Aether Crystal fragment | Advanced upgrades |
| **Dark Matter** | Special | Unstable raw Aether Shard, bleeding nether-corruption | High-tier recipes |
| **Equipment** | Epic | Ready-made salvage, corporate or alien-made | A ready-made item |

Fragments are pulled in by a magnet radius; collection has its own audio pitch per type.

### 6.4 Crafting and the Energy Economy

Everything active costs **Energy**.

| Rule | Value |
|---|---|
| Menu (inventory / craft / skills) | **Pause** |
| Build progress | **Real time**, continues once unpaused |
| Simultaneous CraftSlots | **1** — exclusive |
| Materials | Committed when the recipe starts |
| While a slot is busy | No other craft can begin |

Energy sources: **Reactive Panels** (slow passive gathering) and **Nuclear Reversor** (materials → Energy). The same pool feeds movement, fire and construction, so crafting during a heavy wave has to hurt.

### 6.5 Weapons

| Weapon | Profile | Rate | Damage | Energy |
|---|---|---|---|---|
| **Laser** (default) | Straight projectiles | High | Low | Minimal |
| **Plasma** | Slow orbs, medium AoE | Low | Medium (area) | Moderate |
| **Beam** | Continuous scaling DPS | Continuous | Scaling /s | High |
| **Mjolnir** | Piercing electric cone | Medium | High (cone AoE) | High |

### 6.6 Special Ordnance

| Special | Effect | Craftable item |
|---|---|---|
| **Pulse Nova** | Expanding wave: stuns common ships and destroys enemy projectiles | Nova Bomb |
| **Swarm Torpedo** | Multiple homing missiles on the nearest targets | Wasp Cluster |
| **Star Killer** | Gravity anomaly that pulls in ships, enemy fire and nearby asteroids, then detonates | Singularity Bomb |

### 6.7 Equipment

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

### 6.8 Skills (Tech Tree)

Opened while paused. Three branches, expandable via DLC.

| Branch | Focus |
|---|---|
| **Engineering** | Max Integrity, speed, inventory space, lower craft energy cost |
| **Power Flow** | Lower Jet/weapon energy drain, faster Force Field regen |
| **Weaponry** | Damage, crit chance, fire rate, weapon effects |

---

## 7. The Bounty Board — Contract System

The mercenary loop from Section 2.1 becomes a concrete system here. At the end of a run, and in the main hub, the player checks a **Bounty Board of Transmission Logs** — incoming radio requests rendered on CRT-style monitors, one per faction.

### 7.1 How Contracts Work

- Contracts ask for **Contract Cargo**: specific, thematically-named quantities (not the core five resources) collected through defined in-run objectives — e.g. drops from particular enemy types, or milestone rewards.
- Completing a contract pays out in **Blueprints, Equipment Modules, or bulk crafting materials** — never raw combat power mid-run, keeping leaderboard fairness intact (see Section 11).
- Multiple contracts can be active at once; the Board refreshes between runs.

### 7.2 Faction Requests (sample transmissions)

**Orc Warlord Request:**
> *"Bring me 50 Heavy Scrap Plates from M.A.L.I.C.E. hulks. I need to reinforce my war-fleet!"*
> → Reward: Weapon Blueprint.

**Prismari Entity Request:**
> *"Extract 10 Pure Aether Fractals from the Nebula. Stop the corps from bleeding us out!"*
> → Reward: Shield/Energy Module.

**Hollowed Request:**
> *"We need 12 Working Life-Support Cores. Help us keep our kin alive."*
> → Reward: Crafting Materials.

### 7.3 Reputation & Progressive Lore Unlocks

Each faction tracks standing independently, persisting between runs as meta-progression (see Section 11). As contracts stack up for a faction, their tone shifts — distrustful barks give way to something closer to respect, and new transmission text drips out lore about what happened to their homeworlds. Reputation never grants combat stats; it only unlocks **more contracts and more of the story**.

---

## 8. Progression, Difficulty & Sector Storytelling

### 8.1 Kill-Count Milestones

Difficulty scales with the **kill counter**, continuously and by milestone.

```
[  50 Kills] ──► MiniBoss (Tank, Warrior or Rogue) + escort
[ 100 Kills] ──► Mega Asteroid (25–33% of the screen)
[ 500 Kills] ──► Boss General + 2 MiniBosses + wave
[  post-500] ──► cycle repeats, varying attack patterns
```

Scaling past 500 must change **shot patterns**, not just HP and damage — repetition reads as unfairness.

### 8.2 Sector Bands — the Run as a Journey

*(Design proposal — validate against Pillar 5 "endless loop" during G1 playtests; see Section 17, Risk 8.)*

A single run doesn't just get harder — it visibly travels deeper into M.A.L.I.C.E.'s corruption. Kill-count bands trigger a background/parallax and enemy-palette shift, cycling and intensifying the deeper the run goes:

```
[Sector 1: Mining Belt]  -->  [Sector 2: Contested Nebula]  -->  [Sector 3: The Eternal Horizon]
  Industrial asteroids,          Bioluminescent clouds,             Neon-hellscape, frozen ships,
  pirate & Orc raids              Prismari vs. cyber-demons          time-distorted hazards, M.A.L.I.C.E.
```

- **Sector 1 — Outer Grids:** asteroid fields, corporate mining rigs, abandoned stations, Orc raiders and Hollowed scavengers.
- **Sector 2 — Dying Nebulae:** glowing purple/cyan clouds where Prismari entities are actively fighting off cyber-demonic drones — the player wades into someone else's war.
- **Sector 3 — Edge of the Breach:** the background resolves into a synthwave grid of frozen neon flame. Ships hang motionless mid-explosion in the distance — the time-lock of the Eternal Horizon, rendered as pure environmental storytelling.

After Sector 3, the band loop repeats with tighter pacing and harsher enemy patterns rather than resetting to Sector 1 — the run keeps escalating toward the Horizon instead of away from it, so the endless-loop pillar stays intact.

---

## 9. Bestiary & Threat Escalation

### 9.1 Common Enemies

| Type | Behavior | Tactical role | Narrative skin |
|---|---|---|---|
| **Tank** | Very tough, slow | Living shield, blocks lines of fire | Orc warship hull (S1) / M.A.L.I.C.E.-corrupted mining hulk (S2–3) |
| **Warrior** | High projectile volume | Constant pressure, forces movement | Orc raider gunship (S1) / corrupted sentinel drone (S2–3) |
| **Rogue** | Fragile, fast, actively dodges | Lethal if ignored, demands precision | Orc scout skiff (S1) / corrupted wraith-drone (S2–3) |

Silhouette rule: each archetype must be recognizable in under 0.3s regardless of narrative skin — Tanks wide and dense, Warriors balanced with visible gun points, Rogues thin wedges. Skin swaps change color and detailing only, never the readable shape.

### 9.2 Environmental Obstacles

| Type | Behavior |
|---|---|
| Small / Medium / Large Asteroid | Inert drift; damage scales with size and density (Ice, Rocky, Metallic) |
| **Mega Asteroid** | Fills 25–33% of the screen, sheds fragments when hit, pays out heavily |

### 9.3 Bosses & Narrative Beats

| Boss | Traits |
|---|---|
| **MiniBoss Tank** | Extreme damage sponge, shields the squadron |
| **MiniBoss Warrior** | Insane fire rate, escorted |
| **MiniBoss Rogue** | Extreme speed, lethal bursts |
| **Boss General** | Peak durability, phased attack patterns, 2 MiniBosses plus a wave |

**Mid-Bosses (faction champions):** a quick radio interrupt fires before the fight, e.g. an Orc Raider captain demanding the player's cargo before opening fire.

**Major Bosses (M.A.L.I.C.E. cyber-demons):** on entering a boss zone, the HUD glitches with red VHS-style static, and a digitized, demonic voice line cuts over the comms:

```
CORRUPT_DIRECTIVE // PURGE_ORGANIC_WASTE
```

---

## 10. Modes, Scoring and Leaderboards

### 10.1 Game Modes

| Mode | Systems | Proposition |
|---|---|---|
| **Normal** | Craft, skills, full arsenal, equipment, Bounty Board | Master the systems |
| **Survivor** | **One-shot from scratch**: base hull and shield, no inherited inventory, Laser only, craft and skills off, no contracts | Pure skill |

### 10.2 Scoring

- Cumulative score for enemies, asteroids and events (MiniBoss, Mega Asteroid and Boss General are worth far more).
- **Multipliers** for performance, such as no-damage streaks and fast wave clears.

### 10.3 Leaderboards

Four time windows per mode — **8 boards total**, never mixed:

| Window | Reset |
|---|---|
| **Weekly** | Every week |
| **Monthly** | Every month |
| **Annual** | Every calendar year |
| **Eternal** | Never |

Canonical timezone is **UTC**; a run counts toward the window in which it ended. Local bests ship in G1, Steam boards in G3. Top ranks earn cosmetic titles and badges — never combat power.

### 10.4 Achievements

15 to 30 Steam achievements spanning kill goals, survival, efficiency (for example, clearing the Boss General without taking damage), mechanic exploration (using every weapon in one run) and Survivor milestones. Server-wide "first player in the world" achievements need a custom backend and are parked as post-1.0.

---

## 11. Meta-Progression

- **Persists between runs:** high scores, achievements, cosmetics (neon ship skins, thruster trail colors), a light credits system for visual unlocks, and **faction reputation with the Orcs, Prismari and Hollowed** (unlocks contracts and lore transmissions only — see Section 7.3).
- **Does not persist:** weapons, equipment, resources, skills and hull damage — every run starts on equal footing so leaderboards stay fair.

---

## 12. Item, Material & Equipment Flavor Text

Short, evocative descriptions on every craftable item, raw material and blueprint — the Dark Souls/Hades school of worldbuilding through tooltips. Full catalog to be expanded per-item as content locks; sample voice below.

**Raw Materials**

- **Aether Shard** — *"Raw, volatile cosmic energy. Smells like ozone and burnt credits."*
- **Metal Scrap** — *"Hull plating stripped off something that used to fly. Still warm, sometimes."*
- **Prismatic Crystal** — *"Refined Aether, cut into something a Prismari would actually want back."*
- **Dense Core** — *"Compressed to the point where it stops behaving like matter should."*

**Rare & Special Drops**

- **Dark Matter** — *"Unstable, ugly, and worth a fortune to the right buyer. Don't ask where it's been."*
- **Cyber-Demonic Core** — *"A fusion of biomechanical wire and burning nether-code. It twitches even when disconnected."*

**Quest / Blueprint Items**

- **Specialized Tachyon Thruster** — *"The blueprint claims this drive can bypass time-dilated space. The key to penetrating the Eternal Horizon."*

**Writing guidelines for future entries:** one to two sentences, present tense, dry gallows humor over exposition. The flavor text should never explain a mechanic — it should make the player want to keep the item even after they've outgrown it.

---

## 13. Art Direction

### 13.1 G0–G1 — Wireframe Prototype

Neon wireframe blocks with no solid fill. The point is validating movement, collision, HUD readability and sense of speed — not fidelity.

### 13.2 G2+ — Low-Poly Retro-Futuristic

- Flat-shaded 3D models, aggressive angular silhouettes, no high-res textures.
- Neon glow on polygon edges and joints.
- Thrusters with light trails and dense particles.
- Distinct polygonal shapes per archetype for instant reading.
- Base palette: deep blue/purple space, cyan/blue player ship, enemies color-coded (Tank amber, Warrior red, Rogue green/magenta), asteroids in metallic and ice tones with outline glow.

### 13.3 Sector Palette Notes (see Section 8.2)

| Sector | Palette |
|---|---|
| 1 — Mining Belt | Industrial amber, rust, dull metallics |
| 2 — Contested Nebula | Bioluminescent purple/cyan, Prismari light-glow |
| 3 — Eternal Horizon | Neon red/black hellscape, frozen ship silhouettes, static-glitch accents |

---

## 14. Audio

- **Soundtrack:** high-tempo synthwave; intensity shifts on MiniBoss, Mega Asteroid and Boss General events. In the Garage, the cockpit cassette deck (Section 3.2) doubles as the literal music selector.
- **SFX:** percussive laser fire; clearly different shield-hit and hull-hit sounds; satisfying collection "ping" with pitch per resource; layered explosions that scale from common ships to the Boss General.
- **Voice & Radio:** AI Narrator lines, Ikarus one-liners, enemy/ally barks, and the corrupted M.A.L.I.C.E. boss voice line — all short, all triggered by gameplay events, delivered through the HUD radio-waveform indicator.
- **Warnings:** a distinct stinger before a Mega Asteroid or MiniBoss enters the field, and a VHS-static sting before a Major Boss encounter.

---

## 15. Feel and Performance

- **Screen shake** proportional to impact, with a hard intensity cap that never compromises readability.
- **Hit-stop** for a few frames on major impacts.
- **Parallax layers** of stars, planets and nebulae, reskinned per sector band.
- **Object pooling** for bullets, particles, enemies and fragments; no per-frame allocation in update or collision paths. The worst case — a Mega Asteroid event during a full wave — must stay frame-stable.

---

## 16. Development Roadmap

Four product gates, each shipping a playable vertical slice.

| Gate | Deliverable | Exit criteria |
|---|---|---|
| **G0** Vertical Slice | Local playable prototype | X/Y movement, pooled Laser, one enemy, simple health, score, death and restart, wireframe visuals |
| **G1** Itch Prototype | Web build on Itch.io | `index.html` at root with relative paths and responsive canvas, Force Field vs Integrity, Metal Scrap repair in the CraftSlot, asteroid drops, local best score, essential audio, pooled bullets and particles |
| **G2** Professional Build | Full product | Complete bestiary, 50/100/500 milestones, Mega Asteroid, Boss General, full arsenal and Special Ordnance, Energy economy, Survivor mode, low-poly neon art, event audio, **Bounty Board contracts, AI Narrator/Ikarus voice lines, sector band staging, item flavor text**, balance numbers locked |
| **G3** Steam 1.0 | Publishable PC build | Steam runtime, **gamepad remap** + Steam Input (play + rumble already in G0/`D18`), 8 leaderboards, 15–30 achievements, Steam Cloud, store assets, Steam Deck checklist |

**Ordering rule:** never start required work for the next gate while the current one is incomplete, aside from short technical spikes. Narrative-delivery systems (HUD storytelling, contracts, flavor text) are explicitly G2 scope — G0/G1 stay mechanical so the core loop gets validated before it gets dressed.

---

## 17. Design Risks and Validation

1. **Difficulty past 500 kills** — scale patterns, not just numbers.
2. **Drop rates** — too scarce breaks the repair loop, too generous kills the tension.
3. **Energy economy** — crafting, firing and boosting must genuinely compete.
4. **Hull damage curve** — how many hits per level, and how obvious each penalty feels.
5. **Weapon balance** — no weapon should be strictly dominant across contexts.
6. **Worst-case legibility** — Mega Asteroid plus a full wave must stay readable, in every sector palette.
7. **Leaderboard fairness** — Normal and Survivor must never share a board.
8. **Sector-band pacing** — confirm that cycling through three visual sectors within one endless run reads as escalation, not confusion, and doesn't undercut Pillar 5.
9. **Faction moral consistency** — Orcs are simultaneously raiders (Sector 1 hostiles) and buyers (Bounty Board). Playtest whether this reads as "grey, opportunistic faction" or just "inconsistent."
10. **Flavor-text scope** — item/material copy needs a content budget and a style guide before G2 lock, or it becomes an open-ended writing task with no ship date.

---

## 18. Documentation Map

Detailed, versioned planning lives in `.docs/`, with `#tag/*` markers for fast search. If your checkout still git-ignores that folder, searches need `rg --no-ignore "#tag/weapons" .docs`.

**Active planning — `.docs/plans/` and `.docs/phases/`**

| Document | Scope |
|---|---|
| [`plans/planning.spec.MD`](.docs/plans/planning.spec.MD) | **The hub.** Canonical names, decisions, engine composition, the enumerated requirement index (§3.5), the SDD subject cards in build order (§5), the POC-1 → POC2 port map (§5.0), Definition of Done (§6.1) |
| [`phases/phase-0-poc.md`](.docs/phases/phase-0-poc.md) | POC-1 phase document — history, gate question, acceptance checklist |
| [`phases/phase-0-poc2.md`](.docs/phases/phase-0-poc2.md) | Architecture blueprint: pattern constructor, Model/View by inheritance, layers, managers, target folder tree |
| `specs/{subject}.spec.ts` | One SDD+TDD spec per POC2 card (all Stage A–G written). Four agent sections (Orchestrator, Programming/Three.js, Game Design, TDD). Shape: `specs/_template.spec.ts`. Index: `specs/README.md` |

**Domain plans — `.docs/plans-later/`** (Portuguese legacy; they own the requirement ID definitions)

| Document | Scope |
|---|---|
| `spaceship-plan.spec.MD` | Ship attributes, Energy, CraftSlot, skills, controls — defines `SHIP-01..13` |
| `weapons-plan.spec.MD` | Primary weapons and Special Ordnance — defines `WPN-01..08` |
| `resources-plan.spec.MD` | Drop table and collection economy — defines `RES-01..06` |
| `equipments-plan.spec.MD` | Equipment and craft recipes — defines `EQP-01..07` |
| `enemys-plan.spec.MD` | Bestiary, bosses, asteroids — defines `ENM-01..09` |
| `game-rules-plan.spec.MD` | Run loop, damage rules, HUD, performance, packaging — defines `RUL-01..14` |
| `ranking-plan.spec.MD` | Leaderboards and Survivor mode — defines `RNK-01..09` |
| `achievements-plan.spec.MD` | Steam achievements and stats — defines `ACH-01..09` |
| `lore-plan.spec.MD` | Full lore bible — largely superseded by Section 2 of this document; retained for deep-cut worldbuilding not yet promoted to canon — defines `LORE-01..09` |
| `bounty-plan.spec.MD` *(to be created)* | Full contract list, faction reputation curve, transmission copy — will define `BNTY-` |
| `voice-plan.spec.MD` *(to be created)* | Full AI Narrator / Ikarus / enemy bark script |

**Code**

| Path | Scope |
|---|---|
| [`poc/README.md`](poc/README.md) | POC-1 — **frozen** playable reference; documents the tuned camera/parallax/limit-box/ship/weapons behavior the port must reproduce |
| [`poc2/README.md`](poc2/README.md) | POC2 — the active build, written against the architecture contract |
| [`poc2/todo.md`](poc2/todo.md) | The live backlog: one entry per SDD card, in build order |

Requirements are traceable per domain (`SHIP-01`, `WPN-04`, `RUL-09`, `LORE-01`, `BNTY-01`, …). The canonical English index, with each ID mapped to the SDD card that satisfies it, is §3.5 of the hub — that index is what feeds task generation.

---

## Appendix A — Voice & Copy Quick Reference

For anyone writing new content, the tone in one line: **VHS box art meets arcade cabinet marquee.** Confident, a little corny, never winking at the player.

**Ikarus (rare, blunt, retro action-hero):** "Boo-yah!" · "Eat plasma!" · "Hell yeah!" · "Bring it on!"

**AI Narrator (tactical, deadpan, occasionally dry):** "Detecting high concentrations of Aether Ore. Warning: M.A.L.I.C.E. corruption signatures in proximity." · "Shields compromised, but... impressive maneuver, Operator."

**Enemies / allies (awe, terror, disbelief):** "Who is this psycho?!" · "Where did they even find a bastard like that?!"

**M.A.L.I.C.E. boss voice (corrupted, directive-driven, all caps):** `CORRUPT_DIRECTIVE // PURGE_ORGANIC_WASTE`

**Faction transmissions (blunt, transactional, a little desperate):** Orc — "Bring me 50 Heavy Scrap Plates from M.A.L.I.C.E. hulks. I need to reinforce my war-fleet!" · Prismari — "Extract 10 Pure Aether Fractals from the Nebula. Stop the corps from bleeding us out!" · Hollowed — "We need 12 Working Life-Support Cores. Help us keep our kin alive."

---

*Living document. Sections 8, 9, 12 and 17 get revisited after the first G1 playtests and after the Bounty Board content pass.*