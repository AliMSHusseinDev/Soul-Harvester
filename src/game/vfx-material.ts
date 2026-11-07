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

/** Cube faces keep directional shading as fragments rotate in world space. */
export function voxelFragmentMaterial() {
  const material = fadingMaterial(true),
    compile = material.onBeforeCompile;
  // Closed cuboids need only their outward faces; avoid a second transparent pass.
  material.side = THREE.FrontSide;
  material.onBeforeCompile = (shader, renderer) => {
    compile(shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying float vVoxelLight;",
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vec3 voxelNormal=normalize(mat3(modelMatrix)*mat3(instanceMatrix)*normal);
        vVoxelLight=.58+.42*max(0.,dot(voxelNormal,normalize(vec3(-.4,1.,.5))));`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying float vVoxelLight;",
      )
      .replace(
        "#include <color_fragment>",
        "#include <color_fragment>\ndiffuseColor.rgb*=vVoxelLight;",
      );
  };
  material.customProgramCacheKey = () => "world-voxel-fragments-v1";
  return material;
}
