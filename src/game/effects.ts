import type { SplatterImpact } from "./particle-simulation";
import { coinGeometry, crystalGeometry } from "./loot-geometry";
import { SurfaceImpacts } from "./surface-impacts";
import type { SurfaceHit } from "./world-raycast";
import * as THREE from "three";
import { orbMaterial } from "./orb-material";
import { CombatScreen } from "./combat-screen";
import { ProceduralVFX } from "./procedural-vfx";
import { DamageNumbers } from "./damage-numbers";
import { WorldVisibility } from "./world-visibility";
import { EnemyRemnants } from "./enemy-remnants";
import { groundHeight } from "./terrain";
import { ENEMY_TYPES } from "./waves";
import type { Battle } from "./battle";
import { LOOT_FEEL } from "./tuning";
export class Effects {
  private dummy = new THREE.Object3D();
  private coinMesh: THREE.InstancedMesh;
  private lootTint = new THREE.Color();
  private crystalMesh: THREE.InstancedMesh;
  private missileMesh: THREE.InstancedMesh;
  private numbers: DamageNumbers;
  private viewportHeight = 1080;
  reduced = false;
  resize(height: number) {
    this.viewportHeight = height;
  }
  private remnants: EnemyRemnants;
  private scars: SurfaceImpacts;
  private orbClock = { value: 0 };
  private orbs: {
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
    life: number;
    trailClock: number;
  }[] = [];
  private ring: THREE.Mesh;
  private ringPositions = new Float32Array(65 * 2 * 3);
  private ringLife = 0;
  private ringOrigin = new THREE.Vector2();
  private occluders: THREE.Box3[];
  private ray = new THREE.Ray();
  private point = new THREE.Vector3();
  private lastHealth = 100;
  private healing = 0;
  private healCooldown = 0;
  private procedural: ProceduralVFX;
  private screen: CombatScreen;
  readonly screenScene = new THREE.Scene();
  readonly visibility: WorldVisibility;
  get impactScene() {
    return this.procedural.scene;
  }
  private stats = { impacts: 0, criticalNumbers: 0, deaths: 0, casts: 0 };
  private trailClocks: Float32Array;
  constructor(
    private scene: THREE.Scene,
    private battle: Battle,
    private camera: THREE.PerspectiveCamera,
  ) {
    this.remnants = new EnemyRemnants(scene, camera);
    this.scars = new SurfaceImpacts(scene);
    this.lastHealth = battle.health;
    this.trailClocks = new Float32Array(battle.drops.length);
    this.occluders = battle.solids.map(
      (b) =>
        new THREE.Box3(
          new THREE.Vector3(b.minX, b.base ?? 0, b.minZ),
          new THREE.Vector3(b.maxX, b.height, b.maxZ),
        ),
    );
    this.visibility = new WorldVisibility(this.occluders, groundHeight);
    this.procedural = new ProceduralVFX(scene, camera, this.visibility);
    this.screen = new CombatScreen(this.screenScene);
    this.coinMesh = new THREE.InstancedMesh(
      coinGeometry(),
      new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
      battle.drops.length,
    );
    this.crystalMesh = new THREE.InstancedMesh(
      crystalGeometry(),
      new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
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
    const fireMaterial = orbMaterial(this.orbClock),
      auraMaterial = new THREE.MeshBasicMaterial({
        color: 0xff8c2d,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
        toneMapped: false,
      });
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.16, 1),
        fireMaterial,
      );
      mesh.visible = false;
      scene.add(mesh);
      mesh.add(
        new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), auraMaterial),
      );
      this.orbs.push({
        mesh,
        velocity: new THREE.Vector3(),
        life: 0,
        trailClock: 0,
      });
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
    this.numbers = new DamageNumbers(camera, this.visibility);
  }
  get ready() {
    return Promise.resolve();
  }
  burst(point: THREE.Vector3, color = 0xaaf5d2, count = 18, speed = 3) {
    this.procedural.emit(
      "cast",
      point.x,
      point.y,
      point.z,
      Math.max(0.3, speed / 3),
      this.reduced,
      color,
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
    this.numbers.spawn(x, z, value, y, critical, details);
    if (critical) this.stats.criticalNumbers++;
  }
  impact(
    x: number,
    y: number,
    z: number,
    critical = false,
    _bullet = true,
    scale = 1,
    _incoming?: { x: number; y: number; z: number },
    normal?: { x: number; y: number; z: number },
  ) {
    this.stats.impacts++;
    this.procedural.emit(
      critical ? "critical" : "hit",
      x,
      y,
      z,
      scale,
      this.reduced,
      undefined,
      normal?.x ?? 0,
      normal?.z ?? 0,
    );
  }
  surfaceImpact(hit: SurfaceHit) {
    this.scars.emit(hit);
    const color =
      hit.surface === "wood"
        ? 0xc29559
        : hit.surface === "earth"
          ? 0x9f9969
          : hit.surface === "foliage"
            ? 0x5f9c64
            : 0xc3c5ac;
    this.procedural.emit(
      "surface",
      hit.point.x,
      hit.point.y,
      hit.point.z,
      1,
      this.reduced,
      color,
      hit.normal.x,
      hit.normal.z,
      false,
      hit.normal.y,
    );
  }
  setSurfaceFloor(query: (x: number, z: number, ceiling: number) => number) {
    this.procedural.simulation.surfaceFloor = query;
  }
  cast(point: THREE.Vector3, orb: boolean) {
    this.stats.casts++;
    this.procedural.emit(
      "cast",
      point.x,
      point.y,
      point.z,
      0.7,
      this.reduced,
      orb ? 0xffbd48 : 0x79ffe0,
    );
  }
  levelUp(x: number, z: number) {
    this.screen.level();
    this.pulse(x, z, false);
    this.procedural.emit(
      "level",
      x,
      groundHeight(x, z) + 0.65,
      z,
      1,
      this.reduced,
    );
  }
  playerHurt() {
    this.screen.hit();
    this.point
      .set(-0.65, -0.35, -1.4)
      .applyQuaternion(this.camera.quaternion)
      .add(this.camera.position);
    this.procedural.emit(
      "hurt",
      this.point.x,
      this.point.y,
      this.point.z,
      0.3,
      this.reduced,
    );
  }
  death(
    x: number,
    z: number,
    kind = 0,
    critical = false,
    incomingX = 0,
    incomingZ = 0,
    magic = false,
    impact?: SplatterImpact,
  ) {
    const scale = ENEMY_TYPES[kind].scale;
    this.remnants.spawn(x, z, kind);
    this.stats.deaths++;
    this.procedural.emit(
      "death",
      x,
      groundHeight(x, z) + 0.85 * scale,
      z,
      scale,
      this.reduced,
      undefined,
      incomingX,
      incomingZ,
      critical,
      0,
      impact,
    );
    if (magic)
      this.procedural.emit(
        "soul",
        x,
        groundHeight(x, z) + 0.9 * scale,
        z,
        scale,
        this.reduced,
      );
  }
  spawn(x: number, z: number) {
    this.procedural.emit(
      "spawn",
      x,
      groundHeight(x, z) + 0.45,
      z,
      1,
      this.reduced,
      0x63d5ae,
    );
  }
  pulse(x: number, z: number, ability = true) {
    this.ringOrigin.set(x, z);
    this.ringLife = 0.85;
    if (ability) this.screen.nova();
    if (ability)
      this.procedural.emit(
        "nova",
        x,
        groundHeight(x, z) + 0.65,
        z,
        1,
        this.reduced,
      );
  }
  orb(position: THREE.Vector3, direction: THREE.Vector3) {
    const o = this.orbs.find((o) => o.life <= 0);
    if (!o) return;
    o.life = 3;
    o.trailClock = 0;
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
    this.procedural.emit(
      "pickup",
      x,
      y,
      z,
      1,
      this.reduced,
      kind === "gold" ? 0xffda67 : 0x81e7ff,
    );
  }
  step(dt: number, time: number) {
    this.orbClock.value += dt;
    this.healing += Math.max(0, this.battle.health - this.lastHealth);
    this.lastHealth = this.battle.health;
    this.healCooldown = Math.max(0, this.healCooldown - dt);
    if (this.healing >= 0.5 && this.healCooldown === 0) {
      this.point
        .set(0.85, -0.5, -1.8)
        .applyQuaternion(this.camera.quaternion)
        .add(this.camera.position);
      this.procedural.emit(
        "heal",
        this.point.x,
        this.point.y,
        this.point.z,
        1,
        this.reduced,
      );
      this.healing = 0;
      this.healCooldown = 0.35;
    }
    let trails = 0;
    for (const d of this.battle.drops)
      if (d.active) {
        this.trailClocks[d.id] += dt;
        if (d.magnet && trails < 6 && this.trailClocks[d.id] >= 0.055) {
          this.trailClocks[d.id] = 0;
          trails++;
          this.procedural.emit(
            "trail",
            d.x,
            d.y,
            d.z,
            1,
            this.reduced,
            d.kind === "gold" ? 0xffdb79 : 0x74dcff,
          );
        }
      }
    this.procedural.step(dt);
    this.screen.step(dt, this.reduced);
    this.numbers.step(dt);
    this.remnants.step(dt);
    this.scars.step(dt);
    for (const o of this.orbs)
      if (o.life > 0) {
        o.life -= dt;
        const start = o.mesh.position.clone(),
          delta = o.velocity.clone().multiplyScalar(dt);
        o.mesh.position.add(delta);
        const end = o.mesh.position;
        o.mesh.scale.setScalar(1 + 0.07 * Math.sin(this.orbClock.value * 18));
        o.mesh.rotation.y += dt * 2.5;
        o.trailClock += dt;
        if (o.trailClock >= 0.045) {
          o.trailClock %= 0.045;
          this.procedural.emit("orb", end.x, end.y, end.z, 1, this.reduced);
        }
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
          this.procedural.emit(
            "explosion",
            end.x,
            end.y,
            end.z,
            1,
            this.reduced,
          );
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
        d.y +
          (d.magnet || d.age < 0.8
            ? 0
            : Math.sin(time * LOOT_FEEL.bobSpeed + d.id) * LOOT_FEEL.bobHeight),
        d.z,
      );
      this.dummy.rotation.set(
        Math.sin(time * 1.7 + d.id) * 0.07,
        time * 1.8 + d.id,
        Math.sin(time * 1.3 + d.id) * 0.08,
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
      this.dummy.scale.setScalar(scale);
      this.dummy.updateMatrix();
      this.lootTint.setScalar(0.96 + Math.sin(time * 2.2 + d.id) * 0.04);
      if (d.kind === "gold") {
        this.coinMesh.setMatrixAt(gold, this.dummy.matrix);
        this.coinMesh.setColorAt(gold++, this.lootTint);
      } else {
        this.crystalMesh.setMatrixAt(xp, this.dummy.matrix);
        this.crystalMesh.setColorAt(xp++, this.lootTint);
      }
    }
    this.coinMesh.count = gold;
    this.crystalMesh.count = xp;
    this.coinMesh.instanceMatrix.needsUpdate = true;
    this.crystalMesh.instanceMatrix.needsUpdate = true;
    if (this.coinMesh.instanceColor)
      this.coinMesh.instanceColor.needsUpdate = true;
    if (this.crystalMesh.instanceColor)
      this.crystalMesh.instanceColor.needsUpdate = true;
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
    this.camera.updateMatrixWorld();
    this.numbers.render(this.viewportHeight, this.reduced);
    this.remnants.render();
    this.scars.render();
    this.procedural.render(this.viewportHeight);
    const radius = 1 + (1 - this.ringLife / 0.85) * 6;
    for (let i = 0; i <= 64; i++)
      for (let side = 0; side < 2; side++) {
        const angle = (i / 64) * Math.PI * 2,
          r = radius + side * 0.16,
          x = this.ringOrigin.x + Math.cos(angle) * r,
          z = this.ringOrigin.y + Math.sin(angle) * r;
        this.ringPositions.set(
          [x, groundHeight(x, z) + 0.07, z],
          (i * 2 + side) * 3,
        );
      }
    this.ring.geometry.attributes.position.needsUpdate = true;
    (this.ring.material as THREE.MeshBasicMaterial).opacity =
      this.ringLife / 0.85;
  }
  diagnostics() {
    return {
      gold: this.coinMesh.count,
      xp: this.crystalMesh.count,
      cullingDisabled:
        !this.coinMesh.frustumCulled && !this.crystalMesh.frustumCulled,
      particles: this.procedural.simulation.active,
      numberTextures: 0,
      shards: this.procedural.diagnostics().shapes.ribbons,
      flashes: 0,
      procedural: this.procedural.diagnostics(),
      screen: this.screen.diagnostics(),
      remnants: this.remnants.diagnostics(),
      surfaces: this.scars.diagnostics(),
      numbers: this.numbers.diagnostics(),
      totals: { ...this.stats },
    };
  }
  reset() {
    this.lastHealth = this.battle.health;
    this.healing = this.healCooldown = 0;
    this.orbClock.value = 0;
    this.numbers.reset();
    this.remnants.reset();
    this.scars.reset();
    for (const o of this.orbs) {
      o.life = 0;
      o.mesh.visible = false;
    }
    this.ringLife = 0;
    this.trailClocks.fill(0);
    this.procedural.reset();
    this.screen.reset();
    this.stats = { impacts: 0, criticalNumbers: 0, deaths: 0, casts: 0 };
  }
  private playerX = 0;
  private playerZ = 0;
  followPlayer(x: number, z: number) {
    this.playerX = x;
    this.playerZ = z;
  }
}
