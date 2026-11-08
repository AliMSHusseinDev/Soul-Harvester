`browser-check.mjs` is the reproducible end-to-end validation suite. Run it against a production preview to avoid hot reloads interrupting pointer lock.

`inspect.mjs` captures higher-resolution menu and gameplay screenshots against the development server. It is a visual inspection helper, not a substitute for the browser suite.

`visual-check.mjs` captures the textured forest, dagger, rifle sights and 360-degree sky. It uses actual pointer input, checks rifle ADS alignment and records browser/renderer errors. Run it against a production preview with `npm run test:visual`. Images are saved in ignored `artifacts/`.

`polish-check.mjs` starts an isolated Vite fixture on localhost:5190 and renders the actual gameplay classes in a controlled scene. It verifies four alpha-preserving enemy atlas frames, captures the white body flash, normal/critical numbers, pixel impacts and open-hand casting, then kills forty enemies and checks the resulting loot stream, level-up banner and real rewards. Run `npm run test:polish`; no production preview is needed. The scene is a test fixture, not gameplay footage, and is excluded from the production build.

`handling-check.mjs` uses actual pointer/keyboard input against a production preview. It checks 720p/1080p crosshair layout, actual spread/stance transitions, complete sprint-to-fire timing and a single buffered shot, ADS exits, melee, smoke/tracer visibility and cleanup, and absence of the removed tree collider. Run `npm run test:handling` with the same `GAME_URL` override as other browser suites.

`ai-benchmark.mjs` measures 8/80/260 mixed enemies navigating around a wall. Run `npm run bench:ai`; optionally supply an output JSON path. It measures simulation only, with a 120-step warmup followed by 1,080 measured steps per horde size. Keep rendering tests and benchmarks sequential on a software-rendered host.

The 0.8 suites additionally check stamina reaching an actual 0px fill, airborne sprint pose/fire gating, water views at the bridge, integer labels and screen separation, gold fragment pixels, crimson finishing feedback, hip/ADS muzzle depth and a non-stacking level-up time envelope that recovers on unscaled time.

`combat-vfx-check.mjs` starts a procedural-effects fixture on port 5191. It checks twenty-one event profiles at 720p/1080p, isolated white/burgundy body phases, magic-only cyan death spray, actual framebuffer colors, primary feedback through actors, static wall rejection, reduced density, bounded saturation, complete cleanup and absence of particle image requests. Run `npm run test:combat-vfx`. There is no atlas mode or importer.

`actual-combat-check.mjs` runs against a production preview on port 4181 (`GAME_URL` can override it). Actual pointer input rings the bell, crosses the bridge and shoots moving enemies. It captures procedural ordinary, critical and lethal damage, checks framebuffer colors and above-terrain labels, then exercises incoming damage and both abilities. Screenshots and event reports go to ignored `artifacts/`.

`world-polish-check.mjs` starts its own fixture on port 5192. It checks exact ADS viewmodel-pixel protection and compact critical coverage at 720p/1080p, visible terrain/stone/trunk/mountain intersections, pooled bullet scars, wind/reduced motion, token models and foliage shadow shader compilation. Run `npm run test:world-polish`. Saved scenes are controlled fixtures, not player-driven footage.
