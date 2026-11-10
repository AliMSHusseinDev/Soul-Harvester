# Soul Harvester 0.15.2 — momentum-linked blood feedback

[Play 0.15.2](https://alimshusseindev.github.io/Soul-Harvester/?v=0.15.2).

Splatter streak length now contracts with analytic exponential drag, with an additional smooth release near the end of its unchanged 0.24–0.36s life. Its width, zero gravity, no-trail policy, shot-dependent direction, count budget and screen footprint caps remain. Render scale is derived from particle age rather than accumulated per frame, avoiding scale drift.

Bleeding rebounds now depend on apparent weight: heavy fragments return less vertical energy, bounded restitution stays between 0.26 and 0.42, and each bounce halves angular speed before settling stops it. Its final fade uses a quintic smootherstep with zero slope/curvature at the endpoints. Existing terrain clearance, mixed bounce/settle and lifetime/count bounds remain.

Developer Mode and death smoke remain removed. No textures, pools, draw calls or post-processing passes are added.

Validation: 115 unit tests, strict build/formatting, 29 VFX scenarios at 720p/1080p and world/ADS/terrain regression. New checks cover monotone bounded contraction, drag response, capped rebound energy, heavier-versus-lighter restitution and exact smooth fade endpoints. Software-rendered checks do not establish every hardware or scene configuration.

[Unedited controlled death capture](screenshots/0.15.2-death-fixture.png).
