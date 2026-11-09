# Soul Harvester 0.14.12 — balanced smoke fade and terrain clearance

[Play 0.14.12](https://alimshusseindev.github.io/Soul-Harvester/?v=0.14.12).

Ordinary smoke lasts 20% less time than 0.14.11 (0.728–1.12s after the existing delay). Quintic smootherstep provides a gradual entrance/exit with zero first and second derivatives at the endpoints and exact zero opacity when finished.

Enemy scale still controls size. Tougher type density adds a modest extra size bonus, capped at 9%; combined size/difficulty lifetime bonus is capped at 20% above the new base. Wave HP does not inflate smoke. Single-cloud emission, wind, blood color and screen footprint limits remain.

Smoke queries terrain/support over its conservative growing footprint, and its rendered center uses a smooth maximum over a camera-independent bounding sphere. This keeps the quad above sampled ground/paving as it expands and the camera moves, without bouncing or snapping its simulation position.

Validation: 123 unit tests, strict build/formatting, 29 VFX scenarios at 720p/1080p and a 40-pose camera test that checks the actual rendered quad's bottom above a raised floor. Unit tests cover bounded enemy scaling, ground queries, sphere clearance, shorter lifetime, smooth endpoint fade and cleanup. Finite support sampling cannot certify every arbitrary terrain discontinuity or hardware configuration.
