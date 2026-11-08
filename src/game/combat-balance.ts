import { COMBAT } from "./tuning";
export function criticalChance(instinct: number) {
  return Math.min(
    COMBAT.criticalCap,
    COMBAT.criticalBase + Math.max(0, instinct) * COMBAT.criticalPerInstinct,
  );
}
export function isHeadshot(u: number, v: number) {
  return (
    v > COMBAT.headshotMinY && Math.abs(u - 0.5) < COMBAT.headshotHalfWidth
  );
}
