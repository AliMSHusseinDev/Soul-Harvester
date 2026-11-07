import { performance } from "node:perf_hooks";
import { writeFileSync } from "node:fs";
import { build } from "vite";
// Compile the existing renderer-independent simulation without opening a dev server.
const bundle = await build({
  configFile: false,
  logLevel: "silent",
  build: {
    ssr: "src/game/battle.ts",
    write: false,
    minify: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
const entry = bundle.output.find(
  (chunk) => chunk.type === "chunk" && chunk.isEntry,
);
const { Battle } = await import(
  `data:text/javascript;base64,${Buffer.from(entry.code).toString("base64")}`
);
const results = [];
for (const count of [8, 80, 260]) {
  const b = new Battle([
    { minX: -5, maxX: 5, minZ: -40, maxZ: -38, height: 4 },
  ]);
  b.baseHealth = 1e9;
  for (let i = 0; i < count; i++)
    Object.assign(b.enemies[i], {
      active: true,
      x: ((i % 20) - 9.5) * 1.3,
      z: -57 - Math.floor(i / 20) * 0.55,
      kind: i % 4,
      wave: 10,
      hp: 100,
      maxHp: 100,
      spawnAge: 1,
    });
  const player = { x: 26, z: 25, y: 4 },
    samples = [];
  for (let step = 0; step < 1200; step++) {
    const start = performance.now();
    b.update(1 / 60, player);
    if (step >= 120) samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  results.push({
    enemies: count,
    meanMs: samples.reduce((a, b) => a + b, 0) / samples.length,
    p50Ms: samples[Math.floor(samples.length * 0.5)],
    p95Ms: samples[Math.floor(samples.length * 0.95)],
    p99Ms: samples[Math.floor(samples.length * 0.99)],
    retained: b.alive.length,
  });
}
console.log(JSON.stringify(results, null, 2));
if (process.argv[2])
  writeFileSync(process.argv[2], JSON.stringify(results, null, 2));
