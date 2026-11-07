import { COMBAT_FEEL } from "./tuning";
/** Simulation-time feedback freezes with pause; rapid hits cannot mask a kill. */
export class HitFeedback {
  remaining = 0;
  kill = false;
  confirm(kill: boolean) {
    // Preserve a recent kill without letting subsequent ordinary hits extend it forever.
    if (!kill && this.kill && this.remaining > 0) return;
    this.kill = kill;
    this.remaining = this.kill
      ? COMBAT_FEEL.killMarkerDuration
      : COMBAT_FEEL.hitMarkerDuration;
  }
  update(dt: number) {
    this.remaining = Math.max(0, this.remaining - dt);
    if (!this.remaining) this.kill = false;
  }
  reset() {
    this.remaining = 0;
    this.kill = false;
  }
}

/** A hitscan shot has exactly one first intersection, including enemies in front of the bell. */
export function shotTarget(enemy: number, bell: number, solid: number) {
  const distance = Math.min(enemy, bell, solid);
  if (!Number.isFinite(distance)) return "miss";
  if (solid <= distance) return "solid";
  return enemy <= distance ? "enemy" : "bell";
}
