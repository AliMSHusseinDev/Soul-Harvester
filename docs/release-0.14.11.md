# Soul Harvester 0.14.11 — one coherent bloody cloud

[Play 0.14.11](https://alimshusseindev.github.io/Soul-Harvester/?v=0.14.11).

Each enemy death now produces one impact-anchored bloody cloud instead of eight independently moving puffs. The single cloud uses 1.6× base size and 1.5× opacity, retaining the screen footprint cap to limit obstruction. Its internal procedural density keeps evolving with the same smooth wind, 40% extended lifetime and eased fade. Smoke remains excluded from camera-tile culling.

Primary Splatter/Bleeding counts retain their current settings and enemy bonuses. Reduced density also produces one cloud per death. No textures or additional draw calls are added; each death uses seven fewer live smoke slots.

Validation: 122 unit tests, strict build/formatting and 29 VFX scenarios at 720p/1080p, including camera-sweep visibility. Unit checks cover one cloud per death across multiple kills and density modes, exact impact origin, unchanged blood-profile counts, lifetime/fade and cleanup. These tests do not guarantee all hardware or scene combinations.
