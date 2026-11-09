import { expect, it } from "vitest";
import * as THREE from "three";
import { WorldRaycast } from "./world-raycast";
const material = (surface: string) => {
  const map = new THREE.Texture();
  map.name = `Original pixel ${surface}`;
  return new THREE.MeshStandardMaterial({ map });
};
it("hits visible stone and ground geometry in nearest order without navigation colliders", () => {
  const scene = new THREE.Scene(),
    rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1), material("rock")),
    ground = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2),
      material("grass"),
    );
  rock.position.set(0, 1, -5);
  scene.add(rock, ground);
  const world = new WorldRaycast(scene);
  const hit = world.hit(
    new THREE.Ray(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1)),
    20,
  )!;
  expect(hit.surface).toBe("stone");
  expect(hit.distance).toBeLessThan(5);
  expect(hit.normal.z).toBeGreaterThan(0);
  expect(
    world.hit(
      new THREE.Ray(new THREE.Vector3(3, 4, -5), new THREE.Vector3(0, -1, 0)),
      20,
    ),
  ).toMatchObject({ surface: "earth", distance: 4 });
});
it("matches Three's geometry intersections under rotated nonuniform instances", () => {
  const scene = new THREE.Scene(),
    mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 2, 1),
      material("bark"),
      2,
    ),
    o = new THREE.Object3D();
  o.position.set(0, 1, -5);
  o.rotation.y = 0.4;
  o.scale.set(2, 1, 0.5);
  o.updateMatrix();
  mesh.setMatrixAt(0, o.matrix);
  o.position.x = 10;
  o.updateMatrix();
  mesh.setMatrixAt(1, o.matrix);
  scene.add(mesh);
  const world = new WorldRaycast(scene),
    ray = new THREE.Ray(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, -1),
    ),
    expected = new THREE.Raycaster(ray.origin, ray.direction).intersectObject(
      mesh,
    )[0],
    hit = world.hit(ray, 20)!;
  expect(hit.surface).toBe("wood");
  expect(hit.distance).toBeCloseTo(expected.distance, 6);
  expect(hit.normal.length()).toBeCloseTo(1);
  expect(hit.normal.dot(ray.direction)).toBeLessThan(0);
});
it("bounds sparse-world triangle work and respects the range limit", () => {
  const scene = new THREE.Scene(),
    mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      material("stone"),
      400,
    ),
    o = new THREE.Object3D();
  for (let i = 0; i < 400; i++) {
    o.position.set((i % 20) * 4, 0, -10 - Math.floor(i / 20) * 4);
    o.updateMatrix();
    mesh.setMatrixAt(i, o.matrix);
  }
  scene.add(mesh);
  const world = new WorldRaycast(scene),
    ray = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0, 0, -1));
  expect(world.hit(ray, 5)).toBeNull();
  expect(world.hit(ray, 100)?.distance).toBeCloseTo(9.5);
  expect(world.triangleTests).toBeLessThan((400 * 12) / 20);
});

it("samples raised map surfaces for particle support without changing the fallback terrain", () => {
  const scene = new THREE.Scene(),
    slab = new THREE.Mesh(new THREE.BoxGeometry(2, 0.12, 2), material("paver"));
  slab.position.y = 0.06;
  scene.add(slab);
  const world = new WorldRaycast(scene);
  expect(world.supportHeight(0, 0, 1, 0)).toBeCloseTo(0.12);
  expect(world.supportHeight(3, 0, 1, 0)).toBe(0);
});
