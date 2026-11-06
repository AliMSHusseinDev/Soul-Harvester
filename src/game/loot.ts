import { springStep, seededRandom } from "./math";
import { groundHeight } from "./terrain";
import type { Navigation, Point } from "./navigation";
import { ENEMY_CAPACITY } from "./waves";
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
    }),
  );
  private random = seededRandom(481);
  constructor(private navigation: Navigation) {}
  release(x: number, z: number) {
    for (const kind of ["gold", "xp"] as const) {
      const d = this.drops.find((d) => !d.active);
      if (!d)
        throw new Error(
          "Loot pool exhausted: preserve all outstanding rewards",
        );
      const angle = this.random() * Math.PI * 2,
        spread = 0.25 + this.random() * 0.35;
      const candidate = {
        x: x + Math.cos(angle) * spread,
        z: z + Math.sin(angle) * spread,
      };
      const safe =
        this.navigation.walkable(candidate.x, candidate.z) &&
        this.navigation.lineClear({ x, z }, candidate)
          ? candidate
          : { x, z };
      Object.assign(d, {
        active: true,
        kind,
        value: kind === "gold" ? 4 : 12,
        x: safe.x,
        z: safe.z,
        y: groundHeight(x, z) + 0.85,
        vx: Math.cos(angle) * 1.4,
        vy: 2 + this.random(),
        vz: Math.sin(angle) * 1.4,
        age: 0,
        magnet: false,
      });
    }
  }
  update(dt: number, player: Point & { y?: number }, magnetism: number) {
    const collected: {
      kind: "gold" | "xp";
      value: number;
      x: number;
      y: number;
      z: number;
    }[] = [];
    const targetY = (player.y ?? groundHeight(player.x, player.z)) + 0.8;
    for (const d of this.drops) {
      if (!d.active) continue;
      d.age += dt;
      const distance = Math.hypot(d.x - player.x, d.z - player.z);
      if (
        distance < 4.4 + magnetism * 0.65 &&
        this.navigation.lineClear(d, player)
      )
        d.magnet = true;
      if (distance > 13 || !this.navigation.lineClear(d, player))
        d.magnet = false;
      if (d.magnet) {
        const x = springStep(d.x, d.vx, player.x, 6, dt),
          y = springStep(d.y, d.vy, targetY, 6, dt),
          z = springStep(d.z, d.vz, player.z, 6, dt);
        d.x = x.position;
        d.vx = x.velocity;
        d.y = y.position;
        d.vy = y.velocity;
        d.z = z.position;
        d.y = Math.max(d.y, groundHeight(d.x, d.z) + 0.15);
        d.vz = z.velocity;
        if (Math.hypot(d.x - player.x, d.y - targetY, d.z - player.z) < 0.35) {
          d.active = false;
          collected.push({
            kind: d.kind,
            value: d.value,
            x: d.x,
            y: d.y,
            z: d.z,
          });
        }
      } else {
        d.vy -= 9 * dt;
        const nextX = d.x + d.vx * dt,
          nextZ = d.z + d.vz * dt;
        if (
          this.navigation.walkable(nextX, nextZ) &&
          this.navigation.lineClear(d, { x: nextX, z: nextZ })
        ) {
          d.x = nextX;
          d.z = nextZ;
        } else {
          d.vx *= -0.3;
          d.vz *= -0.3;
        }
        d.y += d.vy * dt;
        const floor = groundHeight(d.x, d.z) + 0.25;
        if (d.y < floor) {
          d.y = floor;
          d.vy = Math.abs(d.vy) > 0.6 ? -d.vy * 0.22 : 0;
        }
        d.vx *= Math.exp(-dt * 4);
        d.vz *= Math.exp(-dt * 4);
      }
    }
    return collected;
  }
  reset() {
    this.random = seededRandom(481);
    for (const d of this.drops) d.active = false;
  }
}
