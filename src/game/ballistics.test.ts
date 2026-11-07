import { it, expect } from "vitest";
import { BarrelSmoke } from "./ballistics";
const origin = { x: 0, y: 2, z: 0 },
  dir = { x: 0, y: 0, z: -1 },
  still = { x: 0, y: 0, z: 0 };
it("heats with sustained fire, bounds smoke allocation and frees every slot", () => {
  const s = new BarrelSmoke();
  for (let i = 0; i < 200; i++) s.shot(origin, dir, still);
  expect(s.items.filter((p) => p.life > 0)).toHaveLength(96);
  expect(s.heat).toBe(1);
  for (let i = 0; i < 240; i++) s.update(1 / 60, i / 60, origin, dir, still);
  expect(s.items.every((p) => p.life === 0)).toBe(true);
  expect(s.heat).toBe(0);
  s.reset();
  expect(s.emitted).toBe(0);
});
it("rises, curls and preserves world momentum when the camera and emitter move", () => {
  const s = new BarrelSmoke();
  s.emit(origin, dir, { x: 4, y: 0, z: 0 });
  const p = s.items[0];
  expect(p.vx).toBeGreaterThan(0);
  for (let i = 0; i < 24; i++)
    s.update(
      1 / 60,
      i / 60,
      { x: 50, y: 2, z: 50 },
      { x: 1, y: 0, z: 0 },
      still,
    );
  expect(p.y).toBeGreaterThan(2);
  expect(p.x).toBeLessThan(1);
  expect(Math.abs(p.z)).toBeLessThan(1);
  expect(p.x).toBeGreaterThan(0);
});
it("lingers after a burst and gives similar trajectories at different update rates", () => {
  const run = (hz: number) => {
    const s = new BarrelSmoke();
    s.shot(origin, dir, still);
    for (let i = 0; i < hz * 0.5; i++)
      s.update(1 / hz, i / hz, origin, dir, still);
    return s.items[0];
  };
  const a = run(30),
    b = run(120);
  expect(a.life).toBeGreaterThan(0);
  expect(a.y).toBeCloseTo(b.y, 2);
  expect(a.x).toBeCloseTo(b.x, 2);
});
