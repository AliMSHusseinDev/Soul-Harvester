# Procedural combat effects

Version 0.14.5 emphasizes the enemy's body response from the newer 48.8-second reference recording. Combat particles remain geometry and shader functions: no particle PNG, canvas texture, sprite sheet, atlas or frame sequence is loaded. Enemy artwork, weapon/world surfaces and fonts retain their existing assets.

## Event composition

| Event        | Layers                                                                                                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Normal hit   | Approximately 100ms alpha-preserving white nonlethal enemy flash, small ivory impact, directional gold flecks, short dusty red smoke                                       |
| Critical hit | White flash, compact amber/ivory accent, short outward ticks after 45ms, larger upward damage text                                                                         |
| Death        | Blood-colored lethal silhouette, foot-anchored blood collapse, pixel erosion, wide-scattering broken pixel rays in #b32020, matching dotted trails and muted crimson smoke |
| Magic kill   | The death composition plus a radial cyan spray                                                                                                                             |
| Player hurt  | Saturating red edge pulse, small crimson flecks, damped pitch/roll and weapon reaction                                                                                     |
| Nova         | Teal chips/ribbons, staggered terrain rings and fractured arcs, cyan screen wash                                                                                           |
| Fire orb     | Palm flash, animated hot core/halo, curved ember plumes, orange explosion and smoke                                                                                        |
| Pickup       | Immediate independent loot launch on death; attraction trails, glints, existing UI/chimes                                                                                  |
| Level up     | Rising orbital stars, terrain rings, blue rays/wash, existing banner and bounded cinematic time                                                                            |

The ordinary-hit gold ring and always-on death floor shockwave/teal wisps from 0.12.0 have been removed. Critical hits and finishers use short gold ticks; the earlier expanding critical rings have also been removed. Cyan death spray is explicitly tied to nova/orb kills in this implementation; the reference does not reveal the source game's exact trigger.

## Body response and world integration

Living enemies apply their flash after lighting and fog while preserving their alpha outline. A pending-hit stamp ensures one visible flash when simulation steps catch up. Alpha-aware hit tests and damage calculations retain their existing behavior.

`enemy-remnants.ts` replaces twenty individual corpse sprites with a sixty-four-slot pool and at most four instanced meshes, one per enemy type. Each mesh reuses existing character artwork and shallow alpha geometry. This is character geometry, not a particle sprite sheet.

Over 380ms, clamped cubic envelopes control blood color, vertical collapse, narrowing, fading and deterministic UV-cell erosion. The pivot stays above the feet and uses the same terrain height as gameplay. The silhouette stays upright when the player looks down. Loot launches on the lethal simulation event independently of the remnant. Reset and expiry reclaim every slot.

Enemies have one additional shared instanced contact-shadow draw. Its stepped radial mask follows terrain slope; this is a visual grounding cue rather than a dynamic shadow map. Green terrain tiles, gold weapon materials, clouds, fill light and teal fog have been tuned for clearer foregrounds and layered distance. Map layout and navigation are unchanged.

## Simulation

`particle-simulation.ts` preallocates 1536 particle records. Emission uses seeded pseudorandom variation and golden-angle distribution. Profiles vary velocity, gravity, drag, shape, size, duration and priority. Cosmetic randomness does not modify damage, health, cooldowns or rewards. Birth sizes retain the requested 1.15 multiplier.

Motion integrates linear drag and constant gravity in closed form, using `expm1` for stable small steps, followed by terrain collision and a damped bounce. Fixed-step simulation owns lifetimes; pause freezes them and reset reclaims every slot. A bounded first-presentation allowance preserves primary cores on a slow display without keeping hidden particles forever. Delayed layers use negative age and integrate only after activation.

Twelve preallocated staging records per step collect trail samples, appended after integration to prevent slot-order-dependent double stepping. Children cannot emit more trails. Death flakes emit dark red dots; smoke does not emit fragment trails.

The pool reserves 256 slots from low-priority ambient/trail traffic. High-priority deaths and abilities can replace lower-priority effects when saturated. Emission is worst-case O(capacity × burst count), simulation and rendering O(capacity), with fixed particle storage. No per-particle scene objects, materials or textures are allocated. This uses deterministic simulation and shaders, not machine learning.

## Rendering and visibility

`procedural-vfx.ts` has at most three instanced particle draws: world planes, world cubes and impact planes. The cube path remains available but ordinary death no longer emits cubes. Twelve-cell masks (fourteen for stepped smoke) construct beveled chips, broken deep-red pixel rays, stars, broken annuli, wisps and evolving noise smoke. Death rays and sparks align to projected velocity; stepped gaps and detached pixel cells form sharp silhouettes. Deep-red masks retain their authored color without white facet highlights. Output applies display color conversion.

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
- `npm run test:combat-vfx` renders twenty-seven scenarios at 720p/1080p, including particle-isolated lethal blood remnants, magic spray, actual framebuffer colors, wall rejection, reduced effects, saturation and cleanup.
- `npm run test:world-polish` checks ADS weapon-pixel protection at both resolutions, compact crit coverage, four world surface categories, decals, wind/reduced motion, token models and foliage shadow compilation.
- `npm run test:handling` checks the visible expanded sprint crosshair and existing movement/weapon handling.
- `npm run test:polish` checks real body responses, damage numbers, casting, muzzle/smoke and forty-enemy loot/level rewards.
- `node scripts/actual-combat-check.mjs` exercises the compiled game through actual input, including bullets, incoming damage and abilities. Screenshots/report data go to ignored `artifacts/`.

