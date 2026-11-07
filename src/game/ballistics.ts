import { seededRandom } from "./math";
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
export interface SmokePuff extends Vec3 {
  life: number;
  max: number;
  vx: number;
  vy: number;
  vz: number;
  phase: number;
  size: number;
}
/** Emitted particles stay in world space; looking around never rotates old smoke. */
export class BarrelSmoke {
  readonly items: SmokePuff[] = Array.from({ length: 96 }, () => ({
    x: 0,
    y: 0,
    z: 0,
    life: 0,
    max: 1,
    vx: 0,
    vy: 0,
    vz: 0,
    phase: 0,
    size: 0,
  }));
  private random = seededRandom(7001);
  heat = 0;
  private clock = 0;
  emitted = 0;
  emit(origin: Vec3, direction: Vec3, movement: Vec3) {
    const p = this.items.find((p) => p.life <= 0);
    if (!p) return false;
    const life = 0.55 + this.random() * 0.55;
    Object.assign(p, {
      x: origin.x,
      y: origin.y,
      z: origin.z,
      life,
      max: life,
      vx: movement.x * 0.15 + direction.x * 0.18,
      vy: 0.16 + this.random() * 0.12,
      vz: movement.z * 0.15 + direction.z * 0.18,
      phase: this.random() * Math.PI * 2,
      size: 0.055 + this.random() * 0.035,
    });
    this.emitted++;
    return true;
  }
  shot(origin: Vec3, direction: Vec3, movement: Vec3) {
    this.heat = Math.min(1, this.heat + 0.2);
    for (let i = 0; i < 2 + Math.floor(this.heat * 2); i++)
      this.emit(origin, direction, movement);
  }
  update(
    dt: number,
    time: number,
    origin: Vec3,
    direction: Vec3,
    movement: Vec3,
  ) {
    this.heat = Math.max(0, this.heat - dt * 0.55);
    this.clock += dt;
    if (this.heat > 0.25 && this.clock > 0.06) {
      this.clock = 0;
      this.emit(origin, direction, movement);
    }
    const drag = Math.exp(-dt * 1.3);
    for (const p of this.items)
      if (p.life > 0) {
        p.life = Math.max(0, p.life - dt);
        const curl = Math.sin(p.phase + time * 2.5 + p.y * 1.8);
        p.vx = (p.vx + curl * 0.13 * dt) * drag;
        p.vz =
          (p.vz + Math.cos(p.phase + time * 2 + p.x * 2) * 0.13 * dt) * drag;
        p.vy = (p.vy + 0.42 * dt) * Math.exp(-dt * 0.6);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
      }
  }
  reset() {
    this.heat = this.clock = this.emitted = 0;
    this.random = seededRandom(7001);
    for (const p of this.items) p.life = 0;
  }
}
