import { afterEach, expect, it, vi } from "vitest";
import {
  applyTuning,
  DEFAULT_TUNING,
  emptyProject,
  validateProject,
  SETTINGS,
} from "./developer-project";
import { setTerrainBrushes, sculptHeight } from "./developer-terrain";
import { TUNING } from "./tuning";
import { islandHeight } from "./island";
import { groundHeight } from "./terrain";
afterEach(() => {
  applyTuning(DEFAULT_TUNING);
  setTerrainBrushes([]);
});
it("round-trips a bounded map project and refuses unsafe imports", () => {
  const p = emptyProject();
  p.objects.push({
    id: "test",
    kind: "block",
    texture: "stone",
    color: "#aabbcc",
    position: [2, 3, 4],
    scale: [1, 2, 1],
    yaw: 45,
  });
  p.brushes.push({ x: 10, z: -30, radius: 8, height: 3 });
  p.tuning["effects.splatterLaunchGain"] = 0.8;
  expect(validateProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
  expect(() =>
    validateProject({ ...p, tuning: { "__proto__.bad": 2 } }),
  ).toThrow();
  expect(() =>
    validateProject({
      ...p,
      objects: [{ ...p.objects[0], scale: [-1, 2, 1] }],
    }),
  ).toThrow();
  expect(() =>
    validateProject({ ...p, objects: [p.objects[0], p.objects[0]] }),
  ).toThrow();
  expect(() =>
    validateProject({
      ...p,
      textures: { "custom-bad": "https://example.com/x.png" },
    }),
  ).toThrow();
  expect(() =>
    validateProject({ ...p, brushes: [{ x: 0, z: 0, radius: 0, height: 3 }] }),
  ).toThrow();
});
it("updates only schema-owned finite tuning without changing unrelated settings", () => {
  const smoke = TUNING.effects.bloodSmokeLifeGain;
  applyTuning({
    "effects.splatterLaunchGain": 0.8,
    "effects.bloodSmokeLifeGain": Infinity,
    "unknown.path": 1,
  });
  expect(TUNING.effects.splatterLaunchGain).toBe(0.8);
  expect(TUNING.effects.bloodSmokeLifeGain).toBe(smoke);
  expect(
    SETTINGS.some((s) => s.path === "effects.bleedingColor" && s.color),
  ).toBe(true);
});
it("sculpts continuous compact-support terrain shared by island and gameplay ground", () => {
  const x = 0,
    z = -40,
    a = islandHeight(x, z),
    b = groundHeight(x, z);
  setTerrainBrushes([{ x, z, radius: 10, height: 3 }]);
  expect(islandHeight(x, z) - a).toBeCloseTo(3);
  expect(groundHeight(x, z) - b).toBeCloseTo(3);
  expect(sculptHeight(x + 10, z)).toBe(0);
  expect(sculptHeight(x + 11, z)).toBe(0);
  expect(Math.abs(sculptHeight(x + 9.999, z))).toBeLessThan(1e-8);
});
it("rejects inverted world bounds, invalid pool reserves and fractional capacities", () => {
  const p = emptyProject();
  expect(() =>
    validateProject({ ...p, tuning: { "map.minX": 100, "map.maxX": 50 } }),
  ).toThrow();
  expect(() =>
    validateProject({ ...p, tuning: { "effects.reservedSlots": 1536 } }),
  ).toThrow();
  expect(() =>
    validateProject({ ...p, tuning: { "presentation.flashCapacity": 2.5 } }),
  ).toThrow();
});
it("replaces transformed prop colliders instead of accumulating stale blockers", async () => {
  const THREE = await import("three");
  const { appendDeveloperSolids, editorRootName } =
    await import("./developer-world");
  const scene = new THREE.Scene(),
    root = new THREE.Group();
  root.name = editorRootName;
  scene.add(root);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial(),
  );
  mesh.position.set(4, 2, 3);
  mesh.scale.set(2, 3, 1);
  mesh.rotation.y = Math.PI / 4;
  root.add(mesh);
  const world = {
    scene,
    solids: [{ minX: -1, maxX: 1, minZ: -1, maxZ: 1, height: 1 }],
  } as unknown as import("./world").World;
  appendDeveloperSolids(world, emptyProject());
  appendDeveloperSolids(world, emptyProject());
  expect(world.solids).toHaveLength(2);
  const box = world.solids[1];
  expect(box.maxX - box.minX).toBeCloseTo(3 / Math.sqrt(2));
  expect(box.height).toBeCloseTo(3.5);
  scene.remove(root);
  appendDeveloperSolids(world, emptyProject());
  expect(world.solids).toHaveLength(1);
  mesh.geometry.dispose();
  mesh.material.dispose();
});

it("shares imported GPU textures across placed props", async () => {
  const THREE = await import("three");
  const { editorMesh } = await import("./developer-world");
  const texture = new THREE.Texture();
  const loader = vi
    .spyOn(THREE.TextureLoader.prototype, "load")
    .mockReturnValue(texture);
  const project = emptyProject();
  project.textures["custom-test"] = "data:image/png;base64,YQ==";
  const object = {
    id: "a",
    kind: "block" as const,
    texture: "custom-test",
    color: "#ffffff",
    position: [0, 0, 0],
    scale: [1, 1, 1],
    yaw: 0,
  };
  try {
    const a = editorMesh(object, project),
      b = editorMesh({ ...object, id: "b" }, project);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(
      (a.material as InstanceType<typeof THREE.MeshStandardMaterial>).map,
    ).toBe((b.material as InstanceType<typeof THREE.MeshStandardMaterial>).map);
    for (const m of [a, b]) {
      m.geometry.dispose();
      (m.material as InstanceType<typeof THREE.Material>).dispose();
    }
  } finally {
    loader.mockRestore();
    texture.dispose();
  }
});
