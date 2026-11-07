import { PRESENTATION as P } from "./tuning";
interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
/** A tiny screen grid; labels reuse their prior offset to avoid placement jitter. */
export class LabelLayout {
  private cells = new Map<number, Rect[]>();
  private pool: Rect[] = Array.from({ length: P.labelCapacity }, () => ({
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  }));
  private used = 0;
  begin() {
    for (const cell of this.cells.values()) cell.length = 0;
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
    priorY = -20,
  ) {
    const r = this.pool[this.used++];
    let dx = priorX,
      dy = priorY;
    for (let attempt = 0; attempt < 41; attempt++) {
      if (attempt) {
        const lane = ((attempt - 1) % 5) - 2,
          row = Math.floor((attempt - 1) / 5);
        dx = lane * (width + 5);
        dy = (row % 2 ? -1 : 1) * (-40 - Math.floor(row / 2) * (height + 5));
      }
      const cx = Math.max(width / 2 + 10, Math.min(w - width / 2 - 10, x + dx)),
        cy = Math.max(height / 2 + 20, Math.min(h - height / 2 - 20, y + dy));
      r.left = cx - width / 2 - 2;
      r.right = cx + width / 2 + 2;
      r.top = cy - height / 2 - 2;
      r.bottom = cy + height / 2 + 2;
      const sight =
        r.left < w / 2 + 24 &&
        r.right > w / 2 - 24 &&
        r.top < h / 2 + 24 &&
        r.bottom > h / 2 - 24;
      let overlap = sight;
      for (
        let yy = Math.floor(r.top / 40);
        yy <= Math.floor(r.bottom / 40) && !overlap;
        yy++
      )
        for (
          let xx = Math.floor(r.left / 64);
          xx <= Math.floor(r.right / 64) && !overlap;
          xx++
        ) {
          const cell = this.cells.get(xx * 4096 + yy);
          if (cell)
            for (const a of cell)
              if (
                a !== r &&
                r.left < a.right &&
                r.right > a.left &&
                r.top < a.bottom &&
                r.bottom > a.top
              ) {
                overlap = true;
                break;
              }
        }
      dx = cx - x;
      dy = cy - y;
      if (!overlap) break;
    }
    for (let yy = Math.floor(r.top / 40); yy <= Math.floor(r.bottom / 40); yy++)
      for (
        let xx = Math.floor(r.left / 64);
        xx <= Math.floor(r.right / 64);
        xx++
      ) {
        const key = xx * 4096 + yy,
          cell = this.cells.get(key);
        if (cell) cell.push(r);
        else this.cells.set(key, [r]);
      }
    return { dx, dy };
  }
}
