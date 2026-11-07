import { it, expect } from "vitest";
import * as THREE from "three";
import { CinematicTime } from "./cinematic-time";
import { Stamina } from "./stamina";
import { Handling } from "./handling";
import { LabelLayout } from "./label-layout";
import { Muzzle, muzzleOpening } from "./muzzle";
import { PixelShards } from "./presentation";
import { impactSplashGeometry, projectedFragmentSize } from "./combat-vfx";
it("holds true zero stamina before regeneration and requires enough recharge to sprint again", () => {
  const s = new Stamina();
  for (let i = 0; i < 360; i++) s.update(1 / 60, true);
  expect(s.value).toBe(0);
  expect(s.available).toBe(false);
  for (let i = 0; i < 18; i++) s.update(1 / 60, false);
  expect(s.value).toBe(0);
  for (let i = 0; i < 40; i++) s.update(1 / 60, false);
  expect(s.value).toBeGreaterThan(0);
  expect(s.available).toBe(false);
  for (let i = 0; i < 300; i++) s.update(1 / 60, false);
  expect(s.value).toBe(1);
  expect(s.available).toBe(true);
});
it("retains a distinct airborne sprint pose and blocks firing until full sprint-out", () => {
  const h = new Handling(),
    i = {
      sprint: true,
      fire: false,
      aim: false,
      busy: false,
      grounded: true,
      verticalSpeed: 0,
      moving: true,
    };
  h.update(1 / 60, i);
  h.update(1 / 60, { ...i, grounded: false, verticalSpeed: 6 });
  expect(h.state).toBe("Jumping");
  expect(h.weaponPose).toBe("SprintAirborne");
  expect(h.ready).toBe(false);
  h.update(0.2, { ...i, grounded: false, verticalSpeed: -3 });
  expect(h.weaponPose).toBe("SprintAirborne");
  h.update(0.01, { ...i, grounded: false, fire: true });
  expect(h.sprintOut).toBe(0.225);
  h.update(0.224, { ...i, fire: true });
  expect(h.ready).toBe(false);
  h.update(0.001, { ...i, fire: true });
  expect(h.ready).toBe(true);
});
it("recovers cinematic time on an unscaled bounded envelope and refuses stacked slow motion", () => {
  const t = new CinematicTime();
  expect(t.trigger()).toBe(true);
  t.update(0.12);
  expect(t.scale).toBeCloseTo(0.35);
  expect(t.trigger()).toBe(false);
  t.update(0.15);
  expect(t.scale).toBeCloseTo(0.35);
  let previous = t.scale;
  for (let i = 0; i < 36; i++) {
    t.update(1 / 60);
    expect(t.scale).toBeGreaterThanOrEqual(previous);
    previous = t.scale;
  }
  expect(t.scale).toBeCloseTo(1);
  expect(t.active).toBe(false);
  t.trigger();
  t.reset();
  expect(t.scale).toBe(1);
  expect(t.active).toBe(false);
});
it("separates a full cluster of screen labels without covering the sights", () => {
  for (const [w, h] of [
    [1280, 720],
    [1920, 1080],
    [640, 400],
  ]) {
    const l = new LabelLayout(),
      rects: { x: number; y: number }[] = [];
    l.begin();
    for (let i = 0; i < 32; i++) {
      const p = l.place(w / 2, h / 2, 38, 20, w, h);
      const r = { x: w / 2 + p.dx, y: h / 2 + p.dy };
      for (const other of rects)
        expect(
          Math.abs(other.x - r.x) >= 40 || Math.abs(other.y - r.y) >= 22,
        ).toBe(true);
      expect(Math.abs(r.x - w / 2) > 42 || Math.abs(r.y - h / 2) > 34).toBe(
        true,
      );
      rects.push(r);
    }
  }
});
it("attaches flashes at the real barrel exit, uses depth testing and keeps all flame vertices forward", () => {
  const parent = new THREE.Group(),
    m = new Muzzle(parent, true);
  expect(m.socket.position.toArray()).toEqual(muzzleOpening(true).toArray());
  expect(m.socket.position.z).toBeCloseTo(-0.925);
  expect(m.socket.position.y).toBe(0.18);
  m.flame.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      expect((o.material as THREE.Material).depthTest).toBe(true);
      const p = o.geometry.attributes.position;
      for (let i = 0; i < p.count; i++)
        expect(
          m.socket.position.y + (p.getY(i) + o.position.y) * 0.65,
        ).toBeLessThan(0.22);
    }
  });
  m.present(true, 1, 2);
  expect(m.flame.scale.x).toBeLessThan(0.65);
  expect(m.flame.visible).toBe(true);
  m.present(false, 0, 2);
  expect(m.flame.visible).toBe(false);
  parent.position.set(2, 3, 4);
  parent.rotation.x = 0.3;
  parent.updateMatrixWorld();
  expect(
    m
      .worldPoint()
      .distanceTo(m.socket.position.clone().applyMatrix4(parent.matrixWorld)),
  ).toBeLessThan(1e-6);
});
it("uses directional medium fragments, finishing colors and stable drag integration", () => {
  const p = new PixelShards();
  p.spawn(0, 2, 0, 18, false, 1, { nx: 0, nz: 1, dz: -1 });
  expect(
    p.items.filter((p) => p.life > 0).every((p) => p.vz > 0 && p.size >= 0.065),
  ).toBe(true);
  p.spawn(0, 2, 0, 32, true);
  expect(
    p.items.filter((p) => p.life > 0 && p.color >= 5 && p.color < 10).length,
  ).toBe(32);
  const run = (hz: number) => {
    const a = new PixelShards();
    a.spawn(0, 3, 0, 1);
    for (let i = 0; i < hz * 0.1; i++) a.update(1 / hz, () => 0);
    return a.items.find((p) => p.max !== 1)!;
  };
  expect(run(30).x).toBeCloseTo(run(120).x, 8);
  expect(run(30).y).toBeCloseTo(run(120).y, 8);
  const g = impactSplashGeometry();
  expect(g.attributes.position.count).toBe(48);
  expect(projectedFragmentSize(0.1, 1.25, 60, 700)).toBeLessThanOrEqual(0.15);
});
it("reserves upward-only label lanes and never pushes existing text downwards", () => {
  const layout = new LabelLayout(),
    placements: { dx: number; dy: number; visible: boolean }[] = [];
  layout.begin();
  for (let i = 0; i < 32; i++) {
    const p = layout.place(320, 220, 38, 20, 640, 400);
    expect(p.visible).toBe(true);
    expect(p.dy).toBeLessThanOrEqual(-42);
    placements.push(p);
  }
  layout.begin();
  for (const prior of placements) {
    const next = layout.place(320, 214, 38, 20, 640, 400, prior.dx, prior.dy);
    expect(next.visible).toBe(true);
    expect(next.dy).toBeLessThanOrEqual(prior.dy);
  }
});
