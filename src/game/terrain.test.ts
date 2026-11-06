import { it, expect } from "vitest";
import { landHeight, groundHeight, terrainSlope } from "./terrain";
import { Player } from "./player";
import type { Input } from "./input";
it("has a raised keep, flat forest and smooth ramp joins", () => {
  expect(landHeight(0, 19)).toBe(4);
  expect(landHeight(0, -40)).toBe(0);
  expect(Math.abs(terrainSlope(-24))).toBeLessThan(0.00001);
  expect(Math.abs(terrainSlope(14))).toBeLessThan(0.00001);
  for (let z = -24; z < 14; z += 0.1) {
    expect(terrainSlope(z)).toBeGreaterThanOrEqual(-0.00001);
    expect(terrainSlope(z)).toBeLessThan(0.21);
  }
});
it("keeps the player attached to the ramp in both directions", () => {
  const input = { keys: new Set(["KeyW"]), yaw: 0 } as Input,
    p = new Player(input, []);
  for (let i = 0; i < 550; i++) {
    p.update(1 / 60);
    expect(p.position.y).toBeCloseTo(
      groundHeight(p.position.x, p.position.z),
      5,
    );
  }
  input.keys.clear();
  input.keys.add("KeyS");
  for (let i = 0; i < 550; i++) {
    p.update(1 / 60);
    expect(p.position.y).toBeCloseTo(
      groundHeight(p.position.x, p.position.z),
      5,
    );
  }
  expect(p.position.y).toBeGreaterThan(3.5);
});
it("keeps the ravine below the curved bridge", () => {
  expect(groundHeight(0, -6)).toBeGreaterThan(1);
  expect(groundHeight(9, -6)).toBe(-9);
});
