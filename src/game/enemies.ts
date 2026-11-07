import * as THREE from "three";
import { guardTexture, guardAtlas, GUARD_FRAMES } from "./textures";
import type { Battle, Enemy } from "./battle";
import { groundHeight } from "./terrain";
import { ENEMY_TYPES, ENEMY_CAPACITY } from "./waves";
import { COMBAT_FEEL } from "./tuning";
import { spriteGeometry } from "./sprite-geometry";
function pose(e: Enemy, time: number) {
  const scale = ENEMY_TYPES[e.kind].scale,
    bob =
      Math.sin((e.kind === 3 ? time * 4 : e.gait) + e.phase) *
      (e.kind === 3 ? 0.065 : 0.025),
    reaction = Math.sin((e.reaction / COMBAT_FEEL.reactionDuration) * Math.PI),
    emergence = Math.min(1, e.spawnAge / 0.35);
  return {
    y: groundHeight(e.x, e.z) + 0.825 * scale + bob - (1 - emergence) * 0.4,
    sx: scale * (e.windup > 0 ? 1.04 : 1) * (1 + reaction * 0.045),
    sy: scale * (1 - reaction * 0.035),
    roll: reaction * Math.sin(e.phase) * 0.1,
    emergence,
  };
}
export class Enemies {
  private meshes: THREE.InstancedMesh[] = [];
  private alpha: Uint8ClampedArray[] = [];
  private dummy = new THREE.Object3D();
  private yaw = 0;
  private tint = new THREE.Color();
  private flashes: THREE.InstancedBufferAttribute[] = [];
  private time = 0;
  private flashing = 0;
  private frames: THREE.InstancedBufferAttribute[] = [];
  private walking = 0;
  private renderedHits = new Float64Array(ENEMY_CAPACITY);
  constructor(
    scene: THREE.Scene,
    private battle: Battle,
  ) {
    for (let k = 0; k < ENEMY_TYPES.length; k++) {
      const texture = guardAtlas(k),
        image = guardTexture(k).image as HTMLCanvasElement;
      this.alpha.push(image.getContext("2d")!.getImageData(0, 0, 32, 40).data);
      const geometry = spriteGeometry(this.alpha[k], 32, 40, 1.25, 1.65),
        flash = new THREE.InstancedBufferAttribute(
          new Float32Array(ENEMY_CAPACITY),
          1,
        ),
        material = new THREE.MeshBasicMaterial({
          map: texture,
          vertexColors: true,
          alphaTest: 0.25,
          side: THREE.DoubleSide,
        });
      flash.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute("hitFlash", flash);
      const frame = new THREE.InstancedBufferAttribute(
        new Float32Array(ENEMY_CAPACITY),
        1,
      );
      frame.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute("spriteFrame", frame);
      this.frames.push(frame);
      this.flashes.push(flash);
      // Mix after texture sampling: white flash respects the sprite's alpha and shading detail.
      material.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            "#include <common>\nattribute float hitFlash; attribute float spriteFrame; varying float vHitFlash;",
          )
          .replace(
            "#include <begin_vertex>",
            "#include <begin_vertex>\nvHitFlash = hitFlash;",
          );
        shader.vertexShader = shader.vertexShader.replace(
          "#include <uv_vertex>",
          `#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv.x=(vMapUv.x+spriteFrame)/${GUARD_FRAMES.toFixed(1)};\n#endif`,
        );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <common>",
            "#include <common>\nvarying float vHitFlash;",
          )
          .replace(
            "#include <color_fragment>",
            `#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb,vec3(1.),vHitFlash * ${COMBAT_FEEL.flashStrength});`,
          );
      };
      const mesh = new THREE.InstancedMesh(geometry, material, ENEMY_CAPACITY);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.setColorAt(0, new THREE.Color(0xffffff));
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.name = ENEMY_TYPES[k].name;
      scene.add(mesh);
      this.meshes.push(mesh);
    }
  }
  update(time: number, yaw = 0, alpha = 1) {
    this.yaw = yaw;
    this.time = time;
    const counts = [0, 0, 0, 0];
    this.flashing = 0;
    this.walking = 0;
    for (const e of this.battle.enemies) {
      if (!e.active) {
        this.renderedHits[e.id] = 0;
        continue;
      }
      const p = pose(e, time);
      const x = e.previousX + (e.x - e.previousX) * alpha,
        z = e.previousZ + (e.z - e.previousZ) * alpha;
      this.dummy.position.set(
        x,
        p.y + groundHeight(x, z) - groundHeight(e.x, e.z),
        z,
      );
      this.dummy.rotation.set(0, yaw, p.roll);
      this.dummy.scale.set(p.sx, p.sy, 1);
      this.dummy.updateMatrix();
      const i = counts[e.kind]++,
        mesh = this.meshes[e.kind];
      mesh.setMatrixAt(i, this.dummy.matrix);
      this.tint
        .set(e.windup > 0 ? 0xffb59a : 0xe3f1e3)
        .multiplyScalar(0.55 + p.emergence * 0.45);
      mesh.setColorAt(i, this.tint);
      // A short flash must survive at least one rendered frame after simulation catch-up.
      const pending =
          e.damageStamp > 0 && e.damageStamp !== this.renderedHits[e.id],
        flash = Math.max(
          e.hitFlash / COMBAT_FEEL.flashDuration,
          pending ? 0.9 : 0,
        );
      const decay = Math.min(1, flash);
      this.flashes[e.kind].setX(
        i,
        decay *
          decay *
          (3 - 2 * decay) *
          (e.hitCritical ? 1 / COMBAT_FEEL.flashStrength : 1),
      );
      this.renderedHits[e.id] = e.damageStamp;
      const walking = Math.hypot(e.vx, e.vz) > 0.2;
      this.frames[e.kind].setX(
        i,
        e.windup > 0 ? 3 : walking ? 1 + (Math.floor(e.gait / Math.PI) % 2) : 0,
      );
      if (walking) this.walking++;
      if (flash > 0) this.flashing++;
    }
    for (let k = 0; k < 4; k++) {
      const mesh = this.meshes[k];
      mesh.count = counts[k];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.flashes[k].needsUpdate = true;
      this.frames[k].needsUpdate = true;
    }
  }
  /** Alpha-aware ray/billboard intersection, independent of rendering/culling bounds. */
  raycast(ray: THREE.Ray, time = this.time, yaw = this.yaw) {
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)),
      normal = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const denom = normal.dot(ray.direction);
    if (Math.abs(denom) < 1e-6) return [];
    const hits: {
      enemyId: number;
      distance: number;
      point: THREE.Vector3;
      uv: THREE.Vector2;
      normal: THREE.Vector3;
    }[] = [];
    for (const e of this.battle.enemies) {
      if (!e.active) continue;
      const p = pose(e, time),
        centre = new THREE.Vector3(e.x, p.y, e.z).addScaledVector(normal, 0.04),
        t = normal.dot(centre.clone().sub(ray.origin)) / denom;
      if (t < 0) continue;
      const point = ray.at(t, new THREE.Vector3()),
        local = point.clone().sub(centre),
        lx = local.dot(right),
        ly = local.y,
        cos = Math.cos(p.roll),
        sin = Math.sin(p.roll),
        u = (lx * cos + ly * sin) / (1.25 * p.sx) + 0.5,
        v = (-lx * sin + ly * cos) / (1.65 * p.sy) + 0.5;
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
        normal: normal.clone().multiplyScalar(denom < 0 ? 1 : -1),
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
  diagnostics() {
    return {
      batches: this.meshes.map((m) => m.count),
      flashing: this.flashing,
      walking: this.walking,
      frames: GUARD_FRAMES,
    };
  }
}
