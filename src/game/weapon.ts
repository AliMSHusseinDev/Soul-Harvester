import * as THREE from "three";
import { damp, aimPose, springStep } from "./math";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { surface, surfaceUV } from "./surfaces";
export type WeaponId = "rifle" | "pistol" | "blade";
export const WEAPONS = {
  rifle: {
    name: "GRAVECALLER",
    type: "ASSAULT RIFLE",
    capacity: 30,
    reserve: 120,
    damage: 19,
    interval: 0.105,
    reload: 1.8,
    kick: 0.035,
  },
  pistol: {
    name: "THE RECLAIMER",
    type: "SOULLOCK PISTOL",
    capacity: 12,
    reserve: 72,
    damage: 34,
    interval: 0.27,
    reload: 1.25,
    kick: 0.065,
  },
  blade: {
    name: "REAPING EDGE",
    type: "MELEE · CLOSE QUARTERS",
    capacity: 0,
    reserve: 0,
    damage: 42,
    interval: 0.6,
    reload: 0,
    kick: 0,
  },
} as const;
export class Weapon {
  readonly group = new THREE.Group();
  id: WeaponId = "rifle";
  readonly magazines = { rifle: 30, pistol: 12, blade: 0 };
  readonly reserves = { rifle: 120, pistol: 72, blade: 0 };
  reloading = false;
  reloadMultiplier = 1;
  private models: Record<WeaponId, THREE.Group>;
  private flash: THREE.Sprite;
  private light: THREE.PointLight;
  private recoil = 0;
  private velocity = 0;
  private cooldown = 0;
  private reloadTime = 0;
  private reloadDuration = 0;
  private flashTime = 0;
  private meleeTime = 0;
  private castTime = 0;
  private aim = 0;
  get aimAmount() {
    return this.aim;
  }
  sightPoints() {
    return [
      new THREE.Vector3(0, 0.22, 0.025),
      new THREE.Vector3(0, 0.22, this.id === "rifle" ? -0.81 : -0.41),
    ].map((p) => this.group.localToWorld(p));
  }
  private switchTime = 0;
  private leftHand: THREE.Group;
  constructor(camera: THREE.PerspectiveCamera) {
    const steel = new THREE.MeshStandardMaterial({
        map: surface("steel"),
        color: 0xc1ccc2,
        metalness: 0.45,
        roughness: 0.6,
      }),
      gold = new THREE.MeshStandardMaterial({
        map: surface("brass"),
        color: 0xe2cd9b,
        metalness: 0.65,
        roughness: 0.42,
      }),
      wood = new THREE.MeshStandardMaterial({
        map: surface("wood"),
        color: 0xa38b70,
        roughness: 0.8,
      }),
      skin = new THREE.MeshStandardMaterial({
        map: surface("skin"),
        color: 0xc5b7a7,
        roughness: 0.9,
      }),
      glove = new THREE.MeshStandardMaterial({
        map: surface("leather"),
        color: 0x637166,
        roughness: 0.9,
      }),
      recess = new THREE.MeshStandardMaterial({
        map: surface("steel"),
        color: 0x26352d,
        roughness: 0.85,
      });
    const box = (
      g: THREE.Group,
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      m: THREE.Material,
    ) => {
      const mesh = new THREE.Mesh(
        surfaceUV(new THREE.BoxGeometry(w, h, d), 0.2),
        m,
      );
      mesh.position.set(x, y, z);
      g.add(mesh);
      return mesh;
    };
    this.models = {
      rifle: new THREE.Group(),
      pistol: new THREE.Group(),
      blade: new THREE.Group(),
    };
    for (const id of ["rifle", "pistol"] as const) {
      const g = this.models[id],
        rifle = id === "rifle",
        len = rifle ? 0.85 : 0.45;
      box(g, 0.13, 0.13, len, 0, 0.02, -len / 2, steel);
      for (let i = 0; i < (rifle ? 4 : 2); i++) {
        box(g, 0.004, 0.035, 0.045, 0.067, 0.025, -0.22 - i * 0.11, recess);
        box(g, 0.004, 0.035, 0.045, -0.067, 0.025, -0.22 - i * 0.11, recess);
      }
      box(g, 0.006, 0.045, 0.12, 0.07, 0.015, -0.1, gold);
      box(g, 0.006, 0.025, 0.08, 0.074, 0.02, -0.1, recess);
      const muzzle = new THREE.Mesh(
        surfaceUV(new THREE.CylinderGeometry(0.032, 0.037, 0.12, 8), 0.2),
        steel,
      );
      muzzle.rotation.x = Math.PI / 2;
      muzzle.position.set(0, 0.02, -len - 0.015);
      g.add(muzzle);
      box(g, 0.15, 0.08, 0.28, 0, -0.06, 0, gold);
      box(g, 0.14, 0.22, 0.14, 0, -0.17, 0.12, wood).rotation.x = -0.2;
      box(g, 0.16, 0.06, len * 0.85, 0, 0.1, -len * 0.42, gold);
      for (let i = 0; i < (rifle ? 13 : 5); i++)
        box(
          g,
          0.17,
          0.025,
          0.022,
          0,
          0.145,
          -0.06 - i * ((len * 0.8) / (rifle ? 13 : 5)),
          steel,
        );
      box(g, 0.025, 0.06, 0.03, 0, 0.19, -len + 0.04, gold);
      for (const x of [-0.04, 0.04])
        box(g, 0.018, 0.045, 0.03, x, 0.16, -len + 0.04, steel);
      box(g, 0.025, 0.06, 0.03, -0.055, 0.19, 0.025, gold);
      box(g, 0.025, 0.06, 0.03, 0.055, 0.19, 0.025, gold);
      if (rifle) {
        box(g, 0.11, 0.28, 0.2, 0, -0.24, -0.2, steel).rotation.x = 0.12;
        box(g, 0.15, 0.13, 0.24, 0, -0.02, 0.23, wood);
      }
      box(g, 0.15, 0.15, 0.22, 0.02, -0.18, 0.16, glove);
      const arm = forearmBetween(
        new THREE.Vector3(0.025, -0.24, 0.18),
        new THREE.Vector3(0.22, -0.4, 0.76),
        skin,
      );
      g.add(arm);
      for (let i = 0; i < 4; i++)
        box(g, 0.027, 0.08, 0.13, -0.05 + i * 0.035, -0.12, 0.08, glove);
      const chamber = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.032),
        new THREE.MeshStandardMaterial({
          color: 0xb9fce1,
          emissive: 0x39c795,
          emissiveIntensity: 0.45,
        }),
      );
      chamber.scale.set(0.3, 0.6, 0.3);
      chamber.position.set(0.066, 0.015, -0.05);
      g.add(chamber);
      this.group.add(g);
    }
    const blade = this.models.blade;
    box(blade, 0.065, 0.075, 0.28, 0, 0, 0.04, wood);
    box(blade, 0.23, 0.045, 0.065, 0, 0.015, -0.12, gold);
    box(blade, 0.08, 0.085, 0.04, 0, 0, 0.2, gold);
    const shape = new THREE.Shape();
    shape.moveTo(-0.075, 0);
    shape.lineTo(0.075, 0);
    shape.lineTo(0.065, 0.4);
    shape.lineTo(0, 0.65);
    shape.lineTo(-0.065, 0.4);
    shape.closePath();
    const edge = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, {
        depth: 0.025,
        bevelEnabled: true,
        bevelSegments: 1,
        bevelSize: 0.012,
        bevelThickness: 0.008,
        steps: 1,
      }),
      new THREE.MeshStandardMaterial({
        map: surface("steel"),
        color: 0x65d2d9,
        emissive: 0x0b3840,
        emissiveIntensity: 0.2,
        metalness: 0.55,
        roughness: 0.4,
      }),
    );
    edge.position.set(0, 0.025, -0.14);
    edge.rotation.x = -Math.PI / 2;
    blade.add(edge);
    box(blade, 0.15, 0.14, 0.2, 0, -0.08, 0.12, glove);
    blade.add(
      forearmBetween(
        new THREE.Vector3(0, -0.14, 0.16),
        new THREE.Vector3(0.23, -0.35, 0.75),
        skin,
      ),
    );
    this.group.add(blade);
    this.leftHand = new THREE.Group();
    box(this.leftHand, 0.17, 0.14, 0.2, 0, 0, 0, glove);
    const forearm = forearmBetween(
      new THREE.Vector3(0, -0.055, 0.04),
      new THREE.Vector3(-0.29, -0.3, 0.6),
      skin,
    );
    this.leftHand.add(forearm);
    for (let i = 0; i < 4; i++)
      box(
        this.leftHand,
        0.028,
        0.14,
        0.04,
        -0.05 + i * 0.035,
        0.06,
        -0.06,
        glove,
      );
    this.group.add(this.leftHand);
    for (const model of [...Object.values(this.models), this.leftHand])
      batchModel(model);
    this.flash = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: surface("flash"),
        color: 0xffe69a,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.flash.scale.set(0.24, 0.24, 1);
    this.group.add(this.flash);
    this.light = new THREE.PointLight(0xffd98c, 0, 4);
    this.group.add(this.light);
    this.group.scale.setScalar(0.68);
    camera.add(this.group);
    this.update(0, 0, 0, false, false);
  }
  get config() {
    return WEAPONS[this.id];
  }
  get ammo() {
    return this.magazines[this.id];
  }
  get reserve() {
    return this.reserves[this.id];
  }
  switch(id: WeaponId) {
    if (id === this.id) return;
    this.id = id;
    this.reloading = false;
    this.switchTime = 0.25;
    this.cooldown = 0.2;
  }
  fire() {
    if (
      this.id === "blade" ||
      this.cooldown > 0 ||
      this.reloading ||
      this.ammo <= 0 ||
      this.meleeTime > 0 ||
      this.castTime > 0
    )
      return false;
    this.magazines[this.id]--;
    this.cooldown = this.config.interval;
    this.velocity += this.config.kick * 25;
    this.flashTime = 0.04;
    return true;
  }
  reload() {
    if (
      this.id === "blade" ||
      this.reloading ||
      this.ammo === this.config.capacity ||
      this.reserve === 0
    )
      return false;
    this.reloading = true;
    this.reloadDuration = this.config.reload * this.reloadMultiplier;
    this.reloadTime = this.reloadDuration;
    return true;
  }
  melee() {
    this.meleeTime = 0.38;
    this.reloading = false;
  }
  cast() {
    this.castTime = 0.55;
    this.reloading = false;
  }
  addAmmo(amount: number) {
    this.reserves.rifle = Math.min(240, this.reserves.rifle + amount);
    this.reserves.pistol = Math.min(
      120,
      this.reserves.pistol + Math.ceil(amount / 2),
    );
  }
  reset() {
    this.id = "rifle";
    this.magazines.rifle = 30;
    this.magazines.pistol = 12;
    this.reserves.rifle = 120;
    this.reserves.pistol = 72;
    this.reloading = false;
    this.recoil = 0;
    this.velocity = 0;
    this.cooldown = 0;
    this.meleeTime = 0;
    this.castTime = 0;
  }
  update(
    dt: number,
    time: number,
    speed: number,
    reducedMotion: boolean,
    aiming = false,
  ) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.flashTime -= dt;
    this.flash.visible = this.flashTime > 0;
    this.light.intensity = this.flash.visible ? 1.5 : 0;
    this.flash.position.set(0, 0.035, this.id === "rifle" ? -0.91 : -0.51);
    this.light.position.copy(this.flash.position);
    // Critically damped spring: recoil remains stable across frame rates.
    const spring = springStep(
      this.recoil,
      this.velocity,
      0,
      Math.sqrt(140),
      dt,
    );
    this.recoil = spring.position;
    this.velocity = spring.velocity;
    if (this.reloading) {
      this.reloadTime -= dt;
      if (this.reloadTime <= 0) {
        const transfer = Math.min(
          this.config.capacity - this.ammo,
          this.reserve,
        );
        this.magazines[this.id] += transfer;
        this.reserves[this.id] -= transfer;
        this.reloading = false;
      }
    }
    this.meleeTime = Math.max(0, this.meleeTime - dt);
    this.castTime = Math.max(0, this.castTime - dt);
    this.switchTime = Math.max(0, this.switchTime - dt);
    this.aim = damp(
      this.aim,
      aiming && !this.reloading && this.id !== "blade" ? 1 : 0,
      14,
      dt,
    );
    const rp = this.reloading ? 1 - this.reloadTime / this.reloadDuration : 0,
      reload = Math.sin(rp * Math.PI),
      melee = Math.sin((this.meleeTime / 0.38) * Math.PI),
      cast = Math.sin((this.castTime / 0.55) * Math.PI),
      bob = reducedMotion ? 0 : Math.sin(time * 8) * Math.min(speed, 5) * 0.003;
    const pose = aimPose(this.aim);
    const idle = reducedMotion
      ? 0
      : Math.sin(time * 1.6) * 0.001 * (1 - this.aim);
    this.group.position.set(
      pose.x + idle * 0.5,
      pose.y + idle - reload * 0.14 + melee * 0.12 + bob * (1 - this.aim) * 0.6,
      pose.z + this.recoil - melee * 0.35 + this.switchTime * 0.7,
    );
    this.group.rotation.set(
      this.recoil * 0.8 + reload * 0.12,
      -reload * 0.45,
      melee * -0.8 + reload * 0.5,
    );
    for (const id of Object.keys(this.models) as WeaponId[])
      this.models[id].visible = id === this.id;
    this.leftHand.position.set(
      this.id === "rifle" && !this.reloading ? -0.07 : -0.2 - cast * 0.18,
      -0.1 + reload * 0.24 + cast * 0.25,
      this.id === "rifle" ? -0.4 : -0.05,
    );
    this.leftHand.rotation.set(cast * -0.9, reload * 0.6, -cast * 0.2);
    this.leftHand.visible = this.id === "rifle" || this.reloading || cast > 0;
  }
}
function forearmBetween(
  wrist: THREE.Vector3,
  elbow: THREE.Vector3,
  material: THREE.Material,
) {
  const direction = elbow.clone().sub(wrist),
    mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.075, direction.length(), 8),
      material,
    );
  mesh.position.copy(wrist).addScaledVector(direction, 0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  return mesh;
}

/** Static viewmodel parts share a handful of material draws; the hand rig still animates independently. */
function batchModel(group: THREE.Group) {
  const batches = new Map<
    THREE.Material,
    { geometries: THREE.BufferGeometry[]; objects: THREE.Mesh[] }
  >();
  for (const child of group.children) {
    if (!(child instanceof THREE.Mesh) || Array.isArray(child.material))
      continue;
    child.updateMatrix();
    const g = (
      child.geometry.index
        ? child.geometry.toNonIndexed()
        : child.geometry.clone()
    ).applyMatrix4(child.matrix);
    let batch = batches.get(child.material);
    if (!batch) {
      batch = { geometries: [], objects: [] };
      batches.set(child.material, batch);
    }
    batch.geometries.push(g);
    batch.objects.push(child);
  }
  for (const [material, batch] of batches) {
    const geometry = mergeGeometries(batch.geometries)!;
    group.add(new THREE.Mesh(geometry, material));
    for (const object of batch.objects) {
      group.remove(object);
      object.geometry.dispose();
    }
    batch.geometries.forEach((g) => g.dispose());
  }
}
