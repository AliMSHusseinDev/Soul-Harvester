# Soul Harvester 0.6.0 — combat and horde polish

This update extends the existing Three.js/TypeScript game. The original pixel textures, lunar sky, valley, layered forest, raised keep, bridge, three weapons, two spells, NPCs and upgrade systems remain integrated.

## Implemented

- **Living horde:** safe flow-field lookahead, smooth velocity changes, ±7% individual speed variation, bounded lateral lanes and spatial separation. Stationary attackers also separate. Four original atlas poses per enemy type use an identical alpha mask, keeping both extruded edges and hit detection consistent. Walking follows distance travelled; attacks have a separate pose. Ordinary gunfire no longer restarts attack windups; heavy knockback interrupts.
- **Confirmed impact feedback:** the existing 85 ms alpha-preserving white body flash is joined by a tiny expanding white ring, 7–10 coral/red/yellow/orange shards, a short red marker pop/fade and distinct normal/critical/kill sounds. Impact fragments originate just outside the actual intersection surface to avoid depth fighting. Stronger enemies receive larger death bursts. Occasional tracers originate at the weapon muzzle.
- **Readable damage numbers:** white normal numbers and 30%-larger gold critical numbers pop, drift sideways/upward and fade over 0.72/0.88 seconds. Color follows the confirmed critical flag. Damage formulas are unchanged. A 32-number pool and bounded 64-texture cache limit clutter and resource growth.
- **Weapons and abilities:** smoother running pose, visible magazine extraction/reinsertion during the real reload, and an extended gloved palm while the weapon lowers. F/Q reserve their real cooldown immediately, release once after 0.12/0.16 seconds of anticipation, then recover. Reset cancels pending releases. Existing ammo transfer, ADS, melee, spell damage and cooldown rules remain.
- **Loot stream:** a smaller upward pop, controlled circular spread and diminishing bounce lead into attraction after 0.52–0.585 seconds. A time-based acquisition budget, mild trajectory variation and accelerating critically damped springs create a stream. Wall checks, speed limits, terrain clearance, near-camera shrinking, colored trails and chimes remain. Gold feedback now reports the exact greed-adjusted grant. XP remains reliable; normal gold remains probabilistic with dry-streak protection.
- **Health and progression:** immediate vitality updates, a short red vignette and restrained weapon/camera response; large pixel-style LEVEL UP message with pop, cyan/gold sparkles and a chord. Existing immunity, healing and two-point level rewards remain.
- **Rendering:** shard and flash instances share bounded batches; particle simulation runs at the fixed step while GPU buffers upload once per displayed frame. The direction-space sky gains subtle lunar rays. Active enemies and uncollected rewards are never removed for performance.

Seven reachable spawn zones still cover the forest from left to right. Each confirmed bell hit adds one concurrent wave, stopping at ten. Wave populations remain 8, 12, …, 44, totaling 260 enemies, with per-wave health/speed/type tuning and no changes to earlier enemies when a later wave starts.

## Main files changed

| Area                                    | Files                                                                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Horde motion and combat events          | `battle.ts`, `navigation.ts`, `enemies.ts`, `textures.ts`, `tuning.ts`                                              |
| Pooled combat presentation              | New `presentation.ts`, `effects.ts`, `feedback.ts`                                                                  |
| Weapons, hand animation and integration | `weapon.ts`, `main.ts`                                                                                              |
| Loot, HUD, audio and atmosphere         | `loot.ts`, `ui.ts`, `audio.ts`, `sky.ts`, `style.css`                                                               |
| Verification                            | New `movement.test.ts`, `presentation.test.ts`, `scripts/polish-check.mjs`; expanded battle, loot and browser tests |
| Documentation/version                   | `README.md`, `scripts/README.md`, this report, `package.json`, `package-lock.json`                                  |

Game TypeScript paths above are under `src/game/`, except `src/main.ts` and `src/style.css`.

## Verification

- 67 unit tests across 13 files: collision-safe crowd routes around obstacles and across the bridge, individual movement, stationary contact separation, attack interruption rules, metadata/damage consistency, exactly-once ability release, bounded particle reuse, critical-number scaling, 100-item streamed collection with exact rewards, plus the existing wave, navigation, economy, terrain and artwork invariants.
- TypeScript/Vite production build and formatting/whitespace checks.
- Production visual check: all twenty 32/64px pixel surfaces retain nearest magnification; forest, dagger and rifle ADS captures pass. Both sights align with the camera axis. Four sky directions render without a wrap boundary or browser/renderer errors.
- Isolated Chromium presentation fixture using the actual game classes: four identical atlas alpha masks, before/after white-body screenshots, normal/critical number rendering, visible pixel impacts, open-hand casting, forty-enemy loot stream, LEVEL UP banner and complete rewards (203 gold total, level 7, 16 points). Pixel inspection confirms the body brightens while transparent portions remain unchanged. This controlled scene is a test fixture, not production gameplay footage.
- Complete real-input production-browser regression: pointer capture, upgrades, movement/jump/landing, pedestal collision, pistol ADS/reload, environmental shots without hit markers, melee/weapon switching, both delayed abilities releasing once, seven forest zones and four-frame movement, white flashes/red markers/actual kills, bridge crossing, player/bell aggro switching, gold/XP collection, pause/resume/audio and narrow-screen menu. Ten stacked waves retained all 260 enemies and all four types; earlier health remained unchanged and extra bell shots could not start wave eleven. The stress capture used 36 draw calls; GPU resource counts stayed stable while paused, with no browser/renderer errors.

## Practical limits

Browser automation uses Chromium/SwiftShader on the CPU. Hardware-GPU frame rates, long play sessions and subjective weapon/audio feel still need device playtesting; these checks do not prove 60 fps or perfect game balance. Visual assets and tuning are original interpretations of the supplied references. The production bundle is approximately 641 KB uncompressed / 174 KB gzip before fonts; Vite retains its bundle-size advisory. Progress remains per run; mobile touch controls, multiplayer and monetization are outside this update.
