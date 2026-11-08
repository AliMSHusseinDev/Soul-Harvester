import * as THREE from "three";
import { ENVIRONMENT } from "./tuning";
/** Shared coherent gusts bend tips only; the same deformation is used for shadow depth. */
export class Wind {
  readonly time = { value: 0 };
  readonly strength = { value: 1 };
  apply(material: THREE.Material, amplitude: number) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uWindTime = this.time;
      shader.uniforms.uWindStrength = this.strength;
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          `#include <common>
      uniform float uWindTime;uniform float uWindStrength;`,
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
      vec3 root=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
      float phase=root.x*.19+root.z*.13;
      float breeze=sin(uWindTime*${ENVIRONMENT.windSpeed.toFixed(3)}+phase)*.65+sin(uWindTime*${ENVIRONMENT.gustSpeed.toFixed(3)}+phase*.43)*.35;
      float tip=uv.y*uv.y;
      vec2 worldSway=vec2(1.,.38)*breeze*tip*${amplitude.toFixed(4)}*uWindStrength;
      mat3 inverseBasis=transpose(mat3(instanceMatrix));
      vec3 localSway=inverseBasis*vec3(worldSway.x,0.,worldSway.y);
      transformed+=localSway/vec3(dot(instanceMatrix[0].xyz,instanceMatrix[0].xyz),dot(instanceMatrix[1].xyz,instanceMatrix[1].xyz),dot(instanceMatrix[2].xyz,instanceMatrix[2].xyz));`,
        );
    };
    material.customProgramCacheKey = () => `rooted-wind-${amplitude}`;
  }
  update(time: number, reduced: boolean) {
    this.time.value = time;
    this.strength.value = reduced ? 0 : ENVIRONMENT.windStrength;
  }
}
