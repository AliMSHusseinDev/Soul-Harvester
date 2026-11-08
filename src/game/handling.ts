import { ACCURACY_TUNING, VIEW } from "./tuning";
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
  weaponPose: "Hip" | "Sprint" | "SprintAirborne" | "SprintOut" = "Hip";
  private shotLock = 0;
  constructor(public sprintOutTime = 0.225) {}
  update(dt: number, intent: MovementIntent) {
    this.shotLock = Math.max(0, this.shotLock - dt);
    const wasSprinting = this.sprintPose;
    const sprint =
      intent.sprint &&
      (intent.grounded || wasSprinting) &&
      !intent.busy &&
      !intent.fire &&
      !intent.aim &&
      this.shotLock === 0;
    if (wasSprinting && !sprint) this.sprintOut = this.sprintOutTime;
    else this.sprintOut = Math.max(0, this.sprintOut - dt);
    if (this.sprintOut > 1e-8) this.state = "SprintOut";
    else if (sprint && intent.grounded) this.state = "Sprinting";
    else if (!intent.grounded)
      this.state = intent.verticalSpeed > 0 ? "Jumping" : "Falling";
    else if (intent.aim) this.state = "Aiming";
    else if (intent.fire) this.state = "Firing";
    else this.state = intent.moving ? "Walking" : "Idle";
    this.weaponPose =
      this.sprintOut > 1e-8
        ? "SprintOut"
        : sprint
          ? intent.grounded
            ? "Sprint"
            : "SprintAirborne"
          : "Hip";
  }
  get sprinting() {
    return this.state === "Sprinting";
  }
  get sprintPose() {
    return this.weaponPose === "Sprint" || this.weaponPose === "SprintAirborne";
  }
  get ready() {
    return !this.sprintPose && this.sprintOut <= 1e-8;
  }
  fired() {
    this.shotLock = 0.15;
  }
  reset() {
    this.state = "Idle";
    this.weaponPose = "Hip";
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
export const ACCURACY = ACCURACY_TUNING;
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
      : damp(this.angle, target, VIEW.accuracyResponse, dt);
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
