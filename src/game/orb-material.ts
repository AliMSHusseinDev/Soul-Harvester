import * as THREE from "three";
/** A shared animated hot core; no image sampling or per-orb dynamic lights. */
export function orbMaterial(clock: { value: number }) {
  return new THREE.ShaderMaterial({
    uniforms: { clock },
    toneMapped: false,
    vertexShader: `varying vec3 vPoint; varying vec3 vNormal;
      void main(){vPoint=position;vNormal=normalize(normalMatrix*normal);
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec3 vPoint; varying vec3 vNormal;uniform float clock;
      void main(){
        float bands=sin(vPoint.y*65.-clock*9.+sin(vPoint.x*40.+clock*4.)*1.7);
        float hot=smoothstep(-.65,.8,bands);
        float rim=pow(1.-abs(vNormal.z),2.);
        vec3 color=mix(vec3(1.,.16,.015),vec3(1.,.9,.43),hot);
        gl_FragColor=vec4(mix(color,vec3(1.,.42,.06),rim*.5),1.);
        #include <colorspace_fragment>
      }`,
  });
}
