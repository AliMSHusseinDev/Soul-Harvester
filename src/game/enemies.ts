import * as THREE from "three";
import { guardTexture } from "./textures";
import type { Battle } from "./battle";
import { groundHeight } from "./terrain";
import { ENEMY_TYPES, ENEMY_CAPACITY } from "./waves";
export class Enemies {
  private meshes: THREE.InstancedMesh[] = [];
  private alpha: Uint8ClampedArray[] = [];
  private dummy = new THREE.Object3D();
  private yaw = 0;
  constructor(
    scene: THREE.Scene,
    private battle: Battle,
  ) {
    for (let k = 0; k < ENEMY_TYPES.length; k++) {
      const texture = guardTexture(k),
        image = texture.image as HTMLCanvasElement;
      this.alpha.push(image.getContext("2d")!.getImageData(0, 0, 32, 40).data);
      const mesh = new THREE.InstancedMesh(
        new THREE.PlaneGeometry(1.25, 1.65),
        new THREE.MeshBasicMaterial({
          map: texture,
          alphaTest: 0.25,
          side: THREE.DoubleSide,
        }),
        ENEMY_CAPACITY,
      );
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.setColorAt(0, new THREE.Color(0xffffff));
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.name = ENEMY_TYPES[k].name;
      scene.add(mesh);
      this.meshes.push(mesh);
    }
  }
  update(time: number, yaw = 0) {
    this.yaw = yaw;
    const counts = [0, 0, 0, 0];
    for (const e of this.battle.enemies) {
      if (!e.active) continue;
      const scale = ENEMY_TYPES[e.kind].scale,
        bob = Math.sin(time * (e.kind === 1 ? 13 : 8) + e.phase) * 0.035;
      this.dummy.position.set(
        e.x,
        groundHeight(e.x, e.z) + 0.825 * scale + bob,
        e.z,
      );
      this.dummy.rotation.set(0, yaw, 0);
      this.dummy.scale.set(scale * (e.windup > 0 ? 1.04 : 1), scale, 1);
      this.dummy.updateMatrix();
      const i = counts[e.kind]++,
        mesh = this.meshes[e.kind];
      mesh.setMatrixAt(i, this.dummy.matrix);
      mesh.setColorAt(i, new THREE.Color(e.windup > 0 ? 0xffac8c : 0xd5ead6));
    }
    for (let k = 0; k < 4; k++) {
      const mesh = this.meshes[k];
      mesh.count = counts[k];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }
  /** Alpha-aware ray/billboard intersection, independent of rendering/culling bounds. */
  raycast(ray: THREE.Ray) {
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)),
      normal = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const denom = normal.dot(ray.direction);
    if (Math.abs(denom) < 1e-6) return [];
    const hits: {
      enemyId: number;
      distance: number;
      point: THREE.Vector3;
      uv: THREE.Vector2;
    }[] = [];
    for (const e of this.battle.alive) {
      const scale = ENEMY_TYPES[e.kind].scale,
        centre = new THREE.Vector3(
          e.x,
          groundHeight(e.x, e.z) + 0.825 * scale,
          e.z,
        ),
        t = normal.dot(centre.clone().sub(ray.origin)) / denom;
      if (t < 0) continue;
      const point = ray.at(t, new THREE.Vector3()),
        local = point.clone().sub(centre),
        u = local.dot(right) / (1.25 * scale) + 0.5,
        v = local.y / (1.65 * scale) + 0.5;
      if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
      const alpha =
        this.alpha[e.kind][
          (Math.min(39, Math.floor((1 - v) * 40)) * 32 + Math.floor(u * 32)) *
            4 +
            3
        ];
      if (alpha < 30) continue;
      hits.push({
        enemyId: e.id,
        distance: t,
        point,
        uv: new THREE.Vector2(u, v),
      });
    }
    return hits.sort((a, b) => a.distance - b.distance);
  }
  get positions() {
    return this.battle.alive.map((e) => [
      e.x,
      groundHeight(e.x, e.z) + 0.825 * ENEMY_TYPES[e.kind].scale,
      e.z,
    ]);
  }
}
