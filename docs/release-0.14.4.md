# Soul Harvester 0.14.4 — varied shot-driven splatter

[Play 0.14.4](https://alimshusseindev.github.io/Soul-Harvester/?v=0.14.4).

Gravity splatter gains another 50%, rounded upward after the previous count: 23 → 35 for ordinary deaths, 26 → 39 for critical finishers, and 9 → 14 in reduced effects. Nongravity splatter (#b32020) gains exactly 6% birth size; gravity shards and lethal smoke retain their sizes.

Nongravity rays originate at the lethal bullet contact. Incoming direction, surface normal and bounded contact offsets orient a local fan frame. A seeded per-kill phase, angular warp, lobe/aspect variation and individual stretch changes make successive kills differ while preserving deterministic replay. Normalized transverse velocities maintain broad three-dimensional scatter. Colors, gravity/bounce behavior, blood flash/delayed smoke and ADS protection retain their existing rules. No damage/reward calculations change.

New controls: VFX.gravityAdditionalGain and VFX.nongravitySizeGain in [tuning.ts](../src/game/tuning.ts). Existing particle capacity, priorities and view caps remain; extra shards can be dropped by the existing saturation policy.

Validation: 112 unit tests, strict build/formatting, 25 VFX scenarios at 720p/1080p, distinct left/right contact captures, lethal metadata transport, successive fan variation, exact size scaling and broad 3D travel. Actual production input checks cover normal/critical/lethal shots, world hits, incoming damage and both abilities. Software rendering does not establish hardware frame rates.

Controlled contact captures: [left](screenshots/0.14.4-left-fixture.png), [right](screenshots/0.14.4-right-fixture.png). [Unedited real-game death capture](screenshots/0.14.4-death.png).
