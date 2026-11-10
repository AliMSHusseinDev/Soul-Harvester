# Soul Harvester 0.15.1 — clean, short death feedback

[Play 0.15.1](https://alimshusseindev.github.io/Soul-Harvester/?v=0.15.1).

Developer Mode, editor UI, scripts, project loading and terrain deformation hooks are removed. The retired developer local-storage key is cleared so old tuning/maps cannot override the production game.

Death smoke is no longer emitted. Splatter is a short zero-gravity impulse (0.24–0.36s) with analytic drag, shot/contact-driven fan variation, bounded travel and a quintic fade. It neither bounces nor spawns stationary blood trails. Bleeding retains weighted gravity and mixed bounce/settle, but with reduced counts and launch: 29 ordinary, 32 critical, 12 reduced particles before bounded enemy bonuses. Hold is 0.85–1.15s, followed by a 0.28s fade; world surface clearance and ADS protection remain. Lethal body response and ordinary hit smoke remain separate from the removed death cloud.

Validation covers deterministic impact direction, zero-gravity trajectories across time steps, bounded lifetime/range, no smoke across density/type/finisher variants, monotone fades, mixed bounce/ground support, fixed pool limits, render scenarios and actual production combat. Checks are bounded regressions, not a guarantee of subjective satisfaction or every hardware/scene combination.

Passed: 113 unit tests, strict build/formatting, 29 VFX scenarios at 720p/1080p, world/ADS/ground regression and actual normal/critical/lethal shots, incoming damage and both abilities. The production browser check also seeds an old editor save and verifies that it is cleared and the Developer Button is absent.

[Unedited actual death capture](screenshots/0.15.1-death.png).
