# Soul Harvester 0.14.5 — longer-lived gravity shards and clean ground contact

[Play 0.14.5](https://alimshusseindev.github.io/Soul-Harvester/?v=0.14.5).

Gravity splatter now uses 20% nominal horizontal scatter and a 50% longer hold lifetime: 2.1–2.55 seconds. It stays visible through that lifetime even after landing, then fades with a smoothstep envelope over 0.35 seconds. Total life remains bounded at 2.45–2.9 seconds.

The existing mixture of immediate settling and one/two damped bounces remains. Ground contact queries visible terrain and raised map surfaces through the shared static BVH, caching samples during movement and sampling the footprint on settling. Size-aware physics clearance and camera/mask-aware visual clearance prevent the visible shard from cutting into paving or fighting its texture while keeping it close to the surface. World depth testing remains enabled.

Counts, colors, nongravity splatter, shot-dependent fans and the lethal blood sequence retain their existing settings. Controls remain in VFX in [tuning.ts](../src/game/tuning.ts).

Validation: 115 unit tests, strict build/formatting, 27 VFX scenarios at 720p/1080p, hold/fade captures, raised-map support queries, mixed bounce/settle behavior and the full world fixture including low-camera ground-clearance and ADS checks. Software rendering does not establish hardware frame rates or every possible scene configuration.

Controlled captures: [resting shards above paving](screenshots/0.14.5-resting-fixture.png), [hold phase](screenshots/0.14.5-hold-fixture.png), [fade phase](screenshots/0.14.5-fade-fixture.png).
