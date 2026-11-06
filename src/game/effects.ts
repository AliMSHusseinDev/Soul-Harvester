import * as THREE from "three";
import { glowTexture, guardTexture } from "./textures";
import type { Battle } from "./battle";
interface Particle {
  life: number;
  max: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  r: number;
  g: number;
  b: number;
}
export class Effects {
  private particles: Particle[] = Array.from({ length: 500 }, () => ({
    life: 0,
    max: 1,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    r: 1,
    g: 1,
    b: 1,
  }));
  private positions = new Float32Array(1500);
  private colors = new Float32Array(1500);
  private geometry = new THREE.BufferGeometry();
  private points: THREE.Points;
  private coinMesh: THREE.InstancedMesh;
  private crystalMesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private numbers: { sprite: THREE.Sprite; life: number }[] = [];
  private numberTextures = new Map<number, THREE.CanvasTexture>();
  private corpses: { sprite: THREE.Sprite; life: number; vy: number }[] = [];
  private orbs: { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number }[] =
    [];
  private ring: THREE.Mesh;
  private ringLife = 0;
  private glow: THREE.Sprite;
  constructor(
    private scene: THREE.Scene,
    private battle: Battle,
  ) {
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3),
    );
    this.geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(this.colors, 3),
    );
    this.points = new THREE.Points(
      this.geometry,
      new THREE.PointsMaterial({
        map: glowTexture(),
        size: 0.16,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.coinMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.045, 10),
      new THREE.MeshStandardMaterial({
        color: 0xe9ba54,
        metalness: 0.65,
        roughness: 0.35,
        emissive: 0x7c4e06,
        emissiveIntensity: 0.4,
      }),
      100,
    );
    this.crystalMesh = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.14),
      new THREE.MeshBasicMaterial({ color: 0x83eaff }),
      100,
    );
    scene.add(this.coinMesh, this.crystalMesh);
    this.coinMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.crystalMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < 28; i++) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ transparent: true, depthTest: false }),
      );
      sprite.visible = false;
      sprite.scale.set(1.1, 0.48, 1);
      sprite.renderOrder = 5;
      scene.add(sprite);
      this.numbers.push({ sprite, life: 0 });
    }
    for (let i = 0; i < 12; i++) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: guardTexture(i % 3),
          transparent: true,
          alphaTest: 0.1,
        }),
      );
      sprite.scale.set(1.25, 1.65, 1);
      sprite.visible = false;
      scene.add(sprite);
      this.corpses.push({ sprite, life: 0, vy: 0 });
    }
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.18, 1),
        new THREE.MeshBasicMaterial({ color: 0xffbf45 }),
      );
      mesh.visible = false;
      scene.add(mesh);
      this.orbs.push({ mesh, velocity: new THREE.Vector3(), life: 0 });
    }
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.035, 4, 64),
      new THREE.MeshBasicMaterial({
        color: 0x70ffda,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    this.ring.rotation.x = Math.PI / 2;
    scene.add(this.ring);
    this.glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(),
        color: 0x4cffc6,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.glow.scale.set(15, 15, 1);
    scene.add(this.glow);
  }
  burst(point: THREE.Vector3, color = 0x9ef7d8, count = 24, speed = 3) {
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      const p = this.particles.find((p) => p.life <= 0);
      if (!p) break;
      Object.assign(p, {
        life: 0.4 + Math.random() * 0.45,
        max: 0.85,
        x: point.x,
        y: point.y,
        z: point.z,
        vx: (Math.random() - 0.5) * speed,
        vy: Math.random() * speed,
        vz: (Math.random() - 0.5) * speed,
        r: c.r,
        g: c.g,
        b: c.b,
      });
    }
  }
  shell(position: THREE.Vector3, direction: THREE.Vector3) {
    const p = this.particles.find((p) => p.life <= 0);
    if (p)
      Object.assign(p, {
        life: 0.8,
        max: 0.8,
        x: position.x,
        y: position.y - 0.2,
        z: position.z,
        vx: direction.x * 2,
        vy: 2,
        vz: direction.z * 2,
        r: 1,
        g: 0.7,
        b: 0.22,
      });
  }
  number(x: number, z: number, value: number) {
    const n = this.numbers.find((n) => n.life <= 0) || this.numbers[0],
      rounded = Math.round(value);
    let texture = this.numberTextures.get(rounded);
    if (!texture) {
      const c = document.createElement("canvas");
      c.width = 128;
      c.height = 64;
      const g = c.getContext("2d")!;
      g.font = "bold 38px monospace";
      g.textAlign = "center";
      g.lineWidth = 6;
      g.strokeStyle = "#0e302b";
      g.strokeText(String(rounded), 64, 45);
      g.fillStyle = value > 45 ? "#ffdc69" : "#ebffe3";
      g.fillText(String(rounded), 64, 45);
      texture = new THREE.CanvasTexture(c);
      this.numberTextures.set(rounded, texture);
    }
    n.sprite.material.map = texture;
    n.sprite.material.needsUpdate = true;
    n.sprite.position.set(x, 1.7, z);
    n.sprite.visible = true;
    n.life = 0.7;
  }
  death(x: number, z: number) {
    const c = this.corpses.find((c) => c.life <= 0) || this.corpses[0];
    c.sprite.position.set(x, 1, z);
    c.sprite.visible = true;
    c.life = 0.7;
    c.vy = 3;
    this.burst(new THREE.Vector3(x, 1, z), 0x83dfbd, 18, 4);
  }
  pulse(x: number, z: number) {
    this.ring.position.set(x, 0.15, z);
    this.glow.position.set(x, 1.2, z);
    this.ringLife = 0.6;
  }
  orb(position: THREE.Vector3, direction: THREE.Vector3) {
    const orb = this.orbs.find((o) => o.life <= 0);
    if (!orb) return;
    orb.life = 3;
    orb.mesh.visible = true;
    orb.mesh.position.copy(position).addScaledVector(direction, 0.8);
    orb.velocity.copy(direction).multiplyScalar(19);
  }
  update(dt: number, time: number, simulate: boolean) {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (simulate && p.life > 0) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vy -= 5 * dt;
      }
      this.positions.set(p.life > 0 ? [p.x, p.y, p.z] : [0, -100, 0], i * 3);
      const fade = Math.max(0, p.life / p.max);
      this.colors.set([p.r * fade, p.g * fade, p.b * fade], i * 3);
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    let count = 0;
    for (const drop of this.battle.drops) {
      if (!drop.active) continue;
      this.dummy.position.set(
        drop.x,
        0.35 + Math.sin(time * 3 + drop.id) * 0.08,
        drop.z,
      );
      this.dummy.rotation.set(Math.PI / 2, time * 2, 0);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.coinMesh.setMatrixAt(count, this.dummy.matrix);
      this.dummy.position.x += 0.32;
      this.dummy.position.y += 0.25;
      this.dummy.rotation.set(0, time * 2, 0);
      this.dummy.scale.set(0.8, 1.5, 0.8);
      this.dummy.updateMatrix();
      this.crystalMesh.setMatrixAt(count, this.dummy.matrix);
      count++;
    }
    this.coinMesh.count = this.crystalMesh.count = count;
    this.coinMesh.instanceMatrix.needsUpdate = true;
    this.crystalMesh.instanceMatrix.needsUpdate = true;
    if (!simulate) return;
    for (const n of this.numbers)
      if (n.life > 0) {
        n.life -= dt;
        n.sprite.position.y += dt;
        n.sprite.material.opacity = Math.min(1, n.life * 3);
        n.sprite.visible = n.life > 0;
      }
    for (const c of this.corpses)
      if (c.life > 0) {
        c.life -= dt;
        c.sprite.position.y += c.vy * dt;
        c.vy -= 10 * dt;
        c.sprite.material.rotation += dt * 5;
        c.sprite.material.opacity = Math.max(0, c.life / 0.7);
        c.sprite.visible = c.life > 0;
      }
    for (const o of this.orbs)
      if (o.life > 0) {
        o.life -= dt;
        const start = o.mesh.position.clone(),
          delta = o.velocity.clone().multiplyScalar(dt);
        o.mesh.position.add(delta);
        const end = o.mesh.position;
        let hit = !this.battle.nav.walkable(end.x, end.z) && end.y < 5;
        for (const e of this.battle.alive) {
          const v = new THREE.Vector3(e.x, 1, e.z).sub(start),
            length = delta.lengthSq(),
            t = length ? THREE.MathUtils.clamp(v.dot(delta) / length, 0, 1) : 0;
          if (
            start
              .clone()
              .addScaledVector(delta, t)
              .distanceTo(new THREE.Vector3(e.x, 1, e.z)) < 0.8
          ) {
            hit = true;
            break;
          }
        }
        if (hit || o.life <= 0) {
          this.battle.explode(end);
          this.burst(end, 0xffa94b, 60, 8);
          o.life = 0;
          o.mesh.visible = false;
        }
      }
    this.ringLife = Math.max(0, this.ringLife - dt);
    const scale = 1 + (1 - this.ringLife / 0.6) * 7;
    this.ring.scale.setScalar(scale);
    (this.ring.material as THREE.MeshBasicMaterial).opacity =
      this.ringLife / 0.6;
    this.glow.material.opacity = this.ringLife * 0.4;
  }
  reset() {
    for (const p of this.particles) p.life = 0;
    for (const n of this.numbers) {
      n.life = 0;
      n.sprite.visible = false;
    }
    for (const c of this.corpses) {
      c.life = 0;
      c.sprite.visible = false;
    }
    for (const o of this.orbs) {
      o.life = 0;
      o.mesh.visible = false;
    }
    this.ringLife = 0;
  }
}
