import { setTerrainBrushes } from "./developer-terrain";
import { TUNING } from "./tuning";
export interface DevObject {
  id: string;
  kind: "block" | "rock" | "tree";
  texture: string;
  color: string;
  position: number[];
  scale: number[];
  yaw: number;
}
export interface Brush {
  x: number;
  z: number;
  radius: number;
  height: number;
}
export interface DevProject {
  version: 1;
  tuning: Record<string, number | boolean>;
  objects: DevObject[];
  brushes: Brush[];
  graphics: { fog: string; background: string; terrain: string };
  textures: Record<string, string>;
}
export const DEV_KEY = "soul-harvester.developer.v1";
export const TEXTURES = [
  "stone",
  "grass",
  "wood",
  "bark",
  "leaves",
  "pine",
  "tuft",
  "paver",
  "rock",
  "steel",
  "brass",
  "leather",
  "skin",
  "coin",
  "crystal",
  "spark",
  "flash",
  "ivy",
  "dirt",
  "bush",
];
export interface Setting {
  path: string;
  value: number | boolean;
  color: boolean;
  min: number;
  max: number;
  step: number;
  description: string;
}
const descriptions: Record<string, string> = {
  effects:
    "Particle presentation. Colors use hex. Counts and pools need whole numbers. Shader constants and pool capacities require Reload saved project.",
  lighting:
    "World lighting. Exposure and fog apply immediately; light construction settings require Reload.",
  environment:
    "Wind, clouds and environment. Rebuild-dependent changes require Reload.",
  map: "Base map coordinates. Reload saved project after changes.",
  player:
    "Movement, stamina and player balance. Existing state may need Reload.",
  enemies: "Enemy type attributes; Reload to recreate existing actors.",
  weapons:
    "Weapon timings, ammo and handling; Reload for existing weapon state.",
  loot: "Drop spread, floating clearance, attraction and acceleration.",
  combat:
    "Damage, critical chance and combat rules. Probabilities are fractions from 0 to 1.",
};
function flatten(v: unknown, path = "", out: Setting[] = []): Setting[] {
  if ((typeof v === "number" && Number.isFinite(v)) || typeof v === "boolean") {
    const n = typeof v === "number" ? v : 0,
      key = path.split(".").at(-1)!;
    const color = /color$/i.test(key);
    const probability =
      /chance|probability|density/i.test(key) && n >= 0 && n <= 1;
    const positive =
      /capacity|cells|duration|interval|cooldown|lifemin|lifegain|drag|frequency/i.test(
        key,
      );
    out.push({
      path,
      value: v as number | boolean,
      color,
      min: /fov/i.test(key)
        ? 10
        : positive && n !== 0
          ? /capacity|cells/i.test(key)
            ? 1
            : 0.001
          : color
            ? 0
            : probability
              ? 0
              : n < 0
                ? -Math.max(100, Math.abs(n) * 20)
                : 0,
      max: /fov/i.test(key)
        ? 140
        : color
          ? 0xffffff
          : probability
            ? 1
            : Math.max(10, Math.abs(n) * 20),
      step: color ? 1 : Number.isInteger(n) && Math.abs(n) > 1 ? 1 : 0.001,
      description:
        descriptions[path.split(".")[0]] ??
        "Game tuning. Changes apply where read live; Reload saved project rebuilds cached values.",
    });
  } else if (v && typeof v === "object")
    for (const [k, x] of Object.entries(v))
      flatten(x, path ? `${path}.${k}` : k, out);
  return out;
}
export const SETTINGS = flatten(TUNING);
export const DEFAULT_TUNING = Object.fromEntries(
  SETTINGS.map((s) => [s.path, s.value]),
);
const schema = new Map(SETTINGS.map((s) => [s.path, s]));
export function applyTuning(values: Record<string, number | boolean>) {
  for (const [path, value] of Object.entries(values)) {
    const s = schema.get(path);
    if (!s || typeof value !== typeof s.value) continue;
    if (
      typeof value === "number" &&
      (!Number.isFinite(value) ||
        value < s.min ||
        value > s.max ||
        (s.step === 1 && !Number.isInteger(value)))
    )
      continue;
    const keys = path.split(".");
    let target: any = TUNING;
    for (const k of keys.slice(0, -1)) target = target[k];
    target[keys.at(-1)!] = value;
  }
}
export function emptyProject(): DevProject {
  return {
    version: 1,
    tuning: {},
    objects: [],
    brushes: [],
    graphics: { fog: "#28665e", background: "#123e46", terrain: "#ffffff" },
    textures: {},
  };
}
const finite = (n: unknown, min: number, max: number) =>
  typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
