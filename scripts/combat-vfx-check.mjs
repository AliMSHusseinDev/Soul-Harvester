import { createServer } from "vite";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
await mkdir("artifacts", { recursive: true });
const server = await createServer({
  configFile: false,
  root: process.cwd(),
  server: { host: "127.0.0.1", port: 5191, strictPort: true },
  plugins: [
    {
      name: "procedural-fixture",
      configureServer(s) {
        s.middlewares.use((req, res, next) => {
          if (req.url !== "/fixture") return next();
          res.setHeader("Content-Type", "text/html");
          res.end(
            '<html><head><link rel="icon" href="data:,"></head><body style="margin:0"><canvas id="world"></canvas></body></html>',
          );
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
      viewport: { width: 1280, height: 720 },
    }),
    errors = [],
    requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("http://127.0.0.1:5191/fixture");
  await page.evaluate(async () => {
    const T = await import("/node_modules/three/build/three.module.js"),
      { Effects } = await import("/src/game/effects.ts"),
      { Battle } = await import("/src/game/battle.ts");
    const renderer = new T.WebGLRenderer({
      canvas: document.querySelector("canvas"),
      antialias: false,
      preserveDrawingBuffer: true,
    });
    renderer.autoClear = false;
    renderer.info.autoReset = false;
    const scene = new T.Scene(),
      camera = new T.PerspectiveCamera(62, 16 / 9, 0.06, 180);
    scene.background = new T.Color(0x102e2c);
    camera.position.set(0, 2, -27);
    camera.lookAt(0, 1, -35);
    camera.updateMatrixWorld();
    scene.add(new T.HemisphereLight(0xc8efdf, 0x27341e, 2));
    const floor = new T.Mesh(
      new T.PlaneGeometry(80, 80).rotateX(-Math.PI / 2),
      new T.MeshBasicMaterial({ color: 0x163c2d }),
    );
    floor.position.z = -45;
    scene.add(floor);
    const actor = new T.Mesh(
      new T.BoxGeometry(1.25, 1.7, 0.2),
      new T.MeshBasicMaterial({ color: 0x287466 }),
    );
    actor.position.set(0, 0.85, -35);
    scene.add(actor);
    const fx = new Effects(scene, new Battle([]), camera);
    await fx.ready;
    const wall = new T.Mesh(
      new T.BoxGeometry(8, 6, 0.4),
      new T.MeshBasicMaterial({ color: 0x334444 }),
    );
    wall.position.set(0, 2, -32);
    wall.visible = false;
    scene.add(wall);
    const draw = () => {
      camera.updateMatrixWorld();
      fx.render(0);
      renderer.info.reset();
      renderer.clear();
      renderer.render(scene, camera);
      renderer.render(fx.impactScene, camera);
      renderer.render(fx.screenScene, camera);
    };
    window.fixture = {
      fx,
      renderer,
      camera,
      scene,
      draw,
      show(event, age, width, height, reduced = false) {
        fx.reset();
        actor.visible = ![
          "death",
          "death-smoke",
          "weighted-flight",
          "weighted-late",
          "death-left",
          "death-right",
          "debris-fall",
          "debris-bounce",
          "debris-hold",
          "debris-fade",
          "remnant-flash",
          "remnant-burgundy",
          "remnant-late",
          "magic-death",
          "finisher",
          "near",
        ].includes(event);
        camera.position.set(0, 2, event.startsWith("weighted-") ? -18 : -27);
        camera.lookAt(0, 1, -35);
        fx.reduced = reduced;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
        wall.visible = false;
        fx.visibility.rebuild([]);
        if (
          event === "hit" ||
          event === "critical" ||
          event === "critical-echo" ||
          event === "hit-smoke"
        )
          fx.impact(
            0,
            1.1,
            -34.86,
            event === "critical" || event === "critical-echo",
          );
        else if (
          event === "death" ||
          event === "death-smoke" ||
          event === "weighted-flight" ||
          event === "weighted-late" ||
          event === "debris-fall" ||
          event === "debris-bounce" ||
          event === "debris-hold" ||
          event === "debris-fade" ||
          event === "remnant-flash" ||
          event === "remnant-burgundy" ||
          event === "remnant-late"
        )
          fx.death(0, -35);
        else if (event === "death-left" || event === "death-right") {
          const side = event === "death-left" ? -1 : 1;
          fx.death(0, -35, 0, false, side * 0.1, -1, false, {
            x: side * 0.35,
            y: 1.3,
            z: -34.95,
            dx: side * 0.1,
            dy: 0.1,
            dz: -1,
            nx: 0,
            ny: 0,
            nz: 1,
          });
        } else if (event === "magic-death")
          fx.death(0, -35, 0, false, 0, 0, true);
        else if (event === "finisher") fx.death(0, -35, 2, true, 0, -1);
        else if (event === "orb-flight")
          fx.orb(new T.Vector3(-1, 1.6, -32), new T.Vector3(0, 0, -1));
        else if (event === "nova") fx.pulse(0, -35);
        else if (event === "level") fx.levelUp(0, -35);
        else if (event === "hurt") fx.playerHurt();
        else if (event === "near")
          fx["procedural"].emit("death", 0, 1.8, -27.9);
        else if (event === "heal") fx["procedural"].emit("heal", 0, 1.1, -34.8);
        else if (event === "cast") fx.cast(new T.Vector3(0, 1, -35), true);
        else if (event === "explosion")
          fx["procedural"].emit("explosion", 0, 1, -35);
        else fx.pickup(event === "gold" ? "gold" : "xp", 0, -35, 1);
        // Isolate the body phases so particle colors cannot satisfy these checks.
        if (event.startsWith("remnant-")) fx["procedural"].simulation.reset();
        if (event.startsWith("debris-"))
          for (const p of fx["procedural"].simulation.items)
            if (p.shape !== 10) p.life = 0;
        if (event.startsWith("weighted-"))
          for (const p of fx["procedural"].simulation.items)
            if (p.shape !== 9) p.life = 0;
        draw();
        for (let i = 0; i < Math.ceil(age * 120); i++) {
          fx.step(1 / 120, i / 120);
          if (i % 8 === 0) draw();
        }
        draw();
        const pixels = new Uint8Array(width * height * 4);
        renderer
          .getContext()
          .readPixels(0, 0, width, height, 6408, 5121, pixels);
        let gold = 0,
          white = 0,
          red = 0,
          cyan = 0,
          burgundy = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i],
            g = pixels[i + 1],
            b = pixels[i + 2];
          if (r > 150 && g > 100 && b < g * 0.75) gold++;
          if (r > 230 && g > 230 && b > 220) white++;
          if (r > 65 && r > g * 1.6 && r > b * 1.3) red++;
          if (g > 150 && b > 140 && r < g * 0.9) cyan++;
          if (r > 40 && r > g * 1.4 && b > g) burgundy++;
        }
        return {
          ...fx.diagnostics(),
          pixels: { gold, white, red, cyan, burgundy },
          memory: { ...renderer.info.memory },
        };
      },
      occlude() {
        fx.reset();
        wall.visible = true;
        fx.visibility.rebuild([new T.Box3().setFromObject(wall)]);
        fx.impact(0, 1, -35, true);
        fx.step(0.02, 0);
        draw();
        return fx.diagnostics();
      },
      stress() {
        wall.visible = false;
        fx.visibility.rebuild([]);
        fx.reset();
        for (let i = 0; i < 150; i++) {
          fx.impact(
            ((i % 7) - 3) * 0.6,
            1,
            -34 - Math.floor(i / 7),
            i % 3 === 0,
          );
          if (i % 4 === 0)
            fx.death(((i % 7) - 3) * 0.6, -36 - Math.floor(i / 7));
        }
        draw();
        const peak = fx.diagnostics();
        for (let i = 0; i < 360; i++) fx.step(1 / 60, 0);
        draw();
        return {
          peak,
          end: fx.diagnostics(),
          memory: { ...renderer.info.memory },
        };
      },
    };
  });
  const report = [],
    shotCaptures = new Map();
  for (const [width, height] of [
    [1280, 720],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    for (const [event, age] of [
      ["hit", 0.07],
      ["critical", 0.07],
      ["critical-echo", 0.17],
      ["hit-smoke", 0.32],
      ["death-smoke", 0.18],
      ["finisher", 0.25],
      ["orb-flight", 0.08],
      ["death", 0.2],
      ["weighted-flight", 0.12],
      ["weighted-late", 0.26],
      ["death-left", 0.2],
      ["death-right", 0.2],
      ["debris-fall", 0.35],
      ["debris-bounce", 0.65],
      ["debris-hold", 0.75],
      ["debris-fade", 1.1],
      ["remnant-flash", 0.035],
      ["remnant-burgundy", 0.17],
      ["remnant-late", 0.3],
      ["magic-death", 0.2],
      ["nova", 0.2],
      ["explosion", 0.2],
      ["cast", 0.08],
      ["gold", 0.08],
      ["xp", 0.08],
      ["hurt", 0.08],
      ["heal", 0.08],
      ["near", 0.18],
      ["level", 0.2],
    ]) {
      const result = await page.evaluate(
        ({ event, age, width, height }) =>
          window.fixture.show(event, age, width, height),
        { event, age, width, height },
      );
      const capture = await page.screenshot({
        path: `artifacts/procedural-${height}-${event}.png`,
      });
      if (event === "death-left" || event === "death-right")
        shotCaptures.set(`${height}-${event}`, capture);
      if (event.startsWith("remnant-"))
        console.log(event, result.pixels, result.remnants);
      assert.equal(result.procedural.textures, 0);
      if (event === "remnant-flash") {
        assert.ok(result.remnants.phases.every((p) => p.flash === 1));
        assert.ok(
          result.pixels.red > 15 && result.pixels.white === 0,
          "isolated lethal blood flash replaces white",
        );
      }
      if (event === "remnant-burgundy")
        assert.ok(
          result.remnants.phases.every((p) => p.flash === 0 && p.height < 1),
        );
      if (event === "magic-death") assert.ok(result.pixels.cyan > 15);
      if (event === "death") {
        assert.equal(result.procedural.events.soul, 0);
        assert.equal(result.procedural.smoke, 0);
      }
      if (event.startsWith("remnant-")) {
        assert.equal(result.remnants.active, 1);
        assert.equal(result.procedural.rendered, 0);
        if (event === "remnant-burgundy")
          assert.ok(
            result.pixels.red > 15,
            "isolated blood remnant is visible",
          );
        if (event === "remnant-late")
          assert.ok(
            result.remnants.phases.every(
              (p) => p.opacity < 0.15 && p.dissolve > 0.6,
            ),
            "late remnant has mostly dissolved",
          );
      } else
        assert.ok(result.procedural.rendered > 0, `${event} draws particles`);
      if (event === "hit" || event === "critical" || event === "explosion")
        assert.ok(result.pixels.gold > 15, `${event} gold pixels`);
      if (event === "death" || event === "hurt")
        assert.ok(result.pixels.red > 15, `${event} ruby pixels`);
      if (event === "level" || event === "nova" || event === "xp")
        assert.ok(result.pixels.cyan > 15, `${event} cyan pixels`);
      report.push({ width, height, event, ...result });
    }
    assert.equal(
      (await page.evaluate(() => window.fixture.occlude())).procedural.shapes
        .overlay,
      0,
      "static wall rejects impact overlays",
    );
  }
  for (const height of [720, 1080])
    assert.ok(
      !shotCaptures
        .get(`${height}-death-left`)
        .equals(shotCaptures.get(`${height}-death-right`)),
      "different body contact produces a different rendered fan",
    );
  const full = await page.evaluate(() =>
      window.fixture.show("critical", 0.02, 1280, 720),
    ),
    low = await page.evaluate(() =>
      window.fixture.show("critical", 0.02, 1280, 720, true),
    );
  assert.ok(low.procedural.active < full.procedural.active);
  assert.equal(low.procedural.shapes.overlay, 1);
  const stress = await page.evaluate(() => window.fixture.stress());
  assert.ok(stress.peak.procedural.active <= 1536);
  assert.ok(stress.peak.procedural.draws <= 3);
  assert.equal(stress.end.procedural.active, 0);
  assert.equal(stress.end.remnants.active, 0);
  assert.equal(
    requests.filter((u) => /vfx\/combat|\.png(?:\?|$)/.test(u)).length,
    0,
    "no image/atlas particle downloads",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    "artifacts/procedural-report.json",
    JSON.stringify({ report, stress }, null, 2),
  );
  console.log(
    "PASS: texture-free shaders, 29 event scenarios at 720p/1080p, GPU colors, world occlusion, reduced mode, capacity and cleanup.",
  );
} finally {
  await browser?.close();
  await server.close();
}
