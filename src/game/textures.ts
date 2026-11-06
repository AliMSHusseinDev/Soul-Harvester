import * as THREE from "three";
import { seededRandom } from "./math";
export function stoneTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  const rng = seededRandom(231);
  ctx.fillStyle = "#252d2a";
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 4; y++)
    for (let x = -1; x < 4; x++) {
      const px = x * 85 + (y % 2) * 42,
        py = y * 64;
      const shade = Math.floor(53 + rng() * 20);
      ctx.fillStyle = `rgb(${shade},${shade + 6},${shade + 1})`;
      ctx.fillRect(px + 3, py + 3, 80, 58);
      ctx.fillStyle = "#70776a44";
      ctx.fillRect(px + 3, py + 3, 80, 2);
      ctx.fillStyle = "#14201c88";
      ctx.fillRect(px + 3, py + 58, 80, 3);
    }
  for (let i = 0; i < 18000; i++) {
    const x = rng() * 256,
      y = rng() * 256;
    ctx.fillStyle = rng() > 0.5 ? "#a3a49015" : "#0c151a22";
    ctx.fillRect(x, y, 1 + rng() * 3, 1 + rng() * 2);
  }
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = "#33432b55";
    ctx.fillRect(rng() * 256, rng() * 256, 3 + rng() * 12, 2 + rng() * 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
export function groundTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const ctx = c.getContext("2d")!,
    r = seededRandom(45);
  ctx.fillStyle = "#263a2d";
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 70000; i++) {
    const k = r();
    ctx.fillStyle = k < 0.4 ? "#10291b44" : k < 0.8 ? "#58703c33" : "#8b876422";
    ctx.fillRect(r() * 512, r() * 512, 1 + r() * 4, 1 + r() * 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(14, 18);
  t.anisotropy = 8;
  return t;
}
/** Original hand-drawn sprite, rasterized at 40px to retain the reference's hybrid style. */
export function shadeTexture(variant = 0) {
  const c = document.createElement("canvas");
  c.width = 40;
  c.height = 56;
  const g = c.getContext("2d")!;
  const r = seededRandom(123 + variant);
  const colors = ["#132d30", "#204b4b", "#34736c", "#619d8c", "#90c6ad"];
  const rows = [
    [17, 22],
    [14, 25],
    [12, 27],
    [11, 28],
    [10, 29],
    [10, 29],
    [10, 29],
    [11, 28],
    [12, 27],
    [13, 26],
    [12, 27],
    [10, 29],
    [8, 31],
    [7, 32],
    [6, 33],
    [5, 34],
    [5, 34],
    [4, 35],
    [4, 35],
    [5, 34],
    [6, 33],
    [7, 32],
    [6, 33],
    [5, 34],
  ];
  rows.forEach(([a, b], y) => {
    for (let x = a; x <= b; x++) {
      const edge = Math.min(x - a, b - x);
      g.fillStyle =
        colors[Math.min(4, Math.max(0, Math.floor(edge / 3 + r() * 2)))];
      g.fillRect(x, 4 + y * 2, 1, 2);
    }
  });
  g.fillStyle = "#102426";
  g.fillRect(13, 14, 14, 10);
  g.fillStyle = "#b3ffe1";
  g.fillRect(14, 16, 4, 3);
  g.fillRect(22, 16, 4, 3);
  g.fillStyle = "#f0ffe8";
  g.fillRect(15, 16, 2, 2);
  g.fillRect(23, 16, 2, 2);
  g.fillStyle = "#09282a";
  g.fillRect(18, 23, 4, 4);
  g.fillStyle = "#1a3e3d";
  g.fillRect(3, 30, 5, 11);
  g.fillRect(32, 29, 5, 12);
  g.fillStyle = "#7bb6a0";
  g.fillRect(3, 39, 4, 3);
  g.fillRect(33, 39, 4, 3);
  // Torn hem, asymmetry, and a faint runic clasp.
  g.clearRect(6, 48, 3, 6);
  g.clearRect(15, 49, 3, 5);
  g.clearRect(28, 47, 3, 7);
  g.fillStyle = "#ceb67a";
  g.fillRect(19, 29, 2, 2);
  g.fillStyle = "#85cbb14d";
  g.fillRect(19, 33, 2, 11);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const a = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  a.addColorStop(0, "#ffffff");
  a.addColorStop(0.15, "#ffffffbb");
  a.addColorStop(0.5, "#ffffff22");
  a.addColorStop(1, "#ffffff00");
  g.fillStyle = a;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
