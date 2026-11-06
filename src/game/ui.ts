import { Battle, STATS, SKILLS, type Stat, type Skill } from "./battle";
import type { Weapon } from "./weapon";
export const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
export class UI {
  private toastTime = 0;
  private bannerTime = 0;
  private damage = 0;
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
      if (battle.buyWeaponUpgrade())
        this.toast("The Graveforge strengthens your weapons.");
      this.renderShop();
    };
    $("buy-ammo").onclick = () => {
      if (battle.buyAmmo()) this.toast("Ammunition purchased.");
      this.renderShop();
    };
  }
  toast(message: string) {
    $("toast").textContent = message;
    $("toast").classList.add("show");
    clearTimeout(this.toastTime);
    this.toastTime = window.setTimeout(
      () => $("toast").classList.remove("show"),
      2800,
    );
  }
  banner(message: string) {
    $("combat-banner").textContent = message;
    $("combat-banner").classList.add("show");
    clearTimeout(this.bannerTime);
    this.bannerTime = window.setTimeout(
      () => $("combat-banner").classList.remove("show"),
      2200,
    );
  }
  hit() {
    this.damage = 1;
  }
  open(id: string) {
    this.pause();
    $(id).classList.remove("hidden");
    $<HTMLDialogElement>(id).showModal();
    if (id === "skills-dialog") this.renderUpgrades();
    if (id === "shop-dialog") this.renderShop();
  }
  get dialogOpen() {
    return [...document.querySelectorAll("dialog")].some((d) => d.open);
  }
  renderUpgrades() {
    const b = this.battle;
    $("skill-points").textContent =
      `${b.points} upgrade points · Level ${b.level}`;
    $("stat-options").innerHTML = (Object.keys(STATS) as Stat[])
      .map(
        (key) =>
          `<button class="upgrade-option" data-stat="${key}" ${b.points < 1 || b.stats[key] >= 8 ? "disabled" : ""}><strong>${key}</strong><b>${b.stats[key]} / 8 ＋</b><small>${STATS[key]}</small></button>`,
      )
      .join("");
    $("skill-options").innerHTML = (Object.keys(SKILLS) as Skill[])
      .map(
        (key) =>
          `<button class="upgrade-option" data-skill="${key}" ${b.points < 1 || b.skills[key] >= 3 ? "disabled" : ""}><strong>${key}</strong><b>${["NOVICE", "APPRENTICE", "ADEPT", "MASTER"][b.skills[key]]} ＋</b><small>${SKILLS[key]}</small></button>`,
      )
      .join("");
  }
  renderShop() {
    const b = this.battle,
      cost = 30 + b.weaponRank * 25;
    $("shop-summary").textContent =
      `${b.coins} gold · Weapon rank ${b.weaponRank} / 5 · +${Math.round(b.weaponRank * 18)}% damage`;
    $("upgrade-weapon").textContent =
      b.weaponRank === 5
        ? "WEAPONS FULLY UPGRADED"
        : `UPGRADE WEAPONS · ${cost} GOLD`;
    $<HTMLButtonElement>("upgrade-weapon").disabled =
      b.coins < cost || b.weaponRank === 5;
    $<HTMLButtonElement>("buy-ammo").disabled = b.coins < 10;
  }
  lost() {
    const b = this.battle;
    $("lost-title").textContent =
      b.baseHealth <= 0 ? "The bell falls silent." : "The dark claims another.";
    $("lost-summary").textContent =
      `You reached wave ${b.wave} and released ${b.souls} souls. Choose another path. Defend the bell. Return stronger.`;
    this.open("lost-dialog");
  }
  update(dt: number, aiming: boolean) {
    const b = this.battle,
      w = this.weapon;
    $("health-value").textContent = `${Math.ceil(b.health)} / ${b.maxHealth}`;
    $("health-fill").style.width = `${(b.health / b.maxHealth) * 100}%`;
    $("base-value").textContent = `${Math.ceil(b.baseHealth)} / 500`;
    $("base-fill").style.width = `${b.baseHealth / 5}%`;
    $("ammo").textContent =
      w.id === "blade" ? "—" : w.reloading ? "⋯" : String(w.ammo);
    $("reserve").textContent = w.id === "blade" ? "—" : String(w.reserve);
    $("weapon-name").innerHTML =
      `${w.config.name}<small>${w.config.type} · RANK ${b.weaponRank}</small>`;
    $("souls").textContent = String(b.souls).padStart(2, "0");
    $("level-value").textContent = `LEVEL ${b.level} · ${b.points} POINTS`;
    $("coins-value").textContent = `${b.coins} GOLD`;
    $("xp-fill").style.width = `${(b.xp / (b.level * 40)) * 100}%`;
    $("wave-status").textContent =
      b.phase === "peace"
        ? "RING THE BELL TO BEGIN"
        : b.phase === "intermission"
          ? `NEXT WAVE IN ${Math.ceil(b.nextWave)}`
          : `WAVE ${b.wave} · ${b.alive.length} HOLLOWGUARDS`;
    $("objective-text").textContent =
      b.phase === "peace"
        ? "Find the bell behind you. Press E to call the horde."
        : "Defend the bell. Lure the horde away from the keep.";
    $("burst-status").textContent =
      `F · SOUL BURST ${b.burstCooldown > 0 ? Math.ceil(b.burstCooldown) + "s" : "READY"}`;
    $("orb-status").textContent =
      `Q · EMBER ORB ${b.orbCooldown > 0 ? Math.ceil(b.orbCooldown) + "s" : "READY"}`;
    $("crosshair").classList.toggle("aiming", aiming);
    for (const slot of document.querySelectorAll<HTMLElement>("[data-weapon]"))
      slot.classList.toggle("selected", slot.dataset.weapon === w.id);
    this.damage = Math.max(0, this.damage - dt * 2);
    $("damage-overlay").style.opacity = String(this.damage * 0.55);
  }
}
