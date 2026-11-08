import * as THREE from "three";
import { seededRandom } from "./math";

export type Surface =
  | "stone"
  | "grass"
  | "wood"
  | "bark"
  | "leaves"
  | "pine"
  | "tuft"
  | "paver"
  | "rock"
  | "steel"
  | "brass"
  | "leather"
  | "skin"
  | "coin"
  | "crystal"
  | "spark"
  | "flash"
  | "ivy"
  | "dirt"
  | "bush";
const cache = new Map<Surface, THREE.CanvasTexture>();
/** Original pixel art. Small tiles and nearest magnification retain a consistent texel scale. */
export function surface(kind: Surface): THREE.CanvasTexture {
  const cached = cache.get(kind);
  if (cached) return cached;
  const cutout = ["pine", "tuft", "spark", "flash", "ivy", "bush"].includes(
      kind,
    ),
    size = kind === "pine" ? 64 : 32,
    c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d")!,
    r = seededRandom(
      471 + kind.split("").reduce((n, c) => n + c.charCodeAt(0), 0),
    );
  g.imageSmoothingEnabled = false;
  const pixel = (x: number, y: number, color: string, w = 1, h = 1) => {
    g.fillStyle = color;
    // Pine authoring coordinates are tall; rasterize directly into one 64px tile.
    const sx = kind === "pine" ? 0.5 : 1,
      sy = kind === "pine" ? 0.25 : 1;
    g.fillRect(
      Math.floor(x * sx),
      Math.floor(y * sy),
      Math.max(1, Math.ceil(w * sx)),
      Math.max(1, Math.ceil(h * sy)),
    );
  };
  const palettes: Partial<Record<Surface, readonly string[]>> = {
    stone: ["#2e4037", "#3e5347", "#4c6051", "#657662", "#24392f"],
    grass: ["#143c25", "#1a502e", "#286a37", "#3b803e", "#528a43"],
    wood: ["#51442d", "#655036", "#7b6140", "#9b784b", "#382f24"],
    bark: ["#332e23", "#4c4030", "#665039", "#816247", "#29291f"],
    leaves: ["#142d22", "#224b30", "#326342", "#48784b", "#61854e"],
    rock: ["#293b39", "#3c5049", "#536359", "#697467", "#263633"],
    steel: ["#263530", "#35463d", "#43544c", "#52635b", "#273a34"],
    brass: ["#725023", "#a37b32", "#c2963c", "#dfb448", "#edcb6b"],
    leather: ["#332c29", "#49392f", "#604633", "#79583b", "#302b27"],
    skin: ["#ae8b73", "#b5947b", "#b99b81", "#bda085", "#b09077"],
    dirt: ["#313a22", "#45462b", "#575336", "#666241", "#384f2b"],
    crystal: ["#126e9c", "#2095bf", "#48c3dd", "#a0edeb", "#167da7"],
    paver: ["#47574f", "#5c6859", "#727a66", "#858a72", "#344b3a"],
  };
  if (kind === "spark" || kind === "flash") {
    const mid = 16;
    pixel(mid - 2, mid - 2, "#ffffff", 4, 4);
    for (let i = 0; i < (kind === "flash" ? 12 : 7); i++) {
      const width = Math.max(1, 4 - Math.floor(i / 3)),
        col = i < 5 ? "#fff3b8" : "#c4974380";
      pixel(mid - width / 2, mid - i, col, width, 2);
      pixel(mid - width / 2, mid + i, col, width, 2);
      pixel(mid - i, mid - width / 2, col, 2, width);
      pixel(mid + i, mid - width / 2, col, 2, width);
    }
  } else if (kind === "coin") {
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        const d = Math.hypot(x - 15.5, y - 15.5);
        const col =
          d > 15
            ? "#70401e"
            : d > 13
              ? "#ae6b2e"
              : d > 11
                ? "#e2b75c"
                : d > 9
                  ? "#78451f"
                  : y < 15
                    ? "#c68e41"
                    : "#a76b2c";
        pixel(x, y, col);
      }
    for (let y = 8; y < 24; y++)
      for (let x = 8; x < 24; x++)
        if (Math.abs(x - 15.5) + Math.abs(y - 15.5) < 6)
          pixel(x, y, x + y < 31 ? "#f5cf7b" : "#8c5624");
  } else if (kind === "ivy" || kind === "bush") {
    const greens = ["#1b3b25", "#315832", "#4b783f", "#6b8e4d"];
    for (let vine = 0; vine < 5; vine++) {
      let x = 4 + vine * 6;
      for (let y = 0; y < 32; y++) {
        x +=
          Math.sin(y * 0.9 + vine) > 0.5
            ? 1
            : Math.sin(y * 0.9 + vine) < -0.5
              ? -1
              : 0;
        pixel(x, y, greens[1]);
        if (
          y % 3 === 0 &&
          (kind === "ivy" || Math.hypot(x - 16, y - 19) < 16)
        ) {
          const dir = y % 2 ? 1 : -1;
          pixel(x + dir * 2, y, greens[2], 3, 2);
          pixel(x + dir * 3, y + 1, greens[3], 2, 1);
        }
      }
    }
  } else if (kind === "pine") {
    // Branches have jagged, alpha-cut silhouettes rather than solid cone caps.
    const colors = ["#152f25", "#224b36", "#326345", "#417952", "#629060"];
    for (let tier = 0; tier < 13; tier++) {
      const y = 12 + tier * 16,
        width = 6 + tier * 3.4;
      for (let dy = 0; dy < 27; dy++) {
        const spread = width * (0.2 + Math.min(1, dy / 19));
        for (let x = 64 - spread; x < 64 + spread; x++) {
          if (dy > 17 && r() < 0.22) continue;
          if (r() < 0.025) continue;
          const shade = Math.min(
            4,
            Math.floor((1 - dy / 30) * 2 + r() * 2 + (x < 64 ? 0.3 : 0)),
          );
          pixel(x, y + dy, colors[shade], 1, 2);
        }
      }
      for (let branch = 0; branch < 5; branch++) {
        const direction = branch % 2 ? 1 : -1,
          length = width * (0.45 + r() * 0.55),
          start = y + 10 + r() * 9;
        for (let n = 0; n < length; n++)
          pixel(
            64 + direction * n,
            start + n * 0.15,
            colors[1 + Math.floor(r() * 3)],
            2,
            2,
          );
      }
    }
  } else if (kind === "tuft") {
    for (let blade = 0; blade < 9; blade++) {
      const x = 3 + blade * 3,
        height = 8 + r() * 21;
      for (let y = 0; y < height; y++) {
        const lean = Math.sin(blade * 2) * y * 0.15;
        pixel(
          x + lean,
          31 - y,
          y > height * 0.6 ? "#70954a" : blade % 2 ? "#426b34" : "#294c2c",
          y < height * 0.7 ? 2 : 1,
          1,
        );
      }
    }
  } else {
    const p = palettes[kind]!;
    pixel(0, 0, p[1], 32, 32);
    if (kind === "stone") {
      pixel(0, 0, p[4], 32, 32);
      for (let row = 0; row < 4; row++)
        for (let col = -1; col < 2; col++) {
          const x = col * 16 + (row % 2) * 8,
            y = row * 8;
          pixel(x + 1, y + 1, p[1 + Math.floor(r() * 2)], 15, 7);
          pixel(x + 2, y + 1, p[2], 5, 1);
          pixel(x + 10, y + 1, p[2], 4, 1);
          pixel(x + 1, y + 6, p[0], 15, 1);
          for (let i = 0; i < 10; i++)
            pixel(
              x + 1 + r() * 14,
              y + 2 + r() * 4,
              p[1 + Math.floor(r() * 2)],
            );
          if (r() < 0.7) {
            pixel(x + 4, y + 4, "#3c5239", 3, 1);
            pixel(x + 6, y + 5, "#516543", 2, 1);
          }
        }
    } else if (kind === "wood" || kind === "bark") {
      const vertical = kind === "bark";
      for (let line = 0; line < 32; line++) {
        const shade = p[Math.floor(r() * p.length)];
        for (let n = 0; n < 32; n++) {
          const bend = Math.sin(n * 0.3 + line) * 1.1;
          pixel(
            vertical ? line + bend : n,
            vertical ? n : line + bend,
            shade,
            1,
            1,
          );
        }
      }
      for (let i = 0; i < 9; i++)
        pixel(r() * 32, r() * 32, p[3], vertical ? 1 : 3, vertical ? 4 : 1);
    } else if (kind === "paver") {
      for (let i = 0; i < 300; i++)
        pixel(r() * 32, r() * 32, p[Math.floor(r() * 4)], (1 + r() * 2) | 0, 1);
      pixel(0, 0, p[3], 32, 1);
      pixel(0, 0, p[3], 1, 32);
      pixel(0, 31, p[0], 32, 1);
      pixel(31, 0, p[0], 1, 32);
      let x = 7 + r() * 16;
      for (let y = 0; y < 32; y++) {
        if (r() < 0.35) x += r() < 0.5 ? -1 : 1;
        pixel(x, y, p[4]);
      }
      for (let i = 0; i < 18; i++)
        pixel(r() < 0.5 ? r() * 5 : 27 + r() * 5, r() * 32, "#405e32", 2, 1);
    } else if (kind === "skin" || kind === "steel" || kind === "brass") {
      pixel(0, 0, p[1], 32, 32);
      for (let i = 0; i < 70; i++)
        pixel(r() * 32, r() * 32, p[1 + Math.floor(r() * 2)]);
      if (kind !== "skin") {
        for (let i = 0; i < 10; i++)
          pixel(r() * 32, r() * 32, p[2], (2 + r() * 5) | 0, 1);
        pixel(0, 0, p[3], 32, 1);
        pixel(0, 31, p[0], 32, 1);
      }
    } else {
      for (let i = 0; i < 700; i++) {
        const x = r() * 32,
          y = r() * 32,
          shade = p[Math.floor(r() * p.length)];
        pixel(
          x,
          y,
          shade,
          kind === "grass" || kind === "leaves" ? 2 : 1,
          (1 + r() * 2) | 0,
        );
      }
      if (kind === "leaves") {
        for (let i = 0; i < 110; i++) {
          const x = r() * 32,
            y = r() * 32;
          pixel(x, y, p[3], 2, 1);
          pixel(x + 1, y + 1, p[0], 2, 1);
        }
      }
    }
  }
  const texture = new THREE.CanvasTexture(c);
  texture.name = `Original pixel ${kind}`;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapLinearFilter;
  texture.anisotropy = 4;
  texture.wrapS = texture.wrapT = cutout
    ? THREE.ClampToEdgeWrapping
    : THREE.RepeatWrapping;
  cache.set(kind, texture);
  return texture;
}
export function surfaceSummary() {
  return [...cache].map(([name, t]) => ({
    name,
    width: t.image.width,
    height: t.image.height,
    nearest: t.magFilter === THREE.NearestFilter,
  }));
}

/** Planar per-face projection in metres, independent of primitive dimensions. */
export function surfaceUV(g: THREE.BufferGeometry, tileMetres = 2) {
  const p = g.attributes.position,
    n = g.attributes.normal,
    uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = Math.abs(n.getX(i)),
      y = Math.abs(n.getY(i)),
      z = Math.abs(n.getZ(i));
    uv[i * 2] = (x > y && x > z ? p.getZ(i) : p.getX(i)) / tileMetres;
    uv[i * 2 + 1] = (y >= x && y >= z ? p.getZ(i) : p.getY(i)) / tileMetres;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return g;
}
