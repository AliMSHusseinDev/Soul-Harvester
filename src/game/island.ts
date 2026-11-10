import { sculptHeight } from "./developer-terrain";
import * as THREE from "three";
import { landHeight } from "./terrain";
export const OCEAN_Y = -5.8;
export const ISLAND_BOUNDS = { minX: -230, maxX: 230, minZ: -300, maxZ: 200 };
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** A complete height field: no deleted triangles, disconnected mountain sheets or open seams. */
export function islandHeight(x: number, z: number) {
  const base = landHeight(x, z) - sculptHeight(x, z),
    ax = Math.abs(x);
  const ridges =
    smooth(34, 64, ax) *
      Math.exp(-(((ax - 92) / 52) ** 2)) *
      (36 +
        14 * Math.sin(z * 0.034 + x * 0.025) ** 2 +
        12 * Math.sin(z * 0.067 - x * 0.031) ** 2) +
    smooth(95, 135, -z) *
      Math.exp(-(((z + 160) / 52) ** 2)) *
      (18 + 14 * Math.sin(x * 0.043) ** 2);
  const radius = Math.hypot(
    x / (154 + 8 * Math.sin(z * 0.024)),
    (z + 36) / 205,
  );
  let y =
    (base + ridges) * (1 - smooth(0.72, 1.02, radius)) -
    12 * smooth(0.72, 1.02, radius);
  // Carve a closed riverbed with sloping banks. Its influence closes before the distant ridges.
  const center = -6 + Math.sign(x) * 12 * smooth(32, 95, ax),
    half = 8;
  const depth =
    smooth(0, 3.5, half - Math.abs(z - center)) * (1 - smooth(38, 92, ax));
  y = y * (1 - depth) + -10.5 * depth;
  return y + sculptHeight(x, z);
}
const axis = (min: number, max: number, fineMin: number, fineMax: number) => {
  const a: number[] = [];
  for (let n = min; n <= max; n += 2)
    if ((n >= fineMin && n <= fineMax) || (n - min) % 6 === 0 || n === max)
      a.push(n);
  return a;
};
const ISLAND_XS = axis(-230, 230, -40, 40),
  ISLAND_ZS = axis(-300, 200, -80, 30);
/** Barycentric height of the actual rendered triangles, including distant coarse cells. */
export function islandSurfaceHeight(x: number, z: number) {
  const cell = (values: number[], n: number) => {
    let lo = 0,
      hi = values.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >>> 1;
      if (values[mid] <= n) lo = mid;
      else hi = mid;
    }
    return lo;
  };
  const i = cell(ISLAND_XS, x),
    j = cell(ISLAND_ZS, z),
    x0 = ISLAND_XS[i],
    x1 = ISLAND_XS[i + 1],
    z0 = ISLAND_ZS[j],
    z1 = ISLAND_ZS[j + 1],
    u = (x - x0) / (x1 - x0),
    v = (z - z0) / (z1 - z0),
    a = islandHeight(x0, z0),
    b = islandHeight(x1, z0),
    c = islandHeight(x0, z1),
    d = islandHeight(x1, z1);
  return u + v <= 1
    ? a * (1 - u - v) + b * u + c * v
    : b * (1 - v) + c * (1 - u) + d * (u + v - 1);
}
export function islandGeometry() {
  const xs = ISLAND_XS,
    zs = ISLAND_ZS,
    positions: number[] = [],
    uvs: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const grass = new THREE.Color(0xc2d4b0),
    rock = new THREE.Color(0x687f72),
    shore = new THREE.Color(0x809983),
    tint = new THREE.Color();
  for (const z of zs)
    for (const x of xs) {
      const y = islandHeight(x, z);
      positions.push(x, y, z);
      uvs.push(x / 2, z / 2);
      tint
        .copy(grass)
        .lerp(
          rock,
          smooth(28, 68, Math.abs(x)) * 0.7 + smooth(90, 155, -z) * 0.25,
        )
        .lerp(shore, 1 - smooth(-5, 0, y));
      colors.push(tint.r, tint.g, tint.b);
    }
  for (let j = 0; j < zs.length - 1; j++)
    for (let i = 0; i < xs.length - 1; i++) {
      const a = j * xs.length + i,
        b = a + 1,
        c = a + xs.length,
        d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
