import { VFX } from "./tuning";
import { expect, it } from "vitest";
import {
  ParticleSimulation,
  PARTICLE_CAPACITY,
  SHAPE,
  dragMotion,
  debrisOpacity,
  splatterRange,
  bleedingRange,
  enemyParticleDensity,
  splatterOpacity,
  splatterStretch,
  bleedingRestitution,
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
  ).toBe(9);
  expect(a.items.some((p) => p.overlay && p.shape === SHAPE.star)).toBe(true);
  expect(
    a.items.some((p) => p.shape === SHAPE.ribbon && p.priority === 2),
  ).toBe(true);
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
  expect(
    p.items.filter((p) => p.life > 0 && p.collision).every((p) => p.y >= 0.035),
  ).toBe(true);
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

it("schedules critical echoes once and preserves their birth position until activation", () => {
  const p = new ParticleSimulation();
  p.emit("critical", 1, 4, -8);
  const delayed = p.items.filter((p) => p.life > 0 && p.age < 0);
  expect(delayed).toHaveLength(2);
  p.step(0.04, () => 0);
  expect(delayed.every((p) => p.age < 0 && p.x === 1 && p.y === 4)).toBe(true);
  p.step(0.04, () => 0);
  expect(delayed.every((p) => p.age >= 0 && p.y > 4)).toBe(true);
  expect(delayed.some((p) => p.x < 1) && delayed.some((p) => p.x > 1)).toBe(
    true,
  );
  p.reset();
  expect(p.active).toBe(0);
});
it("keeps magical soul particles separate from ordinary bullet-death fragments", () => {
  const p = new ParticleSimulation();
  p.emit("soul", 0, 2, -8);
  expect(
    p.items.some((p) => p.life > 0 && p.shape === SHAPE.wisp && p.vy > 0),
  ).toBe(true);
  expect(
    p.items.filter((p) => p.life > 0).every((p) => p.color !== 0xf18a9c),
  ).toBe(true);
});

it("uses shot position/direction and reproducible per-kill fan variation", () => {
  const impact = {
    x: 0.4,
    y: 2.4,
    z: -0.05,
    dx: 0.15,
    dy: 0.1,
    dz: -1,
    nx: 0,
    ny: 0,
    nz: 1,
  };
  const a = new ParticleSimulation(),
    b = new ParticleSimulation();
  for (const p of [a, b])
    p.emit("death", 0, 2, 0, 1, false, undefined, 0, -1, false, 0, impact);
  expect(a.items).toEqual(b.items);
  const rays = (p: ParticleSimulation) =>
    p.items.filter((p) => p.life > 0 && p.shape === SHAPE.ribbon);
  expect(
    rays(a).every(
      (p) => p.x === impact.x && p.y === impact.y && p.z === impact.z,
    ),
  ).toBe(true);
  const first = rays(a).map((p) => [p.vx, p.vy, p.vz, p.stretch]);
  a.emit("death", 0, 2, 0, 1, false, undefined, 0, -1, false, 0, impact);
  expect(
    rays(a)
      .slice(first.length)
      .map((p) => [p.vx, p.vy, p.vz, p.stretch]),
  ).not.toEqual(first);
  const c = new ParticleSimulation();
  c.emit("death", 0, 2, 0, 1, false, undefined, 0, -1, false, 0, {
    ...impact,
    x: -0.4,
    y: 1.4,
    dx: -1,
    dz: 0,
  });
  expect(rays(c).map((p) => [p.vx, p.vy, p.vz])).not.toEqual(
    first.map((p) => p.slice(0, 3)),
  );
});
it("gives larger tougher enemy types a modest bounded particle bonus", () => {
  expect(enemyParticleDensity(1, 1)).toBe(1);
  expect(enemyParticleDensity(0.82, 29 / 43)).toBe(1);
  expect(enemyParticleDensity(1.45, 135 / 43)).toBeGreaterThan(
    enemyParticleDensity(1.05, 56 / 43),
  );
  expect(enemyParticleDensity(100, 1e12)).toBe(1.3);
});

