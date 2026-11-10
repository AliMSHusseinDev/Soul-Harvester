# Soul Harvester 0.16.0 — layered directional death feedback

[Play 0.16.0](https://alimshusseindev.github.io/Soul-Harvester/?v=0.16.0).

Deaths now push/lean the collapsing silhouette along the incoming shot, with different head/side reactions, bounded seeded variation and a slightly heavier duration on larger enemies. Pixel erosion spreads from the contact region; a short red silhouette rim/crack accent emphasizes the initial break. The body remains foot-anchored with conservative rotated clearance and actual ground support.

Additional layers include 4 close red flecks (0.12–0.18s), a single compact red critical slash (0.09s), and up to 6 material-colored ground flecks (0.18–0.28s) when a surface is found. They use the existing particle pool. Ground blood marks share the existing scar draw/pool, last 1.1s and are capped at 24. Surface normals and footprint support samples reject steep/nonplanar ledges rather than painting across them. Stone/wood/earth produce corresponding fleck colors.

A fixed four-pulse, spatially attenuated grass/foliage response bends nearby wind-enabled vegetation, with a smooth zero-slope temporal envelope, summed amplitude limits and reduced-motion support. Loot release is biased by shot direction then normalized to preserve the original launch speed; reward values, counts, magnet rules and energy bounds do not increase.

Secondary particles/decals use a three-token bucket, replenished at ten per second, and stop when the primary pool exceeds 800 live particles or reduced effects is enabled. Primary Splatter/Bleeding and silhouette response remain. This deliberately avoids maximum layers on every simultaneous kill.

Death smoke and Developer Mode remain removed. Audio is unchanged. No textures or particle draw batches are added; new scar masks reuse the existing instanced draw.

Validation: 118 unit tests, strict build/formatting, 29 VFX scenarios at 720p/1080p, world/ADS/shadow/terrain regression including secondary-budget and decal cleanup checks, and production-input combat. New unit checks cover reaction bounds, short smoke-free secondary channels, preserved loot launch energy/values and collection. These are bounded scenarios, not guarantees for every scene/hardware combination.

[Unedited actual combat death capture](screenshots/0.16.0-death.png).
