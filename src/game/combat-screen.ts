import * as THREE from "three";
/** Simulation-time envelopes. Rapid hits saturate rather than stacking opaque screens. */
export class CombatScreen {
  private mesh: THREE.Mesh;
  private hurt = 0;
  private wash = 0;
  private celebration = 0;
  private uniforms = {
    hurt: { value: 0 },
    wash: { value: 0 },
    celebration: { value: 0 },
    clock: { value: 0 },
  };
  constructor(scene: THREE.Scene) {
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      vertexShader: `varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
      fragmentShader: `varying vec2 vUv; uniform float hurt; uniform float wash; uniform float celebration; uniform float clock;
        void main(){
          vec2 q=vUv*2.-1.;
          float edge=smoothstep(.37,1.15,max(abs(q.x),abs(q.y)));
          vec2 grid=floor(vUv*vec2(120.,70.));
          float grain=fract(sin(dot(grid,vec2(17.23,51.7)))*4137.3);
          float red=edge*hurt*(.62+.12*grain);
          float rays=0.;
          if(celebration>0.)rays=pow(max(0.,sin(atan(q.y,q.x)*11.+clock*.35)),14.);
          float blue=wash*.11+celebration*(.07+rays*.14)*smoothstep(0.,1.,length(q));
          float alpha=min(.65,red+blue);
          if(alpha<.002)discard;
          gl_FragColor=vec4(mix(vec3(.16,.84,.92),vec3(.67,.025,.085),red/max(.001,red+blue)),alpha);
          #include <colorspace_fragment>
        }`,
    });
    const mesh = (this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      material,
    ));
    mesh.visible = false;
    mesh.name = "procedural-screen-feedback";
    mesh.frustumCulled = false;
    mesh.renderOrder = 1000;
    scene.add(mesh);
  }
  hit() {
    this.hurt = Math.min(1, this.hurt + 0.8);
  }
  nova() {
    this.wash = 1;
  }
  level() {
    this.celebration = 1;
  }
  step(dt: number, reduced: boolean) {
    this.hurt = Math.max(0, this.hurt - dt * 2.8);
    this.wash = Math.max(0, this.wash - dt * 2.1);
    this.celebration = Math.max(0, this.celebration - dt * 1.45);
    this.mesh.visible = this.hurt + this.wash + this.celebration > 0.002;
    const gain = reduced ? 0.45 : 1;
    this.uniforms.hurt.value = this.hurt * gain;
    this.uniforms.wash.value = this.wash * gain;
    this.uniforms.celebration.value = this.celebration * gain;
    this.uniforms.clock.value += dt;
  }
  diagnostics() {
    return { hurt: this.hurt, nova: this.wash, level: this.celebration };
  }
  reset() {
    this.hurt = this.wash = this.celebration = 0;
    this.step(0, false);
  }
}
