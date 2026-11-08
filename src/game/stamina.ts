import { PLAYER_BALANCE as P } from "./tuning";
export class Stamina {
  value = 1;
  exhausted = false;
  private delay = 0;
  get available() {
    return !this.exhausted && this.value > 0;
  }
  update(dt: number, sprinting: boolean) {
    if (sprinting) {
      this.value = Math.max(0, this.value - P.staminaDrain * dt);
      if (this.value <= 1e-8) {
        this.value = 0;
        this.exhausted = true;
        this.delay = P.exhaustionDelay;
      }
    } else if (this.delay > 0) this.delay = Math.max(0, this.delay - dt);
    else this.value = Math.min(1, this.value + P.staminaRecovery * dt);
    if (this.exhausted && this.value >= P.staminaUnlock) this.exhausted = false;
    return this.value;
  }
  reset() {
    this.value = 1;
    this.exhausted = false;
    this.delay = 0;
  }
}
