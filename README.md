# Soul Harvester

An original first-person dark fantasy browser game built with Three.js, TypeScript, and Vite. **The Hollow Keep** now includes a defensive courtyard, wooden bridge over a ravine, moonlit battlefield, and a fixed spawn zone beneath a great tree. Fight hollowguard waves with a rifle, pistol, melee weapon, and two magic abilities while defending both your vitality and the bell.

## Run

Requires Node.js 22.12+ (validated with Node 24) and npm. No API keys, account, backend, or external game assets are required.

```sh
npm ci
npm run dev
```

Open the address printed by Vite in a desktop browser with WebGL 2 support. Click **Enter the courtyard** to capture the mouse. Pointer lock requires a direct user gesture; an embedded host must explicitly permit `pointer-lock`. If an embedding host blocks it, use a standalone browser tab.

| Control    | Action                                |
| ---------- | ------------------------------------- |
| W A S D    | Move                                  |
| Mouse      | Look                                  |
| Left mouse | Fire                                  |
| Shift      | Sprint; consumes regenerating stamina |
| Space      | Jump                                  |
| R          | Reload                                |
| E          | Ring the bell when nearby             |
| Escape     | Release mouse and pause               |

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
```

The browser suite uses `/usr/bin/chromium` by default; set `CHROMIUM_PATH` to another Chromium executable. It exercises actual pointer capture, character upgrades, movement, jump/landing, aiming, finite-ammo reloads, weapon switching, magic, bell collision/interaction, fixed spawning, shooting a moving enemy, pause/resume, sound controls, and narrow-screen menu layout. Screenshots go to ignored `artifacts/`. Software WebGL is used for automation; those frame rates are not representative of GPU-equipped clients.

## Architecture

- `src/game/battle.ts`: renderer-independent wave, combat, aggro, damage, economy, XP and upgrade simulation.
- `src/game/navigation.ts`: shared Dijkstra flow fields with a binary min-heap, non-corner-cutting grid paths, line-of-sight queries, and a spatial hash for local crowd separation.
- `src/game/terrain.ts`: shared bridge, ravine and map boundaries used by physics and navigation.
- `src/game/world.ts`: seeded original environment, instanced grass/masonry, merged static props, huge moon, moving cloud shader, lanterns, spawn tree, NPCs and bell.
- `src/game/player.ts`: fixed-step acceleration, gravity, circle/AABB collision substeps, prop landing, sprint hysteresis, high jump and double jump.
- `src/game/weapon.ts`: original weapon models, ammunition, reload/weapon switching, critically damped recoil spring, aim-down-sights, melee and casting motion.
- `src/game/enemies.ts`: pooled original sprite enemies, walk animation and attack windup presentation.
- `src/game/effects.ts`: pooled impact particles, floating damage numbers, tumbling deaths, instanced coins/crystals, projectile sweeps and expanding spell ring.
- `src/game/ui.ts`: vitality/base integrity, inventory, skill/stat panels, weapon upgrade shop and death/restart presentation.
- `src/game/input.ts`: pointer lock, focus cleanup, aim and fire inputs.
- `src/game/math.ts`: seeded randomness, fixed-step accumulator and collision helpers.
- `src/game/audio.ts`: original opt-in synthesized ambience, shots, bell, magic and effects.
- `src/main.ts`: lifecycle and coordination of these systems, occluded shooting, event handling and separate world/viewmodel rendering.

All game visuals and audio are generated locally. Fonts are self-hosted; licenses are in `public/licenses/`. The uploaded reference is analyzed in `docs/reference-analysis.md`; no reference artwork, extracted weapon models or game code is redistributed.

## Combat and progression

Ring the bell to start. Enemies spawn only in the tree zone and navigate across the bridge toward the bell. Within 9 metres and line of sight they chase the player; beyond 13 metres they return to the bell. Attacks have a 0.42-second windup, and retreating during that window avoids the hit. A global short damage grace period limits simultaneous player damage from a crowd.

Waves are finite and capped by the 48-enemy pool. After clearing a wave, collect drops and use the 10-second interval to regroup. Enemies have a fixed origin per wave, rather than teleporting around the player. Killing enemies releases souls and leaves coins/XP/ammo drops; nearby drops attract to the player. Each level grants two upgrade points. Six stats and six skill disciplines change real simulation values, including high/double jump, damage, pickup range, regeneration and reload speed.

Weapons have separate magazines and reserves; reloading transfers ammunition rather than creating it. Buy rank upgrades or refill ammunition at the Graveforge. Interact with a damaged bell during combat to spend 15 gold repairing 100 integrity. If the player or bell reaches zero, combat stops and a restart resets the run.

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

Run `npm run build` followed by `npm run preview -- --port 4173`. Use the existing browser-check instructions above. `vite.config.ts` makes all built asset paths relative, so the same build can run on a root domain or inside a GitHub Pages project path. The JavaScript bundle is about 158 KB gzipped before fonts; Vite reports its advisory about the uncompressed Three.js bundle size.

Public hosting must be verified after the hosting account's deployment succeeds. Do not treat a saved environment draft, a ZIP archive, or a localhost address as a public game link.

Each cloud task already has an isolated checkout. Use the existing repository; do not create another Git worktree unless explicitly requested.
