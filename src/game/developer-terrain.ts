export interface Brush {
  x: number;
  z: number;
  radius: number;
  height: number;
}
export let terrainBrushes: Brush[] = [];
export function setTerrainBrushes(b: Brush[]) {
  terrainBrushes = b;
}
export function sculptHeight(x: number, z: number) {
  let h = 0;
  for (const b of terrainBrushes) {
    const r = Math.hypot(x - b.x, z - b.z) / b.radius;
    if (r < 1) {
      const t = 1 - r * r;
      h += b.height * t * t * t;
    }
  }
  return h;
}
