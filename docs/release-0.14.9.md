# Soul Harvester 0.14.9 — longer drifting bloody smoke

[Play 0.14.9](https://alimshusseindev.github.io/Soul-Harvester/?v=0.14.9).

Death smoke lasts 40% longer (0.91–1.4 seconds, after its existing 0.1-second delay). Continuous wind drift, seeded curling and gentle rise keep it moving throughout its visible life. The procedural smoke mask keeps evolving; smoothstep opacity eases in and fades over the final 45% of life. Existing pixel styling, blood color, particle count and view caps remain.

Only bloody death smoke receives the new lifetime/motion/envelope. Splatter and Bleeding retain 0.14.8 settings. No sprite sheets or new dependencies are used.

Validation: 121 unit tests, strict production build, formatting and 29 procedural VFX scenarios at 720p/1080p. The new unit test verifies exact lifetime scaling, unchanged other particles, monotone fade, timestep-partition-independent wind motion and cleanup. These checks do not guarantee every possible hardware or scene configuration.
