import * as THREE from "three";
import { fadingMaterial } from "./vfx-material";
import { glowTexture, guardTexture } from "./textures";
import { groundHeight } from "./terrain";
import { ENEMY_TYPES } from "./waves";
import type { Battle } from "./battle";
import { COMBAT_FEEL, LOOT_FEEL } from "./tuning";
import { surface } from "./surfaces";
import {
  PixelShards,
  SHARD_COLORS,
  damageNumberPose,
  damageLabel,
} from "./presentation";
import { PRESENTATION as P } from "./tuning";
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
  private numbers: {
    sprite: THREE.Sprite;
    life: number;
    age: number;
    critical: boolean;
    value: number;
    seed: number;
    origin: THREE.Vector3;
    seen: boolean;
    important: boolean;
    headshot: boolean;
    glyphRatio: number;
  }[] = [];
  private numberSerial = 0;
  private viewportHeight = 1080;
  resize(height: number) {
    this.viewportHeight = height;
  }
  private numberTextures = new Map<string, THREE.CanvasTexture>();
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
  private shardPool = new PixelShards();
  private shardMesh: THREE.InstancedMesh;
  private flashMesh: THREE.InstancedMesh;
  private shardAlpha: THREE.InstancedBufferAttribute;
  private flashAlpha: THREE.InstancedBufferAttribute;
  private shardColors = SHARD_COLORS.map((c) => new THREE.Color(c));
  private flashes = Array.from({ length: P.flashCapacity }, () => ({
    life: 0,
    max: 0.08,
    x: 0,
    y: 0,
    z: 0,
    scale: 1,
    seen: true,
  }));
  private stats = { impacts: 0, criticalNumbers: 0, deaths: 0, casts: 0 };
  private trailClocks: Float32Array;
  private spawnWisps: { sprite: THREE.Sprite; life: number }[] = [];
  constructor(
    private scene: THREE.Scene,
    private battle: Battle,
    private camera: THREE.PerspectiveCamera,
  ) {
    this.trailClocks = new Float32Array(battle.drops.length);
    const shardGeometry = new THREE.PlaneGeometry(1, 1),
      flashGeometry = new THREE.RingGeometry(0.55, 1, 16);
    this.shardAlpha = new THREE.InstancedBufferAttribute(
      new Float32Array(P.shardCapacity),
      1,
    );
    this.flashAlpha = new THREE.InstancedBufferAttribute(
      new Float32Array(P.flashCapacity),
      1,
    );
    this.shardAlpha.setUsage(THREE.DynamicDrawUsage);
    this.flashAlpha.setUsage(THREE.DynamicDrawUsage);
    shardGeometry.setAttribute("vfxOpacity", this.shardAlpha);
    flashGeometry.setAttribute("vfxOpacity", this.flashAlpha);
    this.shardMesh = new THREE.InstancedMesh(
      shardGeometry,
      fadingMaterial(true),
      P.shardCapacity,
    );
    this.flashMesh = new THREE.InstancedMesh(
      flashGeometry,
      fadingMaterial(false),
      P.flashCapacity,
    );
    this.shardMesh.setColorAt(0, new THREE.Color(0xffffff));
    for (const mesh of [this.shardMesh, this.flashMesh]) {
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(mesh);
    }
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
        map: surface("spark"),
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
        map: surface("coin"),
        color: 0xffedc6,
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
        map: surface("crystal"),
        color: 0x72d9f5,
        roughness: 0.35,
        metalness: 0.15,
        emissive: 0x1878b0,
        emissiveIntensity: 0.48,
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
          toneMapped: false,
        }),
      );
      sprite.visible = false;
      sprite.scale.set(0.68, 0.34, 1);
      scene.add(sprite);
      this.numbers.push({
        sprite,
        life: 0,
        age: 0,
        critical: false,
        value: 0,
        seed: i,
        origin: new THREE.Vector3(),
        seen: true,
        important: false,
        headshot: false,
        glyphRatio: 0.625,
      });
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
  number(
    x: number,
    z: number,
    value: number,
    y = groundHeight(x, z) + 1.5,
    critical = false,
    details: { headshot?: boolean; killed?: boolean } = {},
  ) {
    let n = this.numbers.find((n) => n.life <= 0);
    const important = critical || !!details.killed;
    if (!n)
      for (const candidate of this.numbers) {
        if (candidate.important && !important) continue;
        if (
          !n ||
          (!candidate.important && n.important) ||
          (candidate.important === n.important && candidate.life < n.life)
        )
          n = candidate;
      }
    if (!n) return;
    const label = damageLabel(value),
      fontSize = Math.min(40, 104 / (label.length * 0.62)),
      key = `${label}:${critical}:${!!details.headshot}`;
    let texture = this.numberTextures.get(key);
    if (!texture) {
      if (this.numberTextures.size >= 64)
        for (const [k, map] of this.numberTextures) {
          if (
            this.numbers.some(
              (n) => n.life > 0 && n.sprite.material.map === map,
            )
          )
            continue;
          map.dispose();
          this.numberTextures.delete(k);
          break;
        }
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 64;
      const g = canvas.getContext("2d")!;
      g.imageSmoothingEnabled = false;
      g.font = `600 ${fontSize}px "Pixelify Sans",monospace`;
      g.textAlign = "center";
      g.lineWidth = 6;
      g.strokeStyle = "#10221d";
      g.strokeText(label, 64, 45);
      g.fillStyle = details.headshot
        ? "#ff9254"
        : critical
          ? "#ffbe61"
          : "#f5fff0";
      g.fillText(label, 64, 45);
      texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = texture.minFilter = THREE.NearestFilter;
      this.numberTextures.set(key, texture);
    }
    n.sprite.material.map = texture;
    n.sprite.material.needsUpdate = true;
    n.seed = ++this.numberSerial;
    const angle = n.seed * 2.39996;
    n.origin.set(
      x + Math.cos(angle) * 0.13,
      y + 0.2 + Math.sin(angle) * 0.07,
      z,
    );
    n.life = critical ? P.criticalNumberLife : P.numberLife;
    n.age = 0;
    n.critical = critical;
    n.value = Number(label);
    n.important = important;
    n.headshot = !!details.headshot;
    n.glyphRatio = fontSize / 64;
    n.seen = false;
    if (critical) this.stats.criticalNumbers++;
  }
  impact(x: number, y: number, z: number, critical = false, bullet = true) {
    this.stats.impacts++;
    if (bullet) {
      this.whiteFlash(x, y, z, critical ? 1.2 : 1);
      // Lift fragments just off the shallow body surface to avoid depth fighting.
      this.point
        .set(
          this.camera.position.x - x,
          this.camera.position.y - y,
          this.camera.position.z - z,
        )
        .normalize()
        .multiplyScalar(0.09);
      this.shardPool.spawn(
        x + this.point.x,
        y + this.point.y,
        z + this.point.z,
        critical ? 10 : 7,
      );
    } else this.shardPool.spawn(x, y, z, 3);
    this.burst(new THREE.Vector3(x, y, z), 0xfff6de, 2, 1.5);
  }
  private whiteFlash(x: number, y: number, z: number, scale = 1) {
    const f = this.flashes.find((f) => f.life <= 0 && f.seen);
    if (!f) return;
    Object.assign(f, { x, y, z, scale, max: 0.085, life: 0.085, seen: false });
  }
  cast(point: THREE.Vector3, orb: boolean) {
    this.stats.casts++;
    this.burst(point, orb ? 0xffb953 : 0x78efd3, 14, 2.2);
    this.whiteFlash(point.x, point.y, point.z, 0.65);
  }
  levelUp(x: number, z: number) {
    this.pulse(x, z);
    this.burst(
      new THREE.Vector3(x, groundHeight(x, z) + 0.5, z),
      0x75dfff,
      32,
      3,
    );
    this.burst(
      new THREE.Vector3(x, groundHeight(x, z) + 0.6, z),
      0xffefab,
      10,
      2,
    );
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
    this.stats.deaths++;
    this.shardPool.spawn(
      x,
      c.sprite.position.y,
      z,
      kind === 2 ? 22 : kind === 3 ? 18 : 12,
      true,
      Math.min(1.4, scale),
    );
    this.whiteFlash(x, c.sprite.position.y, z, scale);
    this.burst(c.sprite.position, 0xffc785, 6, 2.2);
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
    o.mesh.position.copy(position).addScaledVector(direction, 0.25);
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
  step(dt: number, time: number) {
    for (const p of this.particles) {
      if (p.life > 0) {
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
    }
    let trails = 0;
    for (const d of this.battle.drops)
      if (d.active) {
        this.trailClocks[d.id] += dt;
        if (d.magnet && trails < 6 && this.trailClocks[d.id] >= 0.055) {
          this.trailClocks[d.id] = 0;
          trails++;
          this.burst(
            new THREE.Vector3(d.x, d.y, d.z),
            d.kind === "gold" ? 0xf7c95e : 0x66ceff,
            1,
            0.25,
          );
        }
      }
    this.shardPool.update(dt, groundHeight);
    for (const f of this.flashes) if (f.life > 0) f.life -= dt;
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
        n.age += dt;
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
  }
  /** Upload dynamic visual buffers once per rendered frame, after fixed-step catch-up. */
  render(time: number) {
    let gold = 0,
      xp = 0;
    for (const d of this.battle.drops) {
      if (!d.active) continue;
      this.dummy.position.set(
        d.x,
        d.y + (d.magnet || d.age < 0.8 ? 0 : Math.sin(time * 3 + d.id) * 0.02),
        d.z,
      );
      this.dummy.rotation.set(
        d.kind === "gold" ? Math.PI / 2 : 0,
        time * 2 + d.id,
        0,
        "YXZ",
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

    for (const n of this.numbers) {
      const visible = n.life > 0 || !n.seen;
      n.sprite.visible = visible;
      if (!visible) continue;
      const age = n.seen ? n.age : Math.min(0.1, n.age),
        pose = damageNumberPose(age, n.critical, n.seed);
      n.sprite.position.copy(n.origin);
      n.sprite.position.y += pose.rise;
      n.sprite.position.x += Math.cos(this.camera.rotation.y) * pose.side;
      n.sprite.position.z -= Math.sin(this.camera.rotation.y) * pose.side;
      const distance = n.origin.distanceTo(this.camera.position),
        focal =
          this.viewportHeight /
          (2 * Math.tan((this.camera.fov * Math.PI) / 360));
      const height = Math.max(
        0.2,
        Math.min(3.6, (18 * distance) / (focal * n.glyphRatio)),
      );
      const lane = ((n.seed % 5) - 2) * height * 0.32;
      n.sprite.position.x += Math.cos(this.camera.rotation.y) * lane;
      n.sprite.position.z -= Math.sin(this.camera.rotation.y) * lane;
      n.sprite.position.y += (n.seed % 3) * height * 0.16;
      n.sprite.scale.set(height * 2 * pose.scale, height * pose.scale, 1);
      n.sprite.material.opacity = pose.opacity;
      n.seen = true;
    }
    let shards = 0;
    for (const p of this.shardPool.items)
      if (p.life > 0) {
        const fade = p.life / p.max;
        this.dummy.position.set(p.x, p.y, p.z);
        this.dummy.quaternion.copy(this.camera.quaternion);
        this.dummy.rotateZ(p.angle);
        this.dummy.scale.set(
          p.size * (0.5 + fade * 0.5),
          p.size * (0.5 + fade * 0.5) * 0.75,
          1,
        );
        this.dummy.updateMatrix();
        this.shardMesh.setMatrixAt(shards, this.dummy.matrix);
        this.shardMesh.setColorAt(shards, this.shardColors[p.color]);
        this.shardAlpha.setX(shards++, Math.min(1, fade * 3));
      }
    this.shardMesh.count = shards;
    this.shardMesh.instanceMatrix.needsUpdate = true;
    this.shardMesh.instanceColor!.needsUpdate = true;
    this.shardAlpha.needsUpdate = true;
    let flashes = 0;
    for (const f of this.flashes)
      if (f.life > 0 || !f.seen) {
        const age = f.seen ? f.max - f.life : Math.min(0.025, f.max - f.life),
          t = Math.min(1, age / f.max),
          scale = (0.035 + t * 0.075) * f.scale;
        this.point
          .set(
            this.camera.position.x - f.x,
            this.camera.position.y - f.y,
            this.camera.position.z - f.z,
          )
          .normalize()
          .multiplyScalar(0.02);
        this.dummy.position.set(
          f.x + this.point.x,
          f.y + this.point.y,
          f.z + this.point.z,
        );
        this.dummy.quaternion.copy(this.camera.quaternion);
        this.dummy.scale.setScalar(scale);
        this.dummy.updateMatrix();
        this.flashMesh.setMatrixAt(flashes, this.dummy.matrix);
        this.flashAlpha.setX(flashes++, 1 - t);
        f.seen = true;
      }
    this.flashMesh.count = flashes;
    this.flashMesh.instanceMatrix.needsUpdate = true;
    this.flashAlpha.needsUpdate = true;
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
      shards: this.shardMesh.count,
      flashes: this.flashMesh.count,
      numbers: this.numbers
        .filter((n) => n.life > 0)
        .map((n) => ({
          value: n.value,
          critical: n.critical,
          age: n.age,
          headshot: n.headshot,
          important: n.important,
        })),
      totals: { ...this.stats },
    };
  }
  reset() {
    this.numberSerial = 0;
    this.particles.forEach((p) => (p.life = 0));
    for (const n of this.numbers) {
      n.life = 0;
      n.seen = true;
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
    this.shardPool.reset();
    for (const f of this.flashes) {
      f.life = 0;
      f.seen = true;
    }
    this.stats = { impacts: 0, criticalNumbers: 0, deaths: 0, casts: 0 };
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
