import { expect, it } from "vitest";
import {
  ParticleSimulation,
  PARTICLE_CAPACITY,
  SHAPE,
  dragMotion,
} from "./particle-simulation";
it("reproduces seeded events with independent particles and distinct event profiles", () => {
  const a = new ParticleSimulation(),
    b = new ParticleSimulation();
  for (const event of [
    "hit",
    "critical",
    "death",
    "nova",
    "explosion",
    "level",
    "pickup",
  ] as const) {
    a.emit(event, 0, 2, -8);
    b.emit(event, 0, 2, -8);
  }
  expect(a.items).toEqual(b.items);
  expect(
    new Set(a.items.filter((p) => p.life > 0).map((p) => p.shape)).size,
  ).toBe(6);
  expect(a.items.some((p) => p.overlay && p.shape === SHAPE.ring)).toBe(true);
  expect(a.items.some((p) => p.shape === SHAPE.cube && p.priority === 2)).toBe(
    true,
  );
});
it("bounds saturation, reserves important capacity, and reclaims unseen and visible particles", () => {
  const p = new ParticleSimulation();
  for (let i = 0; i < 250; i++) p.emit("trail", 0, 1, 0);
  for (let i = 0; i < 100; i++) p.emit("pickup", 0, 1, 0);
  for (let i = 0; i < 80; i++) p.emit("hit", 0, 1, 0);
  p.emit("death", 0, 1, 0);
  expect(p.items.some((p) => p.life > 0 && p.priority === 2)).toBe(true);
  expect(p.active).toBeLessThanOrEqual(PARTICLE_CAPACITY);
  for (let i = 0; i < 240; i++) p.step(1 / 60, () => 0);
  expect(p.active).toBe(0);
  p.reset();
  expect(p.emitted).toBe(0);
  expect(p.events.death).toBe(0);
});
it("integrates drag and gravity analytically across step rates and bounces above terrain", () => {
  const run = (hz: number) => {
    const p = new ParticleSimulation();
    p.emit("death", 0, 10, 0);
    for (let i = 0; i < hz / 10; i++) p.step(1 / hz, () => 0);
    return p.items[3];
  };
  for (const key of ["x", "y", "z", "vx", "vy", "vz"] as const)
    expect(run(30)[key]).toBeCloseTo(run(120)[key], 9);
  expect(dragMotion(3, 0, 10, 0.1).distance).toBeCloseTo(0.25);
  const p = new ParticleSimulation();
  p.emit("death", 0, 0.05, 0);
  for (let i = 0; i < 30; i++) p.step(1 / 60, () => 0);
  expect(p.items.filter((p) => p.life > 0).every((p) => p.y >= 0.035)).toBe(
    true,
  );
});
it("reduces density without removing primary hit feedback, freezes on zero dt", () => {
  const full = new ParticleSimulation(),
    reduced = new ParticleSimulation();
  full.emit("critical", 0, 2, 0);
  reduced.emit("critical", 0, 2, 0, 1, true);
  expect(reduced.active).toBeLessThan(full.active);
  expect(reduced.items.filter((p) => p.life > 0 && p.overlay)).toHaveLength(2);
  const before = JSON.stringify(reduced.items);
  reduced.step(0, () => 0);
  expect(JSON.stringify(reduced.items)).toBe(before);
});
