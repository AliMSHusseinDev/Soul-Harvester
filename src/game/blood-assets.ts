import * as THREE from "three";
let cached:
  | {
      splatter: THREE.Texture;
      bleeding: THREE.Texture;
      ready: Promise<unknown>;
    }
  | undefined;
/** Two shared, original user PNGs, not animated sheets. Loaded once before combat is ready. */
export function bloodAssets() {
  if (cached) return cached;
  if (typeof document === "undefined") {
    const white = () =>
      new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    return (cached = {
      splatter: white(),
      bleeding: white(),
      ready: Promise.resolve(),
    });
  }
  const loader = new THREE.TextureLoader();
  const pending: Promise<unknown>[] = [];
  const load = (url: string) => {
    let resolve!: (v: unknown) => void, reject!: (e: unknown) => void;
    pending.push(
      new Promise((r, j) => {
        resolve = r;
        reject = j;
      }),
    );
    const tex = loader.load(url, resolve, undefined, reject);
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
  const splatter = load(
      new URL("./assets/blood-splatter.png", import.meta.url).href,
    ),
    bleeding = load(
      new URL("./assets/blood-bleeding.png", import.meta.url).href,
    );
  return (cached = { splatter, bleeding, ready: Promise.all(pending) });
}
