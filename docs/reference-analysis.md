# Gameplay reference analysis — 6 November 2026

Source: user-uploaded `2026-11-06-18-42-54_lW0uXxEJ.mp4`, 57.667 seconds, 1920×1080, 30 fps. Visual frames were inspected across the complete timeline, with 6 fps sequences over the combat section. Audio was not analyzed. No source assets or code were extracted from the reference.

## Visible sequence

| Time        | Observation                                                                                                                                                                                                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–2 s       | Recording software, title menu, then first-person fortress/camp scene.                                                                                                                                                                |
| 2–7 s       | Campfire NPC interaction and stats/skills overlay. Six stats and six skill disciplines; athletics tooltip identifies sprint, higher jump and double jump. Constitution tooltip says +20 maximum health.                               |
| 8–17 s      | Player explores ruined stone structures, repair and weapon upgrade stations, ladder and surrounding paths. Rifle has a long gold/brass top rail, two visible arms and an angled resting pose.                                         |
| 18–25 s     | Courtyard and fort perimeter, huge pale moon over forest silhouettes, large tree, trench/ravine and wooden bridge with low rails and lanterns. Bell is mounted on an independent timber frame with green banners.                     |
| 26–30 s     | Rifle aims down sights at the bell; repeated shots advance displayed waves rapidly. This does not establish the normal wave timing: the recording may include special progression or testing.                                         |
| 31–35 s     | Traversal of the wooden bridge into the outer field, enormous moon on the horizon, clustered sprite enemies ahead.                                                                                                                    |
| 36–43 s     | Automatic fire, recoil/recovery, white/yellow damage numbers, enemy hit/death motion, blue drops and coins. Close enemies cause a red edge overlay and health loss. Rifle reload includes a pronounced sideways turn and hand motion. |
| 44–53 s     | Hand-cast abilities: teal area burst and orange projectile/explosion. Pickups, level-up ring/particles, continued attacks and kiting toward/across the bridge. A precise melee attack is not unambiguously visible in these frames.   |
| 54–57.667 s | Weapon switch to pistol, pause menu, recording software.                                                                                                                                                                              |

## Composition and animation targets

Hybrid rendering: textured angular 3D environment and weapons, camera-facing pixel-art enemies/NPCs/drops, teal night fog, strongly contrasting warm campfires, luminous moon and layered cloud streaks. Recoil is quick upward/backward movement followed by recovery; aim-down-sights brings the rear/front sights to the screen centre. Walking adds weapon sway. Deaths include lifted/tumbling sprite silhouettes and particle drops. Damage briefly reddens screen edges. HUD includes health/XP, wave number, three weapon slots, ammunition, currency and ability status.

Spatial structure to reproduce in original artwork: keep/camp → bridge over a real ravine → open battlefield → large spawn tree aligned below the moon. The bell/base must be reachable by enemy navigation over that same bridge. Enemy spawn position and player-versus-bell targeting are explicit user requirements; not every underlying rule is independently provable from the footage.

## Implementation specifications and uncertainty

Implement original environment and sprite artwork, bronze rifle, pistol and melee weapon; shared grid navigation through the bridge, proximity aggro with hysteresis, telegraphed attacks, player/base damage, finite enemy waves from the spawn tree, knockback, drops, purchases, stat/skill upgrades, aimed fire, reload, melee, teal burst and an orange projectile. Preserve Soul Harvester branding.

Weapon damage, aggro distances, attack intervals, cooldowns, precise map dimensions, enemy caps and economy values are our tunable design values, not recovered facts. The clip does not expose a complete skill tree or every weapon, animation, level or game rule. Pixel-perfect identity and “100% balance” cannot be established from this recording. Record and test these limits honestly rather than claiming unobserved behavior.
