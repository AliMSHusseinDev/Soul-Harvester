# Procedural combat effects

Version 0.11.0 replaces all combat sprite sheets with code-generated shapes. No particle PNG, canvas texture, atlas or frame sequence is loaded. Enemy artwork, weapon/world surfaces and the font retain their separate existing assets.

## Event composition

| Event        | Layers                                                                                             |
| ------------ | -------------------------------------------------------------------------------------------------- |
| Normal hit   | Short ivory core, expanding broken gold ring, directional chips and ribbons                        |
| Critical hit | Larger core/ring, denser gold ribbons, existing larger damage text                                 |
| Death        | Brief red body response, tumbling shaded cubes, red procedural smoke, independent loot launch      |
| Player hurt  | Saturating red edge pulse, small crimson flecks, damped pitch/roll and weapon reaction             |
| Nova         | Teal radial chips/ribbons, expanding terrain-following ring, short cyan screen wash                |
| Fire orb     | Procedural palm flash, ember trail, orange explosion and smoke on collision/expiry                 |
| Pickup       | Small star glint and chips, trails during magnetic attraction, existing UI/chimes                  |
| Level up     | Distributed rising stars, terrain ring, blue rays/wash, existing banner and bounded cinematic time |

## Simulation and geometry

`particle-simulation.ts` preallocates 1536 particle records. Emission uses seeded pseudorandom variation with golden-angle angular distribution. Profiles vary velocity, gravity, drag, shape, size, duration and priority. Cosmetic randomness does not modify damage, health, cooldowns or rewards.

Motion integrates linear drag and constant gravity in closed form, using `expm1` for stable small steps, followed by terrain collision and a damped bounce. The fixed-step simulation owns lifetimes; pause freezes them and reset reclaims every slot. A short bounded first-presentation allowance preserves primary cores on a slow display without keeping hidden particles forever.

The pool reserves 256 slots from low-priority ambient/trail traffic. High-priority deaths and abilities can replace lower-priority effects when saturated. Scans are bounded by capacity; emission is worst-case O(capacity × burst count), simulation and rendering O(capacity), with fixed particle storage. No per-particle scene objects, materials or textures are created. This uses deterministic simulation and shaders, not machine learning.

## Shader rendering

`procedural-vfx.ts` uses three instanced draws: world planes, world cubes and impact planes. Pixel-quantized shader functions construct beveled chips, tapered ribbons, angular stars, broken annuli and evolving three-octave noise smoke. Cube faces retain directional shading while rotating. Smoke expands and thins; rings expand independently; ribbons align with camera-projected velocity. Shader output applies the renderer's display color conversion.

World particles respect normal depth. Primary cores and rings render after the weapon to avoid the moving-actor occlusion bug. Their anchors are checked against the shared static-world BVH and sampled terrain; the check is center-line visibility, not per-pixel clipping along a wall edge. Near-plane fading, 3.5%-height chunk caps, 8%-height smoke caps and separate 16×9 crowd grids limit close-range obstruction. Reduced Effects lowers density while retaining the primary hit signal.

`combat-screen.ts` draws one texture-free screen triangle pair for red injury edges, a cyan ability wash and blue celebration rays (the pass is hidden when idle). Simulation-time envelopes saturate under repeated hits and decay independently. Motion reduction still suppresses camera reactions; reduced effects attenuate screen feedback. The older red DOM overlay is held transparent to avoid doubling the pulse.

`gun-vfx.ts` keeps world-anchored barrel smoke, heat and travelling tracers, replacing its generated smoke image with the same procedural smoke shader. Existing barrel-attached 3D muzzle geometry supplies the firing flash. Damage labels retain the pooled upward screen-space system introduced in 0.10.0.

## Validation

- Unit tests compare seeded event output, closed-form motion across step rates, terrain clearance, saturation, priority reserves, reduced density, pause and cleanup.
- `npm run test:combat-vfx` renders twelve event scenarios at 720p/1080p, checks actual gold/ruby/cyan pixels, wall rejection, image-request absence, saturation and cleanup.
- `npm run test:polish` verifies real enemy/body responses, projected damage numbers, casting, muzzle/smoke and forty-enemy loot/level rewards.
- `node scripts/actual-combat-check.mjs` exercises the compiled game through actual input, including bullets, incoming damage and abilities. Screenshots/report data are saved under ignored `artifacts/`.

This is an original procedural interpretation of the supplied 19.5-second reference. Exact source-game timing or rendering internals cannot be recovered from that recording. Software-rendered tests do not establish hardware 60 FPS or guarantee absence of every possible visual defect.
