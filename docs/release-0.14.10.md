# Soul Harvester 0.14.10 — stable smoke during camera movement

Smoke puffs previously competed for three slots in each screen-space tile. Moving the camera changed tile membership, causing otherwise live puffs to disappear abruptly. Smoke now bypasses this tile rejection while retaining fixed particle capacity, world-depth occlusion, smooth near-camera fading and size caps.

The procedural smoke mask still samples a pixel grid, but its opacity now varies continuously rather than jumping between five levels. The 40% longer bloody-smoke lifetime and analytic wind motion from 0.14.9 remain unchanged. No sprite sheets or dependencies were added.

Validation: 121 unit tests, strict build/formatting and all 29 VFX scenarios at 720p/1080p. A new browser regression clusters eight smoke puffs and sweeps the camera across screen-cell boundaries over 40 poses: all eight must remain rendered and their world positions must stay unchanged. This tests the identified visibility discontinuity; it is not a guarantee against every possible renderer issue.

[Play 0.14.10](https://alimshusseindev.github.io/Soul-Harvester/?v=0.14.10).
