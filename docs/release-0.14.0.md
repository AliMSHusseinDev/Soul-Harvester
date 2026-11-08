# Soul Harvester 0.14.0 — clear sights, pixel impacts and accelerating loot

[Play version 0.14.0](https://alimshusseindev.github.io/Soul-Harvester/?v=0.14.0).

Enemy feedback now renders before the viewmodel, so hits remain visible around the target while the ADS weapon covers particles behind it. Injury/ability screen feedback stays in a separate final pass. Criticals use a compact amber/ivory accent and short outward ticks instead of expanding rings. Random critical chance is now 4% plus 1.5 percentage points per instinct rank, capped at 16%; the guaranteed headshot region is narrower.

Particle masks use coarser sharp cells and stepped smoke opacity. Rose death flakes and their dark red dotted trails scatter farther with longer ballistic motion and gradual drag. The 15% birth-size increase, crowd budgets and close-range footprint limits remain.

Bullets now query visible world geometry through a two-level static BVH, including decorative rocks, terrain, mountains, masonry and tree trunks. Alpha-cut foliage is sampled before accepting a hit. Surface-normal debris and pooled pixel bullet scars replace the old generic collider-box burst. Scars expire after eight seconds with a ninety-six-instance cap. Animated foliage uses its static geometry for ballistic queries; trunk/terrain queries match the rendered surfaces.

Loot launches in wider arcs, floats higher and uses new stepped gold coins and faceted cyan crystals. Attraction ramps its speed limit from 8 to 32 m/s and solves the spring in the moving player's frame, allowing it to catch a sprinting player. Clear-path checks, acquisition staggering and exactly-once rewards remain. Rewards are never discarded on a timeout.

Tree roots now use the actual triangulated terrain height with embedded bases, including distant coarse mountain cells. Rooted wind deforms grass/bush tips and pine crowns; foliage shadow shaders share the deformation. Clouds drift faster and the lunar halo gently pulses. Reduced motion disables wind and sky motion. The sprint crosshair stays visible and expands within bounded limits.

Authorable balance is grouped in [the master tuning file](../src/game/tuning.ts), including weapons, criticals, enemies/waves, movement, rewards/shops, abilities, loot, effects and weather. See [the tuning guide](master-tuning.md).

Validation: 105 unit tests, strict build/format checks, twenty-one VFX scenarios at 720p/1080p, presentation/forty-enemy reward regression and actual production-game mouse/keyboard combat. The world fixture checks exact ADS weapon-pixel protection, compact critical footprint, four world surface categories, bullet scars, wind/reduced motion, token rendering, shadow shaders and cleanup. Handling checks cover the visible sprint crosshair, stamina, ADS and sprint-to-fire behavior. No browser/shader errors were recorded in passing browser checks.

Software-rendered checks do not establish hardware frame rates or every possible visual case.

Unedited captures: [actual normal hit](screenshots/0.14.0-normal.png), [actual critical](screenshots/0.14.0-critical.png), [actual death](screenshots/0.14.0-death.png), [actual ground impact](screenshots/0.14.0-ground.png). Controlled fixtures: [ADS layering](screenshots/0.14.0-ads-fixture.png), [token models](screenshots/0.14.0-tokens-fixture.png) and [world impact](screenshots/0.14.0-stone-fixture.png), [persistent scar](screenshots/0.14.0-scar-fixture.png) and [visible sprint crosshair](screenshots/0.14.0-sprint.png).
