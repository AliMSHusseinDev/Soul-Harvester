import { it, expect } from "vitest";
import {
  AbilityPresentation,
  PixelShards,
  damageNumberPose,
} from "./presentation";
import { PRESENTATION as P } from "./tuning";
it("distinguishes normal and critical numbers by metadata, scales criticals by thirty percent and fades", () => {
  for (const age of [0.02, 0.1, 0.3])
    expect(
      damageNumberPose(age, true, 1).scale /
        damageNumberPose(age, false, 1).scale,
    ).toBeCloseTo(1.3);
  expect(damageNumberPose(0, false, 1).scale).toBeLessThan(
    damageNumberPose(0.1, false, 1).scale,
  );
  expect(damageNumberPose(1, true, 1).opacity).toBe(0);
  expect(damageNumberPose(0.4, false, 1).side).not.toBe(
    damageNumberPose(0.4, false, 2).side,
  );
});
it("releases each queued ability once after anticipation and clears on reset", () => {
  const p = new AbilityPresentation();
  expect(p.begin("burst")).toBe(true);
  expect(p.begin("burst")).toBe(false);
  p.begin("orb");
  expect(p.update(0.1)).toHaveLength(0);
  expect(p.update(0.03)).toEqual(["burst"]);
  expect(p.update(0.04)).toEqual(["orb"]);
  expect(p.update(1)).toHaveLength(0);
  p.begin("orb");
  p.reset();
  expect(p.update(1)).toHaveLength(0);
});
it("bounds colorful shard bursts and releases every slot without touching game entities", () => {
  const p = new PixelShards();
  expect(p.spawn(0, 1, 0, 10000, true)).toBe(P.shardCapacity);
  expect(p.spawn(0, 1, 0, 2)).toBe(0);
  expect(new Set(p.items.map((p) => p.color)).size).toBeGreaterThan(3);
  for (let i = 0; i < 90; i++) p.update(1 / 60, () => 0);
  expect(p.items.every((p) => p.life === 0 && p.y >= 0.04)).toBe(true);
  expect(p.spawn(0, 1, 0, 8)).toBe(8);
});
