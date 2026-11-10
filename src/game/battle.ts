import {
  COMBAT,
  ECONOMY as E,
  PLAYER_BALANCE as P,
  ABILITIES as A,
  WEAPON_TUNING,
} from "./tuning";
import { resolveCircle, damp, type Solid } from "./math";
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
import { COMBAT_FEEL, DIFFICULTY, SPAWNING, MOTION } from "./tuning";
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
  constitution: `+${P.healthPerConstitution} maximum vitality`,
  instinct: "More critical hits",
  lethality: `+${Math.round(COMBAT.lethalityPerPoint * 100)}% weapon damage`,
  agility: `+${Math.round(P.agilityPerPoint * 100)}% movement speed`,
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
  hitCritical: boolean;
  damageStamp: number;
  reaction: number;
  spawnAge: number;
  spawnZone: number;
  vx: number;
  vz: number;
  gait: number;
  speedFactor: number;
  stalled: number;
  decisionClock: number;
  steerClock: number;
  seekX: number;
  seekZ: number;
  previousX: number;
  previousZ: number;
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
  critical?: boolean;
  bullet?: boolean;
  magic?: boolean;
  headshot?: boolean;
  killed?: boolean;
  enemyKind?: number;
  incomingX?: number;
  incomingY?: number;
  incomingZ?: number;
  normalX?: number;
  normalY?: number;
  normalZ?: number;
  impactX?: number;
  impactZ?: number;
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
      hitCritical: false,
      damageStamp: 0,
      reaction: 0,
      spawnAge: 0,
      spawnZone: -1,
      vx: 0,
      vz: 0,
      gait: 0,
      speedFactor: 1,
      stalled: 0,
      decisionClock: 0,
      steerClock: 0,
      seekX: 0,
      seekZ: 0,
      previousX: 0,
      previousZ: 0,
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
  private damageStamp = 0;
  private burstPrimed = false;
  private crowdX = new Float32Array(ENEMY_CAPACITY);
  private crowdZ = new Float32Array(ENEMY_CAPACITY);
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
  health = P.health;
  baseHealth = P.bellHealth;
  coins = E.startingGold;
  souls = 0;
  level = 1;
  xp = 0;
  points = E.startingPoints;
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
    return P.health + this.stats.constitution * P.healthPerConstitution;
  }
  get damageMultiplier() {
    return (
      1 +
      this.stats.lethality * COMBAT.lethalityPerPoint +
      this.weaponRank * COMBAT.weaponRankDamage
    );
  }
  get alive() {
    return this.enemies.filter((e) => e.active);
  }
  private emit(
    kind: BattleEvent["kind"],
    x = 0,
    z = 0,
    value = 0,
    y?: number,
    details?: {
      critical?: boolean;
      bullet?: boolean;
      magic?: boolean;
      headshot?: boolean;
      killed?: boolean;
      enemyKind?: number;
      incomingX?: number;
      incomingY?: number;
      incomingZ?: number;
      normalX?: number;
      normalY?: number;
      normalZ?: number;
      impactX?: number;
      impactZ?: number;
    },
  ) {
    this.events.push({ kind, x, z, value, y, ...details });
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
      hitCritical: false,
      damageStamp: 0,
      reaction: 0,
      spawnAge: 0,
      spawnZone: zone,
      vx: 0,
      vz: 0,
      gait: 0,
      stalled: 0,
      decisionClock: 0,
      steerClock: 0,
      seekX: 0,
      seekZ: 0,
      previousX: x,
      previousZ: z,
      speedFactor: 1 + Math.sin(e.phase + wave) * MOTION.speedVariation,
    });
    this.emit("spawn", x, z, zone);
    return true;
  }
  readonly metrics = { decisions: 0, steering: 0, neighbours: 0 };
  update(dt: number, player: Point & { y?: number }) {
    if (this.phase === "lost") return;
    this.metrics.decisions =
      this.metrics.steering =
      this.metrics.neighbours =
        0;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.regenDelay = Math.max(0, this.regenDelay - dt);
    this.meleeCooldown = Math.max(0, this.meleeCooldown - dt);
    this.burstCooldown = Math.max(0, this.burstCooldown - dt);
    this.orbCooldown = Math.max(0, this.orbCooldown - dt);
    if (this.regenDelay === 0 && this.skills.survival)
      this.health = Math.min(
        this.maxHealth,
        this.health + dt * this.skills.survival * P.regenPerSurvival,
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
      e.previousX = e.x;
      e.previousZ = e.z;
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.reaction = Math.max(0, e.reaction - dt);
      e.spawnAge += dt;
      if (e.spawnAge < 0.35) continue;
      if (Math.hypot(e.knockX, e.knockZ) > 0.02) {
        const p = resolveCircle(
          e.x + e.knockX * dt,
          e.z + e.knockZ * dt,
          0.34,
          groundHeight(e.x, e.z),
          this.nav.collisionNear(e.x, e.z),
        );
        if (this.nav.walkable(p.x, p.z)) {
          e.x = p.x;
          e.z = p.z;
        }
      }
      e.knockX *= Math.exp(-dt * 8);
      e.knockZ *= Math.exp(-dt * 8);
      if (
        e.target === "player" &&
        ((e.x - player.x) ** 2 + (e.z - player.z) ** 2 >
          MOTION.aggroExit ** 2 ||
          !inMap(player.x, player.z) ||
          isRiver(player.x, player.z))
      )
        e.target = "bell";
      e.decisionClock -= dt;
      if (e.decisionClock <= 0) {
        this.metrics.decisions++;
        e.decisionClock = 0.12 + (e.id % 4) * 0.02;
        const distance = Math.hypot(e.x - player.x, e.z - player.z);
        if (
          e.target === "bell" &&
          distance < MOTION.aggroEnter &&
          this.nav.lineClear(e, player)
        )
          e.target = "player";
        else if (
          e.target === "player" &&
          (distance > MOTION.aggroExit ||
            !inMap(player.x, player.z) ||
            isRiver(player.x, player.z))
        )
          e.target = "bell";
      }
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
        e.vx = damp(e.vx, 0, 12, dt);
        e.vz = damp(e.vz, 0, 12, dt);
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
        e.vx = damp(e.vx, 0, 12, dt);
        e.vz = damp(e.vz, 0, 12, dt);
        if (e.cooldown === 0 && this.nav.lineClear(e, target))
          e.windup = ENEMY_TYPES[e.kind].windup;
        continue;
      }
      const field = e.target === "player" ? this.playerField : this.bellField;
      const recovering = e.stalled > MOTION.stalledAfter;
      e.steerClock -= dt;
      if (e.steerClock <= 0 || recovering) {
        this.metrics.steering++;
        e.steerClock = 0.08 + (e.id % 3) * 0.012;
        const lane = recovering
          ? 0
          : Math.sin(e.gait * 0.09 + e.phase) * MOTION.laneWidth;
        const desired = recovering
          ? this.nav.steer(e, target, field)
          : this.nav.steerSmooth(e, target, field, lane);
        e.seekX = desired.x;
        e.seekZ = desired.z;
      }
      const v = { x: e.seekX, z: e.seekZ };
      let sx = 0,
        sz = 0;
      for (const other of this.grid.near(e)) {
        this.metrics.neighbours++;
        if (other === e) continue;
        let dx = e.x - other.x,
          dz = e.z - other.z,
          ds = dx * dx + dz * dz;
        if (ds < 1e-5) {
          dx = Math.cos(e.phase);
          dz = Math.sin(e.phase);
          ds = 0.1;
        }
        const spacing =
          MOTION.separation *
          (ENEMY_TYPES[e.kind].scale + ENEMY_TYPES[other.kind].scale) *
          0.5;
        if (ds < spacing * spacing) {
          const f = (spacing * spacing - ds) / Math.max(ds, 0.12);
          sx += dx * f;
          sz += dz * f;
        }
      }
      const speed =
          ENEMY_TYPES[e.kind].speed *
          e.speedFactor *
          (1 + e.wave * DIFFICULTY.speedPerWave),
        force = MOTION.separationForce * (recovering ? 0.25 : 1);
      const arrival = Math.min(1, Math.max(0.25, (d - range + 0.6) / 1.5));
      const desiredX =
          v.x * speed * arrival + Math.max(-force, Math.min(force, sx)),
        desiredZ =
          v.z * speed * arrival + Math.max(-force, Math.min(force, sz));
      const nextX = damp(e.vx, desiredX, MOTION.turnRate, dt),
        nextZ = damp(e.vz, desiredZ, MOTION.turnRate, dt);
      const change = Math.hypot(nextX - e.vx, nextZ - e.vz),
        limit = MOTION.acceleration * dt,
        ratio = change > limit ? limit / change : 1;
      e.vx += (nextX - e.vx) * ratio;
      e.vz += (nextZ - e.vz) * ratio;
      const beforeX = e.x,
        beforeZ = e.z;
      const p = resolveCircle(
        e.x + e.vx * dt,
        e.z + e.vz * dt,
        0.34,
        groundHeight(e.x, e.z),
        this.nav.collisionNear(e.x, e.z),
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
          this.nav.collisionNear(e.x, e.z),
        );
        if (this.nav.walkable(fallback.x, fallback.z)) {
          e.x = fallback.x;
          e.z = fallback.z;
        }
      }
      const travelled = Math.hypot(e.x - beforeX, e.z - beforeZ);
      e.gait += (travelled * 5) / ENEMY_TYPES[e.kind].scale;
      e.stalled = travelled < dt * 0.12 ? e.stalled + dt : 0;
    }
    this.separateContacts(dt);
    for (const pickup of this.loot.update(dt, player, this.stats.magnetism)) {
      const granted =
        pickup.kind === "gold"
          ? Math.ceil(pickup.value * (1 + this.stats.greed * E.greedPerPoint))
          : pickup.value;
      this.emit(pickup.kind, pickup.x, pickup.z, granted, pickup.y);
      if (pickup.kind === "gold") this.coins += granted;
      else {
        this.xp += pickup.value;
        this.ammoReward +=
          E.ammoPerXp + this.skills.scavenging * E.ammoPerScavenging;
        while (this.xp >= this.level * E.xpPerLevel) {
          this.xp -= this.level * E.xpPerLevel;
          this.level++;
          this.points += E.pointsPerLevel;
          this.health = Math.min(this.maxHealth, this.health + E.healPerLevel);
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
      this.coins += E.waveGold;
      if (this.wave === WAVE_LIMIT && !this.completeEmitted) {
        this.completeEmitted = true;
        this.emit("complete");
      }
    }
  }
  private separateContacts(dt: number) {
    this.grid.clear();
    for (const e of this.enemies) if (e.active) this.grid.add(e);
    this.crowdX.fill(0);
    this.crowdZ.fill(0);
    for (const e of this.enemies)
      if (e.active)
        for (const other of this.grid.near(e)) {
          if (other.id <= e.id) continue;
          let dx = e.x - other.x,
            dz = e.z - other.z,
            d = Math.hypot(dx, dz);
          const spacing =
            0.38 * (ENEMY_TYPES[e.kind].scale + ENEMY_TYPES[other.kind].scale);
          if (d >= spacing) continue;
          if (d < 0.0001) {
            dx = Math.cos(e.phase + other.phase * 0.7);
            dz = Math.sin(e.phase + other.phase * 0.7);
            d = 1;
          }
          const push = Math.min(0.12, (spacing - Math.min(d, spacing)) * 0.5);
          // Coincident centres need a deterministic escape direction too.
          const amount = push || 0.025;
          this.crowdX[e.id] += (dx / d) * amount;
          this.crowdZ[e.id] += (dz / d) * amount;
          this.crowdX[other.id] -= (dx / d) * amount;
          this.crowdZ[other.id] -= (dz / d) * amount;
        }
    for (const e of this.enemies)
      if (e.active) {
        const dx = this.crowdX[e.id],
          dz = this.crowdZ[e.id],
          d = Math.hypot(dx, dz);
        if (d < 0.0001) continue;
        const factor = Math.min(1, (dt * 2.1) / d),
          p = resolveCircle(
            e.x + dx * factor,
            e.z + dz * factor,
            0.34,
            groundHeight(e.x, e.z),
            this.nav.collisionNear(e.x, e.z),
          );
        if (this.nav.walkable(p.x, p.z)) {
          e.x = p.x;
          e.z = p.z;
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
    this.invulnerable = P.invulnerability;
    this.regenDelay = P.regenDelay;
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
    impact?: Point & {
      y: number;
      critical?: boolean;
      bullet?: boolean;
      magic?: boolean;
      headshot?: boolean;
      incomingX?: number;
      incomingY?: number;
      incomingZ?: number;
      normalX?: number;
      normalY?: number;
      normalZ?: number;
    },
  ) {
    const e = this.enemies[id];
    if (!e?.active || this.phase === "lost") return false;
    e.hp -= damage;
    e.damageStamp = ++this.damageStamp;
    e.hitFlash = COMBAT_FEEL.flashDuration;
    e.hitCritical = !!impact?.critical;
    e.reaction = COMBAT_FEEL.reactionDuration;
    const d = Math.hypot(e.x - from.x, e.z - from.z) || 1;
    e.knockX = ((e.x - from.x) / d) * knockback;
    e.knockZ = ((e.z - from.z) / d) * knockback;
    if (knockback >= 6) {
      e.windup = 0;
      e.cooldown = 0.2;
    }
    this.emit(
      "hit",
      impact?.x ?? e.x,
      impact?.z ?? e.z,
      damage,
      impact?.y ?? groundHeight(e.x, e.z) + 0.9 * ENEMY_TYPES[e.kind].scale,
      {
        magic: impact?.magic,
        critical: impact?.critical,
        bullet: impact?.bullet,
        headshot: impact?.headshot,
        killed: e.hp <= 0,
        enemyKind: e.kind,
        incomingX: impact?.incomingX,
        incomingY: impact?.incomingY,
        incomingZ: impact?.incomingZ,
        normalX: impact?.normalX,
        normalY: impact?.normalY,
        normalZ: impact?.normalZ,
      },
    );
    if (e.hp <= 0) {
      e.active = false;
      this.souls++;
      this.emit("kill", e.x, e.z, e.kind, impact?.y, {
        impactX: impact?.x,
        impactZ: impact?.z,
        incomingY: impact?.incomingY,
        normalX: impact?.normalX,
        normalY: impact?.normalY,
        normalZ: impact?.normalZ,
        magic: impact?.magic,
        critical: impact?.critical,
        incomingX: impact?.incomingX ?? (e.x - from.x) / d,
        incomingZ: impact?.incomingZ ?? (e.z - from.z) / d,
      });
      this.loot.release(e.x, e.z, this.rewards.roll(e.kind, e.wave), {
        x: impact?.incomingX ?? (e.x - from.x) / d,
        z: impact?.incomingZ ?? (e.z - from.z) / d,
      });
      return true;
    }
    return false;
  }
  melee(player: Point, forward: Point) {
    if (this.meleeCooldown > 0 || this.phase === "lost") return false;
    this.meleeCooldown = WEAPON_TUNING.blade.interval;
    for (const e of this.alive) {
      const dx = e.x - player.x,
        dz = e.z - player.z,
        d = Math.hypot(dx, dz);
      if (
        d < A.meleeRange &&
        (dx * forward.x + dz * forward.z) / Math.max(d, 0.01) > A.meleeArcDot &&
        this.nav.lineClear(player, e)
      )
        this.damageEnemy(
          e.id,
          WEAPON_TUNING.blade.damage * this.damageMultiplier,
          player,
          A.meleeKnockback + this.skills.cunning * A.cunningKnockback,
        );
    }
    return true;
  }
  burst(player: Point) {
    if (!this.requestBurst()) return false;
    return this.releaseBurst(player);
  }
  requestBurst() {
    if (this.burstCooldown > 0 || this.phase === "lost") return false;
    this.burstCooldown =
      A.novaCooldown - this.skills.sorcery * A.novaCooldownPerPoint;
    this.burstPrimed = true;
    return true;
  }
  releaseBurst(player: Point) {
    if (this.phase === "lost" || !this.burstPrimed) return false;
    this.burstPrimed = false;
    for (const e of this.alive)
      if (
        Math.hypot(e.x - player.x, e.z - player.z) < A.novaRadius &&
        this.nav.lineClear(player, e)
      )
        this.damageEnemy(
          e.id,
          A.novaDamage * (1 + this.skills.sorcery * A.sorceryPerPoint),
          player,
          A.novaKnockback,
          {
            x: e.x,
            z: e.z,
            y: groundHeight(e.x, e.z) + 0.9 * ENEMY_TYPES[e.kind].scale,
            magic: true,
          },
        );
    this.emit("cast", player.x, player.z, 1);
    return true;
  }
  canOrb() {
    if (this.orbCooldown > 0 || this.phase === "lost") return false;
    this.orbCooldown =
      A.orbCooldown - this.skills.sorcery * A.orbCooldownPerPoint;
    return true;
  }
  explode(point: Point) {
    for (const e of this.alive) {
      const d = Math.hypot(e.x - point.x, e.z - point.z);
      if (d < A.orbRadius && this.nav.lineClear(point, e))
        this.damageEnemy(
          e.id,
          A.orbDamage *
            (1 + this.skills.sorcery * A.sorceryPerPoint) *
            (1 - d / A.orbFalloffRadius),
          point,
          A.orbKnockback,
          {
            x: e.x,
            z: e.z,
            y: groundHeight(e.x, e.z) + 0.9 * ENEMY_TYPES[e.kind].scale,
            magic: true,
          },
        );
    }
    this.emit("cast", point.x, point.z, 2);
  }
  upgradeStat(stat: Stat) {
    if (this.points < 1 || this.stats[stat] >= E.statCap) return false;
    this.points--;
    this.stats[stat]++;
    if (stat === "constitution") this.health += P.healthPerConstitution;
    return true;
  }
  upgradeSkill(skill: Skill) {
    if (this.points < 1 || this.skills[skill] >= E.skillCap) return false;
    this.points--;
    this.skills[skill]++;
    return true;
  }
  buyWeaponUpgrade() {
    const cost = E.upgradeBase + this.weaponRank * E.upgradePerRank;
    if (this.coins < cost || this.weaponRank >= E.weaponRankCap) return false;
    this.coins -= cost;
    this.weaponRank++;
    return true;
  }
  buyAmmo() {
    if (this.coins < E.ammoCost) return false;
    this.coins -= E.ammoCost;
    this.ammoReward += E.ammoPack;
    return true;
  }
  repair() {
    if (
      this.coins < E.repairCost ||
      this.baseHealth >= P.bellHealth ||
      this.phase === "lost"
    )
      return false;
    this.coins -= E.repairCost;
    this.baseHealth = Math.min(P.bellHealth, this.baseHealth + E.repairHealth);
    return true;
  }
  reset() {
    this.health = P.health;
    this.baseHealth = P.bellHealth;
    this.coins = E.startingGold;
    this.souls = 0;
    this.level = 1;
    this.xp = 0;
    this.points = E.startingPoints;
    this.wave = 0;
    this.phase = "peace";
    this.burstCooldown = 0;
    this.burstPrimed = false;
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
