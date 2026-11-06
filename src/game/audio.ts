/** Synthesized, original audio: no downloads or external assets. */
export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  enabled = false;
  private ambience: OscillatorNode[] = [];
  async toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      await this.activate();
    } else if (this.master)
      this.master.gain.setTargetAtTime(0, this.ctx!.currentTime, 0.1);
    return this.enabled;
  }
  async activate() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);
      for (const f of [55, 82.5, 110.2]) {
        const o = this.ctx.createOscillator(),
          g = this.ctx.createGain();
        o.type = "sine";
        o.frequency.value = f;
        g.gain.value = 0.013;
        o.connect(g);
        g.connect(this.master);
        o.start();
        this.ambience.push(o);
      }
    }
    await this.ctx.resume();
    if (this.enabled)
      this.master!.gain.setTargetAtTime(0.6, this.ctx.currentTime, 0.1);
  }
  private tone(
    freq: number,
    duration: number,
    volume: number,
    type: OscillatorType = "sine",
    end?: number,
  ) {
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (end)
      o.frequency.exponentialRampToValueAtTime(end, c.currentTime + duration);
    g.gain.setValueAtTime(volume, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
    o.connect(g);
    g.connect(this.master!);
    o.start();
    o.stop(c.currentTime + duration);
  }
  shot() {
    this.tone(130, 0.17, 0.22, "sawtooth", 30);
    this.tone(740, 0.07, 0.045, "triangle", 90);
    if (!this.ctx || !this.enabled) return;
    const c = this.ctx,
      b = c.createBuffer(1, c.sampleRate * 0.13, c.sampleRate),
      d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++)
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const n = c.createBufferSource(),
      g = c.createGain();
    n.buffer = b;
    g.gain.value = 0.26;
    n.connect(g);
    g.connect(this.master!);
    n.start();
  }
  reload() {
    this.tone(460, 0.06, 0.05, "square", 170);
  }
  hit() {
    this.tone(650, 0.25, 0.06, "sine", 1300);
  }
  bell() {
    for (const [f, v] of [
      [180, 0.2],
      [373, 0.11],
      [541, 0.065],
      [857, 0.035],
    ])
      this.tone(f, 3.3, v);
  }
  melee() {
    this.tone(180, 0.13, 0.08, "triangle", 40);
  }
  cast() {
    this.tone(230, 0.4, 0.1, "sine", 1100);
  }
  hurt() {
    this.tone(75, 0.16, 0.12, "sawtooth", 30);
  }
  step() {
    this.tone(65, 0.055, 0.035, "triangle", 35);
  }
}
