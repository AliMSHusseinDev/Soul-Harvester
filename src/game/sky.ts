import * as THREE from "three";
import { glowTexture } from "./textures";

/** Direction-space clouds are continuous across 360 degrees: no spherical UV seam. */
export const SKY_FRAGMENT = `
varying vec3 direction;
uniform float time;
float hash(vec3 p) {
  p=fract(p*.3183099+vec3(.17,.31,.53));
  p*=17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z));
}
float noise3(vec3 p) {
  vec3 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),
    mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
    mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float cloudNoise(vec3 p) {
  return noise3(p)*.57+noise3(p*2.03+9.1)*.28+noise3(p*4.07+21.7)*.15;
}
void main(){
  vec3 n=normalize(direction);
  float h=n.y;
  vec3 moonDir=normalize(vec3(0.,66.,-220.));
  float lunar=pow(max(0.,dot(n,moonDir)),18.);
  vec3 c=mix(vec3(.014,.046,.060),vec3(.0015,.007,.014),smoothstep(0.,.85,h));
  vec3 q=n*vec3(2.8,22.,2.8)+vec3(time*.004,0.,time*.001);
  q.y+=n.x*5.+n.z*2.;
  float warp=cloudNoise(q*.63);
  float clouds=cloudNoise(q+vec3(warp*1.7,warp*.8,warp));
  float band=smoothstep(.44,.72,clouds);
  float horizon=smoothstep(-.04,.14,h);
  c+=vec3(.040,.12,.115)*lunar;
  c+=mix(vec3(.075,.13,.14),vec3(.19,.30,.27),lunar)*band*horizon;
  float star=step(.9995,hash(floor(n*650.)))*pow(max(0.,h),.6)*(1.-band);
  c+=vec3(.15,.19,.19)*star;
  vec3 lunarUp=normalize(cross(vec3(1.,0.,0.),moonDir));
  float a=atan(dot(n,lunarUp),n.x);
  float shafts=pow(.5+.5*sin(a*17.+sin(a*3.)*.7),12.)*lunar*(1.-pow(max(0.,dot(n,moonDir)),70.));
  c+=vec3(.008,.025,.02)*shafts*horizon*(1.-band*.8);
  gl_FragColor=vec4(c,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
export class Sky {
  private group = new THREE.Group();
  private material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { time: { value: 0 } },
    vertexShader:
      "varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: SKY_FRAGMENT,
  });
  constructor(scene: THREE.Scene) {
    this.group.name = "Continuous lunar sky";
    this.group.userData.terrainExempt = true;
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(390, 48, 24),
      this.material,
    );
    dome.frustumCulled = false;
    // Draw after opaque scenery so depth rejection avoids shading hidden clouds.
    dome.renderOrder = 1000;
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(50, 48, 32),
      new THREE.MeshBasicMaterial({ color: 0xd4ffe0, fog: false }),
    );
    moon.position.set(0, 66, -220);
    moon.scale.y = 1.2;
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(),
        color: 0x8de5c6,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    halo.position.set(0, 66, -221);
    halo.scale.set(170, 170, 1);
    this.group.add(dome, moon, halo);
    scene.add(this.group);
  }
  update(time: number, eye: THREE.Vector3) {
    this.material.uniforms.time.value = time;
    this.group.position.copy(eye);
  }
}
