import { Battle, STATS, SKILLS, type Stat, type Skill } from "./battle";
import type { Weapon } from "./weapon";
import { WAVE_LIMIT } from "./waves";
export const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
export class UI {
  private highlightAnimation: Animation | null = null;
  private toastTime = 0;
  private bannerTime = 0;
  private damage = 0;
  private pickupTime = 0;
  private pickupTotal = 0;
  private pickupAnimation: Animation | null = null;
  private goldAnimation: Animation | null = null;
  private bannerAnimation: Animation | null = null;
  private reducedMotion = matchMedia("(prefers-reduced-motion: reduce)")
    .matches;
  constructor(
    readonly battle: Battle,
    readonly weapon: Weapon,
    private pause: () => void,
  ) {
    for (const button of document.querySelectorAll<HTMLButtonElement>(
      "[data-close]",
    ))
      button.onclick = () =>
        $(button.dataset.close!).closest("dialog")!.close();
    const describe = (event: Event) => {
      const el = (event.target as HTMLElement).closest<HTMLButtonElement>(
        ".upgrade-option",
      );
      if (el) $("skill-description").textContent = el.dataset.description ?? "";
    };
    for (const id of ["stat-options", "skill-options"]) {
      const el = $(id);
      el.addEventListener("mouseover", describe);
      el.addEventListener("focusin", describe);
    }
    $("stat-options").onclick = (event) => {
      const key = (event.target as HTMLElement).closest<HTMLButtonElement>(
        "[data-stat]",
      )?.dataset.stat as Stat | undefined;
      if (key) {
        battle.upgradeStat(key);
        this.renderUpgrades();
      }
    };
    $("skill-options").onclick = (event) => {
      const key = (event.target as HTMLElement).closest<HTMLButtonElement>(
        "[data-skill]",
      )?.dataset.skill as Skill | undefined;
      if (key) {
        battle.upgradeSkill(key);
        this.renderUpgrades();
      }
    };
    $("upgrade-weapon").onclick = () => {
      if (battle.buyWeaponUpgrade()) this.toast("Weapon upgraded");
      this.renderShop();
    };
    $("buy-ammo").onclick = () => {
      if (battle.buyAmmo()) this.toast("Ammunition refilled");
      this.renderShop();
    };
  }
  toast(message: string) {
    $("toast").textContent = message;
    $("toast").classList.add("show");
    clearTimeout(this.toastTime);
    this.toastTime = window.setTimeout(
      () => $("toast").classList.remove("show"),
      1800,
    );
  }
  banner(message: string) {
    this.bannerAnimation?.cancel();
    $("combat-banner").classList.remove("level-up");
    $("combat-banner").dataset.detail = "";
    $("combat-banner").textContent = message;
    $("combat-banner").classList.add("show");
    clearTimeout(this.bannerTime);
    this.bannerTime = window.setTimeout(
      () => $("combat-banner").classList.remove("show"),
      1600,
    );
  }
  levelUp(level: number) {
    this.banner("LEVEL UP");
    const el = $("combat-banner");
    el.classList.add("level-up");
    el.dataset.detail = `LEVEL ${level} · +2`;
    if (!this.reducedMotion)
      this.bannerAnimation = el.animate(
        [
          { transform: "translateX(-50%) scale(.72)", opacity: 0 },
          {
            transform: "translateX(-50%) scale(1.08)",
            opacity: 1,
            offset: 0.35,
          },
          { transform: "translateX(-50%) scale(1)", opacity: 1 },
        ],
        { duration: 300 },
      );
    this.syncHealth();
  }
  levelHighlight(reduced: boolean) {
    if (reduced) return;
    this.highlightAnimation?.cancel();
    this.highlightAnimation = $("level-highlight").animate(
      [{ opacity: 0 }, { opacity: 0.15, offset: 0.15 }, { opacity: 0 }],
      { duration: 280 },
    );
  }
  pickup(kind: "gold" | "xp", value: number) {
    if (kind === "gold") {
      $("coins-value").textContent = String(this.battle.coins);
      this.goldAnimation?.cancel();
      if (!this.reducedMotion)
        this.goldAnimation = $("gold-counter").animate(
          [
            { filter: "brightness(1.6)", transform: "scale(1.07)" },
            { filter: "brightness(1)", transform: "scale(1)" },
          ],
          { duration: 220 },
        );
    } else {
      this.pickupTotal += value;
      const el = $("pickup-feedback");
      el.textContent = `+${this.pickupTotal} XP`;
      el.style.opacity = "1";
      this.pickupAnimation?.cancel();
      if (!this.reducedMotion)
        this.pickupAnimation = el.animate(
          [
            { opacity: 1, transform: "translateY(0)" },
            { opacity: 1, transform: "translateY(-3px)", offset: 0.4 },
            { opacity: 0, transform: "translateY(-15px)" },
          ],
          { duration: 650, fill: "forwards" },
        );
      clearTimeout(this.pickupTime);
      this.pickupTime = window.setTimeout(() => {
        this.pickupTotal = 0;
        el.style.opacity = "0";
      }, 650);
      $("xp-fill").style.width =
        `${(this.battle.xp / (this.battle.level * 40)) * 100}%`;
    }
  }
  private syncHealth() {
    $("health-value").textContent =
      `${Math.ceil(this.battle.health)}/${this.battle.maxHealth}`;
    $("health-fill").style.width =
      `${(this.battle.health / this.battle.maxHealth) * 100}%`;
  }
  hit() {
    this.damage = 1;
    this.syncHealth();
    $("damage-overlay").style.opacity = ".5";
  }
  reset() {
    this.highlightAnimation?.cancel();
    this.damage = 0;
    this.pickupTotal = 0;
    clearTimeout(this.pickupTime);
    clearTimeout(this.bannerTime);
    this.pickupAnimation?.cancel();
    this.goldAnimation?.cancel();
    this.bannerAnimation?.cancel();
    $("pickup-feedback").style.opacity = "0";
    $("combat-banner").classList.remove("show");
    $("damage-overlay").style.opacity = "0";
  }
  open(id: string) {
    this.pause();
    document.body.classList.add("has-panel");
    $<HTMLDialogElement>(id).showModal();
    if (id === "skills-dialog") this.renderUpgrades();
    if (id === "shop-dialog") this.renderShop();
  }
  get dialogOpen() {
    return [...document.querySelectorAll("dialog")].some((d) => d.open);
  }
  renderUpgrades() {
    const b = this.battle;
    $("skill-points").textContent = `${b.points} ◆`;
    $("stat-options").innerHTML = (Object.keys(STATS) as Stat[])
      .map(
        (key) =>
          `<button class="upgrade-option" data-stat="${key}" data-description="${STATS[key]} · 1 point" aria-label="Upgrade ${key}, rank ${b.stats[key]} of 8" ${b.points < 1 || b.stats[key] >= 8 ? "disabled" : ""}><strong>${key}</strong><span class="stat-pips">${Array.from({ length: 8 }, (_, i) => `<i class="${i < b.stats[key] ? "filled" : ""}"></i>`).join("")}</span></button>`,
      )
      .join("");
    $("skill-options").innerHTML = (Object.keys(SKILLS) as Skill[])
      .map(
        (key) =>
          `<button class="upgrade-option" data-skill="${key}" data-description="${SKILLS[key]} · 1 point" aria-label="Upgrade ${key}" ${b.points < 1 || b.skills[key] >= 3 ? "disabled" : ""}><strong>${key}</strong><b>${["NOVICE", "APPRENTICE", "ADEPT", "MASTER"][b.skills[key]]}</b></button>`,
      )
      .join("");
  }
  renderShop() {
    const b = this.battle,
      cost = 30 + b.weaponRank * 25;
    $("shop-summary").textContent =
      `${b.coins} gold · Rank ${b.weaponRank}/5 · +${Math.round(b.weaponRank * 18)}% damage`;
    $("upgrade-weapon").textContent =
      b.weaponRank === 5 ? "MAXIMUM RANK" : `UPGRADE · ${cost} GOLD`;
    $<HTMLButtonElement>("upgrade-weapon").disabled =
      b.coins < cost || b.weaponRank === 5;
    $<HTMLButtonElement>("buy-ammo").disabled = b.coins < 10;
  }
  lost() {
    const b = this.battle;
    $("lost-title").textContent =
      b.baseHealth <= 0 ? "The bell falls silent." : "The dark claims another.";
    $("lost-summary").textContent =
      `Wave ${b.wave}/${WAVE_LIMIT} · ${b.souls} souls`;
    this.open("lost-dialog");
  }
  update(dt: number, aiming: boolean, nearBell = false) {
    const b = this.battle,
      w = this.weapon;
    $("health-value").textContent = `${Math.ceil(b.health)}/${b.maxHealth}`;
    $("health-fill").style.width = `${(b.health / b.maxHealth) * 100}%`;
    $("base-value").textContent = `${Math.ceil(b.baseHealth)}/500`;
    $("base-fill").style.width = `${b.baseHealth / 5}%`;
    $("base-hud").style.display = b.baseHealth < 500 ? "flex" : "none";
    $("coins-value").textContent = String(b.coins);
    $("points-value").textContent = String(b.points);
    $("level-value").textContent = `LEVEL ${b.level}`;
    $("xp-fill").style.width = `${(b.xp / (b.level * 40)) * 100}%`;
    $("wave-status").textContent =
      b.phase === "peace"
        ? ""
        : b.phase === "intermission"
          ? `WAVE ${b.wave}/${WAVE_LIMIT} · CLEAR`
          : `WAVE ${b.wave}/${WAVE_LIMIT}`;
    for (const [name, cd] of [
      ["burst", b.burstCooldown],
      ["orb", b.orbCooldown],
    ] as const) {
      $(`${name}-time`).textContent = cd > 0 ? String(Math.ceil(cd)) : "";
      $(`${name}-status`).classList.toggle("cooldown", cd > 0);
    }
    $("crosshair").classList.toggle("aiming", aiming && w.id !== "blade");
    for (const slot of document.querySelectorAll<HTMLElement>("[data-weapon]"))
      slot.classList.toggle("selected", slot.dataset.weapon === w.id);
    for (const id of ["pistol", "rifle"] as const) {
      const el = document.querySelector<HTMLElement>(`[data-ammo="${id}"]`)!;
      el.textContent =
        w.reloading && w.id === id
          ? "···"
          : `${w.magazines[id]}/${w.reserves[id]}`;
    }
    this.damage = Math.max(0, this.damage - dt * 2);
    $("damage-overlay").style.opacity = String(this.damage * 0.5);
  }
}
