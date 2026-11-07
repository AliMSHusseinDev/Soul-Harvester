# Soul Harvester 0.7.0 — sprint, accuracy and weapon atmosphere

Implements the supplied advanced gameplay/visual polish request in the existing Three.js/TypeScript game. No framework or runtime dependency was added.

## Changes

- Removed the specific wide-canopy landmark tree: trunk, nine crowns, branches, shadows and its collision box. The surrounding conifers, forest spawn zones, ground and lighting remain. The center of the field now has a clear view toward the forest beneath the moon.
- Added a deterministic handling controller for idle, walking, sprinting, sprint-out, airborne, aiming and firing. Forward sprint immediately hides the crosshair and blocks gunfire/ADS. Clicking fire buffers the tap, exits sprint, waits the rifle's full 0.225-second delay, then fires once. ADS also exits sprint. Per-weapon delays, shot recovery, busy actions and stamina prevent conflicting transitions.
- The existing weapon models tilt upward/right while sprinting. Distance-driven bob, bounded rotational recoil and fixed-step pose interpolation remove speed-threshold animation snapping. Dynamic tapered forearms keep wrists attached to the original hands and anchor elbows below the screen instead of exposing floating arm caps. Repeated casting blends from the existing hand pose rather than restarting a sine animation abruptly.
- Four pure-white, 2px dashes with dark 1px outlines replace the tiny crosshair. No center dot. Integer-snapped layout stays centered at 720p/1080p and other sizes. The HUD gap projects the same angular cone sampled by hip-fire bullets, including weapon, velocity, airborne and shot penalties. Holding C/Left Ctrl crouches and reduces the baseline by 15%; ADS remains precise. No prone stance was added.
- Confirmed hits show a white X fading over 0.2 seconds; kills show a larger red X with priority and a heavier sound. Misses do not trigger either. Existing normal-white/critical-gold damage meanings remain; confirmed headshots use orange. Fractional damage remains visible (28.5 is displayed as 28.5), with at most two decimal places. Distance-scaled text, staggered lanes and decelerating drift improve readability. Pool replacement protects live critical/kill numbers from ordinary-hit spam.
- Layered muzzle flashes now sit beyond the real barrel exit, with randomized rotation/size, white core, restrained halo and brief local light. World-space tracer ribbons have a bright core and wider faint halo, configurable frequency, projected width and a travelling segment. Hitscan damage still happens immediately and does not depend on the visual's travel time.
- Added pooled soft barrel smoke with heat buildup, brief residual emission, inherited movement, buoyancy, turbulence and exponential damping. Emitted puffs stay in world space when the camera turns. Three bounded batches cover smoke and both tracer layers. Existing impact/death/loot effects share the reusable instance-opacity material.
- Increased base enemy speeds: hollowguard 2.55, ravener 3.8, brute 1.7, witch 2.2 metres/second before existing wave/individual modifiers. Velocity changes have an acceleration cap and arrival easing. Decisions and safe path lookahead run on staggered timers; essential collision/motion still run every simulation step. Spatial hashing handles crowds; indexed static cells narrow collision and visibility queries. Enemy poses interpolate between simulation positions.

All ten concurrent bell waves, 260-enemy capacity, earlier-enemy health, probabilistic gold, XP, magnetic loot, upgrades, abilities, ammo/reload rules, terrain and bridge systems remain integrated.

## Main files

| Area                                      | Files                                                                                                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Handling and shared accuracy              | New `src/game/handling.ts`; `player.ts`, `main.ts`, `style.css`                                                                                                          |
| Viewmodel, connected arms, muzzle effects | `src/game/weapon.ts`                                                                                                                                                     |
| Smoke/tracer simulation and rendering     | New `src/game/ballistics.ts`, `gun-vfx.ts`, `vfx-material.ts`                                                                                                            |
| Damage presentation and feedback          | `effects.ts`, `presentation.ts`, `audio.ts`, `tuning.ts`                                                                                                                 |
| AI, collision indexing and motion         | `battle.ts`, `navigation.ts`, `enemies.ts`, `waves.ts`                                                                                                                   |
| Removed landmark                          | `src/game/world.ts`                                                                                                                                                      |
| Verification                              | New handling/smoke unit tests, expanded movement/navigation/presentation tests; `scripts/handling-check.mjs`, `ai-benchmark.mjs`, expanded browser/visual/polish scripts |

