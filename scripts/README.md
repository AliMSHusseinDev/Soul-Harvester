`browser-check.mjs` is the reproducible end-to-end validation suite. Run it against a production preview to avoid hot reloads interrupting pointer lock.

`inspect.mjs` captures higher-resolution menu and gameplay screenshots against the development server. It is a visual inspection helper, not a substitute for the browser suite.

`visual-check.mjs` captures the textured forest, dagger, rifle sights and 360-degree sky. It uses actual pointer input, checks rifle ADS alignment and records browser/renderer errors. Run it against a production preview with `npm run test:visual`. Images are saved in ignored `artifacts/`.

`polish-check.mjs` starts an isolated Vite fixture on localhost:5190 and renders the actual gameplay classes in a controlled scene. It verifies four alpha-preserving enemy atlas frames, captures the white body flash, normal/critical numbers, pixel impacts and open-hand casting, then kills forty enemies and checks the resulting loot stream, level-up banner and real rewards. Run `npm run test:polish`; no production preview is needed. The scene is a test fixture, not gameplay footage, and is excluded from the production build.

`handling-check.mjs` uses actual pointer/keyboard input against a production preview. It checks 720p/1080p crosshair layout, actual spread/stance transitions, complete sprint-to-fire timing and a single buffered shot, ADS exits, melee, smoke/tracer visibility and cleanup, and absence of the removed tree collider. Run `npm run test:handling` with the same `GAME_URL` override as other browser suites.

`ai-benchmark.mjs` measures 8/80/260 mixed enemies navigating around a wall. Run `npm run bench:ai`; optionally supply an output JSON path. It measures simulation only, with a 120-step warmup followed by 1,080 measured steps per horde size. Keep rendering tests and benchmarks sequential on a software-rendered host.

The 0.8 suites additionally check stamina reaching an actual 0px fill, airborne sprint pose/fire gating, water views at the bridge, integer labels and screen separation, gold fragment pixels, crimson finishing feedback, hip/ADS muzzle depth and a non-stacking level-up time envelope that recovers on unscaled time.

`combat-vfx-check.mjs` starts a local fixture on port 5191 and checks the hybrid renderer at 720p/1080p. Set `VFX_ORIGINALS=1` to use the three bundled original PNG atlases; default mode uses diagnostic atlases with varied layouts. It covers independent UV animation, alpha, world occlusion, camera-facing sprites versus world-space cuboids, confirmed event/death priority, final-frame cleanup, pooled stress and stable GPU memory. `npm run test:combat-vfx` also runs the Pillow importer tests. See `docs/combat-sprite-system.md`.

`prepare-combat-assets.py inspect <PNG paths>` reports source RGBA information. `build assets/source/combat/import.json` repacks the measured originals with common frame bounds and gutters, writes the production catalog and creates ignored checkerboard review artifacts. Pillow is a development/import dependency, not a runtime game dependency.

`actual-combat-check.mjs` runs against the production preview on port 4181 (`GAME_URL` can override it). It uses the actual game entry, keyboard movement and mouse fire, walks over the bridge and captures normal damage, critical damage and death with the matching original animation. It checks rendered categories, frame progression and absence of legacy fallback flashes. Exact rendered canvas frames and metadata are saved to ignored `artifacts/actual-combat-*`.
