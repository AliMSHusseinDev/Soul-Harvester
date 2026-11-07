# Soul Harvester 0.9.0 — 3D combat fragments and atlas support

Available at [the game](https://alimshusseindev.github.io/Soul-Harvester/?v=0.9.0).

## Visible changes

- Impact and death fragments are actual rotating cuboids with directional face shading. Their positions and rotation remain in world space while the player turns.
- A shared screen-coverage budget reduces dense overlapping fragment clouds during automatic fire. The existing 640-slot fragment pool remains bounded.
- Enemy white flashes use smooth decay; critical damage reaches a stronger white flash, and the next normal hit resets that strength. Confirmed deaths retain their separate crimson corpse flash and exactly-once death/reward logic.
- Confirmed bullet events carry the analytical surface normal for controlled fragment spread. Exponential damping/gravity remains stable across update rates.

## Prepared sprite-sheet integration

The pooled renderer supports independent animation frames, nearest-filtered sRGB atlases, camera-facing primary artwork, per-category priority, enemy-relative sizing, frustum tests and depth-aware drawing. There are at most three added atlas draw calls when all three sheets are installed. An importer supports explicitly measured frame layouts, common cropping/anchors, alpha preservation, optional connected-black cleanup and padded atlases.

**The user's three original PNG files are still unavailable in the workspace, so the catalog is empty. This release does not display those sprite sheets.** Existing geometric flashes remain active alongside the new 3D fragments. Diagnostic artwork is confined to tests and is excluded from the game. See [the implementation/import report](combat-sprite-system.md).

## Validation

- 90 Vitest tests and two Pillow importer tests passed.
- Strict TypeScript/Vite build, formatting and diff checks passed.
- Chromium fixtures at 1280×720 and 1920×1080 verified independent atlas frames, crisp alpha sampling, world occlusion, surface depth bias, billboard orientation, world-space fragment transforms, critical flash strength, event priority and final-frame cleanup, using test-only atlases.
- A 120-frame fixture submitted 960 impacts and 10 death presentations. Pools stayed bounded, with 10 draw calls and stable GPU geometry/texture counts after warmup. CPU preparation p95 measured 2.6ms/2.8ms at 720p/1080p on this host; these exclude GPU execution.
- Existing presentation tests passed white/red body feedback, visible colored fragment pixels, numbers, casting, forty-enemy loot collection and actual level-up rewards.
- Production-build browser regression passed firing, confirmed hits/kills, loot, movement/bridge traversal, pause/audio, responsive menu and all ten stacked waves: 260 enemies across four types, no wave eleven.

Software-rendered automation does not establish hardware 60 FPS. Final original-art frame extraction, transparency inspection and visual tuning remain pending the PNG files.
