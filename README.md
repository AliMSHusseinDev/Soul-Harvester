# Soul Harvester

An original first-person dark fantasy browser game built with Three.js, TypeScript, and Vite. **The Hollow Keep** now includes a defensive courtyard, wooden bridge over a ravine, moonlit battlefield, and seven spawn zones along the distant forest. Fight hollowguard waves with a rifle, pistol, melee weapon, and two magic abilities while defending both your vitality and the bell.

## Run

Requires Node.js 22.12+ (validated with Node 24) and npm. No API keys, account, backend, or external game assets are required.

```sh
npm ci
npm run dev
```

Open the address printed by Vite in a desktop browser with WebGL 2 support. Click **Enter the courtyard** to capture the mouse. Pointer lock requires a direct user gesture; an embedded host must explicitly permit `pointer-lock`. If an embedding host blocks it, use a standalone browser tab.

| Control       | Action                                |
| ------------- | ------------------------------------- |
| W A S D       | Move                                  |
| Mouse         | Look                                  |
| Left mouse    | Fire                                  |
| Shift         | Sprint; consumes regenerating stamina |
| C / Left Ctrl | Hold to crouch; tighter hip fire      |
| Space         | Jump                                  |
| R             | Reload                                |
| E             | Ring the bell when nearby             |
| Escape        | Release mouse and pause               |

Sound is opt-in through the top-right button. The menu adapts to smaller screens, but touch gameplay is not implemented. Reduced-motion preferences disable camera/weapon walking bob.

## Validate

```sh
npm test
npm run build
npm run preview -- --port 4173
```

With the production preview running, in another terminal:

```sh
GAME_URL=http://127.0.0.1:4173 npm run test:browser
GAME_URL=http://127.0.0.1:4173 npm run test:visual
GAME_URL=http://127.0.0.1:4173 npm run test:handling
npm run test:polish
npm run test:combat-vfx
npm run bench:ai
```

The browser suite uses `/usr/bin/chromium` by default; set `CHROMIUM_PATH` to another Chromium executable. It exercises actual pointer capture, character upgrades, movement, jump/landing, aiming, finite-ammo reloads, weapon switching, magic, bell collision/interaction, forest-wide spawning, white hit flashes, confirmed white hit markers and red kill markers, probabilistic loot collection, all ten stacked waves, shooting moving enemies, pause/resume, sound controls, and narrow-screen menu layout. Screenshots go to ignored `artifacts/`. Software WebGL is used for automation; those frame rates are not representative of GPU-equipped clients.

