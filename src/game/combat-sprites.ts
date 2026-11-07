/** Authored animation rectangles are in pixels, measured from the atlas top left. */
export type CombatEffectKind = "normal" | "critical" | "death";
export interface CombatFrame {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Mean alpha coverage, so faint authored wisps do not consume opaque coverage. */
  coverage: number;
}
export interface CombatSheet {
  kind: CombatEffectKind;
  url: string;
  source?: string;
  width: number;
  height: number;
  frames: readonly CombatFrame[];
  /** All frames use the same canvas and anchor; never crop each frame independently. */
  anchor: readonly [number, number];
  fps?: number;
}
export const COMBAT_PROFILES = {
  // Canvas ratios include the original transparent margins: peak visible art
  // spans approximately 55% / 65% / 85% of the enemy width.
  normal: { priority: 0, duration: 0.28, ratio: 0.62, maxScreen: 0.14 },
  critical: { priority: 1, duration: 0.36, ratio: 0.82, maxScreen: 0.18 },
  death: { priority: 2, duration: 0.6, ratio: 0.95, maxScreen: 0.23 },
} as const;
export const COMBAT_BUDGET = {
  capacity: 48,
  normalLimit: 28,
  criticalLimit: 40,
} as const;

export function validateCombatSheet(sheet: CombatSheet) {
  if (
    !Object.hasOwn(COMBAT_PROFILES, sheet.kind) ||
    !sheet.url ||
    !Number.isInteger(sheet.width) ||
    !Number.isInteger(sheet.height) ||
    sheet.width < 1 ||
    sheet.height < 1 ||
    sheet.frames.length < 2 ||
    (sheet.fps !== undefined &&
      (!Number.isFinite(sheet.fps) || sheet.fps <= 0)) ||
    sheet.anchor.length !== 2 ||
    sheet.anchor.some((n) => !Number.isFinite(n) || n < 0 || n > 1)
  )
    throw new Error(`Invalid combat sheet: ${sheet.kind}`);
  const first = sheet.frames[0];
  for (const f of sheet.frames)
    if (
      ![f.x, f.y, f.width, f.height].every(Number.isInteger) ||
      f.x < 0 ||
      f.y < 0 ||
      f.width < 1 ||
      f.height < 1 ||
      f.x + f.width > sheet.width ||
      f.y + f.height > sheet.height ||
      f.width !== first.width ||
      f.height !== first.height ||
      !Number.isFinite(f.coverage) ||
      f.coverage < 0 ||
      f.coverage > 1
    )
      throw new Error(`Invalid combat frame: ${sheet.kind}`);
}

