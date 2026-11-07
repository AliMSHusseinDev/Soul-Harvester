import { expect, it } from "vitest";
import * as THREE from "three";
import { WorldVisibility } from "./world-visibility";
import { seededRandom } from "./math";
it("rejects walls but preserves open parallel sight lines and foreground impacts", () => {
  const boxes = [
      new THREE.Box3(new THREE.Vector3(-1, 0, -5), new THREE.Vector3(1, 3, -4)),
      new THREE.Box3(new THREE.Vector3(8, 0, -9), new THREE.Vector3(9, 3, -8)),
    ],
    v = new WorldVisibility(boxes),
    from = new THREE.Vector3(0, 1.5, 0);
  expect(v.occluded(from, new THREE.Vector3(0, 1.5, -8))).toBe(true);
  expect(v.occluded(from, new THREE.Vector3(0, 1.5, -2))).toBe(false);
  expect(
    v.occluded(new THREE.Vector3(3, 1.5, 0), new THREE.Vector3(3, 1.5, -12)),
  ).toBe(false);
  v.rebuild([]);
  expect(v.occluded(from, new THREE.Vector3(0, 1.5, -8))).toBe(false);
});
it("matches exact static box tests throughout a forest, including origins inside broad bounds", () => {
  const r = seededRandom(1801),
    boxes = Array.from({ length: 80 }, () => {
      const x = (r() - 0.5) * 80,
        z = (r() - 0.5) * 80;
      return new THREE.Box3(
        new THREE.Vector3(x, 0, z),
        new THREE.Vector3(x + 0.6, 4, z + 0.6),
      );
    }),
    v = new WorldVisibility(boxes),
    ray = new THREE.Ray(),
    point = new THREE.Vector3();
  for (let i = 0; i < 200; i++) {
    const from = new THREE.Vector3(
        (r() - 0.5) * 60,
        1 + r() * 2,
        (r() - 0.5) * 60,
      ),
      to = new THREE.Vector3((r() - 0.5) * 60, 1 + r() * 2, (r() - 0.5) * 60),
      distance = from.distanceTo(to);
    ray.set(from, to.clone().sub(from).normalize());
    const blocked = boxes.some(
      (b) =>
        b.containsPoint(from) ||
        (!!ray.intersectBox(b, point) &&
          point.distanceToSquared(from) < (distance - 0.08) ** 2),
    );
    expect(v.occluded(from, to)).toBe(blocked);
  }
});
