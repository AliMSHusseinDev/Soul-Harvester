import "@fontsource/cormorant-garamond/latin-400.css";
import "@fontsource/cormorant-garamond/latin-400-italic.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "./style.css";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { World } from "./game/world";
import { Input } from "./game/input";
import { Player } from "./game/player";
import { Weapon } from "./game/weapon";
import { Enemies } from "./game/enemies";
import { Audio } from "./game/audio";
import { FixedClock } from "./game/math";
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
async function boot() {
  const canvas = $<HTMLCanvasElement>("world");
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  const gl = renderer.getContext(),
    debug = gl.getExtension("WEBGL_debug_renderer_info");
  const software = debug
    ? /swiftshader|llvmpipe|software/i.test(
        gl.getParameter(debug.UNMASKED_RENDERER_WEBGL),
      )
    : false;
  const pixelLimit = software ? 0.85 : 1.6;
  renderer.setPixelRatio(Math.min(devicePixelRatio, pixelLimit));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = !software;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(
      72,
      innerWidth / innerHeight,
      0.06,
      220,
    );
  const viewScene = new THREE.Scene();
  viewScene.add(camera);
  const pmrem = new THREE.PMREMGenerator(renderer),
    room = new RoomEnvironment();
  viewScene.environment = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  pmrem.dispose();
  viewScene.add(new THREE.HemisphereLight(0xc8dfd1, 0x263528, 2.8));
  const viewLight = new THREE.DirectionalLight(0xf3d3a0, 3);
  viewLight.position.set(-2, 3, 2);
  viewScene.add(viewLight);
  renderer.autoClear = false;
  renderer.info.autoReset = false;
  const world = new World(scene),
    input = new Input(canvas),
    player = new Player(input, world.solids),
    weapon = new Weapon(camera),
    enemies = new Enemies(scene),
    audio = new Audio(),
    clock = new FixedClock();
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let active = false,
    started = false,
    elapsed = 0,
    last = performance.now(),
    souls = 0,
    toastTimer = 0,
    hitTimer = 0,
    bellTimer = 0,
    lastFootstep = 0;
  let frames = 0,
    frameTime = 0,
    fps = 0;
  const raycaster = new THREE.Raycaster(),
    direction = new THREE.Vector3();
  const impactGeometry = new THREE.BufferGeometry();
  const impactPositions = new Float32Array(24 * 3);
  const velocities = new Float32Array(24 * 3);
  impactGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(impactPositions, 3),
  );
  const impacts = new THREE.Points(
    impactGeometry,
    new THREE.PointsMaterial({
      color: 0xb6ffe0,
      size: 0.065,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  scene.add(impacts);
  let impactLife = 0;
  function toast(message: string) {
    $("toast").textContent = message;
    $("toast").classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(
      () => $("toast").classList.remove("show"),
      3200,
    );
  }
  function setActive(value: boolean) {
    active = value;
    clock.reset();
    player.stop();
    $("menu").classList.toggle("hidden", value);
    $("hud").classList.toggle("hidden", !value);
    document.body.classList.toggle("playing", value);
    $("enter-label").textContent = started
      ? "RETURN TO THE KEEP"
      : "ENTER THE COURTYARD";
  }
  async function enter() {
    if (innerWidth < 640)
      toast("Keyboard and mouse are recommended for this chapter.");
    try {
      await input.capture();
      started = true;
      void audio.activate();
    } catch {
      toast(
        "Mouse capture was blocked. Open the game in its own browser tab and try again.",
      );
    }
  }
  input.onLockChange = (locked) => {
    setActive(locked);
    if (locked && !started) started = true;
  };
  document.addEventListener("pointerlockerror", () =>
    toast("Allow mouse capture, or open the game in a separate tab."),
  );
  $("enter").onclick = enter;
  $("notes").onclick = () => $<HTMLDialogElement>("guide").showModal();
  $("close-guide").onclick = () => $<HTMLDialogElement>("guide").close();
  $("guide-enter").onclick = () => {
    $<HTMLDialogElement>("guide").close();
    void enter();
  };
  $("sound").onclick = async () => {
    const enabled = await audio.toggle();
    $("sound-state").textContent = enabled ? "ON" : "OFF";
    $("sound").setAttribute(
      "aria-label",
      enabled ? "Disable sound" : "Enable sound",
    );
  };
  function ringBell() {
    if (bellTimer > 0) return;
    bellTimer = 3.5;
    audio.bell();
    toast("The Hollow Keep answers. The harvest is coming.");
  }
  function reload() {
    if (weapon.reload()) audio.reload();
  }
  input.onAction = (action) => {
    if (action === "KeyR") reload();
    if (
      action === "KeyE" &&
      Math.hypot(player.position.x, player.position.z + 20.7) < 6
    )
      ringBell();
  };
  function burst(point: THREE.Vector3) {
    impactLife = 0.45;
    for (let i = 0; i < 24; i++) {
      impactPositions.set([point.x, point.y, point.z], i * 3);
      velocities.set(
        [
          (Math.random() - 0.5) * 3,
          Math.random() * 3,
          (Math.random() - 0.5) * 3,
        ],
        i * 3,
      );
    }
    impactGeometry.attributes.position.needsUpdate = true;
  }
  function shoot() {
    if (!weapon.fire()) {
      if (weapon.ammo === 0 && !weapon.reloading) reload();
      return;
    }
    audio.shot();
    camera.getWorldDirection(direction);
    raycaster.set(camera.position, direction);
    raycaster.camera = camera;
    // World occlusion is tested before sprite hits, so targets cannot be shot through walls.
    const hits = raycaster.intersectObjects(enemies.visible, false);
    if (hits.length) {
      const hit = hits[0];
      let blocked = false;
      for (const b of world.solids) {
        const box = new THREE.Box3(
          new THREE.Vector3(b.minX, 0, b.minZ),
          new THREE.Vector3(b.maxX, b.height, b.maxZ),
        );
        const point = raycaster.ray.intersectBox(box, new THREE.Vector3());
        if (point && point.distanceTo(camera.position) < hit.distance) {
          blocked = true;
          break;
        }
      }
      if (!blocked) {
        const released = enemies.hit(hit.object);
        burst(hit.point);
        audio.hit();
        $("hitmarker").classList.add("show");
        clearTimeout(hitTimer);
        hitTimer = window.setTimeout(
          () => $("hitmarker").classList.remove("show"),
          120,
        );
        if (released) {
          souls++;
          $("souls").textContent = String(souls).padStart(2, "0");
          toast("A restless soul released.");
        }
      }
    }
    const bellDistance = raycaster.ray.distanceToPoint(world.bellPosition);
    if (
      bellDistance < 0.7 &&
      camera.position.distanceTo(world.bellPosition) < 35 &&
      world.bellPosition.clone().sub(camera.position).dot(direction) > 0
    )
      ringBell();
  }
  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, pixelLimit));
  }
  window.addEventListener("resize", resize);
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    if (document.pointerLockElement) document.exitPointerLock();
    $("fatal-message").textContent =
      "Graphics context was lost. Reload to restore the courtyard.";
    $("fatal").classList.remove("hidden");
  });
  function animate(now: number) {
    requestAnimationFrame(animate);
    const rawDt = (now - last) / 1000,
      dt = Math.min(rawDt, 0.1);
    last = now;
    elapsed += dt;
    frames++;
    frameTime += rawDt;
    if (frameTime >= 1) {
      fps = Math.round(frames / frameTime);
      frames = 0;
      frameTime = 0;
    }
    if (active) {
      const alpha = clock.advance(dt, (step) => {
        player.update(step);
        enemies.update(step, elapsed);
        weapon.update(step, elapsed, player.speed, reducedMotion);
        if (input.firing) shoot();
      });
      player.render(camera, alpha, reducedMotion);
      $("heading").textContent = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][
        Math.round(
          (((((-input.yaw * 180) / Math.PI) % 360) + 360) % 360) / 45,
        ) % 8
      ];
      $("stamina").style.width = `${player.stamina * 100}%`;
      $("ammo").textContent = weapon.reloading ? "—" : String(weapon.ammo);
      $("interact").classList.toggle(
        "hidden",
        Math.hypot(player.position.x, player.position.z + 20.7) >= 6,
      );
      if (player.grounded && player.distance - lastFootstep > 2.1) {
        audio.step();
        lastFootstep = player.distance;
      }
    } else if (!started) {
      camera.position.set(5.8 + Math.sin(elapsed * 0.055) * 0.35, 2.7, 18.5);
      camera.lookAt(-1.5, 4.1, -18);
      weapon.group.visible = false;
      enemies.update(dt, elapsed);
    }
    weapon.group.visible = started && active;
    world.update(elapsed);
    if (bellTimer > 0) {
      bellTimer -= dt;
      world.bell.rotation.z =
        Math.sin(elapsed * 16) * Math.min(bellTimer * 0.12, 0.25);
    } else world.bell.rotation.z = 0;
    if (impactLife > 0) {
      impactLife -= dt;
      for (let i = 0; i < 24; i++) {
        impactPositions[i * 3] += velocities[i * 3] * dt;
        impactPositions[i * 3 + 1] += velocities[i * 3 + 1] * dt;
        impactPositions[i * 3 + 2] += velocities[i * 3 + 2] * dt;
        velocities[i * 3 + 1] -= dt * 3;
      }
      impactGeometry.attributes.position.needsUpdate = true;
      impacts.material.opacity = Math.max(0, impactLife / 0.45);
    }
    camera.updateMatrixWorld();
    renderer.info.reset();
    renderer.clear();
    renderer.render(scene, camera);
    if (weapon.group.visible) {
      renderer.clearDepth();
      renderer.render(viewScene, camera);
    }
  }
  renderer.compile(scene, camera);
  requestAnimationFrame(animate);
  $("loading").classList.add("done");
  window.setTimeout(() => $("loading").remove(), 800);
  // Read-only diagnostics for automated browser checks and performance inspection.
  Object.defineProperty(window, "__soulHarvester", {
    value: () => ({
      ready: true,
      active,
      started,
      softwareRenderer: software,
      position: player.position.toArray(),
      yaw: input.yaw,
      pitch: input.pitch,
      ammo: weapon.ammo,
      reloading: weapon.reloading,
      souls,
      shades: enemies.visible.length,
      targets: enemies.visible.map((shade) => shade.position.toArray()),
      colliders: world.solids.length,
      fps,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
    }),
    writable: false,
  });
}
boot().catch((error) => {
  console.error(error);
  $("loading")?.remove();
  $("fatal-message").textContent =
    error instanceof Error
      ? error.message
      : "Please use a browser with WebGL 2 enabled.";
  $("fatal").classList.remove("hidden");
});
