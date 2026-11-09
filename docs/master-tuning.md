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

The current profiles are **Splatter** (`VFX.splatterColor`, #b32020) and **Bleeding** (`VFX.bleedingColor`, #820808). `lethalColor` and `lethalSmokeDelay` control the killing-shot body/smoke sequence.

Version 0.14.7 applies these changes relative to 0.14.6:

| Profile | Launch speed | Range limit | Count | Size |
| --- | --- | --- | --- | --- |
| Splatter | −25% | −40% | +5% | +10% |
| Bleeding | +30% | +70% | +15% | unchanged |

Splatter uses `splatterLaunchGain`=1.125, `splatterRangeGain`=1.02 and `splatterSizeGain`=1.166. These include the preceding gains (1.5, 1.7 and 1.06 respectively). `splatterAdditionalAmountGain`=1.05 applies after the existing count stage, rounded to the nearest whole particle. Ordinary deaths produce 37 primary splatter particles instead of 35.

Bleeding uses `bleedingLaunchGain`=1.3, `bleedingRangeGain`=1.7 and `bleedingAdditionalAmountGain`=1.15. Its historical count stages remain `gravityAmountGain` and `gravityAdditionalGain`; the new multiplier rounds the resulting count to the nearest whole particle (35 → 40 on ordinary deaths). Its range is horizontal, derived from the previous conservative drag/velocity envelope, whereas Splatter's limit is a 3D radius. Both scale with enemy size.

Both profiles vary their fan from the bullet contact/direction and seeded per-kill variation. Apparent weight changes gravity/drag independently of size. Bleeding retains mixed bounce/settle behavior, terrain clearance, `debrisLifeMin`/`debrisLifeRange` hold (2.1–2.55s) and `debrisFade` (0.35s). Reaching the horizontal range cap does not shorten that hold or stop gravity.

## 0.14.8 Bleeding update

Relative to 0.14.7: Bleeding velocity +50% (`bleedingLaunchGain` 1.95), horizontal range +50% (`bleedingRangeGain` 2.55), count +10% (`bleedingCountGain` 1.1 after previous rounding), total lifetime −20%. Hold is now 1.68–2.04s and final fade 0.28s. `bleedingRangeReferenceLife` preserves the prior analytical range reference independently of live lifetime. Ordinary/critical/reduced counts are 44/50/18 before enemy bonuses.

Enemy type count density is `1 + .18 * max(0, scale−1) + .06 * log2(max(1, hp/baseHp))`, capped at 1.3. It scales both primary blood profiles, with nearest-integer rounding; smoke count and fixed pool budgets stay unchanged. `enemyParticleSizeWeight`, `enemyParticleDifficultyWeight` and `enemyParticleCountCap` expose these controls. Health uses base enemy type health, so wave scaling does not cause unbounded visual growth. Splatter speed/range/size/lifetime are unchanged.

## 0.14.9 Bloody smoke

`bloodSmokeLifeGain`=1.4 extends death smoke from 0.65–1s to 0.91–1.4s after the existing 0.1s delay. `bloodSmokeWindSpeed`=.22, `bloodSmokeCurlSpeed`=.12 and `bloodSmokeRiseSpeed`=.12 control continuous drift/curl/rise. Closed-form curl integrals preserve motion across timestep partitions. A smoothstep entrance and final 45%-of-life fade avoid opacity jumps. Blood color, eight-puff count, view caps, Splatter and Bleeding settings remain.

## 0.14.10 Smoke motion stability

Smoke no longer participates in the 16×9 screen-cell admission limit: camera movement used to switch individual puffs on/off at tile boundaries. Fixed simulation capacity, world depth, smooth near-camera opacity and smoke footprint caps remain. The smoke shader keeps pixel-grid sampling but uses continuous density opacity instead of five alpha levels. Lifetime and wind settings retain 0.14.9 values.
