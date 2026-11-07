import { it, expect } from "vitest";
import { ForestSpawner } from "./spawning";
import { Navigation } from "./navigation";
import { MAP } from "./terrain";
import { SPAWNING } from "./tuning";
it("stratifies the entire forest width with spacing and reachable exit paths", () => {
  const nav = new Navigation([
      { minX: -3, maxX: 3, minZ: -64, maxZ: -61, height: 10 },
    ]),
    field = nav.field(MAP.bell),
    spawner = new ForestSpawner(nav, field),
    crowd: { x: number; z: number; active: boolean }[] = [];
  for (let i = 0; i < 70; i++) {
    const p = spawner.next(crowd)!;
    expect(p).toBeDefined();
    expect(nav.canStand(p.x, p.z, 0.48)).toBe(true);
    expect(Number.isFinite(field[nav.index(p.x, p.z)])).toBe(true);
    expect(
      crowd.every((e) => Math.hypot(e.x - p.x, e.z - p.z) >= SPAWNING.spacing),
    ).toBe(true);
    crowd.push({ ...p, active: true });
    if (i < 21)
      expect(
        Math.max(...spawner.counts) - Math.min(...spawner.counts),
      ).toBeLessThanOrEqual(1);
  }
  expect([...spawner.counts].every((n) => n > 0)).toBe(true);
  expect(Math.min(...crowd.map((p) => p.x))).toBeLessThan(-20);
  expect(Math.max(...crowd.map((p) => p.x))).toBeGreaterThan(20);
  spawner.reset();
  expect([...spawner.counts].every((n) => n === 0)).toBe(true);
});
it("excludes disconnected and fully blocked zones instead of spawning through geometry", () => {
  const nav = new Navigation([
      { minX: -27, maxX: -16, minZ: -67, maxZ: -58, height: 10 },
      { minX: 10, maxX: 27, minZ: -59, maxZ: -58, height: 10 },
      { minX: 9, maxX: 10, minZ: -67, maxZ: -58, height: 10 },
    ]),
    spawner = new ForestSpawner(nav, nav.field(MAP.bell));
  for (let i = 0; i < 100; i++) {
    const p = spawner.next([])!;
    expect(p.x).toBeGreaterThan(-16);
    expect(p.x).toBeLessThan(9);
  }
});

it("routes an enemy from every forest zone across the bridge to the base", () => {
  const nav = new Navigation([
      { minX: -1.25, maxX: 1.25, minZ: -58.25, maxZ: -55.75, height: 9 },
      { minX: -23, maxX: -21, minZ: -61, maxZ: -53, height: 3 },
      { minX: 14, maxX: 16, minZ: -25, maxZ: -21, height: 3 },
    ]),
    field = nav.field(MAP.bell),
    spawner = new ForestSpawner(nav, field);
  const positions: { x: number; z: number; active: boolean }[] = [];
  for (let zone = 0; zone < 7; zone++) {
    const p = { ...spawner.next(positions)! };
    positions.push({ ...p, active: true });
    let crossed = false;
    for (let i = 0; i < 2500; i++) {
      const v = nav.steer(p, MAP.bell, field);
      p.x += v.x * 0.06;
      p.z += v.z * 0.06;
      expect(nav.walkable(p.x, p.z)).toBe(true);
      if (p.z > -14 && p.z < 2) {
        crossed = true;
        expect(Math.abs(p.x)).toBeLessThan(3.3);
      }
      if (Math.hypot(p.x, p.z - 19) < 0.7) break;
    }
    expect(crossed).toBe(true);
    expect(Math.hypot(p.x, p.z - 19)).toBeLessThan(0.8);
  }
});
