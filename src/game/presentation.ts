import { PRESENTATION as P } from "./tuning";
export function damageNumberPose(age: number, critical: boolean, seed: number) {
  const life = critical ? P.criticalNumberLife : P.numberLife,
    t = Math.max(0, Math.min(1, age / life)),
    pop =
      age < 0.065
        ? 0.62 + 0.64 * Math.sin((Math.min(1, age / 0.065) * Math.PI) / 2)
        : 1 + 0.26 * (1 + (age - 0.065) * 32) * Math.exp(-(age - 0.065) * 32),
    fade = Math.max(0, Math.min(1, (1 - t) / 0.28));
  return {
    scale: (critical ? 1.3 : 1) * pop,
    opacity: fade * fade * (3 - 2 * fade),
    rise:
      ((1 - Math.exp(-t * 3.6)) / (1 - Math.exp(-3.6))) * (critical ? 72 : 52),
    side:
      Math.sin(seed * 2.39996) * (1 - Math.exp(-t * 5)) * (critical ? 15 : 10),
    rotation:
      Math.sin(seed * 2.39996) *
      (critical ? 0.07 : 0.035) *
      Math.exp(-age * 14),
    life,
  };
}
export type AbilityKind = "burst" | "orb";
export class AbilityPresentation {
  private pending: { kind: AbilityKind; remaining: number }[] = [];
  private ready: AbilityKind[] = [];
  begin(kind: AbilityKind) {
    if (this.pending.some((p) => p.kind === kind)) return false;
    this.pending.push({
      kind,
      remaining: kind === "burst" ? P.burstWindup : P.orbWindup,
    });
    return true;
  }
  update(dt: number) {
    this.ready.length = 0;
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i];
      p.remaining -= dt;
      if (p.remaining <= 0) {
        this.ready.push(p.kind);
        this.pending.splice(i, 1);
      }
    }
    return this.ready;
  }
  reset() {
    this.pending.length = 0;
    this.ready.length = 0;
  }
  get count() {
    return this.pending.length;
  }
}
export const damageLabel = (value: number) =>
  String(Math.max(0, Math.round(value)));
