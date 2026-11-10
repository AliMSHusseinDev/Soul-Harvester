import type { SplatterImpact } from "./particle-simulation";
import * as THREE from "three";
import { guardTexture } from "./textures";
import { spriteGeometry } from "./sprite-geometry";
import { groundHeight } from "./terrain";
import { ENEMY_TYPES } from "./waves";
import { VFX } from "./tuning";
const DURATION = VFX.remnantDuration;
const smooth = (t: number) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
};
/** Foot-anchored collapse: blood silhouette, blood remnant, then pixel erosion. */
export function remnantPose(age: number) {
  age *= 0.38 / DURATION;
  return {
    height: 1 - 0.62 * smooth((age - 0.045) / 0.27),
    width: 1 - 0.18 * smooth((age - 0.08) / 0.24),
    flash: 1 - smooth((age - 0.085) / 0.045),
    opacity:
      (1 - smooth((age - 0.085) / 0.295)) *
      (1 - 0.35 * smooth((age - 0.085) / 0.06)),
    dissolve: smooth((age - 0.16) / 0.22),
    duration: DURATION,
  };
}
export function remnantReaction(
  age: number,
  scale: number,
  side: number,
  head: boolean,
  seed: number,
) {
  const t = Math.max(0, Math.min(1, age / DURATION));
  return {
    push: 0.12 * scale * smooth(t * 3),
    lean:
      side *
      0.16 *
      Math.sin(Math.PI * t) *
      (0.7 + 0.3 * seed) *
      (head ? 1.15 : 1),
  };
}
export class EnemyRemnants {
  surfaceFloor?: (x: number, z: number, ceiling: number) => number;
  private items = Array.from({ length: 64 }, () => ({
    active: false,
    age: 0,
    serial: 0,
    kind: 0,
    x: 0,
    z: 0,
    scale: 1,
    shown: false,
    dx: 0,
    dz: 0,
    hx: 0.5,
    hy: 0.5,
    seed: 0,
  }));
  private batches: {
    mesh: THREE.InstancedMesh;
    state: THREE.InstancedBufferAttribute;
    count: number;
    impact: THREE.InstancedBufferAttribute;
  }[] = [];
  private dummy = new THREE.Object3D();
  private serial = 0;
  private view = new THREE.Vector3();
  constructor(
    scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
  ) {
    for (let kind = 0; kind < 4; kind++) {
      const map = guardTexture(kind),
        image = map.image as HTMLCanvasElement,
        pixels = image.getContext("2d")!.getImageData(0, 0, 32, 40).data,
        geometry = spriteGeometry(pixels, 32, 40, 1.25, 1.65),
        state = new THREE.InstancedBufferAttribute(new Float32Array(64 * 3), 3),
        impact = new THREE.InstancedBufferAttribute(
          new Float32Array(64 * 4),
          4,
        ),
        material = new THREE.MeshBasicMaterial({
          map,
          transparent: true,
          depthWrite: false,
          alphaTest: 0.015,
          side: THREE.DoubleSide,
          toneMapped: false,
          fog: false,
        });
      geometry.setAttribute("remnantState", state);
      geometry.setAttribute("remnantImpact", impact);
      impact.setUsage(THREE.DynamicDrawUsage);
      state.setUsage(THREE.DynamicDrawUsage);
      const burgundy = { value: new THREE.Color(VFX.lethalColor) };
      material.onBeforeCompile = (shader) => {
        shader.uniforms.uRemnantColor = burgundy;
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            "#include <common>\nattribute vec3 remnantState;attribute vec4 remnantImpact;varying vec4 vImpact; varying vec3 vRemnant;",
          )
          .replace(
            "#include <begin_vertex>",
            "#include <begin_vertex>\nvRemnant=remnantState;vImpact=remnantImpact;",
          );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <common>",
            "#include <common>\nvarying vec3 vRemnant;varying vec4 vImpact;uniform vec3 uRemnantColor;",
          )
          .replace(
            "#include <map_fragment>",
            `#include <map_fragment>
      vec2 cell=floor(vMapUv*vec2(32.,40.));
      float grain=fract(sin(dot(cell,vec2(127.1,311.7))+vImpact.z*19.7)*43758.5453);
      float front=clamp(length((cell/vec2(32.,40.)-vImpact.xy)*vec2(.8,1.)),0.,1.);
      if(vRemnant.z>mix(grain,front,.6))discard;
      float neighbor=min(min(texture2D(map,vMapUv+vec2(1./32.,0.)).a,texture2D(map,vMapUv-vec2(1./32.,0.)).a),min(texture2D(map,vMapUv+vec2(0.,1./40.)).a,texture2D(map,vMapUv-vec2(0.,1./40.)).a));
      float rim=(1.-step(.2,neighbor))*vRemnant.x;
      float crack=(1.-step(.055,abs(sin(dot(cell,vec2(.71,-.93))+vImpact.z*6.))))*vRemnant.x*.25;
      diffuseColor.rgb=mix(uRemnantColor,vec3(.70,.08,.09),max(rim*.65,crack));
      diffuseColor.a*=vRemnant.y;`,
          );
      };
      material.forceSinglePass = true;
      const mesh = new THREE.InstancedMesh(geometry, material, 64);
      mesh.name = `enemy-remnant-${kind}`;
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(mesh);
      this.batches.push({ mesh, state, impact, count: 0 });
    }
  }
  spawn(
    x: number,
    z: number,
    kind: number,
    dx = 0,
    dz = 0,
    impact?: SplatterImpact,
  ) {
    let slot = this.items.find((p) => !p.active);
    if (!slot)
      slot = this.items.reduce((a, b) => (a.serial < b.serial ? a : b));
    Object.assign(slot, {
      active: true,
      age: 0,
      serial: ++this.serial,
      kind,
      x,
      z,
      scale: ENEMY_TYPES[kind].scale,
      dx: dx / (Math.hypot(dx, dz) || 1),
      dz: dz / (Math.hypot(dx, dz) || 1),
      hx: impact
        ? Math.max(
            0,
            Math.min(
              1,
              0.5 +
                ((impact.x - x) * this.camera.matrixWorld.elements[0] +
                  (impact.z - z) * this.camera.matrixWorld.elements[2]) /
                  (1.25 * ENEMY_TYPES[kind].scale),
            ),
          )
        : 0.5,
      hy: impact
        ? Math.max(
            0,
            Math.min(
              1,
              (impact.y - groundHeight(x, z)) /
                (1.65 * ENEMY_TYPES[kind].scale),
            ),
          )
        : 0.5,
      seed: (this.serial * 0.61803398875) % 1,
      shown: false,
    });
  }
  step(dt: number) {
    for (const p of this.items)
      if (p.active) {
        p.age += dt;
        if (p.age >= DURATION * (1 + 0.1 * Math.max(0, p.scale - 1)))
          p.active = false;
      }
  }
  render() {
    for (const b of this.batches) b.count = 0;
    // Keep the original upright billboard orientation even when the player looks down.
    const yaw = Math.atan2(
      this.camera.matrixWorld.elements[8],
      this.camera.matrixWorld.elements[10],
    );
    for (const p of this.items) {
      if (!p.active) continue;
      const age = !p.shown && p.age < 0.18 ? Math.min(0.035, p.age) : p.age,
        pose = remnantPose(age / (1 + 0.1 * Math.max(0, p.scale - 1))),
        floor = Math.max(
          groundHeight(p.x, p.z),
          this.surfaceFloor?.(p.x, p.z, groundHeight(p.x, p.z) + p.scale) ??
            -Infinity,
        ),
        height = 1.65 * p.scale * pose.height;
      this.view
        .set(p.x, floor + height * 0.5, p.z)
        .applyMatrix4(this.camera.matrixWorldInverse);
      if (-this.view.z < 0.3 || -this.view.z > 140) continue;
      const side = p.dx * Math.cos(yaw) - p.dz * Math.sin(yaw);
      const { push, lean } = remnantReaction(
        age,
        p.scale,
        side,
        p.hy > 0.7,
        p.seed,
      );
      const bottom =
        height * 0.5 * Math.abs(Math.cos(lean)) +
        1.25 * p.scale * pose.width * 0.5 * Math.abs(Math.sin(lean));
      this.dummy.position.set(
        p.x + p.dx * push,
        floor + bottom + 0.025,
        p.z + p.dz * push,
      );
      this.dummy.rotation.set(0, yaw, lean);
      this.dummy.scale.set(p.scale * pose.width, p.scale * pose.height, 1);
      this.dummy.updateMatrix();
      const b = this.batches[p.kind],
        i = b.count++;
      b.mesh.setMatrixAt(i, this.dummy.matrix);
      b.state.setXYZ(i, pose.flash, pose.opacity, pose.dissolve);
      b.impact.setXYZW(i, p.hx, p.hy, p.seed, 0);
      p.shown = true;
    }
    for (const b of this.batches) {
      b.mesh.count = b.count;
      b.mesh.instanceMatrix.needsUpdate = true;
      b.state.needsUpdate = b.impact.needsUpdate = true;
    }
  }
  diagnostics() {
    return {
      active: this.items.filter((p) => p.active).length,
      capacity: 64,
      phases: this.items
        .filter((p) => p.active)
        .map((p) => ({ age: p.age, ...remnantPose(p.age) })),
    };
  }
  reset() {
    for (const p of this.items) p.active = false;
    for (const b of this.batches) b.mesh.count = 0;
    this.serial = 0;
  }
}
