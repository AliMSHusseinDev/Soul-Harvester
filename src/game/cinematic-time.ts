/** A single unscaled envelope; rapid level-ups cannot multiply or restart time scale. */
export class CinematicTime {
  private elapsed = 1;
  scale = 1;
  get active() {
    return this.elapsed < 0.87;
  }
  trigger() {
    if (this.active) return false;
    this.elapsed = 0;
    return true;
  }
  update(realDt: number) {
    this.elapsed = Math.min(0.87, this.elapsed + Math.max(0, realDt));
    const t = this.elapsed;
    if (t < 0.12) this.scale = 1 - 0.65 * (1 - (1 - t / 0.12) ** 3);
    else if (t < 0.27) this.scale = 0.35;
    else this.scale = 0.35 + 0.65 * (1 - (1 - (t - 0.27) / 0.6) ** 3);
    return this.scale;
  }
  reset() {
    this.elapsed = 1;
    this.scale = 1;
  }
}
