import { it, expect } from "vitest";
import { Battle } from "./battle";
function enemy(b: Battle, x: number, z: number) {
  const e = b.enemies[0];
  Object.assign(e, {
    active: true,
    x,
    z,
    hp: 60,
    maxHp: 60,
    cooldown: 0,
    target: "bell",
    windup: 0,
    spawnAge: 1,
  });
  return e;
}
it("switches from the bell to a nearby player and back when the player retreats", () => {
  const b = new Battle([]),
    e = enemy(b, 0, -30);
  b.update(1 / 60, { x: 1, z: -26 });
  expect(e.target).toBe("player");
  b.update(1 / 60, { x: 1, z: -19 });
  expect(e.target).toBe("player");
  b.update(1 / 60, { x: 1, z: -10 });
  expect(e.target).toBe("bell");
});
it("does not detect a player through a stone wall", () => {
  const b = new Battle([
    { minX: -5, maxX: 5, minZ: -25, maxZ: -24, height: 3 },
  ]);
  const e = enemy(b, 0, -22);
  b.update(0.016, { x: 0, z: -28 });
  expect(e.target).toBe("bell");
});
it("telegraphs attacks and damages the player only in range", () => {
  const b = new Battle([]);
  enemy(b, 0, -30);
  b.update(0.016, { x: 0, z: -29 });
  expect(b.health).toBe(100);
  for (let i = 0; i < 35; i++) b.update(1 / 60, { x: 0, z: -29 });
  expect(b.health).toBeLessThan(100);
});
it("does not hit a player who leaves during the attack windup", () => {
  const b = new Battle([]);
  enemy(b, 0, -30);
  b.update(0.016, { x: 0, z: -29 });
  for (let i = 0; i < 35; i++) b.update(1 / 60, { x: 0, z: -20 });
  expect(b.health).toBe(100);
});
it("damages the bell when the player is distant", () => {
  const b = new Battle([]);
  enemy(b, 0, 17);
  for (let i = 0; i < 50; i++) b.update(1 / 60, { x: 10, z: -25 });
  expect(b.baseHealth).toBeLessThan(500);
});
it("spawns across the entire reachable forest fringe in spaced groups", () => {
  const b = new Battle([]);
  b.startWave();
  for (let i = 0; i < 400; i++) b.update(1 / 60, { x: 0, z: 14 });
  const spawns = b.events.filter((e) => e.kind === "spawn");
  expect(spawns.length).toBe(8);
  expect(new Set(spawns.map((e) => e.value)).size).toBe(7);
  expect(Math.min(...spawns.map((e) => e.x))).toBeLessThan(-17);
  expect(Math.max(...spawns.map((e) => e.x))).toBeGreaterThan(17);
  for (const e of spawns) {
    expect(e.z).toBeGreaterThanOrEqual(-64);
    expect(e.z).toBeLessThan(-59.5);
    expect(b.nav.canStand(e.x, e.z)).toBe(true);
  }
});
it("melee respects range and facing, and releases a defeated enemy", () => {
  const b = new Battle([]),
    e = enemy(b, 0, -29);
  b.melee({ x: 0, z: -30 }, { x: 0, z: -1 });
  expect(e.hp).toBe(60);
  for (let i = 0; i < 50; i++) b.update(1 / 60, { x: 0, z: -30 });
  e.x = 0;
  e.z = -31;
  b.melee({ x: 0, z: -30 }, { x: 0, z: -1 });
  expect(e.hp).toBeLessThan(60);
  expect(b.damageEnemy(0, 100, { x: 0, z: -30 })).toBe(true);
  expect(b.souls).toBe(1);
  expect(b.drops.some((d) => d.active)).toBe(true);
});
it("enforces skill costs/caps and applies constitution to maximum health", () => {
  const b = new Battle([]);
  expect(b.upgradeStat("constitution")).toBe(true);
  expect(b.maxHealth).toBe(120);
  expect(b.health).toBe(120);
  b.upgradeSkill("athletics");
  b.upgradeSkill("athletics");
  expect(b.skills.athletics).toBe(3);
  expect(b.upgradeSkill("athletics")).toBe(false);
  b.upgradeStat("greed");
  expect(b.points).toBe(0);
  expect(b.upgradeStat("greed")).toBe(false);
});
it("prevents repeated casts during cooldown and freezes combat after defeat", () => {
  const b = new Battle([]);
  expect(b.burst({ x: 0, z: 0 })).toBe(true);
  expect(b.burst({ x: 0, z: 0 })).toBe(false);
  b.hurtPlayer(500);
  expect(b.phase).toBe("lost");
  const base = b.baseHealth;
  for (let i = 0; i < 600; i++) b.update(1 / 60, { x: 0, z: 14 });
  expect(b.baseHealth).toBe(base);
  b.reset();
  expect(b.health).toBe(100);
  expect(b.phase).toBe("peace");
  expect(b.souls).toBe(0);
  expect(b.alive.length).toBe(0);
});

