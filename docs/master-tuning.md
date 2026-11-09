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

Splatter profiles: `VFX.nongravitySplatterColor` and `VFX.gravitySplatterColor`. `gravityAmountGain` controls only the gravity shard count (1.5 means +50%, rounded up); `lethalColor` and `lethalSmokeDelay` control the killing-shot body/smoke sequence.

Version 0.14.4 adds `VFX.gravityAdditionalGain` (another 1.5 multiplier after the previous integer shard count) and `VFX.nongravitySizeGain` (1.06). Shot-dependent fan orientation and variation are deterministic; appearance variation does not modify damage or rewards.

Gravity shard timing now separates `debrisLifeMin`/`debrisLifeRange` (hold, 2.1–2.55s) from `debrisFade` (0.35s afterwards). `debrisSpread` is now 0.2 for gentler horizontal launch. Settling preserves the full hold time.
