# Developer workspace

Open **Developer Button** in the main menu. The game simulation pauses while the workspace is active; effects can still be previewed. This is a local project editor for Soul Harvester, with desktop keyboard/mouse controls.

## Controls

- **F1** opens/closes the editor and releases/captures the mouse. Escape also releases the mouse and reopens the panel.
- **Left Alt** toggles flight/noclip. Right Alt is untouched. **WASD** moves, **Space** ascends, **Left Ctrl** descends, **Shift** increases speed. With flight off, ground height and world colliders constrain walking.
- **1–8** select a texture from the bottom hotbar and choose Build.
- In Build, left-click places one object at the aimed surface, with grid snapping. Right-click removes an editor-created object under the crosshair. Select + left-click opens its inspector.
- **Ctrl/Cmd Z** undoes; **Ctrl/Cmd Shift Z** redoes. The history holds up to 40 edits within a bounded snapshot budget and resets on reload. Undo is available for tuning, placement, transforms, deletion, imports and sculpt strokes.

## Panels

**Effects:** searchable tuning for Splatter, Bleeding, smoke and other VFX; colors, sizes, counts, speed, gravity, lifespan, range, bounce and weight tiers. Weight ranges are independent of particle size. Choose one of four enemy types and preview a hit, critical, death or nova. Freeze, slow down or clear previews.

**Map Design:** build blocks, rocks and cone-shaped tree props using the original game texture palette or imported images. Select placed objects, edit X/Y/Z position and scale, rotate Y, change color/material, duplicate or delete. A wireframe previews placement. The current inspector edits objects created by this editor; the authored castle and forest are not individually selectable/editable.

**Terrain:** Raise/Lower uses compact-support smooth radial strokes. Radius and height per stroke control mountains and slopes. The height field is shared with the island mesh and gameplay ground; rebuilding updates bullet surface queries. Fixed architecture stays in place during sculpting, so use gentle strokes around buildings. The original playable bounds/river rules still apply; this is not an unrestricted voxel world. Maximum 128 strokes.

**Graphics:** fog, background, terrain tint, lighting, wind and view tuning. Exposure, world hemisphere/directional intensities and fog density update live. Shader and geometry construction settings require Reload.

**Materials:** all 20 original pixel textures, plus local PNG/JPEG/WebP import. Up to eight custom images, 1 MB each and 2048×2048 maximum. Imported images are stored with the project and included in JSON export; no remote image URLs or arbitrary model uploads are admitted.

**Game Tuning:** searchable numeric/boolean values from the central tuning registry, including combat, player, weapons, enemies, waves, loot, abilities and hit feedback. Each field shows its default and usage guidance. Values use world metres, seconds and probability fractions. Reload rebuilds cached gameplay values; changing existing enemy/weapon/player state is not always immediate.

## Saving and applying

Edits autosave to `soul-harvester.developer.v1` in this browser after a short debounce, and also save on page hide. **Save now** flushes immediately. **Export JSON** creates a portable project/preset backup; **Import JSON** validates version, numeric limits, object identities, textures, world bounds and brush limits before applying.

Changes affect normal play in this browser. **Exit to menu** saves, then reloads so scene geometry, bullet collision BVH and enemy navigation are reconstructed before play. Reload saved project also applies shader constants/cached values. Added objects create conservative rotated/scaled AABB colliders, so a rotated rock may block slightly beyond its visible silhouette. At most 512 objects are admitted.

Saved projects load before game modules that cache tuning constants. The editor does not publish projects to other players or sync across devices. Clearing site storage removes the local project, so export backups. Storage failure is shown explicitly; exit/reload is blocked when saving fails so current work can still be exported.

## Checks

`npm test` covers safe project import, finite/owned tuning, compact-support sculpting and existing gameplay. Build the game, start `npm run preview -- --port 4181 --strictPort`, then run `npm run test:developer`. The browser suite exercises real UI controls, live tuning, history, effect preview, F1/Left Alt, placement, terrain strokes, world colors and persistence/rebuilt collider counts. `GAME_URL=http://127.0.0.1:4181/ npm run test:browser` checks normal gameplay separately. Run browser suites sequentially on a software renderer.
