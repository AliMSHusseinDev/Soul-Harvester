# Procedural combat effects

Version 0.14.0 emphasizes the enemy's body response from the newer 48.8-second reference recording. Combat particles remain geometry and shader functions: no particle PNG, canvas texture, sprite sheet, atlas or frame sequence is loaded. Enemy artwork, weapon/world surfaces and fonts retain their existing assets.

## Event composition

| Event        | Layers                                                                                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Normal hit   | Approximately 100ms alpha-preserving white enemy flash, small ivory impact, directional gold flecks, short dusty red smoke                                  |
| Critical hit | White flash, compact amber/ivory accent, short outward ticks after 45ms, larger upward damage text                                                          |
| Death        | White silhouette, foot-anchored burgundy collapse, pixel erosion, wide-scattering flat rose strips/diamonds, dotted dark red trails and muted crimson smoke |
| Magic kill   | The death composition plus a radial cyan spray                                                                                                              |
| Player hurt  | Saturating red edge pulse, small crimson flecks, damped pitch/roll and weapon reaction                                                                      |
| Nova         | Teal chips/ribbons, staggered terrain rings and fractured arcs, cyan screen wash                                                                            |
| Fire orb     | Palm flash, animated hot core/halo, curved ember plumes, orange explosion and smoke                                                                         |
| Pickup       | Immediate independent loot launch on death; attraction trails, glints, existing UI/chimes                                                                   |
| Level up     | Rising orbital stars, terrain rings, blue rays/wash, existing banner and bounded cinematic time                                                             |

The ordinary-hit gold ring and always-on death floor shockwave/teal wisps from 0.12.0 have been removed. Critical hits and finishers use short gold ticks; the earlier expanding critical rings have also been removed. Cyan death spray is explicitly tied to nova/orb kills in this implementation; the reference does not reveal the source game's exact trigger.

## Body response and world integration

Living enemies apply their flash after lighting and fog while preserving their alpha outline. A pending-hit stamp ensures one visible flash when simulation steps catch up. Alpha-aware hit tests and damage calculations retain their existing behavior.

`enemy-remnants.ts` replaces twenty individual corpse sprites with a sixty-four-slot pool and at most four instanced meshes, one per enemy type. Each mesh reuses existing character artwork and shallow alpha geometry. This is character geometry, not a particle sprite sheet.

Over 380ms, clamped cubic envelopes control white-to-burgundy color, vertical collapse, narrowing, fading and deterministic UV-cell erosion. The pivot stays above the feet and uses the same terrain height as gameplay. The silhouette stays upright when the player looks down. Loot launches on the lethal simulation event independently of the remnant. Reset and expiry reclaim every slot.

Enemies have one additional shared instanced contact-shadow draw. Its stepped radial mask follows terrain slope; this is a visual grounding cue rather than a dynamic shadow map. Green terrain tiles, gold weapon materials, clouds, fill light and teal fog have been tuned for clearer foregrounds and layered distance. Map layout and navigation are unchanged.

## Simulation

`particle-simulation.ts` preallocates 1536 particle records. Emission uses seeded pseudorandom variation and golden-angle distribution. Profiles vary velocity, gravity, drag, shape, size, duration and priority. Cosmetic randomness does not modify damage, health, cooldowns or rewards. Birth sizes retain the requested 1.15 multiplier.

Motion integrates linear drag and constant gravity in closed form, using `expm1` for stable small steps, followed by terrain collision and a damped bounce. Fixed-step simulation owns lifetimes; pause freezes them and reset reclaims every slot. A bounded first-presentation allowance preserves primary cores on a slow display without keeping hidden particles forever. Delayed layers use negative age and integrate only after activation.

Twelve preallocated staging records per step collect trail samples, appended after integration to prevent slot-order-dependent double stepping. Children cannot emit more trails. Death flakes emit dark red dots; smoke does not emit fragment trails.

The pool reserves 256 slots from low-priority ambient/trail traffic. High-priority deaths and abilities can replace lower-priority effects when saturated. Emission is worst-case O(capacity × burst count), simulation and rendering O(capacity), with fixed particle storage. No per-particle scene objects, materials or textures are allocated. This uses deterministic simulation and shaders, not machine learning.

## Rendering and visibility

