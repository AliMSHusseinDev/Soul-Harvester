import * as THREE from "three";
import { shadeTexture, glowTexture } from "./textures";
interface Shade {
  sprite: THREE.Sprite;
  aura: THREE.Sprite;
  home: THREE.Vector3;
  phase: number;
  hp: number;
  respawn: number;
  flash: number;
}
export class Enemies {
  private shades: Shade[] = [];
  readonly targets: THREE.Sprite[] = [];
  constructor(scene: THREE.Scene) {
    const texture = shadeTexture(),
      glow = glowTexture();
    const spots = [
      [-5, -12],
      [6, -14],
      [-9, -3],
      [8, 5],
      [-6, 8],
      [1, -16],
      [-13, -16],
    ];
    for (let i = 0; i < spots.length; i++) {
      const [x, z] = spots[i];
      const material = new THREE.SpriteMaterial({
        map: texture,
        color: 0xc4f2d9,
        alphaTest: 0.1,
        transparent: true,
        depthWrite: true,
      });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(1.25, 1.8, 1);
      sprite.position.set(x, 1, z);
      sprite.userData.shadeIndex = i;
      sprite.name = "Hollow shade";
      scene.add(sprite);
      this.targets.push(sprite);
      const aura = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glow,
          color: 0x60dcb6,
          transparent: true,
          opacity: 0.12,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      aura.position.set(x, 0.8, z + 0.01);
      aura.scale.set(2.3, 2.7, 1);
      scene.add(aura);
      this.shades.push({
        sprite,
        aura,
        home: new THREE.Vector3(x, 1, z),
        phase: i * 1.7,
        hp: 2,
        respawn: 0,
        flash: 0,
      });
    }
  }
  update(dt: number, time: number) {
    for (const s of this.shades) {
      if (s.respawn > 0) {
        s.respawn -= dt;
        if (s.respawn <= 0) {
          s.hp = 2;
          s.sprite.visible = true;
          s.aura.visible = true;
        }
        continue;
      }
      s.sprite.position.x = s.home.x + Math.sin(time * 0.3 + s.phase) * 0.3;
      s.sprite.position.y = s.home.y + Math.sin(time * 1.7 + s.phase) * 0.09;
      s.aura.position.copy(s.sprite.position);
      s.aura.material.opacity = 0.1 + Math.sin(time * 2 + s.phase) * 0.035;
      s.flash = Math.max(0, s.flash - dt * 5);
      s.sprite.material.color.setRGB(
        0.76 + s.flash * 0.8,
        0.95 + s.flash * 0.4,
        0.85 + s.flash * 0.4,
      );
    }
  }
  hit(target: THREE.Object3D) {
    const s = this.shades[target.userData.shadeIndex];
    if (!s || s.respawn > 0) return false;
    s.hp--;
    s.flash = 1;
    if (s.hp <= 0) {
      s.sprite.visible = false;
      s.aura.visible = false;
      s.respawn = 12;
      return true;
    }
    return false;
  }
  get visible() {
    return this.targets.filter((t) => t.visible);
  }
}
