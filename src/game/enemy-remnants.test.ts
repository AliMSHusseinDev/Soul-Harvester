import { expect, it } from "vitest";
import { remnantPose, remnantReaction } from "./enemy-remnants";
it("starts flash, collapses above the feet and dissolves into a blood remnant", () => {
  expect(remnantPose(0)).toMatchObject({
    flash: 1,
    opacity: 1,
    dissolve: 0,
    height: 1,
  });
  expect(remnantPose(0.14).flash).toBe(0);
  expect(remnantPose(0.14).opacity).toBeGreaterThan(0);
  expect(remnantPose(0.38)).toMatchObject({
    flash: 0,
    opacity: 0,
    dissolve: 1,
  });
  let lastHeight = 1,
    lastOpacity = 1;
  for (let i = 0; i <= 100; i++) {
    const p = remnantPose(i * 0.0038);
    expect(p.height).toBeGreaterThan(0);
    expect(p.height).toBeLessThanOrEqual(lastHeight + 1e-9);
    expect(p.opacity).toBeLessThanOrEqual(lastOpacity + 1e-9);
    lastHeight = p.height;
    lastOpacity = p.opacity;
  }
});

it("bounds directional collapse and varies head/side reactions without moving before impact", () => {
  expect(remnantReaction(0, 1, 1, false, 0.5)).toEqual({ push: 0, lean: 0 });
  const a = remnantReaction(0.12, 1, 1, false, 0.5),
    b = remnantReaction(0.12, 1, -1, false, 0.5);
  expect(a.lean).toBeCloseTo(-b.lean);
  expect(remnantReaction(0.12, 1, 1, true, 0.5).lean).toBeGreaterThan(a.lean);
  for (let age = 0; age <= 0.5; age += 0.01) {
    const p = remnantReaction(age, 1.45, 1, true, 0.99);
    expect(p.push).toBeLessThanOrEqual(0.174 + 1e-9);
    expect(Math.abs(p.lean)).toBeLessThan(0.185);
  }
});
