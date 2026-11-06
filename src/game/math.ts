/** Deterministic PRNG: reproducible scenery and test encounters. */
export function seededRandom(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const damp = (
  current: number,
  target: number,
  speed: number,
  dt: number,
) => current + (target - current) * (1 - Math.exp(-speed * dt));
export interface Solid {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
  base?: number;
}
/** Circle vs AABB. Vertical filtering allows the player to jump over low props. */
export function resolveCircle(
  x: number,
  z: number,
  radius: number,
  feet: number,
  solids: readonly Solid[],
) {
  for (let pass = 0; pass < 3; pass++)
    for (const b of solids) {
      if (feet >= b.height) continue;
      const nx = Math.max(b.minX, Math.min(x, b.maxX)),
        nz = Math.max(b.minZ, Math.min(z, b.maxZ));
      const dx = x - nx,
        dz = z - nz,
        ds = dx * dx + dz * dz;
      if (ds >= radius * radius) continue;
      if (ds > 1e-10) {
        const push = radius / Math.sqrt(ds) - 1;
        x += dx * push;
        z += dz * push;
      } else {
        const d = [x - b.minX, b.maxX - x, z - b.minZ, b.maxZ - z];
        const m = Math.min(...d);
        if (m === d[0]) x = b.minX - radius;
        else if (m === d[1]) x = b.maxX + radius;
        else if (m === d[2]) z = b.minZ - radius;
        else z = b.maxZ + radius;
      }
    }
  return { x, z };
}
/** Bounded accumulator avoids a spiral of death after a suspended tab. */
export class FixedClock {
  readonly step = 1 / 60;
  private accumulator = 0;
  advance(elapsed: number, update: (dt: number) => void) {
    this.accumulator += Math.min(Math.max(0, elapsed), 0.1);
    while (this.accumulator >= this.step) {
      update(this.step);
      this.accumulator -= this.step;
    }
    return this.accumulator / this.step;
  }
  reset() {
    this.accumulator = 0;
  }
}

/** Exact critically damped spring step; stable even when render frequency changes. */
export function springStep(
  position: number,
  velocity: number,
  target: number,
  omega: number,
  dt: number,
) {
  const d = position - target,
    c = velocity + omega * d,
    e = Math.exp(-omega * dt);
  return {
    position: target + (d + c * dt) * e,
    velocity: (velocity - omega * c * dt) * e,
  };
}

export const SIGHT_HEIGHT = 0.22;
/** The sight tips lie on the camera's optical axis at full ADS. */
export function aimPose(aim: number, scale = 0.68) {
  return {
    x: 0.27 * (1 - aim),
    y: -0.24 * (1 - aim) - SIGHT_HEIGHT * scale * aim,
    z: -0.52 * (1 - aim) - 0.64 * aim,
  };
}
