# Soul Harvester 0.14.7 — Splatter and Bleeding balance

[Play 0.14.7](https://alimshusseindev.github.io/Soul-Harvester/?v=0.14.7).

Compared with 0.14.6, **Splatter** (#b32020) launches 25% slower, has a 40% smaller range limit, emits 5% more primary particles and has 10% larger particles. The latest speed/range corrections replace the initially requested 10%/30% reductions. Ordinary deaths emit 37 primary particles instead of 35.

**Bleeding** (#820808) launches 30% faster, has a 70% wider horizontal range limit and emits 15% more particles (35 → 40), with unchanged sizes. Light, medium and heavy apparent weights vary gravity/drag; the burst is anchored to the actual bullet contact and oriented by the shot, with seeded variation per kill. Its range guard leaves vertical motion intact. Mixed bounce/settle, clean terrain clearance, the 2.1–2.55s hold and subsequent 0.35s fade remain.

Both profiles retain fixed pools, reduced density, view caps and ADS protection. No particle textures or sprite sheets are added. Current controls are documented in [master tuning](master-tuning.md).

Validation: 118 unit tests, strict build/formatting, 29 procedural VFX scenarios at 720p/1080p, world/ADS/terrain regression, and production-input normal/critical/lethal shots, incoming damage and both abilities. These checks do not establish every possible scene configuration or hardware frame rates.

Unedited controlled captures: [Splatter in flight](screenshots/0.14.7-flight-fixture.png), [Bleeding bounce](screenshots/0.14.7-bounce-fixture.png). [Actual combat death](screenshots/0.14.7-death.png).
