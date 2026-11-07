import { seededRandom } from "./math";
import { REWARDS } from "./tuning";
export interface Reward {
  gold: number;
  xp: number;
}
/** One bounded dry streak for the run, independent of visual/physics randomness. */
export class RewardRoller {
  dryKills = 0;
  private random: () => number;
  constructor(private seed = 1837) {
    this.random = seededRandom(seed);
  }
  roll(kind: number, wave: number): Reward {
    const type = REWARDS.types[kind],
      progress = Math.max(0, Math.min(9, wave - 1)),
      chance =
        this.dryKills >= REWARDS.maxDryKills
          ? 1
          : Math.min(
              0.98,
              type.goldChance +
                progress * REWARDS.chancePerWave +
                Math.max(0, this.dryKills - REWARDS.pityStartsAfter + 1) *
                  REWARDS.pityChance,
            ),
      dropped = this.random() < chance,
      multiplier = 1 + progress * REWARDS.valuePerWave,
      gold = dropped
        ? Math.round(
            (type.minGold +
              Math.floor(this.random() * (type.maxGold - type.minGold + 1))) *
              multiplier,
          )
        : 0;
    this.dryKills = dropped ? 0 : this.dryKills + 1;
    return { gold, xp: Math.round(type.xp * multiplier) };
  }
  reset() {
    this.dryKills = 0;
    this.random = seededRandom(this.seed);
  }
}
