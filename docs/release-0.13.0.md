# Soul Harvester 0.13.0 — silhouette hits and rose fragments

[Play version 0.13.0](https://alimshusseindev.github.io/Soul-Harvester/?v=0.13.0).

Enemy hits now briefly whiten the full alpha-preserving silhouette. Death begins with that white shape, then collapses toward the feet into a fading burgundy remnant with pixel erosion over 380ms. Loot launches immediately, before the remnant disappears.

Death debris is now flat two-tone pink strips and diamond flakes with dark red dotted trails and muted crimson smoke. The previous ordinary-death cubes, floor shockwave and automatic teal wisps are removed. Magic kills add a radial cyan spray; this trigger is our implementation choice, since it cannot be determined from the reference. Critical hits and finishers retain their short gold echo.

The requested 15% birth-size increase remains. Fixed pools, priority reserves, overlap grids and projected-size caps limit crowding. Remnants use sixty-four pooled slots and at most four instanced draws. Enemy contact shadows use one shared draw. Combat particles remain procedural, without particle images or machine-learning models.

Brighter pixel greens, more readable gold, brighter clouds and layered teal fog bring the scene closer to the reference palette. Damage, rewards, cooldowns and navigation retain their existing rules. Damage numbers keep their upward pop and above-terrain anchors.

Validation covers 96 unit tests, strict TypeScript/Vite build, formatting, twenty-one rendered scenarios at 720p/1080p, isolated white/burgundy body phases, magic spray, shader colors, occlusion, reduced effects, saturation and cleanup. The polish fixture covers body/number/casting behavior and forty-enemy loot/reward integrity. The production-entry check uses actual mouse/keyboard input for normal, critical and lethal hits, incoming damage and both abilities.

Software-rendered checks do not establish hardware frame rates or guarantee every possible visual case. See [procedural-effects.md](procedural-effects.md) for implementation and budgets.

Unedited real-game captures: [normal hit](screenshots/0.13.0-normal.png), [critical hit](screenshots/0.13.0-critical.png), [death](screenshots/0.13.0-death.png). Controlled render-fixture captures isolate [the white silhouette](screenshots/0.13.0-white-fixture.png) and [the burgundy collapse](screenshots/0.13.0-burgundy-fixture.png).
