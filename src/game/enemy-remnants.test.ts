import { expect, it } from "vitest";
import { remnantPose } from "./enemy-remnants";
it("starts white, collapses above the feet and dissolves into a burgundy remnant", () => {
  expect(remnantPose(0)).toMatchObject({
    white: 1,
    opacity: 1,
    dissolve: 0,
    height: 1,
  });
  expect(remnantPose(0.14).white).toBe(0);
  expect(remnantPose(0.14).opacity).toBeGreaterThan(0);
  expect(remnantPose(0.38)).toMatchObject({
    white: 0,
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