`test:visual` and `test:handling` use the same `GAME_URL`/preview as the browser suite. Handling checks real sprint-to-fire timing, ADS transitions, crouch/air accuracy, crosshair layout at 720p/1080p and smoke cleanup. `test:polish` starts its own isolated local fixture on port 5190. It renders the production enemy, weapon, effects and HUD classes in a controlled scene to inspect alpha-preserving flashes, damage numbers, casting, smoke, loot streams and real level-up rewards. The fixture never ships with the game. `bench:ai` measures the simulation independently of rendering with 8, 80 and 260 enemies. Run browser suites sequentially on a software renderer. See [the 0.9.1 report](docs/release-0.9.1.md) for the latest changes and validation. Play the [published game](https://alimshusseindev.github.io/Soul-Harvester/?v=0.9.1).

## Architecture

The three original combat sprite sheets are bundled and active. Their frame extraction, alpha preservation, effect mapping and validation are documented in [combat-sprite-system.md](docs/combat-sprite-system.md). Set `VFX_ORIGINALS=1` when running `test:combat-vfx` to validate the real art at 720p/1080p; its default mode retains diagnostic atlas coverage.

- `src/game/battle.ts`: renderer-independent concurrent waves, combat, aggro, damage, economy, XP and upgrade simulation.
- `src/game/navigation.ts`: shared Dijkstra flow fields with a binary min-heap, validated path lookahead, bounded lane offsets, non-corner-cutting grid paths, line-of-sight queries, and a spatial hash for local crowd separation.
- `src/game/terrain.ts`: a C2-continuous raised-keep ramp shared by scenery, collision, AI, pickups and effects.
- `src/game/world.ts`: seeded original environment, instanced pixel-cut grass/masonry, merged static props, huge moon, seamless direction-space clouds, animated depth-colored ocean, GPU atmospheric motes, continuous island ridges/coasts and layered pixel-cut forest silhouettes, NPCs and bell. The oversized central tree and its collider have been removed.
- `src/game/player.ts`: fixed-step acceleration, gravity, circle/AABB collision substeps, prop landing, sprint hysteresis, high jump and double jump.
- `src/game/handling.ts`: deterministic sprint/sprint-out/fire/ADS readiness and per-weapon angular accuracy shared by bullet sampling and crosshair projection.
- `src/game/weapon.ts`: textured, batched weapon models and tapered forearms, ammunition, reload/weapon switching, critically damped recoil spring, aim-down-sights, melee and casting motion.
- `src/game/enemies.ts`: four instanced shallow 3D sprite batches with four-frame atlases, alpha-aware analytical hit tests, pixel-boundary extrusion, distance-driven walk animation, brief body flashes and telegraphed attacks.
- `src/game/waves.ts`: deterministic escalating count/type quotas and ten concurrent wave jobs; each enemy retains its source wave.
- `src/game/loot.ts`: persistent gold/XP drops, ballistic pop/bounce, collision-safe movement and delayed spring attraction.
- `src/game/surfaces.ts`: cached original pixel tiles and shared world-space texel mapping.
- `src/game/sky.ts`: camera-centred cloud/sky shader with no UV wrap seam, luminous lunar disk and halo.
- `src/game/island.ts`, `water.ts`, `atmosphere.ts`: continuous island/coasts and shared heights, shader water/depth shading and bounded GPU motes.
- `src/game/cinematic-time.ts`, `stamina.ts`, `label-layout.ts`, `combat-vfx.ts`, `muzzle.ts`: cinematic timing, exact exhaustion, label placement, impact geometry and physical weapon sockets.
- `src/game/scenery.ts`: crossed pixel foliage and grass tufts, with tree placement sampling the shared island height field.
- `src/game/sprite-geometry.ts`: shallow sprite extrusion with alpha-preserving fronts and shaded pixel boundary walls.
- `src/game/tuning.ts`: central difficulty, spawn cadence, economy, physics, feedback and lighting parameters.
- `src/game/spawning.ts` / `forest.ts`: stratified forest zones, prevalidated reachable positions, spacing and shared trunk obstacles.
- `src/game/rewards.ts`: type/wave-based loot probabilities, bounded dry streaks and reliable XP.
- `src/game/feedback.ts`: nearest-hit resolution and simulation-time hit/kill markers.
- `src/game/presentation.ts`: renderer-independent number animation, bounded tumbling pixel-shard pool and exactly-once ability presentation timers.
- `src/game/ballistics.ts` / `gun-vfx.ts`: pooled world-space barrel smoke, heat/after-smoke, momentum and turbulence, plus travelling core/glow tracer ribbons independent of hitscan damage.
- `src/game/effects.ts`: pooled layered impacts, critical-aware floating numbers, tumbling deaths, occasional tracers, instanced coins/crystals, projectile sweeps and expanding spell ring; physics and GPU uploads run separately.
- `src/game/ui.ts`: vitality/base integrity, inventory, skill/stat panels, weapon upgrade shop and death/restart presentation.
- `src/game/input.ts`: pointer lock, focus cleanup, aim and fire inputs.
- `src/game/math.ts`: seeded randomness, fixed-step accumulator and collision helpers.
- `src/game/audio.ts`: original opt-in synthesized ambience, shots, bell, magic and effects.
- `src/main.ts`: lifecycle and coordination of these systems, occluded shooting, event handling and separate world/viewmodel rendering.

World, character, weapon and audio assets are generated locally. Combat impacts use the three original PNG sprite sheets supplied for this project, bundled under `public/vfx/combat/`. Surface tiles use nearest magnification with mipmapped minification to keep nearby pixels sharp and reduce distant shimmer. The sky is sampled in 3D direction space and follows the camera; it has no texture-wrap seam or far-plane edge. Low-poly valley slopes, pixel foliage and fog provide depth without a postprocessing pipeline. Fonts are self-hosted; licenses are in `public/licenses/`. The uploaded reference is analyzed in `docs/reference-analysis.md`; no reference artwork, extracted weapon models or game code is redistributed.

## Combat and progression

Ring the bell to start. Enemies emerge in spaced groups from seven zones across the forest fringe, and navigate across the bridge toward the bell. Within 9 metres and line of sight they chase the player; beyond 13 metres they return to the bell. Hollowguard attacks have a 0.42-second windup, and retreating during that window avoids the hit. A global short damage grace period limits simultaneous player damage from a crowd.

Every successful bullet hitting the bell calls the next wave immediately, even while earlier waves are fighting. The limit is **ten waves per run**; further bell hits cannot create wave eleven. Waves do not start automatically. All pending wave jobs emit concurrently in staggered groups across the forest, and earlier enemies are retained. A pool sized for the complete run holds all **260 enemies** from waves 1–10 without deleting older enemies. Enemies keep their own wave's tuning rather than inheriting the latest wave number.

Wave sizes increase from 8 to 44 (four extra per wave), with guaranteed introductions and increasing threat quotas. Wave composition evolves deterministically: hollowguards, fast raveners, slow high-health grave brutes and ranged ember witches have distinct silhouettes, speeds, attack timing and damage. The caster fires dodgeable projectiles. Shared navigation and four instanced billboard draws keep the rendering cost of a stacked horde bounded.

Every kill leaves XP; gold is probabilistic. Base gold chances are 32% / 42% / 90% / 72% for hollowguard / ravener / brute / witch, with type-specific amounts and small wave bonuses. After three dry kills the chance rises; no run exceeds six consecutive dry kills. These are adjustable design values, not recovered reference-game rates.

Drops launch upward/outward from the defeated enemy and bounce under lightweight gravity/drag. Magnetic attraction begins after a 0.52–0.585-second animation window inside a base 4.2-metre radius. Acquisition has a frame-rate-independent budget and slight timing/trajectory variation, forming a stream through dense loot. Exact critically damped springs accelerate pickups toward the player, with a speed limit, wall checks, ground clearance and visual shrinking near collection. Brief trails, sparks and rising-pitch chimes confirm collection. Rewards persist until collected or reset. Dynamic batches disable stale frustum-bound culling, so loot stays visible on both sides of the bridge. Each level grants two upgrade points and shows a pixel-style LEVEL UP pop, sparkles and chord.

Confirmed bullet damage briefly flashes the textured enemy white without losing its alpha silhouette, adds a restrained recoil reaction and impact particles at the actual intersection, and shows a white X hit marker. Kills use a larger red X and a heavier confirmation sound. Only the first intersection of a bullet counts: an enemy or wall in front of the bell blocks that shot from starting a wave.

Confirmed normal hits play the original white-yellow star animation; critical hits play the original golden slash animation; killing blows replace both with the original red chunky explosion and crimson corpse flash. All three use sixteen-frame atlases, with complementary world-space 3D fragments, enemy-relative sizing and a shared visual coverage budget. White normal damage numbers, 30%-larger gold critical numbers and orange headshot numbers pop, decelerate and fade according to confirmed combat metadata, without changing damage calculations. Damage labels use nearest-integer rounding (28.5 displays as 29), while underlying combat health and damage retain their fractional values. A screen-space grid separates labels and avoids the sight area. Text scales with viewing distance and screen resolution; staggered lanes reduce overlap, and normal hits cannot evict live critical/kill feedback. Shared pools bound particle counts and number texture memory. Dynamic effect buffers upload once per displayed frame, after simulation catch-up.

Enemies use acceleration-limited velocity, individual speed variation, safe flow-field lookahead and spatial separation, including stationary attackers. Target acquisition and steering are staggered at lower frequencies while motion/collision run every simulation step. Static wall queries use indexed local cells. Walk poses follow distance travelled; attack frames show their windup. Gunfire keeps ordinary attack timing intact; heavy melee/magic knockback can interrupt. Weapons add a running pose, animated magazine removal/reinsertion and an open-hand casting sequence. F/Q reserve their cooldown immediately and release once after a short anticipation; pause/reset cannot duplicate a release. Player hits update health immediately, fade a red vignette and apply a restrained weapon/camera reaction that respects reduced-motion preferences.

Forward sprint hides the crosshair immediately and prevents gunfire/ADS. A fire tap initiates sprint-out, remains buffered and fires once when ready (rifle: 0.225 seconds). Holding ADS also exits sprint. The original weapon models tilt up/right, with interpolated viewmodel transforms and forearms anchored below the screen. Four white 2px crosshair dashes show the exact hip-fire cone, including movement, airborne and shot penalties; crouch reduces the weapon baseline by 15%. ADS remains accurate. No prone stance is implemented. Layered muzzle flashes sit beyond the actual barrel exit; smoke inherits world velocity, rises/curls and never rotates with the camera after emission. Muzzle sockets and depth-tested 3D flame geometry replace the old billboard flash. Sprint jumps retain a separate airborne weapon pose; stamina fully empties before recharge.

The gameplay HUD uses a self-hosted pixel font and compact corner clusters. Controls live in the pause guide, not in permanent paragraphs over the world. The stats/skills panel uses rank pips, discipline tiers and a single contextual description. Aim-down-sights places both sight tips on the camera's optical axis, suppresses walking bob and hides the crosshair and interaction prompt.

Weapons have separate magazines and reserves; reloading transfers ammunition rather than creating it. Buy rank upgrades or refill ammunition at the Graveforge. Interact with a damaged bell during combat to spend 15 gold repairing 100 integrity. If the player or bell reaches zero, combat stops and a restart resets the run.

The island terrain is a continuous shared height field, including the riverbed, mountain ridges and coastal slopes. Water uses depth-driven teal/blue shading, low waves, restrained highlights and shore foam. Level-ups use a bounded, unscaled cinematic envelope; the pause-menu Effects control lowers particle intensity and disables that slow motion.

## Current limits

The map, artwork, sound and tuning are original approximations informed by the video, not a pixel-perfect reconstruction. Exact map dimensions, timing constants and hidden mechanics cannot be recovered from a short screen recording. This version includes three weapons, two active spells, two NPC stations and one map; it does not contain every weapon/level in the reference. Progress is currently per run and is not saved across reloads. Mobile touch controls, multiplayer, a complete campaign and monetization are not implemented.

Rendering uses instancing, material batching and pooled effects. The viewmodel renders separately so it cannot clip into walls. Software renderers disable shadows and use a lower internal resolution. Chromium software rendering in this environment is slow; a stable 60 fps on GPU-equipped player hardware is **not yet verified**. The tests exercise behavior and algorithm invariants rather than proving “100% balance.”

## Deployment

The game is a static website. Publishing the cloud development environment preserves the files; it does **not** publish a public website or keep a development server alive.

### Vercel

Import `AliMSHusseinDev/Soul-Harvester` into your Vercel account, keep the root directory at the repository root, and click **Deploy**. `vercel.json` configures Vite, `npm ci`, `npm run build`, and the `dist` output directory. No environment variables or backend are needed. Vercel gives the project an HTTPS address after a successful deployment. Future pushes rebuild it automatically when the Git integration is connected.

[Deploy with Vercel](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FAliMSHusseinDev%2FSoul-Harvester)

A Vercel account connection is required for account-owned deployments. A development environment snapshot is not a Vercel login.

### GitHub Pages

In the repository's **Settings → Pages**, set **Source** to **GitHub Actions**. Then run **Deploy Soul Harvester** from the Actions tab (or push to `main`). The workflow tests, builds, and deploys `dist`. Use the URL produced by the successful deployment job; a workflow file alone does not establish that the site is live.

### Local production build

Run `npm run build` followed by `npm run preview -- --port 4173`. Use the existing browser-check instructions above. `vite.config.ts` makes all built asset paths relative, so the same build can run on a root domain or inside a GitHub Pages project path. The JavaScript bundle is about 182 KB gzipped before fonts; Vite reports its advisory about the uncompressed Three.js bundle size.

Public hosting must be verified after the hosting account's deployment succeeds. Do not treat a saved environment draft, a ZIP archive, or a localhost address as a public game link.

Each cloud task already has an isolated checkout. Use the existing repository; do not create another Git worktree unless explicitly requested.

### Visual verification

With the production preview running, use `npm run test:visual` to capture the moonlit forest, the new dagger, rifle ADS and all four sky directions. The helper checks sight alignment and renderer errors. The full browser suite remains the behavioral regression test. Art direction is original pixel-textured 3D with low-poly scenery and shallow extruded enemy sprites; it does not redistribute Minecraft or reference-game assets.
