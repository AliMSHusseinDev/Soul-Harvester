import { expect, it } from "vitest";
import {
  CombatBursts,
  CombatCoverage,
  combatEffectKind,
  combatFrameUV,
  combatSpriteWidth,
  validateCombatSheet,
  type CombatSheet,
} from "./combat-sprites";
// Diagnostic rectangles only; these are never imported by the production game.
const sheet: CombatSheet = {
  kind: "normal",
  url: "test-only.png",
  width: 128,
  height: 64,
  anchor: [0.5, 0.5],
  frames: Array.from({ length: 8 }, (_, i) => ({
    x: 2 + (i % 4) * 32,
    y: 2 + Math.floor(i / 4) * 32,
    width: 28,
    height: 28,
    coverage: 0.3,
  })),
};
it("validates measured frame bounds and rejects unequal animation canvases", () => {
  expect(() => validateCombatSheet(sheet)).not.toThrow();
  expect(() => validateCombatSheet({ ...sheet, width: 64 })).toThrow();
  expect(() =>
    validateCombatSheet({
      ...sheet,
      frames: [{ ...sheet.frames[0], width: 30 }, ...sheet.frames.slice(1)],
    }),
  ).toThrow();
  expect(() => validateCombatSheet({ ...sheet, fps: 0 })).toThrow();
  for (let i = 0; i < sheet.frames.length; i++) {
    const [u, v, w, h] = combatFrameUV(sheet, i),
      f = sheet.frames[i];
    expect(u).toBeGreaterThan(f.x / sheet.width);
    expect(u + w).toBeLessThan((f.x + f.width) / sheet.width);
    expect(v).toBeGreaterThan(1 - (f.y + f.height) / sheet.height);
    expect(v + h).toBeLessThan(1 - f.y / sheet.height);
  }
});
it("samples independently by elapsed time at different update rates, including authored FPS and speed", () => {
  for (const hz of [30, 60, 120]) {
    const p = new CombatBursts();
    p.spawn("normal", 1, 2, 3, 1.25, { ...sheet, fps: 40 }, 2);
    p.spawn("critical", 1, 2, 3, 1.25, sheet, 1, 0.4);
    for (let i = 0; i < hz / 15; i++) p.step(1 / hz);
    expect(p.frame(p.items[0], 8)).toBe(5);
    expect(p.frame(p.items[1], 8)).toBe(1);
    expect(p.items[0].x).toBe(1);
  }
});
it("presents the final authored frame after catch-up and cleans it up exactly once", () => {
  const p = new CombatBursts();
  p.spawn("death", 0, 1, 2, 1.25, sheet);
  p.step(2);
  const b = p.items[0];
  expect(b.active).toBe(true);
  expect(p.frame(b, 8)).toBe(7);
  p.presented(b);
  p.step(1 / 60);
  expect(b.active).toBe(false);
  p.reset();
  expect(p.items.every((b) => !b.active)).toBe(true);
});
it("protects critical and lethal slots under a full automatic-fire load", () => {
  const p = new CombatBursts();
  for (let i = 0; i < 80; i++) p.spawn("normal", 0, 1, 2, 1.25, sheet);
  expect(p.items.filter((b) => b.active)).toHaveLength(28);
  for (let i = 0; i < 20; i++) p.spawn("critical", 0, 1, 2, 1.25, sheet);
  for (let i = 0; i < 48; i++) p.spawn("death", 0, 1, 2, 1.25, sheet);
  expect(p.items.filter((b) => b.active && b.kind === "death")).toHaveLength(
    48,
  );
  expect(p.spawn("normal", 0, 1, 2, 1.25, sheet)).toBe(false);
  expect(p.spawn("critical", 0, 1, 2, 1.25, sheet)).toBe(false);
  expect(p.spawn("death", 0, 1, 2, 1.25, sheet)).toBe(true);
  expect(p.items).toHaveLength(48);
  expect(combatEffectKind(true, true)).toBe("death");
  expect(combatEffectKind(true, false)).toBe("critical");
  expect(combatEffectKind(false, false)).toBe("normal");
});
it("preserves enemy-relative scale at both resolutions and caps near-eye coverage", () => {
  for (const height of [720, 1080]) {
    const focal = height / (2 * Math.tan(Math.PI / 6));
    for (const [kind, ratio, cap] of [
      ["normal", 0.62, 0.14],
      ["critical", 0.82, 0.18],
      ["death", 0.95, 0.23],
    ] as const) {
      expect(
        combatSpriteWidth(kind, 1.25, 10, focal, height) / 1.25,
      ).toBeCloseTo(ratio);
      expect(
        (combatSpriteWidth(kind, 1.25, 0.1, focal, height) * focal) / 0.1,
      ).toBeLessThanOrEqual(height * cap + 1e-5);
      expect(
        combatSpriteWidth(kind, 1.25, 200, focal, height),
      ).toBeLessThanOrEqual(1.25 * ratio * 1.35);
    }
  }
});
it("bounds local overlap and total bright coverage, prioritizing the first admitted death", () => {
  const c = new CombatCoverage();
  expect(c.admit(0.5, 0.5, 0.2, 0.2, 0.7, "death")).toBe(1);
  expect(c.admit(0.5, 0.5, 0.2, 0.2, 0.7, "critical")).toBeLessThan(0.22);
  expect(c.admit(0.5, 0.5, 0.2, 0.2, 0.7, "normal")).toBeLessThan(0.00001);
  c.reset();
  let area = 0;
  for (let i = 0; i < 48; i++)
    area +=
      c.admit(
        0.1 + ((i % 8) / 8) * 0.8,
        0.1 + (Math.floor(i / 8) / 6) * 0.8,
        0.2,
        0.2,
        0.8,
        "normal",
      ) *
      0.2 *
      0.2 *
      0.8;
  expect(area).toBeLessThanOrEqual(0.080001);
});
