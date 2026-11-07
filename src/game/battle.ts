import { resolveCircle, type Solid } from "./math";
import { Navigation, SpatialGrid, type Point } from "./navigation";
import { MAP, inMap, isRiver, groundHeight } from "./terrain";
import { Loot, type Drop } from "./loot";
import {
  ENEMY_TYPES,
  ENEMY_CAPACITY,
  WAVE_LIMIT,
  wavePlan,
  waveCadence,
} from "./waves";
import { ForestSpawner } from "./spawning";
import { RewardRoller } from "./rewards";
import { COMBAT_FEEL, DIFFICULTY, SPAWNING } from "./tuning";
export type Stat =
  "constitution" | "instinct" | "lethality" | "agility" | "magnetism" | "greed";
export type Skill =
  | "athletics"
  | "survival"
  | "marksmanship"
  | "sorcery"
  | "scavenging"
  | "cunning";
export const STATS: Record<Stat, string> = {
  constitution: "+20 maximum vitality",
  instinct: "More critical hits",
  lethality: "+10% weapon damage",
  agility: "+4% movement speed",
  magnetism: "Wider pickup attraction",
  greed: "More gold per coin",
};
export const SKILLS: Record<Skill, string> = {
  athletics: "Sprint → high jump → double jump",
  survival: "Recover vitality after avoiding damage",
  marksmanship: "Faster reload and steadier aim",
  sorcery: "Stronger burst and fire orb",
  scavenging: "More ammunition from drops",
  cunning: "Stronger melee knockback",
};
export interface Enemy extends Point {
  id: number;
  active: boolean;
  hp: number;
  maxHp: number;
  target: "bell" | "player";
  windup: number;
  cooldown: number;
  knockX: number;
  knockZ: number;
  phase: number;
  kind: number;
  wave: number;
  hitFlash: number;
  reaction: number;
  spawnAge: number;
  spawnZone: number;
}
export type BattleEvent = {
  kind:
    | "spawn"
    | "kill"
    | "hit"
    | "playerHit"
    | "baseHit"
    | "wave"
    | "level"
    | "lost"
    | "cast"
    | "gold"
    | "xp"
    | "complete";
  x: number;
  z: number;
  value: number;
  y?: number;
};
export class Battle {
  readonly nav: Navigation;
  private bellField: Float32Array;
  private playerField: Float32Array;
  private fieldTimer = 0;
  private playerCell = -1;
  readonly enemies: Enemy[] = Array.from(
    { length: ENEMY_CAPACITY },
    (_, id) => ({
      id,
      active: false,
      x: 0,
      z: 0,
      hp: 0,
      maxHp: 0,
      target: "bell",
      windup: 0,
      cooldown: 0,
      knockX: 0,
      knockZ: 0,
      phase: id * 2.4,
      kind: 0,
      wave: 1,
      hitFlash: 0,
      reaction: 0,
      spawnAge: 0,
      spawnZone: -1,
    }),
  );
  readonly drops: Drop[];
  private loot: Loot;
  readonly events: BattleEvent[] = [];
  private grid = new SpatialGrid<Enemy>();
  readonly spawner: ForestSpawner;
  private rewards = new RewardRoller();
  private spawnCursor = 0;
  readonly waveJobs: {
    wave: number;
    plan: number[];
    index: number;
    clock: number;
  }[] = [];
  private completeEmitted = false;
  readonly missiles: {
    active: boolean;
    x: number;
    y: number;
    z: number;
    vx: number;
    vz: number;
    life: number;
    damage: number;
    target: "player" | "bell";
  }[] = Array.from({ length: 48 }, () => ({
    active: false,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vz: 0,
    life: 0,
    damage: 0,
    target: "player",
  }));
  private regenDelay = 0;
  private invulnerable = 0;
  private meleeCooldown = 0;
  health = 100;
  baseHealth = 500;
  coins = 40;
  souls = 0;
  level = 1;
  xp = 0;
  points = 4;
  wave = 0;
  phase: "peace" | "battle" | "intermission" | "lost" = "peace";
  burstCooldown = 0;
  orbCooldown = 0;
  weaponRank = 0;
  ammoReward = 0;
  stats: Record<Stat, number> = {
    constitution: 0,
    instinct: 0,
    lethality: 0,
    agility: 0,
    magnetism: 0,
    greed: 0,
  };
  skills: Record<Skill, number> = {
    athletics: 1,
    survival: 0,
    marksmanship: 0,
    sorcery: 0,
    scavenging: 0,
    cunning: 0,
  };
  constructor(readonly solids: Solid[]) {
    this.nav = new Navigation(solids);
    this.loot = new Loot(this.nav);
    this.drops = this.loot.drops;
    this.bellField = this.nav.field(MAP.bell);
    this.spawner = new ForestSpawner(this.nav, this.bellField);
    this.playerField = this.bellField;
  }
  get maxHealth() {
    return 100 + this.stats.constitution * 20;
  }
  get damageMultiplier() {
    return 1 + this.stats.lethality * 0.1 + this.weaponRank * 0.18;
  }
  get alive() {
    return this.enemies.filter((e) => e.active);
  }
  private emit(kind: BattleEvent["kind"], x = 0, z = 0, value = 0, y?: number) {
    this.events.push({ kind, x, z, value, y });
  }
  get pending() {
    return this.waveJobs.reduce((n, j) => n + j.plan.length - j.index, 0);
  }
  get activeWaves() {
    return this.waveJobs
      .filter(
        (j) =>
          j.index < j.plan.length ||
          this.enemies.some((e) => e.active && e.wave === j.wave),
      )
      .map((j) => j.wave);
  }
  startWave() {
    if (this.phase === "lost" || this.wave >= WAVE_LIMIT) return false;
    this.wave++;
    this.phase = "battle";
    this.waveJobs.push({
      wave: this.wave,
      plan: wavePlan(this.wave),
      index: 0,
      clock: 0,
    });
    this.emit("wave", 0, 0, this.wave);
    return true;
  }
  private spawn(wave: number, kind: number) {
    const e = this.enemies.find((e) => !e.active);
    if (!e) return false;
    const position = this.spawner.next(this.enemies);
    if (!position) return false;
    const { x, z, zone } = position;
    Object.assign(e, {
      active: true,
      x,
      z,
      hp: ENEMY_TYPES[kind].hp * (1 + (wave - 1) * DIFFICULTY.healthPerWave),
      maxHp: ENEMY_TYPES[kind].hp * (1 + (wave - 1) * DIFFICULTY.healthPerWave),
      wave,
      kind,
      target: "bell",
      windup: 0,
      cooldown: 0.4,
      knockX: 0,
      knockZ: 0,
      hitFlash: 0,
      reaction: 0,
      spawnAge: 0,
      spawnZone: zone,
    });
    this.emit("spawn", x, z, zone);
    return true;
  }
  update(dt: number, player: Point & { y?: number }) {
    if (this.phase === "lost") return;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.regenDelay = Math.max(0, this.regenDelay - dt);
    this.meleeCooldown = Math.max(0, this.meleeCooldown - dt);
    this.burstCooldown = Math.max(0, this.burstCooldown - dt);
    this.orbCooldown = Math.max(0, this.orbCooldown - dt);
    if (this.regenDelay === 0 && this.skills.survival)
      this.health = Math.min(
        this.maxHealth,
        this.health + dt * this.skills.survival * 0.8,
      );
    for (const job of this.waveJobs)
      if (job.index < job.plan.length) job.clock -= dt;
    let emitted = 0;
    // Round-robin jobs keep simultaneous bell calls fair and bound work in one step.
    for (
      let n = 0;
      n < this.waveJobs.length && emitted < DIFFICULTY.maxSpawnsPerStep;
      n++
    ) {
      const i = (this.spawnCursor + n) % this.waveJobs.length,
        job = this.waveJobs[i];
      if (job.index >= job.plan.length || job.clock > 0) continue;
      if (!this.spawn(job.wave, job.plan[job.index])) {
        job.clock = SPAWNING.retryInterval;
        continue;
      }
      job.index++;
      const cadence = waveCadence(job.wave);
      job.clock =
        job.index % cadence.groupSize
          ? cadence.memberInterval
          : cadence.groupInterval;
      emitted++;
    }
    if (this.waveJobs.length)
      this.spawnCursor = (this.spawnCursor + 1) % this.waveJobs.length;
    this.fieldTimer -= dt;
    const cell = this.nav.index(player.x, player.z);
    if (this.fieldTimer <= 0 && cell !== this.playerCell) {
      this.playerCell = cell;
      this.playerField = this.nav.field(player);
      this.fieldTimer = 0.4;
    }
    this.grid.clear();
    for (const e of this.enemies) if (e.active) this.grid.add(e);
    for (const e of this.enemies) {
      if (!e.active) continue;
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.reaction = Math.max(0, e.reaction - dt);
      e.spawnAge += dt;
      if (e.spawnAge < 0.35) continue;
      const distance = Math.hypot(e.x - player.x, e.z - player.z);
      if (e.target === "bell" && distance < 9 && this.nav.lineClear(e, player))
        e.target = "player";
      else if (
        e.target === "player" &&
        (distance > 13 ||
          !inMap(player.x, player.z) ||
          isRiver(player.x, player.z))
      )
        e.target = "bell";
      const target = e.target === "player" ? player : MAP.bell,
        d = Math.hypot(e.x - target.x, e.z - target.z),
        range =
          e.kind === 3
            ? 7.5
            : e.target === "player"
              ? ENEMY_TYPES[e.kind].range
              : 2.3;
      e.cooldown = Math.max(0, e.cooldown - dt);
      if (e.windup > 0) {
        e.windup -= dt;
        if (e.windup <= 0) {
          if (d < range + 0.6) {
            if (e.target === "player") {
              if (e.kind === 3) this.castMissile(e, player);
              else if (
                (player.y ?? groundHeight(player.x, player.z)) -
                  groundHeight(e.x, e.z) <
                1.3
              )
                this.hurtPlayer(
                  ENEMY_TYPES[e.kind].damage *
                    (1 + e.wave * DIFFICULTY.damagePerWave),
                );
            } else {
              if (e.kind === 3) this.castMissile(e, MAP.bell);
              else {
                this.baseHealth = Math.max(
                  0,
                  this.baseHealth -
                    ENEMY_TYPES[e.kind].damage *
                      (1 + e.wave * DIFFICULTY.damagePerWave),
                );
                this.emit("baseHit", e.x, e.z, ENEMY_TYPES[e.kind].damage);
                if (this.baseHealth <= 0) this.lose();
              }
            }
          }
          e.cooldown = ENEMY_TYPES[e.kind].interval;
        }
        continue;
      }
      if (d < range) {
        if (e.cooldown === 0 && this.nav.lineClear(e, target))
          e.windup = ENEMY_TYPES[e.kind].windup;
        continue;
      }
      const field = e.target === "player" ? this.playerField : this.bellField;
      const v = this.nav.steer(e, target, field);
      let sx = 0,
        sz = 0;
      for (const other of this.grid.near(e)) {
        if (other === e) continue;
        let dx = e.x - other.x,
          dz = e.z - other.z,
          ds = dx * dx + dz * dz;
        if (ds < 1e-5) {
          dx = Math.cos(e.phase);
          dz = Math.sin(e.phase);
          ds = 0.1;
        }
        if (ds < 1.2) {
          const f = (1.2 - ds) / Math.max(ds, 0.12);
          sx += dx * f;
          sz += dz * f;
        }
      }
      const speed =
        ENEMY_TYPES[e.kind].speed * (1 + e.wave * DIFFICULTY.speedPerWave);
      let vx = v.x * speed + Math.max(-1.3, Math.min(1.3, sx)),
        vz = v.z * speed + Math.max(-1.3, Math.min(1.3, sz));
      const p = resolveCircle(
        e.x + (vx + e.knockX) * dt,
        e.z + (vz + e.knockZ) * dt,
        0.34,
        groundHeight(e.x, e.z),
        this.solids,
      );
      if (this.nav.walkable(p.x, p.z)) {
        e.x = p.x;
        e.z = p.z;
      } else {
        const fallback = resolveCircle(
          e.x + v.x * speed * dt,
          e.z + v.z * speed * dt,
          0.34,
          groundHeight(e.x, e.z),
          this.solids,
        );
        if (this.nav.walkable(fallback.x, fallback.z)) {
          e.x = fallback.x;
          e.z = fallback.z;
        }
      }
      e.knockX *= Math.exp(-dt * 8);
      e.knockZ *= Math.exp(-dt * 8);
    }
    for (const pickup of this.loot.update(dt, player, this.stats.magnetism)) {
      this.emit(pickup.kind, pickup.x, pickup.z, pickup.value, pickup.y);
      if (pickup.kind === "gold")
        this.coins += Math.ceil(pickup.value * (1 + this.stats.greed * 0.15));
      else {
        this.xp += pickup.value;
        this.ammoReward += 3 + this.skills.scavenging * 2;
        while (this.xp >= this.level * 40) {
          this.xp -= this.level * 40;
          this.level++;
          this.points += 2;
          this.health = Math.min(this.maxHealth, this.health + 15);
          this.emit("level", player.x, player.z, this.level);
        }
      }
    }
    this.updateMissiles(dt, player);
    if (
      this.phase === "battle" &&
      this.pending === 0 &&
      this.enemies.every((e) => !e.active)
    ) {
      this.phase = "intermission";
      this.coins += 15;
      if (this.wave === WAVE_LIMIT && !this.completeEmitted) {
        this.completeEmitted = true;
        this.emit("complete");
      }
    }
  }
  private castMissile(enemy: Enemy, target: Point) {
    const m = this.missiles.find((m) => !m.active);
    if (!m) return;
    const d = Math.hypot(target.x - enemy.x, target.z - enemy.z) || 1;
    Object.assign(m, {
      active: true,
      x: enemy.x,
      z: enemy.z,
      y: groundHeight(enemy.x, enemy.z) + 1,
      vx: ((target.x - enemy.x) / d) * 7,
      vz: ((target.z - enemy.z) / d) * 7,
      life: 3,
      damage:
        ENEMY_TYPES[3].damage * (1 + enemy.wave * DIFFICULTY.damagePerWave),
      target: enemy.target,
    });
  }
  private updateMissiles(dt: number, player: Point & { y?: number }) {
    for (const m of this.missiles) {
      if (!m.active) continue;
      const old = { x: m.x, z: m.z };
      m.x += m.vx * dt;
      m.z += m.vz * dt;
      m.y = groundHeight(m.x, m.z) + 0.9;
      m.life -= dt;
      const target = m.target === "player" ? player : MAP.bell;
      if (!this.nav.lineClear(old, m) || m.life <= 0) {
        m.active = false;
        continue;
      }
      if (Math.hypot(m.x - target.x, m.z - target.z) < 1.15) {
        if (m.target === "player") {
          if (
            (player.y ?? groundHeight(player.x, player.z)) -
              groundHeight(m.x, m.z) <
            1.4
          )
            this.hurtPlayer(m.damage);
        } else {
          this.baseHealth = Math.max(0, this.baseHealth - m.damage);
          this.emit("baseHit", target.x, target.z, m.damage);
          if (this.baseHealth === 0) this.lose();
        }
        m.active = false;
      }
    }
  }