it("emits no death smoke at any density, enemy scale or finisher setting", () => {
  for (const reduced of [false, true])
    for (const finishing of [false, true])
      for (const scale of [0.82, 1, 1.45]) {
        const p = new ParticleSimulation();
        p.emit(
          "death",
          0,
          1,
          0,
          scale,
          reduced,
          undefined,
          0,
          -1,
          finishing,
          0,
          undefined,
          1.2,
        );
        expect(
          p.items.filter((p) => p.life > 0 && p.shape === SHAPE.smoke),
        ).toHaveLength(0);
        expect(
          p.items.some((p) => p.life > 0 && p.shape === SHAPE.ribbon),
        ).toBe(true);
        expect(
          p.items.some((p) => p.life > 0 && p.shape === SHAPE.debris),
        ).toBe(true);
      }
});
it("uses zero-gravity short splatter impulses without stationary red trails", () => {
  const a = new ParticleSimulation(),
    b = new ParticleSimulation();
  for (const p of [a, b]) p.emit("death", 0, 1, 0);
  const rays = a.items.filter((p) => p.life > 0 && p.shape === SHAPE.ribbon);
  expect(rays).toHaveLength(29);
  expect(
    rays.every(
      (p) =>
        p.gravity === 0 &&
        !p.collision &&
        p.trail === 0 &&
        p.max >= 0.24 &&
        p.max <= 0.36,
    ),
  ).toBe(true);
  const starts = rays.map((p) => ({ y: p.y, vy: p.vy, drag: p.drag }));
  a.step(0.1, () => 0);
  for (let i = 0; i < 6; i++) b.step(1 / 60, () => 0);
  for (let i = 0; i < rays.length; i++) {
    expect(rays[i].y).toBeCloseTo(
      starts[i].y + dragMotion(starts[i].vy, starts[i].drag, 0, 0.1).distance,
      9,
    );
    const other = b.items.find(
      (p) => p.life > 0 && p.shape === SHAPE.ribbon && p.seed === rays[i].seed,
    )!;
    expect(other.x).toBeCloseTo(rays[i].x, 8);
    expect(other.y).toBeCloseTo(rays[i].y, 8);
  }
  for (let i = 0; i < 20; i++) a.step(1 / 60, () => 0);
  expect(
    a.items.filter((p) => p.life > 0 && p.color === 0xd92b2b),
  ).toHaveLength(0);
});
it("fades splatter monotonically to exact zero with smooth endpoints", () => {
  expect(splatterOpacity(0)).toBe(1);
  expect(splatterOpacity(1)).toBe(0);
  let previous = 1;
  for (let t = 0; t <= 1; t += 0.005) {
    const alpha = splatterOpacity(t);
    expect(alpha).toBeGreaterThanOrEqual(0);
    expect(alpha).toBeLessThanOrEqual(previous + 1e-10);
    previous = alpha;
  }
  expect(splatterOpacity(1 - 1e-4)).toBeLessThan(1e-8);
});
it("keeps gravity only on bleeding with mixed damped bounce and supported ground contact", () => {
  const p = new ParticleSimulation();
  p.surfaceFloor = () => 0.12;
  p.emit("death", 0, 0.9, 0);
  const chunks = p.items.filter((p) => p.life > 0 && p.shape === SHAPE.debris);
  expect(chunks).toHaveLength(29);
  expect(
    chunks.every((p) => p.gravity > 0 && p.collision && p.max <= 1.43 + 1e-10),
  ).toBe(true);
  expect(
    chunks.some((p) => p.bounceLimit === 0) &&
      chunks.some((p) => p.bounceLimit > 0),
  ).toBe(true);
  let bounced = false,
    settled = false;
  for (let i = 0; i < 180; i++) {
    p.step(1 / 120, () => 0);
    for (const c of chunks.filter((c) => c.life > 0)) {
      expect(c.y).toBeGreaterThanOrEqual(0.12 + c.size * 0.45 + 0.012 - 1e-8);
      bounced ||= c.bounces > 0;
      settled ||= c.settled;
      expect(c.bounces).toBeLessThanOrEqual(c.bounceLimit);
    }
  }
  expect(bounced && settled).toBe(true);
  expect(p.active).toBe(0);
});
it("bounds blood count budgets and motion across bursts, terrain and reduced density", () => {
  for (const [finishing, reduced, count] of [
    [false, false, 29],
    [true, false, 32],
    [false, true, 12],
  ] as const) {
    const p = new ParticleSimulation();
    p.emit("death", 0, 1, 0, 1, reduced, undefined, 0, 1, finishing);
    expect(
      p.items.filter((p) => p.life > 0 && p.shape === SHAPE.debris),
    ).toHaveLength(count);
    for (let i = 0; i < 120; i++) {
      p.step(1 / 60, (x) => (x > 2 ? 0.5 : 0));
      for (const c of p.items.filter(
        (c) => c.life > 0 && Number.isFinite(c.rangeLimit),
      ))
        expect(
          Math.hypot(
            c.x - c.anchorX,
            c.shape === SHAPE.debris ? 0 : c.y - c.anchorY,
            c.z - c.anchorZ,
          ),
        ).toBeLessThanOrEqual(c.rangeLimit + 1e-7);
    }
    expect(p.active).toBe(0);
  }
});
it("maintains wide shot-fan variation and modest stronger-enemy count scaling", () => {
  const p = new ParticleSimulation();
  p.emit("death", 0, 3, 0);
  const rays = p.items.filter((p) => p.life > 0 && p.shape === SHAPE.ribbon);
  const origins = rays.map((p) => [p.vx, p.vy, p.vz]);
  p.step(0.15, () => 0);
  expect(
    rays.filter((p) => Math.hypot(p.x, p.y - 3, p.z) > 1).length,
  ).toBeGreaterThan(10);
  expect(
    new Set(origins.map((v) => v.map((n) => n.toFixed(2)).join(","))).size,
  ).toBeGreaterThan(12);
  const q = new ParticleSimulation();
  q.emit("death", 0, 1, 0, 1, false, undefined, 0, 1, false, 0, undefined, 1.3);
  expect(
    q.items.filter((p) => p.life > 0 && p.shape === SHAPE.debris),
  ).toHaveLength(37);
});

