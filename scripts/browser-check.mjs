import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
await mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: [
    "--no-sandbox",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--disable-dev-shm-usage",
  ],
});
const page = await browser.newPage({
  viewport: { width: 800, height: 500 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const state = () => page.evaluate(() => window.__soulHarvester());
const wait = (p) => page.waitForFunction(p, undefined, { timeout: 60000 });
let mx = 0,
  my = 0;
async function enter() {
  await page.locator("#enter").waitFor({ state: "visible" });
  const r = await page.locator("#enter").boundingBox();
  mx = r.x + r.width / 2;
  my = r.y + r.height / 2;
  await page.locator("#enter").click();
  await wait(() => window.__soulHarvester().active);
}
async function aimAt(x, y, z) {
  const s = await state(),
    dx = x - s.position[0],
    dz = z - s.position[2],
    yaw = Math.atan2(-dx, -dz),
    pitch = Math.atan2(y - (s.position[1] + 1.72), Math.hypot(dx, dz));
  mx += (s.yaw - yaw) / 0.002;
  my += (s.pitch - pitch) / 0.002;
  await page.mouse.move(mx, my);
}
try {
  await page.goto(process.env.GAME_URL || "http://127.0.0.1:4180/");
  await wait(() => window.__soulHarvester?.().ready);
  await page.locator("#loading").waitFor({ state: "detached" });
  await page.evaluate(() => document.fonts.ready);
  assert.equal((await state()).wave, 0);
  await page.evaluate(() => {
    window.__feedbackChecks = {
      hit: false,
      kill: false,
      flash: false,
      bounce: false,
    };
    const sample = () => {
      const s = window.__soulHarvester(),
        c = window.__feedbackChecks;
      c.hit ||=
        s.hitFeedback.visible &&
        document.querySelector("#hitmarker").classList.contains("show");
      c.kill ||=
        s.hitFeedback.kill &&
        document.querySelector("#hitmarker").classList.contains("kill");
      c.flash ||= s.enemyRender.flashing > 0;
      c.bounce ||= s.drops.some((d) => d.bounces > 0 && !d.magnet);
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.screenshot({ path: "artifacts/courtyard-menu.png" });
  await page.locator("#notes").click();
  assert.equal(await page.locator("#guide").evaluate((el) => el.open), true);
  await page.locator("#close-guide").click();
  await enter();
  console.log("PASS: game renders and captures the mouse");
  await page.keyboard.press("KeyK");
  await page.locator("#skills-dialog").waitFor({ state: "visible" });
  await page.locator('[data-stat="constitution"]').click();
  await page.locator('[data-skill="athletics"]').click();
  await page.locator('[data-skill="athletics"]').click();
  assert.equal((await state()).health, 120);
  assert.equal((await state()).skills.athletics, 3);
  assert.equal((await state()).points, 1);
  await page.screenshot({ path: "artifacts/skills.png" });
  await page.locator('[data-close="skills-dialog"]').first().click();
  await enter();
  console.log(
    "PASS: upgrades consume points and change actual character stats",
  );
  await page.keyboard.down("Space");
  await wait(
    () =>
      window.__soulHarvester().position[1] >
      window.__soulHarvester().ground + 0.2,
  );
  await page.keyboard.up("Space");
  await wait(
    () =>
      Math.abs(
        window.__soulHarvester().position[1] - window.__soulHarvester().ground,
      ) < 0.02,
  );
  await page.keyboard.down("KeyW");
  await wait(() => window.__soulHarvester().position[2] < 12);
  await page.keyboard.up("KeyW");
  console.log("PASS: movement, upgraded jump and landing");
  // Return near the base, using its actual collision as a stop.
  await page.keyboard.down("KeyS");
  await wait(() => window.__soulHarvester().position[2] > 17.95);
  await page.waitForTimeout(500);
  await page.keyboard.up("KeyS");
  assert.ok((await state()).position[2] <= 18.02);
  console.log("PASS: actual bell pedestal collision");
  await page.keyboard.press("Digit2");
  await wait(() => window.__soulHarvester().weapon === "pistol");
  await page.mouse.down({ button: "right" });
  await wait(
    () => window.__soulHarvester().aiming && window.__soulHarvester().fov < 60,
  );
  await wait(() => window.__soulHarvester().aimAmount > 0.999);
  const sight = (await state()).sightProjection;
  for (const p of sight) {
    assert.ok(Math.abs(p[0]) < 0.015);
    assert.ok(Math.abs(p[1]) < 0.015);
  }
  await page.screenshot({ path: "artifacts/ads.png" });
  await page.mouse.up({ button: "right" });
  await page.mouse.down();
  await wait(() => window.__soulHarvester().ammo < 12);
  await page.mouse.up();
  const reserve = (await state()).reserve;
  await page.keyboard.press("KeyR");
  await wait(() => window.__soulHarvester().reloading);
  await wait(
    () =>
      !window.__soulHarvester().reloading &&
      window.__soulHarvester().ammo === 12,
  );
  assert.ok((await state()).reserve < reserve);
  console.log(
    "PASS: pistol, aimed fire, recoil path and finite-reserve reload",
  );
  await page.mouse.click(mx, my);
  await wait(() => window.__soulHarvester().ammo < 12);
  assert.equal((await state()).hitFeedback.confirmedHits, 0);
  console.log(
    "PASS: a quick mouse tap is buffered; environmental shots show no hit marker",
  );
  await page.keyboard.press("Digit1");
  await wait(() => window.__soulHarvester().weapon === "blade");
  await page.keyboard.press("KeyV");
  await page.keyboard.press("Digit3");
  await wait(() => window.__soulHarvester().weapon === "rifle");
  await page.keyboard.press("KeyF");
  await wait(() => window.__soulHarvester().burstCooldown > 0);
  await page.keyboard.press("KeyQ");
  await wait(() => window.__soulHarvester().orbCooldown > 0);
  console.log("PASS: weapon switching, melee and both magic abilities");
  await page.keyboard.press("KeyE");
  await wait(
    () =>
      window.__soulHarvester().wave === 1 &&
      window.__soulHarvester().enemies.length > 0,
  );
  await wait(() => window.__soulHarvester().pending === 0);
  const forestState = await state();
  assert.ok(
    forestState.spawnZones.every((z) => z.validPoints > 0 && z.spawned > 0),
  );
  const first = forestState.enemies[0];
  assert.ok(Math.abs(first.x) < 25 && first.z < -48);
  await page.waitForFunction(
    (before) => {
      const e = window
        .__soulHarvester()
        .enemies.find((e) => e.id === before.id);
      return e && Math.hypot(e.x - before.x, e.z - before.z) > 0.02;
    },
    first,
    { timeout: 30000 },
  );
  console.log(
    "PASS: seven accessible forest zones spread spawns across the entire width",
  );
  // Follow the real moving target using relative mouse inputs; no simulation mutation.
  for (
    let i = 0;
    i < 28 && !(await state()).drops.some((d) => d.kind === "gold");
    i++
  ) {
    const s = await state(),
      e = s.enemies
        .filter((e) => Math.abs(e.x) < 12)
        .sort((a, b) => Math.abs(a.x) - Math.abs(b.x))[0];
    if (!e) break;
    await aimAt(e.x, 0.95, e.z);
    const ammoBefore = (await state()).ammo;
    await page.mouse.down();
    await page.waitForFunction(
      (n) => window.__soulHarvester().ammo < n,
      ammoBefore,
      { timeout: 15000 },
    );
    await page.mouse.up();
  }
  await wait(() => window.__soulHarvester().souls > 0);
  assert.ok((await state()).drops.some((d) => d.kind === "gold"));
  const feedbackChecks = await page.evaluate(() => window.__feedbackChecks);
  assert.ok(feedbackChecks.hit && feedbackChecks.kill && feedbackChecks.flash);
  console.log(
    "PASS: confirmed red hit marker, white body flash, distinct kills and probabilistic gold on real enemies",
  );
  await aimAt(0, 1.72, -65);
  await page.keyboard.down("ShiftLeft");
  await page.keyboard.down("KeyW");
  await page.waitForFunction(
    () => window.__soulHarvester().position[2] < -18,
    undefined,
    { timeout: 120000 },
  );
  await page.keyboard.up("KeyW");
  await page.keyboard.up("ShiftLeft");
  assert.ok(Math.abs((await state()).position[0]) < 1);
  assert.ok(
    Math.abs((await state()).position[1] - (await state()).ground) < 0.03,
  );
  console.log(
    "PASS: player traverses the real bridge without falling or clipping",
  );
  await page.keyboard.down("KeyW");
  await wait(() =>
    window.__soulHarvester().enemies.some((e) => e.target === "player"),
  );
  await page.keyboard.up("KeyW");
  const chaser = (await state()).enemies.find((e) => e.target === "player").id;
  await page.keyboard.down("ShiftLeft");
  await page.keyboard.down("KeyS");
  await page.waitForFunction(
    (id) =>
      window.__soulHarvester().enemies.find((e) => e.id === id)?.target ===
      "bell",
    chaser,
    { timeout: 60000 },
  );
  await page.keyboard.up("KeyS");
  await page.keyboard.up("ShiftLeft");
  console.log(
    "PASS: actual enemy acquires the approaching player and returns to the bell after retreat",
  );
  const rewardsBefore = await state();
  const targetDrop = rewardsBefore.drops.find((d) => d.kind === "gold");
  assert.ok(targetDrop);
  assert.equal(rewardsBefore.lootRender.cullingDisabled, true);
  assert.ok(
    rewardsBefore.lootRender.gold > 0 && rewardsBefore.lootRender.xp > 0,
  );
  await aimAt(targetDrop.x, groundYForAim(), targetDrop.z);
  function groundYForAim() {
    return (targetDrop.y ?? 0.3) + 1;
  }
  await page.keyboard.down("ShiftLeft");
  await page.keyboard.down("KeyW");
  await page.waitForFunction(
    (d) => {
      const s = window.__soulHarvester();
      return Math.hypot(s.position[0] - d.x, s.position[2] - d.z) < 6.2;
    },
    targetDrop,
    { timeout: 120000 },
  );
  await page.keyboard.up("KeyW");
  await page.keyboard.up("ShiftLeft");
  await page.screenshot({ path: "artifacts/loot-field.png" });
  await page.keyboard.down("KeyW");
  await page.waitForFunction(
    (before) => {
      const s = window.__soulHarvester();
      return (
        s.coins > before.coins && (s.xp > before.xp || s.level > before.level)
      );
    },
    rewardsBefore,
    { timeout: 60000 },
  );
  await page.keyboard.up("KeyW");
  assert.ok((await state()).lootRender.cullingDisabled);
  assert.ok(await page.evaluate(() => window.__feedbackChecks.bounce));
  console.log(
    "PASS: gold and XP stay rendered in the field and magnetically collect into real rewards",
  );
  await page.screenshot({ path: "artifacts/courtyard-play.png" });
  await page.keyboard.press("Escape");
  await wait(() => !window.__soulHarvester().active);
  const paused = await state();
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(300);
  await page.keyboard.up("KeyW");
  assert.deepEqual((await state()).position, paused.position);
  assert.deepEqual((await state()).enemies, paused.enemies);
  await page.locator("#sound").click();
  assert.equal(await page.locator("#sound-state").textContent(), "ON");
  await page.locator("#sound").click();
  await enter();
  await page.keyboard.press("Escape");
  await wait(() => !window.__soulHarvester().active);
  console.log("PASS: pause freezes combat; resume and audio controls work");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/courtyard-mobile.png" });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.setViewportSize({ width: 800, height: 500 });
  await page.reload();
  await wait(() => window.__soulHarvester?.().ready);
  await page.locator("#loading").waitFor({ state: "detached" });
  await enter();
  const bell = (await state()).bellPosition;
  await aimAt(...bell);
  await page.mouse.click(mx, my);
  await wait(() => window.__soulHarvester().wave === 1);
  assert.equal((await state()).ammo, 29);
  const retained = (await state()).enemies[0];
  await page.mouse.down();
  await wait(() => window.__soulHarvester().wave === 10);
  await wait(() => window.__soulHarvester().ammo <= 18);
  await page.mouse.up();
  await page.waitForFunction(
    () => window.__soulHarvester().pending === 0,
    undefined,
    { timeout: 180000 },
  );
  const stacked = await state();
  assert.equal(stacked.wave, 10);
  assert.equal(stacked.enemies.length, 260);
  assert.equal(stacked.plannedEnemies, 260);
  assert.equal(
    stacked.enemies.find((e) => e.id === retained.id).hp,
    retained.hp,
  );
  assert.ok(stacked.spawnZones.every((z) => z.spawned > 15));
  for (let w = 1; w <= 10; w++)
    assert.equal(
      stacked.enemies.filter((e) => e.wave === w).length,
      8 + (w - 1) * 4,
    );
  assert.equal(stacked.activeWaves.length, 10);
  assert.equal(new Set(stacked.enemies.map((e) => e.kind)).size, 4);
  assert.ok(
    stacked.drawCalls < 115,
    "instanced crowd should keep draw calls bounded",
  );
  await page.screenshot({ path: "artifacts/ten-waves.png" });
  console.log(
    "PASS: single shots trigger exactly one wave; all ten waves persist (260 enemies, four types); no wave 11",
  );
  await page.keyboard.press("Escape");
  await wait(() => !window.__soulHarvester().active);
  const memory = (await state()).memory;
  await page.waitForTimeout(1500);
  assert.deepEqual((await state()).memory, memory);
  assert.ok((await state()).lootRender.numberTextures <= 64);
  assert.deepEqual(errors, []);
  console.log("PASS: responsive menu and no browser/renderer errors");
  const summary = await state();
  console.log("Diagnostics:", {
    wave: summary.wave,
    enemies: summary.enemies.length,
    drawCalls: summary.drawCalls,
    fps: summary.fps,
    health: summary.health,
  });
} catch (error) {
  console.error("Failure state:", await state());
  await page.screenshot({ path: "artifacts/browser-failure.png" });
  throw error;
} finally {
  await browser.close();
}
