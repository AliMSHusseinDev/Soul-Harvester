import { it, expect } from "vitest";
import { Player } from "./player";
import { groundHeight } from "./terrain";
import type { Input } from "./input";
function setup() {
  const input = { keys: new Set<string>(), yaw: 0 } as Input;
  return { input, player: new Player(input, []) };
}
it("stops at a real wall under sustained sprint input", () => {
  const input = { keys: new Set(["KeyW", "ShiftLeft"]), yaw: 0 } as Input;
  const player = new Player(input, [
    {
      minX: -5,
      maxX: 5,
      minZ: -0.2,
      maxZ: 0.2,
      height: groundHeight(0, 0) + 3,
    },
  ]);
  for (let i = 0; i < 600; i++) player.update(1 / 60);
  expect(player.position.z).toBeCloseTo(0.56);
  expect(player.position.y).toBeCloseTo(
    groundHeight(player.position.x, player.position.z),
  );
});
it("lands on the top of a low obstacle", () => {
  const { input } = setup();
  const player = new Player(input, [
    { minX: -1, maxX: 1, minZ: 13, maxZ: 15, height: 4.5, base: 4 },
  ]);
  player.position.y = 4.7;
  for (let i = 0; i < 90; i++) player.update(1 / 60);
  expect(player.position.y).toBe(4.5);
  expect(player.grounded).toBe(true);
});
it("clears grounded state when walking off a raised prop", () => {
  const { input } = setup();
  const player = new Player(input, [
    { minX: -1, maxX: 1, minZ: 13, maxZ: 15, height: 4.5, base: 4 },
  ]);
  player.position.y = 4.5;
  player.update(1 / 60);
  expect(player.grounded).toBe(true);
  player.position.x = 2;
  player.update(1 / 60);
  expect(player.grounded).toBe(false);
  expect(player.position.y).toBeLessThan(4.5);
});
it("jumps and lands under gravity without leaving the floor", () => {
  const { input, player } = setup();
  input.keys.add("Space");
  player.update(1 / 60);
  input.keys.clear();
  let peak = player.position.y;
  for (let i = 0; i < 120; i++) {
    player.update(1 / 60);
    peak = Math.max(peak, player.position.y);
    expect(player.position.y).toBeGreaterThanOrEqual(0);
  }
  expect(peak).toBeGreaterThan(5);
  expect(player.position.y).toBeCloseTo(
    groundHeight(player.position.x, player.position.z),
  );
  expect(player.grounded).toBe(true);
});
it("exhausts sprint stamina and restores it at rest", () => {
  const { input, player } = setup();
  input.keys.add("KeyW");
  input.keys.add("ShiftLeft");
  for (let i = 0; i < 350; i++) player.update(1 / 60);
  expect(player.stamina).toBeLessThan(0.2);
  input.keys.clear();
  for (let i = 0; i < 360; i++) player.update(1 / 60);
  expect(player.stamina).toBe(1);
});

it("buffers a jump tap that was released before the simulation update", () => {
  const { input, player } = setup();
  input.jumpQueued = true;
  expect(input.keys.has("Space")).toBe(false);
  player.update(1 / 60);
  expect(player.position.y).toBeGreaterThan(0);
  expect(input.jumpQueued).toBe(false);
});
