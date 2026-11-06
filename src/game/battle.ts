import { seededRandom, resolveCircle, type Solid } from "./math";
import { Navigation, SpatialGrid, type Point } from "./navigation";
import { MAP, inMap, isRiver } from "./terrain";
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
}
export interface Drop extends Point {
  id: number;
  active: boolean;
  age: number;
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
    | "cast";
  x: number;
  z: number;
  value: number;
};
export class Battle {
  readonly nav: Navigation;
  private bellField: Float32Array;
  private playerField: Float32Array;
  private fieldTimer = 0;
  private playerCell = -1;
  readonly enemies: Enemy[] = Array.from({ length: 48 }, (_, id) => ({
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
    kind: id % 3,
  }));
  readonly drops: Drop[] = Array.from({ length: 100 }, (_, id) => ({
    id,
    active: false,
    x: 0,
    z: 0,
    age: 0,
  }));
  readonly events: BattleEvent[] = [];
  private grid = new SpatialGrid<Enemy>();
  private rng = seededRandom(744);
  private spawnClock = 0;
  private remaining = 0;
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
  nextWave = 0;
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
    this.bellField = this.nav.field(MAP.bell);
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
  private emit(kind: BattleEvent["kind"], x = 0, z = 0, value = 0) {
    this.events.push({ kind, x, z, value });
  }
  startWave() {
    if (this.phase === "lost" || this.phase === "battle") return false;
    this.wave++;
    this.phase = "battle";
    this.remaining = Math.min(8 + this.wave * 3, 48);
    this.spawnClock = 0;
    this.emit("wave", 0, 0, this.wave);
    return true;
  }
  private spawn() {
    const e = this.enemies.find((e) => !e.active);
    if (!e) return false;
    let x = 0,
      z = 0,
      ok = false;
    for (let i = 0; i < 12; i++) {
      x = MAP.spawn.x + (this.rng() - 0.5) * 8;
      z = MAP.spawn.z + (this.rng() - 0.5) * 5;
      if (this.nav.walkable(x, z)) {
        ok = true;
        break;
      }
    }
    if (!ok) return false;
    Object.assign(e, {
      active: true,
      x,
      z,
      hp: 38 + this.wave * 5,
      maxHp: 38 + this.wave * 5,
      target: "bell",
      windup: 0,
      cooldown: 0.4,
      knockX: 0,
      knockZ: 0,
    });
    this.emit("spawn", x, z, 0);
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
    if (this.phase === "intermission") {
      this.nextWave -= dt;
      if (this.nextWave <= 0) this.startWave();
    }
    if (this.phase === "battle" && this.remaining > 0) {
      this.spawnClock -= dt;
      if (this.spawnClock <= 0 && this.spawn()) {
        this.remaining--;
        this.spawnClock = 0.45;
      }
    }
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
        range = e.target === "player" ? 1.35 : 2.3;
      e.cooldown = Math.max(0, e.cooldown - dt);
      if (e.windup > 0) {
        e.windup -= dt;
        if (e.windup <= 0) {
          if (d < range + 0.6) {
            if (e.target === "player") {
              if ((player.y ?? 0) < 1.3) this.hurtPlayer(7 + this.wave * 0.4);
            } else {
              this.baseHealth = Math.max(
                0,
                this.baseHealth - 5 - this.wave * 0.5,
              );
              this.emit("baseHit", e.x, e.z, 5);
              if (this.baseHealth <= 0) this.lose();
            }
          }
          e.cooldown = 0.95;
        }
        continue;
      }
      if (d < range) {
        if (e.cooldown === 0) e.windup = 0.42;
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
      const speed = 1.8 + Math.min(this.wave * 0.065, 0.9) + e.kind * 0.12;
      let vx = v.x * speed + Math.max(-1.3, Math.min(1.3, sx)),
        vz = v.z * speed + Math.max(-1.3, Math.min(1.3, sz));
      const p = resolveCircle(
        e.x + (vx + e.knockX) * dt,
        e.z + (vz + e.knockZ) * dt,
        0.34,
        0,
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
          0,
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
    for (const drop of this.drops) {
      if (!drop.active) continue;
      drop.age += dt;
      const dx = player.x - drop.x,
        dz = player.z - drop.z,
        d = Math.hypot(dx, dz);
      if (d < 2 + this.stats.magnetism * 0.7) {
        if (d < 0.65) {
          drop.active = false;
          this.coins += Math.ceil(4 * (1 + this.stats.greed * 0.15));
          this.ammoReward += 3 + this.skills.scavenging * 2;
          this.xp += 12;
          if (this.xp >= this.level * 40) {
            this.xp -= this.level * 40;
            this.level++;
            this.points += 2;
            this.health = Math.min(this.maxHealth, this.health + 15);
            this.emit("level", player.x, player.z, this.level);
          }
        } else {
          const speed = Math.min(d, dt * 8);
          drop.x += (dx / d) * speed;
          drop.z += (dz / d) * speed;
        }
      }
      if (drop.age > 90) drop.active = false;
    }
    if (
      this.phase === "battle" &&
      this.remaining === 0 &&
      this.enemies.every((e) => !e.active)
    ) {
      this.phase = "intermission";
      this.nextWave = 10;
      this.coins += 15;
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
  damageEnemy(id: number, damage: number, from: Point, knockback = 3) {
    const e = this.enemies[id];
    if (!e?.active || this.phase === "lost") return false;
    e.hp -= damage;
    const d = Math.hypot(e.x - from.x, e.z - from.z) || 1;
    e.knockX = ((e.x - from.x) / d) * knockback;
    e.knockZ = ((e.z - from.z) / d) * knockback;
    e.windup = 0;
    e.cooldown = 0.2;
    this.emit("hit", e.x, e.z, damage);
    if (e.hp <= 0) {
      e.active = false;
      this.souls++;
      this.emit("kill", e.x, e.z, 0);
      const drop = this.drops.find((d) => !d.active) || this.drops[0];
      Object.assign(drop, { active: true, x: e.x, z: e.z, age: 0 });
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
    this.nextWave = 0;
    this.burstCooldown = 0;
    this.orbCooldown = 0;
    this.weaponRank = 0;
    this.ammoReward = 0;
    this.invulnerable = 0;
    this.regenDelay = 0;
    this.meleeCooldown = 0;
    this.remaining = 0;
    this.fieldTimer = 0;
    this.playerCell = -1;
    this.rng = seededRandom(744);
    for (const key of Object.keys(this.stats) as Stat[]) this.stats[key] = 0;
    for (const key of Object.keys(this.skills) as Skill[])
      this.skills[key] = key === "athletics" ? 1 : 0;
    this.enemies.forEach((e) => {
      e.active = false;
    });
    this.drops.forEach((d) => {
      d.active = false;
    });
    this.events.length = 0;
  }
}
