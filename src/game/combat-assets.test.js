import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { COMBAT_ASSETS } from "./combat-assets";
import { validateCombatSheet } from "./combat-sprites";

it("ships all three original combat animations with valid RGBA atlases and sixteen frames each", () => {
  expect(COMBAT_ASSETS.map((s) => s.kind).sort()).toEqual([
    "critical",
    "death",
    "normal",
  ]);
  for (const sheet of COMBAT_ASSETS) {
    expect(() => validateCombatSheet(sheet)).not.toThrow();
    expect(sheet.frames).toHaveLength(16);
    const bytes = readFileSync(
      new URL(`../../public/${sheet.url}`, import.meta.url),
    );
    expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(bytes.readUInt32BE(16)).toBe(sheet.width);
    expect(bytes.readUInt32BE(20)).toBe(sheet.height);
    expect(bytes[25]).toBe(6); // RGBA PNG, not an opaque black-backed RGB export.
    expect(sheet.frames.some((f) => f.coverage > 0.03)).toBe(true);
  }
});
