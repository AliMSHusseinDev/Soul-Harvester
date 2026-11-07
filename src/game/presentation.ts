import { seededRandom } from "./math";
import { PRESENTATION as P } from "./tuning";
export function damageNumberPose(age: number, critical: boolean, seed: number) {
  const life = critical ? P.criticalNumberLife : P.numberLife,
    t = Math.min(1, Math.max(0, age / 0.12)),
    u = t - 1,
    pop = 0.45 + 0.55 * (1 + 2.70158 * u * u * u + 1.70158 * u * u);
  return {
    scale: (critical ? 1.3 : 1) * pop,
    opacity: Math.max(0, Math.min(1, (life - age) / 0.25)),
    rise: (1 - Math.exp(-age * 4.5)) * (critical ? 0.44 : 0.34),
    side: Math.sin(seed * 2.39996) * (1 - Math.exp(-age * 4)) * 0.1,
    life,
  };
}
export type AbilityKind = "burst" | "orb";
export class AbilityPresentation {
  private pending: { kind: AbilityKind; remaining: number }[] = [];
  private ready: AbilityKind[] = [];
  begin(kind: AbilityKind) {
    if (this.pending.some((p) => p.kind === kind)) return false;
    this.pending.push({
      kind,
      remaining: kind === "burst" ? P.burstWindup : P.orbWindup,
    });
    return true;
  }
  update(dt: number) {
    this.ready.length = 0;
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i];
      p.remaining -= dt;
      if (p.remaining <= 0) {
        this.ready.push(p.kind);
        this.pending.splice(i, 1);
      }
    }
    return this.ready;
  }
  reset() {
    this.pending.length = 0;
    this.ready.length = 0;
  }
  get count() {
    return this.pending.length;
  }
}
export const SHARD_COLORS = [
  0xff748a, 0xd94f4e, 0xffe7a5, 0xffa254, 0xfff7df,
] as const;
export interface Shard {
  life: number;
  max: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  angle: number;
  spin: number;
  size: number;
  color: number;
}
/** Bounded visual-only pool. Physics updates never allocate a rigid body per fragment. */
export class PixelShards {
  readonly items: Shard[] = Array.from({ length: P.shardCapacity }, () => ({
    life: 0,
    max: 1,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    angle: 0,
    spin: 0,
    size: 0,
    color: 0,
  }));
  private r = seededRandom(2601);
  private cursor = 0;
  spawn(
    x: number,
    y: number,
    z: number,
    count: number,
    death = false,
    scale = 1,
  ) {
    let emitted = 0;
    for (let i = 0; i < count; i++) {
      let item: Shard | undefined;
      for (let n = 0; n < this.items.length; n++) {
        this.cursor = (this.cursor + 1) % this.items.length;
        if (this.items[this.cursor].life <= 0) {
          item = this.items[this.cursor];
          break;
        }
      }
      if (!item) break;
      const angle = this.r() * Math.PI * 2,
        speed = (death ? 1.7 : 1.1) + this.r() * (death ? 2 : 1.3),
        life = (death ? 0.35 : 0.2) + this.r() * 0.25;
      Object.assign(item, {
        life,
        max: life,
        x,
        y,
        z,
        vx: Math.cos(angle) * speed,
        vy: (death ? 1.2 : 0.5) + this.r() * 1.6,
        vz: Math.sin(angle) * speed,
        angle: this.r() * 6.28,
        spin: (this.r() - 0.5) * 14,
        size: (0.035 + this.r() * 0.03) * scale,
        color: Math.floor(this.r() * SHARD_COLORS.length),
      });
      emitted++;
    }
    return emitted;
  }
  update(dt: number, floor: (x: number, z: number) => number) {
    for (const p of this.items)
      if (p.life > 0) {
        p.life = Math.max(0, p.life - dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vy -= 5 * dt;
        const drag = Math.exp(-dt * 1.7);
        p.vx *= drag;
        p.vz *= drag;
        p.angle += p.spin * dt;
        const ground = floor(p.x, p.z) + 0.04;
        if (p.y < ground) {
          p.y = ground;
          p.vy = Math.abs(p.vy) * 0.18;
        }
      }
  }
  reset() {
    for (const p of this.items) p.life = 0;
    this.cursor = 0;
    this.r = seededRandom(2601);
  }
}

/** Keeps fractional damage readable instead of changing 28.5 into 29. */
export const damageLabel = (value: number) => String(Number(value.toFixed(2)));
