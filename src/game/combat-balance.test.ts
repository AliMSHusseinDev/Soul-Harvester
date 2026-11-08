import { expect, it } from "vitest";
import { criticalChance, isHeadshot } from "./combat-balance";
import { seededRandom } from "./math";
it("keeps random criticals at the authored rate and clamps excessive instinct", () => {
  const r = seededRandom(128),
    chance = criticalChance(0);
  let criticals = 0;
  for (let i = 0; i < 20000; i++) if (r() < chance) criticals++;
  expect(criticals / 20000).toBeGreaterThan(0.03);
  expect(criticals / 20000).toBeLessThan(0.05);
  expect(criticalChance(8)).toBeLessThanOrEqual(0.16);
  expect(criticalChance(100)).toBe(0.16);
});
it("requires the upper central head instead of the entire upper torso", () => {
  expect(isHeadshot(0.5, 0.88)).toBe(true);
  expect(isHeadshot(0.5, 0.75)).toBe(false);
  expect(isHeadshot(0.9, 0.9)).toBe(false);
});
