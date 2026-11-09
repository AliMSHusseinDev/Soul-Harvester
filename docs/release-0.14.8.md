# Soul Harvester 0.14.8 — Bleeding response

[Play 0.14.8](https://alimshusseindev.github.io/Soul-Harvester/?v=0.14.8).

Bleeding now launches 50% faster, has a 50% wider horizontal limit, emits 10% more particles and lives 20% less time than 0.14.7. The hold lasts 1.68–2.04s, followed by a 0.28s smooth fade. Ordinary deaths emit 44 particles, critical deaths 50, reduced-density deaths 18 before enemy bonuses. Range uses a fixed reference envelope so shortening lifetime does not silently shrink the requested limit. Actual travel still depends on drag, weight and ground contact.

Larger and tougher enemy types receive a modest primary Splatter/Bleeding count bonus based on size and logarithmic base-health ratio, capped at 30%. No wave-health multiplication or smoke-count inflation occurs. Existing mixed bounce/settle, impact-direction variation, sharp procedural rendering, fixed pools and ADS protection remain. Splatter motion, size, color and lifetime retain 0.14.7 settings.

Validation: unit suite, strict build, procedural VFX render scenarios and world/ADS/terrain checks. These are bounded regression checks, not a guarantee for all hardware or scene combinations. Controls are in [master tuning](master-tuning.md).

[Unedited Bleeding render capture](screenshots/0.14.8-bleeding.png). 120 unit tests and all 29 VFX scenarios at both 720p/1080p passed.
