# Combat sprite system — original image files pending

The three supplied images are visible in the conversation, but their original PNG bytes are not present in the available attachments or workspace. Only the pasted request text is downloadable. **The original artwork has not been imported and its frame boundaries/transparency have not been verified.** Version 0.9.0 includes the available 3D-fragment/flash improvements and the prepared atlas renderer. Attach the three PNG files, preferably together in a ZIP, to complete the original-art integration.

`src/game/combat-assets.ts` deliberately contains an empty catalog. The game retains its existing geometric impacts while using the new 3D complementary fragments. Diagnostic atlases exist exclusively in the browser test and are never shipped as replacement combat art.

## Implemented code

| File                                 | Behavior                                                                                                                                                                                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `combat-sprites.ts`                  | Validated per-sheet metadata, pixel-centre UVs, elapsed-time animation, configurable FPS/playback speed/duration, priority pool and estimated screen-coverage limits.                                                                    |
| `combat-sprite-renderer.ts`          | Cached sRGB nearest-filtered atlases, independent instanced frame/alpha attributes, one camera-facing artwork layer per burst, individual frustum tests and back-to-front ordering within each category. At most three added draw calls. |
| `effects.ts`                         | Confirmed-hit/death integration, shared sprite/fragment coverage accounting, distance/reduced-effects quality, final-frame presentation and reset cleanup. No repeated image decoding or geometry creation per hit.                      |
| `presentation.ts`, `vfx-material.ts` | Actual rotating cuboids with shaded faces, controlled normal/tangent/incoming velocity, analytic drag/gravity and lifetime fade. Fragment rotation remains independent of camera movement.                                               |
| `enemies.ts`, `battle.ts`, `main.ts` | Smooth white surface-flash decay and the analytical hit normal carried through confirmed damage events. Existing damage/death/reward logic and crimson corpse flash remain authoritative. Startup awaits configured atlases.             |
| `scripts/prepare-combat-assets.py`   | Original-image inspection, explicit-frame repacking, alpha preservation, optional edge-connected black-matte removal, union cropping/anchor, gutters and checkerboard review previews.                                                   |

Normal / critical / death profiles initially use 0.22 / 0.28 / 0.56 seconds and 36% / 53% / 78% of enemy width. Close limits scale with viewport height; distant minimums cannot exceed 1.35× the enemy-relative base. The authored sequence controls expansion and decay: its artwork is not recolored or extruded.

The pool holds 48 primary bursts, reserving room above 28 active effects for criticals/deaths and above 40 for deaths. Higher-priority events can replace older lower-priority slots under overload. A sprite-budget rejection cannot spawn a second legacy explosion. Confirmed lethal hits, including critical lethal hits, use only the red primary effect.

A reused 32×18 grid estimates alpha-weighted coverage, reserving artwork coverage before complementary fragments. Its aggregate budget is 8% of the viewport, with category-specific local limits. This estimates these layers; it is not an exact bound on framebuffer pixels, damage labels, corpses, smoke or other effects.

## Complete the original-asset import

1. Obtain the three source PNGs. Inspect each image's RGBA data and frame progression; do not infer its grid from another sheet.
2. Run `python scripts/prepare-combat-assets.py inspect <source PNG paths>`.
3. Create JSON with exactly three entries in `sheets`. Each entry needs `kind` (`death`, `normal`, `critical`), `source` (relative to the configuration) and `frameRects` (ordered `[x,y,width,height]` rectangles measured on that source). Optional fields: normalized original-canvas `anchor`, `fps`, `background` (`alpha` or `connected-black`), `blackThreshold` (0–16).
4. Run `python scripts/prepare-combat-assets.py build <configuration.json>`. It validates all sources before writing RGBA atlases under `public/vfx/combat/` and filling the empty catalog. URLs respect the GitHub Pages project path.
5. Review `artifacts/combat-assets/*-review.png` on checkerboards and `report.json` (source hashes, frame rectangles, alpha mode, crop, dimensions). Tune timing and scale using the actual artwork.
6. Run the checks below and review moving-camera footage with the originals before publishing.

Cropping uses a common union across all frames, preserving positions and the authored anchor. Existing RGBA alpha, including semi-transparent texels, is copied without multiplying it twice. Connected-black processing flood-fills eligible background touching a frame boundary; it preserves dark colored outlines and enclosed black details. True black artwork touching an opaque black matte is ambiguous and needs source inspection or an explicit mask correction; the chat preview has not been used to guess that distinction.

## Validation

```sh
npm test
npm run build
npm run test:combat-vfx
npm run test:polish
```

The added Chromium fixture uses **test-only diagnostic RGBA atlases**, with different layouts/frame counts. At 1280×720 and 1920×1080 it checks independent frames, sharp sampling, transparent padding, actual colored GPU output, world occlusion, camera-facing artwork, world-space fragment transforms, category/death priority, exactly-once death, final-frame cleanup and bounded stress. Separate importer checks cover dark outlines, enclosed black details, original semi-alpha, common cropping, anchor and explicit frame order.

The stress fixture submits 960 impacts and 10 death presentations across 120 simulated frames. Geometry/texture counts stay stable after warmup; pools stay within 48 sprites and 640 fragments. It records CPU update/upload preparation timings separately from WebGL rendering in ignored `artifacts/combat-vfx-report.json`. Software rendering does not establish hardware 60 FPS, full-game horde performance, or final visual quality with the unavailable artwork.

The existing presentation suite additionally checks actual white/crimson enemy feedback, integer labels, loot collection and level-up rewards. Critical hits strengthen the white surface flash; a subsequent normal hit refreshes the normal strength. Original-asset import, screenshots and animation review remain pending the PNG files.

Completed checks: 90 Vitest tests, two importer tests, strict TypeScript/Vite build, formatting/diff checks, both resolution fixtures and the existing presentation suite. The production browser regression also passed actual firing, confirmed hits/kills, loot, bridge movement, pause/audio, narrow-screen menu and all ten waves (260 enemies/four types, no wave eleven). The final diagnostic stress run used 10 draw calls, with stable 15 geometries/11 textures; measured CPU preparation p95 was 2.6ms at 720p and 2.8ms at 1080p on this host. These timings exclude GPU execution and are observations of this fixture.
