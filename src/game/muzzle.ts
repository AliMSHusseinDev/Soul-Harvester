import * as THREE from "three";
export function muzzleOpening(rifle: boolean) {
  return new THREE.Vector3(0, 0.18, -(rifle ? 0.85 : 0.45) - 0.075);
}
const flameGeometry = (() => {
  const p: number[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4,
      r = 0.045 + (i % 3) * 0.009;
    p.push(
      0,
      0,
      -0.008,
      Math.cos(a - 0.22) * r * 1.5,
      Math.sin(a - 0.22) * r * 0.65,
      -0.035,
      Math.cos(a) * r * 0.675,
      Math.sin(a) * r * 0.2925,
      -0.14 - (i % 2) * 0.025,
    );
    p.push(
      0,
      0,
      -0.008,
      Math.cos(a) * r * 0.675,
      Math.sin(a) * r * 0.2925,
      -0.14 - (i % 2) * 0.025,
      Math.cos(a + 0.22) * r * 1.5,
      Math.sin(a + 0.22) * r * 0.65,
      -0.035,
    );
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  return g;
})();
const outer = new THREE.MeshBasicMaterial({
  color: 0xffbc4e,
  transparent: true,
  opacity: 0.9,
  depthWrite: false,
  depthTest: true,
  side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending,
  toneMapped: false,
});
const core = new THREE.MeshBasicMaterial({
  color: 0xfff5ca,
  depthWrite: false,
  depthTest: true,
  toneMapped: false,
});
export class Muzzle {
  readonly socket = new THREE.Group();
  readonly flame = new THREE.Group();
  private light = new THREE.PointLight(0xffd184, 0, 2.8);
  constructor(parent: THREE.Group, rifle: boolean) {
    this.socket.position.copy(muzzleOpening(rifle));
    this.socket.name = rifle ? "Rifle muzzle opening" : "Pistol muzzle opening";
    this.flame.add(new THREE.Mesh(flameGeometry, outer));
    const hot = new THREE.Mesh(new THREE.OctahedronGeometry(0.014), core);
    hot.position.z = -0.025;
    this.flame.add(hot, this.light);
    this.socket.add(this.flame);
    parent.add(this.socket);
    this.flame.visible = false;
  }
  present(visible: boolean, aim: number, stamp: number) {
    this.flame.visible = visible;
    const scale = (0.7 - aim * 0.12) * (1 + Math.sin(stamp * 2.39) * 0.12);
    this.flame.scale.setScalar(scale);
    this.flame.rotation.z = stamp * 2.39996;
    this.light.intensity = visible ? 1.9 : 0;
  }
  worldPoint(target = new THREE.Vector3()) {
    return this.socket.getWorldPosition(target);
  }
}
