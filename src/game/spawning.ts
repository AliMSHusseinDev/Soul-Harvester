import { Navigation, type Point } from "./navigation";
import { seededRandom } from "./math";
import { SPAWNING } from "./tuning";
export interface SpawnPoint extends Point {
  zone: number;
}
/** Prevalidated reachable forest fringe, stratified across its entire width. */
export class ForestSpawner {
  readonly zones: readonly Point[][];
  readonly counts = new Uint16Array(SPAWNING.zones);
  private random = seededRandom(744);
  constructor(nav: Navigation, bellField: Float32Array) {
    this.zones = Array.from({ length: SPAWNING.zones }, (_, zone) => {
      const width = (SPAWNING.maxX - SPAWNING.minX) / SPAWNING.zones,
        points: Point[] = [];
      for (
        let x = SPAWNING.minX + zone * width + 0.4;
        x < SPAWNING.minX + (zone + 1) * width - 0.25;
        x += SPAWNING.candidateCell
      )
        for (
          let z = SPAWNING.minZ;
          z < SPAWNING.maxZ;
          z += SPAWNING.candidateCell
        ) {
          const i = nav.index(x, z);
          if (
            nav.canStand(x, z, 0.48) &&
            Number.isFinite(bellField[i]) &&
            nav.lineClear({ x, z }, nav.point(i))
          )
            points.push({ x, z });
        }
      return points;
    });
  }
  next(
    enemies: readonly (Point & { active: boolean })[],
  ): SpawnPoint | undefined {
    // Least-used zones first; congested zones defer rather than overlap enemies.
    const order = this.zones
      .map((_, i) => ({ i, score: this.counts[i] + this.random() * 0.4 }))
      .sort((a, b) => a.score - b.score);
    for (const { i } of order) {
      const candidates = this.zones[i];
      if (!candidates.length) continue;
      const offset = Math.floor(this.random() * candidates.length);
      for (let n = 0; n < candidates.length; n++) {
        const p = candidates[(offset + n) % candidates.length];
        if (
          enemies.some(
            (e) =>
              e.active && Math.hypot(e.x - p.x, e.z - p.z) < SPAWNING.spacing,
          )
        )
          continue;
        this.counts[i]++;
        return { ...p, zone: i };
      }
    }
  }
  reset() {
    this.counts.fill(0);
    this.random = seededRandom(744);
  }
}
