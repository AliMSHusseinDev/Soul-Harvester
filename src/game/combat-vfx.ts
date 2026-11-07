import * as THREE from "three";
/** Eight separate angular spikes and an irregular core, no square backing or circular ring. */
export function impactSplashGeometry() {
  const p: number[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4,
      tip = 0.34 + (i % 3) * 0.08,
      w = 0.07 + (i % 2) * 0.025;
    p.push(
      Math.cos(a - w) * 0.11,
      Math.sin(a - w) * 0.11,
      0,
      Math.cos(a) * tip,
      Math.sin(a) * tip,
      0,
      Math.cos(a + w) * 0.11,
      Math.sin(a + w) * 0.11,
      0,
    );
    p.push(
      0,
      0,
      0,
      Math.cos(a) * 0.12,
      Math.sin(a) * 0.12,
      0,
      Math.cos(a + Math.PI / 4) * 0.12,
      Math.sin(a + Math.PI / 4) * 0.12,
      0,
    );
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  return g;
}
/** Limits projected detail to a fraction of the actual enemy width, including distant enemies. */
export function projectedFragmentSize(
  worldSize: number,
  enemyWidth: number,
  distance: number,
  focal: number,
) {
  const min = Math.min(enemyWidth * 0.035, (3 * distance) / focal),
    max = Math.min(enemyWidth * 0.09, (22 * distance) / focal);
  return Math.min(Math.max(worldSize, min), Math.max(min, max));
}
