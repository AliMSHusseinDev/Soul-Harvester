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
  | "heal"
  | "orb"
  | "soul";
export const PARTICLE_SIZE_GAIN = 1.15;
export const PARTICLE_CAPACITY = 1536;
export const SHAPE = {
  chip: 0,
  streak: 1,
  ring: 2,
  star: 3,
  smoke: 4,
  cube: 5,
  plus: 6,
  wisp: 7,
  arc: 8,
  ribbon: 9,
} as const;
export interface Particle {
  trail: number;
  trailClock: number;
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
      trail: 0,
      trailClock: 0,
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
    orb: 0,
    soul: 0,
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
    finishing = false,
  ) {
    this.events[event]++;
    const serial = ++this.serial;
    this.randomState = (serial * 2654435761) >>> 0;
    const large =
        event === "nova" || event === "level" || event === "explosion",
      death = event === "death",
      critical = event === "critical" || (death && finishing),
      small =
        event === "trail" ||
        event === "pickup" ||
        event === "spawn" ||
        event === "heal" ||
        event === "orb",
      priority = large || death ? 2 : small ? 0 : 1,
      total =
        event === "trail"
          ? 1
          : event === "soul"
            ? 48
            : event === "pickup"
              ? 7
              : event === "spawn"
                ? 10
                : event === "orb"
                  ? 8
                  : event === "cast"
                    ? 14
                    : event === "hurt"
                      ? 12
                      : large
                        ? event === "level"
                          ? 128
                          : 98
                        : death
                          ? finishing
                            ? 60
                            : 52
                          : critical
                            ? 42
                            : 25,
      count = Math.max(1, Math.ceil(total * (reduced ? 0.48 : 1))),
      palette = color
        ? [color]
        : death || event === "hurt"
          ? RED
          : event === "level" ||
              event === "nova" ||
              event === "cast" ||
              event === "spawn" ||
              event === "soul"
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
        trail: 0,
        trailClock: 0,
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
      if (!small && event !== "hurt" && event !== "soul" && !death && i < 2) {
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
      // Authored layers are scheduled in simulation time, including delayed echoes.
      if (
        (event === "hit" || event === "critical") &&
        i >= count - (critical ? 4 : 2)
      ) {
        p.shape = SHAPE.smoke;
        p.size = (critical ? 0.28 : 0.22) * scale;
        p.color = [0xba737f, 0x96515f, 0xc9848d][i % 3];
        p.life = p.max = 0.38 + this.random() * 0.22;
        p.gravity = -0.6;
        p.drag = 5;
        p.vx *= 0.18;
        p.vz *= 0.18;
        p.vy = 0.22 + this.random() * 0.3;
        p.spin = (this.random() - 0.5) * 0.5;
      }
      if (death) {
        p.shape = i % 3 === 0 ? SHAPE.chip : SHAPE.ribbon;
        p.color =
          i % 3 === 0
            ? 0x9e2844
            : [0xf18a9c, 0xe87088, 0xd65d77, 0xf6a3ac][i % 4];
        p.size =
          (p.shape === SHAPE.ribbon
            ? 0.05 + this.random() * 0.04
            : 0.025 + this.random() * 0.035) * scale;
        p.stretch = p.shape === SHAPE.ribbon ? 3.4 + this.random() * 2.4 : 1;
        p.life = p.max = 0.24 + this.random() * 0.2;
        p.gravity = 4;
        p.drag = 2.8;
        p.vy = (this.random() - 0.15) * 5 * scale;
        if (p.shape === SHAPE.ribbon && i % 2 === 0) p.trail = 1;
        if (i >= count - 8) {
          p.shape = SHAPE.smoke;
          p.trail = 0;
          p.size = (0.36 + this.random() * 0.2) * scale;
          p.x += (this.random() - 0.5) * 0.2 * scale;
          p.z += (this.random() - 0.5) * 0.2 * scale;
          p.color = [0xd47b8d, 0x98485e, 0xc8798c, 0xae596e][i % 4];
          p.life = p.max = 0.65 + this.random() * 0.35;
          p.vx *= 0.2;
          p.vz *= 0.2;
          p.vy = 0.3 + this.random() * 0.45;
          p.gravity = -0.5;
          p.drag = 3;
          p.spin = (this.random() - 0.5) * 0.5;
        }
      }
      if (event === "soul") {
        p.shape =
          i % 4 === 0 ? SHAPE.wisp : i % 2 === 0 ? SHAPE.streak : SHAPE.chip;
        p.color = TEAL[i % 4];
        p.size =
          (p.shape === SHAPE.wisp ? 0.07 : 0.028 + this.random() * 0.025) *
          scale;
        p.stretch = p.shape === SHAPE.wisp ? 4 : 3;
        p.vx = Math.cos(a) * (2 + this.random() * 4);
        p.vz = Math.sin(a) * (2 + this.random() * 4);
        p.vy = 1.2 + this.random() * 4;
        p.gravity = 1.2;
        p.drag = 2;
        p.life = p.max = 0.45 + this.random() * 0.25;
      }
      if (event === "hit" && i === 0) {
        p.size = 0.12 * scale;
        p.life = p.max = 0.065;
      }
      if (event === "hit" && i === 1) {
        p.shape = SHAPE.chip;
        p.overlay = false;
        p.size = 0.04 * scale;
        p.life = p.max = 0.18;
        p.color = 0xc4677d;
        p.vy = 0.8;
      }
      if (event === "critical" && i === 0) p.size = 0.18 * scale;
      if (
        ((critical && !death && (i === 2 || i === 3)) ||
          (death && finishing && (i === 6 || i === 7))) &&
        !reduced
      ) {
        p.shape = i % 2 === 0 ? SHAPE.ring : SHAPE.star;
        p.overlay = true;
        p.size = (i % 2 === 0 ? 0.83 : 0.28) * scale;
        p.trail = 0;
        p.age = -0.07;
        p.life = p.max = i % 2 === 0 ? 0.3 : 0.12;
        p.color = i % 2 === 0 ? 0xffc449 : 0xfff9d8;
        p.vx = p.vy = p.vz = p.gravity = p.drag = 0;
      }
      if (large && i >= 2 && i <= 5 && !reduced) {
        p.shape = i % 2 === 0 ? SHAPE.arc : SHAPE.ring;
        p.ground = true;
        p.size = (i % 2 === 0 ? 4.5 : 5.4) * scale;
        p.life = p.max = 0.85;
        p.age = -0.09 * (i - 1);
        p.color = event === "explosion" ? 0xffae47 : TEAL[i % 4];
        p.vx = p.vy = p.vz = p.gravity = 0;
        p.spin = i % 2 ? -0.7 : 0.7;
      }
      if (event === "level" && i >= 6 && i < 30) {
        const orbit = i * 2.399963;
        p.shape = i % 3 ? SHAPE.star : SHAPE.wisp;
        p.x = x + Math.cos(orbit) * 2.5;
        p.z = z + Math.sin(orbit) * 2.5;
        p.vx = -Math.sin(orbit) * 1.6;
        p.vz = Math.cos(orbit) * 1.6;
        p.drag = 0.4;
        p.vy = 0.7 + this.random();
      }
      if (event === "orb") {
        p.shape = i < 2 ? SHAPE.wisp : SHAPE.chip;
        p.color = i < 2 ? 0xffdf89 : 0xff9b31;
        p.size = (i < 2 ? 0.17 : 0.035) * scale;
        p.life = p.max = 0.22 + this.random() * 0.15;
        p.vx = Math.cos(a) * 0.6;
        p.vz = Math.sin(a) * 0.6;
        p.vy = 0.3;
        p.gravity = -0.3;
      }
      if (!small && p.shape === SHAPE.streak && i % 5 === 0) p.trail = 1;
      p.size *= PARTICLE_SIZE_GAIN;
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
    let trails = 0;
    const trailSources = this.trailSources;
    for (const p of this.items) {
      if (p.life <= 0) continue;
      const previousAge = p.age;
      p.age += dt;
      if (p.age < 0) continue;
      const activeDt = previousAge < 0 ? Math.min(dt, p.age) : dt;
      p.life = Math.max(0, p.max - p.age);
      if (p.overlay && !p.presented && p.age < p.max + 0.18)
        p.life = Math.max(0.0001, p.life);
      if (p.life <= 0) continue;
      // Same closed-form motion in all axes, without allocating vectors or intermediate objects.
      const e = Math.exp(-p.drag * activeDt),
        k = p.drag > 1e-6 ? -Math.expm1(-p.drag * activeDt) / p.drag : activeDt,
        fall =
          p.drag > 1e-6 ? (activeDt - k) / p.drag : activeDt * activeDt * 0.5;
      p.x += p.vx * k;
      p.z += p.vz * k;
      p.y += p.vy * k - p.gravity * fall;
      p.vx *= e;
      p.vz *= e;
      p.vy = p.vy * e - p.gravity * k;
      p.angle += p.spin * activeDt;
      if (p.trail && p.life > 0 && p.age < p.max * 0.75) {
        p.trailClock += activeDt;
        if (p.trailClock >= 0.045 && trails < trailSources.length) {
          p.trailClock %= 0.045;
          const t = trailSources[trails++];
          t.x = p.x;
          t.y = p.y;
          t.z = p.z;
          t.size = p.size * 0.48;
          t.color = p.shape === SHAPE.ribbon ? 0x98283f : p.color;
        }
      }
      const ground = floor(p.x, p.z) + 0.035;
      if (p.y < ground) {
        p.y = ground;
        p.vy = Math.abs(p.vy) * 0.22;
        p.vx *= 0.65;
        p.vz *= 0.65;
      }
    }
    // Append trails after integration so their birth frame is independent of slot order.
    for (
      let i = 0,
        limit = Math.min(
          trails,
          Math.max(0, PARTICLE_CAPACITY - 256 - this.active),
        );
      i < limit;
      i++
    ) {
      const t = trailSources[i];
      let child: Particle | undefined;
      for (let n = 0; n < this.items.length; n++) {
        const c = this.items[this.cursor];
        this.cursor = (this.cursor + 1) % this.items.length;
        if (c.life <= 0) {
          child = c;
          break;
        }
      }
      if (!child) break;
      Object.assign(child, {
        angle: 0,
        spin: 0,
        stretch: 1,
        seed: i / 12,
        serial: this.serial,
        visible: true,
        x: t.x,
        y: t.y,
        z: t.z,
        anchorX: t.x,
        anchorY: t.y,
        anchorZ: t.z,
        life: 0.18,
        max: 0.18,
        age: 0,
        size: t.size,
        color: t.color,
        shape: SHAPE.chip,
        overlay: false,
        ground: false,
        vx: 0,
        vy: 0.1,
        vz: 0,
        gravity: 0,
        drag: 1,
        trail: 0,
        trailClock: 0,
        priority: 0,
        presented: false,
      });
      this.emitted++;
    }
  }

  private trailSources = Array.from({ length: 12 }, () => ({
    x: 0,
    y: 0,
    z: 0,
    size: 0,
    color: 0,
  }));
  reset() {
    for (const p of this.items) p.life = 0;
    for (const key of Object.keys(this.events) as ParticleEvent[])
      this.events[key] = 0;
    this.cursor = this.serial = this.emitted = this.dropped = 0;
  }
}
