import { type Solid } from "./math";
import { inMap, isRiver, MAP } from "./terrain";
export interface Point {
  x: number;
  z: number;
}
/** Binary min-heap makes each shared Dijkstra field O((V+E) log V). */
class MinHeap {
  private items: { id: number; cost: number }[] = [];
  push(id: number, cost: number) {
    const item = { id, cost };
    let i = this.items.length;
    this.items.push(item);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent].cost <= cost) break;
      this.items[i] = this.items[parent];
      i = parent;
    }
    this.items[i] = item;
  }
  pop() {
    if (!this.items.length) return undefined;
    const root = this.items[0],
      last = this.items.pop()!;
    if (this.items.length) {
      let i = 0;
      while (i * 2 + 1 < this.items.length) {
        let child = i * 2 + 1;
        if (
          child + 1 < this.items.length &&
          this.items[child + 1].cost < this.items[child].cost
        )
          child++;
        if (this.items[child].cost >= last.cost) break;
        this.items[i] = this.items[child];
        i = child;
      }
      this.items[i] = last;
    }
    return root;
  }
}
export class Navigation {
  readonly cell = 1.25;
  readonly width = Math.ceil((MAP.maxX - MAP.minX) / this.cell);
  readonly height = Math.ceil((MAP.maxZ - MAP.minZ) / this.cell);
  readonly blocked = new Uint8Array(this.width * this.height);
  private links: { id: number; cost: number }[][];
  constructor(private readonly solids: readonly Solid[]) {
    for (let i = 0; i < this.blocked.length; i++) {
      const p = this.point(i);
      this.blocked[i] = Number(
        !inMap(p.x, p.z) ||
          isRiver(p.x, p.z) ||
          solids.some(
            (b) =>
              p.x > b.minX - 0.4 &&
              p.x < b.maxX + 0.4 &&
              p.z > b.minZ - 0.4 &&
              p.z < b.maxZ + 0.4,
          ),
      );
    }
    this.links = Array.from({ length: this.blocked.length }, (_, i) =>
      this.buildNeighbors(i),
    );
  }
  index(x: number, z: number) {
    const col = Math.floor((x - MAP.minX) / this.cell),
      row = Math.floor((z - MAP.minZ) / this.cell);
    return col < 0 || col >= this.width || row < 0 || row >= this.height
      ? -1
      : row * this.width + col;
  }
  point(i: number): Point {
    return {
      x: MAP.minX + ((i % this.width) + 0.5) * this.cell,
      z: MAP.minZ + (Math.floor(i / this.width) + 0.5) * this.cell,
    };
  }
  walkable(x: number, z: number) {
    const i = this.index(x, z);
    return i >= 0 && !this.blocked[i];
  }
  canStand(x: number, z: number, radius = 0.34) {
    return (
      this.walkable(x, z) &&
      !this.solids.some((s) => {
        const dx = x - Math.max(s.minX, Math.min(x, s.maxX)),
          dz = z - Math.max(s.minZ, Math.min(z, s.maxZ));
        return dx * dx + dz * dz < radius * radius;
      })
    );
  }
  neighbors(i: number) {
    return this.links[i];
  }
  private buildNeighbors(i: number) {
    const result: { id: number; cost: number }[] = [];
    const x = i % this.width,
      z = Math.floor(i / this.width);
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = x + dx,
          nz = z + dz;
        if (nx < 0 || nx >= this.width || nz < 0 || nz >= this.height) continue;
        const id = nz * this.width + nx;
        if (this.blocked[id]) continue;
        if (
          dx &&
          dz &&
          (this.blocked[z * this.width + nx] ||
            this.blocked[nz * this.width + x])
        )
          continue;
        result.push({ id, cost: dx && dz ? Math.SQRT2 : 1 });
      }
    return result;
  }
  field(target: Point) {
    const distances = new Float32Array(this.blocked.length);
    distances.fill(Infinity);
    let goal = this.index(target.x, target.z);
    if (goal < 0) return distances;
    if (this.blocked[goal]) {
      let best = Infinity;
      for (let i = 0; i < this.blocked.length; i++)
        if (!this.blocked[i]) {
          const p = this.point(i),
            d = Math.hypot(p.x - target.x, p.z - target.z);
          if (d < best) {
            best = d;
            goal = i;
          }
        }
    }
    const queue = new MinHeap();
    distances[goal] = 0;
    queue.push(goal, 0);
    for (let node = queue.pop(); node; node = queue.pop()) {
      if (node.cost > distances[node.id] + 0.0001) continue;
      for (const n of this.neighbors(node.id)) {
        const cost = node.cost + n.cost;
        if (cost < distances[n.id]) {
          distances[n.id] = cost;
          queue.push(n.id, cost);
        }
      }
    }
    return distances;
  }
  steer(from: Point, target: Point, field: Float32Array): Point {
    const i = this.index(from.x, from.z);
    if (i < 0) return { x: 0, z: 0 };
    let next = i,
      min = field[i];
    for (const n of this.neighbors(i))
      if (field[n.id] < min) {
        min = field[n.id];
        next = n.id;
      }
    if (!Number.isFinite(min)) return { x: 0, z: 0 };
    const p = next === i ? target : this.point(next);
    const dx = p.x - from.x,
      dz = p.z - from.z,
      d = Math.hypot(dx, dz);
    return d > 0.05 ? { x: dx / d, z: dz / d } : { x: 0, z: 0 };
  }
  lineClear(a: Point, b: Point) {
    // Visibility uses exact geometry, not the extra clearance reserved for pathfinding.
    const steps = Math.ceil(
      Math.hypot(a.x - b.x, a.z - b.z) / (this.cell * 0.35),
    );
    for (let i = 0; i <= steps; i++) {
      const t = steps ? i / steps : 0,
        x = a.x + (b.x - a.x) * t,
        z = a.z + (b.z - a.z) * t;
      if (
        !inMap(x, z) ||
        this.solids.some(
          (s) =>
            s.height - (s.base ?? 0) > 1 &&
            x > s.minX &&
            x < s.maxX &&
            z > s.minZ &&
            z < s.maxZ,
        )
      )
        return false;
    }
    return true;
  }
}
/** Rebuilt once per simulation step, O(N) insertion and local separation queries. */
export class SpatialGrid<T extends Point> {
  private buckets = new Map<string, T[]>();
  constructor(private size = 2) {}
  clear() {
    for (const bucket of this.buckets.values()) bucket.length = 0;
  }
  add(p: T) {
    const k = `${Math.floor(p.x / this.size)},${Math.floor(p.z / this.size)}`;
    const b = this.buckets.get(k);
    if (b) b.push(p);
    else this.buckets.set(k, [p]);
  }
  private result: T[] = [];
  near(p: Point) {
    this.result.length = 0;
    const x = Math.floor(p.x / this.size),
      z = Math.floor(p.z / this.size);
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        const bucket = this.buckets.get(`${x + dx},${z + dz}`);
        if (bucket) for (const item of bucket) this.result.push(item);
      }
    return this.result;
  }
}
