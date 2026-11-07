import * as THREE from "three";
interface Node {
  box: THREE.Box3;
  left: number;
  right: number;
  start: number;
  end: number;
}
/** Static AABB BVH shared by hit sprites and text. Queries allocate no objects. */
export class WorldVisibility {
  private nodes: Node[] = [];
  private boxes: readonly THREE.Box3[] = [];
  private order: number[] = [];
  private stack = new Int32Array(0);
  private ray = new THREE.Ray();
  private direction = new THREE.Vector3();
  private point = new THREE.Vector3();
  constructor(
    boxes: readonly THREE.Box3[],
    private floor?: (x: number, z: number) => number,
  ) {
    this.rebuild(boxes);
  }
  rebuild(boxes: readonly THREE.Box3[]) {
    this.boxes = boxes;
    this.nodes = [];
    this.order = boxes.map((_, i) => i);
    const build = (start: number, end: number): number => {
      const box = new THREE.Box3();
      for (let i = start; i < end; i++) box.union(boxes[this.order[i]]);
      const index = this.nodes.length,
        node: Node = { box, left: -1, right: -1, start, end };
      this.nodes.push(node);
      if (end - start > 6) {
        const size = box.getSize(new THREE.Vector3()),
          axis =
            size.x > size.z
              ? size.x > size.y
                ? "x"
                : "y"
              : size.z > size.y
                ? "z"
                : "y",
          sorted = this.order
            .slice(start, end)
            .sort(
              (a, b) =>
                boxes[a].min[axis] +
                boxes[a].max[axis] -
                boxes[b].min[axis] -
                boxes[b].max[axis],
            );
        for (let i = 0; i < sorted.length; i++)
          this.order[start + i] = sorted[i];
        const mid = (start + end) >>> 1;
        node.left = build(start, mid);
        node.right = build(mid, end);
      }
      return index;
    };
    if (boxes.length) build(0, boxes.length);
    this.stack = new Int32Array(this.nodes.length);
  }
  occluded(from: THREE.Vector3, to: THREE.Vector3) {
    this.direction.copy(to).sub(from);
    const distance = this.direction.length();
    if (distance < 0.15) return false;
    const limit = (distance - 0.08) ** 2;
    this.ray.set(from, this.direction.multiplyScalar(1 / distance));
    let used = 0;
    if (this.nodes.length) this.stack[used++] = 0;
    while (used) {
      const n = this.nodes[this.stack[--used]];
      if (
        !n.box.containsPoint(from) &&
        (!this.ray.intersectBox(n.box, this.point) ||
          this.point.distanceToSquared(from) > limit)
      )
        continue;
      if (n.left >= 0) {
        this.stack[used++] = n.left;
        this.stack[used++] = n.right;
        continue;
      }
      for (let i = n.start; i < n.end; i++) {
        const box = this.boxes[this.order[i]];
        if (
          box.containsPoint(from) ||
          (this.ray.intersectBox(box, this.point) &&
            this.point.distanceToSquared(from) < limit)
        )
          return true;
      }
    }
    if (this.floor)
      for (let i = 1; i < 16; i++) {
        const t = i / 16,
          x = from.x + (to.x - from.x) * t,
          z = from.z + (to.z - from.z) * t,
          y = from.y + (to.y - from.y) * t;
        if (y < this.floor(x, z) + 0.025) return true;
      }
    return false;
  }
}
