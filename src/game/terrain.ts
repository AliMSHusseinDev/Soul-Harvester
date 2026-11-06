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
  player: { x: 0, z: 12 },
} as const;
export function isRiver(x: number, z: number) {
  return (
    z > MAP.riverNorth &&
    z < MAP.riverSouth &&
    Math.abs(x) > MAP.bridgeHalfWidth
  );
}
export function groundHeight(x: number, z: number) {
  return isRiver(x, z) ? -9 : 0;
}
export function inMap(x: number, z: number) {
  return x > MAP.minX && x < MAP.maxX && z > MAP.minZ && z < MAP.maxZ;
}