it("contracts splatter streaks monotonically with analytic drag and normalized release", () => {
  let last = 6;
  expect(splatterStretch(6, 2.6, 0, 0.3)).toBe(6);
  for (let age = 0; age <= 0.3; age += 0.002) {
    const length = splatterStretch(6, 2.6, age, 0.3);
    expect(length).toBeLessThanOrEqual(last + 1e-10);
    expect(length).toBeGreaterThan(0);
    last = length;
  }
  expect(splatterStretch(6, 2.6, 0.15, 0.3)).toBeGreaterThan(
    splatterStretch(6, 4, 0.15, 0.3),
  );
  expect(last).toBeLessThan(4);
});
it("gives heavy bleeding less rebound energy and smooths its final fade", () => {
  expect(bleedingRestitution(0.6)).toBeGreaterThan(bleedingRestitution(2));
  for (const weight of [0.1, 0.6, 1, 2, 10]) {
    const r = bleedingRestitution(weight);
    expect(r).toBeGreaterThanOrEqual(0.26);
    expect(r).toBeLessThanOrEqual(0.42);
    expect(r * r).toBeLessThan(0.18);
  }
  const sim = new ParticleSimulation();
  sim.emit("death", 0, 0.9, 0);
  const chunk = sim.items.find(
    (p) => p.life > 0 && p.shape === SHAPE.debris && p.bounceLimit > 0,
  )!;
  chunk.y = 0.04;
  chunk.vy = -3;
  chunk.spin = 4;
  sim.step(0.01, () => 0);
  expect(chunk.bounces).toBe(1);
  expect(chunk.spin).toBe(2);
  expect(chunk.vy).toBeGreaterThan(0);
  chunk.bounces = chunk.bounceLimit;
  chunk.y = 0.04;
  chunk.vy = -3;
  chunk.spin = 4;
  sim.step(0.01, () => 0);
  expect(chunk.settled).toBe(true);
  expect(chunk.spin).toBe(0);
  const hold = 0.9,
    eps = 1e-4;
  expect(debrisOpacity(hold, hold)).toBe(1);
  expect(debrisOpacity(hold + VFX.debrisFade, hold)).toBe(0);
  expect(debrisOpacity(hold + VFX.debrisFade - eps, hold)).toBeLessThan(1e-8);
});

it("keeps secondary death accents short, smoke-free and inside the fixed pool", () => {
  for (const [event, count] of [
    ["death-flecks", 4],
    ["death-ground", 6],
    ["finisher", 1],
  ] as const) {
    const p = new ParticleSimulation();
    p.emit(event, 0, 1, 0);
    const parts = p.items.filter((p) => p.life > 0);
    expect(parts).toHaveLength(count);
    expect(
      parts.every(
        (p) =>
          p.shape !== SHAPE.smoke &&
          !p.overlay &&
          p.trail === 0 &&
          p.max <= 0.3,
      ),
    ).toBe(true);
    if (event !== "death-ground")
      expect(parts.every((p) => p.gravity === 0)).toBe(true);
    for (let i = 0; i < 30; i++) p.step(1 / 60, () => 0);
    expect(p.active).toBe(0);
  }
});
