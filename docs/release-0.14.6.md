# Soul Harvester 0.14.6 — stronger, wider weighted splatter

[Play 0.14.6](https://alimshusseindev.github.io/Soul-Harvester/?v=0.14.6).

The #b32020 profile gains 50% initial velocity, 20% more primary rays rounded upward (29 → 35 on ordinary deaths), and a maximum radius 70% wider than the preceding fan's conservative analytical travel envelope. Each ray stays anchored to the lethal bullet contact and retains shot-direction/body-contact fan variation. Particle sizes are unchanged.

This profile now uses apparent-weight tiers: heavier rays fall and settle quickly, lighter rays float longer with lower drag, and some light rays stop before reaching the maximum radius. Near the range edge, radial damping and monotone fading ease the effect out. A hard position guard also bounds trail samples and terrain-corrected particles. Sizes are independent of apparent weight.

The existing #820808 gravity shards retain their count, 20% launch spread, mixed bounce/settle behavior, 2.1–2.55s hold and 0.35s final fade. The #7d101a lethal flash and smoke sequence is unchanged. Fixed particle capacity, priority reserves, reduced density, world depth and view caps remain.

New controls are in VFX in [tuning.ts](../src/game/tuning.ts): splatterLaunchGain, splatterAmountGain, splatterRangeGain and the weight-response settings.

Validation: 117 unit tests, strict build/formatting, 29 VFX scenarios at 720p/1080p, world/ADS/ground-support regression and production-input normal/critical/lethal shots, incoming damage and both abilities. Unit checks include exact velocity/range multipliers, unchanged size, hard bounds, varied light travel, monotone edge opacity and cleanup. Software rendering does not establish hardware frame rates or every possible scene configuration.

Controlled captures: [weighted flight](screenshots/0.14.6-flight-fixture.png), [later light rays](screenshots/0.14.6-late-fixture.png). [Unedited actual death capture](screenshots/0.14.6-death.png).
