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
  viewport: { width: 960, height: 640 },
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
  await page.locator('[data-close="skills-dialog"]').click();
  await enter();
  console.log(
    "PASS: upgrades consume points and change actual character stats",
  );
  await page.keyboard.down("Space");
  await wait(() => window.__soulHarvester().position[1] > 0.2);
  await page.keyboard.up("Space");
  await wait(() => window.__soulHarvester().position[1] === 0);
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
  console.log("PASS: a quick mouse tap is buffered until a simulation update");
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
  const first = (await state()).enemies[0];
  assert.ok(Math.abs(first.x) < 4.5 && first.z < -48);
  await page.waitForTimeout(800);
  assert.ok((await state()).enemies[0].z !== first.z);
  console.log("PASS: fixed tree spawn and moving enemy");
  // Follow the real moving target using relative mouse inputs; no simulation mutation.
  for (let i = 0; i < 12 && (await state()).souls === 0; i++) {
    const s = await state(),
      e = s.enemies[0];
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
  console.log("PASS: firing hits and releases an actual moving hollowguard");
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
  assert.ok(Math.abs((await state()).position[1]) < 0.01);
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
  assert.deepEqual(errors, []);
  console.log("PASS: responsive menu and no browser/renderer errors");
  console.log("Diagnostics:", await state());
} catch (error) {
  console.error("Failure state:", await state());
  await page.screenshot({ path: "artifacts/browser-failure.png" });
  throw error;
} finally {
  await browser.close();
}
