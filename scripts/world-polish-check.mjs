import { createServer } from "vite";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
await mkdir("artifacts", { recursive: true });
const server = await createServer({
  configFile: false,
  root: process.cwd(),
  server: { host: "127.0.0.1", port: 5192, strictPort: true },
  plugins: [
    {
      name: "world-polish-fixture",
      configureServer(s) {
        s.middlewares.use((req, res, next) => {
          if (req.url !== "/fixture") return next();
          res.setHeader("Content-Type", "text/html");
          res.end(
            '<html><head><link rel="icon" href="data:,"></head><body style="margin:0"><canvas></canvas></body></html>',
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
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("http://127.0.0.1:5192/fixture");
  await page.evaluate(async () => {
    const T = await import("/node_modules/three/build/three.module.js"),
      { World } = await import("/src/game/world.ts"),
      { Effects } = await import("/src/game/effects.ts"),
      { Battle } = await import("/src/game/battle.ts"),
      { Weapon } = await import("/src/game/weapon.ts"),
      { FOREST_TREES } = await import("/src/game/forest.ts"),
      { islandSurfaceHeight } = await import("/src/game/island.ts");
    const renderer = new T.WebGLRenderer({
      canvas: document.querySelector("canvas"),
      antialias: false,
      preserveDrawingBuffer: true,
    });
    renderer.autoClear = false;
    const scene = new T.Scene(),
      world = new World(scene),
      camera = new T.PerspectiveCamera(55, 16 / 9, 0.06, 440),
      view = new T.Scene(),
      battle = new Battle(world.solids),
      fx = new Effects(scene, battle, camera),
      weapon = new Weapon(camera);
    await fx.ready;
    fx.setSurfaceFloor((x, z, ceiling) =>
      world.ballistics.supportHeight(x, z, ceiling, islandSurfaceHeight(x, z)),
    );
    camera.position.set(0, 1.72, -33);
    camera.lookAt(0, 1.72, -50);
    view.add(camera);
    view.add(new T.HemisphereLight(0xcde6e4, 0x31483b, 2));
    const key = new T.DirectionalLight(0xffe2bb, 1.8);
    key.position.set(-2, 3, 2);
    view.add(key);
    for (let i = 0; i < 90; i++) weapon.update(1 / 60, 0, 0, true, true);
    weapon.present(1);
    const draw = () => {
      camera.updateMatrixWorld();
      fx.render(0);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.render(fx.impactScene, camera);
      renderer.clearDepth();
      renderer.render(view, camera);
      renderer.render(fx.screenScene, camera);
    };
    const pixels = () => {
      const gl = renderer.getContext(),
        p = new Uint8Array(
          renderer.domElement.width * renderer.domElement.height * 4,
        );
      gl.readPixels(
        0,
        0,
        renderer.domElement.width,
        renderer.domElement.height,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        p,
      );
      return p;
    };
    window.fixture = {
      draw,
      ads(width, height) {
        fx.reset();
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        world.update(0, camera.position);
        renderer.setClearColor(0);
        renderer.clear();
        renderer.render(view, camera);
        const mask = pixels();
        draw();
        const base = pixels();
        fx.impact(0, 1.69, -36, true);
        fx.step(0.055, 0);
        draw();
        const after = pixels();
        let protectedPixels = 0,
          overpaint = 0,
          changes = 0;
        for (let i = 0; i < mask.length; i += 4) {
          if (mask[i] + mask[i + 1] + mask[i + 2] > 12) {
            protectedPixels++;
            if (
              base[i] !== after[i] ||
              base[i + 1] !== after[i + 1] ||
              base[i + 2] !== after[i + 2]
            )
              overpaint++;
          } else if (
            base[i] !== after[i] ||
            base[i + 1] !== after[i + 1] ||
            base[i + 2] !== after[i + 2]
          )
            changes++;
        }
        return {
          width,
          height,
          protectedPixels,
          overpaint,
          changes,
          fx: fx.diagnostics(),
        };
      },
      surfaces() {
        fx.reset();
        const cases = [
          ["earth", new T.Vector3(0, 8, -35), new T.Vector3(0, -1, 0)],
          ["stone", new T.Vector3(-23, 2, -19), new T.Vector3(0, 0, -1)],
          ["wood", null, null],
          ["mountain", new T.Vector3(90, 100, -60), new T.Vector3(0, -1, 0)],
        ];
        const t = FOREST_TREES.find((t) => Math.abs(t.x) < 20),
          root = islandSurfaceHeight(t.x, t.z);
        cases[2][1] = new T.Vector3(t.x, root + 0.3, t.z + 1.5);
        cases[2][2] = new T.Vector3(0, 0, -1);
        const results = [];
        for (const [name, origin, direction] of cases) {
          const hit = world.ballistics.hit(new T.Ray(origin, direction), 180);
          if (hit) fx.surfaceImpact(hit);
          results.push({
            name,
            hit: hit && {
              surface: hit.surface,
              point: hit.point.toArray(),
              normal: hit.normal.toArray(),
            },
            triangles: world.ballistics.triangleTests,
          });
        }
        fx.step(0.04, 0);
        camera.position.set(-23, 2, -19);
        camera.lookAt(-23, 1.5, -26);
        weapon.group.visible = false;
        draw();
        return { results, decals: fx.diagnostics().surfaces };
      },
      scarsOnly() {
        fx.step(1, 0);
        fx["scars"]["mesh"].visible = false;
        draw();
        const before = pixels();
        fx["scars"]["mesh"].visible = true;
        draw();
        const after = pixels();
        let changed = 0;
        for (let i = 0; i < before.length; i += 4)
          if (
            before[i] !== after[i] ||
            before[i + 1] !== after[i + 1] ||
            before[i + 2] !== after[i + 2]
          )
            changed++;
        return changed;
      },
      breeze() {
        fx.reset();
        weapon.group.visible = false;
        camera.position.set(5, 1.72, -33);
        camera.lookAt(9, 0.2, -40);
        world.update(0, camera.position);
        draw();
        const before = pixels();
        world.update(2.5, camera.position);
        draw();
        const after = pixels();
        let changed = 0;
        for (let i = 0; i < before.length / 2; i += 4)
          if (
            before[i] !== after[i] ||
            before[i + 1] !== after[i + 1] ||
            before[i + 2] !== after[i + 2]
          )
            changed++;
        world.reducedMotion = true;
        world.update(3, camera.position);
        const reduced = world.diagnostics().windStrength;
        world.reducedMotion = false;
        return { changed, reduced, world: world.diagnostics() };
      },
      settledShards() {
        fx.reset();
        weapon.group.visible = false;
        fx.death(0, -35);
        for (let i = 0; i < 120; i++) fx.step(1 / 60, i / 60);
        camera.position.set(0, 0.4, -33);
        camera.lookAt(0, 0.08, -35);
        draw();
        const shards = fx["procedural"].simulation.items.filter(
          (p) => p.life > 0 && p.shape === 10,
        );
        return {
          count: shards.length,
          settled: shards.every((p) => p.settled),
          minClearance: Math.min(
            ...shards.map(
              (p) =>
                p.y -
                world.ballistics.supportHeight(
                  p.x,
                  p.z,
                  p.y + 0.3,
                  islandSurfaceHeight(p.x, p.z),
                ),
            ),
          ),
        };
      },
      tokens() {
        fx.reset();
        weapon.group.visible = false;
        camera.position.set(0, 0.75, -33);
        camera.lookAt(0, 0.62, -35);
        for (const [i, kind] of ["gold", "xp"].entries())
          Object.assign(battle.drops[i], {
            active: true,
            kind,
            x: i ? 0.4 : -0.4,
            y: 0.62,
            z: -35,
            age: 2,
            magnet: false,
            value: 1,
          });
        draw();
        return fx.diagnostics();
      },
      shadows() {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = T.PCFSoftShadowMap;
        world.update(1, camera.position);
        draw();
        renderer.shadowMap.enabled = false;
      },
      cleanup() {
        fx.step(10, 0);
        draw();
        return fx.diagnostics().surfaces;
      },
    };
  });
  const report = { ads: [] };
  for (const [width, height] of [
    [1280, 720],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    const r = await page.evaluate(
      ({ width, height }) => window.fixture.ads(width, height),
      { width, height },
    );
    assert.ok(r.protectedPixels > 1000);
    assert.equal(
      r.overpaint,
      0,
      "enemy effects must never paint over the opaque ADS weapon",
    );
    assert.ok(
      r.changes > 15,
      "compact critical feedback remains visible outside weapon",
    );
    assert.ok(
      r.changes < width * height * 0.03,
      "critical does not fill the view",
    );
    report.ads.push(r);
    await page.screenshot({ path: `artifacts/world-ads-${height}.png` });
  }
  report.surfaces = await page.evaluate(() => window.fixture.surfaces());
  for (const r of report.surfaces.results)
    assert.ok(r.hit, `${r.name} geometry receives hits`);
  assert.equal(report.surfaces.results[0].hit.surface, "earth");
  assert.equal(report.surfaces.results[1].hit.surface, "stone");
  assert.equal(report.surfaces.results[2].hit.surface, "wood");
  assert.equal(report.surfaces.decals.active, 4);
  await page.screenshot({ path: "artifacts/world-stone-impact.png" });
  report.scarPixels = await page.evaluate(() => window.fixture.scarsOnly());
  assert.ok(
    report.scarPixels > 15,
    "persistent scar reaches the framebuffer after dust clears",
  );
  await page.screenshot({ path: "artifacts/world-stone-scar.png" });
  report.breeze = await page.evaluate(() => window.fixture.breeze());
  assert.ok(report.breeze.changed > 100);
  assert.equal(report.breeze.reduced, 0);
  await page.screenshot({ path: "artifacts/world-breeze.png" });
  report.shards = await page.evaluate(() => window.fixture.settledShards());
  assert.equal(report.shards.count, 35);
  assert.ok(report.shards.settled);
  assert.ok(report.shards.minClearance > 0.035);
  await page.screenshot({ path: "artifacts/world-settled-shards.png" });
  report.tokens = await page.evaluate(() => window.fixture.tokens());
  assert.equal(report.tokens.gold, 1);
  assert.equal(report.tokens.xp, 1);
  await page.screenshot({ path: "artifacts/world-tokens.png" });
  await page.evaluate(() => window.fixture.shadows());
  assert.equal((await page.evaluate(() => window.fixture.cleanup())).active, 0);
  assert.deepEqual(errors, []);
  await writeFile(
    "artifacts/world-polish-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    "PASS: ADS protected at 720p/1080p, compact critical footprint, terrain/stone/trunk/mountain hits, pixel decals, breeze, reduced motion, token geometry, shadow shaders and cleanup.",
  );
} finally {
  await browser?.close();
  await server.close();
}