const color = (s: unknown) => typeof s === "string" && /^#[\da-f]{6}$/i.test(s);
export function validateProject(input: unknown): DevProject {
  if (!input || typeof input !== "object" || (input as any).version !== 1)
    throw Error("Unsupported project version.");
  const a = input as any;
  const p = emptyProject();
  if (
    !a.tuning ||
    typeof a.tuning !== "object" ||
    !Array.isArray(a.objects) ||
    !Array.isArray(a.brushes) ||
    a.objects.length > 512 ||
    a.brushes.length > 128
  )
    throw Error("Invalid project or project limits exceeded.");
  for (const [k, v] of Object.entries(a.tuning)) {
    const s = schema.get(k);
    if (
      !s ||
      typeof v !== typeof s.value ||
      (typeof v === "number" &&
        (!finite(v, s.min, s.max) || (s.step === 1 && !Number.isInteger(v))))
    )
      throw Error(`Invalid setting: ${k}`);
    p.tuning[k] = v as number | boolean;
  }
  const values = { ...DEFAULT_TUNING, ...p.tuning };
  for (const prefix of ["map", "spawning"])
    for (const axis of ["X", "Z"]) {
      const min = Number(values[`${prefix}.min${axis}`]),
        max = Number(values[`${prefix}.max${axis}`]);
      if (!(min < max) || max - min > 500)
        throw Error(
          `${prefix} ${axis}: minimum must be below maximum; maximum span is 500 metres.`,
        );
    }
  if (Number(values["effects.reservedSlots"]) >= 1536)
    throw Error("Particle reserve must be smaller than 1536 slots.");
  const ids = new Set();
  for (const o of a.objects) {
    if (
      !o ||
      typeof o.id !== "string" ||
      o.id.length > 80 ||
      ids.has(o.id) ||
      !["block", "rock", "tree"].includes(o.kind) ||
      typeof o.texture !== "string" ||
      o.texture.length > 80 ||
      !color(o.color) ||
      !Array.isArray(o.position) ||
      o.position.length !== 3 ||
      !o.position.every((n: unknown) => finite(n, -1000, 1000)) ||
      !Array.isArray(o.scale) ||
      o.scale.length !== 3 ||
      !o.scale.every((n: unknown) => finite(n, 0.1, 100)) ||
      !finite(o.yaw, -360, 360)
    )
      throw Error("Invalid map object.");
    ids.add(o.id);
    p.objects.push(structuredClone(o));
  }
  for (const b of a.brushes) {
    if (
      !b ||
      !finite(b.x, -500, 500) ||
      !finite(b.z, -500, 500) ||
      !finite(b.radius, 1, 80) ||
      !finite(b.height, -20, 20)
    )
      throw Error("Invalid terrain brush.");
    p.brushes.push({ x: b.x, z: b.z, radius: b.radius, height: b.height });
  }
  for (const k of ["fog", "background", "terrain"] as const) {
    if (!color(a.graphics?.[k])) throw Error("Invalid world color.");
    p.graphics[k] = a.graphics[k];
  }
  for (const [id, url] of Object.entries(a.textures ?? {})) {
    if (
      !/^custom-[\w-]+$/.test(id) ||
      typeof url !== "string" ||
      url.length > 1500000 ||
      !/^data:image\/(png|jpeg|webp);base64,[\w+/=]+$/.test(url) ||
      Object.keys(p.textures).length >= 8
    )
      throw Error(
        "Invalid custom texture. Use PNG/JPEG/WebP, max eight images.",
      );
    p.textures[id] = url;
  }
  if (
    p.objects.some(
      (o) =>
        !TEXTURES.includes(o.texture) && !Object.hasOwn(p.textures, o.texture),
    )
  )
    throw Error("Missing object texture.");
  return p;
}
export function readProject(): DevProject {
  try {
    const raw = localStorage.getItem(DEV_KEY);
    return raw ? validateProject(JSON.parse(raw)) : emptyProject();
  } catch {
    return emptyProject();
  }
}
export function loadDeveloperProject() {
  const p = readProject();
  applyTuning(p.tuning);
  setTerrainBrushes(p.brushes);
  return p;
}
