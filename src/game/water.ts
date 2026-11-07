import * as THREE from "three";
import { islandHeight, ISLAND_BOUNDS as B, OCEAN_Y } from "./island";
export class Water {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  constructor(scene: THREE.Scene) {
    const size = 192,
      data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const wx = B.minX + (x / (size - 1)) * (B.maxX - B.minX),
          wz = B.minZ + (y / (size - 1)) * (B.maxZ - B.minZ),
          i = (y * size + x) * 4;
        data[i] = Math.round(
          255 * Math.max(0, Math.min(1, (OCEAN_Y - islandHeight(wx, wz)) / 24)),
        );
        data[i + 3] = 255;
      }
    const depth = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    depth.minFilter = depth.magFilter = THREE.LinearFilter;
    depth.needsUpdate = true;
    const material = new THREE.ShaderMaterial({
      fog: true,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: { value: 0 },
          uDepth: { value: depth },
          uEye: { value: new THREE.Vector3() },
        },
      ]),
      vertexShader: `#include <common>
      #include <fog_pars_vertex>
      uniform float uTime;varying vec3 vWorld;
      void main(){vec3 p=position;p.y+=sin(p.x*.17+p.z*.13+uTime*.9)*.055+sin(p.x*-.11+p.z*.23-uTime*.65)*.03;
      vWorld=(modelMatrix*vec4(p,1.)).xyz;vec4 mvPosition=viewMatrix*vec4(vWorld,1.);gl_Position=projectionMatrix*mvPosition;
      #include <fog_vertex>
      }`,
      fragmentShader: `#include <common>
      #include <fog_pars_fragment>
      uniform float uTime;uniform sampler2D uDepth;uniform vec3 uEye;varying vec3 vWorld;
      void main(){vec2 p=vWorld.xz;float a=p.x*.17+p.y*.13+uTime*.9,b=p.x*-.11+p.y*.23-uTime*.65;
      vec3 n=normalize(vec3(-cos(a)*.038+cos(b)*.018,1.,-cos(a)*.031-cos(b)*.026));
      vec2 uv=(p-vec2(-230.,-300.))/vec2(460.,500.);float inside=step(0.,uv.x)*step(uv.x,1.)*step(0.,uv.y)*step(uv.y,1.);
      float depth=mix(1.,texture2D(uDepth,clamp(uv,0.,1.)).r,inside);
      vec3 view=normalize(uEye-vWorld);float fres=pow(1.-max(0.,dot(view,n)),3.);
      vec3 c=mix(vec3(.035,.22,.225),vec3(.012,.065,.10),smoothstep(0.,.65,depth));
      float cloud=.5+.5*sin(p.x*.025+p.y*.033+uTime*.04);c=mix(c,vec3(.18,.31,.32)*( .7+cloud*.3),fres*.32);
      float highlight=pow(max(0.,dot(n,normalize(view+normalize(vec3(-.2,.65,-.7))))),70.);c+=vec3(.44,.64,.57)*highlight*.14;
      float line=abs(sin(p.x*.74+p.y*.31+sin(p.y*.22)*.8+uTime*.9));float aa=.025+fwidth(line);float crest=(1.-smoothstep(.015,aa+.04,line))*(.4+.6*smoothstep(-.2,.7,sin(p.x*.19-p.y*.23)));c+=vec3(.045,.13,.12)*crest*.5;c*=.92+.08*sin(p.x*.12+p.y*.16+uTime*.2);
      float ripple=sin(p.x*.7+p.y*.56+uTime*1.4)*sin(p.x*.19-p.y*.26-uTime*.6);c+=vec3(.025,.07,.065)*smoothstep(.45,1.,ripple)*.3;
      float foam=(1.-smoothstep(.006,.07,depth))*smoothstep(.3,.8,.5+.5*sin(p.x*.6+p.y*.43+uTime));c=mix(c,vec3(.35,.49,.44),foam*.16);
      gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      #include <fog_fragment>
      }`,
    });
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1100, 1100, 64, 64).rotateX(-Math.PI / 2),
      material,
    );
    this.mesh.position.y = OCEAN_Y;
    this.mesh.userData.terrainExempt = true;
    this.mesh.name = "Animated island ocean";
    scene.add(this.mesh);
  }
  update(time: number, eye: THREE.Vector3) {
    this.mesh.material.uniforms.uTime.value = time;
    this.mesh.material.uniforms.uEye.value.copy(eye);
  }
}
