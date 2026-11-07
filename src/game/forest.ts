import { seededRandom, type Solid } from "./math";
import { inMap, isRiver } from "./terrain";
export interface ForestTree {
  x: number;
  z: number;
  height: number;
  width: number;
  shade: number;
}
/** Shared placements keep visible trunks and spawn/navigation obstacles in agreement. */
export const FOREST_TREES: readonly ForestTree[] = (() => {
  const r = seededRandom(8003),
    trees: ForestTree[] = [];
  for (let row = 0; row < 7; row++)
    for (let i = 0; i < 43; i++) {
      const x = (i - 21) * 4 + (r() - 0.5) * 2.2,
        z = -65.5 - row * 8 - r() * 2.5,
        height = 8 + r() * 7 + row * 1.2;
      trees.push({
        x,
        z,
        height,
        width: height * (0.12 + r() * 0.055),
        shade: 0.7 + r() * 0.3,
      });
    }
  for (let i = 0; i < 220; i++) {
    const x = (i % 2 ? 1 : -1) * (31 + r() * 28),
      z = 31 - r() * 106;
    if (isRiver(x, z)) continue;
    const height = 8 + r() * 10;
    trees.push({
      x,
      z,
      height,
      width: height * (0.12 + r() * 0.055),
      shade: 0.7 + r() * 0.3,
    });
  }
  return trees;
})();
export function forestSolids(): Solid[] {
  return FOREST_TREES.filter((t) => inMap(t.x, t.z)).map((t) => ({
    minX: t.x - 0.22,
    maxX: t.x + 0.22,
    minZ: t.z - 0.22,
    maxZ: t.z + 0.22,
    height: t.height * 0.3,
  }));
}
