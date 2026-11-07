import { seededRandom } from "./math";
import { PRESENTATION as P } from "./tuning";
export function damageNumberPose(age: number, critical: boolean, seed: number) {
  const life = critical ? P.criticalNumberLife : P.numberLife,
    pop =
      age < 0.055
        ? 0.75 + 0.4 * Math.sin((Math.min(1, age / 0.055) * Math.PI) / 2)
        : 1 + 0.15 * Math.max(0, 1 - (age - 0.055) / 0.105) ** 2;
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
  0xffd76a, 0xffedaf, 0xfff9df, 0xd79b4a, 0x6b4540, 0xe83b45, 0xff6655,
  0x8f182c, 0xf69a63, 0xffe7ca, 0x6edcff, 0xffd65e, 0xe8fff4,
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
  stretch: number;
  enemyWidth: number;
}
export interface ShardDirection {
  nx?: number;
  ny?: number;
  nz?: number;
  dx?: number;
  dy?: number;
  dz?: number;
  streak?: boolean;
  level?: boolean;
}
/** Bounded visual pool. A reserve protects finishing/level bursts during sustained fire. */
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
    stretch: 1,
    enemyWidth: 1.25,
  }));
  private r = seededRandom(2601);
  private cursor = 0;
  private active = 0;
  spawn(
    x: number,
    y: number,
    z: number,
    count: number,
    death = false,
    scale = 1,
    direction: ShardDirection = {},
  ) {
    const free = this.items.length - this.active,
      adaptive = free < this.items.length * 0.3 ? 0.55 : 1;
    count = Math.ceil(count * adaptive);
    let emitted = 0;
    const nx = direction.nx ?? 0,
      ny = direction.ny ?? 0,
      nz = direction.nz ?? 1;
    const tangent = Math.hypot(nx, nz) || 1,
      tx = nz / tangent,
      tz = -nx / tangent;
    for (let i = 0; i < count; i++) {
      if (
        !death &&
        !direction.level &&
        this.active >= this.items.length - P.priorityReserve
      )
        break;
      let p: Shard | undefined;
      for (let n = 0; n < this.items.length; n++) {
        this.cursor = (this.cursor + 1) % this.items.length;
        if (this.items[this.cursor].life <= 0) {
          p = this.items[this.cursor];
          break;
        }
      }
      if (!p) break;
      const a = this.r() * Math.PI * 2,
        spread = (direction.streak ? 4.5 : 2.4) + this.r() * 2,
        life = (death ? 0.35 : 0.2) + this.r() * (death ? 0.3 : 0.22);
      const radial = death || direction.level;
      const dx = radial
        ? Math.cos(a) * spread
        : nx * 3 + tx * Math.cos(a) * spread + (direction.dx ?? -nx) * 0.6;
      const dz = radial
        ? Math.sin(a) * spread
        : nz * 3 + tz * Math.cos(a) * spread + (direction.dz ?? -nz) * 0.6;
      const dy = radial
        ? 1.5 + this.r() * 2
        : ny * 3 +
          Math.sin(a) * spread * tangent +
          0.7 +
          (direction.dy ?? -ny) * 0.6;
      const roll = this.r();
      Object.assign(p, {
        x,
        y,
        z,
        life,
        max: life,
        vx: dx,
        vy: dy,
        vz: dz,
        angle: a,
        spin: (this.r() - 0.5) * 18,
        size: (0.065 + this.r() * 0.045) * scale,
        color: direction.level
          ? 10 + Math.floor(this.r() * 3)
          : death
            ? 5 +
              (roll < 0.62
                ? 0
                : roll < 0.82
                  ? 1
                  : roll < 0.93
                    ? 2
                    : roll < 0.98
                      ? 3
                      : 4)
            : roll < 0.4
              ? 0
              : roll < 0.7
                ? 1
                : roll < 0.85
                  ? 2
                  : roll < 0.94
                    ? 3
                    : 4,
        stretch: direction.streak
          ? 3.5 + this.r() * 1.5
          : 0.65 + this.r() * 0.8,
        enemyWidth: 1.25 * scale,
      });
      this.active++;
      emitted++;
    }
    return emitted;
  }
  update(dt: number, floor: (x: number, z: number) => number) {
    const drag = 4.6,
      e = Math.exp(-drag * dt),
      integral = (1 - e) / drag,
      gravity = -6.5;
    for (const p of this.items)
      if (p.life > 0) {
        p.life = Math.max(0, p.life - dt);
        if (p.life === 0) this.active--;
        p.x += p.vx * integral;
        p.z += p.vz * integral;
        p.y += p.vy * integral + (gravity / drag) * (dt - integral);
        p.vx *= e;
        p.vz *= e;
        p.vy = p.vy * e + gravity * integral;
        p.angle += p.spin * dt;
        const ground = floor(p.x, p.z) + 0.04;
        if (p.y < ground) {
          p.y = ground;
          p.vy = Math.abs(p.vy) * 0.15;
        }
      }
  }
  reset() {
    for (const p of this.items) p.life = 0;
    this.active = this.cursor = 0;
    this.r = seededRandom(2601);
  }
}
/** One presentation policy; fractional combat health/damage stays untouched. */
export const damageLabel = (value: number) =>
  String(Math.max(0, Math.round(value)));
