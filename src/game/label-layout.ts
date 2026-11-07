import { PRESENTATION as P } from "./tuning";
interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
/** Reused screen grid: one bit per label, exact rectangle checks after broad phase. */
export class LabelLayout {
  private cells = new Uint32Array(0);
  private columns = 0;
  private rows = 0;
  private used = 0;
  private pool: Rect[] = Array.from({ length: P.labelCapacity }, () => ({
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  }));
  begin() {
    this.cells.fill(0);
    this.used = 0;
  }
  place(
    x: number,
    y: number,
    width: number,
    height: number,
    w: number,
    h: number,
    priorX = 0,
    priorY = -42,
  ) {
    const columns = Math.max(1, Math.ceil(w / 64)),
      rows = Math.max(1, Math.ceil(h / 40));
    if (columns !== this.columns || rows !== this.rows) {
      this.columns = columns;
      this.rows = rows;
      this.cells = new Uint32Array(columns * rows);
    }
    if (this.used >= this.pool.length)
      return { dx: 0, dy: -42, visible: false };
    const index = this.used,
      r = this.pool[index],
      gap = Math.max(42, height / 2 + 25),
      baseY = Math.min(-gap, priorY);
    for (let attempt = 0; attempt < 89; attempt++) {
      const n = Math.max(0, attempt - 1),
        laneIndex = n % 11,
        lane =
          laneIndex === 0
            ? 0
            : Math.ceil(laneIndex / 2) * (laneIndex % 2 ? -1 : 1),
        dx = attempt === 0 ? priorX : lane * (width + 8),
        dy = attempt === 0 ? baseY : baseY - Math.floor(n / 11) * (height + 8),
        cx = Math.max(width / 2 + 10, Math.min(w - width / 2 - 10, x + dx)),
        cy = y + dy;
      if (cy - height / 2 < 12 || cy + height / 2 > h - 16) continue;
      r.left = cx - width / 2 - 2;
      r.right = cx + width / 2 + 2;
      r.top = cy - height / 2 - 2;
      r.bottom = cy + height / 2 + 2;
      const sight =
          r.left < w / 2 + 27 &&
          r.right > w / 2 - 27 &&
          r.top < h / 2 + 25 &&
          r.bottom > h / 2 - 25,
        hud =
          (r.left < 260 && r.top < 88) || (r.right > w - 108 && r.top < 106);
      if (sight || hud) continue;
      const x0 = Math.max(0, Math.floor(r.left / 64)),
        x1 = Math.min(columns - 1, Math.floor(r.right / 64)),
        y0 = Math.max(0, Math.floor(r.top / 40)),
        y1 = Math.min(rows - 1, Math.floor(r.bottom / 40));
      let candidates = 0;
      for (let yy = y0; yy <= y1; yy++)
        for (let xx = x0; xx <= x1; xx++)
          candidates |= this.cells[yy * columns + xx];
      let overlaps = false;
      while (candidates) {
        const bit = candidates & -candidates,
          a = this.pool[31 - Math.clz32(bit)];
        if (
          r.left < a.right &&
          r.right > a.left &&
          r.top < a.bottom &&
          r.bottom > a.top
        ) {
          overlaps = true;
          break;
        }
        candidates &= candidates - 1;
      }
      if (overlaps) continue;
      for (let yy = y0; yy <= y1; yy++)
        for (let xx = x0; xx <= x1; xx++)
          this.cells[yy * columns + xx] |= 1 << index;
      this.used++;
      return { dx: cx - x, dy, visible: true };
    }
    return { dx: priorX, dy: baseY, visible: false };
  }
}
