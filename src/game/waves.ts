import { seededRandom } from "./math";
export const WAVE_LIMIT = 10;
export const ENEMY_TYPES = [
  {
    name: "Hollowguard",
    hp: 43,
    speed: 1.9,
    damage: 7,
    scale: 1,
    range: 1.35,
    windup: 0.42,
    interval: 0.95,
  },
  {
    name: "Ravener",
    hp: 29,
    speed: 3.15,
    damage: 5,
    scale: 0.82,
    range: 1.3,
    windup: 0.28,
    interval: 0.65,
  },
  {
    name: "Grave brute",
    hp: 135,
    speed: 1.25,
    damage: 18,
    scale: 1.55,
    range: 1.85,
    windup: 0.8,
    interval: 1.5,
  },
  {
    name: "Ember witch",
    hp: 56,
    speed: 1.65,
    damage: 10,
    scale: 1.05,
    range: 8,
    windup: 0.85,
    interval: 2.2,
  },
] as const;
/** Deterministic weighted composition; introductions and threat mix evolve every wave. */
export function wavePlan(wave: number): number[] {
  if (wave < 1 || wave > WAVE_LIMIT) return [];
  const r = seededRandom(941 + wave * 37),
    count = 6 + wave * 2,
    unlocked = Math.min(4, wave),
    weights = [
      Math.max(0.24, 0.8 - wave * 0.055),
      0.28 + wave * 0.01,
      0.12 + wave * 0.018,
      0.08 + wave * 0.015,
    ];
  const kinds: number[] = [];
  if (wave > 1) kinds.push(unlocked - 1);
  while (kinds.length < count) {
    const total = weights.slice(0, unlocked).reduce((a, b) => a + b, 0);
    let pick = r() * total;
    for (let k = 0; k < unlocked; k++) {
      pick -= weights[k];
      if (pick <= 0) {
        kinds.push(k);
        break;
      }
    }
  }
  return kinds;
}
export const ENEMY_CAPACITY = Array.from(
  { length: WAVE_LIMIT },
  (_, i) => wavePlan(i + 1).length,
).reduce((a, b) => a + b, 0);
