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

export function npcTexture(kind: number) {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 48;
  const g = c.getContext("2d")!;
  g.fillStyle = kind ? "#72442b" : "#817151";
  g.fillRect(8, 19, 17, 23);
  g.fillStyle = "#deb180";
  g.fillRect(10, 8, 13, 12);
  g.fillStyle = "#302f27";
  g.fillRect(8, 5, 17, 6);
  g.fillRect(7, 8, 19, 3);
  g.fillStyle = "#131e1d";
  g.fillRect(12, 13, 2, 2);
  g.fillRect(19, 13, 2, 2);
  g.fillStyle = "#d0a569";
  g.fillRect(4, 22, 5, 12);
  g.fillRect(24, 22, 5, 12);
  g.fillStyle = kind ? "#463124" : "#213c35";
  g.fillRect(11, 38, 5, 8);
  g.fillRect(19, 38, 5, 8);
  g.fillStyle = "#dbc97e";
  g.fillRect(10, 30, 13, 3);
  if (!kind) {
    g.fillStyle = "#dcdfc2";
    g.fillRect(14, 18, 8, 8);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = t.minFilter = THREE.NearestFilter;
  return t;
}

export function guardTexture(kind = 0) {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 40;
  const g = c.getContext("2d")!;
  const palette = ["#101f23", "#29464a", "#4a7c70", "#80b59a", "#bdd5ab"];
  const rng = seededRandom(630 + kind);
  const rows = [
    [12, 19],
    [9, 22],
    [7, 24],
    [6, 25],
    [6, 25],
    [5, 26],
    [5, 26],
    [6, 25],
    [7, 24],
    [9, 22],
    [8, 23],
    [5, 26],
    [4, 27],
    [3, 28],
    [3, 28],
    [4, 27],
    [7, 24],
    [8, 23],
    [7, 24],
    [7, 24],
  ];
  for (let y = 0; y < 20; y++) {
    const [a, b] = rows[y];
    for (let x = a; x <= b; x++) {
      const edge = Math.min(x - a, b - x),
        shade = Math.min(4, Math.floor(edge / 3 + rng() * 2));
      g.fillStyle = palette[shade];
      g.fillRect(x, y * 2, 1, 2);
    }
  }
  g.fillStyle = "#081c21";
  g.fillRect(8, 9, 16, 7);
  g.fillStyle = kind === 2 ? "#ffaf48" : "#def38b";
  g.fillRect(9, 11, 5, 2);
  g.fillRect(18, 11, 5, 2);
  g.fillStyle = "#152b30";
  g.fillRect(13, 16, 6, 3);
  g.fillStyle = "#afc29a";
  g.fillRect(12, 19, 8, 2);
  g.fillRect(15, 21, 2, 11);
  for (let i = 0; i < 3; i++) {
    g.fillRect(10, 23 + i * 3, 12, 1);
  }
  g.fillStyle = kind === 1 ? "#977045" : "#28554a";
  g.fillRect(7, 30, 18, 4);
  g.clearRect(14, 34, 4, 6);
  g.fillStyle = "#2b4846";
  g.fillRect(7, 36, 7, 4);
  g.fillRect(18, 36, 7, 4);
  if (kind === 2) {
    g.fillStyle = "#c9ba85";
    g.fillRect(3, 3, 4, 3);
    g.fillRect(25, 3, 4, 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = t.minFilter = THREE.NearestFilter;
  return t;
}

export function cloudTexture() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 512;
  const g = c.getContext("2d")!,
    r = seededRandom(992);
  g.fillStyle = "#000";
  g.fillRect(0, 0, 1024, 512);
  g.lineCap = "round";
  for (let i = 0; i < 55; i++) {
    const x = r() * 1250 - 150,
      y = 80 + r() * 190,
      len = 120 + r() * 500,
      bend = (r() - 0.5) * 90;
    g.beginPath();
    g.moveTo(x, y);
    g.bezierCurveTo(
      x + len * 0.28,
      y + bend,
      x + len * 0.7,
      y - bend * 0.8,
      x + len,
      y - 15 - r() * 35,
    );
    g.lineWidth = 2 + r() * 13;
    g.strokeStyle = `rgba(220,240,225,${0.06 + r() * 0.19})`;
    g.shadowColor = "#dcefe6";
    g.shadowBlur = 12 + r() * 20;
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}
