import { describe, it, expect } from "vitest";
import {
  seededRandom,
  resolveCircle,
  FixedClock,
  damp,
  type Solid,
} from "./math";
const wall: Solid = { minX: 0, maxX: 2, minZ: -4, maxZ: 4, height: 3 };
describe("courtyard collision", () => {
  it("keeps a circle outside a wall face", () => {
    const p = resolveCircle(-0.1, 0, 0.36, 0, [wall]);
    expect(p.x).toBeCloseTo(-0.36);
    expect(p.z).toBe(0);
  });
  it("slides along walls without changing the free axis", () => {
    const p = resolveCircle(-0.1, 2.7, 0.36, 0, [wall]);
    expect(p.x).toBeCloseTo(-0.36);
    expect(p.z).toBe(2.7);
  });
  it("resolves corners with a radial normal", () => {
    const p = resolveCircle(-0.1, 4.1, 0.36, 0, [wall]);
    expect(Math.hypot(p.x, p.z - 4)).toBeCloseTo(0.36);
  });
  it("lets an airborne player pass above a low obstacle", () => {
    expect(resolveCircle(1, 0, 0.36, 3.1, [wall])).toEqual({ x: 1, z: 0 });
  });
  it("recovers a position inside a solid", () => {
    const p = resolveCircle(0.1, 0, 0.36, 0, [wall]);
    expect(p.x).toBeCloseTo(-0.36);
  });
  it("resolves intersecting perpendicular walls", () => {
    const b = { minX: -4, maxX: 4, minZ: 0, maxZ: 2, height: 3 };
    const p = resolveCircle(-0.1, -0.1, 0.36, 0, [wall, b]);
    expect(p.x).toBeLessThanOrEqual(-0.36);
    expect(p.z).toBeLessThanOrEqual(-0.36);
  });
});
describe("simulation timing", () => {
  it("runs the same simulation steps at 30 and 120Hz", () => {
    const simulate = (hz: number) => {
      const c = new FixedClock();
      let count = 0;
      for (let i = 0; i < hz; i++) c.advance(1 / hz, () => count++);
      return count;
    };
    expect(simulate(30)).toBe(60);
    expect(simulate(120)).toBe(60);
  });
  it("caps catch-up work after a suspended tab", () => {
    const c = new FixedClock();
    let count = 0;
    c.advance(30, () => count++);
    expect(count).toBeLessThanOrEqual(6);
  });
  it("uses frame-rate independent exponential damping", () => {
    let a = 0,
      b = 0;
    for (let i = 0; i < 30; i++) a = damp(a, 1, 4, 1 / 30);
    for (let i = 0; i < 120; i++) b = damp(b, 1, 4, 1 / 120);
    expect(a).toBeCloseTo(b, 10);
  });
});
it("creates reproducible independent scenery sequences", () => {
  const a = seededRandom(17),
    b = seededRandom(17),
    c = seededRandom(19);
  const seq = Array.from({ length: 100 }, () => a());
  expect(seq).toEqual(Array.from({ length: 100 }, () => b()));
  expect(seq).not.toEqual(Array.from({ length: 100 }, () => c()));
  expect(seq.every((x) => x >= 0 && x < 1)).toBe(true);
});
