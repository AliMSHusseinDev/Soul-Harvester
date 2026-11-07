import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { COMBAT_ASSETS } from "./combat-assets";
import { validateCombatSheet } from "./combat-sprites";

it("ships all three original combat animations with valid RGBA atlases and sixteen frames each", () => {
  const config = JSON.parse(
    readFileSync(
      new URL("../../assets/source/combat/import.json", import.meta.url),
      "utf8",
    ),
  );
  expect(config.sheets.find((s) => s.kind === "normal").source).toBe(
    "Yellow Spark.png",
  );
  expect(config.sheets.find((s) => s.kind === "critical").source).toBe(
    "White Particles.png",
  );
  expect(COMBAT_ASSETS.find((s) => s.kind === "normal").source).toBe(
    "Yellow Spark.png",
  );
  expect(COMBAT_ASSETS.find((s) => s.kind === "critical").source).toBe(
    "White Particles.png",
  );
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
