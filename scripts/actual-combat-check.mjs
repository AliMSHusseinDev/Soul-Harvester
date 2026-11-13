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
  await page.addInitScript(() =>
    localStorage.setItem(
      "soul-harvester.developer.v1",
      JSON.stringify({
        version: 1,
        tuning: { "effects.splatterLifeMin": 100 },
        objects: [],
        brushes: [],
      }),
    ),
  );
  await page.goto(process.env.GAME_URL || "http://127.0.0.1:4181/");
  await wait(() => window.__soulHarvester?.().ready);
  assert.equal(await page.locator("#developer-button").count(), 0);
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem("soul-harvester.developer.v1"),
    ),
    null,
  );
  console.log("Developer UI absent and old saved overrides cleared");
  await page.locator("#loading").waitFor({ state: "detached" });
  const r = await page.locator("#enter").boundingBox();
  mx = r.x + r.width / 2;
  my = r.y + r.height / 2;
  await page.locator("#enter").click();
  await wait(() => window.__soulHarvester().active);
  assert.equal((await state()).lootRender.procedural.mode, "procedural");
  assert.equal((await state()).lootRender.procedural.textures, 0);
  console.log("Texture-free procedural feedback active in the production game");
  await page.evaluate(() => {
    const canvas = document.querySelector("#world"),
      gl = canvas.getContext("webgl2"),
      sampleWidth = Math.min(120, canvas.width),
      sampleHeight = Math.min(90, Math.floor(canvas.height / 2) - 10),
      pixels = new Uint8Array(sampleWidth * sampleHeight * 4);
    const c = (window.__combatCapture = { phase: "far", images: {}, seen: {} });
    const sample = () => {
      const s = window.__soulHarvester(),
        h = s.hitFeedback.lastBulletHit;
      if (h) {
        const kind = h.killed ? "death" : h.critical ? "critical" : "normal",
          key = c.phase + "-" + kind,
          b = { age: s.simulationTime - h.time, kind };
        if (b) {
          (c.seen[key] ??= []).push(b.age);
          const captureAfter = kind === "death" ? 0.16 : 0.025;
          if (
            !c.images[key] &&
            b.age >= captureAfter &&
            b.age < (kind === "death" ? 0.5 : 0.32)
          ) {
            gl.readPixels(
              Math.floor((canvas.width - sampleWidth) / 2),
              // A lethal body hit lands below the sight. Ordinary/head hits
              // are sampled above it, excluding the golden weapon itself.
              Math.floor(canvas.height / 2) +
                (kind === "death" ? -sampleHeight : -12),
              sampleWidth,
              sampleHeight,
              gl.RGBA,
              gl.UNSIGNED_BYTE,
              pixels,
            );
            const visiblePixels = { gold: 0, white: 0, red: 0 };
            for (let i = 0; i < pixels.length; i += 4) {
              const r = pixels[i],
                g = pixels[i + 1],
                b = pixels[i + 2];
              if (r > 235 && g > 170 && b < g * 0.75 && r > g * 1.02)
                visiblePixels.gold++;
              if (r > 230 && g > 230 && b > 220) visiblePixels.white++;
              // Red-dominant masks cover both requested splatter colors; the ROI excludes the rifle.
              if (r > 65 && r > g * 1.6 && r > b * 1.3) visiblePixels.red++;
            }
            c.images[key] = {
              data: document.querySelector("#world").toDataURL("image/png"),
              sample: {
                version: s.version,
                hit: h,
                burst: b,
                render: s.lootRender.procedural,
                legacyFlashes: s.lootRender.flashes,
                chunks: s.lootRender.shards,
                numbers: s.lootRender.numbers,
                visiblePixels,
                position: s.position,
              },
            };
          }
        }
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  const groundBefore = await state();
  await aim(3, 4, 14);
  await page.mouse.down();
  await page.waitForFunction(
    (ammo) => window.__soulHarvester().ammo < ammo,
    groundBefore.ammo,
  );
  await page.mouse.up();
  await wait(() => window.__soulHarvester().lastWorldHit?.surface === "earth");
  assert.ok((await state()).lootRender.surfaces.active > 0);
  await page.screenshot({ path: "artifacts/actual-ground-impact.png" });
  console.log(
    "Real ground hit created surface debris and a pooled bullet scar",
  );
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
    console.log(`Captured real ${kind} damage with procedural shaders`);
    const numberState = (await state()).lootRender.numbers;
    assert.ok(
      numberState.some((n) => n.visible),
      "real damage creates readable screen-space text",
    );
    for (const n of numberState.filter((n) => n.visible))
      assert.ok(
        n.offsetY <= -42 && n.worldY >= n.floor + 0.35 - 1e-6 && n.y >= 12,
        "real labels stay above the floor",
      );
    await page.screenshot({ path: `artifacts/actual-ui-${kind}.png` });
  }
  const capture = await page.evaluate(() => window.__combatCapture),
    report = {};
  for (const [key, image] of Object.entries(capture.images)) {
    await writeFile(
      `artifacts/actual-combat-${key}.png`,
      Buffer.from(image.data.split(",")[1], "base64"),
    );
    report[key] = image.sample;
  }
  await writeFile(
    "artifacts/actual-combat-report.json",
    JSON.stringify(report, null, 2),
  );
  for (const [key, image] of Object.entries(capture.images)) {
    await writeFile(
      `artifacts/actual-combat-${key}.png`,
      Buffer.from(image.data.split(",")[1], "base64"),
    );
    report[key] = image.sample;
    if (key.startsWith("near-")) {
      assert.equal(image.sample.legacyFlashes, 0);
      assert.equal(image.sample.render.textures, 0);
      const p = image.sample.visiblePixels;
      console.log(key, p);
      if (key === "near-normal")
        assert.ok(
          p.gold >= 8,
          "bright procedural gold pixels must be visible around the sight",
        );
      if (key === "near-critical")
        assert.ok(
          p.white >= 4 || p.gold >= 8,
          "procedural critical core or ring reaches the framebuffer",
        );
      if (key === "near-death")
        assert.ok(
          p.red >= 8,
          "red chunks remain visible after the brief actor flash ends",
        );
      assert.ok(image.sample.render.rendered > 0);
    }
  }
  await page.mouse.up({ button: "right" });
  await page.waitForFunction(
    () => window.__soulHarvester().lootRender.procedural.events.hurt > 0,
    undefined,
    { timeout: 60000 },
  );
  console.log("Real incoming damage confirmed");
  await page.screenshot({ path: "artifacts/actual-player-hurt.png" });
  await page.keyboard.press("KeyF");
  await wait(
    () => window.__soulHarvester().lootRender.procedural.events.nova > 0,
  );
  console.log("Real nova confirmed");
  await page.screenshot({ path: "artifacts/actual-nova.png" });
  await page.keyboard.press("KeyQ");
  await wait(
    () => window.__soulHarvester().lootRender.procedural.events.cast >= 2,
  );
  await page.screenshot({ path: "artifacts/actual-orb-cast.png" });
  const finalState = await state();
  await writeFile(
    "artifacts/actual-procedural-events.json",
    JSON.stringify(finalState.lootRender, null, 2),
  );
  assert.deepEqual(errors, []);
  await writeFile(
    "artifacts/actual-combat-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  console.log(
    "PASS: procedural sparks, critical cores and red chunks visible on real normal, critical and lethal bullet damage; no particle textures.",
  );
} finally {
  await browser.close();
}
