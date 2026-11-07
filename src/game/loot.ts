import { springStep, seededRandom } from "./math";
import { groundHeight } from "./terrain";
import type { Navigation, Point } from "./navigation";
import type { Reward } from "./rewards";
import { ENEMY_CAPACITY } from "./waves";
import { LOOT_FEEL as F } from "./tuning";
export interface Drop extends Point {
  id: number;
  active: boolean;
  kind: "gold" | "xp";
  value: number;
  y: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  magnet: boolean;
  magnetAge: number;
  bounces: number;
  acquireAfter: number;
}
export class Loot {
  readonly drops: Drop[] = Array.from(
    { length: ENEMY_CAPACITY * 2 + 32 },
    (_, id) => ({
      id,
      active: false,
      kind: "gold",
      value: 0,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      age: 0,
      magnet: false,
      magnetAge: 0,
      bounces: 0,
      acquireAfter: F.magnetDelay,
    }),
  );
  private collected: (Point & {
    kind: "gold" | "xp";
    value: number;
    y: number;
  })[] = [];
  private random = seededRandom(481);
  private magnetBudget = 0;
  constructor(private navigation: Navigation) {}
  release(x: number, z: number, reward: Reward) {
    const startAngle = this.random() * Math.PI * 2;
    for (const [i, kind] of (["xp", "gold"] as const).entries()) {
      const value = reward[kind];
      if (value <= 0) continue;
      const d = this.drops.find((d) => !d.active);
      if (!d)
        throw new Error(
          "Loot pool exhausted: preserve all outstanding rewards",
        );
      const angle = startAngle + i * 2.39996 + this.random() * 0.3,
        speed = F.launchSpeed * (0.75 + this.random() * 0.5);
      Object.assign(d, {
        active: true,
        kind,
        value,
        x,
        z,
        y: groundHeight(x, z) + F.releaseHeight,
        vx: Math.cos(angle) * speed,
        vy: F.launchUp + this.random() * 0.5,
        vz: Math.sin(angle) * speed,
        age: 0,
        magnet: false,
        magnetAge: 0,
        bounces: 0,
        acquireAfter: F.magnetDelay + this.random() * F.acquisitionJitter,
      });
    }
  }
  update(dt: number, player: Point & { y?: number }, magnetism: number) {
    this.collected.length = 0;
    this.magnetBudget = Math.min(
      F.acquisitionPerStep * 2,
      this.magnetBudget + dt * 60 * F.acquisitionPerStep,
    );
    const targetY =
      (player.y ?? groundHeight(player.x, player.z)) + F.targetHeight;
    for (const d of this.drops) {
      if (!d.active) continue;
      d.age += dt;
      const distance = Math.hypot(d.x - player.x, d.z - player.z),
        inRange = distance < F.magnetRadius + magnetism * F.magnetPerPoint,
        clear = (d.magnet || inRange) && this.navigation.lineClear(d, player);
      if (
        !d.magnet &&
        d.age >= d.acquireAfter &&
        inRange &&
        clear &&
        this.magnetBudget >= 1
      ) {
        d.magnet = true;
        this.magnetBudget--;
        const dx = player.x - d.x,
          dz = player.z - d.z,
          len = Math.hypot(dx, dz) || 1,
          curve = Math.sin(d.id * 2.39996) * 0.4;
        d.vx -= (dz / len) * curve;
        d.vz += (dx / len) * curve;
      }
      if (distance > 13 || !clear) {
        d.magnet = false;
        d.magnetAge = 0;
      }
      if (d.magnet) {
        d.magnetAge += dt;
        const t = Math.min(1, d.magnetAge / F.accelerationTime),
          omega =
            F.springStart + (F.springEnd - F.springStart) * t * t * (3 - 2 * t),
          x = springStep(d.x, d.vx, player.x, omega, dt),
          y = springStep(d.y, d.vy, targetY, omega, dt),
          z = springStep(d.z, d.vz, player.z, omega, dt),
          step = Math.hypot(
            x.position - d.x,
            y.position - d.y,
            z.position - d.z,
          ),
          scale = step > F.maxSpeed * dt ? (F.maxSpeed * dt) / step : 1;
        const next = {
          x: d.x + (x.position - d.x) * scale,
          z: d.z + (z.position - d.z) * scale,
        };
        if (!this.navigation.lineClear(d, next)) {
          d.magnet = false;
          d.magnetAge = 0;
          continue;
        }
        d.x = next.x;
        d.z = next.z;
        d.y += (y.position - d.y) * scale;
        d.y = Math.max(d.y, groundHeight(d.x, d.z) + F.floorOffset);
        d.vx = x.velocity * scale;
        d.vy = y.velocity * scale;
        d.vz = z.velocity * scale;
        if (
          Math.hypot(d.x - player.x, d.y - targetY, d.z - player.z) <
          F.collectRadius
        ) {
          d.active = false;
          this.collected.push({
            kind: d.kind,
            value: d.value,
            x: d.x,
            y: d.y,
            z: d.z,
          });
        }
      } else {
        d.vy -= F.gravity * dt;
        const next = { x: d.x + d.vx * dt, z: d.z + d.vz * dt };
        if (
          this.navigation.walkable(next.x, next.z) &&
          this.navigation.lineClear(d, next)
        ) {
          d.x = next.x;
          d.z = next.z;
        } else {
          d.vx *= -0.3;
          d.vz *= -0.3;
        }
        d.y += d.vy * dt;
        const floor = groundHeight(d.x, d.z) + F.floorOffset;
        let grounded = false;
        if (d.y < floor) {
          d.y = floor;
          if (d.vy < -0.7) {
            d.vy = -d.vy * F.restitution;
            d.bounces++;
          } else {
            d.vy = 0;
            grounded = true;
          }
        }
        const drag = Math.exp(-dt * (grounded ? F.groundDrag : F.airDrag));
        d.vx *= drag;
        d.vz *= drag;
      }
    }
    return this.collected;
  }
  reset() {
    this.random = seededRandom(481);
    this.magnetBudget = 0;
    this.collected.length = 0;
    for (const d of this.drops) d.active = false;
  }
}
