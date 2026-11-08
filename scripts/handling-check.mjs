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
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const state = () => page.evaluate(() => window.__soulHarvester());
const wait = (p) => page.waitForFunction(p, undefined, { timeout: 90000 });
try {
  await page.goto(process.env.GAME_URL || "http://127.0.0.1:4180/");
  await wait(() => window.__soulHarvester?.().ready);
  await page.locator("#loading").waitFor({ state: "detached" });
  await page.locator("#enter").click();
  await wait(() => window.__soulHarvester().active);
  await page.keyboard.down("KeyW");
  await page.keyboard.down("ShiftLeft");
  await wait(() => window.__soulHarvester().stamina === 0);
  assert.equal(
    await page
      .locator("#stamina")
      .evaluate((el) => el.getBoundingClientRect().width),
    0,
  );
  await page.keyboard.up("ShiftLeft");
  await page.keyboard.up("KeyW");
  await wait(
    () =>
      window.__soulHarvester().stamina > 0.35 &&
      window.__soulHarvester().fireReady,
  );
  console.log(
    "PASS: sprint fully depletes stamina and the rendered fill reaches exact zero",
  );
  const checks = async () =>
    page.evaluate(() => {
      const c = document.querySelector("#crosshair"),
        r = c.getBoundingClientRect();
      return {
        x: r.x,
        y: r.y,
        count: c.children.length,
        dashes: [...c.children].map((e) => {
          const r = e.getBoundingClientRect(),
            s = getComputedStyle(e);
          return { w: r.width, h: r.height, color: s.backgroundColor };
        }),
      };
    });
  let c = await checks();
  assert.equal(c.count, 4);
  assert.equal(c.x, 640);
  assert.equal(c.y, 360);
  assert.ok(
    c.dashes.every(
      (d) =>
        Math.min(d.w, d.h) === 2 &&
        Math.max(d.w, d.h) >= 8 &&
        d.color === "rgb(255, 255, 255)",
    ),
  );
  const gap720 = (await state()).crosshairGap;
  await page.screenshot({ path: "artifacts/handling-720p.png" });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await wait(
    () =>
      Math.abs(
        document.querySelector("#crosshair").getBoundingClientRect().x - 960,
      ) < 1,
  );
  c = await checks();
  assert.equal(c.x, 960);
  assert.equal(c.y, 540);
  assert.ok(Math.abs((await state()).crosshairGap / gap720 - 1.5) < 0.15);
  await page.screenshot({ path: "artifacts/handling-1080p.png" });
  await page.setViewportSize({ width: 800, height: 500 });
  await wait(
    () =>
      document.querySelector("#crosshair").getBoundingClientRect().x === 400,
  );
  console.log(
    "PASS: centered four white 2px dashes at 720p / 1080p; gap projects actual accuracy",
  );
  const standing = (await state()).spreadAngle;
  await page.keyboard.down("KeyC");
  await wait(
    () =>
      window.__soulHarvester().crouching &&
      window.__soulHarvester().cameraHeight < 1.3 &&
      window.__soulHarvester().spreadAngle < 0.012,
  );
  assert.ok((await state()).spreadAngle < standing * 0.9);
  await page.keyboard.up("KeyC");
  await page.keyboard.down("Space");
  await wait(
    () =>
      !window.__soulHarvester().grounded &&
      window.__soulHarvester().spreadAngle > 0.025,
  );
  await page.keyboard.up("Space");
  await wait(() => window.__soulHarvester().grounded);
  console.log(
    "PASS: crouch tightens actual spread and lowers stance; jumping expands it",
  );
  await page.keyboard.down("KeyW");
  await page.keyboard.down("ShiftLeft");
  await wait(() => window.__soulHarvester().sprinting);
  await wait(
    () =>
      Number(getComputedStyle(document.querySelector("#crosshair")).opacity) >=
        0.8 && window.__soulHarvester().crosshairGap >= 22,
  );
  const ammo = (await state()).ammo;
  await page.keyboard.down("Space");
  await wait(
    () =>
      !window.__soulHarvester().grounded &&
      window.__soulHarvester().weaponPose === "SprintAirborne",
  );
  assert.equal((await state()).fireReady, false);
  await page.screenshot({ path: "artifacts/handling-sprint-air.png" });
  await page.keyboard.up("Space");
  await wait(() => window.__soulHarvester().grounded);
  await page.screenshot({ path: "artifacts/handling-sprint.png" });
  await page.mouse.click(400, 250);
  await wait(() => window.__soulHarvester().ammo < 30);
  const fired = await state();
  assert.equal(fired.ammo, ammo - 1);
  assert.ok(fired.lastShotAt - fired.lastSprintExit >= 0.225 - 1e-7);
  await page.keyboard.up("ShiftLeft");
  await page.keyboard.up("KeyW");
  await wait(() => window.__soulHarvester().fireReady);
  assert.equal((await state()).ammo, ammo - 1);
  console.log(
    "PASS: sprint keeps a visible expanded crosshair; one buffered tap fires once after the full .225s sprint-out",
  );
  await page.keyboard.down("KeyW");
  await page.keyboard.down("ShiftLeft");
  await wait(() => window.__soulHarvester().sprinting);
  await page.mouse.down({ button: "right" });
  await wait(() => window.__soulHarvester().aimAmount > 0.999);
  const aim = await state();
  assert.equal(aim.sprinting, false);
  assert.ok(aim.fireReady);
  await page.mouse.up({ button: "right" });
  await page.keyboard.up("KeyW");
  await page.keyboard.up("ShiftLeft");
  await page.keyboard.press("KeyV");
  await wait(() => window.__soulHarvester().meleeActive);
  await wait(() => !window.__soulHarvester().meleeActive);
  await page.evaluate(() => {
    window.__gunChecks = { smoke: 0, tracers: 0 };
    const tick = () => {
      const s = window.__soulHarvester();
      window.__gunChecks.smoke = Math.max(
        window.__gunChecks.smoke,
        s.gunVFX.smoke,
      );
      window.__gunChecks.tracers = Math.max(
        window.__gunChecks.tracers,
        s.gunVFX.tracers,
      );
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await wait(() => window.__soulHarvester().fireReady);
  await page.mouse.down();
  await wait(() => window.__soulHarvester().ammo < 20);
  await page.mouse.up();
  await wait(() => window.__soulHarvester().gunVFX.smoke > 0);
  await page.screenshot({ path: "artifacts/handling-smoke.png" });
  await wait(
    () =>
      window.__soulHarvester().gunVFX.smoke === 0 &&
      window.__soulHarvester().gunVFX.heat === 0,
  );
  const g = await page.evaluate(() => window.__gunChecks);
  assert.ok(g.smoke > 0 && g.smoke <= 96 && g.tracers > 0);
  assert.equal((await state()).removedTreeCollider, false);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: ADS exits sprint; sustained shots emit bounded world-space smoke/tracers that clear; removed tree has no collider; no renderer errors",
  );
} catch (error) {
  await page.screenshot({ path: "artifacts/handling-failure.png" });
  console.error("Failure:", await state());
  throw error;
} finally {
  await browser.close();
}
