import { it, expect } from "vitest";
import * as THREE from "three";
import { backdropGeometry, backdropHeight, coniferGeometry } from "./scenery";
import {
  islandHeight,
  islandSurfaceHeight,
  ISLAND_BOUNDS,
  OCEAN_Y,
} from "./island";
import { landHeight } from "./terrain";
import { surfaceUV } from "./surfaces";
import { spriteGeometry } from "./sprite-geometry";
it("builds a continuous island with no internal boundary edges, floating ridges or deleted river strip", () => {
  const g = backdropGeometry(),
    p = g.attributes.position,
    ix = g.index!,
    edges = new Map<string, number>();
  for (let i = 0; i < ix.count; i += 3) {
    const a = ix.getX(i),
      b = ix.getX(i + 1),
      c = ix.getX(i + 2);
    for (const [u, v] of [
      [a, b],
      [b, c],
      [c, a],
    ]) {
      const k = u < v ? `${u}:${v}` : `${v}:${u}`;
      edges.set(k, (edges.get(k) ?? 0) + 1);
    }
  }
  for (const [key, count] of edges)
    if (count === 1) {
      const [a, b] = key.split(":").map(Number);
      const exterior = (axis: "x" | "z", min: number, max: number) => {
        const av = axis === "x" ? p.getX(a) : p.getZ(a),
          bv = axis === "x" ? p.getX(b) : p.getZ(b);
        return av === bv && (av === min || av === max);
      };
      expect(
        exterior("x", ISLAND_BOUNDS.minX, ISLAND_BOUNDS.maxX) ||
          exterior("z", ISLAND_BOUNDS.minZ, ISLAND_BOUNDS.maxZ),
      ).toBe(true);
    }
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      z = p.getZ(i);
    expect(Number.isFinite(g.attributes.normal.getY(i))).toBe(true);
    if (Math.abs(x) < 27 && z >= -66 && z <= 26 && (z <= -14 || z >= 2))
      expect(p.getY(i)).toBeCloseTo(landHeight(x, z), 4);
  }
  expect(backdropHeight(20, -60)).toBe(0);
  expect(backdropHeight(90, -60)).toBeGreaterThan(25);
  expect(islandHeight(210, 0)).toBeLessThan(OCEAN_Y);
  expect(islandHeight(18, -6)).toBeLessThan(OCEAN_Y);
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

it("anchors trees to the rendered mountain triangles between coarse grid vertices", () => {
  const geometry = backdropGeometry(),
    mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
    );
  mesh.updateMatrixWorld();
  for (const [x, z] of [
    [49.3, -54.7],
    [83.1, -116.3],
    [-67.2, 14.3],
    [18.1, 18.3],
  ]) {
    const ray = new THREE.Raycaster(
      new THREE.Vector3(x, 100, z),
      new THREE.Vector3(0, -1, 0),
    );
    expect(islandSurfaceHeight(x, z)).toBeCloseTo(
      ray.intersectObject(mesh)[0].point.y,
      4,
    );
  }
  geometry.dispose();
});
