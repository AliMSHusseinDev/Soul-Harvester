import { seededRandom } from "./math";
import { DIFFICULTY } from "./tuning";
export const WAVE_LIMIT = DIFFICULTY.waveLimit;
export const ENEMY_TYPES = [
  {
    name: "Hollowguard",
    hp: 43,
    speed: 2.55,
    damage: 7,
    scale: 1,
    range: 1.35,
    windup: 0.42,
    interval: 0.95,
  },
  {
    name: "Ravener",
    hp: 29,
    speed: 3.8,
    damage: 5,
    scale: 0.82,
    range: 1.3,
    windup: 0.28,
    interval: 0.65,
  },
  {
    name: "Grave brute",
    hp: 135,
    speed: 1.7,
    damage: 18,
    scale: 1.45,
    range: 1.85,
    windup: 0.8,
    interval: 1.5,
  },
  {
    name: "Ember witch",
    hp: 56,
    speed: 2.2,
    damage: 10,
    scale: 1.05,
    range: 8,
    windup: 0.85,
    interval: 2.2,
  },
] as const;
export function waveSize(wave: number) {
  return wave >= 1 && wave <= WAVE_LIMIT
    ? DIFFICULTY.firstCount + (wave - 1) * DIFFICULTY.countPerWave
    : 0;
}
/** Quotas give each wave a growing threat budget; shuffle changes entry order. */
export function wavePlan(wave: number): number[] {
  const count = waveSize(wave);
  if (!count) return [];
  const ravener = wave >= 2 ? Math.floor(count * 0.3) : 0,
    brute = wave >= 3 ? 1 + Math.floor((wave - 3) * 0.9) : 0,
    witch = wave >= 4 ? 1 + Math.floor((wave - 4) * 0.85) : 0,
    kinds = [count - ravener - brute - witch, ravener, brute, witch].flatMap(
      (n, kind) => Array<number>(n).fill(kind),
    ),
    random = seededRandom(941 + wave * 37);
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  return kinds;
}
export function waveCadence(wave: number) {
  return {
    groupSize: Math.min(
      DIFFICULTY.maxGroupSize,
      DIFFICULTY.groupSize + Math.floor((wave - 1) / DIFFICULTY.groupGrowth),
    ),
    memberInterval: DIFFICULTY.memberInterval,
    groupInterval:
      DIFFICULTY.groupInterval - (wave - 1) * DIFFICULTY.intervalReduction,
  };
}
export const ENEMY_CAPACITY = Array.from({ length: WAVE_LIMIT }, (_, i) =>
  waveSize(i + 1),
).reduce((a, b) => a + b, 0);
