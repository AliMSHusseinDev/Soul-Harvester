# Original combat sprite system

The three original PNGs from `Damage Particles.zip` are active in version 0.10.0.

| Original source       | Confirmed event                                     | Frames | Duration |
| --------------------- | --------------------------------------------------- | ------ | -------- |
| `Yellow Spark.png`    | Normal non-lethal damage: golden diagonal fragments | 16     | 0.28s    |
| `White Particles.png` | Critical non-lethal damage: white angular star      | 16     | 0.36s    |
| `Red Particles.png`   | Lethal damage: red chunky explosion                 | 16     | 0.60s    |

Lethal damage takes precedence, including a critical killing blow. Old damage cubes, point explosions and geometric hit flashes are removed. The enemy still has a restrained white hit response; its brief red death flash ends after 0.14s, leaving the original red animation visible.

## Original image handling

Sources are 1254×1254 RGBA PNGs with genuine transparency. No black-color replacement is applied. Each contains a row-major 4×4 sequence. Measured cell edges are 0, 314, 627, 940, 1254; cells alternate between 313 and 314 pixels.

Extraction pads shorter cells onto a shared 314×314 transparent canvas without resizing, recoloring or discarding source pixels. All frames retain their anchor and semi-alpha. Two-pixel gutters separate frames in each 1272×1272 atlas. All 48 packed frames were compared byte-for-byte against their original crops plus transparent padding.

Sources, measured rectangles and SHA-256 hashes remain under `assets/source/combat/`; `inspection.json` records the import. The game downloads only the three packed atlases, about 1.74MB total. Generated image URLs include content hashes so browser caches cannot preserve the previous normal/critical mapping.

```sh
python scripts/prepare-combat-assets.py build assets/source/combat/import.json
npx prettier --write src/game/combat-assets.ts
```

## Rendering and world visibility

`combat-sprites.ts` owns simulation-time playback, category profiles, the 48-slot priority pool and coverage grid. `combat-sprite-renderer.ts` caches three nearest-filtered sRGB atlases and gives each instance independent frame UVs and opacity. It billboards, frustum-tests and sorts instances by depth within each category, using at most three atlas draws. Startup requires the configured images; failed loads report an explicit loading error.

The moving enemy previously walked in front of its own world-anchored burst, and the later weapon pass could cover the remaining pixels. Impact artwork now renders in a separate scene after the viewmodel, with depth testing disabled. Anchors remain fixed in world space. A shared static AABB BVH checks the camera-to-anchor segment against scenery, with 15 interior terrain samples. This avoids actor/weapon occlusion while rejecting obstructed anchors. This is center-line visibility, not per-pixel clipping along a wall edge.

Canvas ratios 0.62 / 0.82 / 0.95 account for the original transparent margins; peak visible art spans approximately 55% / 65% / 85% of enemy width. Close-range screen limits and bounded distant minimums preserve readability. The 32×18 coverage grid estimates mean-alpha coverage and reserves space for death and critical effects before normal hits. Primary effects retain their size under Reduced Effects.

The BVH is built once from static colliders. Recursive median sorting costs O(N log²N) construction time, O(N) stored nodes and worst-case O(N) per query; bounds prune unrelated scenery in typical scenes. Queries reuse their ray, vectors and traversal stack. No learning model is involved.

## Floating damage numbers

`damage-numbers.ts` preallocates 32 DOM labels using the self-hosted pixel font. World anchors are clamped above shared terrain and projected into CSS pixels. Explicit camera/frustum rejection and cached BVH visibility prevent behind-camera or obstructed labels. Text renders outside the 3D depth buffer, so terrain and weapons cannot clip glyphs under the map.

Normal labels are ivory with a dark outline and shadow. Critical labels are 30% larger with a gold star; headshots are orange. Animation uses a 65ms expansion, a critically damped analytical settle, a monotonic upward drift and a smooth final fade. Lifetime is 0.82s normal / 1.0s critical. Simulation age drives animation; the first visible frame does not rewind it. Reduced Effects removes the pop and tilt.

`label-layout.ts` reuses a spatial grid with one bit per label and exact rectangle checks after the broad phase. A bounded 89-candidate search prefers stable lanes, then moves upward; it never sends a crowded label downward. Labels without space are hidden. Important critical/kill labels are placed first and protected from normal-hit pool eviction. Capacity bounds worst-case layout work; no canvas text textures or GPU text materials are created per hit.

## Verification

```sh
npm test
npm run build
VFX_ORIGINALS=1 npm run test:combat-vfx
npm run test:polish
# With the production preview on port 4181:
node scripts/actual-combat-check.mjs
```

The unit suite covers frame selection, priority, upward animation/layout, assets and BVH results compared with brute-force intersections. Importer tests cover extraction and alpha. Original-art rendering checks 720p/1080p animation independence, actual colored pixels, wall visibility, perspective, cleanup and bounded sustained fire. Presentation checks verify body responses, casting, loot and projected number placement at both resolutions, including foot-level damage, nonoverlap and cleanup.

The production-entry test uses real mouse/keyboard input to ring the bell, cross the bridge and damage moving enemies. It checks actual gold pixels on normal hits, white/gold pixels on critical hits and ruby pixels after the death body flash has ended. It also verifies advancing authored frames, removal of legacy bursts and visible damage labels above terrain. Canvas captures and full HUD screenshots are saved under ignored `artifacts/`.

Software-rendered automation does not establish hardware 60 FPS. Damage calculations, wave progression and rewards retain their existing rules.