Unprefixed game files above are under `src/game/`; `main.ts` and `style.css` are under `src/`.

## AI measurement

`npm run bench:ai` runs 1,200 fixed steps per case, excluding the first 120 samples. The deterministic fixture starts a mixed horde behind one wall and routes it toward the bell. These CPU timings include the changed movement tuning, local separation and navigation; they are not rendering benchmarks or proof of algorithmic worst-case bounds.

| Enemies retained | Before mean / p95 | After mean / p95 |
| ---------------- | ----------------- | ---------------- |
| 8                | 0.170 / 0.352 ms  | 0.096 / 0.267 ms |
| 80               | 0.797 / 1.359 ms  | 0.301 / 0.589 ms |
| 260              | 2.197 / 3.385 ms  | 1.490 / 2.285 ms |

At 260 enemies this run reduced mean simulation time by approximately 32%. All enemies remained active. Timings vary by host/load; a dense cell can still require many neighbor comparisons. Hash lookup has expected constant cost; complete AI and separation are not claimed to have constant worst-case complexity.

## Validation

- 78 unit tests across 15 files, including sprint-out timing and input readiness, jump/fall/ADS/busy transitions, 720p/1080p cone projection, sampled bullet bounds, crouch/air/shot modifiers, fractional damage, smoke pool reuse/world momentum/decay, indexed negative-coordinate walls, acceleration limits and staggered decisions. Existing ten-wave, economy, loot, terrain, movement and artwork invariants pass.
- Strict TypeScript/Vite production build, formatting and whitespace checks.
- Production visual check: the remaining nineteen cached pixel tiles retain their 32/64px sizes and nearest magnification; the removed tree's canopy tile is no longer loaded. Forest, dagger, rifle sights, anchored sprint arms and all four sky directions render without browser/renderer errors.
- Controlled renderer fixture: alpha-preserving body flash, white normal and fractional gold critical text, actual coral-colored GPU fragments, layered muzzle flash, soft world-space smoke and open-hand casting. Spam tests protect important numbers while bounding the 32-number pool and 64-texture cache. Forty defeated enemies stream all their real loot into the player and trigger level-up feedback. This fixture is separate from production gameplay footage.
- Real-input handling browser check: centered white 2px crosshair at 720p and 1080p, crouch and airborne bloom, sprint crosshair hiding, one buffered fire tap after the complete 0.225-second delay, ADS transition and bounded smoke/tracer cleanup. Confirms the removed landmark has no remaining collider.
- Complete production-browser regression: upgrades, movement/jumps, collision, ADS/reload, quick taps, melee/weapons, both spells, seven forest zones, actual damage/white flashes/kill feedback, bridge crossing, player/bell aggro, real loot collection, pause/audio, narrow layout and all ten waves. All 260 enemies/four types remained, old health remained unchanged, there was no wave eleven and no browser/renderer errors. Stress capture: 35 draw calls; paused geometry/texture counts remained stable.

## Limits

The automated browser uses CPU SwiftShader and cannot establish the 60-fps/1080p hardware-GPU target. Representative-device frame pacing, long-session behavior and subjective weapon/audio feel still need playtesting. Smoke uses soft alpha textures and depth testing, not a full scene-depth soft-particle pass. The work is an original visual/handling interpretation; it uses no MW2 assets. Progress remains per run; touch controls, prone, multiplayer and monetization are not part of this update.
