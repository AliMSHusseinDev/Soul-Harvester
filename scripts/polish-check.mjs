import { createServer } from "vite";
import { chromium } from "playwright";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
await mkdir("artifacts", { recursive: true });
const html = (await readFile("index.html", "utf8")).replace(
  '<script type="module" src="/src/main.ts"></script>',
  '<link rel="stylesheet" href="/src/style.css"><link rel="stylesheet" href="/node_modules/@fontsource/pixelify-sans/latin-600.css">',
);
const server = await createServer({
  configFile: false,
  root: process.cwd(),
  server: { host: "127.0.0.1", port: 5190, strictPort: true },
  plugins: [
    {
      name: "presentation-fixture",
      configureServer(s) {
        s.middlewares.use((req, res, next) => {
          if (req.url?.split("?")[0] !== "/fixture.html") return next();
          res.setHeader("Content-Type", "text/html");
          res.end(html);
        });
      },
    },
  ],
});
await server.listen();
let browser;
try {
  browser = await chromium.launch({
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
      viewport: { width: 800, height: 600 },
      deviceScaleFactor: 1,
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("http://127.0.0.1:5190/fixture.html");
  await page.evaluate(async () => {
    const [
      T,
      { Battle },
      { Effects },
      { Enemies },
      { Weapon },
      { UI },
      { surface },
      { guardAtlas, GUARD_FRAMES },
    ] = await Promise.all([
      import("/node_modules/three/build/three.module.js"),
      import("/src/game/battle.ts"),
      import("/src/game/effects.ts"),
      import("/src/game/enemies.ts"),
      import("/src/game/weapon.ts"),
      import("/src/game/ui.ts"),
      import("/src/game/surfaces.ts"),
      import("/src/game/textures.ts"),
    ]);
    await document.fonts.ready;
    document.querySelector("#loading")?.remove();
    document.querySelector("#menu").classList.add("hidden");
    document.querySelector("#hud").classList.remove("hidden");
    document.body.classList.add("playing");
    const renderer = new T.WebGLRenderer({
      canvas: document.querySelector("#world"),
      antialias: false,
    });
    renderer.setSize(800, 600);
    renderer.setPixelRatio(1);
    renderer.autoClear = false;
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.16;
    const scene = new T.Scene(),
      view = new T.Scene(),
      camera = new T.PerspectiveCamera(62, 800 / 600, 0.06, 80);
    scene.background = new T.Color(0x173b3b);
    scene.add(new T.HemisphereLight(0xaad6d8, 0x253522, 2));
    const floor = new T.Mesh(
      new T.PlaneGeometry(25, 25).rotateX(-Math.PI / 2),
      new T.MeshStandardMaterial({ map: surface("grass"), roughness: 1 }),
    );
    floor.position.z = -35;
    scene.add(floor);
    camera.position.set(0, 1.72, -33);
    camera.lookAt(0, 1.72, -39);
    view.add(camera);
    view.add(new T.HemisphereLight(0xcde6e4, 0x31483b, 1.3));
    const key = new T.DirectionalLight(0xffe2bb, 1.8);
    key.position.set(-2, 3, 2);
    view.add(key);
    const b = new Battle([]),
      v = new Effects(scene, b, camera),
      en = new Enemies(scene, b),
      w = new Weapon(camera),
      ui = new UI(b, w, () => {});
    const player = { x: 0, z: -33, y: 0 },
      f = { freeze: true, time: 0, b, v, en, w, ui };
    window.__polish = f;
    Object.assign(b.enemies[0], {
      active: true,
      x: -0.75,
      z: -39,
      hp: 200,
      maxHp: 200,
      spawnAge: 1,
      speedFactor: 0,
    });
    let alpha = true;
    for (let kind = 0; kind < 4; kind++) {
      const c = guardAtlas(kind).image,
        d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      for (let frame = 1; frame < GUARD_FRAMES; frame++)
        for (let y = 0; y < 40; y++)
          for (let x = 0; x < 32; x++)
            if (
              d[(y * c.width + x) * 4 + 3] !==
              d[(y * c.width + x + frame * 32) * 4 + 3]
            )
              alpha = false;
    }
    f.alphaPreserved = alpha;
    const drain = () => {
      let gold = 0,
        xp = 0;
      for (const e of b.events) {
        if (e.kind === "hit") {
          v.number(e.x, e.z, e.value, e.y, e.critical);
          v.impact(e.x, e.y ?? 1, e.z, e.critical, e.bullet === true);
        } else if (e.kind === "kill") v.death(e.x, e.z, e.value);
        else if (e.kind === "gold" || e.kind === "xp") {
          v.pickup(e.kind, e.x, e.z, e.y);
          if (e.kind === "gold") gold += e.value;
          else xp += e.value;
        } else if (e.kind === "level") {
          ui.levelUp(e.value);
          v.levelUp(player.x, player.z);
        }
      }
      if (gold) ui.pickup("gold", gold);
      if (xp) ui.pickup("xp", xp);
      b.events.length = 0;
    };
    f.hit = () => {
      b.damageEnemy(0, 19, player, 2, {
        x: -0.75,
        y: 1.1,
        z: -38.96,
        bullet: true,
      });
    };
    f.numbers = () => {
      b.events.length = 0;
      b.enemies[0].hitFlash = 0;
      b.enemies[0].reaction = 0;
      v.number(-1.2, -38.85, 19, 1.75, false);
      v.number(-0.1, -38.85, 28.5, 2.1, true);
      v.impact(-0.75, 1.1, -38.96, true, true);
      v.step(0.12, 0.12);
    };
    f.cast = () => {
      w.cast();
      w.update(0.15, f.time, 0, false);
      v.cast(w.castOrigin(), true);
    };
    f.impact = () => {
      v.impact(0, 2.5, -36, false, true);
      v.step(0.025, 0.145);
    };
    f.loot = () => {
      b.reset();
      v.reset();
      ui.reset();
      for (let i = 0; i < 40; i++) {
        const e = b.enemies[i],
          a = i * 2.39996;
        Object.assign(e, {
          active: true,
          kind: i % 4,
          wave: 1,
          x: Math.cos(a) * (0.5 + i / 100),
          z: -34 + Math.sin(a) * (0.5 + i / 100),
          hp: 1,
          maxHp: 1,
          spawnAge: 1,
        });
        b.damageEnemy(i, 10, player, 0);
      }
      drain();
      f.freeze = false;
    };
    f.bounds = () => {
      camera.updateMatrixWorld();
      const e = b.enemies[0],
        toPixel = (x, y) => {
          const p = new T.Vector3(x, y, e.z + 0.04).project(camera);
          return [(p.x * 0.5 + 0.5) * 800, (-p.y * 0.5 + 0.5) * 600];
        };
      return {
        topLeft: toPixel(e.x - 0.625, 1.65),
        bottomRight: toPixel(e.x + 0.625, 0),
      };
    };
    let last = performance.now();
    const tick = (now) => {
      requestAnimationFrame(tick);
      const dt = f.freeze ? 0 : Math.min((now - last) / 1000, 1 / 30);
      last = now;
      if (dt) {
        f.time += dt;
        b.update(dt, player);
        v.step(dt, f.time);
        drain();
      }
      w.update(0, f.time, 0, false);
      w.present();
      en.update(f.time, 0);
      v.followPlayer(player.x, player.z);
      camera.updateMatrixWorld();
      v.render(f.time);
      ui.update(dt, false);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.clearDepth();
      renderer.render(view, camera);
    };
    requestAnimationFrame(tick);
  });
  const frame = () =>
    page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    );
  await frame();
  assert.equal(await page.evaluate(() => window.__polish.alphaPreserved), true);
  const bounds = await page.evaluate(() => window.__polish.bounds());
  await writeFile("artifacts/polish-bounds.json", JSON.stringify(bounds));
  await page.screenshot({ path: "artifacts/polish-body-before.png" });
  await page.evaluate(() => window.__polish.hit());
  await frame();
  await page.screenshot({ path: "artifacts/polish-body-white.png" });
  await page.evaluate(() => window.__polish.numbers());
  await frame();
  const numbers = await page.evaluate(
    () => window.__polish.v.diagnostics().numbers,
  );
  assert.ok(
    numbers.some((n) => n.critical && n.value === 29) &&
      numbers.some((n) => !n.critical && n.value === 19),
  );
  await page.screenshot({ path: "artifacts/polish-critical.png" });
  await page.evaluate(() => window.__polish.impact());
  await frame();
  const impact = await page.evaluate(() => window.__polish.v.diagnostics());
  assert.ok(impact.shards >= 7 && impact.flashes >= 1);
  await page.screenshot({ path: "artifacts/polish-impact.png" });
  await page.evaluate(() => window.__polish.cast());
  await frame();
  assert.equal(await page.evaluate(() => window.__polish.w.casting), true);
  await page.screenshot({ path: "artifacts/polish-cast.png" });
  await page.evaluate(() => window.__polish.loot());
  await page.waitForFunction(
    () =>
      window.__polish.b.level > 1 &&
      window.__polish.b.drops.some((d) => d.active && d.magnet),
    undefined,
    { timeout: 60000 },
  );
  await page.evaluate(() => (window.__polish.freeze = true));
  await frame();
  assert.equal(await page.locator("#combat-banner").textContent(), "LEVEL UP");
  await page.screenshot({ path: "artifacts/polish-loot-stream.png" });
  await page.evaluate(() => (window.__polish.freeze = false));
  await page.waitForFunction(
    () => window.__polish.b.drops.every((d) => !d.active),
    undefined,
    { timeout: 60000 },
  );
  const rewards = await page.evaluate(() => ({
    coins: window.__polish.b.coins,
    level: window.__polish.b.level,
    points: window.__polish.b.points,
    fx: window.__polish.v.diagnostics(),
  }));
  assert.ok(rewards.coins > 40 && rewards.level > 1 && rewards.points > 4);
  assert.ok(rewards.fx.numberTextures <= 64);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: four alpha-preserving sprite frames, white-body capture, normal/critical numbers, open-hand cast, forty-enemy loot stream and real level-up rewards",
  );
  console.log("Presentation fixture rewards:", {
    coins: rewards.coins,
    level: rewards.level,
    points: rewards.points,
  });
} finally {
  if (browser) await browser.close();
  await server.close();
}
