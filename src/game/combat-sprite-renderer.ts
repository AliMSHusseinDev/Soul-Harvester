import * as THREE from "three";
import { COMBAT_ASSETS } from "./combat-assets";
import {
  CombatBursts,
  CombatCoverage,
  COMBAT_BUDGET,
  COMBAT_PROFILES,
  combatFrameUV,
  combatSpriteWidth,
  validateCombatSheet,
  type CombatSheet,
  type CombatEffectKind,
} from "./combat-sprites";

interface Batch {
  sheet: CombatSheet;
  mesh: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  frames: THREE.InstancedBufferAttribute;
  opacity: THREE.InstancedBufferAttribute;
  uv: readonly (readonly [number, number, number, number])[];
  order: Int16Array;
  count: number;
}
const DRAW_PRIORITY = ["death", "critical", "normal"] as const;
/** Three cached textures / at most three draws, with independent per-instance UVs. */
export class CombatSpriteRenderer {
  readonly pool = new CombatBursts();
  readonly ready: Promise<void>;
  private batches = new Map<CombatEffectKind, Batch>();
  private coverage = new CombatCoverage();
  private dummy = new THREE.Object3D();
  private projected = new THREE.Vector3();
  private local = new THREE.Vector3();
  private normal = new THREE.Vector3();
  private view = new THREE.Matrix4();
  private frustum = new THREE.Frustum();
  private sphere = new THREE.Sphere();
  private depths = new Float32Array(COMBAT_BUDGET.capacity);
  private alphas = new Float32Array(COMBAT_BUDGET.capacity);
  private widths = new Float32Array(COMBAT_BUDGET.capacity);
  private disposed = false;
  private errors: string[] = [];
  private visible = 0;
  constructor(
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    sheets: readonly CombatSheet[] = COMBAT_ASSETS,
  ) {
    const kinds = new Set<CombatEffectKind>();
    for (const sheet of sheets) {
      validateCombatSheet(sheet);
      if (kinds.has(sheet.kind))
        throw new Error(`Duplicate combat sheet: ${sheet.kind}`);
      kinds.add(sheet.kind);
    }
    this.ready = Promise.all(sheets.map((s) => this.load(s))).then(() => {
      if (!this.disposed && this.batches.size !== sheets.length)
        throw new Error(
          "Combat images could not load. Reload the game to retry.",
        );
    });
  }
  private async load(sheet: CombatSheet) {
    let texture: THREE.Texture | undefined;
    try {
      texture = await new THREE.TextureLoader().loadAsync(sheet.url);
      if (this.disposed) {
        texture.dispose();
        return;
      }
      if (
        texture.image.width !== sheet.width ||
        texture.image.height !== sheet.height
      )
        throw new Error(`Atlas dimensions differ from metadata: ${sheet.kind}`);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
      const geometry = new THREE.PlaneGeometry(1, 1).translate(
        0.5 - sheet.anchor[0],
        sheet.anchor[1] - 0.5,
        0,
      );
      const frames = new THREE.InstancedBufferAttribute(
          new Float32Array(COMBAT_BUDGET.capacity * 4),
          4,
        ),
        opacity = new THREE.InstancedBufferAttribute(
          new Float32Array(COMBAT_BUDGET.capacity),
          1,
        );
      frames.setUsage(THREE.DynamicDrawUsage);
      opacity.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute("combatRect", frames);
      geometry.setAttribute("combatAlpha", opacity);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        // Raycast hits lie on the shallow enemy front: bias coplanar fragments
        // without moving the logical world-space impact or bypassing wall depth.
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -2,
        toneMapped: false,
        alphaTest: 0.015,
        side: THREE.DoubleSide,
        blending: THREE.NormalBlending,
      });
      // A flat camera-facing layer needs one draw, including its semi-alpha edges.
      material.forceSinglePass = true;
      material.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            "#include <common>\nattribute vec4 combatRect; attribute float combatAlpha; varying float vCombatAlpha;",
          )
          .replace(
            "#include <uv_vertex>",
            "#include <uv_vertex>\nvMapUv=combatRect.xy+uv*combatRect.zw; vCombatAlpha=combatAlpha;",
          );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <common>",
            "#include <common>\nvarying float vCombatAlpha;",
          )
          .replace(
            "#include <color_fragment>",
            "#include <color_fragment>\ndiffuseColor.a*=vCombatAlpha;",
          );
      };
      const mesh = new THREE.InstancedMesh(
        geometry,
        material,
        COMBAT_BUDGET.capacity,
      );
      mesh.name = `authored-combat-${sheet.kind}`;
      mesh.frustumCulled = false; // Individual instances are frustum-tested below.
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      mesh.renderOrder = 7 + COMBAT_PROFILES[sheet.kind].priority;
      this.scene.add(mesh);
      this.batches.set(sheet.kind, {
        sheet,
        mesh,
        frames,
        opacity,
        uv: sheet.frames.map((_, i) => combatFrameUV(sheet, i)),
        order: new Int16Array(COMBAT_BUDGET.capacity),
        count: 0,
      });
    } catch (error) {
      texture?.dispose();
      this.errors.push(`${sheet.kind}: ${String(error)}`);
    }
  }
  spawn(
    kind: CombatEffectKind,
    x: number,
    y: number,
    z: number,
    enemyWidth: number,
    playbackSpeed = 1,
    duration?: number,
    normal?: { x: number; y: number; z: number },
  ) {
    const batch = this.batches.get(kind);
    if (!batch) return false;
    // Freeze a small surface lift at birth. The full billboard then clears the
    // shallow enemy front even while aiming down/up; it never follows the camera.
    this.local.set(0, 0, 1).applyQuaternion(this.camera.quaternion);
    this.normal
      .set(normal?.x ?? this.local.x, normal?.y ?? 0, normal?.z ?? this.local.z)
      .normalize();
    const cosine = this.normal.dot(this.local),
      profile = COMBAT_PROFILES[kind],
      distance = Math.hypot(
        this.camera.position.x - x,
        this.camera.position.y - y,
        this.camera.position.z - z,
      ),
      widthBound = Math.min(
        enemyWidth * profile.ratio * 1.35,
        2 *
          profile.maxScreen *
          distance *
          Math.tan((this.camera.fov * Math.PI) / 360),
      ),
      aspect = batch.sheet.frames[0].width / batch.sheet.frames[0].height,
      lift =
        0.012 +
        widthBound *
          0.5 *
          Math.hypot(1, 1 / aspect) *
          Math.sqrt(Math.max(0, 1 - cosine * cosine));
    this.normal.multiplyScalar((cosine < 0 ? -1 : 1) * lift);
    this.pool.spawn(
      kind,
      x,
      y,
      z,
      enemyWidth,
      batch.sheet,
      playbackSpeed,
      duration,
      this.normal,
    );
    // A budget rejection must not reintroduce the legacy full-sized flash.
    return true;
  }
  step(dt: number) {
    this.pool.step(dt);
  }
  render(viewportHeight: number, reduced: boolean) {
    const camera = this.camera,
      focal = viewportHeight / (2 * Math.tan((camera.fov * Math.PI) / 360)),
      viewportWidth = viewportHeight * camera.aspect;
    camera.updateMatrixWorld();
    this.view.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    this.frustum.setFromProjectionMatrix(this.view);
    this.coverage.reset();
    this.visible = 0;
    // Reserve visual coverage for deaths, then criticals, then normal hits.
    for (const kind of DRAW_PRIORITY) {
      const batch = this.batches.get(kind);
      if (!batch) continue;
      batch.count = 0;
      const aspect = batch.sheet.frames[0].width / batch.sheet.frames[0].height;
      for (let i = 0; i < this.pool.items.length; i++) {
        const b = this.pool.items[i];
        if (!b.active || b.kind !== kind) continue;
        this.local
          .set(b.x + b.offsetX, b.y + b.offsetY, b.z + b.offsetZ)
          .applyMatrix4(camera.matrixWorldInverse);
        const depth = -this.local.z;
        this.depths[i] = depth;
        const width =
          combatSpriteWidth(kind, b.enemyWidth, depth, focal, viewportHeight) *
          (reduced ? 0.85 : 1);
        this.sphere.center.set(
          b.x + b.offsetX,
          b.y + b.offsetY,
          b.z + b.offsetZ,
        );
        this.sphere.radius = Math.hypot(width, width / aspect);
        if (
          depth < camera.near + 0.08 ||
          !this.frustum.intersectsSphere(this.sphere)
        ) {
          this.pool.presented(b);
          continue;
        }
        this.projected.copy(this.sphere.center).project(camera);
        const frame = this.pool.frame(b, batch.sheet.frames.length),
          px = (width * focal) / depth,
          opacity = this.coverage.admit(
            this.projected.x * 0.5 + 0.5,
            -this.projected.y * 0.5 + 0.5,
            px / viewportWidth,
            px / aspect / viewportHeight,
            batch.sheet.frames[frame].coverage,
            kind,
          );
        this.widths[i] = width;
        this.alphas[i] = opacity;
        // Insertion sort on a bounded reusable list; no per-frame array/map of objects.
        let at = batch.count++;
        while (at > 0 && this.depths[batch.order[at - 1]] < depth) {
          batch.order[at] = batch.order[at - 1];
          at--;
        }
        batch.order[at] = i;
      }
      let count = 0;
      for (let slot = 0; slot < batch.count; slot++) {
        const i = batch.order[slot];
        const b = this.pool.items[i],
          frame = this.pool.frame(b, batch.sheet.frames.length),
          uv = batch.uv[frame],
          width = this.widths[i];
        this.dummy.position.set(
          b.x + b.offsetX,
          b.y + b.offsetY,
          b.z + b.offsetZ,
        );
        this.dummy.quaternion.copy(camera.quaternion);
        this.dummy.rotateZ(b.rotation);
        this.dummy.scale.set(width, width / aspect, 1);
        this.dummy.updateMatrix();
        batch.mesh.setMatrixAt(count, this.dummy.matrix);
        batch.frames.setXYZW(count, uv[0], uv[1], uv[2], uv[3]);
        // The authored sequence already expands and fades: do not rescale/recolor the art.
        batch.opacity.setX(count, this.alphas[i]);
        count++;
        this.pool.presented(b);
      }
      batch.mesh.count = count;
      batch.mesh.instanceMatrix.needsUpdate = true;
      batch.frames.needsUpdate = batch.opacity.needsUpdate = true;
      this.visible += count;
    }
  }
  fragmentOpacity(x: number, y: number, width: number, height: number) {
    return this.coverage.admit(x, y, width, height, 1, "fragment");
  }
  diagnostics() {
    return {
      installed: Array.from(this.batches.keys()),
      errors: [...this.errors],
      active: this.pool.items.filter((b) => b.active).length,
      visible: this.visible,
      rendered: {
        normal: this.batches.get("normal")?.mesh.count ?? 0,
        critical: this.batches.get("critical")?.mesh.count ?? 0,
        death: this.batches.get("death")?.mesh.count ?? 0,
      },
      frames: this.pool.items
        .filter((b) => b.active)
        .map((b) => ({
          kind: b.kind,
          age: b.age,
          frame: this.pool.frame(
            b,
            this.batches.get(b.kind)!.sheet.frames.length,
          ),
        })),
      capacity: COMBAT_BUDGET.capacity,
      replaced: this.pool.replaced,
      dropped: this.pool.dropped,
    };
  }
  reset() {
    this.pool.reset();
    this.visible = 0;
    for (const batch of this.batches.values()) batch.mesh.count = 0;
  }
  dispose() {
    this.disposed = true;
    for (const { mesh } of this.batches.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.map?.dispose();
      mesh.material.dispose();
    }
    this.batches.clear();
    this.reset();
  }
}
