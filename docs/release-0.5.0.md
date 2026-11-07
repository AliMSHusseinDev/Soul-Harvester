# Soul Harvester 0.5.0 — pixel-textured art direction

Implemented on 7 November 2026 against the user's supplied screenshots and uploaded gameplay clip. This update retains the existing game architecture and mechanics.

## Visible changes

- Twenty original, cached pixel textures cover grass, dirt, masonry, rocks, paving, timber, bark, foliage, ivy, bushes, metal, brass, leather, skin, coins, crystals and combat sparks. Surface tiles are 32×32; pine foliage is 64×64. Nearest magnification preserves pixel edges; mipmapped minification limits distant shimmer. World-space UV projection keeps scenery texture scale independent of primitive dimensions.
- A camera-centred lunar sky replaces the wrapped cloud image. Continuous direction-space noise removes the rectangular wrap discontinuity; the background follows the camera and stays inside the far plane. A larger lunar disk/halo, swept clouds and cool fog contrast with warm local lights. The sky draws after opaque geometry to avoid shading hidden clouds.
- Hundreds of instanced conifers use crossed, pixel-cut branches with matching alpha-tested shadows, replacing opaque cone caps. Layered forest, textured valley slopes, tufts, bushes, moss/ivy, broken gate details, crates and worn dirt paths give the map depth. Decorative landscape geometry excludes the playable interior and ravine.
- Rifle/pistol surfaces have original metal, brass and wood textures, vent recesses, receiver details, barrels and sight supports. Tapered forearms connect the gloved hands at natural angles; subtle idle motion respects reduced-motion preferences and ADS. Static parts are batched by material while the support-hand rig animates independently. A bevelled cyan dagger replaces the thin curved placeholder, retaining the existing melee system.
- Enemy artwork becomes shallow 3D geometry with shaded side walls following opaque pixel boundaries. Four instanced batches and alpha-aware shooting remain. Body flashes last 85 ms in simulation and survive at least one rendered frame during catch-up. The flash follows the textured silhouette, with distinct hit/kill confirmation and original particle effects.
- Copper/gold coin faces, cyan crystal surfaces, pixel sparks and a small star muzzle flash complete the shared style. The tested upward launch, diminishing bounce, rest/hover, delayed spring attraction, shrinking, trails, chimes and type-based rewards remain integrated.
- Short landscape windows now keep the instructions and entry controls accessible.

## Main files

| Area                              | Files                                                                                               |
| --------------------------------- | --------------------------------------------------------------------------------------------------- |
| Pixel material library / mapping  | `src/game/surfaces.ts`                                                                              |
| Sky and valley geometry           | `src/game/sky.ts`, `src/game/scenery.ts`                                                            |
| Environment and forest            | `src/game/world.ts`, `src/game/forest.ts`, `src/game/textures.ts`                                   |
| Weapons and connected hands       | `src/game/weapon.ts`                                                                                |
| Extruded enemies and hit feedback | `src/game/sprite-geometry.ts`, `src/game/enemies.ts`, `src/game/battle.ts`                          |
| Loot / particle artwork           | `src/game/effects.ts`                                                                               |
| Tuning and integration            | `src/game/tuning.ts`, `src/main.ts`, `src/style.css`                                                |
| Verification                      | `src/game/scenery.test.ts`, `scripts/visual-check.mjs`, `scripts/browser-check.mjs`                 |
| Documentation/version             | `README.md`, `docs/reference-analysis.md`, `scripts/README.md`, `package.json`, `package-lock.json` |

## Verification

- `npm test`: 57 unit tests across 11 files, including physical texel scale, cap-free foliage normals, decorative terrain/ravine exclusion and pixel-boundary extrusion, plus existing movement, navigation, concurrent-wave, combat, reward and magnetic-loot tests.
- TypeScript/Vite production build, formatting and whitespace checks.
- Visual test: forest, dagger, rifle ADS and all four sky directions; verifies nearest filtering and 32/64px dimensions for all twenty surface textures, sight alignment and browser/renderer errors. Screenshots live in ignored `artifacts/`.
- Complete real-input browser regression passed in Chromium: mouse capture, instructions/menu access in a short window, skill upgrades, walking/jumping/landing, pedestal collision, pistol ADS/reload, quick taps, melee/weapon switching, both spells, all seven forest zones, white flashes/red hit markers/kills, bridge traversal, player/bell aggro, actual gold/XP collection, pause/resume/audio, narrow-screen layout and all ten concurrent waves. All 260 enemies and all four types remained active, older enemies retained their health, extra bell shots could not create wave eleven, and there were no browser/renderer errors. Geometry/texture counters stayed stable while paused after the stress scene.

## Practical limits

The artwork is original and follows the supplied art direction; it does not redistribute Minecraft or reference-game assets. Enemies are shallow extruded sprite models, preserving the reference's hybrid rendering. Hardware GPU frame rates and long-session performance require device testing. Automated Chromium uses CPU software rendering; its timings cannot establish 60 fps on player hardware. Vite retains its advisory for the roughly 621 KB uncompressed / 168 KB gzip engine/game bundle.