This is an original procedural interpretation of the supplied recordings. Exact source-game rendering internals cannot be recovered from video. Software-rendered checks do not establish hardware 60 FPS or guarantee every possible visual case.

In 0.14.1, death rays use #780606, 7–14 m/s initial horizontal emission before the global 1.3 scatter multiplier, 0.62–0.84s lifetimes and 1.25 drag. All moving, non-overlay, non-ground particle profiles receive the scatter multiplier; primary accents and ground rings retain their authored anchors and view caps.

## 0.14.2 two-layer death response

The #820808 splatter rays, smoke and trail dots have zero gravity and no terrain collision response. World depth still occludes particles behind terrain; they never bounce or snap to the floor.

A separate #b32020 angular pixel-shard layer occupies the former chip slots, keeping the total burst budget unchanged. Shards are slightly wider, launch at 70% nominal horizontal velocity, use stronger drag and gravity, and have mixed contact behavior. About 55% allow one or two damped bounces; the rest settle immediately. Rest stops translation, spin and gravity, followed by a 0.2s fade. A finite 1.4–1.7s lifetime also bounds airborne pieces. Terrain clearance accounts for shard size. All collision state resets when a pool slot is reused, including trail children.

Colors, nominal spread, gravity, drag, bounce chance, restitution, fade and lifetime are editable in VFX in tuning.ts. Tests cover both collision modes, finite bounce budgets, settling, expiry and isolated falling/bouncing renders at both resolutions.

## 0.14.3 color swap and lethal sequence

The named profiles are now nongravity splatter (#b32020) and gravity splatter (#820808). Gravity shard count receives a 1.5 multiplier, rounded up to whole particles, without reducing the existing ray or smoke counts. Normal full-density deaths therefore emit 23 gravity shards instead of 15; critical finishers emit 26 instead of 17. Fixed pool capacity, priorities and screen caps remain.

The lethal body remnant uses #7d101a throughout its flash/collapse, preserving alpha; it never turns white. Nonlethal enemy flashes remain white. Eight smoke puffs use the same #7d101a and are scheduled 100ms after the lethal event. Smoke activation follows fixed simulation time and resets with the pool. Both the isolated initial body color and delayed smoke are checked independently.

## 0.14.4 contact-driven fans

Lethal events now retain the exact contact point, incoming XYZ direction and surface normal through the battle event, main loop and effects renderer. Nongravity rays originate at that contact. A blended/normalized shot axis includes bounded body-contact offsets. Its orthonormal tangent frame supports a seeded angular phase, angular warp, lobe variation, aspect/density changes and per-ray stretch variation. Transverse normalization preserves broad 3D travel while changing the projected fan shape. Consecutive kills vary reproducibly without using wall-clock randomness.

Only #b32020 birth sizes gain another 1.06 multiplier; trails inherit that size through their parent. Gravity shards receive a further 1.5 count multiplier after previous whole-particle rounding: ordinary deaths increase from 23 to 35, critical finishers from 26 to 39, and reduced-density deaths from 9 to 14. Pool capacity and projected size caps remain.

Tests check lethal metadata transport, deterministic replay, successive fan variation, contact/direction sensitivity, exact 6% size scaling and preserved wide 3D spread. Left/right body-contact renders are distinct at both resolutions. Production mouse/keyboard combat checks exercise real bullet kills and the complete feedback pipeline.

## 0.14.5 gravity shard hold, fade and surface clearance

Gravity shards now launch at 20% nominal horizontal scatter. Their hold lifetime increases 50% to 2.1–2.55 seconds; settling no longer shortens it. A separate 0.35-second smoothstep fade follows, for a bounded total life of 2.45–2.9 seconds. Nongravity profiles and counts retain their existing settings.

The simulation caches visible-surface height queries while shards travel and samples the contact footprint when they settle. These queries use the world's static geometry BVH, including raised paving, with the shared terrain fallback. Resting positions are checked against the pixel mask's visible bounds and camera orientation, with a small depth separation. This avoids clipping through map textures without unnecessarily lifting the entire particle quad. Physics proxy clearance also includes shard size. Mixed zero/one/two-bounce behavior remains.

Tests cover the complete hold before fading, fade endpoints, raised support surfaces, continued mixed bounce behavior and a low-camera world render of all 35 resting shards after two seconds. Two extra VFX scenarios capture the hold and fade phases at both resolutions.
