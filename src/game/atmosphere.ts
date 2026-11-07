import * as THREE from "three";
import { PRESENTATION as P } from "./tuning";
import { seededRandom } from "./math";
import { groundHeight, isRiver } from "./terrain";
import { glowTexture } from "./textures";
export class Atmosphere {
  private mesh: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  readonly budget = P.ambientMotes;
  constructor(scene: THREE.Scene) {
    const random = seededRandom(8081),
      positions: number[] = [],
      colors: number[] = [],
      phases: number[] = [],
      sizes: number[] = [],
      tint = new THREE.Color();
    for (let i = 0; i < this.budget; i++) {
      let x = (random() - 0.5) * 56,
        z = 25 - random() * 88;
      while (isRiver(x, z)) {
        x = (random() - 0.5) * 56;
        z = 25 - random() * 88;
      }
      positions.push(x, groundHeight(x, z) + 0.5 + random() * 5, z);
      phases.push(random() * 6.28);
      sizes.push(i % 11 === 0 ? 0.13 : 0.065);
      tint.set(i % 11 === 0 ? 0xcba66b : i % 4 === 0 ? 0xc2d7d5 : 0x73b9b6);
      colors.push(tint.r, tint.g, tint.b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    g.setAttribute("aPhase", new THREE.Float32BufferAttribute(phases, 1));
    g.setAttribute("aSize", new THREE.Float32BufferAttribute(sizes, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: { value: 0 },
          uHeight: { value: 720 },
          uReduced: { value: 1 },
          uMap: { value: glowTexture() },
        },
      ]),
      vertexShader: `#include <common>
      #include <fog_pars_vertex>
      attribute vec3 color;attribute float aPhase;attribute float aSize;uniform float uTime;uniform float uHeight;uniform float uReduced;varying vec3 vTint;varying float vAlpha;
      void main(){vec3 p=position;p.x+=sin(uTime*.19+aPhase)*.45;p.z+=cos(uTime*.13+aPhase*2.)*.35;p.y+=sin(uTime*.3+aPhase)*.4;
      vec4 mvPosition=modelViewMatrix*vec4(p,1.);float d=length(mvPosition.xyz);vTint=color;vAlpha=smoothstep(1.8,5.,d)*(1.-smoothstep(35.,62.,d))*(.16+.12*sin(uTime*.8+aPhase))*uReduced;
      gl_Position=projectionMatrix*mvPosition;gl_PointSize=clamp(aSize*uHeight/max(1.,-mvPosition.z),1.,3.5);
      #include <fog_vertex>
      }`,
      fragmentShader: `#include <common>
      #include <fog_pars_fragment>
      uniform sampler2D uMap;varying vec3 vTint;varying float vAlpha;
      void main(){gl_FragColor=vec4(vTint,texture2D(uMap,gl_PointCoord).a*vAlpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
      }`,
    });
    this.mesh = new THREE.Points(g, m);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }
  update(time: number, height: number, reduced: boolean) {
    const u = this.mesh.material.uniforms;
    u.uTime.value = time;
    u.uHeight.value = height;
    u.uReduced.value = reduced ? 0.45 : 1;
  }
}
