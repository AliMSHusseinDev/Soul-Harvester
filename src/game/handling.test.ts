import { it, expect } from "vitest";
import {
  Handling,
  HipAccuracy,
  ACCURACY,
  type MovementIntent,
} from "./handling";
const idle: MovementIntent = {
  sprint: false,
  fire: false,
  aim: false,
  busy: false,
  grounded: true,
  verticalSpeed: 0,
  moving: false,
};
it("blocks fire and ADS through the full .225 second sprint-out and buffers a fire intent", () => {
  const h = new Handling();
  h.update(1 / 60, { ...idle, sprint: true, moving: true });
  expect(h.sprinting).toBe(true);
  expect(h.ready).toBe(false);
  h.update(1 / 60, { ...idle, sprint: true, fire: true });
  expect(h.state).toBe("SprintOut");
  h.update(0.224, { ...idle, fire: true });
  expect(h.ready).toBe(false);
  h.update(0.001, { ...idle, fire: true });
  expect(h.ready).toBe(true);
  expect(h.state).toBe("Firing");
});
it("does not restart sprint-out on repeated inputs and does not resume sprint while firing/aiming/busy", () => {
  for (const action of ["fire", "aim", "busy"] as const) {
    const h = new Handling();
    h.update(0.01, { ...idle, sprint: true });
    for (let i = 0; i < 30; i++)
      h.update(1 / 60, { ...idle, sprint: true, [action]: true });
    expect(h.ready).toBe(true);
    expect(h.sprinting).toBe(false);
  }
});
it("handles jumping, falling, walking, reset and shot recovery without conflicting states", () => {
  const h = new Handling();
  h.update(0.1, { ...idle, grounded: false, verticalSpeed: 4 });
  expect(h.state).toBe("Jumping");
  h.update(0.1, { ...idle, grounded: false, verticalSpeed: -2 });
  expect(h.state).toBe("Falling");
  h.fired();
  h.update(0.01, { ...idle, sprint: true, moving: true });
  expect(h.state).toBe("Walking");
  h.update(0.2, { ...idle, sprint: true });
  expect(h.state).toBe("Sprinting");
  h.reset();
  expect(h.ready).toBe(true);
  expect(h.state).toBe("Idle");
});
it("projects the exact bullet cone at 720p/1080p and samples only inside it", () => {
  const a = new HipAccuracy();
  expect(a.gap(1080, 72) * 2).toBeGreaterThanOrEqual(16);
  expect(a.gap(1080, 72) * 2).toBeLessThanOrEqual(24);
  expect(a.gap(720, 72)).toBeCloseTo((a.gap(1080, 72) * 2) / 3, 0);
  for (let i = 0; i < 100; i++) {
    const p = a.sample(Math.random, false);
    expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(Math.tan(a.angle) + 1e-9);
  }
  expect(a.sample(Math.random, true)).toEqual({ x: 0, y: 0 });
});
it("contracts crouch spread, blooms airborne and after shots, and recovers independent of frame rate", () => {
  function run(hz: number) {
    const a = new HipAccuracy();
    a.fired(ACCURACY.rifle);
    for (let i = 0; i < hz; i++)
      a.update(1 / hz, ACCURACY.rifle, 0, true, false, false);
    return a.angle;
  }
  expect(run(30)).toBeCloseTo(run(120), 4);
  const a = new HipAccuracy();
  for (let i = 0; i < 120; i++)
    a.update(1 / 60, ACCURACY.rifle, 0, true, true, false);
  expect(a.angle).toBeCloseTo(ACCURACY.rifle.base * 0.85, 5);
  a.update(0.2, ACCURACY.rifle, 4, false, false, false);
  expect(a.angle).toBeGreaterThan(ACCURACY.rifle.base * 2);
});
