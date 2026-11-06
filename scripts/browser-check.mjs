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
const context = await browser.newContext({
  viewport: { width: 960, height: 640 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const state = () => page.evaluate(() => window.__soulHarvester());
const wait = async (predicate) => {
  await page.waitForFunction(predicate, undefined, { timeout: 30000 });
};
try {
  await page.goto(process.env.GAME_URL || "http://127.0.0.1:5173/");
  await wait(() => window.__soulHarvester?.().ready);
  await page.locator("#loading").waitFor({ state: "detached" });
  await page.evaluate(() => document.fonts.ready);
  assert.equal((await state()).colliders, 33);
  assert.equal((await state()).shades, 7);
  await page.screenshot({ path: "artifacts/courtyard-menu.png" });
  await page.locator("#notes").click();
  assert.equal(await page.locator("#guide").evaluate((el) => el.open), true);
  await page.locator("#close-guide").click();
  const origin = await page.locator("#enter").boundingBox();
  await page.locator("#enter").click();
  await wait(() => window.__soulHarvester().active);
  console.log("PASS: start menu, instructions, WebGL, pointer lock");
  const start = await state();
  await page.keyboard.down("KeyW");
  await wait(() => window.__soulHarvester().position[2] < 11);
  await page.keyboard.up("KeyW");
  assert.ok((await state()).position[2] < start.position[2] - 2);
  await page.keyboard.down("Space");
  await wait(() => window.__soulHarvester().position[1] > 0.2);
  await page.keyboard.up("Space");
  await wait(() => window.__soulHarvester().position[1] === 0);
  console.log("PASS: movement and jump/landing");
  const before = await state();
  await page.mouse.move(
    origin.x + origin.width / 2 + 120,
    origin.y + origin.height / 2 - 30,
  );
  await page.waitForTimeout(150);
  const after = await state();
  assert.ok(after.yaw !== before.yaw || after.pitch !== before.pitch);
  await page.mouse.move(
    origin.x + origin.width / 2,
    origin.y + origin.height / 2,
  );
  await page.waitForTimeout(150);
  await page.mouse.down();
  await wait(() => window.__soulHarvester().ammo < 8);
  await page.mouse.up();
  await page.keyboard.press("KeyR");
  await wait(() => window.__soulHarvester().reloading);
  await wait(
    () =>
      !window.__soulHarvester().reloading &&
      window.__soulHarvester().ammo === 8,
  );
  console.log("PASS: mouse look, firing and reload cycle");
  await page.screenshot({ path: "artifacts/courtyard-play.png" });
  // Aim at an actual shade using real relative mouse movement, then release it.
  const aiming = await state(),
    target = aiming.targets[0];
  const dx = target[0] - aiming.position[0],
    dz = target[2] - aiming.position[2];
  const yaw = Math.atan2(-dx, -dz),
    pitch = Math.atan2(
      target[1] - (aiming.position[1] + 1.72),
      Math.hypot(dx, dz),
    );
  const mx = origin.x + origin.width / 2,
    my = origin.y + origin.height / 2;
  const ax = (aiming.yaw - yaw) / 0.002,
    ay = (aiming.pitch - pitch) / 0.002;
  await page.mouse.move(mx + ax, my + ay);
  await page.mouse.down();
  await wait(() => window.__soulHarvester().souls > 0);
  await page.mouse.up();
  assert.equal((await state()).shades, 6);
  console.log("PASS: aiming at and releasing a real shade");
  await page.keyboard.press("KeyR");
  await wait(
    () =>
      window.__soulHarvester().ammo === 8 &&
      !window.__soulHarvester().reloading,
  );
  await page.mouse.move(mx, my);
  await page.waitForTimeout(150);
  // Walk into the real closed gate; the collider must stop the player, not just a unit fixture.
  await page.keyboard.down("ShiftLeft");
  await page.keyboard.down("KeyW");
  await wait(() => window.__soulHarvester().position[2] < -21.2);
  await page.waitForTimeout(800);
  await page.keyboard.up("KeyW");
  await page.keyboard.up("ShiftLeft");
  const gate = await state();
  assert.ok(gate.position[2] >= -21.4, `gate penetration: ${gate.position[2]}`);
  assert.ok(Math.abs(gate.position[0]) < 2);
  console.log("PASS: collision against the actual fortress gate");
  await page.keyboard.press("KeyE");
  await page.waitForTimeout(150);
  assert.match(await page.locator("#toast").textContent(), /Keep answers/);
  console.log("PASS: bell interaction");
  await page.keyboard.press("Escape");
  await wait(() => !window.__soulHarvester().active);
  const paused = await state();
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(250);
  await page.keyboard.up("KeyW");
  assert.deepEqual((await state()).position, paused.position);
  assert.equal(
    await page.locator("#enter-label").textContent(),
    "RETURN TO THE KEEP",
  );
  await page.locator("#enter").click();
  await wait(() => window.__soulHarvester().active);
  console.log("PASS: pause freezes player; resume captures mouse again");
  await page.keyboard.press("Escape");
  await wait(() => !window.__soulHarvester().active);
  await page.locator("#sound").click();
  assert.equal(await page.locator("#sound-state").textContent(), "ON");
  await page.locator("#sound").click();
  assert.equal(await page.locator("#sound-state").textContent(), "OFF");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/courtyard-mobile.png" });
  assert.equal(await page.locator("#enter").isVisible(), true);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  console.log("PASS: sound toggle and narrow-screen menu");
  assert.deepEqual(errors, []);
  console.log("PASS: no uncaught browser errors");
  console.log("Diagnostics:", await state());
} catch (error) {
  console.error("Failure state:", await state());
  await page.screenshot({ path: "artifacts/browser-failure.png" });
  throw error;
} finally {
  await browser.close();
}
