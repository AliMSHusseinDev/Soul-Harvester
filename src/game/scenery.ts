import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { landHeight } from "./terrain";
/** Crossed, alpha-cut branches give volume from every angle without opaque cone undersides. */
export function coniferGeometry() {
  const cards = Array.from({ length: 3 }, (_, i) =>
    new THREE.PlaneGeometry(2, 1, 1, 6)
      .translate(0, 0.55, 0)
      .rotateY((i * Math.PI) / 3),
  );
  const g = mergeGeometries(cards)!;
  cards.forEach((c) => c.dispose());
  return g;
}
export function tuftGeometry() {
  const cards = [0, Math.PI / 2].map((a) =>
    new THREE.PlaneGeometry(0.35, 0.35).translate(0, 0.175, 0).rotateY(a),
  );
  const g = mergeGeometries(cards)!;
  cards.forEach((c) => c.dispose());
  return g;
}
/** Decorative valley outside the playable area; physics still uses the existing height field. */
export function backdropHeight(x: number, z: number) {
  const flank = Math.max(0, Math.abs(x) - 34),
    back = Math.max(0, -z - 104);
  return (
    flank *
      (0.65 +
        0.15 * Math.sin(z * 0.075) +
        0.1 * Math.sin(x * 0.13 + z * 0.047)) +
    back * 0.1
  );
}
export function backdropGeometry() {
  const g = new THREE.PlaneGeometry(280, 240, 64, 52)
      .rotateX(-Math.PI / 2)
      .translate(0, 0, -65),
    p = g.attributes.position;
  for (let i = 0; i < p.count; i++)
    p.setY(
      i,
      backdropHeight(p.getX(i), p.getZ(i)) +
        landHeight(p.getX(i), p.getZ(i)) -
        0.1,
    );
  const old = g.index!,
    indices: number[] = [];
  for (let i = 0; i < old.count; i += 3) {
    const a = old.getX(i),
      b = old.getX(i + 1),
      c = old.getX(i + 2),
      x = (p.getX(a) + p.getX(b) + p.getX(c)) / 3,
      z = (p.getZ(a) + p.getZ(b) + p.getZ(c)) / 3;
    if ((Math.abs(x) < 29 && z > -80 && z < 28) || (z > -18 && z < 6)) continue;
    indices.push(a, b, c);
  }
  g.setIndex(indices);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
