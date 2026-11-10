import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: [
    "--no-sandbox",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--disable-dev-shm-usage",
  ],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const state = () => page.evaluate(() => window.__soulHarvester());
const project = () =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("soul-harvester.developer.v1")),
  );
const ready = async () => {
  await page.waitForFunction(
    () => window.__soulHarvester?.().ready,
    undefined,
    { timeout: 120000 },
  );
  await page
    .locator("#loading")
    .waitFor({ state: "detached", timeout: 120000 });
};
try {
  await page.goto("http://127.0.0.1:4181/");
  await ready();
  const initialColliders = (await state()).colliders;
  await page
    .getByRole("button", { name: "Developer Button", exact: true })
    .click();
  await page.locator("#developer-panel").waitFor({ state: "visible" });
  assert.equal((await state()).developer.enabled, true);
  assert.equal((await state()).active, false);
  await page.getByRole("button", { name: "Effects", exact: true }).click();
  const field = page.getByLabel("effects › splatter Launch Gain", {
    exact: true,
  });
  await field.fill("0.7");
  await field.press("Tab");
  await page.waitForTimeout(600);
  assert.equal((await project()).tuning["effects.splatterLaunchGain"], 0.7);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.waitForTimeout(500);
  assert.equal(
    (await project()).tuning["effects.splatterLaunchGain"],
    undefined,
  );
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.waitForTimeout(500);
  assert.equal((await project()).tuning["effects.splatterLaunchGain"], 0.7);
  await page
    .getByRole("button", { name: "Preview Death", exact: true })
    .click();
  console.log("Live tuning, history and preview passed");
  await page.getByRole("button", { name: "Map Design", exact: true }).click();
  await page.getByLabel("Tool", { exact: true }).selectOption("build");
  await page.screenshot({ path: "artifacts/developer-map.png" });
  await page.getByRole("button", { name: "Resume / F1", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.pointerLockElement !== null &&
      window.__soulHarvester().developer.captured,
  );
  const before = (await state()).camera;
  await page.keyboard.down("Space");
  await page.waitForTimeout(250);
  await page.keyboard.up("Space");
  await page.keyboard.press("AltLeft");
  assert.equal((await state()).developer.flying, false);
  await page.keyboard.press("AltLeft");
  assert.equal((await state()).developer.flying, true);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(1000);
  assert.equal((await state()).developer.objects, 1);
  await page.keyboard.press("F1");
  await page.locator("#developer-panel").waitFor({ state: "visible" });
  const built = await project();
  assert.equal(built.objects.length, 1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.waitForTimeout(500);
  assert.equal((await project()).objects.length, 0);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.waitForTimeout(500);
  assert.equal((await project()).objects.length, 1);
  await page.getByRole("button", { name: "Graphics", exact: true }).click();
  await page.getByLabel("fog", { exact: true }).fill("#30483e");
  await page.getByLabel("fog", { exact: true }).dispatchEvent("change");
  await page.waitForTimeout(500);
  assert.equal((await project()).graphics.fog, "#30483e");
  await page.screenshot({ path: "artifacts/developer-graphics.png" });
  await page.getByRole("button", { name: "Terrain", exact: true }).click();
  await page.getByLabel("Tool", { exact: true }).selectOption("raise");
  await page.getByRole("button", { name: "Resume / F1", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.pointerLockElement !== null &&
      window.__soulHarvester().developer.captured,
  );
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(1000);
  await page.keyboard.press("F1");
  await page.waitForTimeout(300);
  assert.equal((await project()).brushes.length, 1);
  await page.screenshot({ path: "artifacts/developer-terrain.png" });
  await page.getByRole("button", { name: "Game Tuning", exact: true }).click();
  const waveLimit = page.getByLabel("waves › wave Limit", { exact: true });
  await waveLimit.fill("3");
  await waveLimit.press("Tab");
  await page.waitForTimeout(500);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON", exact: true }).click();
  const download = await downloadPromise;
  await download.saveAs("artifacts/developer-export.json");
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import JSON", exact: true }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":99}'),
  });
  await page.waitForTimeout(300);
  assert.equal((await project()).version, 1);
  assert.ok(
    (await page.locator("#developer-panel header").textContent()).includes(
      "Unsupported project version",
    ),
  );
  await page.reload();
  await ready();
  assert.equal((await project()).objects.length, 1);
  assert.equal((await project()).brushes.length, 1);
  assert.equal((await state()).colliders, initialColliders + 1);
  assert.equal((await state()).waveLimit, 3);
  assert.equal((await state()).developer.enabled, false);
  await page
    .getByRole("button", { name: "Developer Button", exact: true })
    .click();
  assert.equal((await state()).developer.objects, 1);
  await page.getByRole("button", { name: "Effects", exact: true }).click();
  await page.screenshot({ path: "artifacts/developer-effects.png" });
  assert.deepEqual(errors, []);
  await writeFile(
    "artifacts/developer-report.json",
    JSON.stringify(
      { state: await state(), project: await project(), errors },
      null,
      2,
    ),
  );
  console.log(
    "PASS: developer entry, paused gameplay, live tuning, undo/redo, effect preview, Left Alt/F1, actual map placement, world colors and persisted reload.",
  );
} catch (e) {
  console.log(errors, await state());
  await page.screenshot({ path: "artifacts/developer-failure.png" });
  throw e;
} finally {
  await browser.close();
}