/** Pixel-centre UVs stay inside the selected frame, including nearest minification. */
export function combatFrameUV(sheet: CombatSheet, index: number) {
  const f = sheet.frames[index];
  return [
    (f.x + 0.5) / sheet.width,
    1 - (f.y + f.height - 0.5) / sheet.height,
    (f.width - 1) / sheet.width,
    (f.height - 1) / sheet.height,
  ] as const;
}
export function combatEffectKind(
  critical: boolean,
  lethal: boolean,
): CombatEffectKind {
  return lethal ? "death" : critical ? "critical" : "normal";
}
/** Ratio first, a bounded distant floor and a resolution-relative close-range cap. */
export function combatSpriteWidth(
  kind: CombatEffectKind,
  enemyWidth: number,
  depth: number,
  focal: number,
  viewportHeight: number,
) {
  const p = COMBAT_PROFILES[kind],
    units = Math.max(0.06, depth) / focal,
    base = enemyWidth * p.ratio,
    floor = Math.min(base * 1.35, (kind === "death" ? 20 : 12) * units),
    cap = viewportHeight * p.maxScreen * units;
  return Math.min(cap, Math.max(base, floor));
}
export interface CombatBurst {
  active: boolean;
  kind: CombatEffectKind;
  x: number;
  y: number;
  z: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  enemyWidth: number;
  age: number;
  duration: number;
  rotation: number;
  serial: number;
  /** The last authored frame gets one presentation before the slot is retired. */
  finalPresented: boolean;
}
/** Bounded scans are intentional; important effects can replace lower-priority slots. */
export class CombatBursts {
  readonly items: CombatBurst[] = Array.from(
    { length: COMBAT_BUDGET.capacity },
    () => ({
      active: false,
      kind: "normal",
      x: 0,
      y: 0,
      z: 0,
      offsetX: 0,
      offsetY: 0,
      offsetZ: 0,
      enemyWidth: 1.25,
      age: 0,
      duration: 1,
      rotation: 0,
      serial: 0,
      finalPresented: false,
    }),
  );
  private serial = 0;
  dropped = 0;
  replaced = 0;
  spawn(
    kind: CombatEffectKind,
    x: number,
    y: number,
    z: number,
    enemyWidth: number,
    sheet: CombatSheet,
    playbackSpeed = 1,
    duration?: number,
    offset?: { x: number; y: number; z: number },
  ) {
    if (
      ![x, y, z, enemyWidth, playbackSpeed].every(Number.isFinite) ||
      enemyWidth <= 0 ||
      playbackSpeed <= 0 ||
      (duration !== undefined && (!Number.isFinite(duration) || duration <= 0))
    )
      return false;
    const priority = COMBAT_PROFILES[kind].priority;
    let active = 0,
      oldest: CombatBurst | undefined,
      free: CombatBurst | undefined;
    for (const b of this.items) {
      if (!b.active) {
        free ??= b;
        continue;
      }
      active++;
      const other = COMBAT_PROFILES[b.kind].priority;
      if (other > priority) continue;
      if (
        !oldest ||
        other < COMBAT_PROFILES[oldest.kind].priority ||
        (other === COMBAT_PROFILES[oldest.kind].priority &&
          b.serial < oldest.serial)
      )
        oldest = b;
    }
    const limit =
      kind === "normal"
        ? COMBAT_BUDGET.normalLimit
        : kind === "critical"
          ? COMBAT_BUDGET.criticalLimit
          : COMBAT_BUDGET.capacity;
    const b = active < limit ? (free ?? oldest) : oldest;
    if (!b) {
      this.dropped++;
      return false;
    }
    if (b.active) this.replaced++;
    const serial = ++this.serial;
    Object.assign(b, {
      active: true,
      kind,
      x,
      y,
      z,
      offsetX: offset?.x ?? 0,
      offsetY: offset?.y ?? 0,
      offsetZ: offset?.z ?? 0,
      enemyWidth,
      age: 0,
      duration:
        (duration ??
          (sheet.fps
            ? sheet.frames.length / sheet.fps
            : COMBAT_PROFILES[kind].duration)) / playbackSpeed,
      rotation: Math.sin(serial * 2.39996) * (kind === "death" ? 0.08 : 0.2),
      serial,
      finalPresented: false,
    });
    return true;
  }
  step(dt: number) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    for (const b of this.items)
      if (b.active) {
        if (b.finalPresented) b.active = false;
        else b.age = Math.min(b.duration, b.age + dt);
      }
  }
  frame(b: CombatBurst, frames: number) {
    return Math.min(frames - 1, Math.floor((b.age / b.duration) * frames));
  }
  presented(b: CombatBurst) {
    if (b.age >= b.duration) b.finalPresented = true;
  }
  reset() {
    for (const b of this.items) b.active = false;
    this.serial = this.dropped = this.replaced = 0;
  }
}

/** Reused coarse screen grid. Coverage attenuates lower-priority layers, never changes damage. */
export class CombatCoverage {
  private grid = new Float32Array(32 * 18);
  private total = 0;
  reset() {
    this.grid.fill(0);
    this.total = 0;
  }
  admit(
    x: number,
    y: number,
    w: number,
    h: number,
    coverage: number,
    kind: CombatEffectKind | "fragment",
  ) {
    const left = Math.max(0, (x - w / 2) * 32),
      right = Math.min(32, (x + w / 2) * 32),
      top = Math.max(0, (y - h / 2) * 18),
      bottom = Math.min(18, (y + h / 2) * 18);
    if (right <= left || bottom <= top) return 0;
    const x0 = Math.floor(left),
      x1 = Math.min(31, Math.floor(right)),
      y0 = Math.floor(top),
      y1 = Math.min(17, Math.floor(bottom)),
      area = ((right - left) * (bottom - top) * coverage) / (32 * 18),
      peak =
        kind === "death"
          ? 0.85
          : kind === "critical"
            ? 0.8
            : kind === "fragment"
              ? 0.5
              : 0.7;
    let opacity = Math.min(1, (0.08 - this.total) / Math.max(0.000001, area));
    for (let j = y0; j <= y1; j++)
      for (let i = x0; i <= x1; i++) {
        const weight =
          coverage *
          Math.max(0, Math.min(right, i + 1) - Math.max(left, i)) *
          Math.max(0, Math.min(bottom, j + 1) - Math.max(top, j));
        if (weight > 0)
          opacity = Math.min(opacity, (peak - this.grid[j * 32 + i]) / weight);
      }
    opacity = Math.max(0, opacity);
    for (let j = y0; j <= y1; j++)
      for (let i = x0; i <= x1; i++) {
        const weight =
          coverage *
          Math.max(0, Math.min(right, i + 1) - Math.max(left, i)) *
          Math.max(0, Math.min(bottom, j + 1) - Math.max(top, j));
        this.grid[j * 32 + i] += weight * opacity;
      }
    this.total += area * opacity;
    return opacity;
  }
}
