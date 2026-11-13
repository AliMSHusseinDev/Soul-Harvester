# Master tuning

Edit [src/game/tuning.ts](../src/game/tuning.ts). The `TUNING` export indexes the balance and presentation groups in that one file. Development reloads changes automatically; for the published game run the checks and rebuild/deploy. Values use metres, seconds, radians and probability fractions (0.04 means 4%).

| Group                            | What it controls                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| COMBAT                           | Random critical rate/cap, head region, critical multiplier, bullet range, knockback, damage upgrades                     |
| WEAPON_TUNING / ACCURACY_TUNING  | Weapon damage, ammunition/reserve limits, fire/reload timing, recoil, hip spread, movement bloom, sprint-out and tracers |
| PLAYER_BALANCE                   | Health, bell health, movement/jump/gravity, collision radius, eye height, stamina and regeneration                       |
| ABILITIES                        | Nova/orb damage, radii, cooldowns and skill scaling; melee range/arc/knockback                                           |
| ECONOMY                          | Starting currency/points, XP thresholds, level rewards, upgrade prices/caps, ammo packs and repairs                      |
| ENEMY_TUNING / DIFFICULTY        | Enemy health/speed/damage/scale and attacks, wave counts/growth/composition/cadence                                      |
| SPAWNING / MOTION                | Spawn zones/spacing and enemy steering/separation                                                                        |
| REWARDS                          | Gold chance/value, XP and pity protection                                                                                |
| LOOT_FEEL                        | Launch arc, hover clearance, bobbing, attraction radius, acceleration, speed cap and token sizes                         |
| VFX / PRESENTATION / COMBAT_FEEL | Particle count/size/spread/lifetime, pixel mask resolution, critical accents, bullet scars and feedback timing           |
| ENVIRONMENT / LIGHTING           | Wind, root embed, cloud speed, lunar halo pulse, illumination and fog                                                    |
| VIEW / MAP_TUNING                | Camera FOV, crosshair bounds and map/player/bell positions                                                               |

Examples:

- Wider death scatter: increase `VFX.deathSpeedMin` or `deathSpeedRange`; keep drag/lifetime and close-range caps in mind.
- Faster magnet return: change `LOOT_FEEL.accelerationTime`, `springEnd` and `maxSpeed`. Acquisition still requires range and a clear path.
- More floating clearance: change `LOOT_FEEL.floorOffset`; leave room for the token's half-height and bob amplitude.
- Less frequent random criticals: lower `COMBAT.criticalBase` / `criticalPerInstinct`. Accurate upper-central headshots still guarantee a critical.
- Coarser particles: lower `VFX.maskCells`; smoke has its own `smokeCells`.
- Calmer wind/glow: lower `ENVIRONMENT.windStrength`, sway amplitudes or `moonGlowPulse`.

Default random critical chance is 4% + 1.5 percentage points per instinct rank, capped at 16%. Default magnet speed limit ramps from 8 to 32 m/s over 0.85 seconds; attraction begins after approximately 0.6 seconds within 7.5 metres. Resting token centers float 0.42 metres above the terrain, with a small bob.

Keep pool capacities positive integers, probabilities within 0–1, positive timings and sensible upgrade limits. Map placement changes should be checked against scenery/navigation. Geometry authoring coordinates and numerical solver tolerances remain alongside their implementations.

Run `npm test`, `npm run build`, `npm run test:world-polish` and the relevant browser regression after changing balance. Use `npm run test:handling` for movement/accuracy and `npm run test:combat-vfx` for particle profiles.

The current death profiles are **Splatter** (`VFX.splatterColor`, #b32020) and **Bleeding** (`VFX.bleedingColor`, #820808). Death smoke is not emitted. `lethalColor` controls the short lethal body response.

| Control | Current behavior |
| --- | --- |
| Splatter lifetime | `splatterLifeMin` .24 + `splatterLifeRange` .12 seconds |
| Splatter motion | Zero gravity, no collision/bounce, no stationary trails; `splatterDrag` 2.6 |
| Splatter fade | Quintic smooth envelope over normalized lifetime; exact zero at completion |
| Splatter count | 29 ordinary rays, bounded type-density bonus; reduced density remains supported |
| Bleeding count | 29 ordinary, 32 critical, 12 reduced before bounded enemy bonuses |
| Bleeding launch/range | `bleedingLaunchGain` 1.3; `bleedingRangeGain` 1.5 against the conservative reference envelope |
| Bleeding timing | `debrisLifeMin` .85 + `debrisLifeRange` .3 seconds, then `debrisFade` .28 seconds |
| Bleeding physics | Weighted gravity, damped mixed bounce/settle, actual support queries and size-aware clearance |

Both layers retain shot-contact origin, shot direction and seeded per-kill fan variation. Size/difficulty count bonuses are bounded at 30%. Fixed pools, priority reserves, screen caps and depth protection for ADS remain. Old weighted-Splatter and bloody-smoke controls are retired. Developer Mode and local overrides are removed; production tuning lives in source again.

Version 0.15.2 derives Splatter render length from exponential drag and normalized release age. Bleeding restitution uses weight and a bounded 0.26–0.42 range; bounce halves spin, and final opacity uses a quintic envelope. Timing, count and no-smoke settings retain 0.15.1 values.

## 0.16.0 Secondary death presentation

Core blood settings stay unchanged. New secondaries use the existing fixed pool: four close flecks, six surface-colored ground flecks, one critical slash. `Effects.deathBudget` admits at most three immediate secondary sets, replenishes ten per second, skips secondaries above 800 active particles and honors reduced effects. Ground blood uses 24 slots maximum within the existing scar pool and a 1.1s lifetime. Shader silhouette/erosion follows shot contact; reaction offsets and vegetation pulses are bounded. Loot direction changes preserve launch speed and reward amounts. Sound remains unchanged.
