# Soul Harvester 0.8.0 — impacts and island continuity

Implements the supplied combat/world polish request in the existing Three.js/TypeScript game. Progression, enemies, weapons, abilities, bridge collision, upgrades and economy remain integrated.

## Implemented

- **Hits:** eight angular white splash spikes, 18 normal / 24 critical gold fragments and six directional streaks. Sizes use enemy dimensions and projection with near/far limits. Exact exponential-drag integration, gravity and angular motion keep trajectories stable. Counts decrease near the pool limit; a reserve protects finishing/level effects. Enemy instance flashes last 120 ms and preserve alpha/texture.
- **Kills:** a killing hit suppresses the normal splash and emits one crimson finishing burst: 32 ordinary / 40 brute fragments, eight streaks, a red angular flash and a briefly red pooled corpse. The corpse remains visible after the active enemy is released. The effect is stylized, without gore or a full-screen red overlay.
- **Labels:** nearest-integer presentation replaces decimal labels; fractional combat calculations remain unchanged. Pop from 0.75 through 1.15 toward 1, decelerating rise and 0.70 / 0.82 s lifetimes. A small screen-space grid separates labels and avoids the sights, with stable offsets, 32 label slots and a 64-texture cache. White/gold/orange meanings remain.
- **Muzzle:** rifle/pistol sockets are children of the actual weapon models at the cylinder openings. Barrel height and its support now agree with the sight geometry; one socket definition positions both the barrel and VFX. Compact 3D flame spikes, core and light inherit ADS/recoil/sway/switch transforms. Correct depth testing replaces the old camera-facing, depth-disabled star over the receiver. ADS reduces the effect; side streaks remain visible below the sight line.
- **Sprint:** stamina reaches exact zero, stays empty briefly, then regenerates with the existing recharge threshold. No minimum HUD fill. Separate locomotion/weapon poses retain `SprintAirborne`, forward momentum and restrained sway; shooting/ADS still require sprint-out. Airborne camera walking bob is suppressed.
- **Island:** one shared height field replaces the disconnected terrain sheets and deleted river strip. The continuous indexed surface includes ridges, riverbed, sloped banks and coasts below water, without missing interior triangles. Trees sample the same surface. Playable land matches existing physics; bridge/rescue rules remain. Rock/grass shading follows elevation and slope.
- **Water:** one ocean/river batch uses low-amplitude layered waves, analytic normals, cached terrain-depth colors, restrained Fresnel/cloud-like shading, highlights, ripples and sparse shore foam. No reflection scene or swimming system.
- **Atmosphere:** 224 seeded world-space cyan/teal/rare-gold motes animate on the GPU with wind, distance fading and restrained brightness. They do not follow the camera.
- **Level-up:** gold/cyan/white shards and streaks join the expanding terrain-following ring, pixel banner, chord and a brief edge highlight below the HUD. One unscaled envelope moves gameplay scale 1 → 0.35 over 0.12 s, holds 0.15 s, then recovers over 0.6 s. Rapid levels cannot stack/restart it; pause freezes it and reset clears it. UI stays unscaled. The menu Effects control lowers visual intensity and disables cinematic slow motion; reduced-motion preferences select it initially.

## Main files

| Area            | Files                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------- |
| Combat          | New `combat-vfx.ts`, `label-layout.ts`; `effects.ts`, `presentation.ts`, `tuning.ts`, `battle.ts` |
| Weapon/movement | New `muzzle.ts`, `stamina.ts`; `weapon.ts`, `handling.ts`, `player.ts`                            |
| Timing/UI       | New `cinematic-time.ts`; `main.ts`, `ui.ts`, `index.html`, `style.css`                            |
| Environment     | New `island.ts`, `water.ts`, `atmosphere.ts`; `scenery.ts`, `world.ts`                            |
| Verification    | New `polish.test.ts`, updated presentation/scenery tests and browser scripts                      |

Game modules above are under `src/game/`, except `src/main.ts` and `src/style.css`.

## Validation

- 84 unit tests across 16 files: continuous terrain topology (only exterior boundary edges), playable heights, finite normals, coasts/riverbed, exact-zero stamina/recovery, sprint-air fire gating, unscaled non-stacking recovery, screen labels at 720p/1080p/short windows, muzzle attachment/depth, directional finishing particles and equivalent drag across time steps. Existing waves, combat, collision, rewards, loot and artwork tests pass.
- Strict TypeScript/Vite build, formatting and whitespace checks.
- Browser checks use Chromium/SwiftShader, production gameplay classes and actual input where applicable. Screenshots are in ignored `artifacts/`; presentation fixtures are separate from gameplay footage.
- Production visual checks cover all eighteen cached pixel surfaces, forest, dagger, rifle ADS, sprint, water from both sides of the bridge and all four sky directions, with no renderer errors.
- Final shoreline checks verify triplanar rock mapping (no vertical texture stretching), advancing ocean animation and an error-free renderer. The finishing test reads back enough crimson body pixels to catch an incorrect corpse shader, in addition to checking actual gold fragment pixels.
- Real-input handling checks verify exact zero-width stamina, 720p/1080p crosshair projection, crouch/jump, retained airborne sprint pose, the full sprint-to-fire delay, ADS, melee and smoke/tracer cleanup.
- The controlled renderer fixture verifies white silhouette flashing, integer/critical label priority, actual gold fragment pixels, hip/ADS muzzle images, crimson finishing feedback and forty-enemy loot/level rewards. The level-up envelope reaches 0.35 and recovers to 1 without losing rewards.
- Full gameplay regression passed movement/landing/collision, upgrades, ADS/reload, both spells, confirmed hits/kills, seven forest zones, bridge crossing, aggro switching, real gold/XP pickup, pause/audio and narrow layout. All ten waves retained 260 enemies/four types; no wave eleven, no earlier-health reset, no browser/renderer errors. Stress capture used 34 draw calls and paused resource counts stayed stable.

## Limits

Hardware-GPU 1080p/60-fps performance and long-session frame pacing need device playtesting; software-renderer timings cannot establish those targets. Water has procedural reflection-like shading, without reflecting scene objects. Swimming and expanded traversable areas were not added. The playable map remains bounded, with its intentional ravine rescue behavior. Assets and tuning are original interpretations of the references.
