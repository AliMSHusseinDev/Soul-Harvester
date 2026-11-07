import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { landHeight } from "./terrain";
import { islandHeight, islandGeometry } from "./island";
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
/** Tree placement and visual terrain share the same uninterrupted island field. */
export const backdropHeight = (x: number, z: number) =>
  islandHeight(x, z) - landHeight(x, z);
export const backdropGeometry = islandGeometry;
