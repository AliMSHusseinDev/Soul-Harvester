import * as THREE from "three";
import { VFX } from "./tuning";
import type { SurfaceHit } from "./world-raycast";
/** Pooled, normal-aligned pixel scars; never allocate meshes at impact time. */
export class SurfaceImpacts {
  private items = Array.from({ length: VFX.decalCapacity }, () => ({
    life: 0,
    x: 0,
    y: 0,
    z: 0,
    nx: 0,
    ny: 1,
    nz: 0,
    size: 0.1,
    seed: 0,
    wood: 0,
    blood: 0,
  }));
  private cursor = 0;
  private mesh: THREE.InstancedMesh;
  private state = new THREE.InstancedBufferAttribute(
    new Float32Array(VFX.decalCapacity * 4),
    4,
  );
  private dummy = new THREE.Object3D();
  private normal = new THREE.Vector3();
  private zAxis = new THREE.Vector3(0, 0, 1);
  total = 0;
  constructor(scene: THREE.Scene) {
    const g = new THREE.PlaneGeometry(1, 1);
    g.setAttribute("impactState", this.state);
    this.mesh = new THREE.InstancedMesh(
      g,
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        vertexShader: `attribute vec4 impactState;varying vec2 vUv;varying vec4 vState;void main(){vUv=uv;vState=impactState;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
        fragmentShader: `
          varying vec2 vUv; varying vec4 vState;
          void main(){
            vec2 q=(floor(vUv*16.)+.5)/16.*2.-1.;
            float r=length(q),a=atan(q.y,q.x)+vState.y;
            float crack=step(abs(sin(a*3.+r*4.)),.12)*step(r,.95);
            float core=1.-step(.38,r),rim=step(.38,r)*(1.-step(.63,r));
            float mask=max(core,max(crack*.65,rim*.25));
            if(vState.w>.5){
              float noise=fract(sin(dot(floor(q*10.),vec2(127.1,311.7))+vState.y)*43758.5453);
              float edge=.65+.13*sin(a*5.+vState.y)+.07*sin(a*9.-vState.y);
              mask=(1.-smoothstep(edge-.12,edge,r))*(.45+.2*noise);
            }
            if(mask<.05)discard;
            vec3 base=mix(vec3(.004,.008,.006),vec3(.008,.004,.001),vState.z);
            vec3 edge=mix(vec3(.12,.14,.11),vec3(.14,.08,.025),vState.z);
            gl_FragColor=vec4(vState.w>.5?vec3(.25,.014,.018):mix(base,edge,rim*.5),mask*vState.x*.85);
            #include <colorspace_fragment>
          }`,
      }),
      VFX.decalCapacity,
    );
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.name = "pixel-bullet-scars";
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.state.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);
  }
  emit(hit: SurfaceHit) {
    this.total++;
    if (hit.surface === "foliage") return;
    const p = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.items.length;
    Object.assign(p, {
      life: VFX.decalLife,
      blood: 0,
      x: hit.point.x + hit.normal.x * 0.012,
      y: hit.point.y + hit.normal.y * 0.012,
      z: hit.point.z + hit.normal.z * 0.012,
      nx: hit.normal.x,
      ny: hit.normal.y,
      nz: hit.normal.z,
      size:
        hit.surface === "wood"
          ? VFX.woodDecalSize
          : hit.surface === "earth"
            ? VFX.earthDecalSize
            : VFX.stoneDecalSize,
      seed: (this.total * 2.399963) % 6.28,
      wood: Number(hit.surface === "wood"),
    });
  }
  emitBlood(hit: SurfaceHit, scale: number, direction: number) {
    let count = 0;
    for (const p of this.items) if (p.life > 0 && p.blood) count++;
    if (count >= 24 || hit.normal.y < 0.55) return;
    const p = this.items[this.cursor];
    this.cursor = (this.cursor + 1) % this.items.length;
    Object.assign(p, {
      life: 1.1,
      x: hit.point.x + hit.normal.x * 0.014,
      y: hit.point.y + hit.normal.y * 0.014,
      z: hit.point.z + hit.normal.z * 0.014,
      nx: hit.normal.x,
      ny: hit.normal.y,
      nz: hit.normal.z,
      size: 0.55 * Math.min(1.5, scale),
      seed: direction + ((++this.total * 0.618) % 1) * 1.2,
      wood: 0,
      blood: 1,
    });
  }
  step(dt: number) {
    for (const p of this.items) p.life = Math.max(0, p.life - dt);
  }
  render() {
    let count = 0;
    for (const p of this.items)
      if (p.life > 0) {
        this.dummy.position.set(p.x, p.y, p.z);
        this.normal.set(p.nx, p.ny, p.nz);
        this.dummy.quaternion.setFromUnitVectors(this.zAxis, this.normal);
        this.dummy.rotateZ(p.seed);
        this.dummy.scale.setScalar(p.size);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(count, this.dummy.matrix);
        const t = Math.max(0, Math.min(1, p.life / 0.5));
        this.state.setXYZW(
          count++,
          p.blood ? t * t * (3 - 2 * t) : Math.min(1, p.life),
          p.seed,
          p.wood,
          p.blood,
        );
      }
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = this.state.needsUpdate = true;
  }
  diagnostics() {
    return {
      active: this.items.filter((p) => p.life > 0).length,
      capacity: this.items.length,
      total: this.total,
    };
  }
  reset() {
    for (const p of this.items) p.life = 0;
    this.mesh.count = this.cursor = this.total = 0;
  }
}
