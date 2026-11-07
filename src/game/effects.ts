import * as THREE from "three";
import { glowTexture, guardTexture } from "./textures";
import { groundHeight } from "./terrain";
import { ENEMY_TYPES } from "./waves";
import type { Battle } from "./battle";
import { COMBAT_FEEL, LOOT_FEEL } from "./tuning";
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
  private particles: Particle[] = Array.from({ length: 600 }, () => ({
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
  private cursor = 0;
  private positions = new Float32Array(1800);
  private colors = new Float32Array(1800);
  private geometry = new THREE.BufferGeometry();
  private dummy = new THREE.Object3D();
  private coinMesh: THREE.InstancedMesh;
  private crystalMesh: THREE.InstancedMesh;
  private missileMesh: THREE.InstancedMesh;
  private numbers: { sprite: THREE.Sprite; life: number }[] = [];
  private numberTextures = new Map<number, THREE.CanvasTexture>();
  private corpses: { sprite: THREE.Sprite; life: number; vy: number }[] = [];
  private corpseMaps = [0, 1, 2, 3].map(guardTexture);
  private orbs: { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number }[] =
    [];
  private ring: THREE.Mesh;
  private ringPositions = new Float32Array(65 * 2 * 3);
  private ringLife = 0;
  private ringOrigin = new THREE.Vector2();
  private occluders: THREE.Box3[];
  private ray = new THREE.Ray();
  private point = new THREE.Vector3();
  private trailClocks: Float32Array;
  private spawnWisps: { sprite: THREE.Sprite; life: number }[] = [];
  constructor(
    private scene: THREE.Scene,
    private battle: Battle,
  ) {
    this.trailClocks = new Float32Array(battle.drops.length);
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3),
    );
    this.geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(this.colors, 3),
    );
    const points = new THREE.Points(
      this.geometry,
      new THREE.PointsMaterial({
        map: glowTexture(),
        size: COMBAT_FEEL.particleSize,
        vertexColors: true,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    points.frustumCulled = false;
    scene.add(points);
    this.coinMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(
        LOOT_FEEL.goldRadius,
        LOOT_FEEL.goldRadius,
        0.035,
        12,
      ),
      new THREE.MeshStandardMaterial({
        color: 0xe8b74c,
        metalness: 0.4,
        roughness: 0.42,
        emissive: 0xa85c0c,
        emissiveIntensity: 0.28,
      }),
      battle.drops.length,
    );
    this.crystalMesh = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(LOOT_FEEL.xpRadius),
      new THREE.MeshStandardMaterial({
        color: 0x42b7e4,
        roughness: 0.35,
        metalness: 0.15,
        emissive: 0x1878b0,
        emissiveIntensity: 0.35,
        flatShading: true,
      }),
      battle.drops.length,
    );
    this.missileMesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(0.075),
      new THREE.MeshBasicMaterial({ color: 0xc97ae2 }),
      battle.missiles.length,
    );
    // Dynamic instance bounds cannot be reused from an empty initial frame.
    for (const mesh of [this.coinMesh, this.crystalMesh, this.missileMesh]) {
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(mesh);
    }
    const wispMap = glowTexture();
    for (let i = 0; i < 16; i++) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: wispMap,
          color: 0x477b7a,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      );
      sprite.visible = false;
      scene.add(sprite);
      this.spawnWisps.push({ sprite, life: 0 });
    }
    for (let i = 0; i < 32; i++) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          transparent: true,
          depthTest: true,
          depthWrite: false,
        }),
      );
      sprite.visible = false;
      sprite.scale.set(0.68, 0.34, 1);
      scene.add(sprite);
      this.numbers.push({ sprite, life: 0 });
    }
    for (let i = 0; i < 20; i++) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.corpseMaps[0],
          transparent: true,
          alphaTest: 0.2,
          depthWrite: false,
        }),
      );
      sprite.visible = false;
      scene.add(sprite);
      this.corpses.push({ sprite, life: 0, vy: 0 });
    }
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.16, 1),
        new THREE.MeshBasicMaterial({ color: 0xffb95d }),
      );
      mesh.visible = false;
      scene.add(mesh);
      this.orbs.push({ mesh, velocity: new THREE.Vector3(), life: 0 });
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute(
      "position",
      new THREE.BufferAttribute(this.ringPositions, 3),
    );
    const indices: number[] = [];
    for (let i = 0; i < 64; i++) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    rg.setIndex(indices);
    this.ring = new THREE.Mesh(
      rg,
      new THREE.MeshBasicMaterial({
        color: 0x6bffdc,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.ring.frustumCulled = false;
    scene.add(this.ring);
    this.occluders = battle.solids.map(
      (b) =>
        new THREE.Box3(
          new THREE.Vector3(b.minX, b.base ?? 0, b.minZ),
          new THREE.Vector3(b.maxX, b.height, b.maxZ),
        ),
    );
  }
  burst(point: THREE.Vector3, color = 0xaaf5d2, count = 18, speed = 3) {
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      let p: Particle | undefined;
      for (let n = 0; n < this.particles.length; n++) {
        this.cursor = (this.cursor + 1) % this.particles.length;
        if (this.particles[this.cursor].life <= 0) {
          p = this.particles[this.cursor];
          break;
        }
      }
      if (!p) break;
      const life = 0.18 + Math.random() * 0.25;
      Object.assign(p, {
        life,
        max: life,
        x: point.x,
        y: Math.max(point.y, groundHeight(point.x, point.z) + 0.1),
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
    this.burst(
      position
        .clone()
        .add(new THREE.Vector3(direction.x * 0.2, -0.15, direction.z * 0.2)),
      0xffd47c,
      1,
      1.6,
    );
  }
  number(x: number, z: number, value: number, y = groundHeight(x, z) + 1.5) {
    const n = this.numbers.find((n) => n.life <= 0) || this.numbers[0],
      rounded = Math.round(value);
    let texture = this.numberTextures.get(rounded);
    if (!texture) {
      if (this.numberTextures.size >= 64) {
        for (const [key, map] of this.numberTextures) {
          if (
            this.numbers.some(
              (n) => n.life > 0 && n.sprite.material.map === map,
            )
          )
            continue;
          map.dispose();
          this.numberTextures.delete(key);
          break;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 64;
      const g = canvas.getContext("2d")!;
      g.font = "bold 36px monospace";
      g.textAlign = "center";
      g.lineWidth = 5;
      g.strokeStyle = "#112c26";
      g.strokeText(String(rounded), 64, 44);
      g.fillStyle = value > 45 ? "#ffe89b" : "#efffe7";
      g.fillText(String(rounded), 64, 44);
      texture = new THREE.CanvasTexture(canvas);
      this.numberTextures.set(rounded, texture);
    }
    n.sprite.material.map = texture;
    n.sprite.material.needsUpdate = true;
    const i = this.numbers.indexOf(n),
      angle = i * 2.39996;
    n.sprite.position.set(
      x + Math.cos(angle) * 0.18,
      y + 0.22 + Math.sin(angle) * 0.07,
      z,
    );
    n.life = 0.65;
    n.sprite.visible = true;
  }
  death(x: number, z: number, kind = 0) {
    const c = this.corpses.find((c) => c.life <= 0) || this.corpses[0],
      scale = ENEMY_TYPES[kind].scale;
    c.sprite.material.map = this.corpseMaps[kind];
    c.sprite.material.rotation = 0;
    c.sprite.material.opacity = 1;
    c.sprite.scale.set(1.25 * scale, 1.65 * scale, 1);
    c.sprite.position.set(x, groundHeight(x, z) + 0.85 * scale, z);
    c.sprite.visible = true;
    c.life = 0.65;
    c.vy = 2.4;
    this.burst(c.sprite.position, 0x8eb598, COMBAT_FEEL.deathCount, 2.2);
  }
  spawn(x: number, z: number) {
    const w = this.spawnWisps.find((w) => w.life <= 0);
    if (!w) return;
    w.sprite.position.set(x, groundHeight(x, z) + 0.45, z);
    w.life = 0.65;
    w.sprite.visible = true;
  }
  pulse(x: number, z: number) {
    this.ringOrigin.set(x, z);
    this.ringLife = 0.6;
  }
  orb(position: THREE.Vector3, direction: THREE.Vector3) {
    const o = this.orbs.find((o) => o.life <= 0);
    if (!o) return;
    o.life = 3;
    o.mesh.visible = true;
    o.mesh.position.copy(position).addScaledVector(direction, 0.8);
    o.velocity.copy(direction).multiplyScalar(19);
  }
  pickup(
    kind: "gold" | "xp",
    x: number,
    z: number,
    y = groundHeight(x, z) + 1,
  ) {
    this.burst(
      new THREE.Vector3(x, y, z),
      kind === "gold" ? 0xffd06c : 0x7cddff,
      4,
      0.7,
    );
  }
  update(dt: number, time: number, simulate: boolean) {
    let gold = 0,
      xp = 0,
      trails = 0;
    for (const d of this.battle.drops) {
      if (!d.active) continue;
      this.dummy.position.set(
        d.x,
        d.y + (d.magnet || d.age < 1.5 ? 0 : Math.sin(time * 3 + d.id) * 0.02),
        d.z,
      );
      this.dummy.rotation.set(
        d.kind === "gold" ? Math.PI / 2 : 0,
        time * 2 + d.id,
        0,
      );
      // Shrink as it reaches the player, avoiding a screen-filling pickup in the near plane.
      const scale = d.magnet
        ? Math.max(
            0.2,
            Math.min(
              1,
              Math.hypot(d.x - this.playerX, d.z - this.playerZ) / 1.25,
            ),
          )
        : 1;
      this.dummy.scale.set(scale, (d.kind === "xp" ? 1.55 : 1) * scale, scale);
      this.dummy.updateMatrix();
      if (d.kind === "gold")
        this.coinMesh.setMatrixAt(gold++, this.dummy.matrix);
      else this.crystalMesh.setMatrixAt(xp++, this.dummy.matrix);
      if (simulate) this.trailClocks[d.id] += dt;
      if (
        simulate &&
        d.magnet &&
        trails < 4 &&
        this.trailClocks[d.id] >= 0.065
      ) {
        this.trailClocks[d.id] = 0;
        this.burst(
          new THREE.Vector3(d.x, d.y, d.z),
          d.kind === "gold" ? 0xf7c95e : 0x66ceff,
          1,
          0.3,
        );
        trails++;
      }
    }
    this.coinMesh.count = gold;
    this.crystalMesh.count = xp;
    this.coinMesh.instanceMatrix.needsUpdate = true;
    this.crystalMesh.instanceMatrix.needsUpdate = true;
    let missileCount = 0;
    for (const m of this.battle.missiles) {
      if (!m.active) continue;
      this.dummy.position.set(m.x, m.y, m.z);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      this.missileMesh.setMatrixAt(missileCount++, this.dummy.matrix);
    }
    this.missileMesh.count = missileCount;
    this.missileMesh.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (simulate && p.life > 0) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vy -= 5 * dt;
        const floor = groundHeight(p.x, p.z) + 0.05;
        if (p.y < floor) {
          p.y = floor;
          p.vy = Math.abs(p.vy) * 0.15;
          p.vx *= 0.7;
          p.vz *= 0.7;
        }
      }
      const at = i * 3;
      this.positions[at] = p.life > 0 ? p.x : 0;
      this.positions[at + 1] = p.life > 0 ? p.y : -100;
      this.positions[at + 2] = p.life > 0 ? p.z : 0;
      const fade = Math.max(0, p.life / p.max);
      this.colors[at] = p.r * fade;
      this.colors[at + 1] = p.g * fade;
      this.colors[at + 2] = p.b * fade;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    if (!simulate) return;
    for (const w of this.spawnWisps)
      if (w.life > 0) {
        w.life = Math.max(0, w.life - dt);
        w.sprite.visible = w.life > 0;
        w.sprite.position.y += dt * 0.28;
        w.sprite.scale.set(0.8 + (0.65 - w.life) * 1.5, 0.7, 1);
        w.sprite.material.opacity = Math.sin((w.life / 0.65) * Math.PI) * 0.22;
      }
    for (const n of this.numbers)
      if (n.life > 0) {
        n.life -= dt;
        n.sprite.position.y += dt * 0.65;
        n.sprite.material.opacity = Math.max(0, Math.min(1, n.life * 4));
        n.sprite.visible = n.life > 0;
      }
    for (const c of this.corpses)
      if (c.life > 0) {
        c.life -= dt;
        c.sprite.position.y = Math.max(
          groundHeight(c.sprite.position.x, c.sprite.position.z) + 0.15,
          c.sprite.position.y + c.vy * dt,
        );
        c.vy -= 10 * dt;
        c.sprite.material.rotation += dt * 3;
        c.sprite.material.opacity = Math.max(0, c.life / 0.65);
        c.sprite.visible = c.life > 0;
      }
    for (const o of this.orbs)
      if (o.life > 0) {
        o.life -= dt;
        const start = o.mesh.position.clone(),
          delta = o.velocity.clone().multiplyScalar(dt);
        o.mesh.position.add(delta);
        const end = o.mesh.position;
        this.ray.set(start, delta.clone().normalize());
        let hit =
          end.y < groundHeight(end.x, end.z) + 0.1 ||
          this.occluders.some(
            (b) =>
              this.ray.intersectBox(b, this.point) !== null &&
              this.point.distanceTo(start) <= delta.length(),
          );
        for (const e of this.battle.alive) {
          const centre = new THREE.Vector3(
              e.x,
              groundHeight(e.x, e.z) + 0.85 * ENEMY_TYPES[e.kind].scale,
              e.z,
            ),
            v = centre.clone().sub(start),
            t = delta.lengthSq()
              ? THREE.MathUtils.clamp(v.dot(delta) / delta.lengthSq(), 0, 1)
              : 0;
          if (
            start.clone().addScaledVector(delta, t).distanceTo(centre) <
            0.6 * ENEMY_TYPES[e.kind].scale
          ) {
            hit = true;
            break;
          }
        }
        if (hit || o.life <= 0) {
          this.battle.explode(end);
          this.burst(end, 0xffb259, 22, 4);
          o.life = 0;
          o.mesh.visible = false;
        }
      }
    this.ringLife = Math.max(0, this.ringLife - dt);
    const radius = 1 + (1 - this.ringLife / 0.6) * 6;
    for (let i = 0; i <= 64; i++)
      for (let side = 0; side < 2; side++) {
        const angle = (i / 64) * Math.PI * 2,
          r = radius + side * 0.055,
          x = this.ringOrigin.x + Math.cos(angle) * r,
          z = this.ringOrigin.y + Math.sin(angle) * r;
        this.ringPositions.set(
          [x, groundHeight(x, z) + 0.07, z],
          (i * 2 + side) * 3,
        );
      }
    this.ring.geometry.attributes.position.needsUpdate = true;
    (this.ring.material as THREE.MeshBasicMaterial).opacity =
      this.ringLife / 0.6;
  }
  diagnostics() {
    return {
      gold: this.coinMesh.count,
      xp: this.crystalMesh.count,
      cullingDisabled:
        !this.coinMesh.frustumCulled && !this.crystalMesh.frustumCulled,
      particles: this.particles.filter((p) => p.life > 0).length,
      numberTextures: this.numberTextures.size,
    };
  }
  reset() {
    this.particles.forEach((p) => (p.life = 0));
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
    this.trailClocks.fill(0);
    for (const w of this.spawnWisps) {
      w.life = 0;
      w.sprite.visible = false;
    }
  }
  private playerX = 0;
  private playerZ = 0;
  followPlayer(x: number, z: number) {
    this.playerX = x;
    this.playerZ = z;
  }
}
