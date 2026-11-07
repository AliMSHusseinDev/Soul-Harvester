import { it, expect } from "vitest";
import * as THREE from "three";
import { backdropGeometry, backdropHeight, coniferGeometry } from "./scenery";
import { surfaceUV } from "./surfaces";
import { spriteGeometry } from "./sprite-geometry";
it("keeps decorative mountains outside the play area and the ravine", () => {
  const g = backdropGeometry(),
    p = g.attributes.position,
    ix = g.index!;
  for (let i = 0; i < ix.count; i += 3) {
    const a = ix.getX(i),
      b = ix.getX(i + 1),
      c = ix.getX(i + 2),
      x = (p.getX(a) + p.getX(b) + p.getX(c)) / 3,
      z = (p.getZ(a) + p.getZ(b) + p.getZ(c)) / 3;
    expect(Math.abs(x) < 29 && z > -80 && z < 28).toBe(false);
    expect(z > -18 && z < 6).toBe(false);
  }
  expect(backdropHeight(20, -60)).toBe(0);
  expect(backdropHeight(90, -60)).toBeGreaterThan(25);
  g.dispose();
});
it("gives differently sized stone faces the same world texel scale", () => {
  for (const w of [1, 4, 12]) {
    const g = surfaceUV(new THREE.BoxGeometry(w, 2, 1)),
      p = g.attributes.position,
      uv = g.attributes.uv,
      n = g.attributes.normal;
    for (let i = 0; i < p.count; i++)
      if (n.getZ(i) > 0.9) expect(uv.getX(i)).toBeCloseTo(p.getX(i) / 2);
    g.dispose();
  }
});
it("builds cutout foliage without opaque horizontal caps or degenerate normals", () => {
  const g = coniferGeometry(),
    n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) {
    expect(Math.abs(n.getY(i))).toBeLessThan(0.001);
    expect(Number.isFinite(n.getX(i))).toBe(true);
  }
  g.dispose();
});
it("extrudes only opaque pixel boundaries with a small, consistent depth", () => {
  const pixels = new Uint8ClampedArray(16);
  pixels[3] = 255;
  pixels[7] = 255;
  const g = spriteGeometry(pixels, 2, 2, 2, 2, 0.08),
    p = g.attributes.position;
  // Two front/back quads and six outside pixel edges, with no internal shared wall.
  expect(p.count).toBe(48);
  for (let i = 0; i < p.count; i++)
    expect(Math.abs(p.getZ(i))).toBeCloseTo(0.04);
  expect(g.attributes.uv.count).toBe(p.count);
  expect(g.attributes.color.count).toBe(p.count);
  g.dispose();
});
