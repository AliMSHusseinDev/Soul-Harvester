import { damp } from "./math";
export type MovementState =
  | "Idle"
  | "Walking"
  | "Sprinting"
  | "SprintOut"
  | "Jumping"
  | "Falling"
  | "Aiming"
  | "Firing";
export interface MovementIntent {
  sprint: boolean;
  fire: boolean;
  aim: boolean;
  busy: boolean;
  grounded: boolean;
  verticalSpeed: number;
  moving: boolean;
}
/** Owns fire/ADS readiness. Timers advance only with the gameplay simulation. */
export class Handling {
  state: MovementState = "Idle";
  sprintOut = 0;
  private shotLock = 0;
  constructor(public sprintOutTime = 0.225) {}
  update(dt: number, intent: MovementIntent) {
    this.shotLock = Math.max(0, this.shotLock - dt);
    const wasSprinting = this.state === "Sprinting";
    const sprint =
      intent.sprint &&
      intent.grounded &&
      !intent.busy &&
      !intent.fire &&
      !intent.aim &&
      this.shotLock === 0;
    if (wasSprinting && !sprint) this.sprintOut = this.sprintOutTime;
    else this.sprintOut = Math.max(0, this.sprintOut - dt);
    if (this.sprintOut > 1e-8) this.state = "SprintOut";
    else if (sprint) this.state = "Sprinting";
    else if (!intent.grounded)
      this.state = intent.verticalSpeed > 0 ? "Jumping" : "Falling";
    else if (intent.aim) this.state = "Aiming";
    else if (intent.fire) this.state = "Firing";
    else this.state = intent.moving ? "Walking" : "Idle";
  }
  get sprinting() {
    return this.state === "Sprinting";
  }
  get ready() {
    return !this.sprinting && this.sprintOut <= 1e-8;
  }
  fired() {
    this.shotLock = 0.15;
  }
  reset() {
    this.state = "Idle";
    this.sprintOut = this.shotLock = 0;
  }
}
export interface AccuracyConfig {
  base: number;
  crouch: number;
  movement: number;
  airborne: number;
  shot: number;
  maxShot: number;
  recover: number;
  sprintBloom: number;
  sprintOut: number;
  tracerEvery: number;
}
export const ACCURACY = {
  rifle: {
    crouch: 0.85,
    base: 0.0135,
    movement: 0.0016,
    airborne: 0.027,
    shot: 0.004,
    maxShot: 0.02,
    recover: 9,
    sprintBloom: 0.028,
    sprintOut: 0.225,
    tracerEvery: 2,
  },
  pistol: {
    crouch: 0.85,
    base: 0.0105,
    movement: 0.0019,
    airborne: 0.024,
    shot: 0.006,
    maxShot: 0.023,
    recover: 8,
    sprintBloom: 0.025,
    sprintOut: 0.2,
    tracerEvery: 1,
  },
  blade: {
    crouch: 0.85,
    base: 0.01,
    movement: 0.001,
    airborne: 0.02,
    shot: 0,
    maxShot: 0,
    recover: 10,
    sprintBloom: 0.02,
    sprintOut: 0.18,
    tracerEvery: 0,
  },
} satisfies Record<string, AccuracyConfig>;
/** One angular cone drives both sampled bullets and the projected HUD gap. */
export class HipAccuracy {
  angle = ACCURACY.rifle.base;
  private shotBloom = 0;
  update(
    dt: number,
    config: AccuracyConfig,
    speed: number,
    grounded: boolean,
    crouching: boolean,
    sprintOut: boolean,
  ) {
    this.shotBloom *= Math.exp(-config.recover * dt);
    const target =
      config.base * (crouching ? config.crouch : 1) +
      speed * config.movement +
      (grounded ? 0 : config.airborne) +
      this.shotBloom;
    this.angle = sprintOut
      ? Math.max(this.angle, target + config.sprintBloom)
      : damp(this.angle, target, 18, dt);
  }
  fired(config: AccuracyConfig) {
    this.shotBloom = Math.min(config.maxShot, this.shotBloom + config.shot);
  }
  gap(height: number, fov: number) {
    return Math.round(
      (Math.tan(this.angle) * height) / (2 * Math.tan((fov * Math.PI) / 360)),
    );
  }
  sample(random: () => number, aiming: boolean) {
    if (aiming) return { x: 0, y: 0 };
    const radius = Math.sqrt(random()) * Math.tan(this.angle),
      theta = random() * Math.PI * 2;
    return { x: Math.cos(theta) * radius, y: Math.sin(theta) * radius };
  }
  reset(config: AccuracyConfig) {
    this.angle = config.base;
    this.shotBloom = 0;
  }
}
