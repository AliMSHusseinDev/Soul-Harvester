export const MAP = {
  minX: -27,
  maxX: 27,
  minZ: -67,
  maxZ: 26,
  riverNorth: -14,
  riverSouth: 2,
  bridgeHalfWidth: 3.3,
  spawn: { x: 0, z: -53 },
  bell: { x: 0, z: 19 },
  player: { x: 0, z: 14 },
} as const;
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
  return 4 * t * t * t * (t * (t * 6 - 15) + 10);
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
