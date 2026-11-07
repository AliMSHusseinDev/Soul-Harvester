import { it, expect } from "vitest";
import { HitFeedback, shotTarget } from "./feedback";
import { Battle } from "./battle";
import { COMBAT_FEEL } from "./tuning";
it("only resolves the first hit, so a shot cannot damage an enemy and ring the bell", () => {
  expect(shotTarget(10, 20, 30)).toBe("enemy");
  expect(shotTarget(30, 20, 40)).toBe("bell");
  expect(shotTarget(10, 20, 5)).toBe("solid");
  expect(shotTarget(Infinity, Infinity, Infinity)).toBe("miss");
});
it("preserves kill priority during rapid hits and clears in simulation time", () => {
  const f = new HitFeedback();
  f.confirm(false);
  expect(f.kill).toBe(false);
  expect(f.remaining).toBeGreaterThan(0);
  f.confirm(true);
  f.confirm(false);
  expect(f.kill).toBe(true);
  f.update(1);
  expect(f.remaining).toBe(0);
  expect(f.kill).toBe(false);
});
it("flashes and reacts to valid damage, reports impact coordinates, then restores", () => {
  const b = new Battle([]),
    e = b.enemies[0];
  Object.assign(e, {
    active: true,
    spawnAge: 1,
    x: 0,
    z: -30,
    hp: 100,
    maxHp: 100,
  });
  b.damageEnemy(0, 10, { x: 0, z: -25 }, 2, { x: 0.3, y: 1.1, z: -30 });
  expect(e.hitFlash).toBe(COMBAT_FEEL.flashDuration);
  expect(e.reaction).toBe(COMBAT_FEEL.reactionDuration);
  expect(b.events[0]).toMatchObject({
    kind: "hit",
    x: 0.3,
    y: 1.1,
    z: -30,
    value: 10,
  });
  for (let i = 0; i < 20; i++) b.update(1 / 60, { x: 0, z: 14 });
  expect(e.hitFlash).toBe(0);
  expect(e.reaction).toBe(0);
  b.damageEnemy(0, 1000, { x: 0, z: 14 });
  expect(e.active).toBe(false);
  const count = b.events.length;
  b.damageEnemy(0, 1000, { x: 0, z: 14 });
  expect(b.events.length).toBe(count);
});
