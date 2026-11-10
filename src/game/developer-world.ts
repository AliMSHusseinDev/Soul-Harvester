import * as THREE from "three";
import { World } from "./world";
import { WorldRaycast } from "./world-raycast";
import { surface, type Surface } from "./surfaces";
import { islandGeometry } from "./island";
import { setTerrainBrushes } from "./developer-terrain";
import type { DevObject, DevProject } from "./developer-project";
const customTextureCache = new Map<string, THREE.Texture>();
export const editorRootName = "Developer placed objects";
export function editorMesh(o: DevObject, p: DevProject): THREE.Mesh {
  const url = p.textures[o.texture];
  let texture = url ? customTextureCache.get(url) : undefined;
  if (!texture) {
    texture = url
      ? new THREE.TextureLoader().load(url)
      : surface(o.texture as Surface);
    if (url) customTextureCache.set(url, texture);
  }
  if (p.textures[o.texture]) {
    texture.name = "Original pixel stone custom";
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
  }
  const g =
    o.kind === "rock"
      ? new THREE.IcosahedronGeometry(0.7, 0)
      : o.kind === "tree"
        ? new THREE.ConeGeometry(0.65, 1, 6)
        : new THREE.BoxGeometry(1, 1, 1);
  const m = new THREE.Mesh(
    g,
    new THREE.MeshStandardMaterial({
      map: texture,
      color: o.color,
      roughness: 0.9,
    }),
  );
  m.position.fromArray(o.position);
  m.scale.fromArray(o.scale);
  m.rotation.y = (o.yaw * Math.PI) / 180;
  m.userData.devId = o.id;
  m.castShadow = m.receiveShadow = true;
  return m;
}
export function applyDeveloperWorld(
  world: World,
  p: DevProject,
  rebuild = true,
) {
  setTerrainBrushes(p.brushes);
  const old = world.scene.getObjectByName(editorRootName);
  if (old) {
    old.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        if (o.material instanceof THREE.Material) {
          const m = o.material as THREE.MeshStandardMaterial;
          m.dispose();
        }
      }
    });
    world.scene.remove(old);
  }
  const retained = new Set(Object.values(p.textures));
  for (const [url, texture] of customTextureCache)
    if (!retained.has(url)) {
      texture.dispose();
      customTextureCache.delete(url);
    }
  const root = new THREE.Group();
  root.name = editorRootName;
  for (const o of p.objects) root.add(editorMesh(o, p));
  world.scene.add(root);
  const terrain = world.scene.getObjectByName(
    "Continuous island terrain",
  ) as THREE.Mesh;
  if (terrain) {
    if (rebuild) {
      terrain.geometry.dispose();
      terrain.geometry = islandGeometry();
    }
    if (terrain.material instanceof THREE.MeshStandardMaterial)
      terrain.material.color.set(p.graphics.terrain);
  }
  if (world.scene.fog instanceof THREE.FogExp2)
    world.scene.fog.color.set(p.graphics.fog);
  if (world.scene.background instanceof THREE.Color)
    world.scene.background.set(p.graphics.background);
  appendDeveloperSolids(world, p);
  world.ballistics = new WorldRaycast(world.scene);
}
export function appendDeveloperSolids(world: World, p: DevProject) {
  const count = Number(world.scene.userData.developerColliderCount ?? 0);
  if (count) world.solids.splice(world.solids.length - count, count);
  const start = world.solids.length;
  const root = world.scene.getObjectByName(editorRootName);
  root?.updateMatrixWorld(true);
  root?.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      const b = new THREE.Box3().setFromObject(o);
      world.solids.push({
        minX: b.min.x,
        maxX: b.max.x,
        minZ: b.min.z,
        maxZ: b.max.z,
        height: b.max.y,
        base: b.min.y,
      });
    }
  });
  world.scene.userData.developerColliderCount = world.solids.length - start;
}