it("melee still connects beside an obstacle clearance cell", () => {
  const b = new Battle([
    { minX: -0.65, maxX: 0.65, minZ: 18.35, maxZ: 19.65, height: 2.8 },
  ]);
  const e = enemy(b, 0, 22);
  expect(b.nav.walkable(0, 20.2)).toBe(false);
  expect(b.melee({ x: 0, z: 20.2 }, { x: 0, z: 1 })).toBe(true);
  expect(e.hp).toBeLessThan(60);
});
it("soul burst deals damage in range and respects solid occlusion", () => {
  const b = new Battle([]),
    e = enemy(b, 2, -30);
  b.burst({ x: 0, z: -30 });
  expect(e.active).toBe(false);
  const blocked = new Battle([
    { minX: -1, maxX: 1, minZ: -28, maxZ: -27, height: 3 },
  ]);
  const other = enemy(blocked, 0, -25);
  blocked.burst({ x: 0, z: -30 });
  expect(other.hp).toBe(60);
});
it("a high jumping player can avoid a grounded attack", () => {
  const b = new Battle([]);
  enemy(b, 0, -30);
  for (let i = 0; i < 40; i++) b.update(1 / 60, { x: 0, z: -29, y: 2 });
  expect(b.health).toBe(100);
});

it("carries critical metadata without changing supplied damage and releases a reserved burst only once", () => {
  const b = new Battle([]),
    e = enemy(b, 0, -30);
  e.hp = 200;
  b.damageEnemy(0, 19, { x: 0, z: -25 }, 2, {
    x: 0,
    y: 1.4,
    z: -30,
    critical: true,
    bullet: true,
    incomingX: 0,
    incomingY: 0,
    incomingZ: -1,
    normalX: 0,
    normalY: 0,
    normalZ: 1,
  });
  expect(e.hp).toBe(181);
  expect(e.hitCritical).toBe(true);
  expect(b.events[0]).toMatchObject({
    kind: "hit",
    value: 19,
    critical: true,
    bullet: true,
    incomingZ: -1,
    normalZ: 1,
  });
  expect(b.requestBurst()).toBe(true);
  expect(e.hp).toBe(181);
  expect(b.releaseBurst({ x: 0, z: -30 })).toBe(true);
  expect(e.hp).toBe(121);
  expect(e.hitCritical).toBe(false);
  expect(b.releaseBurst({ x: 0, z: -30 })).toBe(false);
  expect(e.hp).toBe(121);
});
it("reports the same greed-adjusted gold amount that is actually awarded", () => {
  const b = new Battle([]);
  b.stats.greed = 3;
  Object.assign(b.drops[0], {
    active: true,
    kind: "gold",
    value: 4,
    x: 0,
    z: 14,
    y: 5.3,
    vx: 0,
    vy: 0,
    vz: 0,
    age: 1,
    magnet: true,
  });
  b.update(1 / 60, { x: 0, z: 14, y: 4 });
  expect(b.coins).toBe(46);
  expect(b.events.find((e) => e.kind === "gold")?.value).toBe(6);
});
it("preserves critical finishing direction in the kill event without duplicating rewards", () => {
  const b = new Battle([]),
    e = b.enemies[0];
  Object.assign(e, {
    active: true,
    kind: 0,
    wave: 1,
    x: 2,
    z: -30,
    hp: 5,
    maxHp: 5,
  });
  b.damageEnemy(e.id, 6, { x: 0, z: -29 }, 2, {
    x: 2,
    y: 1,
    z: -30,
    critical: true,
    bullet: true,
    incomingX: 0.8,
    incomingZ: -0.6,
  });
  expect(b.events.filter((e) => e.kind === "kill")).toHaveLength(1);
  expect(b.events.find((e) => e.kind === "kill")).toMatchObject({
    critical: true,
    incomingX: 0.8,
    incomingZ: -0.6,
  });
  expect(b.souls).toBe(1);
  expect(e.active).toBe(false);
});
it("marks magic kills without treating ordinary bullet kills as soul bursts", () => {
  const b = new Battle([]);
  Object.assign(b.enemies[0], {
    active: true,
    x: 1,
    z: -30,
    hp: 1,
    kind: 0,
    wave: 1,
  });
  b.requestBurst();
  b.releaseBurst({ x: 0, z: -30 });
  expect(b.events.find((e) => e.kind === "kill")?.magic).toBe(true);
});
