import { WEAPON_TUNING } from "./tuning";
import * as THREE from "three";
import { damp, aimPose, springStep } from "./math";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { surface, surfaceUV } from "./surfaces";
import { Muzzle, muzzleOpening } from "./muzzle";
export type WeaponId = "rifle" | "pistol" | "blade";
export const WEAPONS = WEAPON_TUNING;
export class Weapon {
  readonly group = new THREE.Group();
  id: WeaponId = "rifle";
  readonly magazines: Record<WeaponId, number> = {
    rifle: WEAPONS.rifle.capacity,
    pistol: WEAPONS.pistol.capacity,
    blade: 0,
  };
  readonly reserves: Record<WeaponId, number> = {
    rifle: WEAPONS.rifle.reserve,
    pistol: WEAPONS.pistol.reserve,
    blade: 0,
  };
  reloading = false;
  reloadMultiplier = 1;
  private models: Record<WeaponId, THREE.Group>;
  private muzzles: Partial<Record<WeaponId, Muzzle>> = {};
  private recoil = 0;
  private velocity = 0;
  private cooldown = 0;
  private reloadTime = 0;
  private reloadDuration = 0;
  private flashTime = 0;
  private meleeTime = 0;
  private castTime = 0;
  private castBlend = 0;
  private aim = 0;
  private running = 0;
  private rotationKick = 0;
  private posePosition = new THREE.Vector3();
  private priorPosition = new THREE.Vector3();
  private poseRotation = new THREE.Quaternion();
  private priorRotation = new THREE.Quaternion();
  private poseReady = false;
  private arms: {
    mesh: THREE.Mesh;
    parent: THREE.Group;
    wrist: THREE.Vector3;
    anchor: THREE.Vector3;
  }[] = [];
  private armEnd = new THREE.Vector3();
  private armDirection = new THREE.Vector3();
  private upAxis = new THREE.Vector3(0, 1, 0);
  private fireStamp = 0;
  private presentedStamp = 0;
  private magazineMeshes: {
    mesh: THREE.Mesh;
    id: WeaponId;
    base: THREE.Vector3;
  }[] = [];
  private castHand = new THREE.Group();
  get casting() {
    return this.castTime > 0 || this.castBlend > 0.02;
  }
  get attacking() {
    return this.meleeTime > 0;
  }
  get reloadProgress() {
    return this.reloading ? 1 - this.reloadTime / this.reloadDuration : 0;
  }
  castOrigin() {
    return this.castHand.localToWorld(new THREE.Vector3(0, 0.13, -0.06));
  }
  muzzlePoint() {
    return (
      this.muzzles[this.id]?.worldPoint() ?? this.muzzles.rifle!.worldPoint()
    );
  }
  muzzleLocalPoint() {
    return this.muzzles[this.id]?.socket.position.toArray() ?? [0, 0, 0];
  }
  private addArm(
    parent: THREE.Group,
    wrist: THREE.Vector3,
    left: boolean,
    material: THREE.Material,
  ) {
    const mesh = forearmBetween(
      new THREE.Vector3(),
      new THREE.Vector3(0, 1, 0),
      material,
    );
    mesh.userData.animated = true;
    parent.add(mesh);
    this.arms.push({
      mesh,
      parent,
      wrist,
      anchor: new THREE.Vector3(left ? -0.4 : 0.45, -0.72, 0.08),
    });
  }
  private placeArms() {
    this.group.updateWorldMatrix(true, true);
    for (const arm of this.arms) {
      this.armEnd.copy(arm.anchor).applyMatrix4(this.camera.matrixWorld);
      arm.parent.worldToLocal(this.armEnd);
      this.armDirection.copy(this.armEnd).sub(arm.wrist);
      const length = this.armDirection.length();
      arm.mesh.position.copy(arm.wrist).addScaledVector(this.armDirection, 0.5);
      arm.mesh.quaternion.setFromUnitVectors(
        this.upAxis,
        this.armDirection.normalize(),
      );
      arm.mesh.scale.y = length;
    }
  }
  present(alpha = 1) {
    this.group.position.lerpVectors(
      this.priorPosition,
      this.posePosition,
      alpha,
    );
    this.group.quaternion.slerpQuaternions(
      this.priorRotation,
      this.poseRotation,
      alpha,
    );
    this.placeArms();
    const visible =
      this.id !== "blade" &&
      (this.flashTime > 0 || this.fireStamp !== this.presentedStamp);
    for (const id of ["rifle", "pistol"] as const)
      this.muzzles[id]?.present(
        visible && this.id === id,
        this.aim,
        this.fireStamp,
      );
    this.presentedStamp = this.fireStamp;
  }
  hurt() {
    this.velocity += 0.18;
  }
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
  constructor(private camera: THREE.PerspectiveCamera) {
    const steel = new THREE.MeshStandardMaterial({
        map: surface("steel"),
        color: 0xc1ccc2,
        metalness: 0.45,
        roughness: 0.6,
      }),
      gold = new THREE.MeshStandardMaterial({
        map: surface("brass"),
        color: 0xffdd9c,
        metalness: 0.5,
        roughness: 0.48,
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
      muzzle.position.copy(muzzleOpening(rifle));
      muzzle.position.z += 0.06;
      g.add(muzzle);
      box(
        g,
        0.105,
        0.15,
        0.1,
        0,
        muzzleOpening(rifle).y - 0.07,
        -len + 0.04,
        steel,
      );
      this.muzzles[id] = new Muzzle(g, rifle);
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
        const magazine = box(g, 0.11, 0.28, 0.2, 0, -0.24, -0.2, steel);
        magazine.rotation.x = 0.12;
        magazine.userData.animated = true;
        this.magazineMeshes.push({
          mesh: magazine,
          id,
          base: magazine.position.clone(),
        });
        box(g, 0.15, 0.13, 0.24, 0, -0.02, 0.23, wood);
      } else {
        const magazine = box(g, 0.08, 0.14, 0.1, 0, -0.23, 0.12, steel);
        magazine.userData.animated = true;
        this.magazineMeshes.push({
          mesh: magazine,
          id,
          base: magazine.position.clone(),
        });
      }
      box(g, 0.15, 0.15, 0.22, 0.02, -0.18, 0.16, glove);
      this.addArm(g, new THREE.Vector3(0.025, -0.24, 0.18), false, skin);
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
    this.addArm(blade, new THREE.Vector3(0, -0.14, 0.16), false, skin);
    this.group.add(blade);
    this.leftHand = new THREE.Group();
    box(this.leftHand, 0.17, 0.14, 0.2, 0, 0, 0, glove);
    this.addArm(this.leftHand, new THREE.Vector3(0, -0.055, 0.04), true, skin);
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
    box(this.castHand, 0.14, 0.11, 0.12, 0, 0, 0, glove);
    for (let i = 0; i < 4; i++)
      box(this.castHand, 0.027, 0.14, 0.035, -0.05 + i * 0.033, 0.11, 0, glove);
    box(this.castHand, 0.08, 0.035, 0.04, -0.09, 0.01, 0, glove).rotation.z =
      0.4;
    this.addArm(this.castHand, new THREE.Vector3(0, -0.055, 0.04), true, skin);
    this.group.add(this.castHand);
    for (const model of [
      ...Object.values(this.models),
      this.leftHand,
      this.castHand,
    ])
      batchModel(model);
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
    this.fireStamp++;
    this.rotationKick +=
      Math.sin(this.fireStamp * 2.39996) * this.config.kick * 0.35;
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
    this.meleeTime = 0;
    this.reloading = false;
  }
  addAmmo(amount: number) {
    this.reserves.rifle = Math.min(
      WEAPONS.rifle.maxReserve,
      this.reserves.rifle + amount,
    );
    this.reserves.pistol = Math.min(
      WEAPONS.pistol.maxReserve,
      this.reserves.pistol + Math.ceil(amount / 2),
    );
  }
  reset() {
    this.id = "rifle";
    this.magazines.rifle = WEAPONS.rifle.capacity;
    this.magazines.pistol = WEAPONS.pistol.capacity;
    this.reserves.rifle = WEAPONS.rifle.reserve;
    this.reserves.pistol = WEAPONS.pistol.reserve;
    this.reloading = false;
    this.recoil = 0;
    this.velocity = 0;
    this.cooldown = 0;
    this.meleeTime = 0;
    this.castTime = 0;
    this.castBlend = 0;
    this.aim = 0;
    this.running = 0;
    this.flashTime = 0;
    this.fireStamp = this.presentedStamp = 0;
    this.rotationKick = 0;
    this.poseReady = false;
  }
  update(
    dt: number,
    time: number,
    speed: number,
    reducedMotion: boolean,
    aiming = false,
    sprinting = false,
    distance = time * speed,
    airborne = false,
  ) {
    this.priorPosition.copy(this.posePosition);
    this.priorRotation.copy(this.poseRotation);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.flashTime -= dt;
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
    this.rotationKick = damp(this.rotationKick, 0, 16, dt);
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
    this.castBlend = damp(this.castBlend, this.castTime > 0.15 ? 1 : 0, 18, dt);
    this.switchTime = Math.max(0, this.switchTime - dt);
    this.aim = damp(
      this.aim,
      aiming && !this.reloading && this.id !== "blade" ? 1 : 0,
      14,
      dt,
    );
    this.running = damp(this.running, sprinting ? 1 : 0, 15, dt);
    const rp = this.reloading ? 1 - this.reloadTime / this.reloadDuration : 0,
      reload = Math.sin(rp * Math.PI),
      melee = Math.sin((this.meleeTime / 0.38) * Math.PI),
      cast = this.castBlend,
      bob = reducedMotion
        ? 0
        : Math.sin(distance * 2.1) *
          (airborne ? 0.15 : 1) *
          Math.min(speed, 7) *
          (0.003 + this.running * 0.002);
    const pose = aimPose(this.aim);
    const idle = reducedMotion
      ? 0
      : Math.sin(time * 1.6) * 0.001 * (1 - this.aim);
    this.group.position.set(
      pose.x + idle * 0.5 + this.running * 0.12,
      pose.y +
        idle -
        reload * 0.14 -
        cast * 0.22 -
        this.running * 0.065 +
        melee * 0.12 +
        bob * (1 - this.aim) * 0.6,
      pose.z + this.recoil - melee * 0.35 + this.switchTime * 0.7,
    );
    this.group.rotation.set(
      this.recoil * 0.8 + reload * 0.12 + this.running * 1.05,
      -reload * 0.45 -
        this.running * 0.32 +
        this.rotationKick * 0.4 +
        (airborne && !reducedMotion ? Math.sin(time * 3.5) * 0.005 : 0),
      melee * -0.8 + reload * 0.5 - this.running * 0.22 + this.rotationKick,
    );
    for (const id of Object.keys(this.models) as WeaponId[])
      this.models[id].visible = id === this.id;
    this.leftHand.position.set(
      this.id === "rifle" && !this.reloading ? -0.07 : -0.2 - cast * 0.18,
      -0.1 + reload * 0.24 + cast * 0.25,
      this.id === "rifle" ? -0.4 : -0.05,
    );
    this.leftHand.rotation.set(cast * -0.9, reload * 0.6, -cast * 0.2);
    this.leftHand.visible =
      !this.casting && (this.id === "rifle" || this.reloading);
    this.castHand.visible = this.casting;
    this.castHand.position.set(
      -0.32 - cast * 0.1,
      -0.06 + cast * 0.2,
      -0.35 - cast * 0.25,
    );
    this.castHand.rotation.set(-cast * 0.55, 0, cast * 0.12);
    for (const m of this.magazineMeshes) {
      const amount =
        this.reloading && m.id === this.id
          ? Math.sin(Math.PI * Math.min(1, rp / 0.78))
          : 0;
      m.mesh.position.copy(m.base);
      m.mesh.position.y -= amount * 0.25;
      m.mesh.position.x -= amount * 0.1;
      m.mesh.visible = !(
        this.reloading &&
        m.id === this.id &&
        rp > 0.35 &&
        rp < 0.58
      );
    }
    this.posePosition.copy(this.group.position);
    this.poseRotation.copy(this.group.quaternion);
    if (!this.poseReady) {
      this.priorPosition.copy(this.posePosition);
      this.priorRotation.copy(this.poseRotation);
      this.poseReady = true;
    }
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
    if (
      !(child instanceof THREE.Mesh) ||
      Array.isArray(child.material) ||
      child.userData.animated
    )
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
