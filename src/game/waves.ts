import { ENEMY_TUNING } from "./tuning";
import { seededRandom } from "./math";
import { DIFFICULTY } from "./tuning";
export const WAVE_LIMIT = DIFFICULTY.waveLimit;
export const ENEMY_TYPES = ENEMY_TUNING;
export function waveSize(wave: number) {
  return wave >= 1 && wave <= WAVE_LIMIT
    ? DIFFICULTY.firstCount + (wave - 1) * DIFFICULTY.countPerWave
    : 0;
}
/** Quotas give each wave a growing threat budget; shuffle changes entry order. */
export function wavePlan(wave: number): number[] {
  const count = waveSize(wave);
  if (!count) return [];
  const ravener =
      wave >= DIFFICULTY.ravenerStart
        ? Math.min(count, Math.floor(count * DIFFICULTY.ravenerFraction))
        : 0,
    brute =
      wave >= DIFFICULTY.bruteStart
        ? Math.min(
            count - ravener,
            1 +
              Math.floor(
                (wave - DIFFICULTY.bruteStart) * DIFFICULTY.bruteGrowth,
              ),
          )
        : 0,
    witch =
      wave >= DIFFICULTY.witchStart
        ? Math.min(
            count - ravener - brute,
            1 +
              Math.floor(
                (wave - DIFFICULTY.witchStart) * DIFFICULTY.witchGrowth,
              ),
          )
        : 0,
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
