# Soul Harvester 0.14.1 — deep-red pixel scatter

[Play 0.14.1](https://alimshusseindev.github.io/Soul-Harvester/?v=0.14.1).

Death fragments now form sharp, broken pixel rays and square flecks inspired by the supplied reference. They use #780606 without white/pink highlights, align to projected movement and leave matching deep-red dotted trails. Smoke uses the same tint.

Death launch speed increases to 7–14 m/s before the global 1.3 scatter multiplier, with longer 0.62–0.84s motion and lower drag. Other moving particle profiles also gain 30% launch velocity. Stationary impact accents and ground rings keep their anchors. ADS protection, compact critical feedback, visibility caps, fixed pools, reduced effects and cleanup remain.

Edit VFX.deathColor, scatterGain, deathSpeedMin/deathSpeedRange, deathLifeMin/deathLifeRange and deathDrag in [tuning.ts](../src/game/tuning.ts).

Validation: 106 unit tests including the exact red, multi-metre outward scatter and lifetime cleanup; strict production build; 21 rendered VFX scenarios at 720p/1080p. Software-rendered verification does not establish hardware frame rates.

[Controlled scatter capture](screenshots/0.14.1-scatter-fixture.png).
