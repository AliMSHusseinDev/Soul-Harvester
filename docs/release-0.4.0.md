# Soul Harvester 0.4.0 — visual and combat polish

Implemented on 7 November 2026, using the existing Three.js/TypeScript architecture.

## Result

- Cool moonlight, lighter masonry, softer vignette, warm local lights, layered valley fog and tiered conifers replace the oversized single-cone silhouettes. Existing raised terrain, collision and bridge remain intact.
- Seven spaced, reachable spawn zones span the playable forest fringe beneath the moon. The central tree is a landmark. Static trunk placements agree with navigation obstacles; blocked or congested points defer instead of overlapping enemies.
- Wave counts are 8, 12, 16, 20, 24, 28, 32, 36, 40 and 44. Type quotas and individual wave tuning increase pressure. Concurrent group jobs retain all 260 possible enemies. The nearest intersection of a shot determines its only target; an enemy or wall in front of the bell blocks that shot.
- Alpha-preserving per-instance white flashes and restrained reactions accompany damage. Bullet impacts use real intersection coordinates. Confirmed hits show a short red marker and sound; kills have distinct stronger feedback. Misses and environmental hits do not confirm enemy damage.
- Gold probabilities and amounts vary by enemy/wave; bad-luck protection permits at most six consecutive dry kills. XP is consistent. Smaller rewards launch upward/outward, bounce, wait 0.95 seconds, then accelerate magnetically with wall checks, trails, shrinking and collection chimes.
- Cached grid adjacency, reused crowd query buffers, instanced enemies/loot, pooled effects, a bounded damage texture cache and reused shot-noise buffers limit repeated allocations and rendering cost.

## Main files

| Area                  | Files                                                                          |
| --------------------- | ------------------------------------------------------------------------------ |
| Visuals               | `src/game/world.ts`, `forest.ts`, `textures.ts`, `weapon.ts`                   |
| Spawning and waves    | `src/game/spawning.ts`, `waves.ts`, `battle.ts`, `navigation.ts`               |
| Combat feedback       | `src/game/enemies.ts`, `feedback.ts`, `effects.ts`, `audio.ts`                 |
| Rewards and physics   | `src/game/rewards.ts`, `loot.ts`                                               |
| Configuration         | `src/game/tuning.ts`                                                           |
| Integration and UI    | `src/main.ts`, `src/game/ui.ts`, `src/style.css`, `index.html`                 |
| Verification          | `src/game/*.test.ts`, `scripts/browser-check.mjs`                              |
| Documentation/version | `README.md`, `docs/reference-analysis.md`, `package.json`, `package-lock.json` |

## Verification

- `npm test`: **53 tests passed across 10 files**. Includes every spawn zone's route across the bridge, blocked/congested zones, counts/threat through wave ten, preservation of earlier enemies, gold probability ranges over 10,000 rolls per type, dry-streak bound, consistent XP, pop/bounce delay, magnetic collection on both banks, wall/rail/ravine safety, hit-flash lifetime and nearest-shot resolution.
- `npm run build`: TypeScript and Vite production build passed.
- `npm run format:check` and `git diff --check`: passed.
- `npm run test:browser`: passed in Chromium with software WebGL. Actual pointer/keyboard input exercised movement, jumping, pedestal collision, upgrades, ADS alignment, finite-ammo reloads, weapons, magic, all seven forest zones, hits/white flashes/red markers/kills, probabilistic gold, bridge traversal, player/bell aggro switching, rendered gold/XP collection, pause/resume, audio and responsive menus. A fresh run verified one wave for a single bell shot, all 260 enemies across ten waves, preservation of the first wave, all four types, and no eleventh wave. No browser/renderer errors. GPU geometry/texture counters stayed stable while paused after the stress scene.
- Visual inspection used extracted reference frames and current menu/field/ADS screenshots. Screenshots are in ignored `artifacts/`; they are diagnostic artifacts, not shipped game assets.

## Practical limits

GPU-equipped client frame rates and long-session memory behavior still need device testing; a short software-rendered regression is not proof of 60 fps or zero leaks. Vite reports its existing advisory for the roughly 613 KB uncompressed / 165 KB gzip Three.js bundle. Difficulty/economy values are tunable design choices, not a claim of perfect balance or exact recovery of the reference game's hidden rules.
