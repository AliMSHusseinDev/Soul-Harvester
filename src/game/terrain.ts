import { sculptHeight } from "./developer-terrain";
import { MAP_TUNING } from "./tuning";
export const MAP = MAP_TUNING;
export function isRiver(x: number, z: number) {
  return (
    z > MAP.riverNorth &&
    z < MAP.riverSouth &&
    Math.abs(x) > MAP.bridgeHalfWidth
  );
}
/** Quintic Hermite ramp: C2-continuous joins, flat forest and a raised keep. */
export function landHeight(_x: number, z: number) {
  const t = Math.max(0, Math.min(1, (z + 24) / 38));
  return 4 * t * t * t * (t * (t * 6 - 15) + 10) + sculptHeight(_x, z);
}
export function groundHeight(x: number, z: number) {
  return isRiver(x, z) ? -9 : landHeight(x, z);
}
export function inMap(x: number, z: number) {
  return x > MAP.minX && x < MAP.maxX && z > MAP.minZ && z < MAP.maxZ;
}
export function terrainSlope(z: number) {
  return (landHeight(0, z + 0.01) - landHeight(0, z - 0.01)) / 0.02;
}
