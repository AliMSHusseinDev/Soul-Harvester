import { it, expect } from "vitest";
import { Loot } from "./loot";
import { Navigation } from "./navigation";
import { groundHeight } from "./terrain";
import { springStep } from "./math";
it("magnetically collects independent gold and XP on either side of the bridge", () => {
  for (const z of [-35, 17]) {
    const loot = new Loot(new Navigation([]));
    loot.release(0, z);
    const collected = [];
    for (let i = 0; i < 240; i++)
      collected.push(
        ...loot.update(1 / 60, { x: 2, z, y: groundHeight(2, z) }, 0),
      );
    expect(collected.map((d) => d.kind).sort()).toEqual(["gold", "xp"]);
    expect(loot.drops.some((d) => d.active)).toBe(false);
  }
});
it("does not erase uncollected rewards after the old ninety second timeout", () => {
  const loot = new Loot(new Navigation([]));
  loot.release(0, -40);
  for (let i = 0; i < 6000; i++) loot.update(1 / 60, { x: 24, z: 24, y: 4 }, 0);
  expect(loot.drops.filter((d) => d.active).length).toBe(2);
  expect(
    loot.drops
      .filter((d) => d.active)
      .every((d) => d.y >= groundHeight(d.x, d.z) + 0.24),
  ).toBe(true);
});
it("does not pull rewards through walls", () => {
  const loot = new Loot(
    new Navigation([{ minX: -1, maxX: 1, minZ: -33, maxZ: -32, height: 3 }]),
  );
  loot.release(0, -35);
  for (let i = 0; i < 240; i++)
    expect(loot.update(1 / 60, { x: 0, z: -31 }, 8).length).toBe(0);
});
it("uses an exact spring with equivalent outcomes at different time steps", () => {
  function run(hz: number) {
    let p = 5,
      v = 0;
    for (let i = 0; i < hz; i++) {
      const s = springStep(p, v, 0, 6, 1 / hz);
      p = s.position;
      v = s.velocity;
    }
    return p;
  }
  expect(run(30)).toBeCloseTo(run(120), 10);
});

it("keeps bridge-edge drops out of railings and the ravine", () => {
  const nav = new Navigation([
      { minX: 3.14, maxX: 3.36, minZ: -14, maxZ: 2, height: 5.5, base: 0.5 },
    ]),
    loot = new Loot(nav);
  for (let i = 0; i < 60; i++) loot.release(2.85, -6);
  for (const d of loot.drops.filter((d) => d.active)) {
    expect(nav.walkable(d.x, d.z)).toBe(true);
    expect(nav.lineClear({ x: 2.85, z: -6 }, d)).toBe(true);
  }
  for (let i = 0; i < 180; i++) loot.update(1 / 60, { x: 24, z: 24, y: 4 }, 0);
  for (const d of loot.drops.filter((d) => d.active)) {
    expect(d.y).toBeGreaterThan(1);
    expect(nav.walkable(d.x, d.z)).toBe(true);
  }
});
