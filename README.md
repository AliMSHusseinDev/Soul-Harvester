# Soul Harvester

An original first-person dark fantasy browser game built with Three.js, TypeScript, and Vite. The first playable chapter establishes the look and controls in **The Hollow Keep**: a moonlit fortress courtyard with spectral inhabitants, a soul-powered pistol, fog, torches, and a responsive first-person controller.

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

The browser suite uses `/usr/bin/chromium` by default; set `CHROMIUM_PATH` to another Chromium executable. It exercises actual pointer capture, movement, jump/landing, aiming, firing, reloading, gate collision, bell interaction, pause/resume, sound controls, and narrow-screen menu layout. Screenshots go to ignored `artifacts/`. Software WebGL is used for automation; those frame rates are not representative of GPU-equipped clients.

## Architecture

- `src/main.ts`: application lifecycle, world/viewmodel render passes, UI, interaction and hit detection.
- `src/game/world.ts`: seeded courtyard generation, static material batching, instanced grass/masonry, lighting and ambient effects.
- `src/game/player.ts`: fixed-step movement with acceleration smoothing, gravity, sprint exhaustion hysteresis, collision substeps and prop-top landing.
- `src/game/math.ts`: deterministic random generator, frame-independent damping, bounded fixed-step accumulator and circle/AABB collision.
- `src/game/input.ts`: pointer lock, mouse look, keyboard input and focus-loss cleanup.
- `src/game/weapon.ts`: procedural firearm, recoil, muzzle flash and reload state.
- `src/game/enemies.ts`: original pixel shades, idle animation, hit feedback and timed respawn.
- `src/game/textures.ts`: locally generated stone, ground, glow and original sprite artwork.
- `src/game/audio.ts`: opt-in original synthesized ambience, footsteps and effects.

All game visuals, textures and audio are generated locally. Fonts are self-hosted. Third-party notices are in `public/licenses/` and included in production builds.

## Current scope

This is the look-and-controls milestone. Shades are stationary practice targets with idle animation; they do not pursue or damage the player. Each takes two hits and returns after 12 active seconds. Released souls are a session counter, not yet currency. The bell currently provides audio/visual feedback. Enemy navigation, combat waves, damage/death, progression, saved games, fort upgrades and monetization are future milestones.

Rendering uses instancing and merged static geometry. The weapon has a separate depth-cleared render pass to avoid clipping into walls while preserving correct depth within the weapon. Software renderers automatically disable world shadows. GPU performance still needs measurement on representative player hardware; no claim of a stable frame rate across all devices is made.

## Deployment

The game is a static website. Publishing the cloud development environment preserves the files; it does **not** publish a public website or keep a development server alive.

### Vercel

Import `AliMSHusseinDev/Soul-Harvester` into your Vercel account, keep the root directory at the repository root, and click **Deploy**. `vercel.json` configures Vite, `npm ci`, `npm run build`, and the `dist` output directory. No environment variables or backend are needed. Vercel gives the project an HTTPS address after a successful deployment. Future pushes rebuild it automatically when the Git integration is connected.

[Deploy with Vercel](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FAliMSHusseinDev%2FSoul-Harvester)

A Vercel account connection is required for account-owned deployments. A development environment snapshot is not a Vercel login.

### GitHub Pages

In the repository's **Settings → Pages**, set **Source** to **GitHub Actions**. Then run **Deploy Soul Harvester** from the Actions tab (or push to `main`). The workflow tests, builds, and deploys `dist`. Use the URL produced by the successful deployment job; a workflow file alone does not establish that the site is live.

### Local production build

Run `npm run build` followed by `npm run preview -- --port 4173`. Use the existing browser-check instructions above. `vite.config.ts` makes all built asset paths relative, so the same build can run on a root domain or inside a GitHub Pages project path. The JavaScript bundle is about 139 KB gzipped before fonts; Vite reports its advisory about the uncompressed Three.js bundle size.

Public hosting must be verified after the hosting account's deployment succeeds. Do not treat a saved environment draft, a ZIP archive, or a localhost address as a public game link.

Each cloud task already has an isolated checkout. Use the existing repository; do not create another Git worktree unless explicitly requested.
