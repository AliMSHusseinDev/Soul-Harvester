import * as THREE from "three";
import { damp, aimPose, springStep } from "./math";
import { glowTexture } from "./textures";
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
        color: 0x384b43,
        metalness: 0.7,
        roughness: 0.32,
      }),
      gold = new THREE.MeshStandardMaterial({
        color: 0xc1a25b,
        metalness: 0.65,
        roughness: 0.32,
      }),
      wood = new THREE.MeshStandardMaterial({
        color: 0x452b27,
        roughness: 0.8,
      }),
      skin = new THREE.MeshStandardMaterial({
        color: 0xbda28d,
        roughness: 0.9,
      }),
      glove = new THREE.MeshStandardMaterial({
        color: 0x292e29,
        roughness: 0.9,
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
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
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
      box(g, 0.025, 0.06, 0.03, -0.055, 0.19, 0.025, gold);
      box(g, 0.025, 0.06, 0.03, 0.055, 0.19, 0.025, gold);
      if (rifle) {
        box(g, 0.11, 0.28, 0.2, 0, -0.24, -0.2, steel).rotation.x = 0.12;
        box(g, 0.15, 0.13, 0.24, 0, -0.02, 0.23, wood);
      }
      box(g, 0.15, 0.15, 0.22, 0.02, -0.18, 0.16, glove);
      box(g, 0.17, 0.16, 0.65, 0.025, -0.3, 0.46, skin).rotation.x = -0.15;
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
    box(blade, 0.07, 0.07, 1.1, 0, 0, -0.2, wood);
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.5, 0.12);
    shape.quadraticCurveTo(0.8, 0.05, 0.9, -0.2);
    shape.quadraticCurveTo(0.45, 0.1, 0.2, -0.2);
    shape.lineTo(0, -0.12);
    const edge = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: false }),
      gold,
    );
    edge.position.set(0, 0.08, -0.7);
    edge.rotation.x = -Math.PI / 2;
    blade.add(edge);
    box(blade, 0.15, 0.14, 0.2, 0, -0.08, 0.12, glove);
    box(blade, 0.17, 0.16, 0.6, 0, -0.2, 0.45, skin);
    this.group.add(blade);
    this.leftHand = new THREE.Group();
    box(this.leftHand, 0.17, 0.14, 0.2, 0, 0, 0, glove);
    box(this.leftHand, 0.16, 0.16, 0.5, 0, -0.07, 0.25, skin);
    for (let i = 0; i < 4; i++)
      box(
        this.leftHand,
        0.028,
        0.14,
        0.04,
        -0.05 + i * 0.035,
        0.06,
        -0.06,
        skin,
      );
    this.group.add(this.leftHand);
    this.flash = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(),
        color: 0xffe69a,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.flash.scale.set(0.5, 0.5, 1);
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
    this.light.intensity = this.flash.visible ? 4 : 0;
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
    this.group.position.set(
      pose.x,
      pose.y - reload * 0.14 + melee * 0.12 + bob * (1 - this.aim) * 0.6,
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
