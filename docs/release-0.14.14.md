# Soul Harvester 0.14.14 — original Splatter feel with weighted motion

[Play 0.14.14](https://alimshusseindev.github.io/Soul-Harvester/?v=0.14.14).

Splatter returns to the primary count and launch velocity of 0.14.5 (commit 355a88d): 29 primary rays per ordinary death before enemy bonuses, instead of 37, with launch gain 1 instead of 1.125. The hard radius now uses the original fan's conservative analytic travel envelope (range gain 1). The original release had no hard cap; this limit retains bounded travel for the newer light particles that live longer.

The requested weight behavior remains: heavier particles fall faster, lighter ones linger, without changing size by weight. Bursts still start at bullet contact, follow shot direction and vary in phase/lobes/aspect each kill. All primary Splatter particles are 10% larger than 0.14.13 (size gain 1.2826). Enemy type count bonuses remain bounded. Bleeding and smoke settings retain 0.14.13 values.

Validation: 123 unit tests, strict build/formatting and 29 VFX scenarios at 720p/1080p, including camera-motion/ground-clearance regression. Checks cover current counts, exact size gain, weighted motion, impact anchoring, per-burst variation, hard range limits, cleanup and shader rendering. Software-rendered checks do not establish hardware frame rates or every scene configuration.

[Unedited controlled capture](screenshots/0.14.14-splatter-fixture.png).
