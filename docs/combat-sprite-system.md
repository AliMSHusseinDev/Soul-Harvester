# Original combat sprite system

The three PNG images from `Damage Particles.zip` are bundled and active in version 0.9.1. The previous empty catalog has been replaced with actual atlas metadata and required asset loading.

| Original source       | Confirmed event                                             | Frames | Duration |
| --------------------- | ----------------------------------------------------------- | ------ | -------- |
| `White Particles.png` | Normal non-lethal damage: white-yellow angular star         | 16     | 0.22s    |
| `Yellow Spark.png`    | Critical non-lethal damage: golden diagonal slash fragments | 16     | 0.28s    |
| `Red Particles.png`   | Lethal damage: red chunky explosion                         | 16     | 0.56s    |

Names were mapped by artwork, rather than assuming the filename describes the desired event. Critical lethal damage uses one red explosion. Body flashes remain white on damage and red on death, and death effects outlive the removed enemy.

## Original image handling

All sources are 1254×1254 RGBA PNGs with genuine transparency. No black-color replacement was needed. Inspection confirmed a 4×4 sequence, left-to-right then top-to-bottom, on each of the three images. The measured cell edges are 0, 314, 627, 940, 1254, so cells alternate between 313 and 314 pixels.

Extraction pads the shorter cells onto an explicit 314×314 transparent canvas without resizing, recoloring or discarding source pixels. Frames retain their common anchor and original semi-alpha. Two-pixel gutters separate frames in each 1272×1272 output atlas. All 48 extracted frames were compared byte-for-byte against their original RGBA crops plus transparent padding.

Original files, measured rectangles and source SHA-256 hashes are retained under `assets/source/combat/`; `inspection.json` records the import. Only the three optimized atlases, approximately 1.74MB total, are downloaded by the game. The original source copies are excluded from the runtime bundle.

Rebuild the atlases with:

```sh
python scripts/prepare-combat-assets.py build assets/source/combat/import.json
npx prettier --write src/game/combat-assets.ts
```

## Rendering and integration

`combat-sprites.ts` owns frame-rate-independent timing, category profiles, the 48-slot priority pool and coverage grid. `combat-sprite-renderer.ts` caches the three nearest-filtered sRGB atlases and uses independent per-instance frame UVs, alpha, billboards, frustum checks and depth sorting within each category. There are at most three primary atlas draws.

Canvas sizes include the art's transparent margins. Ratios 0.42 / 0.62 / 0.90 give peak visible artwork approximately 33% / 55% / 80% of enemy width. Close-range screen limits and bounded distant minimums keep perspective consistent. A small surface lift is calculated at birth to clear the shallow enemy front; that offset stays in world space when the camera moves. Actual cuboid fragments rotate independently with directional face shading, controlled tangent spread, exponential drag and gravity. The artwork itself is never extruded.

The shared 32×18 grid estimates alpha-weighted coverage, prioritizing death/critical artwork before normal effects and complementary fragments. This limits the effect layers, not every pixel of smoke, corpses or damage labels. Faint authored wisps consume coverage according to their alpha rather than being counted as opaque blocks.

Startup awaits the configured images. Failed required image loads produce an explicit existing loading error instead of silently presenting missing original effects. A unit test requires all three sixteen-frame RGBA atlases to exist, preventing another empty-catalog release.

## Verification

```sh
npm test
npm run build
VFX_ORIGINALS=1 npm run test:combat-vfx
npm run test:polish
```

The original-art fixture exercises both 1280×720 and 1920×1080: independent animation frames, sharp sampling, transparent backgrounds, colored GPU output, wall occlusion, stable world-space fragments, camera-facing art, event priority, cleanup, sustained-fire budgets and stable GPU memory. Diagnostic atlas mode remains available for varied-layout regressions.

With a production preview running on port 4181, `node scripts/actual-combat-check.mjs` starts the real game, rings the bell, fires with actual mouse input, crosses the bridge and captures normal damage, a critical hit and a kill. It verifies the matching original animation actually renders and advances through multiple frames, with no legacy flash replacing it. Captures and the detailed report are saved under ignored `artifacts/actual-combat-*`.

Software-rendered automation does not establish hardware 60 FPS. This update changes combat presentation and asset integration; damage, wave progression and rewards retain their existing calculations.
