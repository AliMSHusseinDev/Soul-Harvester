import * as THREE from "three";
/** Shared per-instance opacity, used by the bounded impact, smoke and tracer batches. */
export function fadingMaterial(
  colored: boolean,
  map: THREE.Texture | null = null,
) {
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    // Instance colors are enabled by InstancedMesh itself. These planes have no
    // per-vertex color attribute; enabling USE_COLOR would multiply them by zero.
    vertexColors: false,
    map,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    alphaTest: 0.001,
    blending: colored ? THREE.NormalBlending : THREE.AdditiveBlending,
    toneMapped: false,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float vfxOpacity; varying float vfOpacity;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvfOpacity=vfxOpacity;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying float vfOpacity;",
      )
      .replace(
        "#include <color_fragment>",
        "#include <color_fragment>\ndiffuseColor.a*=vfOpacity;",
      );
  };
  return material;
}
