# Soul Harvester 0.14.2 — weightless splatter and falling pixel shards

[Play 0.14.2](https://alimshusseindev.github.io/Soul-Harvester/?v=0.14.2).

Each enemy death emits two distinct layers within the existing particle budget:

- #820808 wide pixel splatter, with zero gravity and no bouncing or ground snapping.
- Slightly wider #b32020 angular pixel shards, with 70% nominal launch spread, gravity and stronger drag. About 55% permit one or two damped bounces; the others settle on first contact. Settled shards stop moving and fade over 0.2 seconds. All shards have a finite airborne lifetime as well.

The 70% value describes launch velocity, not an exact measured radius: gravity, drag and ground contact determine the final travel distance. Both layers retain world depth, ADS protection and bounded rendering. Existing capacities, density and reduced effects remain.

VFX settings in [tuning.ts](../src/game/tuning.ts) control both colors, shard spread, gravity, drag, bounce probability/restitution and fade/lifetime.

Validation: 107 unit tests, strict build/formatting, 23 rendered scenarios at 720p/1080p, including isolated falling/bouncing shards and pool cleanup. Software rendering does not establish hardware frame rates.

Controlled captures: [combined burst](screenshots/0.14.2-combined-fixture.png), [falling shards](screenshots/0.14.2-falling-fixture.png), [later shard phase](screenshots/0.14.2-bounce-fixture.png).
