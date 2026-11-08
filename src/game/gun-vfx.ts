import * as THREE from "three";
import { BarrelSmoke, type Vec3 } from "./ballistics";
import { particleMaterial } from "./procedural-vfx";
import { fadingMaterial } from "./vfx-material";
export class GunVFX {
  readonly smoke = new BarrelSmoke();
  private puffs: THREE.InstancedMesh;
  private core: THREE.InstancedMesh;
  private halo: THREE.InstancedMesh;
  private smokeAlpha = new THREE.InstancedBufferAttribute(
    new Float32Array(96 * 4),
    4,
  );
  private tracerAlpha = new THREE.InstancedBufferAttribute(
    new Float32Array(32),
    1,
  );
  private traces = Array.from({ length: 32 }, () => ({
    start: new THREE.Vector3(),
    direction: new THREE.Vector3(),
    distance: 0,
    age: 0,
    life: 0,
    seen: true,
  }));
  private dummy = new THREE.Object3D();
  private along = new THREE.Vector3();
  private toward = new THREE.Vector3();
  private right = new THREE.Vector3();
  private normal = new THREE.Vector3();
  private basis = new THREE.Matrix4();
  private height = 1080;
  constructor(
    scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
  ) {
    const sg = new THREE.PlaneGeometry(1, 1),
      smokeColor = new THREE.InstancedBufferAttribute(
        new Float32Array(96 * 3),
        3,
      ),
      tint = new THREE.Color(0xa6bbb6);
    for (let i = 0; i < 96; i++) smokeColor.setXYZ(i, tint.r, tint.g, tint.b);
    sg.setAttribute("effectData", this.smokeAlpha);
    sg.setAttribute("effectColor", smokeColor);
    this.puffs = new THREE.InstancedMesh(sg, particleMaterial(), 96);
    const white = new THREE.Color(0xffffff);
    for (let i = 0; i < 96; i++) this.puffs.setColorAt(i, white);
    const tg = new THREE.PlaneGeometry(1, 1);
    tg.setAttribute("vfxOpacity", this.tracerAlpha);
    const core = fadingMaterial(false),
      halo = fadingMaterial(false);
    core.color.set(0xfff3cc);
    halo.color.set(0xffb565);
    core.opacity = 0.9;
    halo.opacity = 0.18;
    this.core = new THREE.InstancedMesh(tg, core, 32);
    this.halo = new THREE.InstancedMesh(tg, halo, 32);
    this.smokeAlpha.setUsage(THREE.DynamicDrawUsage);
    this.tracerAlpha.setUsage(THREE.DynamicDrawUsage);
    for (const mesh of [this.puffs, this.core, this.halo]) {
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(mesh);
    }
  }
  resize(height: number) {
    this.height = height;
  }
  shot(
    start: THREE.Vector3,
    end: THREE.Vector3,
    movement: Vec3,
    tracer: boolean,
  ) {
    this.along.copy(end).sub(start).normalize();
    this.smoke.shot(start, this.along, movement);
    if (!tracer) return;
    const t = this.traces.find((t) => t.life <= 0 && t.seen);
    if (!t) return;
    t.start.copy(start);
    t.direction.copy(this.along);
    t.distance = start.distanceTo(end);
    t.age = 0;
    t.life = (t.distance + 3) / 420;
    t.seen = false;
  }
  step(
    dt: number,
    time: number,
    muzzle: Vec3,
    direction: Vec3,
    velocity: Vec3,
  ) {
    this.smoke.update(dt, time, muzzle, direction, velocity);
    for (const t of this.traces)
      if (t.life > 0) {
        t.age += dt;
        t.life -= dt;
      }
  }
  render() {
    let count = 0;
    for (const p of this.smoke.items)
      if (p.life > 0) {
        const age = 1 - p.life / p.max,
          alpha = Math.min(1, age * 12) * Math.pow(1 - age, 1.4) * 0.22;
        this.dummy.position.set(p.x, p.y, p.z);
        this.dummy.quaternion.copy(this.camera.quaternion);
        this.dummy.rotateZ(p.phase + age * 0.7);
        this.dummy.scale.setScalar(p.size * (1 + age * 4));
        this.dummy.updateMatrix();
        this.puffs.setMatrixAt(count, this.dummy.matrix);
        this.smokeAlpha.setXYZW(count++, 4, alpha * 1.4, age, p.phase);
      }
    this.puffs.count = count;
    this.puffs.instanceMatrix.needsUpdate = true;
    this.smokeAlpha.needsUpdate = true;
    let traces = 0;
    const units =
      (2 * Math.tan((this.camera.fov * Math.PI) / 360)) / this.height;
    for (const t of this.traces)
      if (t.life > 0 || !t.seen) {
        const head = Math.min(
            t.distance,
            Math.max(0.35, 420 * (t.seen ? t.age : Math.min(0.015, t.age))),
          ),
          tail = Math.max(0, head - Math.min(3, t.distance * 0.35));
        if (head - tail < 0.01) continue;
        this.dummy.position
          .copy(t.start)
          .addScaledVector(t.direction, (head + tail) * 0.5);
        this.toward
          .copy(this.camera.position)
          .sub(this.dummy.position)
          .normalize();
        this.along.copy(t.direction);
        this.right.crossVectors(this.along, this.toward).normalize();
        if (this.right.lengthSq() < 0.001) this.right.set(1, 0, 0);
        this.normal.crossVectors(this.right, this.along).normalize();
        this.basis.makeBasis(this.right, this.along, this.normal);
        this.dummy.quaternion.setFromRotationMatrix(this.basis);
        const width = Math.max(
          0.008,
          Math.min(
            0.08,
            this.camera.position.distanceTo(this.dummy.position) * units * 1.4,
          ),
        );
        this.dummy.scale.set(width, head - tail, 1);
        this.dummy.updateMatrix();
        this.core.setMatrixAt(traces, this.dummy.matrix);
        this.dummy.scale.x = width * 3;
        this.dummy.updateMatrix();
        this.halo.setMatrixAt(traces, this.dummy.matrix);
        this.tracerAlpha.setX(traces++, t.seen ? Math.min(1, t.life * 18) : 1);
        t.seen = true;
      }
    this.core.count = this.halo.count = traces;
    this.core.instanceMatrix.needsUpdate =
      this.halo.instanceMatrix.needsUpdate = true;
    this.tracerAlpha.needsUpdate = true;
  }
  diagnostics() {
    return {
      smoke: this.puffs.count,
      heat: this.smoke.heat,
      emitted: this.smoke.emitted,
      tracers: this.core.count,
      capacity: 96,
    };
  }
  reset() {
    this.smoke.reset();
    for (const t of this.traces) {
      t.life = 0;
      t.seen = true;
    }
  }
}
