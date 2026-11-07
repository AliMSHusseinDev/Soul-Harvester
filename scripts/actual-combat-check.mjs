import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

// Real production entry, real pointer input and confirmed damage; no fixture entities.
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
    viewport: { width: 960, height: 540 },
    deviceScaleFactor: 1,
  }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const state = () => page.evaluate(() => window.__soulHarvester());
const wait = (p) => page.waitForFunction(p, undefined, { timeout: 120000 });
let mx = 0,
  my = 0;
async function aim(x, y, z) {
  const s = await state(),
    dx = x - s.position[0],
    dz = z - s.position[2],
    yaw = Math.atan2(-dx, -dz),
    pitch = Math.atan2(y - s.position[1] - 1.72, Math.hypot(dx, dz));
  mx += (s.yaw - yaw) / 0.002;
  my += (s.pitch - pitch) / 0.002;
  await page.mouse.move(mx, my);
}
async function fireAt(e, head) {
  await aim(e.x, head ? 1.4 : 0.95, e.z);
  const before = await state();
  await page.mouse.down();
  await page.waitForFunction(
    (n) => window.__soulHarvester().ammo < n,
    before.ammo,
    { timeout: 15000 },
  );
  await page.mouse.up();
}
try {
  await page.goto(process.env.GAME_URL || "http://127.0.0.1:4181/");
  await wait(() => window.__soulHarvester?.().ready);
  await page.locator("#loading").waitFor({ state: "detached" });
  const r = await page.locator("#enter").boundingBox();
  mx = r.x + r.width / 2;
  my = r.y + r.height / 2;
  await page.locator("#enter").click();
  await wait(() => window.__soulHarvester().active);
  assert.deepEqual(
    (await state()).lootRender.combatSprites.installed.slice().sort(),
    ["critical", "death", "normal"],
  );
  console.log("Original atlases loaded in the production game");
  await page.evaluate(() => {
    const c = (window.__combatCapture = { phase: "far", images: {}, seen: {} });
    const sample = () => {
      const s = window.__soulHarvester(),
        h = s.hitFeedback.lastBulletHit;
      if (h) {
        const kind = h.killed ? "death" : h.critical ? "critical" : "normal",
          key = c.phase + "-" + kind,
          b = s.lootRender.combatSprites.frames.find((b) => b.kind === kind);
        if (b) {
          (c.seen[key] ??= []).push(b.frame);
          if (!c.images[key] && b.age >= 0.065 && b.age < 0.22)
            c.images[key] = {
              data: document.querySelector("#world").toDataURL("image/png"),
              sample: {
                version: s.version,
                hit: h,
                burst: b,
                render: s.lootRender.combatSprites,
                legacyFlashes: s.lootRender.flashes,
                position: s.position,
              },
            };
        }
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.keyboard.press("KeyE");
  await page.keyboard.press("Digit3");
  await wait(() => window.__soulHarvester().enemies.length >= 5);
  await page.mouse.down({ button: "right" });
  await wait(() => window.__soulHarvester().aimAmount > 0.999);
  const far = (await state()).enemies
    .slice()
    .sort((a, b) => Math.abs(a.x) - Math.abs(b.x))[0];
  await fireAt(far, false);
  console.log("Actual distant bullet fired; walking over the bridge");
  await page.mouse.up({ button: "right" });
  const s = await state();
  await aim(0, s.position[1] + 1.72, -65);
  await page.keyboard.down("ShiftLeft");
  await page.keyboard.down("KeyW");
  await wait(() => window.__soulHarvester().position[2] < -33);
  await page.keyboard.up("KeyW");
  await page.keyboard.up("ShiftLeft");
  console.log("Reached battlefield", (await state()).position);
  await page.evaluate(() => (window.__combatCapture.phase = "near"));
  await page.mouse.down({ button: "right" });
  await wait(() => window.__soulHarvester().aimAmount > 0.999);
  for (const [kind, head] of [
    ["normal", false],
    ["critical", true],
    ["death", false],
  ]) {
    for (let attempt = 0; attempt < 12; attempt++) {
      if (
        await page.evaluate(
          (key) => !!window.__combatCapture.images[key],
          "near-" + kind,
        )
      )
        break;
      const now = await state();
      if (!now.ammo) {
        await page.keyboard.press("KeyR");
        await wait(
          () =>
            !window.__soulHarvester().reloading &&
            window.__soulHarvester().ammo > 0,
        );
      }
      const current = await state();
      const targets = current.enemies
        .slice()
        .sort(
          (a, b) =>
            Math.hypot(a.x - current.position[0], a.z - current.position[2]) -
            Math.hypot(b.x - current.position[0], b.z - current.position[2]),
        );
      const target =
        kind === "critical"
          ? (targets.find((e) => e.hp > 30) ?? targets[0])
          : targets[0];
      assert.ok(target, "A real surviving enemy is available");
      await fireAt(target, head);
      // Let the authored expansion reach its visible peak before the next shot.
      await page.waitForFunction(
        ({ time }) => window.__soulHarvester().simulationTime > time + 0.18,
        { time: (await state()).simulationTime },
        { timeout: 15000 },
      );
    }
    assert.ok(
      await page.evaluate(
        (key) => !!window.__combatCapture.images[key],
        "near-" + kind,
      ),
      `${kind} captured from actual damage`,
    );
    console.log(`Captured real ${kind} damage with original art`);
  }
  const capture = await page.evaluate(() => window.__combatCapture),
    report = {};
  for (const [key, image] of Object.entries(capture.images)) {
    await writeFile(
      `artifacts/actual-combat-${key}.png`,
      Buffer.from(image.data.split(",")[1], "base64"),
    );
    report[key] = image.sample;
    if (key.startsWith("near-")) {
      assert.equal(image.sample.legacyFlashes, 0);
      assert.ok(
        new Set(capture.seen[key]).size >= 2,
        "Authored frames actually advance",
      );
      assert.ok(image.sample.render.rendered[key.slice(5)] > 0);
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(
    "artifacts/actual-combat-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  console.log(
    "PASS: original sheets visible on real normal, critical and lethal bullet damage; independent animation frames and no legacy substitutes.",
  );
} finally {
  await browser.close();
}
