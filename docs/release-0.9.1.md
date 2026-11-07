# Soul Harvester 0.9.1 — original combat sprite sheets active

[Play the updated game](https://alimshusseindev.github.io/Soul-Harvester/?v=0.9.1).

The previous release shipped an empty combat atlas catalog, so confirmed damage still used the older geometric effects. This update bundles and activates the three actual PNG files supplied in `Damage Particles.zip`.

| Damage event            | Original artwork                                    |
| ----------------------- | --------------------------------------------------- |
| Normal non-lethal hit   | `White Particles.png`: white-yellow angular star    |
| Critical non-lethal hit | `Yellow Spark.png`: golden diagonal fragments       |
| Any lethal hit          | `Red Particles.png`: red voxel-like chunk explosion |

Each original contains 16 frames. Measured extraction handles the uneven 313/314px cell boundaries, preserves every RGBA source pixel and semi-transparent edge, adds transparent padding/gutters and produces three 1272×1272 atlases. No black background replacement or substitute artwork is used. All 48 packed frames were checked against their source pixels. Original PNGs, rectangles and hashes are retained in `assets/source/combat/`.

Primary artwork is camera-facing, with independent animation UVs and a frozen surface offset that clears the enemy mesh. Complementary fragments retain real 3D rotation and motion. Padding-aware sizes give visible peaks around 33% / 55% / 80% of enemy width for normal / critical / death, with close-range limits. Death effects persist after removal and take priority over critical artwork on a lethal hit.

Startup awaits all configured images and reports a load failure explicitly. A new unit test requires all three RGBA atlases and all 48 frames, preventing another empty-catalog release.

Validation includes 91 unit tests, two importer tests, strict TypeScript/Vite build and formatting/diff checks. The original-image Chromium fixture covers 720p and 1080p animation, transparency, occlusion, world-space fragments, priority, cleanup and bounded sustained-fire stress. The presentation fixture covers actual body flashes, numbers, casting and forty-enemy loot/rewards. A separate production-entry test rings the bell, walks over the bridge, fires actual normal/headshot/lethal bullets and captures the matching original animations advancing through multiple frames.

Detailed import/rendering notes are in [combat-sprite-system.md](combat-sprite-system.md). Software-rendered measurements do not establish hardware 60 FPS.

Captured from real production gameplay with mouse/keyboard input: [normal hit](screenshots/0.9.1-normal.png), [critical hit](screenshots/0.9.1-critical.png), [death](screenshots/0.9.1-death.png). These are exact rendered canvas frames, without image editing or synthetic enemies.
