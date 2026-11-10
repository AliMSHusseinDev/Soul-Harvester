import { VFX } from "./tuning";
import * as THREE from "three";
import {
  ParticleSimulation,
  debrisOpacity,
  splatterOpacity,
  PARTICLE_CAPACITY,
  SHAPE,
  type ParticleEvent,
  type SplatterImpact,
} from "./particle-simulation";
import { groundHeight } from "./terrain";
import type { WorldVisibility } from "./world-visibility";

/** Quantized procedural masks: no sampler, image, atlas, canvas or frame animation. */
export function particleMaterial(cube = false, overlay = false) {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: !overlay,
    depthWrite: false,
    side: cube ? THREE.FrontSide : THREE.DoubleSide,
    toneMapped: false,
    vertexShader: `
      attribute vec4 effectData;
      attribute vec3 effectColor;
      varying vec2 vUv; varying vec4 vData; varying vec3 vColor;
      varying float vLight;
      void main(){
        vUv=uv; vData=effectData; vColor=effectColor;
        vLight=${cube ? ".6+.4*max(0.,dot(normalize(mat3(instanceMatrix)*normal),normalize(vec3(-.4,1.,.5))))" : "1."};
        gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);
      }`,
    fragmentShader: `
      varying vec2 vUv; varying vec4 vData; varying vec3 vColor; varying float vLight;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){
        float cells=vData.x>3.5 && vData.x<4.5 ? ${VFX.smokeCells.toFixed(1)} : ${VFX.maskCells.toFixed(1)};
        vec2 q=(floor(vUv*cells)+.5)/cells*2.-1.;
        float shape=vData.x, t=vData.z, seed=vData.w;
        float alpha=1., highlight=.0;
        if(shape<.5){
          alpha=step(abs(q.x)+abs(q.y),1.65);
          highlight=step(.6,q.y)*.32;
        }else if(shape<1.5){
          alpha=step(abs(q.x),.9-.5*abs(q.y))*step(abs(q.y),.96);
          highlight=(1.-step(.35,abs(q.x)))*.6;
        }else if(shape<2.5){
          float r=length(q), a=atan(q.y,q.x), sector=floor((a+3.14159)*7.);
          float edge=.72+.045*sin(a*5.+seed*8.);
          float gaps=step(.18,fract(sector*.618+seed));
          alpha=step(abs(r-edge),.055+.025*(1.-t))*gaps;
          highlight=.12;
        }else if(shape<3.5){
          vec2 a=abs(q);
          float crossShape=min(max(a.x*5.,a.y),max(a.x,a.y*5.));
          alpha=max(step(a.x+a.y,.58),step(crossShape,.92));
          highlight=.55;
        }else if(shape<4.5){
          vec2 flow=q*3.+vec2(seed*17.+t*.8,t*1.8);
          float n=noise(flow)*.65+noise(flow*2.1)*.25+noise(flow*4.1)*.1;
          // Overlapping, evolving lobes keep a soft stepped silhouette.
          vec2 curl=q+vec2(.14*sin(q.y*4.+t*3.+seed*8.),.1*cos(q.x*5.-t*2.));
          float density=1.-dot(curl,curl)+.7*(n-.5);
          // Pixel-grid sampling keeps the silhouette sharp; continuous alpha avoids temporal stepping.
          alpha=smoothstep(.08,.6,density)*(.48+.35*n);
          highlight=n*.025;
        }else if(shape>5.5 && shape<6.5){
          vec2 a=abs(q); alpha=step(max(min(a.x,a.y)*4.5,max(a.x,a.y)),.86);highlight=.08;
        }else if(shape>6.5 && shape<7.5){
          float center=.26*sin(q.y*3.+t*5.+seed*8.);
          float width=.08+.16*(1.-abs(q.y));
          alpha=(1.-smoothstep(width,width+.09,abs(q.x-center)))*(1.-smoothstep(.55,1.,abs(q.y)));
          highlight=.35;
        }else if(shape>7.5 && shape<8.5){
          float a=atan(q.y,q.x),r=length(q);
          float edge=.73+.045*sin(a*13.+t*7.+seed*20.);
          alpha=(1.-smoothstep(.022,.06,abs(r-edge)))*step(.15,sin(a*3.+seed*8.+t*2.));
          highlight=.4;
        }else if(shape>8.5 && shape<9.5){
          // Broken pixel rays: a tapered staircase with detached square flecks.
          float row=floor(vUv.y*12.);
          float width=.2+.5*(1.-vUv.y)+hash(vec2(row,seed*17.))*.18;
          float breaks=step(.18,hash(vec2(row,seed*31.)));
          alpha=step(abs(q.x),width)*step(abs(q.y),.98)*breaks;
          highlight=0.;
        }
        if(shape>9.5){
          vec2 cell=floor(vUv*5.);
          float stem=step(1.,cell.x)*step(cell.x,2.)*step(1.,cell.y)*step(cell.y,3.);
          float corner=step(2.,cell.x)*step(cell.x,3.)*step(2.,cell.y)*step(cell.y,3.);
          alpha=max(stem,corner);highlight=0.;
        }
        if(vColor.r>vColor.g*2. && vColor.r>vColor.b*2.)highlight=0.;
        alpha*=vData.y;
        if(alpha<.015)discard;
        gl_FragColor=vec4(mix(vColor,vec3(1.),highlight)*vLight,alpha);
        #include <colorspace_fragment>
      }`,
  });
  material.forceSinglePass = true;
  return material;
}
interface Batch {
  mesh: THREE.InstancedMesh;
  data: THREE.InstancedBufferAttribute;
  color: THREE.InstancedBufferAttribute;
  count: number;
}
export class ProceduralVFX {
  readonly simulation = new ParticleSimulation();
  readonly scene = new THREE.Scene();
  private world: Batch;
  private overlay: Batch;
  private cubes: Batch;
  private dummy = new THREE.Object3D();
  private color = new THREE.Color();
  private view = new THREE.Vector3();
  private anchor = new THREE.Vector3();
  private along = new THREE.Vector3();
  private groundRotation = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    -Math.PI / 2,
  );
  private frame = 0;
  private cubeCoverage = new Uint8Array(16 * 9);
  private coreCoverage = new Uint8Array(16 * 9);
  private rendered = 0;
  constructor(
    world: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    private visibility: WorldVisibility,
  ) {
    const batch = (cube: boolean, overlay: boolean): Batch => {
      const geometry = cube
          ? new THREE.BoxGeometry(1, 1, 1)
          : new THREE.PlaneGeometry(1, 1),
        data = new THREE.InstancedBufferAttribute(
          new Float32Array(PARTICLE_CAPACITY * 4),
          4,
        ),
        color = new THREE.InstancedBufferAttribute(
          new Float32Array(PARTICLE_CAPACITY * 3),
          3,
        ),
        mesh = new THREE.InstancedMesh(
          geometry,
          particleMaterial(cube, overlay),
          PARTICLE_CAPACITY,
        );
      geometry.setAttribute("effectData", data);
      geometry.setAttribute("effectColor", color);
      data.setUsage(THREE.DynamicDrawUsage);
      color.setUsage(THREE.DynamicDrawUsage);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.name = `procedural-${cube ? "chunks" : overlay ? "impact" : "world"}`;
      (overlay ? this.scene : world).add(mesh);
      return { mesh, data, color, count: 0 };
    };
    this.world = batch(false, false);
    this.cubes = batch(true, false);
    this.overlay = batch(false, true);
  }
  emit(
    event: ParticleEvent,
    x: number,
    y: number,
    z: number,
    scale = 1,
    reduced = false,
    color?: number,
    nx = 0,
    nz = 0,
    finishing = false,
    ny = 0,
    impact?: SplatterImpact,
    density = 1,
  ) {
    this.simulation.emit(
      event,
      x,
      Math.max(y, groundHeight(x, z) + 0.06),
      z,
      scale,
      reduced,
      color,
      nx,
      nz,
      finishing,
      ny,
      impact,
      density,
    );
  }
  step(dt: number) {
    this.simulation.step(dt, groundHeight);
  }
  render(height: number) {
    this.frame++;
    this.cubeCoverage.fill(0);
    this.coreCoverage.fill(0);
    this.rendered = 0;
    for (const b of [this.world, this.overlay, this.cubes]) b.count = 0;
    const focal = height / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    for (let i = 0; i < this.simulation.items.length; i++) {
      const p = this.simulation.items[i];
      if (p.life <= 0 || p.age < 0) continue;
      this.view.set(p.x, p.y, p.z).applyMatrix4(this.camera.matrixWorldInverse);
      const depth = p.ground
          ? Math.max(1, Math.abs(this.view.z))
          : -this.view.z,
        t = Math.min(
          1,
          (p.overlay && !p.presented ? Math.min(0.025, p.age) : p.age) / p.max,
        );
      if (
        depth < 0.18 ||
        depth > 140 ||
        Math.abs(this.view.x) > depth * this.camera.aspect ||
        Math.abs(this.view.y) > depth * 1.3
      )
        continue;
      if (p.overlay) {
        if (!p.presented || p.age < 0.04 || ((i + this.frame) & 3) === 0) {
          this.anchor.set(p.anchorX, p.anchorY, p.anchorZ);
          p.visible = !this.visibility.occluded(
            this.camera.position,
            this.anchor,
          );
        }
        if (!p.visible) continue;
      }
      if (p.shape === SHAPE.cube || p.shape === SHAPE.ribbon || p.overlay) {
        const cx = Math.floor(
            ((this.view.x * focal) / depth / (height * this.camera.aspect) +
              0.5) *
              16,
          ),
          cy = Math.floor(((-this.view.y * focal) / depth / height + 0.5) * 9);
        if (cx >= 0 && cx < 16 && cy >= 0 && cy < 9) {
          const cells = p.overlay ? this.coreCoverage : this.cubeCoverage,
            cell = cy * 16 + cx;
          if (cells[cell] >= (p.overlay ? 4 : p.shape === SHAPE.ribbon ? 6 : 3))
            continue;
          cells[cell]++;
        }
      }
      const b =
        p.shape === SHAPE.cube
          ? this.cubes
          : p.overlay
            ? this.overlay
            : this.world;
      let size = p.size;
      if (p.shape === SHAPE.ring || p.shape === SHAPE.arc)
        size *= 0.38 + 1.8 * (1 - Math.exp(-t * 5));
      else if (p.shape === SHAPE.smoke) size *= 0.7 + t * 2.7;
      else if (p.shape === SHAPE.star)
        size *= 0.7 + 0.8 * Math.sin((Math.min(1, t * 2) * Math.PI) / 2);
      else size *= 0.8 + 0.2 * (1 - t);
      // Cap overlay footprint and distant detail. Near-plane objects are never screen-filling.
      const cap =
        p.shape === SHAPE.cube
          ? 0.035
          : p.shape === SHAPE.smoke
            ? VFX.smokeHeightCap
            : p.overlay
              ? VFX.impactHeightCap
              : 0.12;
      if (!p.ground) size = Math.min(size, (depth * height * cap) / focal);
      if (p.shape === SHAPE.ribbon)
        size = Math.min(
          size,
          (depth * height * VFX.flakeLengthCap) / (focal * p.stretch),
        );
      if (p.shape !== SHAPE.smoke)
        size = Math.max(size, Math.min(p.size * 1.4, (depth * 2) / focal));
      let alpha =
        p.shape === SHAPE.smoke
          ? Math.min(1, t * 9) * Math.pow(1 - t, 0.9) * 0.46
          : 1 - Math.pow(t, 3);
      if (p.shape === SHAPE.cube || p.shape === SHAPE.smoke)
        alpha *= Math.min(1, Math.max(0, (depth - 0.18) / 0.45));
      if (p.shape === SHAPE.debris) alpha = debrisOpacity(p.age, p.fadeAt);
      if (p.shape === SHAPE.ribbon)
        alpha =
          splatterOpacity(t) *
          p.rangeOpacity *
          Math.min(1, Math.max(0, (p.expireAge - p.age) / 0.16));
      if (p.ground) alpha *= 0.65;
      // The five-cell L mask occupies +/-0.3 of the quad: keep its visible lower edge off the surface.
      const c = Math.cos(p.angle),
        s = Math.sin(p.angle),
        rightY = this.camera.matrixWorld.elements[1],
        upY = this.camera.matrixWorld.elements[5];
      const restingY =
        p.floorY +
        size *
          0.3 *
          (Math.abs(rightY * c + upY * s) + Math.abs(-rightY * s + upY * c)) +
        0.012;
      this.dummy.position.set(
        p.x,
        p.ground
          ? groundHeight(p.x, p.z) + 0.065
          : p.shape === SHAPE.debris && p.settled
            ? restingY
            : p.y,
        p.z,
      );
      if (p.shape === SHAPE.cube)
        this.dummy.rotation.set(p.angle * 0.7, p.angle, p.angle * 0.4);
      else if (p.ground) {
        this.dummy.quaternion.copy(this.groundRotation);
        this.dummy.rotateZ(p.angle);
      } else {
        this.dummy.quaternion.copy(this.camera.quaternion);
        if (p.shape === SHAPE.streak || p.shape === SHAPE.ribbon) {
          // Project velocity into the camera plane for physically aligned spark ribbons.
          this.along
            .set(p.vx, p.vy, p.vz)
            .transformDirection(this.camera.matrixWorldInverse);
          this.dummy.rotateZ(Math.atan2(-this.along.x, this.along.y));
        } else this.dummy.rotateZ(p.angle);
      }
      this.dummy.scale.set(
        size,
        p.shape === SHAPE.streak ||
          p.shape === SHAPE.wisp ||
          p.shape === SHAPE.ribbon
          ? size * p.stretch
          : size,
        p.shape === SHAPE.cube ? size : 0.1,
      );
      this.dummy.updateMatrix();
      const at = b.count++;
      b.mesh.setMatrixAt(at, this.dummy.matrix);
      this.color.setHex(p.color);
      b.color.setXYZ(at, this.color.r, this.color.g, this.color.b);
      b.data.setXYZW(at, p.shape, alpha, t, p.seed);
      p.presented = true;
      this.rendered++;
    }
    for (const b of [this.world, this.overlay, this.cubes]) {
      b.mesh.count = b.count;
      b.mesh.instanceMatrix.needsUpdate = true;
      b.data.needsUpdate = b.color.needsUpdate = true;
    }
  }
  diagnostics() {
    return {
      mode: "procedural",
      textures: 0,
      capacity: PARTICLE_CAPACITY,
      active: this.simulation.active,
      delayed: this.simulation.items.filter((p) => p.life > 0 && p.age < 0)
        .length,
      smoke: this.simulation.items.filter(
        (p) => p.life > 0 && p.shape === SHAPE.smoke,
      ).length,
      wisps: this.simulation.items.filter(
        (p) => p.life > 0 && p.shape === SHAPE.wisp,
      ).length,
      rendered: this.rendered,
      draws:
        Number(this.world.count > 0) +
        Number(this.overlay.count > 0) +
        Number(this.cubes.count > 0),
      emitted: this.simulation.emitted,
      dropped: this.simulation.dropped,
      events: { ...this.simulation.events },
      shapes: {
        world: this.world.count,
        overlay: this.overlay.count,
        cubes: this.cubes.count,
        ribbons: this.simulation.items.filter(
          (p) => p.life > 0 && p.shape === SHAPE.ribbon,
        ).length,
      },
    };
  }
  reset() {
    this.simulation.reset();
    for (const b of [this.world, this.overlay, this.cubes]) b.mesh.count = 0;
  }
}
