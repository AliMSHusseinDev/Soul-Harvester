import * as THREE from "three";
import { guardTexture } from "./textures";
import { spriteGeometry } from "./sprite-geometry";
import { groundHeight } from "./terrain";
import { ENEMY_TYPES } from "./waves";
const DURATION = 0.38;
const smooth = (t: number) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
};
/** Foot-anchored collapse: white silhouette, burgundy remnant, then pixel erosion. */
export function remnantPose(age: number) {
  return {
    height: 1 - 0.62 * smooth((age - 0.045) / 0.27),
    width: 1 - 0.18 * smooth((age - 0.08) / 0.24),
    white: 1 - smooth((age - 0.085) / 0.045),
    opacity:
      (1 - smooth((age - 0.085) / 0.295)) *
      (1 - 0.35 * smooth((age - 0.085) / 0.06)),
    dissolve: smooth((age - 0.16) / 0.22),
    duration: DURATION,
  };
}
export class EnemyRemnants {
  private items = Array.from({ length: 64 }, () => ({
    active: false,
    age: 0,
    serial: 0,
    kind: 0,
    x: 0,
    z: 0,
    scale: 1,
    shown: false,
  }));
  private batches: {
    mesh: THREE.InstancedMesh;
    state: THREE.InstancedBufferAttribute;
    count: number;
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
      state.setUsage(THREE.DynamicDrawUsage);
      const burgundy = { value: new THREE.Color(0x732b40) };
      material.onBeforeCompile = (shader) => {
        shader.uniforms.uRemnantColor = burgundy;
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            "#include <common>\nattribute vec3 remnantState; varying vec3 vRemnant;",
          )
          .replace(
            "#include <begin_vertex>",
            "#include <begin_vertex>\nvRemnant=remnantState;",
          );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <common>",
            "#include <common>\nvarying vec3 vRemnant;uniform vec3 uRemnantColor;",
          )
          .replace(
            "#include <map_fragment>",
            `#include <map_fragment>
      vec2 cell=floor(vMapUv*vec2(32.,40.));
      float grain=fract(sin(dot(cell,vec2(127.1,311.7)))*43758.5453);
      if(vRemnant.z>grain)discard;
      diffuseColor.rgb=mix(uRemnantColor,vec3(1.),vRemnant.x);
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
      this.batches.push({ mesh, state, count: 0 });
    }
  }
  spawn(x: number, z: number, kind: number) {
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
      shown: false,
    });
  }
  step(dt: number) {
    for (const p of this.items)
      if (p.active) {
        p.age += dt;
        if (p.age >= DURATION) p.active = false;
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
        pose = remnantPose(age),
        floor = groundHeight(p.x, p.z),
        height = 1.65 * p.scale * pose.height;
      this.view
        .set(p.x, floor + height * 0.5, p.z)
        .applyMatrix4(this.camera.matrixWorldInverse);
      if (-this.view.z < 0.3 || -this.view.z > 140) continue;
      this.dummy.position.set(p.x, floor + height * 0.5 + 0.025, p.z);
      this.dummy.rotation.set(0, yaw, 0);
      this.dummy.scale.set(p.scale * pose.width, p.scale * pose.height, 1);
      this.dummy.updateMatrix();
      const b = this.batches[p.kind],
        i = b.count++;
      b.mesh.setMatrixAt(i, this.dummy.matrix);
      b.state.setXYZ(i, pose.white, pose.opacity, pose.dissolve);
      p.shown = true;
    }
    for (const b of this.batches) {
      b.mesh.count = b.count;
      b.mesh.instanceMatrix.needsUpdate = true;
      b.state.needsUpdate = true;
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