`procedural-vfx.ts` has at most three instanced particle draws: world planes, world cubes and impact planes. The cube path remains available but ordinary death no longer emits cubes. Twelve-cell masks (fourteen for stepped smoke) construct beveled chips, two-tone rose strips/diamonds, stars, broken annuli, wisps and evolving noise smoke. Death flakes rotate in world space, exposing flat faces; directional sparks align to projected velocity. Output applies display color conversion.

World particles respect normal depth. Primary impact accents render after the world and before the weapon, preserving the ADS iron sights. Their anchors are checked against the shared visible-geometry BVH (with the collider/floor fallback used by isolated fixtures); this is center-line visibility, not per-pixel wall-edge clipping. Remnants stay in the depth-tested world scene.

Near-plane fades and projected size caps limit close-range obstruction. Death flakes have a 7%-height length cap; smoke has a 7.5%-height cap. Separate 16×9 crowd grids admit at most six flake centers, three smoke centers or four impact centers per cell. Impact accents have a 4.5%-height cap. Reduced Effects lowers density while retaining the body flash. Body/shadow meshes are separate from the particle draw budget.

`combat-screen.ts` draws one separate final texture-free pass for red injury edges, cyan ability wash and blue celebration rays, hidden when idle. Envelopes saturate under repeated hits and decay independently. Reduced motion suppresses camera reactions; reduced effects attenuate screen feedback. The older red DOM overlay stays transparent to avoid doubling the pulse.

`gun-vfx.ts` retains world-anchored procedural barrel smoke, heat and travelling tracers. Barrel-attached 3D muzzle geometry supplies the firing flash separately from enemy feedback. Damage labels retain pooled upward screen-space placement, terrain-clamped anchors and normal/critical pop animations.

## World hits, loot and living scenery

`world-raycast.ts` indexes visible static mesh instances and cached per-geometry triangle trees. Bounds rejection limits triangle tests; normals use the inverse-transpose matrix and cutout foliage samples the existing alpha mask. Bullet targets use the nearest enemy, bell or actual surface intersection. Terrain, decorative stones, distant mountains and trunks participate independently of navigation colliders. Wind-driven foliage uses its static geometry for ballistic queries.

`surface-impacts.ts` has ninety-six pooled normal-aligned pixel scars lasting eight seconds, with world-depth testing, a small normal offset and a final fade. Surface-colored chips/dust travel away from the hit normal. There are no persistent marks on moving leaves.

Loot retains exactly-once reward accounting and clear-path checks. It launches wider at 4.8 m/s nominal horizontal speed, waits approximately 0.6 seconds and floats with 0.42m center clearance. Its magnet ramps an 8–32 m/s cap over 0.85 seconds and solves in the moving player's frame. New unlit stepped coin/crystal geometry stays readable at night and rotates/bobs without per-item scene objects.

`wind.ts` shares coherent gust uniforms between foliage and shadow shaders; root weight is zero. Tree placement samples the actual triangulated island surface, embedding the trunk footprint on slopes. Sky clouds and lunar halo animate gently, respecting reduced motion. See [master-tuning.md](master-tuning.md) for editable balance, motion and visual groups.

## Validation

- Unit tests cover seeded profiles, step-rate-independent motion, terrain clearance, priority reserves, delayed activation, trails, remnant envelopes, kill metadata, pause and cleanup.
- `npm run test:combat-vfx` renders twenty-one scenarios at 720p/1080p, including particle-isolated white/burgundy remnants, magic spray, actual framebuffer colors, wall rejection, reduced effects, saturation and cleanup.
- `npm run test:world-polish` checks ADS weapon-pixel protection at both resolutions, compact crit coverage, four world surface categories, decals, wind/reduced motion, token models and foliage shadow compilation.
- `npm run test:handling` checks the visible expanded sprint crosshair and existing movement/weapon handling.
- `npm run test:polish` checks real body responses, damage numbers, casting, muzzle/smoke and forty-enemy loot/level rewards.
- `node scripts/actual-combat-check.mjs` exercises the compiled game through actual input, including bullets, incoming damage and abilities. Screenshots/report data go to ignored `artifacts/`.

This is an original procedural interpretation of the supplied recordings. Exact source-game rendering internals cannot be recovered from video. Software-rendered checks do not establish hardware 60 FPS or guarantee every possible visual case.
