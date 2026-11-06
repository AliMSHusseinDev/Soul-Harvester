import * as THREE from "three";
import { damp } from "./math";
import { glowTexture } from "./textures";
export class Weapon {
  readonly group = new THREE.Group();
  ammo = 8;
  reloading = false;
  private reloadTime = 0;
  private cooldown = 0;
  private recoil = 0;
  private flashTime = 0;
  private flash: THREE.Sprite;
  private light: THREE.PointLight;
  constructor(camera: THREE.PerspectiveCamera) {
    const steel = new THREE.MeshStandardMaterial({
      color: 0x66746b,
      metalness: 0.7,
      roughness: 0.32,
    });
    const black = new THREE.MeshStandardMaterial({
      color: 0x202c2b,
      metalness: 0.3,
      roughness: 0.5,
    });
    const brass = new THREE.MeshStandardMaterial({
      color: 0xab8e56,
      metalness: 0.8,
      roughness: 0.35,
    });
    const wood = new THREE.MeshStandardMaterial({
      color: 0x372c25,
      roughness: 0.85,
    });
    const glove = new THREE.MeshStandardMaterial({
      color: 0x202b28,
      roughness: 0.9,
    });
    const add = (
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      mat: THREE.Material,
    ) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      this.group.add(m);
      return m;
    };
    // Long squared barrel, raised sights, bronze receiver and etched soul chamber.
    add(0.11, 0.13, 0.55, 0, 0.015, -0.28, steel);
    add(0.14, 0.035, 0.45, 0, 0.095, -0.27, black);
    add(0.15, 0.045, 0.32, 0, -0.065, -0.13, brass);
    add(0.17, 0.18, 0.23, 0, -0.015, 0.06, steel);
    const muzzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.06, 12),
      brass,
    );
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.015, -0.58);
    this.group.add(muzzle);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.037, 12), black);
    hole.rotation.y = Math.PI;
    hole.position.set(0, 0.015, -0.612);
    this.group.add(hole);
    add(0.025, 0.06, 0.04, 0, 0.15, -0.49, brass);
    add(0.13, 0.045, 0.035, 0, 0.12, 0.06, black);
    add(0.025, 0.04, 0.04, -0.055, 0.14, 0.06, brass);
    add(0.025, 0.04, 0.04, 0.055, 0.14, 0.06, brass);
    const grip = add(0.12, 0.25, 0.14, 0, -0.19, 0.12, wood);
    grip.rotation.x = -0.22;
    for (let i = 0; i < 5; i++)
      add(0.125, 0.012, 0.14, 0, -0.1 - i * 0.035, 0.13, black);
    // A bright crystal set into the chamber creates the weapon's own identity.
    const crystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.055),
      new THREE.MeshStandardMaterial({
        color: 0x9ce5cc,
        emissive: 0x55c6aa,
        emissiveIntensity: 1.8,
        metalness: 0.2,
        roughness: 0.15,
      }),
    );
    crystal.position.set(0.09, 0.015, 0.045);
    crystal.scale.y = 1.7;
    this.group.add(crystal);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.09, 0.016, 6, 16, Math.PI * 1.5),
      brass,
    );
    ring.rotation.y = Math.PI / 2;
    ring.position.set(0, -0.15, -0.035);
    this.group.add(ring);
    // Gloved hand and sleeve, modeled in the same angular style as the firearm.
    const hand = add(0.17, 0.15, 0.23, 0.015, -0.19, 0.15, glove);
    hand.rotation.x = -0.22;
    for (let i = 0; i < 3; i++)
      add(0.035, 0.09, 0.13, -0.06 + i * 0.044, -0.14, 0.04, glove);
    const sleeve = add(0.22, 0.22, 0.55, 0.035, -0.31, 0.47, black);
    sleeve.rotation.x = -0.15;
    add(0.23, 0.06, 0.17, 0.025, -0.26, 0.28, brass);
    this.flash = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(),
        color: 0xc6ffe0,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.flash.position.set(0, 0.015, -0.65);
    this.flash.scale.set(0.65, 0.65, 1);
    this.flash.visible = false;
    this.group.add(this.flash);
    this.light = new THREE.PointLight(0xa9ffd6, 0, 5);
    this.light.position.set(0, 0.1, -0.75);
    this.group.add(this.light);
    this.group.scale.setScalar(0.68);
    this.group.position.set(0.28, -0.24, -0.55);
    this.group.rotation.y = -0.025;
    camera.add(this.group);
  }
  fire() {
    if (this.cooldown > 0 || this.reloading || this.ammo <= 0) return false;
    this.ammo--;
    this.cooldown = 0.29;
    this.recoil = 0.11;
    this.flashTime = 0.055;
    return true;
  }
  reload() {
    if (this.reloading || this.ammo === 8) return false;
    this.reloading = true;
    this.reloadTime = 1.25;
    return true;
  }
  update(dt: number, time: number, speed: number, reducedMotion: boolean) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.recoil = damp(this.recoil, 0, 16, dt);
    this.flashTime -= dt;
    this.flash.visible = this.flashTime > 0;
    this.light.intensity = this.flash.visible ? 5 : 0;
    if (this.reloading) {
      this.reloadTime -= dt;
      if (this.reloadTime <= 0) {
        this.reloading = false;
        this.ammo = 8;
      }
    }
    const reload = this.reloading
      ? Math.sin(((1.25 - this.reloadTime) / 1.25) * Math.PI)
      : 0;
    this.group.position.set(
      0.28 +
        (reducedMotion ? 0 : Math.sin(time * 7) * 0.007 * Math.min(speed, 4)),
      -0.24 -
        reload * 0.28 +
        (reducedMotion ? 0 : Math.cos(time * 14) * 0.006 * Math.min(speed, 4)),
      -0.55 + this.recoil,
    );
    this.group.rotation.set(
      this.recoil * 0.8 - reload * 0.6,
      -0.025,
      reload * -0.35,
    );
  }
}
