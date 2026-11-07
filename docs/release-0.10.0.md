# Soul Harvester 0.10.0 — visible original impacts and upward damage numbers

[Play the updated game](https://alimshusseindev.github.io/Soul-Harvester/?v=0.10.0).

Moving enemies could pass in front of their own impact animations, and the weapon pass could cover them. The original sheets now render after the weapon, while shared static-world visibility rejects obstructed anchors. Ordinary damage uses `Yellow Spark.png`, critical damage uses `White Particles.png`, and lethal damage uses `Red Particles.png`. Legacy damage cubes, point bursts and geometric hit flashes are removed. A brief red body response ends before the red sheet finishes.

All 48 authored frames retain their original RGBA pixels, padding and alpha. Image URLs include atlas content hashes to invalidate the older normal/critical mapping. Primary artwork is larger and remains legible with Reduced Effects enabled.

Damage numbers now use 32 reusable screen-space pixel labels attached to world positions above the terrain. Dark outlines, a spring pop, upward drift and a smooth fade make each hit readable. Critical numbers are larger and gold; headshots are orange. A spatial bitmask grid separates labels using upward lanes and protects the sight and corner HUD. No label is displaced downward to resolve overlap, and no text texture is created per hit. Combat damage rounding and health calculations are unchanged.

Validation: 95 passing unit tests, two importer tests, strict TypeScript/Vite build, original-art render checks at 720p/1080p and the presentation suite covering effects, casting and loot. New regressions cover foot-level damage anchors, upward label motion, nonoverlapping glyphs and cleanup at both resolutions, plus BVH queries compared with brute-force intersections.

A separate production-game test rings the bell, crosses the bridge and shoots moving enemies through real mouse input. It checks visible gold, white/gold and ruby framebuffer pixels on ordinary, critical and lethal damage, advancing animation frames, absence of old bursts and labels above terrain. [Normal impact](screenshots/0.10.0-normal.png), [critical impact](screenshots/0.10.0-critical.png), [death](screenshots/0.10.0-death.png) and [damage numbers](screenshots/0.10.0-numbers.png) are unedited production screenshots.

The visibility check uses collider AABBs and center-line terrain samples; it is not per-pixel wall-edge clipping. Software-rendered tests do not establish hardware 60 FPS. See [combat-sprite-system.md](combat-sprite-system.md) for pooling, rendering and algorithm details.
