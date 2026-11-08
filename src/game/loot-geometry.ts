import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { LOOT_FEEL } from "./tuning";
function color(g: THREE.BufferGeometry, hex: number) {
  const p = g.attributes.position,
    values = new Float32Array(p.count * 3),
    c = new THREE.Color(hex);
  for (let i = 0; i < p.count; i++) {
    values[i * 3] = c.r;
    values[i * 3 + 1] = c.g;
    values[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(values, 3));
  return g;
}
function extrude(points: number[][], depth: number) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    steps: 1,
  }).translate(0, 0, -depth / 2);
}
/** Stepped silhouette, raised rim and inset minted diamond, built once for the shared batch. */
export function coinGeometry() {
  const r = LOOT_FEEL.goldRadius,
    outline = [
      [-0.5, -1],
      [0.5, -1],
      [0.5, -0.8],
      [0.8, -0.8],
      [0.8, -0.5],
      [1, -0.5],
      [1, 0.5],
      [0.8, 0.5],
      [0.8, 0.8],
      [0.5, 0.8],
      [0.5, 1],
      [-0.5, 1],
      [-0.5, 0.8],
      [-0.8, 0.8],
      [-0.8, 0.5],
      [-1, 0.5],
      [-1, -0.5],
      [-0.8, -0.5],
      [-0.8, -0.8],
      [-0.5, -0.8],
    ];
  const base = color(
      extrude(
        outline.map(([x, y]) => [x * r, y * r]),
        0.052,
      ),
      0xa96516,
    ),
    rim = color(
      extrude(
        outline.map(([x, y]) => [x * r * 0.88, y * r * 0.88]),
        0.064,
      ),
      0xffc53f,
    ),
    face = color(
      extrude(
        outline.map(([x, y]) => [x * r * 0.66, y * r * 0.66]),
        0.069,
      ),
      0xe7a12a,
    ),
    glyph = color(
      extrude(
        [
          [0, r * 0.46],
          [r * 0.25, 0],
          [0, -r * 0.46],
          [-r * 0.25, 0],
        ],
        0.076,
      ),
      0xffe99c,
    );
  const parts = [base, rim, face, glyph],
    g = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return g;
}
/** Bevelled six-sided soul crystal with a bright central facet and darker border. */
export function crystalGeometry() {
  const w = LOOT_FEEL.xpRadius,
    h = w * 1.9,
    outline = [
      [0, -h],
      [w * 0.7, -h * 0.58],
      [w * 0.7, h * 0.58],
      [0, h],
      [-w * 0.7, h * 0.58],
      [-w * 0.7, -h * 0.58],
    ],
    edge = color(extrude(outline, 0.065), 0x127baf),
    face = color(
      extrude(
        outline.map(([x, y]) => [x * 0.78, y * 0.9]),
        0.08,
      ),
      0x41d8f4,
    ),
    facet = color(
      extrude(
        [
          [-w * 0.2, -h * 0.7],
          [w * 0.17, -h * 0.55],
          [w * 0.17, h * 0.56],
          [-w * 0.2, h * 0.75],
        ],
        0.085,
      ),
      0xc4ffff,
    ),
    parts = [edge, face, facet],
    g = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return g;
}
