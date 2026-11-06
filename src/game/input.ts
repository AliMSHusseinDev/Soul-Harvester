export class Input {
  readonly keys = new Set<string>();
  yaw = 0;
  pitch = 0;
  locked = false;
  firing = false;
  onLockChange: (locked: boolean) => void = () => {};
  onAction: (action: string) => void = () => {};
  private readonly abort = new AbortController();
  constructor(private canvas: HTMLCanvasElement) {
    const opts = { signal: this.abort.signal };
    window.addEventListener(
      "keydown",
      (e) => {
        if (e.code === "Escape" && this.locked) {
          document.exitPointerLock();
          return;
        }
        if (
          this.locked &&
          [
            "Space",
            "KeyW",
            "KeyA",
            "KeyS",
            "KeyD",
            "ArrowUp",
            "ArrowDown",
          ].includes(e.code)
        )
          e.preventDefault();
        if (!this.keys.has(e.code) && this.locked) this.onAction(e.code);
        this.keys.add(e.code);
      },
      opts,
    );
    window.addEventListener("keyup", (e) => this.keys.delete(e.code), opts);
    window.addEventListener("blur", () => this.clear(), opts);
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) {
          this.clear();
          if (document.pointerLockElement) document.exitPointerLock();
        }
      },
      opts,
    );
    document.addEventListener(
      "pointerlockchange",
      () => {
        this.locked = document.pointerLockElement === canvas;
        this.clear();
        this.onLockChange(this.locked);
      },
      opts,
    );
    document.addEventListener(
      "mousemove",
      (e) => {
        if (!this.locked) return;
        this.yaw -= e.movementX * 0.002;
        this.pitch = Math.max(
          -1.35,
          Math.min(1.35, this.pitch - e.movementY * 0.002),
        );
      },
      opts,
    );
    canvas.addEventListener(
      "mousedown",
      (e) => {
        if (this.locked && e.button === 0) this.firing = true;
      },
      opts,
    );
    window.addEventListener("mouseup", () => (this.firing = false), opts);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault(), opts);
  }
  async capture() {
    await this.canvas.requestPointerLock();
  }
  clear() {
    this.keys.clear();
    this.firing = false;
  }
  dispose() {
    this.abort.abort();
  }
}
