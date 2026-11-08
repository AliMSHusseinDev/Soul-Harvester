# Soul Harvester 0.12.0 — layered hits and crimson smoke

[Play version 0.12.0](https://alimshusseindev.github.io/Soul-Harvester/?v=0.12.0).

Particles are 15% larger before the existing close-range size limits. Hits add brief dusty rose smoke; critical hits get a second golden ring and glint after 70ms. Deaths combine directional shaded fragments, short ember trails, a floor shockwave, rising teal wisps and muted crimson/burgundy smoke inspired by the supplied screenshot. Critical kills retain their incoming direction and gain a stronger finishing accent.

Nova gains staggered rings and fractured energy arcs. Fire orbs have an animated hot core, a faint halo and swirling plumes. Level-up stars rise with orbital motion, accompanied by rotating rings and blue rays with a quick brightness attack.

The 1536-slot pool, low-priority reserve, separate smoke/cube/core crowd grids, near-plane fades and unchanged close-range caps keep the added layers bounded. All effects remain procedural. No sprite sheets, particle images or machine-learning model are used. Damage, health, rewards and cooldown calculations retain their existing rules.

Validation: 93 unit tests, strict TypeScript/Vite build, seventeen rendered event scenarios at 720p/1080p, wall occlusion, actual GPU colors, reduced effects, saturation and cleanup, plus the body/number/casting/forty-enemy loot regression. The production-entry test exercises real normal/critical/lethal damage, incoming damage and F/Q abilities through mouse and keyboard input.

Software-rendered checks do not establish hardware 60 FPS or guarantee every possible visual case. See [procedural-effects.md](procedural-effects.md) for timing, shader and budget details.

Unedited real-game captures: [normal hit](screenshots/0.12.0-normal.png), [critical hit](screenshots/0.12.0-critical.png), [death](screenshots/0.12.0-death.png). Controlled render-fixture captures show [the smoke dissolve](screenshots/0.12.0-smoke-fixture.png) and [orb in flight](screenshots/0.12.0-orb-fixture.png).
