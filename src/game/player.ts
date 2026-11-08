import { PLAYER_BALANCE as P } from "./tuning";
import * as THREE from "three";
import { damp, resolveCircle, type Solid } from "./math";
import type { Input } from "./input";
import { MAP, groundHeight } from "./terrain";
import { Handling } from "./handling";
import { Stamina } from "./stamina";
export class Player {
  readonly position = new THREE.Vector3(
    MAP.player.x,
    groundHeight(MAP.player.x, MAP.player.z),
    MAP.player.z,
  );
  readonly previous = this.position.clone();
  readonly endurance = new Stamina();
  private vx = 0;
  private vz = 0;
  private vy = 0;
  get stamina() {
    return this.endurance.value;
  }
  distance = 0;
  grounded = true;
  speed = 0;
  athletics = 1;
  moveMultiplier = 1;
  private jumpCount = 0;
  private jumpHeld = false;
  readonly handling = new Handling();
  crouching = false;
  busy = false;
  private eyeHeight = P.eyeHeight;
  readonly velocity = new THREE.Vector3();
  constructor(
    private input: Input,
    private solids: Solid[],
  ) {}
  update(dt: number) {
    this.previous.copy(this.position);
    const surfaceAttached =
      this.grounded &&
      Math.abs(
        this.position.y - groundHeight(this.position.x, this.position.z),
      ) < 0.06;
    let x =
      Number(this.input.keys.has("KeyD")) - Number(this.input.keys.has("KeyA"));
    let z =
      Number(this.input.keys.has("KeyS")) - Number(this.input.keys.has("KeyW"));
    const length = Math.hypot(x, z);
    if (length) {
      x /= length;
      z /= length;
    }
    const jump = this.input.keys.has("Space");
    const requested = this.input.jumpQueued || (jump && !this.jumpHeld);
    this.crouching =
      !requested &&
      this.grounded &&
      (this.input.keys.has("KeyC") || this.input.keys.has("ControlLeft"));
    const sprintWanted =
      this.endurance.available &&
      z < 0 &&
      !this.crouching &&
      (this.input.keys.has("ShiftLeft") || this.input.keys.has("ShiftRight")) &&
      this.stamina > 0;
    this.handling.update(dt, {
      sprint: sprintWanted,
      fire: !!(this.input.firing || this.input.fireQueued),
      aim: !!this.input.aiming,
      busy: this.busy,
      grounded: this.grounded && !requested,
      verticalSpeed: requested ? 1 : this.vy,
      moving: length > 0,
    });
    const sprint = this.handling.sprintPose;
    const speed =
      (sprint
        ? P.sprintSpeed
        : this.crouching
          ? P.crouchSpeed
          : this.input.aiming
            ? P.aimSpeed
            : P.walkSpeed) * this.moveMultiplier;
    this.endurance.update(dt, sprint);
    if (sprint && !this.endurance.available)
      this.handling.update(0, {
        sprint: false,
        fire: false,
        aim: false,
        busy: false,
        grounded: this.grounded,
        verticalSpeed: this.vy,
        moving: length > 0,
      });
    const c = Math.cos(this.input.yaw),
      s = Math.sin(this.input.yaw);
    this.vx = damp(this.vx, (x * c + z * s) * speed, P.acceleration, dt);
    this.vz = damp(this.vz, (z * c - x * s) * speed, P.acceleration, dt);
    this.input.jumpQueued = false;
    if (
      requested &&
      (this.grounded || (this.athletics >= 3 && this.jumpCount < 2))
    ) {
      this.vy = this.athletics >= 2 ? P.highJumpSpeed : P.jumpSpeed;
      this.jumpCount++;
      this.grounded = false;
    }
    this.jumpHeld = jump;
    const oldY = this.position.y;
    this.grounded = false;
    this.vy -= P.gravity * dt;
    this.position.y += this.vy * dt;
    // Land on prop tops when crossing them from above, rather than being pushed sideways.
    if (this.vy <= 0)
      for (const b of this.solids) {
        const nx = Math.max(b.minX, Math.min(this.position.x, b.maxX)),
          nz = Math.max(b.minZ, Math.min(this.position.z, b.maxZ));
        if (
          oldY >= b.height &&
          this.position.y <= b.height &&
          Math.hypot(this.position.x - nx, this.position.z - nz) < 0.35
        ) {
          this.position.y = b.height;
          this.vy = 0;
          this.grounded = true;
        }
      }
    const floor = groundHeight(this.position.x, this.position.z);
    if (this.position.y <= floor) {
      this.position.y = floor;
      this.vy = 0;
      this.grounded = true;
    }
    if (this.grounded) this.jumpCount = 0;
    // Fixed timestep + substeps keep displacement below the collision radius.
    const slices = Math.max(
      1,
      Math.ceil((Math.hypot(this.vx, this.vz) * dt) / 0.18),
    );
    for (let i = 0; i < slices; i++) {
      const p = resolveCircle(
        this.position.x + (this.vx * dt) / slices,
        this.position.z + (this.vz * dt) / slices,
        P.radius,
        this.position.y,
        this.solids,
      );
      this.position.x = p.x;
      this.position.z = p.z;
    }
    this.position.x = THREE.MathUtils.clamp(
      this.position.x,
      MAP.minX + 0.5,
      MAP.maxX - 0.5,
    );
    this.position.z = THREE.MathUtils.clamp(
      this.position.z,
      MAP.minZ + 0.5,
      MAP.maxZ - 0.5,
    );
    const newFloor = groundHeight(this.position.x, this.position.z);
    if (
      surfaceAttached &&
      !requested &&
      Math.abs(newFloor - groundHeight(this.previous.x, this.previous.z)) < 0.25
    ) {
      this.position.y = newFloor;
      this.vy = 0;
      this.grounded = true;
    } else if (this.position.y < newFloor) {
      this.position.y = newFloor;
      this.vy = 0;
      this.grounded = true;
    }
    this.velocity.set(
      (this.position.x - this.previous.x) / dt,
      this.vy,
      (this.position.z - this.previous.z) / dt,
    );
    this.speed = Math.hypot(this.velocity.x, this.velocity.z);
    this.distance += this.speed * dt;
    this.eyeHeight = damp(
      this.eyeHeight,
      this.crouching ? P.crouchEyeHeight : P.eyeHeight,
      16,
      dt,
    );
  }
  render(
    camera: THREE.PerspectiveCamera,
    alpha: number,
    reducedMotion: boolean,
  ) {
    camera.position.lerpVectors(this.previous, this.position, alpha);
    camera.position.y +=
      this.eyeHeight +
      (reducedMotion || !this.grounded
        ? 0
        : Math.sin(this.distance * 2.1) *
          (this.handling.sprinting ? 0.024 : 0.018) *
          Math.min(this.speed / 4, 1));
    camera.rotation.set(this.input.pitch, this.input.yaw, 0, "YXZ");
  }
  reset() {
    this.position.set(
      MAP.player.x,
      groundHeight(MAP.player.x, MAP.player.z),
      MAP.player.z,
    );
    this.previous.copy(this.position);
    this.vx = 0;
    this.vz = 0;
    this.vy = 0;
    this.velocity.set(0, 0, 0);
    this.jumpCount = 0;
    this.jumpHeld = false;
    this.endurance.reset();
    this.grounded = true;
    this.distance = 0;
    this.speed = 0;
    this.eyeHeight = P.eyeHeight;
    this.crouching = this.busy = false;
    this.handling.reset();
  }
  stop() {
    this.velocity.set(0, 0, 0);
    this.vx = 0;
    this.vz = 0;
    this.previous.copy(this.position);
  }
}
