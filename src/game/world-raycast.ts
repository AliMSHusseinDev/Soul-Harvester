import { ENVIRONMENT } from "./tuning";
import * as THREE from "three";
export type ImpactSurface = "stone" | "wood" | "earth" | "foliage";
interface Node {
  box: THREE.Box3;
  left: number;
  right: number;
  start: number;
  end: number;
}
/** Median BVH, built once. Both world instances and shared geometry use this index. */
class BoxTree {
  private nodes: Node[] = [];
  private order: number[];
  private stack: Int32Array;
  private point = new THREE.Vector3();
  constructor(boxes: THREE.Box3[]) {
    this.order = boxes.map((_, i) => i);
    const build = (start: number, end: number): number => {
      const box = new THREE.Box3();
      for (let i = start; i < end; i++) box.union(boxes[this.order[i]]);
      const at = this.nodes.length,
        node = { box, left: -1, right: -1, start, end };
      this.nodes.push(node);
      if (end - start > 8) {
        const size = box.getSize(new THREE.Vector3()),
          axis =
            size.x > size.z
              ? size.x > size.y
                ? "x"
                : "y"
              : size.z > size.y
                ? "z"
                : "y";
        const sorted = this.order
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
      return at;
    };
    if (boxes.length) build(0, boxes.length);
    this.stack = new Int32Array(this.nodes.length);
  }
  query(ray: THREE.Ray, limit: () => number, visit: (i: number) => void) {
    let used = 0;
    if (this.nodes.length) this.stack[used++] = 0;
    while (used) {
      const n = this.nodes[this.stack[--used]];
      if (
        !n.box.containsPoint(ray.origin) &&
        (!ray.intersectBox(n.box, this.point) ||
          this.point.distanceToSquared(ray.origin) > limit() ** 2)
      )
        continue;
      if (n.left >= 0) {
        this.stack[used++] = n.left;
        this.stack[used++] = n.right;
      } else for (let i = n.start; i < n.end; i++) visit(this.order[i]);
    }
  }
}
interface GeometryIndex {
  geometry: THREE.BufferGeometry;
  tree: BoxTree;
}
interface Entry {
  terrain: boolean;
  source: GeometryIndex;
  matrix: THREE.Matrix4;
  inverse: THREE.Matrix4;
  normal: THREE.Matrix3;
  inverseLinear: THREE.Matrix3;
  surface: ImpactSurface;
  alpha?: {
    pixels: Uint8ClampedArray;
    width: number;
    height: number;
    cutoff: number;
  };
}
export interface SurfaceHit {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  distance: number;
  surface: ImpactSurface;
}
/** Raycasts the visible terrain/rocks/masonry/trunks, not navigation approximation boxes. */
export class WorldRaycast {
  private entries: Entry[] = [];
  private tree: BoxTree;
  private localRay = new THREE.Ray();
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();
  private c = new THREE.Vector3();
  private localPoint = new THREE.Vector3();
  private point = new THREE.Vector3();
  private hitPoint = new THREE.Vector3();
  private hitNormal = new THREE.Vector3();
  private bary = new THREE.Vector3();
  private normal = new THREE.Vector3();
  private best = Infinity;
  private found: ImpactSurface | null = null;
  triangleTests = 0;
  constructor(root: THREE.Object3D) {
    root.updateMatrixWorld(true);
    const geometries = new Map<THREE.BufferGeometry, GeometryIndex>(),
      bounds: THREE.Box3[] = [];
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || Array.isArray(object.material))
        return;
      const material = object.material;
      if (
        !(material instanceof THREE.MeshStandardMaterial) ||
        !material.map ||
        material.map.name.includes("tuft") ||
        material.map.name.includes("bush") ||
        material.map.name.includes("ivy")
      )
        return;
      const name = material.map.name,
        surface: ImpactSurface = /bark|wood|leather/.test(name)
          ? "wood"
          : /pine|leaves/.test(name)
            ? "foliage"
            : /grass|dirt/.test(name)
              ? "earth"
              : "stone";
      let source = geometries.get(object.geometry);
      if (!source) {
        const g = object.geometry,
          positions = g.attributes.position,
          ix = g.index,
          count = (ix?.count ?? positions.count) / 3,
          boxes: THREE.Box3[] = [];
        for (let i = 0; i < count; i++) {
          const box = new THREE.Box3();
          for (let j = 0; j < 3; j++)
            box.expandByPoint(
              this.point.fromBufferAttribute(
                positions,
                ix ? ix.getX(i * 3 + j) : i * 3 + j,
              ),
            );
          boxes.push(box);
        }
        source = { geometry: g, tree: new BoxTree(boxes) };
        geometries.set(g, source);
        g.computeBoundingBox();
      }
      let alpha: Entry["alpha"];
      const image = material.map.image as HTMLCanvasElement;
      if (material.alphaTest > 0 && image?.getContext) {
        alpha = {
          pixels: image
            .getContext("2d")!
            .getImageData(0, 0, image.width, image.height).data,
          width: image.width,
          height: image.height,
          cutoff: material.alphaTest * 255,
        };
      }
      const instance = new THREE.Matrix4();
      for (
        let i = 0;
        i < (object instanceof THREE.InstancedMesh ? object.count : 1);
        i++
      ) {
        if (object instanceof THREE.InstancedMesh)
          object.getMatrixAt(i, instance);
        else instance.identity();
        const matrix = object.matrixWorld.clone().multiply(instance);
        this.entries.push({
          source,
          terrain: object.name === "Continuous island terrain",
          matrix,
          inverse: matrix.clone().invert(),
          inverseLinear: new THREE.Matrix3().setFromMatrix4(
            matrix.clone().invert(),
          ),
          normal: new THREE.Matrix3().getNormalMatrix(matrix),
          surface,
          alpha,
        });
        bounds.push(source.geometry.boundingBox!.clone().applyMatrix4(matrix));
      }
    });
    this.tree = new BoxTree(bounds);
  }
  private search(ray: THREE.Ray, range: number) {
    this.best = range;
    this.found = null;
    this.triangleTests = 0;
    this.tree.query(
      ray,
      () => this.best,
      (i) => {
        const e = this.entries[i],
          g = e.source.geometry,
          p = g.attributes.position,
          ix = g.index;
        this.localRay.copy(ray).applyMatrix4(e.inverse);
        const metric = this.normal
          .copy(ray.direction)
          .applyMatrix3(e.inverseLinear)
          .length();
        e.source.tree.query(
          this.localRay,
          () => this.best * metric,
          (face) => {
            this.triangleTests++;
            const ai = ix ? ix.getX(face * 3) : face * 3,
              bi = ix ? ix.getX(face * 3 + 1) : face * 3 + 1,
              ci = ix ? ix.getX(face * 3 + 2) : face * 3 + 2;
            this.a.fromBufferAttribute(p, ai);
            this.b.fromBufferAttribute(p, bi);
            this.c.fromBufferAttribute(p, ci);
            if (
              !this.localRay.intersectTriangle(
                this.a,
                this.b,
                this.c,
                false,
                this.localPoint,
              )
            )
              return;
            this.point.copy(this.localPoint).applyMatrix4(e.matrix);
            const distance = this.point.distanceTo(ray.origin);
            if (distance < 0.025 || distance >= this.best) return;
            if (e.alpha && g.attributes.uv) {
              THREE.Triangle.getBarycoord(
                this.localPoint,
                this.a,
                this.b,
                this.c,
                this.bary,
              );
              const uv = g.attributes.uv,
                u =
                  uv.getX(ai) * this.bary.x +
                  uv.getX(bi) * this.bary.y +
                  uv.getX(ci) * this.bary.z,
                v =
                  uv.getY(ai) * this.bary.x +
                  uv.getY(bi) * this.bary.y +
                  uv.getY(ci) * this.bary.z,
                x = Math.max(
                  0,
                  Math.min(e.alpha.width - 1, Math.floor(u * e.alpha.width)),
                ),
                y = Math.max(
                  0,
                  Math.min(
                    e.alpha.height - 1,
                    Math.floor((1 - v) * e.alpha.height),
                  ),
                );
              if (
                e.alpha.pixels[(y * e.alpha.width + x) * 4 + 3] < e.alpha.cutoff
              )
                return;
            }
            this.best = distance;
            this.found = e.surface;
            this.hitPoint.copy(this.point);
            THREE.Triangle.getNormal(this.a, this.b, this.c, this.hitNormal)
              .applyMatrix3(e.normal)
              .normalize();
            if (this.hitNormal.dot(ray.direction) > 0) this.hitNormal.negate();
            if (
              e.terrain &&
              (this.hitPoint.y > ENVIRONMENT.mountainRockHeight ||
                Math.abs(this.hitNormal.y) < ENVIRONMENT.rockSlopeY)
            )
              this.found = "stone";
          },
        );
      },
    );
  }
  hit(ray: THREE.Ray, range: number): SurfaceHit | null {
    this.search(ray, range);
    return this.found
      ? {
          point: this.hitPoint.clone(),
          normal: this.hitNormal.clone(),
          distance: this.best,
          surface: this.found,
        }
      : null;
  }
  occluded(ray: THREE.Ray, range: number) {
    this.search(ray, range);
    return this.found !== null;
  }
  diagnostics() {
    return {
      instances: this.entries.length,
      triangleTests: this.triangleTests,
    };
  }
}
