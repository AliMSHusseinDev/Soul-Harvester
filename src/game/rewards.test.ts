import { it, expect } from "vitest";
import { RewardRoller } from "./rewards";
import { REWARDS } from "./tuning";
it("keeps XP reliable, gold probabilistic and all reward ranges bounded", () => {
  for (let kind = 0; kind < 4; kind++) {
    const roller = new RewardRoller(481 + kind),
      t = REWARDS.types[kind];
    let dropped = 0;
    for (let i = 0; i < 10000; i++) {
      const r = roller.roll(kind, 1);
      expect(r.xp).toBe(t.xp);
      if (r.gold) {
        dropped++;
        expect(r.gold).toBeGreaterThanOrEqual(t.minGold);
        expect(r.gold).toBeLessThanOrEqual(t.maxGold);
      }
      expect(roller.dryKills).toBeLessThanOrEqual(REWARDS.maxDryKills);
    }
    const rate = dropped / 10000;
    expect(rate).toBeGreaterThan(t.goldChance - 0.02);
    expect(rate).toBeLessThan(t.goldChance + 0.07);
  }
});
it("rewards stronger enemies and later waves more and resets reproducibly", () => {
  function average(kind: number, wave: number) {
    const roller = new RewardRoller();
    let total = 0;
    for (let i = 0; i < 10000; i++) total += roller.roll(kind, wave).gold;
    return total / 10000;
  }
  expect(average(2, 1)).toBeGreaterThan(average(0, 1) * 3);
  expect(average(3, 1)).toBeGreaterThan(average(1, 1) * 2);
  expect(average(0, 10)).toBeGreaterThan(average(0, 1));
  const roller = new RewardRoller(),
    first = roller.roll(0, 1);
  for (let i = 0; i < 10; i++) roller.roll(0, 1);
  roller.reset();
  expect(roller.roll(0, 1)).toEqual(first);
});
