# Soul Harvester 0.11.0 — procedural combat feedback

[Play version 0.11.0](https://alimshusseindev.github.io/Soul-Harvester/?v=0.11.0).

Combat feedback is rebuilt around procedural geometry and shaders, following the supplied damage video. All previous combat sprite sheets, packed PNGs, catalog, renderer, source image copies and importer are removed. The barrel smoke image is also replaced with a procedural shader.

Ordinary/critical hits combine cores, broken rings and gold ribbons. Deaths scatter shaded crimson cubes and smoke. Nova sends teal particles and a terrain-following wave outward; fire orbs leave ember trails and explode into orange sparks and smoke. Pickup glints, green healing crosses, rising level stars, blue celebration rays and a red incoming-damage edge pulse complete the feedback. Camera injury reactions now include a restrained damped roll as well as pitch; reduced-motion settings suppress them.

A fixed 1536-record pool, deterministic emission, exact drag integration, priority reserves, static-world visibility and projected size limits bound the work. Three instanced particle batches plus one screen-feedback draw avoid a draw call per particle. Damage numbers retain their upward-only layout. Gameplay damage/rewards and ability cooldown rules remain unchanged.

Validation: 90 unit tests, strict TypeScript/Vite build, twelve procedural event scenarios at 720p/1080p, world occlusion, actual colored GPU pixels, reduced effects, bounded stress/cleanup and no particle image requests. The presentation fixture additionally checks body responses, numbers, casting, muzzle smoke and forty-enemy loot/level rewards. Production-entry gameplay verification uses actual mouse/keyboard damage and ability inputs.

Technical details and practical limits are in [procedural-effects.md](procedural-effects.md). This is an original interpretation of the reference, not a claim of pixel-identical reconstruction or verified hardware 60 FPS.

Unedited production-game captures: [normal hit](screenshots/0.11.0-normal.png), [critical hit](screenshots/0.11.0-critical.png), [death](screenshots/0.11.0-death.png), [nova in a crowd](screenshots/0.11.0-nova.png) and [incoming damage](screenshots/0.11.0-player-hurt.png).
