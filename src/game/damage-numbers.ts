import * as THREE from "three";
import { damageLabel, damageNumberPose } from "./presentation";
import { PRESENTATION as P } from "./tuning";
import { groundHeight } from "./terrain";
import { LabelLayout } from "./label-layout";
import type { WorldVisibility } from "./world-visibility";

/** World anchors, screen-space glyphs: terrain and the weapon cannot swallow text. */
export class DamageNumbers {
  private slots = Array.from({ length: P.labelCapacity }, () => ({
    element: document.createElement("span"),
    origin: new THREE.Vector3(),
    life: 0,
    age: 0,
    serial: 0,
    critical: false,
    important: false,
    headshot: false,
    killed: false,
    value: 0,
    width: 0,
    dx: 0,
    dy: -42,
    x: 0,
    y: 0,
    visible: false,
    seen: false,
    occluded: false,
  }));
  private serial = 0;
  private frame = 0;
  private order = new Int16Array(P.labelCapacity);
  private layout = new LabelLayout();
  private projected = new THREE.Vector3();
  constructor(
    private camera: THREE.PerspectiveCamera,
    private visibility: WorldVisibility,
  ) {
    let root = document.getElementById("damage-numbers");
    if (!root) {
      root = document.createElement("div");
      root.id = "damage-numbers";
      root.className = "damage-numbers";
      root.setAttribute("aria-hidden", "true");
      document.body.append(root);
    }
    for (const n of this.slots) {
      n.element.className = "damage-label";
      n.element.hidden = true;
      root.append(n.element);
    }
  }
  spawn(
    x: number,
    z: number,
    damage: number,
    y: number,
    critical: boolean,
    details: { headshot?: boolean; killed?: boolean },
  ) {
    const important = critical || !!details.killed;
    let n = this.slots.find((n) => n.life <= 0);
    if (!n)
      for (const other of this.slots) {
        if (other.important && !important) continue;
        if (
          !n ||
          (!other.important && n.important) ||
          (other.important === n.important && other.serial < n.serial)
        )
          n = other;
      }
    if (!n) return;
    const label = damageLabel(damage);
    n.serial = ++this.serial;
    n.value = Number(label);
    n.critical = critical;
    n.important = important;
    n.headshot = !!details.headshot;
    n.killed = !!details.killed;
    n.age = 0;
    n.life = critical ? P.criticalNumberLife : P.numberLife;
    n.origin.set(x, Math.max(y + 0.25, groundHeight(x, z) + 0.35), z);
    n.dx = Math.sin(n.serial * 2.39996) * 9;
    n.dy = -42;
    n.seen = n.visible = n.occluded = false;
    n.width = label.length * 14 + (critical ? 18 : 0) + 8;
    n.element.textContent = label;
    n.element.dataset.critical = String(critical);
    n.element.dataset.headshot = String(n.headshot);
    n.element.dataset.kill = String(n.killed);
    n.element.hidden = true;
  }
  step(dt: number) {
    for (const n of this.slots)
      if (n.life > 0) {
        n.age += dt;
        n.life = Math.max(0, n.life - dt);
        if (n.life === 0) {
          n.element.hidden = true;
          n.visible = false;
        }
      }
  }
  render(height: number, reduced: boolean) {
    const width = height * this.camera.aspect;
    this.frame++;
    this.layout.begin();
    let count = 0;
    // Stable priority ordering; newborn normal hits cannot move a critical label.
    for (let i = 0; i < this.slots.length; i++) {
      const n = this.slots[i];
      if (n.life <= 0) continue;
      let at = count++;
      while (at > 0) {
        const before = this.slots[this.order[at - 1]],
          priority = Number(n.important) - Number(before.important);
        if (priority < 0 || (priority === 0 && n.serial >= before.serial))
          break;
        this.order[at] = this.order[at - 1];
        at--;
      }
      this.order[at] = i;
    }
    for (let j = 0; j < count; j++) {
      const index = this.order[j],
        n = this.slots[index];
      n.visible = false;
      n.element.hidden = true;
      this.projected
        .copy(n.origin)
        .applyMatrix4(this.camera.matrixWorldInverse);
      if (-this.projected.z <= this.camera.near) continue;
      this.projected.copy(n.origin).project(this.camera);
      if (
        this.projected.z < -1 ||
        this.projected.z > 1 ||
        Math.abs(this.projected.x) > 1.08 ||
        Math.abs(this.projected.y) > 1.08
      )
        continue;
      if (!n.seen || ((this.frame + index) & 3) === 0) {
        n.occluded = this.visibility.occluded(this.camera.position, n.origin);
      }
      if (n.occluded) continue;
      const age = n.age,
        pose = damageNumberPose(age, n.critical, n.serial),
        scale = reduced ? (n.critical ? 1.3 : 1) : pose.scale,
        x = (this.projected.x * 0.5 + 0.5) * width + pose.side,
        y = (-this.projected.y * 0.5 + 0.5) * height - pose.rise,
        placement = this.layout.place(
          x,
          y,
          n.width * scale,
          28 * scale,
          width,
          height,
          n.dx,
          n.dy,
        );
      if (!placement.visible) continue;
      n.dx = placement.dx;
      n.dy = placement.dy;
      n.x = Math.round(x + n.dx);
      n.y = Math.round(y + n.dy);
      n.element.style.transform = `translate3d(${n.x}px,${n.y}px,0) translate(-50%,-50%) rotate(${reduced ? 0 : pose.rotation}rad) scale(${scale})`;
      n.element.style.opacity = String(pose.opacity);
      n.element.hidden = false;
      n.visible = n.seen = true;
    }
  }
  diagnostics() {
    return this.slots
      .filter((n) => n.life > 0)
      .map((n) => ({
        value: n.value,
        critical: n.critical,
        age: n.age,
        headshot: n.headshot,
        important: n.important,
        visible: n.visible,
        x: n.x,
        y: n.y,
        offsetY: n.dy,
        worldY: n.origin.y,
        floor: groundHeight(n.origin.x, n.origin.z),
      }));
  }
  reset() {
    for (const n of this.slots) {
      n.life = 0;
      n.element.hidden = true;
      n.visible = false;
    }
    this.serial = this.frame = 0;
  }
}
