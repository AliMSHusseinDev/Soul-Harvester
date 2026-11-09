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
  bloodSmokeOpacity,
  enemyParticleDensity,
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
it("adds rising smoke and dotted trails without a cyan burst on ordinary kills", () => {
  const p = new ParticleSimulation();
  p.emit("death", 0, 4, -8, 1, false, undefined, 0, 1, true);
  expect(
    p.items.filter((p) => p.life > 0 && p.shape === SHAPE.smoke),
  ).toHaveLength(1);
  expect(p.items.some((p) => p.life > 0 && p.shape === SHAPE.wisp)).toBe(false);
  expect(
    p.items.some(
      (p) => p.life > 0 && p.shape === SHAPE.ribbon && p.trail === 1,
    ),
  ).toBe(true);
  const emitted = p.emitted;
  p.step(0.05, () => 0);
  expect(p.emitted).toBeGreaterThan(emitted);
  for (let i = 0; i < 240; i++) p.step(1 / 60, () => 0);
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

it("keeps critical accents compact and scatters death flakes across a broad arc", () => {
  const hit = new ParticleSimulation();
  hit.emit("critical", 0, 2, 0);
  expect(
    hit.items.some((p) => p.life > 0 && p.overlay && p.shape === SHAPE.ring),
  ).toBe(false);
  expect(
    hit.items
      .filter((p) => p.life > 0 && p.overlay)
      .every((p) => p.size < 0.16),
  ).toBe(true);
  const death = new ParticleSimulation();
  death.emit("death", 0, 3, 0);
  for (let i = 0; i < 24; i++) death.step(1 / 60, () => 0);
  const flakes = death.items.filter(
    (p) => p.life > 0 && p.shape === SHAPE.ribbon,
  );
  expect(
    flakes.filter((p) => Math.hypot(p.x, p.z) > 1.8).length,
  ).toBeGreaterThan(8);
});

it("uses the requested deep red and scatters a death burst several metres without losing its bounded lifetime", () => {
  const p = new ParticleSimulation();
  p.emit("death", 0, 5, 0);
  expect(
    p.items
      .filter((p) => p.life > 0)
      .every((p) => [0x820808, 0xb32020, 0x7d101a].includes(p.color)),
  ).toBe(true);
  for (let i = 0; i < 30; i++) p.step(1 / 60, () => 0);
  const rays = p.items.filter((p) => p.life > 0 && p.shape === SHAPE.ribbon);
  expect(
    rays.filter((p) => Math.hypot(p.x, p.y - 5, p.z) > 3.5).length,
  ).toBeGreaterThan(10);
  expect(
    rays.some((a) =>
      rays.some((b) => a.x * b.x + (a.y - 5) * (b.y - 5) + a.z * b.z < 0),
    ),
  ).toBe(true);
  for (let i = 0; i < 240; i++) p.step(1 / 60, () => 0);
  expect(p.active).toBe(0);
});

it("uses weight-driven splatter and preserves debris mixed bounce and settle", () => {
  const p = new ParticleSimulation();
  p.emit("death", 0, 0.9, 0);
  const rays = p.items.filter((p) => p.life > 0 && p.shape === SHAPE.ribbon),
    chunks = p.items.filter((p) => p.life > 0 && p.shape === SHAPE.debris);
  expect(
    rays.every((p) => p.color === 0xb32020 && p.gravity > 0 && p.collision),
  ).toBe(true);
  expect(
    chunks.every((p) => p.color === 0x820808 && p.gravity > 0 && p.collision),
  ).toBe(true);
  expect(chunks.some((p) => p.bounceLimit === 0)).toBe(true);
  expect(chunks.some((p) => p.bounceLimit > 0)).toBe(true);
  const down = rays[0];
  down.y = 0.04;
  down.vy = -2;
  p.step(0.05, () => 0);
  expect(down.y).toBeGreaterThanOrEqual(0.035);
  expect(down.vy).toBe(0);
  expect(down.bounces).toBe(0);
  let bouncing = false,
    resting = false;
  for (let i = 0; i < 180; i++) {
    p.step(1 / 120, () => 0);
    for (const c of chunks) {
      if (c.bounces > 0) bouncing = true;
      if (c.settled) {
        resting = true;
        expect(c.vx).toBe(0);
        expect(c.vy).toBe(0);
        expect(c.y).toBeGreaterThanOrEqual(0.035);
        expect(c.expireAge).toBe(Infinity);
      }
      expect(c.bounces).toBeLessThanOrEqual(c.bounceLimit);
    }
  }
  expect(bouncing && resting).toBe(true);
  for (let i = 0; i < 240; i++) p.step(1 / 60, () => 0);
  expect(p.active).toBe(0);
});

it("applies the further gravity multiplier while preserving rays and one smoke cloud", () => {
  for (const [finishing, reduced, expected] of [
    [false, false, 44],
    [true, false, 50],
    [false, true, 18],
  ] as const) {
    const p = new ParticleSimulation();
    p.emit("death", 0, 2, 0, 1, reduced, undefined, 0, 0, finishing);
    expect(
      p.items.filter((p) => p.life > 0 && p.shape === SHAPE.debris),
    ).toHaveLength(expected);
    expect(
      p.items.filter((p) => p.life > 0 && p.shape === SHAPE.smoke),
    ).toHaveLength(1);
    expect(
      p.items
        .filter((p) => p.life > 0 && p.shape === SHAPE.ribbon)
        .every((p) => p.color === 0xb32020),
    ).toBe(true);
  }
});
it("delays lethal blood smoke until after the first body flash", () => {
  const p = new ParticleSimulation();
  p.emit("death", 0, 2, 0);
  const smoke = p.items.filter((p) => p.life > 0 && p.shape === SHAPE.smoke);
  expect(smoke.every((p) => p.color === 0x7d101a && p.age < 0)).toBe(true);
  p.step(0.09, () => 0);
  expect(smoke.every((p) => p.age < 0)).toBe(true);
  p.step(0.02, () => 0);
  expect(smoke.every((p) => p.age >= 0)).toBe(true);
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
it("increases only splatter birth sizes by ten percent over the previous version", () => {
  const gain = VFX.splatterSizeGain,
    a = new ParticleSimulation(),
    b = new ParticleSimulation();
  try {
    VFX.splatterSizeGain = 1.06;
    a.emit("death", 0, 2, 0);
    VFX.splatterSizeGain = gain;
    b.emit("death", 0, 2, 0);
  } finally {
    VFX.splatterSizeGain = gain;
  }
  for (let i = 0; i < a.items.length; i++)
    if (a.items[i].life > 0) {
      const factor = a.items[i].color === 0xb32020 ? 1.1 : 1;
      expect(b.items[i].size).toBeCloseTo(a.items[i].size * factor, 10);
    }
});

it("reduces bleeding lifetime 20% and fades only after their hold lifetime", () => {
  const p = new ParticleSimulation();
  p.emit("death", 0, 0.9, 0);
  const chunks = p.items.filter((p) => p.life > 0 && p.shape === SHAPE.debris);
  expect(
    chunks.every(
      (p) =>
        p.fadeAt >= 1.68 &&
        p.fadeAt <= 2.04 &&
        Math.abs(p.max - p.fadeAt - 0.28) < 1e-9,
    ),
  ).toBe(true);
  for (let i = 0; i < 90; i++) p.step(1 / 60, () => 0);
  expect(
    chunks.every((p) => p.life > 0 && debrisOpacity(p.age, p.fadeAt) === 1),
  ).toBe(true);
  for (const c of chunks) {
    expect(debrisOpacity(c.fadeAt, c.fadeAt)).toBe(1);
    expect(debrisOpacity(c.fadeAt + 0.14, c.fadeAt)).toBeCloseTo(0.5);
    expect(debrisOpacity(c.fadeAt + 0.28, c.fadeAt)).toBeCloseTo(0);
  }
  for (let i = 0; i < 120; i++) p.step(1 / 60, () => 0);
  expect(p.active).toBe(0);
});
it("rests shards above raised map surfaces without cancelling mixed bounce behavior", () => {
  const p = new ParticleSimulation();
  p.surfaceFloor = () => 0.12;
  p.emit("death", 0, 0.9, 0);
  const chunks = p.items.filter((p) => p.life > 0 && p.shape === SHAPE.debris);
  for (let i = 0; i < 120; i++) p.step(1 / 60, () => 0);
  expect(
    chunks.every(
      (p) => p.settled && p.y >= 0.12 + p.size * 0.45 + 0.012 - 1e-8,
    ),
  ).toBe(true);
  expect(
    chunks.some((p) => p.bounces === 0) && chunks.some((p) => p.bounces > 0),
  ).toBe(true);
});

it("reduces splatter launch 25% and applies the current ray count and range", () => {
  const original = VFX.splatterLaunchGain,
    a = new ParticleSimulation(),
    b = new ParticleSimulation();
  try {
    VFX.splatterLaunchGain = 1.5;
    a.emit("death", 0, 4, 0);
    VFX.splatterLaunchGain = original;
    b.emit("death", 0, 4, 0);
  } finally {
    VFX.splatterLaunchGain = original;
  }
  const rays = b.items.filter((p) => p.life > 0 && p.shape === SHAPE.ribbon);
  expect(rays).toHaveLength(37);
  for (let i = 0; i < a.items.length; i++)
    if (a.items[i].shape === SHAPE.ribbon && a.items[i].life > 0) {
      expect(b.items[i].size).toBe(a.items[i].size);
      for (const k of ["vx", "vy", "vz"] as const)
        expect(b.items[i][k]).toBeCloseTo(a.items[i][k] * 0.75, 10);
    }
  expect(
    rays.some((p) => p.weight < 0.4) && rays.some((p) => p.weight > 1),
  ).toBe(true);
  expect(
    Math.max(...rays.filter((p) => p.weight < 0.4).map((p) => p.gravity)),
  ).toBeLessThan(
    Math.min(...rays.filter((p) => p.weight > 1).map((p) => p.gravity)),
  );
  const cap = splatterRange();
  expect(rays.every((p) => p.rangeLimit === cap)).toBe(true);
  for (let i = 0; i < 240; i++) {
    b.step(1 / 60, (x) => (x > 4 ? 8 : 0));
    for (const p of b.items.filter(
      (p) => p.life > 0 && Number.isFinite(p.rangeLimit),
    ))
      expect(
        Math.hypot(
          p.x - p.anchorX,
          p.shape === SHAPE.debris ? 0 : p.y - p.anchorY,
          p.z - p.anchorZ,
        ),
      ).toBeLessThanOrEqual(cap + 1e-6);
  }
  expect(b.active).toBe(0);
});

it("lets some light rays approach the cap while others stop short and never brighten after range fading", () => {
  const p = new ParticleSimulation();
  p.emit("death", 0, 5, 0);
  const rays = p.items.filter((p) => p.life > 0 && p.shape === SHAPE.ribbon),
    peaks = rays.map(() => 0),
    alphas = rays.map(() => 1);
  const gain = VFX.splatterRangeGain;
  let baseline = 0;
  try {
    VFX.splatterRangeGain = 1;
    baseline = splatterRange();
  } finally {
    VFX.splatterRangeGain = gain;
  }
  expect(splatterRange() / baseline).toBeCloseTo(1.02, 10);
  for (let i = 0; i < 180; i++) {
    p.step(1 / 120, () => 0);
    rays.forEach((r, j) => {
      peaks[j] = Math.max(
        peaks[j],
        Math.hypot(r.x - r.anchorX, r.y - r.anchorY, r.z - r.anchorZ),
      );
      expect(r.rangeOpacity).toBeLessThanOrEqual(alphas[j] + 1e-8);
      alphas[j] = r.rangeOpacity;
    });
  }
  const light = rays
    .map((r, j) => ({ r, peak: peaks[j] }))
    .filter(({ r }) => r.weight < 0.4);
  expect(
    light.some(({ r, peak }) => peak > r.rangeLimit * 0.8),
    JSON.stringify(
      light.map(({ r, peak }) => ({
        peak,
        range: r.rangeLimit,
        weight: r.weight,
        drag: r.drag,
        max: r.max,
      })),
    ),
  ).toBe(true);
  expect(light.some(({ r, peak }) => peak < r.rangeLimit * 0.7)).toBe(true);
});

it("launches bleeding 50% faster than 0.14.7 at fixed sizes and varies its weights and contact-oriented fans", () => {
  const gain = VFX.bleedingLaunchGain,
    a = new ParticleSimulation(),
    b = new ParticleSimulation();
  const impact = {
    x: 0.3,
    y: 1.4,
    z: 0,
    dx: 0,
    dy: 0.1,
    dz: -1,
    nx: 0,
    ny: 0,
    nz: 1,
  };
  try {
    VFX.bleedingLaunchGain = 1.3;
    a.emit("death", 0, 1, 0, 1, false, undefined, 0, -1, false, 0, impact);
    VFX.bleedingLaunchGain = gain;
    b.emit("death", 0, 1, 0, 1, false, undefined, 0, -1, false, 0, impact);
  } finally {
    VFX.bleedingLaunchGain = gain;
  }
  const shards = b.items.filter((p) => p.life > 0 && p.shape === SHAPE.debris);
  expect(shards).toHaveLength(44);
  for (let i = 0; i < a.items.length; i++)
    if (a.items[i].life > 0 && a.items[i].shape === SHAPE.debris) {
      expect(b.items[i].size).toBe(a.items[i].size);
      for (const k of ["vx", "vy", "vz"] as const)
        expect(b.items[i][k]).toBeCloseTo(a.items[i][k] * 1.5, 10);
    }
  expect(
    shards.every(
      (p) => p.x === impact.x && p.y === impact.y && p.z === impact.z,
    ),
  ).toBe(true);
  expect(
    shards.some((p) => p.weight < 1) && shards.some((p) => p.weight > 1.5),
  ).toBe(true);
  const range = VFX.bleedingRangeGain;
  let baseline = 0;
  try {
    VFX.bleedingRangeGain = 1.7;
    baseline = bleedingRange();
  } finally {
    VFX.bleedingRangeGain = range;
  }
  expect(bleedingRange() / baseline).toBeCloseTo(1.5, 10);
  const before = shards.map((p) => [p.vx, p.vy, p.vz]);
  b.emit("death", 0, 1, 0, 1, false, undefined, 0, -1, false, 0, impact);
  expect(
    b.items
      .filter((p) => p.life > 0 && p.shape === SHAPE.debris)
      .slice(shards.length)
      .map((p) => [p.vx, p.vy, p.vz]),
  ).not.toEqual(before);
  for (let i = 0; i < 240; i++) {
    b.step(1 / 60, () => 0);
    for (const p of b.items.filter(
      (p) => p.life > 0 && p.shape === SHAPE.debris,
    ))
      expect(Math.hypot(p.x - p.anchorX, p.z - p.anchorZ)).toBeLessThanOrEqual(
        p.rangeLimit + 1e-7,
      );
  }
});

it("bounds enemy-dependent counts without changing smoke or particle sizes", () => {
  const emit = (density: number) => {
    const p = new ParticleSimulation();
    p.emit(
      "death",
      0,
      1,
      0,
      1,
      false,
      undefined,
      0,
      0,
      false,
      0,
      undefined,
      density,
    );
    return p.items.filter((p) => p.life > 0);
  };
  const normal = emit(1),
    large = emit(1.3),
    capped = emit(100);
  for (const shape of [SHAPE.debris, SHAPE.ribbon]) {
    const a = normal.filter((p) => p.shape === shape),
      b = large.filter((p) => p.shape === shape);
    expect(b.length).toBe(Math.round(a.length * 1.3));
    expect(capped.filter((p) => p.shape === shape).length).toBe(b.length);
  }
  expect(large.filter((p) => p.shape === SHAPE.smoke)).toHaveLength(1);
});

it("gives larger tougher enemy types a modest bounded particle bonus", () => {
  expect(enemyParticleDensity(1, 1)).toBe(1);
  expect(enemyParticleDensity(0.82, 29 / 43)).toBe(1);
  expect(enemyParticleDensity(1.45, 135 / 43)).toBeGreaterThan(
    enemyParticleDensity(1.05, 56 / 43),
  );
  expect(enemyParticleDensity(100, 1e12)).toBe(1.3);
});

it("extends only bloody death smoke by 40% and fades smoothly", () => {
  const a = new ParticleSimulation(),
    b = new ParticleSimulation(),
    gain = VFX.bloodSmokeLifeGain;
  try {
    VFX.bloodSmokeLifeGain = 1;
    a.emit("death", 0, 1, 0);
    VFX.bloodSmokeLifeGain = gain;
    b.emit("death", 0, 1, 0);
  } finally {
    VFX.bloodSmokeLifeGain = gain;
  }
  const smoke = b.items.filter((p) => p.life > 0 && p.shape === SHAPE.smoke);
  expect(smoke).toHaveLength(1);
  for (let i = 0; i < a.items.length; i++)
    if (a.items[i].life > 0)
      expect(b.items[i].max).toBeCloseTo(
        a.items[i].max * (a.items[i].shape === SHAPE.smoke ? 1.4 : 1),
        10,
      );
  expect(bloodSmokeOpacity(0)).toBe(0);
  expect(bloodSmokeOpacity(1)).toBe(0);
  let last = 1;
  for (let t = 0.55; t <= 1; t += 0.01) {
    const opacity = bloodSmokeOpacity(t);
    expect(opacity).toBeLessThanOrEqual(last);
    last = opacity;
  }
  const c = new ParticleSimulation();
  c.emit("death", 0, 1, 0);
  b.step(0.5, () => -100);
  for (let i = 0; i < 30; i++) c.step(1 / 60, () => -100);
  const other = c.items.filter((p) => p.life > 0 && p.shape === SHAPE.smoke);
  for (let i = 0; i < smoke.length; i++)
    for (const axis of ["x", "y", "z"] as const)
      expect(smoke[i][axis]).toBeCloseTo(other[i][axis], 8);
  for (let i = 0; i < 180; i++) b.step(1 / 60, () => 0);
  expect(b.active).toBe(0);
});
it("emits one impact-anchored bloody cloud per kill at both density settings", () => {
  for (const reduced of [false, true]) {
    const p = new ParticleSimulation();
    const impact = {
      x: 2,
      y: 1.2,
      z: 3,
      dx: 1,
      dy: 0,
      dz: 0,
      nx: -1,
      ny: 0,
      nz: 0,
    };
    for (let i = 0; i < 3; i++)
      p.emit("death", 0, 1, 0, 1, reduced, undefined, 1, 0, false, 0, impact);
    const clouds = p.items.filter((p) => p.life > 0 && p.shape === SHAPE.smoke);
    expect(clouds).toHaveLength(3);
    expect(
      clouds.every(
        (p) => p.x === 2 && p.y === 1.2 && p.z === 3 && p.color === 0x7d101a,
      ),
    ).toBe(true);
  }
});
