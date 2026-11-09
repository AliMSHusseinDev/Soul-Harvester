# Soul Harvester 0.14.3 — swapped splatter and lethal blood flash

[Play 0.14.3](https://alimshusseindev.github.io/Soul-Harvester/?v=0.14.3).

- Nongravity splatter is now #b32020; gravity splatter is #820808.
- Gravity shard count increases by 50%, rounded up to whole particles. Existing nongravity rays and smoke are preserved: normal deaths emit 23 shards instead of 15; critical finishers emit 26 instead of 17. Pool capacity remains fixed.
- A killing shot produces an alpha-preserving #7d101a body flash instead of white. It collapses/fades in the same blood color, then matching smoke starts 100ms after the lethal event. Nonlethal white feedback remains.

The gravity layer retains its 70% nominal launch spread, mixed one/two-bounce or immediate-settle behavior and fast resting fade. Nongravity rays retain their wide, weightless motion.

Editable controls: VFX.nongravitySplatterColor, gravitySplatterColor, gravityAmountGain, lethalColor and lethalSmokeDelay in [tuning.ts](../src/game/tuning.ts).

Validation: 109 unit tests, strict build/formatting, 23 rendered profiles at 720p/1080p, initial blood-body pixels with zero white pixels, delayed smoke, exact shard counts/reduced density, and the body/number/casting/forty-enemy reward regression. Software-rendered tests do not establish hardware frame rates.

Controlled captures: [lethal body flash](screenshots/0.14.3-blood-flash-fixture.png), [combined splatter](screenshots/0.14.3-splatter-fixture.png), [smoky blood](screenshots/0.14.3-smoke-fixture.png).
