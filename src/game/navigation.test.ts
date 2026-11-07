import { it, expect } from "vitest";
import { Navigation } from "./navigation";
import { isRiver, MAP } from "./terrain";
import { resolveCircle } from "./math";
it("indexes negative-coordinate walls without duplicate collision candidates or missed occlusion", () => {
  const wall = { minX: -7, maxX: 7, minZ: -35, maxZ: -34, height: 4 };
  const nav = new Navigation([wall]);
  const candidates = nav.collisionNear(0, -33.9);
  expect(candidates).toEqual([wall]);
  const p = resolveCircle(0, -33.9, 0.34, 0, candidates);
  expect(p.z).toBeGreaterThan(-33.7);
  expect(nav.lineClear({ x: -2, z: -40 }, { x: -2, z: -30 })).toBe(false);
  expect(nav.lineClear({ x: 10, z: -40 }, { x: 10, z: -30 })).toBe(true);
  expect(nav.collisionNear(24, 20)).toHaveLength(0);
});
it("routes enemies from the outer field across the bridge to the bell", () => {
  const nav = new Navigation([]),
    field = nav.field(MAP.bell),
    p = { x: 11, z: -48 };
  let crossings = 0;
  for (let i = 0; i < 2000; i++) {
    const v = nav.steer(p, MAP.bell, field);
    p.x += v.x * 0.07;
    p.z += v.z * 0.07;
    expect(isRiver(p.x, p.z)).toBe(false);
    if (p.z > -14 && p.z < 2) {
      crossings++;
      expect(Math.abs(p.x)).toBeLessThan(3.3);
    }
    if (Math.hypot(p.x, p.z - 19) < 0.7) break;
  }
  expect(crossings).toBeGreaterThan(50);
  expect(Math.hypot(p.x, p.z - 19)).toBeLessThan(0.8);
});
it("finds a route around a wall and forbids corner cutting", () => {
  const nav = new Navigation([
    { minX: -5, maxX: 5, minZ: -30, maxZ: -28, height: 4 },
  ]);
  expect(nav.lineClear({ x: 0, z: -40 }, { x: 0, z: -20 })).toBe(false);
  const field = nav.field({ x: 0, z: -20 });
  expect(Number.isFinite(field[nav.index(0, -40)])).toBe(true);
  const p = { x: 0, z: -40 };
  for (let i = 0; i < 700; i++) {
    const v = nav.steer(p, { x: 0, z: -20 }, field);
    p.x += v.x * 0.07;
    p.z += v.z * 0.07;
    expect(nav.walkable(p.x, p.z)).toBe(true);
    if (Math.hypot(p.x, p.z + 20) < 0.7) break;
  }
  expect(Math.hypot(p.x, p.z + 20)).toBeLessThan(0.8);
});
