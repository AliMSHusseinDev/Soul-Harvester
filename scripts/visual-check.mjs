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
  }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const state = () => page.evaluate(() => window.__soulHarvester());
const frame = () =>
  page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
try {
  await page.goto(process.env.GAME_URL || "http://127.0.0.1:4180/");
  await page.waitForFunction(() => window.__soulHarvester?.().ready);
  const tiles = (await state()).surfaces;
  assert.equal(tiles.length, 19); // The removed landmark's separate canopy tile is no longer loaded.
  assert.ok(
    tiles.some((t) => t.name === "pine") &&
      tiles.some((t) => t.name === "bark"),
  );
  assert.ok(
    tiles.every(
      (t) =>
        [32, 64].includes(t.width) && [32, 64].includes(t.height) && t.nearest,
    ),
  );
  await page.locator("#loading").waitFor({ state: "detached" });
  const bounds = await page.locator("#enter").boundingBox();
  let mx = bounds.x + bounds.width / 2,
    my = bounds.y + bounds.height / 2;
  await page.locator("#enter").click();
  await page.waitForFunction(() => window.__soulHarvester().active);
  await frame();
  await page.screenshot({ path: "artifacts/visual-forest.png" });
  await page.keyboard.press("Digit1");
  await frame();
  await page.screenshot({ path: "artifacts/visual-dagger.png" });
  await page.keyboard.press("Digit3");
  await frame();
  await page.mouse.down({ button: "right" });
  await page.waitForFunction(() => window.__soulHarvester().aimAmount > 0.999);
  for (const p of (await state()).sightProjection) {
    assert.ok(Math.abs(p[0]) < 0.015 && Math.abs(p[1]) < 0.015);
  }
  await page.screenshot({ path: "artifacts/visual-rifle-ads.png" });
  await page.mouse.up({ button: "right" });
  await frame();
  await page.keyboard.down("KeyW");
  await page.keyboard.down("ShiftLeft");
  await page.waitForFunction(() => window.__soulHarvester().sprinting);
  const sprintStart = (await state()).simulationTime;
  await page.waitForFunction(
    (start) => window.__soulHarvester().simulationTime > start + 0.35,
    sprintStart,
  );
  await page.screenshot({ path: "artifacts/visual-sprint.png" });
  await page.keyboard.up("ShiftLeft");
  await page.keyboard.up("KeyW");
  await page.waitForFunction(() => window.__soulHarvester().fireReady);
  await page.addStyleTag({ content: "#hud{visibility:hidden}" });
  for (const [i, yaw] of [0, Math.PI / 2, Math.PI, -Math.PI / 2].entries()) {
    const s = await state();
    mx += (s.yaw - yaw) / 0.002;
    my += (s.pitch - 1.05) / 0.002;
    await page.mouse.move(mx, my);
    await frame();
    assert.ok(Math.abs((await state()).pitch - 1.05) < 0.01);
    await page.screenshot({ path: `artifacts/sky-direction-${i}.png` });
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: pixel forest/weapon/dagger/sprint screenshots, rifle ADS alignment and sky in all four directions; no renderer errors",
  );
  console.log("Visual diagnostics:", {
    version: (await state()).version,
    memory: (await state()).memory,
    drawCalls: (await state()).drawCalls,
  });
} finally {
  await browser.close();
}
