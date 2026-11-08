import { expect, it } from "vitest";
import * as THREE from "three";
import { SurfaceImpacts } from "./surface-impacts";
import { VFX } from "./tuning";
it("bounds bullet scars, freezes on pause, expires and resets without retaining marks", () => {
  const scene = new THREE.Scene(),
    scars = new SurfaceImpacts(scene),
    hit = {
      point: new THREE.Vector3(0, 0, -5),
      normal: new THREE.Vector3(0, 1, 0),
      distance: 5,
      surface: "earth" as const,
    };
  for (let i = 0; i < 250; i++) scars.emit(hit);
  scars.render();
  expect(scars.diagnostics().active).toBe(VFX.decalCapacity);
  expect(scene.children).toHaveLength(1);
  scars.step(0);
  expect(scars.diagnostics().active).toBe(VFX.decalCapacity);
  scars.step(VFX.decalLife + 0.01);
  scars.render();
  expect(scars.diagnostics().active).toBe(0);
  scars.emit(hit);
  scars.reset();
  expect(scars.diagnostics()).toMatchObject({ active: 0, total: 0 });
});
