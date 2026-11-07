// Test-only diagnostic atlases exercise UVs/alpha/animation. They are not the supplied art.
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
      name: "combat-vfx-fixture",
      configureServer(s) {
        s.middlewares.use((req, res, next) => {
          if (req.url !== "/combat-fixture.html") return next();
          res.setHeader("Content-Type", "text/html");
          res.end(
            '<!doctype html><html><head><link rel="icon" href="data:,"></head><body style="margin:0"><canvas id="world"></canvas></body></html>',
          );
        });
      },
    },
  ],
});
await server.listen();
let browser;
const reports = [];
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
  for (const [width, height] of [
    [1280, 720],
    [1920, 1080],
  ]) {
    const page = await browser.newPage({
        viewport: { width, height },
        deviceScaleFactor: 1,
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.goto("http://127.0.0.1:5191/combat-fixture.html");
    const report = await page.evaluate(
      async ({ width, height }) => {
        const [T, { Effects }, { Battle }, { Enemies }] = await Promise.all([
          import("/node_modules/three/build/three.module.js"),
          import("/src/game/effects.ts"),
          import("/src/game/battle.ts"),
          import("/src/game/enemies.ts"),
        ]);
        const check = (value, reason) => {
          if (!value) throw new Error(reason);
        };
        const sheets = ["normal", "critical", "death"].map((kind, category) => {
          const canvas = document.createElement("canvas"),
            columns = [4, 3, 5][category],
            rows = 2;
          canvas.width = columns * 32;
          canvas.height = rows * 32;
          const g = canvas.getContext("2d"),
            frames = [];
          for (let i = 0; i < columns * rows; i++) {
            const x = (i % columns) * 32 + 2,
              y = Math.floor(i / columns) * 32 + 2;
            // Different diagnostic shapes per frame, with genuine alpha and dark outlines.
            g.fillStyle = "#090d13";
            g.fillRect(x + 8, y + 8, 12, 12);
            g.fillStyle = ["#ffd963", "#fff4cd", "#e83949"][category];
            g.fillRect(x + 9, y + 9, 10, 10);
            g.fillRect(x + i, y + 13, 28 - i, 2);
            frames.push({ x, y, width: 28, height: 28, coverage: 0.24 });
          }
          return {
            kind,
            url: canvas.toDataURL(),
            width: canvas.width,
            height: canvas.height,
            frames,
            anchor: [0.5, 0.5],
          };
        });
        const renderer = new T.WebGLRenderer({
          canvas: document.querySelector("canvas"),
          antialias: false,
          preserveDrawingBuffer: true,
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(1);
        renderer.outputColorSpace = T.SRGBColorSpace;
        const scene = new T.Scene();
        scene.background = new T.Color(0x173b3b);
        scene.add(new T.HemisphereLight(0xaad6d8, 0x253522, 2));
        const camera = new T.PerspectiveCamera(60, width / height, 0.06, 90);
        camera.position.set(0, 1.3, -33);
        camera.lookAt(0, 1.3, -39);
        camera.updateMatrixWorld();
        const battle = new Battle([]),
          effects = new Effects(scene, battle, camera, sheets),
          enemies = new Enemies(scene, battle);
        effects.resize(height);
        await effects.ready;
        const draw = () => {
          enemies.update(0, camera.rotation.y);
          effects.render(0);
          renderer.render(scene, camera);
        };
        const drain = () => {
          for (const e of battle.events) {
            if (e.kind === "hit" && !e.killed)
              effects.impact(e.x, e.y, e.z, e.critical, true);
            if (e.kind === "kill") effects.death(e.x, e.z, e.value);
          }
          battle.events.length = 0;
        };
        Object.assign(battle.enemies[0], {
          active: true,
          x: 0,
          z: -39,
          previousX: 0,
          previousZ: -39,
          hp: 200,
          maxHp: 200,
          spawnAge: 1,
          speedFactor: 0,
        });
        const hit = (critical, value = 19) => {
          battle.damageEnemy(0, value, { x: 0, z: -33 }, 0, {
            x: 0,
            y: 1.1,
            z: -38.96,
            bullet: true,
            critical,
          });
          drain();
          draw();
        };
        draw();
        hit(false);
        check(
          effects.diagnostics().combatSprites.active === 1,
          "One normal sheet per confirmed non-lethal hit",
        );
        check(
          effects.diagnostics().flashes === 0,
          "Authored art replaces the old geometric flash",
        );
        check(
          enemies.diagnostics().flashing === 1,
          "Enemy surface flashes independently",
        );
        const normal = scene.getObjectByName("authored-combat-normal");
        check(normal.count === 1, "Normal category draw");
        const matrixBefore = Array.from(
            effects.shardMesh.instanceMatrix.array.slice(0, 16),
          ),
          origin = normal.instanceMatrix.array.slice(12, 15),
          normalUV = Array.from(
            normal.geometry.attributes.combatRect.array.slice(0, 4),
          );
        effects.step(0.08, 0);
        hit(false);
        const uv = normal.geometry.attributes.combatRect.array;
        check(
          uv[0] !== uv[4] || uv[1] !== uv[5],
          "Overlapping animations keep independent frames",
        );
        check(
          normalUV.some((v, i) => v !== uv[i]),
          "Elapsed time advances authored UVs",
        );
        const fixedMatrix = Array.from(
          effects.shardMesh.instanceMatrix.array.slice(0, 16),
        );
        camera.position.set(3.6, 1.3, -34.2);
        camera.lookAt(0, 1.1, -39);
        draw();
        const movedMatrix = Array.from(
          effects.shardMesh.instanceMatrix.array.slice(0, 16),
        );
        check(
          fixedMatrix.every((v, i) => Math.abs(v - movedMatrix[i]) < 1e-5),
          "3D fragments do not billboard or follow camera motion",
        );
        check(
          origin.every(
            (v, i) => Math.abs(v - normal.instanceMatrix.array[12 + i]) < 1e-5,
          ),
          "Impact origin remains in world space",
        );
        const billboard = new T.Vector3()
            .setFromMatrixColumn(
              new T.Matrix4().fromArray(normal.instanceMatrix.array),
              2,
            )
            .normalize(),
          cameraForward = new T.Vector3(0, 0, 1).applyQuaternion(
            camera.quaternion,
          );
        check(
          billboard.dot(cameraForward) > 0.9999,
          "Only the authored layer faces the active camera",
        );
        check(
          matrixBefore.some((v, i) => v !== fixedMatrix[i]),
          "Fragments actually move and tumble over time",
        );
        camera.position.set(0, 1.3, -33);
        camera.lookAt(0, 1.3, -39);
        draw();
        effects.reset();
        hit(true);
        const flashes = enemies.flashes[0];
        check(
          flashes.getX(0) > 1,
          "Critical metadata strengthens the same white surface flash",
        );
        check(
          scene.getObjectByName("authored-combat-critical").count === 1 &&
            normal.count === 0,
          "Critical replaces normal artwork",
        );
        effects.reset();
        hit(true, 1000);
        battle.damageEnemy(0, 1000, { x: 0, z: -33 });
        drain();
        draw();
        check(
          effects.diagnostics().totals.deaths === 1,
          "Exactly one lethal effect after repeated damage to a dead enemy",
        );
        check(
          scene.getObjectByName("authored-combat-death").count === 1 &&
            scene.getObjectByName("authored-combat-critical").count === 0,
          "Critical lethal prioritizes red, independently of the removed enemy",
        );
        check(
          effects.corpses.some((c) => c.life > 0 && c.tint.value === 1),
          "Death overrides the body flash with red tint",
        );
        effects.step(0.7, 0);
        draw();
        const death = scene.getObjectByName("authored-combat-death"),
          last = sheets[2].frames.at(-1);
        check(
          Math.abs(
            death.geometry.attributes.combatRect.getX(0) -
              (last.x + 0.5) / sheets[2].width,
          ) < 1e-6,
          "Final authored frame survives catch-up",
        );
        effects.step(1 / 60, 0);
        draw();
        check(
          effects.diagnostics().combatSprites.active === 0 && death.count === 0,
          "Finished effects release their slots",
        );
        effects.reset();
        effects.impact(0, 1.3, -39, false, true);
        draw();
        // GPU pixel checks detect black quads and prove the sampled art reaches the framebuffer.
        const pixels = new Uint8Array(width * height * 4),
          gl = renderer.getContext();
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        let gold = 0;
        for (let i = 0; i < pixels.length; i += 4)
          if (
            pixels[i] > 150 &&
            pixels[i + 1] > 110 &&
            pixels[i + 2] < pixels[i + 1] * 0.75
          )
            gold++;
        check(gold > 30, "Crisp authored atlas texels render in color");
        const backgroundAt =
          ((Math.floor(height / 2) - 18) * width + Math.floor(width / 2) - 18) *
          4;
        check(
          pixels[backgroundAt + 1] > 30,
          "Transparent frame padding has no opaque black rectangle",
        );
        const wall = new T.Mesh(
          new T.BoxGeometry(4, 4, 0.1),
          new T.MeshBasicMaterial({ color: 0x235f78 }),
        );
        wall.position.set(0, 1.3, -37);
        scene.add(wall);
        draw();
        const center = new Uint8Array(4);
        gl.readPixels(
          width / 2,
          height / 2,
          1,
          1,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          center,
        );
        check(
          center[2] > center[0] && center[0] < 80,
          "Opaque world geometry correctly occludes the effects",
        );
        scene.remove(wall);
        wall.geometry.dispose();
        wall.material.dispose();
        for (const kind of ["normal", "critical", "death"]) {
          const mesh = scene.getObjectByName(`authored-combat-${kind}`),
            texture = mesh.material.map;
          check(
            texture.magFilter === T.NearestFilter &&
              texture.minFilter === T.NearestFilter &&
              !texture.generateMipmaps,
            "Nearest filtering, no atlas mip bleed",
          );
          check(
            mesh.material.depthTest &&
              !mesh.material.depthWrite &&
              !mesh.material.toneMapped,
            "Correct depth and unlit sprite color",
          );
        }
        effects.reset();
        const timings = [];
        let baseline;
        for (let frame = 0; frame < 120; frame++) {
          const start = performance.now();
          for (let i = 0; i < 8; i++)
            effects.impact(
              ((i % 4) - 1.5) * 0.3,
              1.3,
              -39 - Math.floor(i / 4),
              i % 3 === 0,
              true,
            );
          if (frame % 12 === 0) effects.death(0.5, -39, frame % 4);
          effects.step(1 / 60, frame / 60);
          effects.render(frame / 60);
          timings.push(performance.now() - start);
          renderer.render(scene, camera);
          if (frame === 60) baseline = { ...renderer.info.memory };
        }
        check(
          effects.diagnostics().combatSprites.active <= 48 &&
            effects.diagnostics().shards <= 640,
          "Bounded sprite and fragment pools",
        );
        check(
          renderer.info.memory.geometries === baseline.geometries &&
            renderer.info.memory.textures === baseline.textures,
          "Automatic fire does not allocate GPU geometry/textures after warmup",
        );
        timings.sort((a, b) => a - b);
        const diagnostic = effects.diagnostics();
        window.__combatFixture = { renderer, scene, camera, effects, draw };
        return {
          width,
          height,
          diagnostic,
          drawCalls: renderer.info.render.calls,
          cpuUpdateMeanMs: timings.reduce((a, b) => a + b, 0) / timings.length,
          cpuUpdateP95Ms: timings[Math.floor(timings.length * 0.95)],
          memory: { ...renderer.info.memory },
          testArtwork:
            "synthetic diagnostic atlas; original sheets unavailable",
        };
      },
      { width, height },
    );
    assert.deepEqual(errors, [], "Browser/shader errors");
    assert.deepEqual(report.diagnostic.combatSprites.errors, []);
    await page.screenshot({ path: `artifacts/combat-fixture-${height}p.png` });
    reports.push(report);
    await page.close();
  }
  await writeFile(
    "artifacts/combat-vfx-report.json",
    JSON.stringify(reports, null, 2),
  );
  console.log(JSON.stringify(reports, null, 2));
  console.log(
    "PASS: diagnostic atlas animation/alpha, independent frames, world-space cubes, billboard orbit, occlusion, event priority, cleanup and bounded stress at 720p/1080p. Original-art review still required.",
  );
} finally {
  await browser?.close();
  await server.close();
}
