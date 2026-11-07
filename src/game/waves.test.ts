import { it, expect } from "vitest";
import { Battle } from "./battle";
import { wavePlan, ENEMY_TYPES, ENEMY_CAPACITY } from "./waves";
it("launches ten overlapping waves without deleting or upgrading earlier enemies", () => {
  const b = new Battle([]);
  b.startWave();
  for (let i = 0; i < 12; i++) b.update(1 / 60, { x: 24, z: 25 });
  const first = b.alive.find((e) => e.wave === 1)!;
  const hp = first.hp;
  for (let i = 1; i < 10; i++) expect(b.startWave()).toBe(true);
  expect(b.startWave()).toBe(false);
  expect(b.wave).toBe(10);
  expect(first.hp).toBe(hp);
  for (let i = 0; i < 1200; i++) b.update(1 / 60, { x: 24, z: 25 });
  expect(b.pending).toBe(0);
  expect(b.alive.length).toBe(ENEMY_CAPACITY);
  for (let w = 1; w <= 10; w++)
    expect(b.alive.filter((e) => e.wave === w).length).toBe(wavePlan(w).length);
});
it("varies composition, movement and attack behavior with deterministic plans", () => {
  expect(new Set(wavePlan(1))).toEqual(new Set([0]));
  expect(wavePlan(2)).toContain(1);
  expect(wavePlan(3)).toContain(2);
  expect(wavePlan(4)).toContain(3);
  expect(wavePlan(10)).toEqual(wavePlan(10));
  expect(ENEMY_TYPES[1].speed).toBeGreaterThan(ENEMY_TYPES[0].speed);
  expect(ENEMY_TYPES[2].hp).toBeGreaterThan(ENEMY_TYPES[0].hp * 2);
  expect(ENEMY_TYPES[3].range).toBeGreaterThan(ENEMY_TYPES[0].range * 3);
});
it("does not automatically start waves when the field is clear", () => {
  const b = new Battle([]);
  b.startWave();
  for (let i = 0; i < 400; i++) b.update(1 / 60, { x: 24, z: 25 });
  for (const e of b.alive) b.damageEnemy(e.id, 10000, { x: 24, z: 25 });
  for (let i = 0; i < 1500; i++) b.update(1 / 60, { x: 24, z: 25 });
  expect(b.wave).toBe(1);
  expect(b.phase).toBe("intermission");
  expect(b.startWave()).toBe(true);
});

it("a ranged witch fires a real projectile that can hit or be dodged", () => {
  function fire() {
    const b = new Battle([]),
      e = b.enemies[0];
    Object.assign(e, {
      active: true,
      x: 0,
      z: -30,
      hp: 56,
      maxHp: 56,
      kind: 3,
      wave: 4,
      cooldown: 0,
      windup: 0,
      spawnAge: 1,
      target: "bell",
    });
    for (let i = 0; i < 90 && !b.missiles.some((m) => m.active); i++)
      b.update(1 / 60, { x: 0, z: -24, y: 0 });
    expect(b.missiles.some((m) => m.active)).toBe(true);
    e.active = false;
    return b;
  }
  const hit = fire();
  for (let i = 0; i < 120; i++) hit.update(1 / 60, { x: 0, z: -24, y: 0 });
  expect(hit.health).toBeLessThan(100);
  const dodge = fire();
  for (let i = 0; i < 240; i++) dodge.update(1 / 60, { x: 8, z: -24, y: 0 });
  expect(dodge.health).toBe(100);
});

it("strictly increases enemy count and threat across every wave with group intervals", () => {
  let lastCount = 0,
    lastThreat = 0;
  for (let w = 1; w <= 10; w++) {
    const plan = wavePlan(w),
      threat =
        plan.reduce(
          (n, k) => n + ENEMY_TYPES[k].hp * ENEMY_TYPES[k].damage,
          0,
        ) *
        (1 + (w - 1) * 0.065);
    expect(plan.length).toBeGreaterThan(lastCount);
    expect(threat).toBeGreaterThan(lastThreat);
    lastCount = plan.length;
    lastThreat = threat;
  }
  expect(wavePlan(10)).toHaveLength(44);
  expect(ENEMY_CAPACITY).toBe(260);
  const b = new Battle([]);
  b.startWave();
  for (let i = 0; i < 60; i++) b.update(1 / 60, { x: 0, z: 14 });
  expect(b.alive.length).toBe(3);
  expect(b.pending).toBe(5);
});
