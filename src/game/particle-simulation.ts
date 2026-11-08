/** Bounded, deterministic particles. No textures, timers, or scene objects per emission. */
export type ParticleEvent =
  | "hit"
  | "critical"
  | "death"
  | "nova"
  | "explosion"
  | "cast"
  | "pickup"
  | "trail"
  | "level"
  | "spawn"
  | "hurt"
  | "heal";
export const PARTICLE_CAPACITY = 1536;
export const SHAPE = {
  chip: 0,
  streak: 1,
  ring: 2,
  star: 3,
  smoke: 4,
  cube: 5,
  plus: 6,
} as const;
export interface Particle {
  life: number;
  max: number;
  age: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  stretch: number;
  spin: number;
  angle: number;
  gravity: number;
  drag: number;
  color: number;
  shape: number;
  overlay: boolean;
  ground: boolean;
  priority: number;
  serial: number;
  seed: number;
  visible: boolean;
  presented: boolean;
  anchorX: number;
  anchorY: number;
  anchorZ: number;
}
const GOLD = [0xffef9b, 0xffcd39, 0xffa52b, 0xfff8d4];
const RED = [0xdb4d61, 0xa52a43, 0x742f44, 0xf17b82];
const TEAL = [0x6bffe1, 0x3bd5d5, 0xd5fff4, 0x8defff];
/** Exact solution of dv/dt=-drag*v-gravity; stable at different fixed-step rates. */
export function dragMotion(
  v: number,
  drag: number,
  gravity: number,
  dt: number,
) {
  if (drag < 1e-6)
    return {
      distance: v * dt - 0.5 * gravity * dt * dt,
      velocity: v - gravity * dt,
    };
  const decay = Math.exp(-drag * dt),
    k = -Math.expm1(-drag * dt) / drag;
  return {
    distance: v * k - (gravity * (dt - k)) / drag,
    velocity: v * decay - gravity * k,
  };
}
export class ParticleSimulation {
  readonly items: Particle[] = Array.from(
    { length: PARTICLE_CAPACITY },
    () => ({
      life: 0,
      max: 1,
      age: 0,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      size: 0.1,
      stretch: 1,
      spin: 0,
      angle: 0,
      gravity: 0,
      drag: 0,
      color: 0xffffff,
      shape: 0,
      overlay: false,
      ground: false,
      priority: 0,
      serial: 0,
      seed: 0,
      visible: true,
      presented: false,
      anchorX: 0,
      anchorY: 0,
      anchorZ: 0,
    }),
  );
  private cursor = 0;
  private serial = 0;
  private randomState = 1;
  emitted = 0;
  dropped = 0;
  readonly events: Record<ParticleEvent, number> = {
    hit: 0,
    critical: 0,
    death: 0,
    nova: 0,
    explosion: 0,
    cast: 0,
    pickup: 0,
    trail: 0,
    level: 0,
    spawn: 0,
    hurt: 0,
    heal: 0,
  };
  private random() {
    this.randomState =
      (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0;
    return this.randomState / 4294967296;
  }
  emit(
    event: ParticleEvent,
    x: number,
    y: number,
    z: number,
    scale = 1,
    reduced = false,
    color?: number,
    nx = 0,
    nz = 0,
  ) {
    this.events[event]++;
    const serial = ++this.serial;
    this.randomState = (serial * 2654435761) >>> 0;
    const large =
        event === "nova" || event === "level" || event === "explosion",
      death = event === "death",
      critical = event === "critical",
      small =
        event === "trail" ||
        event === "pickup" ||
        event === "spawn" ||
        event === "heal",
      priority = large || death ? 2 : small ? 0 : 1,
      total =
        event === "trail"
          ? 1
          : event === "pickup"
            ? 7
            : event === "spawn"
              ? 10
              : event === "cast"
                ? 14
                : event === "hurt"
                  ? 12
                  : large
                    ? event === "level"
                      ? 112
                      : 90
                    : death
                      ? 48
                      : critical
                        ? 38
                        : 25,
      count = Math.max(1, Math.ceil(total * (reduced ? 0.48 : 1))),
      palette = color
        ? [color]
        : death || event === "hurt"
          ? RED
          : event === "level" ||
              event === "nova" ||
              event === "cast" ||
              event === "spawn"
            ? TEAL
            : GOLD;
    let active = this.active;
    for (let i = 0; i < count; i++) {
      let p: Particle | undefined;
      // Circular scan, bounded by the fixed pool; reserve capacity for finishing/ability feedback.
      if (priority > 0 || active < PARTICLE_CAPACITY - 256)
        for (let n = 0; n < this.items.length; n++) {
          const candidate = this.items[this.cursor];
          this.cursor = (this.cursor + 1) % this.items.length;
          if (candidate.life <= 0) {
            p = candidate;
            break;
          }
        }
      if (!p && priority > 0) p = this.items.find((p) => p.priority < priority);
      if (!p) {
        this.dropped++;
        continue;
      }
      if (p.life <= 0) active++;
      const a = i * 2.399963 + this.random() * 0.65,
        radial = small
          ? 0.35
          : large
            ? 3 + this.random() * 7
            : death
              ? 1.5 + this.random() * 4
              : 1.8 + this.random() * 4,
        life = small
          ? 0.25 + this.random() * 0.25
          : large
            ? 0.65 + this.random() * 0.65
            : death
              ? 0.38 + this.random() * 0.48
              : 0.18 + this.random() * 0.25;
      Object.assign(p, {
        life,
        max: life,
        age: 0,
        x,
        y,
        z,
        anchorX: x,
        anchorY: y,
        anchorZ: z,
        vx: (Math.cos(a) * radial + nx * 1.5) * scale,
        vy:
          (small
            ? 0.4
            : large
              ? 1 + this.random() * 4
              : death
                ? 2 + this.random() * 3
                : (this.random() - 0.2) * 4) * scale,
        vz: (Math.sin(a) * radial + nz * 1.5) * scale,
        size:
          (small
            ? 0.025 + this.random() * 0.04
            : death
              ? 0.09 + this.random() * 0.12
              : 0.035 + this.random() * 0.055) * scale,
        stretch: 1,
        spin: (this.random() - 0.5) * 12,
        angle: a,
        gravity: small ? -0.3 : large ? 2.5 : death ? 10 : 5,
        drag: death ? 2 : 3.4,
        color: palette[i % palette.length],
        shape: death
          ? i % 3 === 0
            ? SHAPE.smoke
            : SHAPE.cube
          : i % 3
            ? SHAPE.streak
            : SHAPE.chip,
        overlay: false,
        ground: false,
        priority,
        serial,
        seed: this.random(),
        visible: true,
        presented: false,
      });
      if (p.shape === SHAPE.streak) p.stretch = 2 + this.random() * 3;
      if (p.shape === SHAPE.smoke) {
        p.size *= 2.7;
        p.gravity = -1;
        p.drag = 4;
      }
      if (event === "level") {
        p.x += Math.cos(a) * (1.5 + this.random() * 3);
        p.z += Math.sin(a) * (1.5 + this.random() * 3);
        p.vx *= 0.3;
        p.vz *= 0.3;
        p.vy = 1 + this.random() * 2;
      }
      if (event === "pickup" && i === 0) {
        p.overlay = true;
        p.size = 0.18;
        p.life = p.max = 0.28;
      }
      if (event === "level" || event === "pickup") {
        p.shape = i % 3 === 0 ? SHAPE.star : SHAPE.chip;
        p.gravity = -0.5;
      }
      if (event === "heal") {
        p.shape = SHAPE.plus;
        p.overlay = true;
        p.size = 0.09 * scale;
        p.life = p.max = 0.45 + this.random() * 0.2;
        p.color = 0xacff83;
        p.vy = 0.5 + this.random() * 0.4;
        p.spin = 0;
        p.angle = 0;
      }
      if (event === "explosion" && i % 5 === 0) {
        p.shape = SHAPE.smoke;
        p.size = 0.5 + this.random() * 0.5;
        p.color = 0x755446;
        p.gravity = -1.5;
      }
      if (small && event !== "pickup" && event !== "heal") {
        p.shape = SHAPE.chip;
        p.gravity = -0.5;
      }
      // A fast core + slower broken ring. Only these two planes bypass actors/viewmodel.
      if (!small && event !== "hurt" && i < 2) {
        p.shape = i === 0 ? SHAPE.star : SHAPE.ring;
        p.overlay = !large;
        p.ground = large && i === 1;
        p.size =
          (large
            ? i === 1
              ? 5
              : 1.8
            : death
              ? 0.75
              : critical
                ? 0.62
                : 0.38) * scale;
        p.color = death
          ? 0xff8493
          : event === "nova" || event === "level"
            ? 0x8cfff1
            : i === 0
              ? 0xfffbe5
              : 0xffdc62;
        p.life = p.max = large ? 0.85 : i === 0 ? 0.1 : critical ? 0.3 : 0.23;
        p.vx = p.vy = p.vz = p.gravity = p.drag = 0;
        p.angle = 0;
        p.spin = 0.3;
        if (p.ground) p.y = y - 0.55;
      }
      this.emitted++;
    }
  }
  get active() {
    let n = 0;
    for (const p of this.items) if (p.life > 0) n++;
    return n;
  }
  step(dt: number, floor: (x: number, z: number) => number) {
    if (!(dt > 0) || !Number.isFinite(dt)) return;
    for (const p of this.items) {
      if (p.life <= 0) continue;
      p.age += dt;
      p.life = Math.max(0, p.max - p.age);
      if (p.overlay && !p.presented && p.age < p.max + 0.18)
        p.life = Math.max(0.0001, p.life);
      if (p.life <= 0) continue;
      // Same closed-form motion in all axes, without allocating vectors or intermediate objects.
      const e = Math.exp(-p.drag * dt),
        k = p.drag > 1e-6 ? -Math.expm1(-p.drag * dt) / p.drag : dt,
        fall = p.drag > 1e-6 ? (dt - k) / p.drag : dt * dt * 0.5;
      p.x += p.vx * k;
      p.z += p.vz * k;
      p.y += p.vy * k - p.gravity * fall;
      p.vx *= e;
      p.vz *= e;
      p.vy = p.vy * e - p.gravity * k;
      p.angle += p.spin * dt;
      const ground = floor(p.x, p.z) + 0.035;
      if (p.y < ground) {
        p.y = ground;
        p.vy = Math.abs(p.vy) * 0.22;
        p.vx *= 0.65;
        p.vz *= 0.65;
      }
    }
  }
  reset() {
    for (const p of this.items) p.life = 0;
    for (const key of Object.keys(this.events) as ParticleEvent[])
      this.events[key] = 0;
    this.cursor = this.serial = this.emitted = this.dropped = 0;
  }
}
