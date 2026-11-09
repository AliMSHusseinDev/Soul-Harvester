# Soul Harvester 0.14.13 — half-duration bloody smoke

[Play 0.14.13](https://alimshusseindev.github.io/Soul-Harvester/?v=0.14.13).

Bloody smoke lifetime is 50% shorter than 0.14.12: 0.364–0.56s on ordinary enemies, after the existing 0.1s delay. Bigger/tougher enemy types retain their bounded size and lifetime bonuses, with at most 20% extra lifetime above the new base. Single-cloud emission, smooth quintic fade, wind, ground clearance and size caps retain their current settings.

Validation: 123 unit tests, strict build/formatting and 29 VFX scenarios at 720p/1080p, including the camera/raised-ground check. The lifetime comparison verifies exactly half the previous value while other particle lifetimes remain unchanged. Smoke captures use an earlier timestamp appropriate to the shorter lifetime.
