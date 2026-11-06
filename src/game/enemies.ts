import * as THREE from "three";
import { guardTexture } from "./textures";
import type { Battle } from "./battle";
export class Enemies {
  readonly targets: THREE.Sprite[] = [];
  constructor(
    scene: THREE.Scene,
    private battle: Battle,
  ) {
    const textures = [guardTexture(0), guardTexture(1), guardTexture(2)];
    for (const e of battle.enemies) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: textures[e.kind],
          alphaTest: 0.2,
          transparent: false,
        }),
      );
      sprite.scale.set(1.25, 1.65, 1);
      sprite.visible = false;
      sprite.userData.enemyId = e.id;
      sprite.name = "Hollowguard";
      this.targets.push(sprite);
      scene.add(sprite);
    }
  }
  update(time: number) {
    for (const e of this.battle.enemies) {
      const sprite = this.targets[e.id];
      sprite.visible = e.active;
      if (!e.active) continue;
      const bob =
        e.windup > 0
          ? Math.sin(e.windup * 18) * 0.06
          : Math.sin(time * 9 + e.phase) * 0.055;
      sprite.position.set(e.x, 0.86 + bob, e.z);
      sprite.scale.set(1.25 + (e.windup > 0 ? 0.12 : 0), 1.65, 1);
      sprite.material.color.set(e.windup > 0 ? 0xffb78d : 0xc2e4c6);
    }
  }
  get visible() {
    return this.targets.filter((t) => t.visible);
  }
}
