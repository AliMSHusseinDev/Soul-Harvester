import { VFX as F } from "./tuning";
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
  | "soul"
  | "surface";
export const PARTICLE_SIZE_GAIN = F.sizeGain;
export const PARTICLE_CAPACITY = F.capacity;
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
  debris: 10,
} as const;
export interface SplatterImpact {
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
  nx: number;
  ny: number;
  nz: number;
}
export function debrisOpacity(age: number, fadeAt: number) {
  const t = Math.max(0, Math.min(1, (age - fadeAt) / F.debrisFade));
  return 1 - t * t * (3 - 2 * t);
}
/** Conservative reference envelope of the preceding shot-fan profile, before new launch gain. */
export function splatterRange(scale = 1) {
  return (
    (((F.deathSpeedMin + F.deathSpeedRange) *
      F.scatterGain *
      1.15 *
      (Math.sqrt(1 + 0.42 * 0.42) + 0.14) *
      -Math.expm1(-F.deathDrag * (F.deathLifeMin + F.deathLifeRange))) /
      F.deathDrag) *
    F.splatterRangeGain *
    scale
  );
}
export interface Particle {
  rangeOpacity: number;
  weight: number;
  rangeLimit: number;
  fadeAt: number;
  floorY: number;
  floorX: number;
  floorZ: number;
  collision: boolean;
  bounceLimit: number;
  bounces: number;
  settled: boolean;
  expireAge: number;
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
  surfaceFloor?: (x: number, z: number, ceiling: number) => number;
  readonly items: Particle[] = Array.from(
    { length: PARTICLE_CAPACITY },
    () => ({
      rangeOpacity: 1,
      weight: 0,
      rangeLimit: Infinity,
      fadeAt: Infinity,
      floorY: NaN,
      floorX: 0,
      floorZ: 0,
      collision: true,
      bounceLimit: Infinity,
      bounces: 0,
      settled: false,
      expireAge: Infinity,
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
    surface: 0,
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
    ny = 0,
    impact?: SplatterImpact,
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
        event === "surface"
          ? F.surfaceCount
          : event === "trail"
            ? 1
            : event === "soul"
              ? F.soulCount
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
                            ? F.levelCount
                            : F.abilityCount
                          : death
                            ? finishing
                              ? F.finisherCount
                              : F.deathCount
                            : critical
                              ? F.criticalCount
                              : F.hitCount,
      baseCount = Math.max(
        1,
        Math.ceil(total * (reduced ? F.reducedDensity : 1)),
      ),
      gravityBase = death
        ? Math.max(
            0,
            Math.ceil((baseCount - 8) / 3) -
              (finishing && !reduced && baseCount - 8 > 6 ? 1 : 0),
          )
        : 0,
      gravityExtra =
        Math.ceil(
          Math.ceil(gravityBase * F.gravityAmountGain) *
            F.gravityAdditionalGain,
        ) - gravityBase,
      rayBase = death
        ? baseCount - 8 - gravityBase - (finishing && !reduced ? 2 : 0)
        : 0,
      rayExtra = Math.ceil(Math.max(0, rayBase) * (F.splatterAmountGain - 1)),
      count = baseCount + gravityExtra + rayExtra,
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
    // One seeded fan frame per burst: shot-dependent axis, randomized phase/lobes/aspect.
    const phase = death ? this.random() * Math.PI * 2 : 0,
      aspect = death ? 0.72 + this.random() * 0.6 : 1,
      lobes = death ? 2 + Math.floor(this.random() * 3) : 2,
      twist = death ? this.random() * Math.PI * 2 : 0;
    let dx = impact ? impact.dx * 0.8 + impact.nx * 0.2 : nx,
      dy = impact ? impact.dy * 0.8 + impact.ny * 0.2 : 0,
      dz = impact ? impact.dz * 0.8 + impact.nz * 0.2 : nz;
    if (impact) {
      const offset = (v: number) =>
        Math.max(-1, Math.min(1, v / Math.max(0.1, scale)));
      dx += offset(impact.x - x) * 0.35;
      dy += offset(impact.y - y) * 0.35;
      dz += offset(impact.z - z) * 0.35;
    }
    let len = Math.hypot(dx, dy, dz);
    if (len < 0.001) {
      dx = Math.sin(phase);
      dy = 0;
      dz = Math.cos(phase);
      len = 1;
    }
    dx /= len;
    dy /= len;
    dz /= len;
    const horizontal = Math.hypot(dx, dz),
      tx = horizontal > 0.001 ? -dz / horizontal : 1,
      tz = horizontal > 0.001 ? dx / horizontal : 0,
      bx = dy * tz,
      by = dz * tx - dx * tz,
      bz = -dy * tx;
    let active = this.active;
    for (let i = 0; i < count; i++) {
      let p: Particle | undefined;
      // Circular scan, bounded by the fixed pool; reserve capacity for finishing/ability feedback.
      if (priority > 0 || active < PARTICLE_CAPACITY - F.reservedSlots)
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
              ? F.deathSpeedMin + this.random() * F.deathSpeedRange
              : 1.8 + this.random() * 4,
        life = small
          ? 0.25 + this.random() * 0.25
          : large
            ? 0.65 + this.random() * 0.65
            : death
              ? 0.38 + this.random() * 0.48
              : 0.18 + this.random() * 0.25;
      Object.assign(p, {
        rangeOpacity: 1,
        weight: 0,
        rangeLimit: Infinity,
        fadeAt: Infinity,
        floorY: NaN,
        floorX: 0,
        floorZ: 0,
        collision: true,
        bounceLimit: Infinity,
        bounces: 0,
        settled: false,
        expireAge: Infinity,
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
      if (
        !small &&
        event !== "hurt" &&
        event !== "soul" &&
        event !== "surface" &&
        !death &&
        i < 2
      ) {
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
        p.shape =
          i >= baseCount
            ? i < baseCount + gravityExtra
              ? SHAPE.debris
              : SHAPE.ribbon
            : i % 3 === 0
              ? SHAPE.debris
              : SHAPE.ribbon;
        p.collision = false;
        p.color = F.nongravitySplatterColor;
        p.size =
          (p.shape === SHAPE.ribbon
            ? 0.04 + this.random() * 0.025
            : 0.025 + this.random() * 0.035) * scale;
        p.stretch = p.shape === SHAPE.ribbon ? 5 + this.random() * 4 : 1;
        p.life = p.max = F.deathLifeMin + this.random() * F.deathLifeRange;
        p.gravity = 0;
        p.drag = F.deathDrag;
        p.vy = (this.random() - 0.25) * 9 * scale;
        if (p.shape === SHAPE.ribbon && i % 2 === 0) p.trail = 1;
        if (p.shape === SHAPE.ribbon) {
          const theta = a + phase + 0.22 * Math.sin(a * lobes + twist),
            speed = radial * (1 + 0.15 * Math.sin(theta * lobes + twist));
          let u = Math.cos(theta) * speed * aspect,
            v = Math.sin(theta) * speed * (0.6 + 0.18 * Math.cos(twist)),
            forward = speed * (0.2 + this.random() * 0.22);
          const normalize = speed / Math.max(0.001, Math.hypot(u, v));
          u *= normalize;
          v *= normalize;
          p.vx = (tx * u + bx * v + dx * forward) * scale;
          p.vy = (by * v + dy * forward + speed * 0.14) * scale;
          p.vz = (tz * u + bz * v + dz * forward) * scale;
          if (impact) {
            p.x = p.anchorX = impact.x;
            p.y = p.anchorY = impact.y;
            p.z = p.anchorZ = impact.z;
          }
          p.stretch *= 0.82 + this.random() * 0.36;
          p.weight =
            p.seed < 0.35
              ? 0.12 + p.seed * 0.6
              : p.seed < 0.8
                ? 0.5 + (p.seed - 0.35) * 1.1
                : 1.1 + (p.seed - 0.8) * 3;
          p.gravity = p.weight * F.splatterWeightGravity;
          p.drag =
            p.weight < 0.4
              ? F.splatterLightDrag +
                ((p.seed * 0.618 + serial * 0.37) % 1) *
                  F.splatterLightDragRange
              : 0.2 + ((p.seed * 0.618 + serial * 0.37) % 1) * 1.4;
          p.collision = true;
          p.bounceLimit = 0;
          p.rangeLimit = splatterRange(scale);
          p.life = p.max *=
            p.weight < 0.4
              ? F.splatterLightLifeGain
              : p.weight < 1
                ? F.splatterMediumLifeGain
                : 1;
          p.vx *= F.splatterLaunchGain;
          p.vy *= F.splatterLaunchGain;
          p.vz *= F.splatterLaunchGain;
        }
        if (p.shape === SHAPE.debris) {
          p.color = F.gravitySplatterColor;
          p.collision = true;
          p.size = (0.07 + this.random() * 0.03) * scale;
          p.stretch = 1;
          p.vx *= F.debrisSpread;
          p.vz *= F.debrisSpread;
          p.vy = (2 + this.random() * 2) * scale;
          p.gravity = F.debrisGravity;
          p.drag = F.debrisDrag;
          p.fadeAt = F.debrisLifeMin + this.random() * F.debrisLifeRange;
          p.life = p.max = p.fadeAt + F.debrisFade;
          p.bounceLimit =
            this.random() < F.debrisBounceChance ? 1 + (i % 2) : 0;
        }
        if (i >= baseCount - 8 && i < baseCount) {
          p.shape = SHAPE.smoke;
          p.collision = false;
          p.trail = 0;
          p.size = (0.36 + this.random() * 0.2) * scale;
          p.x += (this.random() - 0.5) * 0.2 * scale;
          p.z += (this.random() - 0.5) * 0.2 * scale;
          p.color = F.lethalColor;
          p.age = -F.lethalSmokeDelay;
          p.life = p.max = 0.65 + this.random() * 0.35;
          p.vx *= 0.2;
          p.vz *= 0.2;
          p.vy = 0.3 + this.random() * 0.45;
          p.gravity = 0;
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
      if (event === "hit" || event === "critical") {
        if (!p.overlay && p.shape !== SHAPE.smoke) {
          p.vx *= F.hitSpread;
          p.vz *= F.hitSpread;
        }
      }
      if (event === "critical" && !p.overlay && p.shape !== SHAPE.smoke) {
        p.size *= F.criticalFragmentSize;
        p.stretch = Math.min(p.stretch, F.criticalStretch);
        p.vx *= F.criticalFragmentSpeed;
        p.vy *= F.criticalFragmentSpeed;
        p.vz *= F.criticalFragmentSpeed;
      }
      if (event === "critical" && i < 2) {
        p.shape = i === 0 ? SHAPE.star : SHAPE.chip;
        p.size = (i === 0 ? F.criticalCoreSize : F.criticalAccentSize) * scale;
        p.color = i === 0 ? 0xfff4ce : 0xffb83d;
        p.life = p.max = i === 0 ? 0.075 : 0.14;
        p.angle = Math.PI / 4;
      }
      if (
        ((critical && !death && (i === 2 || i === 3)) ||
          (death && finishing && (i === 6 || i === 7))) &&
        !reduced
      ) {
        p.shape = SHAPE.streak;
        p.overlay = true;
        p.size = 0.035 * scale;
        p.stretch = 2.8;
        p.trail = 0;
        p.age = -F.criticalEchoDelay;
        p.life = p.max = 0.16;
        p.color = i % 2 === 0 ? 0xffc449 : 0xfff9d8;
        p.vx = i % 2 ? -1.5 : 1.5;
        p.vy = 1.2;
        p.vz = p.gravity = 0;
        p.drag = 2;
      }
      if (event === "surface") {
        const len = Math.hypot(nx, ny, nz) || 1,
          ux = nx / len,
          uy = ny / len,
          uz = nz / len;
        const tangentLen = Math.hypot(ux, uz),
          tx = tangentLen > 0.001 ? -uz / tangentLen : 1,
          tz = tangentLen > 0.001 ? ux / tangentLen : 0;
        const bx = uy * tz,
          by = uz * tx - ux * tz,
          bz = -uy * tx;
        const outward = 1.5 + this.random() * 2.5,
          spread = this.random() * 2;
        p.vx = ux * outward + (tx * Math.cos(a) + bx * Math.sin(a)) * spread;
        p.vy = uy * outward + by * Math.sin(a) * spread;
        p.vz = uz * outward + (tz * Math.cos(a) + bz * Math.sin(a)) * spread;
        p.shape = i < 2 ? SHAPE.smoke : i % 3 ? SHAPE.chip : SHAPE.streak;
        p.size = i < 2 ? 0.12 : 0.025 + this.random() * 0.035;
        p.life = p.max = 0.22 + this.random() * 0.2;
        p.gravity = 6;
        p.drag = 3;
        p.stretch = p.shape === SHAPE.streak ? 2.4 : 1;
        p.overlay = false;
        p.trail = 0;
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
      if (!p.ground && !p.overlay) {
        p.vx *= F.scatterGain;
        p.vy *= F.scatterGain;
        p.vz *= F.scatterGain;
      }
      if (p.color === F.nongravitySplatterColor) p.size *= F.nongravitySizeGain;
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
      p.life = Math.max(0, Math.min(p.max, p.expireAge) - p.age);
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
      if (Number.isFinite(p.rangeLimit)) {
        let rx = p.x - p.anchorX,
          ry = p.y - p.anchorY,
          rz = p.z - p.anchorZ;
        const distance = Math.hypot(rx, ry, rz),
          radius = p.rangeLimit;
        const edge = Math.max(
          0,
          Math.min(1, (radius - distance) / (radius * 0.12)),
        );
        p.rangeOpacity = Math.min(p.rangeOpacity, edge * edge * (3 - 2 * edge));
        if (p.rangeOpacity < 1)
          p.expireAge = Math.min(p.expireAge, p.age + 0.16);
        if (distance > radius * 0.8) {
          const inverse = 1 / Math.max(0.001, distance);
          rx *= inverse;
          ry *= inverse;
          rz *= inverse;
          const outward = Math.max(0, p.vx * rx + p.vy * ry + p.vz * rz),
            t = Math.min(1, (distance / radius - 0.8) / 0.2),
            loss = outward * (1 - Math.exp(-18 * t * t * activeDt));
          p.vx -= rx * loss;
          p.vy -= ry * loss;
          p.vz -= rz * loss;
          if (distance > radius) {
            p.x = p.anchorX + rx * radius;
            p.y = p.anchorY + ry * radius;
            p.z = p.anchorZ + rz * radius;
          }
        }
      }
      p.angle += p.spin * activeDt;
      if (p.trail && p.life > 0 && p.age < p.max * 0.75) {
        p.trailClock += activeDt;
        if (p.trailClock >= 0.045 && trails < trailSources.length) {
          p.trailClock %= 0.045;
          const t = trailSources[trails++];
          t.rangeOpacity = p.rangeOpacity;
          t.rangeLimit = p.rangeLimit;
          t.anchorX = p.anchorX;
          t.anchorY = p.anchorY;
          t.anchorZ = p.anchorZ;
          t.x = p.x;
          t.y = p.collision ? Math.max(p.y, floor(p.x, p.z) + 0.035) : p.y;
          t.z = p.z;
          t.size = p.size * 0.48;
          t.color =
            p.shape === SHAPE.ribbon ? F.nongravitySplatterColor : p.color;
        }
      }
      let support = floor(p.x, p.z);
      if (p.shape === SHAPE.debris && this.surfaceFloor) {
        if (
          !Number.isFinite(p.floorY) ||
          (!p.settled && Math.hypot(p.x - p.floorX, p.z - p.floorZ) > 0.15)
        ) {
          p.floorY = this.surfaceFloor(p.x, p.z, p.y + 0.3);
          p.floorX = p.x;
          p.floorZ = p.z;
        }
        support = Math.max(support, p.floorY);
      }
      const clearance =
        p.shape === SHAPE.debris
          ? Math.max(0.035, p.size * 0.45 + 0.012)
          : 0.035;
      const ground = support + clearance;
      if (p.collision && p.y < ground) {
        p.y = ground;
        if (p.bounces < p.bounceLimit && Math.abs(p.vy) > 0.65) {
          p.bounces++;
          p.vy =
            Math.abs(p.vy) *
            (p.shape === SHAPE.debris ? F.debrisRestitution : 0.22);
          p.vx *= 0.65;
          p.vz *= 0.65;
        } else {
          p.settled = true;
          p.vx = p.vy = p.vz = p.gravity = p.spin = 0;
          if (p.shape === SHAPE.ribbon)
            p.expireAge = Math.min(p.expireAge, p.age + 0.16);
          if (p.shape === SHAPE.debris) {
            p.floorY = support;
            if (this.surfaceFloor)
              for (let j = 0; j < 4; j++) {
                const offset = p.size * 0.75;
                p.floorY = Math.max(
                  p.floorY,
                  this.surfaceFloor(
                    p.x + (j & 1 ? offset : -offset),
                    p.z + (j & 2 ? offset : -offset),
                    p.y + 0.3,
                  ),
                );
              }
            p.y = p.floorY + clearance;
          }
        }
      }
      if (
        Number.isFinite(p.rangeLimit) &&
        Math.hypot(p.x - p.anchorX, p.y - p.anchorY, p.z - p.anchorZ) >
          p.rangeLimit + 1e-7
      ) {
        p.life = 0;
        p.expireAge = p.age;
      }
    }
    // Append trails after integration so their birth frame is independent of slot order.
    for (
      let i = 0,
        limit = Math.min(
          trails,
          Math.max(0, PARTICLE_CAPACITY - F.reservedSlots - this.active),
        );
      i < limit;
      i++
    ) {
      const t = trailSources[i];
      if (
        Number.isFinite(t.rangeLimit) &&
        Math.hypot(t.x - t.anchorX, t.y - t.anchorY, t.z - t.anchorZ) >
          t.rangeLimit + 1e-7
      )
        continue;
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
        rangeOpacity: t.rangeOpacity,
        weight: 0,
        rangeLimit: t.rangeLimit,
        fadeAt: Infinity,
        floorY: NaN,
        floorX: 0,
        floorZ: 0,
        collision: false,
        bounceLimit: 0,
        bounces: 0,
        settled: false,
        expireAge: Infinity,
        angle: 0,
        spin: 0,
        stretch: 1,
        seed: i / 12,
        serial: this.serial,
        visible: true,
        x: t.x,
        y: t.y,
        z: t.z,
        anchorX: t.anchorX,
        anchorY: t.anchorY,
        anchorZ: t.anchorZ,
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
    rangeOpacity: 1,
    rangeLimit: Infinity,
    anchorX: 0,
    anchorY: 0,
    anchorZ: 0,
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
