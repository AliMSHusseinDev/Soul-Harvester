import { it, expect } from "vitest";
import { Navigation } from "./navigation";
import { isRiver, MAP } from "./terrain";
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
