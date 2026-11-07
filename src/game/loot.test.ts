import { it, expect } from "vitest";
import { Loot } from "./loot";
import { Navigation } from "./navigation";
import { groundHeight } from "./terrain";
import { springStep } from "./math";
it("magnetically collects independent gold and XP on either side of the bridge", () => {
  for (const z of [-35, 17]) {
    const loot = new Loot(new Navigation([]));
    loot.release(0, z, { gold: 4, xp: 12 });
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
  loot.release(0, -40, { gold: 4, xp: 12 });
  for (let i = 0; i < 6000; i++) loot.update(1 / 60, { x: 24, z: 24, y: 4 }, 0);
  expect(loot.drops.filter((d) => d.active).length).toBe(2);
  expect(
    loot.drops
      .filter((d) => d.active)
      .every((d) => d.y >= groundHeight(d.x, d.z) + 0.13),
  ).toBe(true);
});
it("does not pull rewards through walls", () => {
  const loot = new Loot(
    new Navigation([{ minX: -1, maxX: 1, minZ: -33, maxZ: -32, height: 3 }]),
  );
  loot.release(0, -35, { gold: 4, xp: 12 });
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
  for (let i = 0; i < 60; i++) loot.release(2.85, -6, { gold: 4, xp: 12 });
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

it("shows a ballistic pop and bounce before magnet attraction can collect anything", () => {
  const loot = new Loot(new Navigation([]));
  loot.release(0, -35, { gold: 3, xp: 12 });
  const initial = loot.drops[0].y;
  let highest = initial;
  for (let i = 0; i < 30; i++) {
    expect(loot.update(1 / 60, { x: 0, z: -35, y: 0 }, 0)).toHaveLength(0);
    highest = Math.max(highest, loot.drops[0].y);
    expect(loot.drops[0].magnet).toBe(false);
  }
  expect(highest - initial).toBeGreaterThan(0.1);
  expect(loot.drops[0].bounces).toBeGreaterThan(0);
  const collected = [];
  for (let i = 0; i < 180; i++)
    collected.push(...loot.update(1 / 60, { x: 0, z: -35, y: 0 }, 0));
  expect(collected).toHaveLength(2);
});
it("only releases the rewards that were actually rolled", () => {
  const loot = new Loot(new Navigation([]));
  loot.release(0, -35, { gold: 0, xp: 12 });
  expect(loot.drops.filter((d) => d.active).map((d) => d.kind)).toEqual(["xp"]);
});

it("acquires a large nearby pile as a stream and grants every item exactly once", () => {
  const loot = new Loot(new Navigation([]));
  for (let i = 0; i < 50; i++)
    loot.release(Math.cos(i) * 0.7, -35 + Math.sin(i) * 0.7, {
      gold: 3,
      xp: 12,
    });
  for (const d of loot.drops)
    if (d.active) {
      d.age = 1;
      d.vx = d.vy = d.vz = 0;
      d.y = 0.14;
    }
  const received = [];
  received.push(...loot.update(1 / 60, { x: 0, z: -35, y: 0 }, 0));
  expect(
    loot.drops.filter((d) => d.active && d.magnet).length,
  ).toBeLessThanOrEqual(6);
  expect(received).toHaveLength(0);
  for (let i = 0; i < 240; i++)
    received.push(...loot.update(1 / 60, { x: 0, z: -35, y: 0 }, 0));
  expect(
    received.filter((p) => p.kind === "gold").reduce((n, p) => n + p.value, 0),
  ).toBe(150);
  expect(
    received.filter((p) => p.kind === "xp").reduce((n, p) => n + p.value, 0),
  ).toBe(600);
  expect(loot.drops.some((d) => d.active)).toBe(false);
});
