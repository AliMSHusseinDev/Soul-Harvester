import { it, expect } from "vitest";
import { Battle } from "./battle";
import { groundHeight } from "./terrain";
it("moves a crowd around a wall and over the bridge without entering blocked cells", () => {
  const b = new Battle([
    { minX: -4, maxX: 4, minZ: -39, maxZ: -37, height: 4 },
  ]);
  for (let i = 0; i < 7; i++)
    Object.assign(b.enemies[i], {
      active: true,
      x: (i - 3) * 3,
      z: -50,
      hp: 43,
      maxHp: 43,
      spawnAge: 1,
      speedFactor: 1 + (i - 3) * 0.02,
    });
  b.baseHealth = 100000;
  const seen = new Set<number>();
  for (let step = 0; step < 6000; step++) {
    b.update(1 / 60, { x: 26, z: 25, y: 4 });
    for (const e of b.alive) {
      expect(b.nav.walkable(e.x, e.z)).toBe(true);
      expect(groundHeight(e.x, e.z)).toBeGreaterThanOrEqual(0);
      if (e.z > 2) seen.add(e.id);
    }
    if (seen.size === 7) break;
  }
  expect(seen.size).toBe(7);
  expect(b.alive).toHaveLength(7);
});
it("uses individual speeds and lateral motion without forcing a straight marching row", () => {
  const b = new Battle([]);
  b.startWave();
  for (let i = 0; i < 400; i++) b.update(1 / 60, { x: 26, z: 25, y: 4 });
  expect(
    new Set(b.alive.map((e) => e.speedFactor.toFixed(3))).size,
  ).toBeGreaterThan(4);
  const before = b.alive.map((e) => ({ id: e.id, x: e.x, z: e.z }));
  for (let i = 0; i < 120; i++) b.update(1 / 60, { x: 26, z: 25, y: 4 });
  expect(before.some((p) => Math.abs(b.enemies[p.id].x - p.x) > 0.1)).toBe(
    true,
  );
  expect(b.alive.every((e) => e.gait > 0)).toBe(true);
});
it("ordinary bullet hits keep attacks responsive, while heavy knockback interrupts", () => {
  const b = new Battle([]),
    e = b.enemies[0];
  Object.assign(e, {
    active: true,
    x: 0,
    z: -30,
    hp: 100,
    spawnAge: 1,
    windup: 0.3,
  });
  b.damageEnemy(0, 10, { x: 0, z: -25 }, 2);
  expect(e.windup).toBe(0.3);
  b.damageEnemy(0, 10, { x: 0, z: -25 }, 8);
  expect(e.windup).toBe(0);
});

it("separates stationary attackers without teleporting them or deleting the crowd", () => {
  const b = new Battle([]);
  b.baseHealth = 100000;
  for (let i = 0; i < 16; i++) {
    const angle = (i * Math.PI * 2) / 16;
    Object.assign(b.enemies[i], {
      active: true,
      x: Math.cos(angle) * 1.6,
      z: 19 + Math.sin(angle) * 1.6,
      hp: 43,
      spawnAge: 1,
    });
  }
  for (let step = 0; step < 180; step++) {
    const before = b.alive.map((e) => ({ x: e.x, z: e.z }));
    b.update(1 / 60, { x: 26, z: 25, y: 4 });
    for (const e of b.alive)
      expect(
        Math.hypot(e.x - before[e.id].x, e.z - before[e.id].z),
      ).toBeLessThan(0.06);
  }
  let minimum = Infinity;
  for (const a of b.alive)
    for (const c of b.alive)
      if (a.id < c.id)
        minimum = Math.min(minimum, Math.hypot(a.x - c.x, a.z - c.z));
  expect(minimum).toBeGreaterThan(0.65);
  expect(b.alive).toHaveLength(16);
});
