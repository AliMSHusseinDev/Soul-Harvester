import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { seededRandom, type Solid } from "./math";
import { stoneTexture, groundTexture, glowTexture } from "./textures";
export interface Flame {
  position: THREE.Vector3;
  light: THREE.PointLight;
  sprite: THREE.Sprite;
  phase: number;
}
export class World {
  readonly solids: Solid[] = [];
  readonly flames: Flame[] = [];
  readonly bell = new THREE.Group();
  readonly bellPosition = new THREE.Vector3(0, 4.9, -20.7);
  private readonly rng = seededRandom(6601);
  private readonly dummy = new THREE.Object3D();
  private readonly stone = new THREE.MeshStandardMaterial({
    map: stoneTexture(),
    color: 0xa8b5a8,
    roughness: 0.96,
  });
  private readonly darkStone = new THREE.MeshStandardMaterial({
    color: 0x283934,
    roughness: 1,
  });
  private readonly wood = new THREE.MeshStandardMaterial({
    color: 0x30291c,
    roughness: 0.95,
  });
  private readonly metal = new THREE.MeshStandardMaterial({
    color: 0x172b29,
    metalness: 0.7,
    roughness: 0.55,
  });
  private readonly glow = glowTexture();
  private readonly fireGeometry = new THREE.BufferGeometry();
  private readonly motes: THREE.Points;
  private readonly moteBase: Float32Array;
  constructor(readonly scene: THREE.Scene) {
    scene.background = new THREE.Color(0x132a29);
    scene.fog = new THREE.FogExp2(0x19332f, 0.018);
    scene.add(new THREE.HemisphereLight(0xa2c6bd, 0x17231a, 2.15));
    const moonlight = new THREE.DirectionalLight(0xc7e1d0, 2.7);
    moonlight.position.set(-18, 35, -22);
    moonlight.castShadow = true;
    moonlight.shadow.mapSize.set(2048, 2048);
    moonlight.shadow.camera.left = -30;
    moonlight.shadow.camera.right = 30;
    moonlight.shadow.camera.top = 30;
    moonlight.shadow.camera.bottom = -30;
    moonlight.shadow.camera.far = 95;
    moonlight.shadow.bias = -0.001;
    scene.add(moonlight);
    const front = new THREE.DirectionalLight(0x9bb4a2, 0.55);
    front.position.set(8, 8, 18);
    scene.add(front);
    this.sky();
    this.ground();
    this.fortress();
    this.details();
    this.forest();
    const n = 150;
    this.moteBase = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      this.moteBase[i * 3] = (this.rng() - 0.5) * 36;
      this.moteBase[i * 3 + 1] = this.rng() * 8 + 0.2;
      this.moteBase[i * 3 + 2] = (this.rng() - 0.5) * 43;
    }
    this.batchStaticMeshes();
    this.fireGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.moteBase.slice(), 3),
    );
    this.motes = new THREE.Points(
      this.fireGeometry,
      new THREE.PointsMaterial({
        color: 0x9bdab7,
        size: 0.045,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        map: this.glow,
      }),
    );
    scene.add(this.motes);
  }
  private batchStaticMeshes() {
    // Immutable props sharing materials are merged once; animated objects stay independent.
    const batches = new Map<
      string,
      {
        material: THREE.Material;
        geometries: THREE.BufferGeometry[];
        objects: THREE.Mesh[];
        cast: boolean;
        receive: boolean;
      }
    >();
    this.scene.updateMatrixWorld(true);
    for (const object of [...this.scene.children]) {
      if (
        !(object instanceof THREE.Mesh) ||
        object instanceof THREE.InstancedMesh ||
        Array.isArray(object.material) ||
        object.material instanceof THREE.ShaderMaterial
      )
        continue;
      const key =
        object.material.uuid + object.castShadow + object.receiveShadow;
      let batch = batches.get(key);
      if (!batch) {
        batch = {
          material: object.material,
          geometries: [],
          objects: [],
          cast: object.castShadow,
          receive: object.receiveShadow,
        };
        batches.set(key, batch);
      }
      batch.geometries.push(
        object.geometry.clone().applyMatrix4(object.matrixWorld),
      );
      batch.objects.push(object);
    }
    for (const b of batches.values()) {
      if (b.objects.length < 2) {
        b.geometries.forEach((g) => g.dispose());
        continue;
      }
      const merged = mergeGeometries(b.geometries, false);
      b.geometries.forEach((g) => g.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, b.material);
      mesh.castShadow = b.cast;
      mesh.receiveShadow = b.receive;
      mesh.name = "Batched courtyard masonry";
      this.scene.add(mesh);
      for (const object of b.objects) {
        this.scene.remove(object);
        object.geometry.dispose();
      }
    }
  }
  private box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material = this.stone,
    collision = false,
  ) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    this.scene.add(m);
    if (collision) this.solid(x, z, w, d, y + h / 2);
    return m;
  }
  private solid(x: number, z: number, w: number, d: number, height: number) {
    this.solids.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
      height,
    });
  }
  private sky() {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(190, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {},
        vertexShader:
          "varying vec3 vPosition; void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
        fragmentShader:
          "varying vec3 vPosition; void main(){float h=normalize(vPosition).y; vec3 c=mix(vec3(.16,.24,.21),vec3(.025,.075,.085),smoothstep(-.1,.8,h));gl_FragColor=vec4(c,1.);}",
        fog: false,
      }),
    );
    this.scene.add(sky);
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(7.3, 48, 32),
      new THREE.MeshBasicMaterial({ color: 0xdee5b6, fog: false }),
    );
    moon.position.set(-18, 33, -85);
    this.scene.add(moon);
    // Soft lunar halo; the disk remains crisp against the haze.
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glow,
        color: 0xc3d4a0,
        transparent: true,
        opacity: 0.24,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    halo.position.copy(moon.position).add(new THREE.Vector3(0, 0, -1));
    halo.scale.set(44, 44, 1);
    this.scene.add(halo);
    const stars = new Float32Array(250 * 3);
    for (let i = 0; i < 250; i++) {
      stars[i * 3] = (this.rng() - 0.5) * 260;
      stars[i * 3 + 1] = 30 + this.rng() * 100;
      stars[i * 3 + 2] = -80 - this.rng() * 60;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(stars, 3));
    this.scene.add(
      new THREE.Points(
        g,
        new THREE.PointsMaterial({
          color: 0xbdd4c6,
          size: 0.16,
          fog: false,
          transparent: true,
          opacity: 0.55,
        }),
      ),
    );
    for (let i = 0; i < 16; i++) {
      const mountain = new THREE.Mesh(
        new THREE.ConeGeometry(14 + this.rng() * 15, 25 + this.rng() * 23, 4),
        new THREE.MeshBasicMaterial({ color: i % 2 ? 0x1c3330 : 0x142c2a }),
      );
      mountain.position.set((i - 8) * 18, -2, -100 - this.rng() * 30);
      mountain.rotation.y = this.rng() * 3;
      this.scene.add(mountain);
    }
  }
  private ground() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 170),
      new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    // Broken flagstone path, deliberately irregular rather than a perfect grid.
    const count = 440;
    const path = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 0.055, 1),
      new THREE.MeshStandardMaterial({ color: 0x646b57, roughness: 1 }),
      count,
    );
    let n = 0;
    for (let z = -24; z < 25; z += 1.02)
      for (let x = -3.8; x < 4; x += 0.92) {
        if (this.rng() < 0.08) continue;
        this.dummy.position.set(
          x + (this.rng() - 0.5) * 0.15,
          0.015,
          z + (this.rng() - 0.5) * 0.15,
        );
        this.dummy.rotation.set(0, (this.rng() - 0.5) * 0.13, 0);
        this.dummy.scale.set(
          0.78 + this.rng() * 0.13,
          1,
          0.85 + this.rng() * 0.1,
        );
        this.dummy.updateMatrix();
        path.setMatrixAt(n, this.dummy.matrix);
        path.setColorAt(
          n,
          new THREE.Color().setHSL(0.14, 0.1, 0.23 + this.rng() * 0.11),
        );
        n++;
      }
    path.count = n;
    path.receiveShadow = true;
    this.scene.add(path);
    // Instanced crossed grass blades, one draw call for the whole courtyard.
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          -0.06, 0, 0, 0.06, 0, 0, 0.01, 0.45, 0, 0, 0, -0.06, 0, 0, 0.06, 0,
          0.4, 0,
        ],
        3,
      ),
    );
    geo.computeVertexNormals();
    const grass = new THREE.InstancedMesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: 0x63794b,
        side: THREE.DoubleSide,
        roughness: 1,
      }),
      9000,
    );
    let j = 0;
    for (let i = 0; i < 11000 && j < 9000; i++) {
      const x = (this.rng() - 0.5) * 46,
        z = (this.rng() - 0.5) * 62;
      if (Math.abs(x) < 4.3 && Math.abs(z) < 26) continue;
      this.dummy.position.set(x, 0.01, z);
      this.dummy.rotation.set(0, this.rng() * Math.PI, 0);
      const s = 0.4 + this.rng() * 0.9;
      this.dummy.scale.set(s, s, s);
      this.dummy.updateMatrix();
      grass.setMatrixAt(j, this.dummy.matrix);
      grass.setColorAt(
        j,
        new THREE.Color().setHSL(
          0.23 + this.rng() * 0.05,
          0.19,
          0.19 + this.rng() * 0.12,
        ),
      );
      j++;
    }
    grass.count = j;
    this.scene.add(grass);
  }
  private blockWall(
    x: number,
    z: number,
    length: number,
    height: number,
    axis: "x" | "z" = "x",
  ) {
    const rows = Math.ceil(height / 0.95),
      cols = Math.ceil(length / 1.9);
    const wall = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1.83, 0.89, 1.35),
      this.stone,
      rows * cols + cols,
    );
    let n = 0;
    for (let y = 0; y < rows; y++)
      for (let i = 0; i < cols; i++) {
        const along = (i - (cols - 1) / 2) * 1.87 + (y % 2) * 0.18;
        this.dummy.position.set(
          x + (axis === "x" ? along : 0),
          0.47 + y * 0.94,
          z + (axis === "z" ? along : 0),
        );
        this.dummy.rotation.set(0, axis === "z" ? Math.PI / 2 : 0, 0);
        this.dummy.scale.set(1, 1, 1);
        this.dummy.updateMatrix();
        wall.setMatrixAt(n, this.dummy.matrix);
        wall.setColorAt(n, new THREE.Color().setScalar(0.6 + this.rng() * 0.4));
        n++;
      }
    for (let i = 0; i < cols; i += 2) {
      const along = (i - (cols - 1) / 2) * 1.87;
      this.dummy.position.set(
        x + (axis === "x" ? along : 0),
        rows * 0.94 + 0.5,
        z + (axis === "z" ? along : 0),
      );
      this.dummy.rotation.y = axis === "z" ? Math.PI / 2 : 0;
      this.dummy.scale.set(0.8, 1, 1.1);
      this.dummy.updateMatrix();
      wall.setMatrixAt(n++, this.dummy.matrix);
    }
    wall.count = n;
    wall.castShadow = true;
    wall.receiveShadow = true;
    this.scene.add(wall);
    this.solid(
      x,
      z,
      axis === "x" ? cols * 1.87 : 1.35,
      axis === "z" ? cols * 1.87 : 1.35,
      rows * 0.94 + 1,
    );
  }
  private tower(x: number, z: number, height: number) {
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(3.7, 4, height, 8),
      this.stone,
    );
    tower.position.set(x, height / 2, z);
    tower.castShadow = true;
    tower.receiveShadow = true;
    this.scene.add(tower);
    this.solid(x, z, 7.3, 7.3, height);
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(4.05, 3.85, 0.55, 8),
      this.darkStone,
    );
    rim.position.set(x, height - 0.2, z);
    this.scene.add(rim);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const b = this.box(
        x + Math.sin(a) * 3.4,
        height + 0.45,
        z + Math.cos(a) * 3.4,
        1.3,
        1.3,
        1.3,
      );
      b.rotation.y = a;
    }
    // Narrow inset windows, glowing behind the stone tracery.
    const wm = new THREE.MeshBasicMaterial({ color: 0x8cae8e });
    for (const dx of [-0.85, 0.85]) {
      this.box(x + dx, height * 0.63, z + 3.76, 0.32, 1.5, 0.035, this.metal);
      this.box(x + dx, height * 0.63, z + 3.79, 0.13, 1.2, 0.04, wm);
    }
  }
  private fortress() {
    this.blockWall(-13, -22, 12, 7);
    this.blockWall(13, -22, 12, 7);
    this.tower(-7.1, -22, 11.5);
    this.tower(7.1, -22, 10.5);
    this.blockWall(-20, 0, 44, 5.4, "z");
    this.blockWall(20, 0, 44, 5.4, "z");
    this.blockWall(-12, 24, 16, 3.5);
    this.blockWall(12, 24, 16, 3.5);
    // Arched gate, built from a real ring segment and wedge stones.
    const archMat = this.stone;
    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(3.55, 0.65, 4, 18, Math.PI),
      archMat,
    );
    arch.position.set(0, 4.4, -21.8);
    arch.castShadow = true;
    this.scene.add(arch);
    this.box(-3.55, 2.2, -21.8, 1.3, 4.4, 1.7, this.stone, true);
    this.box(3.55, 2.2, -21.8, 1.3, 4.4, 1.7, this.stone, true);
    this.box(0, 8.5, -22, 7.3, 1.2, 1.9);
    this.box(0, 9.15, -22, 7.8, 0.22, 2.2, this.darkStone);
    for (const x of [-2.8, -1.9, -0.95, 0, 0.95, 1.9, 2.8]) {
      this.box(x, 2.4, -21.9, 0.11, 4.8, 0.16, this.metal);
      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.17, 0.45, 4),
        this.metal,
      );
      tip.position.set(x, 4.9, -21.9);
      this.scene.add(tip);
    }
    this.box(0, 1.4, -21.9, 6.5, 0.13, 0.2, this.metal);
    this.box(0, 3.3, -21.9, 6.5, 0.13, 0.2, this.metal);
    this.solid(0, -21.9, 6.6, 0.3, 5.2);
    const darkness = new THREE.Mesh(
      new THREE.PlaneGeometry(6.1, 6.5),
      new THREE.MeshBasicMaterial({ color: 0x031310 }),
    );
    darkness.position.set(0, 3.1, -23);
    this.scene.add(darkness);
    // Bell mounted in front of the gate's arch.
    const brass = new THREE.MeshStandardMaterial({
      color: 0x9b8551,
      metalness: 0.75,
      roughness: 0.38,
    });
    const bellBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.49, 0.62, 12, 1, true),
      brass,
    );
    this.bell.add(bellBody);
    const lip = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.06, 6, 16),
      brass,
    );
    lip.rotation.x = Math.PI / 2;
    lip.position.y = -0.3;
    this.bell.add(lip);
    const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), brass);
    clapper.position.y = -0.36;
    this.bell.add(clapper);
    this.bell.position.copy(this.bellPosition);
    this.scene.add(this.bell);
    this.box(0, 5.7, -20.8, 1.8, 0.17, 0.3, this.wood);
    this.box(-0.85, 5.25, -20.8, 0.16, 1, 0.3, this.wood);
    this.box(0.85, 5.25, -20.8, 0.16, 1, 0.3, this.wood);
    for (const x of [-11, 11]) this.banner(x, 7.1, -17.9);
    for (const x of [-4.4, 4.4]) this.torch(x, 3.1, -20.8);
    this.torch(-18.9, 2.8, -7);
    this.torch(18.9, 2.8, -7);
    this.torch(-18.9, 2.8, 12);
    this.torch(18.9, 2.8, 12);
  }
  private banner(x: number, y: number, z: number) {
    const cloth = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 3.8, 1, 6),
      new THREE.MeshStandardMaterial({
        color: 0x23453b,
        side: THREE.DoubleSide,
        roughness: 1,
      }),
    );
    cloth.position.set(x, y, z);
    this.scene.add(cloth);
    this.box(x, y + 2, z, 0.055, 0.055, 1, this.metal);
    this.box(x, y + 1.95, z, 1.8, 0.08, 0.08, this.metal);
    const emblem = new THREE.Mesh(
      new THREE.RingGeometry(0.27, 0.32, 4),
      new THREE.MeshStandardMaterial({
        color: 0xb3a474,
        side: THREE.DoubleSide,
      }),
    );
    emblem.position.set(x, y + 0.3, z + 0.02);
    emblem.rotation.z = Math.PI / 4;
    this.scene.add(emblem);
    this.box(
      x,
      y + 0.3,
      z + 0.03,
      0.035,
      1.4,
      0.01,
      new THREE.MeshStandardMaterial({ color: 0xb3a474 }),
    );
  }
  private torch(x: number, y: number, z: number) {
    const h = this.box(x, y - 0.5, z, 0.15, 1.1, 0.15, this.wood);
    h.rotation.z = 0.1;
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.13, 0.3, 8),
      this.metal,
    );
    cup.position.set(x, y, z);
    this.scene.add(cup);
    const light = new THREE.PointLight(0xffad52, 30, 12, 2);
    light.position.set(x, y + 0.3, z + 0.15);
    this.scene.add(light);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glow,
        color: 0xffad42,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
    );
    sprite.position.copy(light.position);
    sprite.scale.set(1.1, 1.65, 1);
    this.scene.add(sprite);
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.13, 0.65, 5),
      new THREE.MeshBasicMaterial({ color: 0xffd996 }),
    );
    flame.position.set(x, y + 0.3, z);
    this.scene.add(flame);
    this.flames.push({
      position: light.position.clone(),
      light,
      sprite,
      phase: this.rng() * 10,
    });
  }
  private details() {
    // Broken columns and stone piles, with collision matching their footprint.
    for (const [x, z, h] of [
      [-11, 5, 2.2],
      [12, 8, 1.4],
      [-13, -5, 3.2],
      [13, -12, 2.1],
    ] as const) {
      this.box(x, 0.18, z, 2.2, 0.36, 2.2, this.darkStone, true);
      this.box(x, h / 2 + 0.3, z, 1.35, h, 1.35, this.stone, true);
      this.box(x, h + 0.35, z, 1.75, 0.25, 1.75);
      for (let i = 0; i < 3; i++) {
        const m = this.box(
          x + 1.5 + this.rng(),
          0.25,
          z + this.rng() * 2,
          1,
          0.5,
          0.7,
        );
        m.rotation.y = this.rng() * 3;
      }
    }
    // Memorial plot to the right of the path.
    for (let i = 0; i < 9; i++) {
      const x = 9 + (i % 3) * 2.35,
        z = -2 - Math.floor(i / 3) * 3;
      const g = new THREE.Group();
      const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 1.05, 0.22),
        this.darkStone,
      );
      head.position.y = 0.8;
      g.add(head);
      const top = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.45, 0.22, 12, 1, false, 0, Math.PI),
        this.darkStone,
      );
      top.rotation.x = Math.PI / 2;
      top.position.y = 1.32;
      g.add(top);
      const crossMat = new THREE.MeshStandardMaterial({ color: 0x667668 });
      const cross = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.4, 0.025),
        crossMat,
      );
      cross.position.set(0, 0.95, 0.13);
      g.add(cross);
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.06, 0.025),
        crossMat,
      );
      bar.position.set(0, 1.02, 0.13);
      g.add(bar);
      g.position.set(x, 0, z);
      g.rotation.z = (this.rng() - 0.5) * 0.2;
      this.scene.add(g);
      this.solid(x, z, 1, 0.4, 1.65);
    }
    // Supply crates near the left wall.
    for (const [x, z, s] of [
      [-15, 12, 1.2],
      [-16.3, 10, 1],
      [-14, 10, 1.35],
    ] as const) {
      this.box(x, s / 2, z, s, s, s, this.wood, true);
      for (const offset of [-0.38, 0.38])
        this.box(
          x + offset * s,
          s / 2,
          z + s / 2 + 0.02,
          0.07,
          s,
          0.05,
          this.metal,
        );
      this.box(x, s / 2, z + s / 2 + 0.05, s, 0.07, 0.04, this.metal);
    }
    // A dead tree, angular branches framing the courtyard.
    for (const [x, z] of [
      [-15, -13],
      [15, 15],
    ]) {
      const bark = new THREE.MeshStandardMaterial({
        color: 0x253129,
        roughness: 1,
      });
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.6, 6, 6),
        bark,
      );
      trunk.position.set(x, 3, z);
      trunk.rotation.z = 0.08;
      this.scene.add(trunk);
      this.solid(x, z, 1, 1, 6);
      for (let i = 0; i < 5; i++) {
        const branch = new THREE.Mesh(
          new THREE.CylinderGeometry(0.035, 0.19, 3, 5),
          bark,
        );
        branch.position.set(
          x + (i % 2 ? 1 : -1) * 0.85,
          3 + i * 0.6,
          z + (this.rng() - 0.5),
        );
        branch.rotation.z = (i % 2 ? 1 : -1) * 0.75;
        branch.rotation.x = this.rng() * 0.8;
        this.scene.add(branch);
      }
    }
    // Small stones scattered in grassy areas, rendered as instances.
    const stones = new THREE.InstancedMesh(
      new THREE.DodecahedronGeometry(0.22, 0),
      this.darkStone,
      170,
    );
    for (let i = 0; i < 170; i++) {
      let x = (this.rng() - 0.5) * 36;
      if (Math.abs(x) < 4) x += Math.sign(x || 1) * 5;
      this.dummy.position.set(x, 0.1, (this.rng() - 0.5) * 42);
      this.dummy.rotation.set(this.rng(), this.rng() * 6, this.rng());
      this.dummy.scale.set(1 + this.rng(), 0.4 + this.rng(), 1);
      this.dummy.updateMatrix();
      stones.setMatrixAt(i, this.dummy.matrix);
    }
    this.scene.add(stones);
  }
  private forest() {
    const trunks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.1, 0.22, 8, 5),
      new THREE.MeshStandardMaterial({ color: 0x152a25 }),
      120,
    );
    const trees = new THREE.InstancedMesh(
      new THREE.ConeGeometry(2.6, 12, 7),
      new THREE.MeshStandardMaterial({ color: 0x18372d, roughness: 1 }),
      240,
    );
    for (let i = 0; i < 120; i++) {
      const x = (this.rng() - 0.5) * 160,
        z = i < 80 ? -32 - this.rng() * 45 : 5 - this.rng() * 70;
      const sx = i < 80 ? x : (i % 2 ? -1 : 1) * (28 + this.rng() * 25);
      const s = 0.65 + this.rng() * 0.8;
      this.dummy.position.set(sx, 4 * s, z);
      this.dummy.scale.set(s, s, s);
      this.dummy.rotation.set(0, this.rng() * 6, 0);
      this.dummy.updateMatrix();
      trunks.setMatrixAt(i, this.dummy.matrix);
      for (let j = 0; j < 2; j++) {
        this.dummy.position.y = (7 + j * 3) * s;
        this.dummy.scale.set(
          s * (1 - j * 0.25),
          s * (1 - j * 0.2),
          s * (1 - j * 0.25),
        );
        this.dummy.updateMatrix();
        trees.setMatrixAt(i * 2 + j, this.dummy.matrix);
      }
    }
    this.scene.add(trunks, trees);
  }
  update(time: number) {
    for (const f of this.flames) {
      const flicker =
        1 +
        Math.sin(time * 9 + f.phase) * 0.07 +
        Math.sin(time * 17 + f.phase) * 0.04;
      f.light.intensity = 30 * flicker;
      f.sprite.scale.set(0.95 * flicker, 1.6 * flicker, 1);
    }
    const p = this.fireGeometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      p.setXYZ(
        i,
        this.moteBase[i * 3] + Math.sin(time * 0.2 + i) * 0.4,
        (this.moteBase[i * 3 + 1] + time * 0.12) % 8,
        this.moteBase[i * 3 + 2] + Math.cos(time * 0.15 + i) * 0.25,
      );
    }
    p.needsUpdate = true;
  }
}
