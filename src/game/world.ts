import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { seededRandom, type Solid } from "./math";
import {
  stoneTexture,
  groundTexture,
  glowTexture,
  npcTexture,
  cloudTexture,
} from "./textures";
import { MAP, landHeight, terrainSlope } from "./terrain";
import { FOREST_TREES, forestSolids } from "./forest";
import { LIGHTING } from "./tuning";
interface Flame {
  position: THREE.Vector3;
  light: THREE.PointLight;
  sprite: THREE.Sprite;
  phase: number;
}
export class World {
  readonly solids: Solid[] = [];
  readonly flames: Flame[] = [];
  readonly bell = new THREE.Group();
  readonly bellPosition = new THREE.Vector3(0, 3.65, MAP.bell.z);
  readonly skillStation = new THREE.Vector3(9, 0, 11);
  readonly weaponStation = new THREE.Vector3(-9, 0, 11);
  private rng = seededRandom(6601);
  private dummy = new THREE.Object3D();
  private stone = new THREE.MeshStandardMaterial({
    map: stoneTexture(),
    color: 0xb8c6bb,
    roughness: 0.95,
  });
  private darkStone = new THREE.MeshStandardMaterial({
    color: 0x263c38,
    roughness: 1,
  });
  private wood = new THREE.MeshStandardMaterial({
    color: 0x4b4934,
    roughness: 0.9,
  });
  private metal = new THREE.MeshStandardMaterial({
    color: 0x293f3a,
    metalness: 0.5,
    roughness: 0.5,
  });
  private glow = glowTexture();
  private skyMaterial: THREE.ShaderMaterial;
  private particles: THREE.Points;
  private moteBase: Float32Array;
  constructor(readonly scene: THREE.Scene) {
    scene.background = new THREE.Color(0x123e46);
    scene.fog = new THREE.FogExp2(0x16434b, LIGHTING.fogDensity);
    scene.add(new THREE.HemisphereLight(0xb6e8eb, 0x26392b, LIGHTING.sky));
    const moonlight = new THREE.DirectionalLight(0xb2e9e6, LIGHTING.moon);
    moonlight.position.set(-12, 42, -65);
    moonlight.castShadow = true;
    moonlight.shadow.mapSize.set(2048, 2048);
    Object.assign(moonlight.shadow.camera, {
      left: -35,
      right: 35,
      top: 50,
      bottom: -50,
      far: 160,
    });
    moonlight.shadow.bias = -0.001;
    scene.add(moonlight);
    const fill = new THREE.DirectionalLight(0x8caab5, LIGHTING.fill);
    fill.position.set(5, 15, 25);
    scene.add(fill);
    this.skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { time: { value: 0 }, clouds: { value: cloudTexture() } },
      vertexShader:
        "varying vec3 p; varying vec2 skyUv; void main(){p=position;skyUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader: `varying vec3 p;varying vec2 skyUv;uniform float time;uniform sampler2D clouds;void main(){vec3 n=normalize(p);float h=n.y;vec3 c=mix(vec3(.055,.17,.20),vec3(.005,.035,.06),smoothstep(-.1,.8,h));float cloud=texture2D(clouds,vec2(skyUv.x+time*.0006,skyUv.y)).r;float moon=pow(max(0.,dot(n,normalize(vec3(0.,52.,-220.)))),35.);c+=vec3(.10,.26,.24)*moon;c+=vec3(.19,.29,.28)*cloud*smoothstep(-.05,.15,h);gl_FragColor=vec4(c,1.);}`,
      fog: false,
    });
    scene.add(
      new THREE.Mesh(new THREE.SphereGeometry(390, 32, 16), this.skyMaterial),
    );
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(34, 48, 32),
      new THREE.MeshBasicMaterial({ color: 0xd4ffe0, fog: false }),
    );
    moon.position.set(0, 52, -220);
    scene.add(moon);
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glow,
        color: 0x8affd3,
        opacity: 0.32,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    halo.position.set(0, 52, -221);
    halo.scale.set(140, 140, 1);
    scene.add(halo);
    this.ground();
    this.bridge();
    this.keep();
    this.field();
    this.forest();
    this.elevateTerrain();
    this.batchStaticMeshes();
    this.moteBase = new Float32Array(160 * 3);
    for (let i = 0; i < 160; i++) {
      this.moteBase[i * 3] = (this.rng() - 0.5) * 50;
      this.moteBase[i * 3 + 1] = this.rng() * 9;
      this.moteBase[i * 3 + 2] = 25 - this.rng() * 90;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.moteBase.slice(), 3),
    );
    this.particles = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        map: this.glow,
        color: 0x80efd0,
        size: 0.07,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    scene.add(this.particles);
  }
  private ground() {
    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTexture(),
      color: 0xadc4af,
      roughness: 1,
    });
    for (const [z, d] of [
      [15, 26],
      [-47, 66],
    ] as const) {
      const g = new THREE.Mesh(
        new THREE.PlaneGeometry(120, d, 60, 96),
        groundMat,
      );
      g.rotation.x = -Math.PI / 2;
      g.position.z = z;
      g.receiveShadow = true;
      this.scene.add(g);
    }
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(110, 16),
      new THREE.MeshStandardMaterial({
        color: 0x095f66,
        metalness: 0.3,
        roughness: 0.28,
        emissive: 0x073038,
        emissiveIntensity: 0.3,
      }),
    );
    water.userData.terrainExempt = true;
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -6, -6);
    this.scene.add(water);
    for (const z of [2, -14])
      this.box(0, -3.7, z, 100, 7.2, 1.5, this.darkStone);
    const path = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.9, 0.045, 1.05),
      new THREE.MeshStandardMaterial({ color: 0x5c7362, roughness: 1 }),
      500,
    );
    let n = 0;
    for (let z = -60; z < 25; z += 1.15) {
      if (z < 2 && z > -14) continue;
      for (let x = -2.5; x <= 2.5; x += 1.05) {
        if (this.rng() < 0.13) continue;
        this.dummy.position.set(x + (this.rng() - 0.5) * 0.12, 0.02, z);
        this.dummy.rotation.set(0, (this.rng() - 0.5) * 0.15, 0);
        this.dummy.scale.set(1, 1, 1);
        this.dummy.updateMatrix();
        path.setMatrixAt(n, this.dummy.matrix);
        path.setColorAt(
          n,
          new THREE.Color().setHSL(0.24, 0.12, 0.26 + this.rng() * 0.1),
        );
        n++;
      }
    }
    path.count = n;
    path.receiveShadow = true;
    this.scene.add(path);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          -0.055, 0, 0, 0.055, 0, 0, 0.02, 0.35, 0, 0, 0, -0.05, 0, 0, 0.05, 0,
          0.28, 0,
        ],
        3,
      ),
    );
    geo.computeVertexNormals();
    const grass = new THREE.InstancedMesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: 0xb1c8a3,
        side: THREE.DoubleSide,
        roughness: 1,
      }),
      10000,
    );
    n = 0;
    for (let i = 0; i < 14000 && n < 10000; i++) {
      const x = (this.rng() - 0.5) * 70,
        z = 28 - this.rng() * 106;
      if ((z < 2 && z > -14) || (Math.abs(x) < 3.2 && z > -62)) continue;
      this.dummy.position.set(x, 0.015, z);
      this.dummy.rotation.set(0, this.rng() * 6, 0);
      const scale = 0.35 + this.rng() * 0.8;
      this.dummy.scale.set(scale, scale, scale);
      this.dummy.updateMatrix();
      grass.setMatrixAt(n, this.dummy.matrix);
      grass.setColorAt(
        n,
        new THREE.Color().setHSL(
          0.25 + this.rng() * 0.03,
          0.26,
          0.24 + this.rng() * 0.14,
        ),
      );
      n++;
    }
    grass.count = n;
    this.scene.add(grass);
  }
  private bridge() {
    this.box(0, -0.3, -6, 6.5, 0.35, 16.5, this.wood);
    for (let i = 0; i < 32; i++) {
      const p = this.box(0, -0.07, 1.75 - i * 0.5, 6.3, 0.14, 0.46, this.wood);
      p.rotation.z = (this.rng() - 0.5) * 0.008;
    }
    for (const x of [-3.25, 3.25]) {
      for (let z = 2; z >= -14; z -= 2) {
        this.box(x, 0.55, z, 0.2, 1.1, 0.2, this.wood);
        this.box(x, -1.3, z, 0.24, 2.4, 0.24, this.wood);
      }
      for (const y of [0.4, 0.9])
        this.box(x, y, -6, 0.12, 0.12, 16.2, this.wood);
      for (let z = -13; z < 2; z += 2) this.solid(x, z, 0.22, 2, 1.05);
    }
    for (const x of [-4.2, 4.2]) {
      const arch = new THREE.Mesh(
        new THREE.TorusGeometry(8.3, 0.35, 4, 24, Math.PI),
        this.darkStone,
      );
      arch.position.set(x, -0.5, -6);
      arch.rotation.z = Math.PI;
      arch.rotation.y = Math.PI / 2;
      this.scene.add(arch);
    }
    for (const [x, z] of [
      [-3.65, 1],
      [3.65, -13],
    ] as const) {
      this.box(x, 1.7, z, 0.15, 3.4, 0.15, this.wood);
      this.box(x + 0.4, 3.35, z, 0.9, 0.13, 0.13, this.wood);
      this.torch(x + 0.75, 2.75, z);
    }
  }
  private keep() {
    this.blockWall(-17, 14, 22, 5, "z");
    this.blockWall(17, 14, 22, 4, "z");
    this.blockWall(0, 26, 34, 6);
    this.tower(-10, 25, 9);
    this.tower(10, 25, 8);
    // Broken gate pillars give a clear, traversable route onto the bridge.
    for (const x of [-5.4, 5.4]) {
      this.box(x, 2, 3, 2.4, 4, 2.4, this.stone, true);
      this.box(x, 4.1, 3, 2.8, 0.35, 2.8);
      this.torch(x, 2.5, 1.6);
    }
    this.box(0, 0.15, 19, 6, 0.3, 5, this.stone);
    for (const x of [-2.2, 2.2]) {
      this.box(x, 2.5, 19, 0.3, 5, 0.3, this.wood);
      this.banner(x + (x < 0 ? -0.7 : 0.7), 3.3, 19, 1.1, 3);
    }
    this.box(0, 5, 19, 5.2, 0.3, 0.35, this.wood);
    const brass = new THREE.MeshStandardMaterial({
      color: 0xb6a06a,
      metalness: 0.6,
      roughness: 0.4,
    });
    this.bell.add(
      new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.76, 1.05, 16, 1, true),
        brass,
      ),
    );
    const lip = new THREE.Mesh(
      new THREE.TorusGeometry(0.75, 0.07, 8, 24),
      brass,
    );
    lip.rotation.x = Math.PI / 2;
    lip.position.y = -0.5;
    this.bell.add(lip);
    const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), brass);
    clapper.position.y = -0.6;
    this.bell.add(clapper);
    this.bell.position.copy(this.bellPosition);
    this.scene.add(this.bell);
    this.solid(0, 19, 1.3, 1.3, 2.8);
    for (const [x, z, kind] of [
      [9, 11, 0],
      [-9, 11, 1],
    ] as const) {
      const npc = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: npcTexture(kind), alphaTest: 0.2 }),
      );
      npc.position.set(x, 1.1, z);
      npc.scale.set(1.5, 2, 1);
      this.scene.add(npc);
      this.box(x, 0.25, z + 0.5, 1.5, 0.5, 0.8, this.darkStone, true);
      this.torch(x + 1.8, 1, z);
      if (kind === 1) {
        this.box(x, 0.9, z, 1.5, 0.2, 0.65, this.metal);
        this.box(x, 0.65, z, 0.5, 0.5, 0.5, this.metal);
      } else {
        const fire = new THREE.PointLight(0xffae42, 35, 10, 2);
        fire.position.set(x, 0.8, z + 1.3);
        this.scene.add(fire);
      }
    }
  }
  private banner(x: number, y: number, z: number, w: number, h: number) {
    const cloth = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({
        color: 0x215335,
        side: THREE.DoubleSide,
      }),
    );
    cloth.position.set(x, y, z);
    this.scene.add(cloth);
    const emblem = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.25, 4),
      new THREE.MeshStandardMaterial({
        color: 0xbac685,
        side: THREE.DoubleSide,
      }),
    );
    emblem.position.set(x, y, z - 0.025);
    this.scene.add(emblem);
  }
  private field() {
    // Landmark tree; enemies now emerge along the entire forest fringe behind it.
    const bark = new THREE.MeshStandardMaterial({
      color: 0x384237,
      roughness: 1,
    });
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 1.5, 9, 7),
      bark,
    );
    trunk.position.set(0, 4.4, -57);
    this.scene.add(trunk);
    this.solid(0, -57, 2.5, 2.5, 9);
    const leaves = new THREE.MeshStandardMaterial({
      color: 0x20563b,
      roughness: 1,
    });
    for (let i = 0; i < 9; i++) {
      const a = (i * Math.PI * 2) / 8,
        rad = i === 8 ? 0 : 4;
      const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(3.8), leaves);
      crown.position.set(
        Math.sin(a) * rad,
        8 + (i % 3) * 0.9,
        -57 + Math.cos(a) * rad,
      );
      crown.scale.set(1.15, 0.8, 1.1);
      this.scene.add(crown);
      const branch = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.45, 5, 5),
        bark,
      );
      branch.position.set(Math.sin(a) * 1.5, 5, -57 + Math.cos(a) * 1.5);
      branch.rotation.z = Math.sin(a) * 0.7;
      branch.rotation.x = Math.cos(a) * 0.7;
      this.scene.add(branch);
    }
    for (const [x, z, l, h] of [
      [-23, -28, 11, 3.5],
      [24, -42, 12, 4],
      [-13, -19, 7, 2],
      [15, -23, 5, 2.6],
      [-22, -57, 8, 3],
    ] as const)
      this.blockWall(x, z, l, h, "z");
    for (let i = 0; i < 55; i++) {
      const x = (i % 2 ? 1 : -1) * (9 + this.rng() * 15),
        z = -17 - this.rng() * 46;
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.4 + this.rng() * 0.8),
        this.darkStone,
      );
      rock.position.set(x, 0.3, z);
      rock.scale.y = 0.6;
      this.scene.add(rock);
    }
    for (const [x, z] of [
      [-11, -24],
      [13, -46],
      [-10, 7],
      [12, 20],
    ]) {
      const stone = this.box(x, 0.6, z, 0.8, 1.2, 0.3, this.stone, true);
      stone.rotation.z = 0.1;
      this.box(x, 1, z - 0.17, 0.35, 0.07, 0.04, this.darkStone);
      this.box(x, 0.95, z - 0.17, 0.06, 0.4, 0.04, this.darkStone);
    }
  }
  private forest() {
    const tiers = [
        [1, 0.5, 0.4],
        [0.78, 0.46, 0.62],
        [0.52, 0.44, 0.8],
      ].map(([r, h, y]) => new THREE.ConeGeometry(r, h, 7).translate(0, y, 0)),
      canopy = mergeGeometries(tiers)!,
      trees = new THREE.InstancedMesh(
        canopy,
        new THREE.MeshStandardMaterial({
          color: 0x43675b,
          roughness: 1,
          flatShading: true,
        }),
        FOREST_TREES.length,
      ),
      trunks = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.014, 0.022, 0.35, 5).translate(
          0,
          0.175,
          0,
        ),
        new THREE.MeshStandardMaterial({ color: 0x4d4a38, roughness: 1 }),
        FOREST_TREES.length,
      ),
      tint = new THREE.Color();
    tiers.forEach((g) => g.dispose());
    FOREST_TREES.forEach((t, i) => {
      this.dummy.position.set(t.x, 0, t.z);
      this.dummy.rotation.set(0, this.rng() * 6, 0);
      this.dummy.scale.set(t.width, t.height, t.width);
      this.dummy.updateMatrix();
      trees.setMatrixAt(i, this.dummy.matrix);
      tint.setScalar(t.shade);
      trees.setColorAt(i, tint);
      this.dummy.scale.set(t.height, t.height, t.height);
      this.dummy.updateMatrix();
      trunks.setMatrixAt(i, this.dummy.matrix);
    });
    trees.castShadow = trees.receiveShadow = true;
    this.scene.add(trees, trunks);
    this.solids.push(...forestSolids());
    // Layered valley ridges replace isolated giant cones. All silhouettes share one material.
    const ridgeMat = new THREE.MeshBasicMaterial({ color: 0x16373f });
    for (let layer = 0; layer < 3; layer++) {
      const shape = new THREE.Shape();
      shape.moveTo(-180, -8);
      for (let i = 0; i <= 30; i++) {
        const x = -180 + i * 12,
          valley = Math.pow(Math.abs(x) / 180, 0.65);
        shape.lineTo(x, -8 + valley * 65 + this.rng() * 6 + layer * 4);
      }
      shape.lineTo(180, -8);
      shape.closePath();
      const ridge = new THREE.Mesh(new THREE.ShapeGeometry(shape), ridgeMat);
      ridge.position.z = -115 - layer * 28;
      ridge.userData.terrainExempt = true;
      this.scene.add(ridge);
    }
  }
  update(time: number) {
    this.skyMaterial.uniforms.time.value = time;
    for (const f of this.flames) {
      const flicker = 1 + Math.sin(time * 9 + f.phase) * 0.07;
      f.light.intensity = LIGHTING.torch * flicker;
      f.sprite.scale.set(0.65 * flicker, 0.9 * flicker, 1);
    }
    const positions = this.particles.geometry.attributes
      .position as THREE.BufferAttribute;
    for (let i = 0; i < positions.count; i++)
      positions.setXYZ(
        i,
        this.moteBase[i * 3] + Math.sin(time * 0.3 + i) * 0.3,
        ((this.moteBase[i * 3 + 1] + time * 0.15) % 9) +
          landHeight(this.moteBase[i * 3], this.moteBase[i * 3 + 2]),
        this.moteBase[i * 3 + 2],
      );
    positions.needsUpdate = true;
  }
  private elevateTerrain() {
    // Bake the same analytical surface into scenery and physics before static batching.
    this.scene.updateMatrixWorld(true);
    const matrix = new THREE.Matrix4(),
      object = new THREE.Object3D();
    for (const child of [...this.scene.children]) {
      if (child.userData.terrainExempt) continue;
      if (child instanceof THREE.InstancedMesh) {
        for (let i = 0; i < child.count; i++) {
          child.getMatrixAt(i, matrix);
          matrix.decompose(object.position, object.quaternion, object.scale);
          object.position.y += landHeight(object.position.x, object.position.z);
          object.updateMatrix();
          child.setMatrixAt(i, object.matrix);
        }
        child.instanceMatrix.needsUpdate = true;
        child.computeBoundingSphere();
      } else if (child instanceof THREE.Mesh) {
        const mat = child.material;
        if (
          Array.isArray(mat) ||
          mat instanceof THREE.ShaderMaterial ||
          ("fog" in mat && !mat.fog)
        )
          continue;
        const g = child.geometry.clone().applyMatrix4(child.matrixWorld),
          p = g.attributes.position;
        for (let i = 0; i < p.count; i++)
          p.setY(i, p.getY(i) + landHeight(p.getX(i), p.getZ(i)));
        g.computeVertexNormals();
        g.computeBoundingSphere();
        child.geometry.dispose();
        child.geometry = g;
        child.position.set(0, 0, 0);
        child.rotation.set(0, 0, 0);
        child.scale.set(1, 1, 1);
        child.updateMatrixWorld();
      } else if (child instanceof THREE.Sprite) {
        if (child.material.fog)
          child.position.y += landHeight(child.position.x, child.position.z);
      } else if (
        child instanceof THREE.Group ||
        child instanceof THREE.PointLight
      ) {
        child.position.y += landHeight(child.position.x, child.position.z);
      }
    }
    for (const b of this.solids) {
      const values = [landHeight(b.minX, b.minZ), landHeight(b.maxX, b.maxZ)];
      b.base = Math.min(...values);
      b.height += Math.max(...values);
    }
    this.bellPosition.copy(this.bell.position);
    this.skillStation.y = landHeight(this.skillStation.x, this.skillStation.z);
    this.weaponStation.y = landHeight(
      this.weaponStation.x,
      this.weaponStation.z,
    );
    for (const f of this.flames) f.position.copy(f.light.position);
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
        (object.geometry.index
          ? object.geometry.toNonIndexed()
          : object.geometry.clone()
        ).applyMatrix4(object.matrixWorld),
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
        wall.setColorAt(
          n,
          new THREE.Color().setScalar(0.82 + this.rng() * 0.18),
        );
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
}