  hurtPlayer(damage: number) {
    if (this.phase === "lost" || this.invulnerable > 0) return false;
    this.health = Math.max(0, this.health - damage);
    this.invulnerable = 0.5;
    this.regenDelay = 5;
    this.emit("playerHit", 0, 0, damage);
    if (this.health <= 0) this.lose();
    return true;
  }
  private lose() {
    this.phase = "lost";
    this.emit("lost");
  }
  damageEnemy(
    id: number,
    damage: number,
    from: Point,
    knockback = 3,
    impact?: Point & { y: number },
  ) {
    const e = this.enemies[id];
    if (!e?.active || this.phase === "lost") return false;
    e.hp -= damage;
    e.hitFlash = COMBAT_FEEL.flashDuration;
    e.reaction = COMBAT_FEEL.reactionDuration;
    const d = Math.hypot(e.x - from.x, e.z - from.z) || 1;
    e.knockX = ((e.x - from.x) / d) * knockback;
    e.knockZ = ((e.z - from.z) / d) * knockback;
    e.windup = 0;
    e.cooldown = 0.2;
    this.emit(
      "hit",
      impact?.x ?? e.x,
      impact?.z ?? e.z,
      damage,
      impact?.y ?? groundHeight(e.x, e.z) + 0.9 * ENEMY_TYPES[e.kind].scale,
    );
    if (e.hp <= 0) {
      e.active = false;
      this.souls++;
      this.emit("kill", e.x, e.z, e.kind);
      this.loot.release(e.x, e.z, this.rewards.roll(e.kind, e.wave));
      return true;
    }
    return false;
  }
  melee(player: Point, forward: Point) {
    if (this.meleeCooldown > 0 || this.phase === "lost") return false;
    this.meleeCooldown = 0.6;
    for (const e of this.alive) {
      const dx = e.x - player.x,
        dz = e.z - player.z,
        d = Math.hypot(dx, dz);
      if (
        d < 2.8 &&
        (dx * forward.x + dz * forward.z) / Math.max(d, 0.01) > 0.35 &&
        this.nav.lineClear(player, e)
      )
        this.damageEnemy(
          e.id,
          42 * this.damageMultiplier,
          player,
          7 + this.skills.cunning * 2,
        );
    }
    return true;
  }
  burst(player: Point) {
    if (this.burstCooldown > 0 || this.phase === "lost") return false;
    this.burstCooldown = 12 - this.skills.sorcery;
    for (const e of this.alive)
      if (
        Math.hypot(e.x - player.x, e.z - player.z) < 7 &&
        this.nav.lineClear(player, e)
      )
        this.damageEnemy(
          e.id,
          60 * (1 + this.skills.sorcery * 0.2),
          player,
          10,
        );
    this.emit("cast", player.x, player.z, 1);
    return true;
  }
  canOrb() {
    if (this.orbCooldown > 0 || this.phase === "lost") return false;
    this.orbCooldown = 5.5 - this.skills.sorcery * 0.5;
    return true;
  }
  explode(point: Point) {
    for (const e of this.alive) {
      const d = Math.hypot(e.x - point.x, e.z - point.z);
      if (d < 4.5 && this.nav.lineClear(point, e))
        this.damageEnemy(
          e.id,
          80 * (1 + this.skills.sorcery * 0.2) * (1 - d / 6),
          point,
          8,
        );
    }
    this.emit("cast", point.x, point.z, 2);
  }
  upgradeStat(stat: Stat) {
    if (this.points < 1 || this.stats[stat] >= 8) return false;
    this.points--;
    this.stats[stat]++;
    if (stat === "constitution") this.health += 20;
    return true;
  }
  upgradeSkill(skill: Skill) {
    if (this.points < 1 || this.skills[skill] >= 3) return false;
    this.points--;
    this.skills[skill]++;
    return true;
  }
  buyWeaponUpgrade() {
    const cost = 30 + this.weaponRank * 25;
    if (this.coins < cost || this.weaponRank >= 5) return false;
    this.coins -= cost;
    this.weaponRank++;
    return true;
  }
  buyAmmo() {
    if (this.coins < 10) return false;
    this.coins -= 10;
    this.ammoReward += 60;
    return true;
  }
  repair() {
    if (this.coins < 15 || this.baseHealth >= 500 || this.phase === "lost")
      return false;
    this.coins -= 15;
    this.baseHealth = Math.min(500, this.baseHealth + 100);
    return true;
  }
  reset() {
    this.health = 100;
    this.baseHealth = 500;
    this.coins = 40;
    this.souls = 0;
    this.level = 1;
    this.xp = 0;
    this.points = 4;
    this.wave = 0;
    this.phase = "peace";
    this.burstCooldown = 0;
    this.orbCooldown = 0;
    this.weaponRank = 0;
    this.ammoReward = 0;
    this.invulnerable = 0;
    this.regenDelay = 0;
    this.meleeCooldown = 0;
    this.waveJobs.length = 0;
    this.completeEmitted = false;
    this.missiles.forEach((m) => (m.active = false));
    this.fieldTimer = 0;
    this.playerCell = -1;
    this.spawner.reset();
    this.rewards.reset();
    this.spawnCursor = 0;
    for (const key of Object.keys(this.stats) as Stat[]) this.stats[key] = 0;
    for (const key of Object.keys(this.skills) as Skill[])
      this.skills[key] = key === "athletics" ? 1 : 0;
    this.enemies.forEach((e) => {
      e.active = false;
    });
    this.loot.reset();
    this.events.length = 0;
  }
}
