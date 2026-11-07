import "@fontsource/pixelify-sans/latin-400.css";
import "@fontsource/pixelify-sans/latin-600.css";
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
import { FixedClock, damp, seededRandom, springStep } from "./game/math";
import { Battle } from "./game/battle";
import { Effects } from "./game/effects";
import { UI, $ } from "./game/ui";
import { MAP, groundHeight } from "./game/terrain";
import { LIGHTING, COMBAT_FEEL } from "./game/tuning";
import { HitFeedback, shotTarget } from "./game/feedback";
import { WAVE_LIMIT } from "./game/waves";
import { surfaceSummary } from "./game/surfaces";
import { AbilityPresentation } from "./game/presentation";
async function boot() {
  const canvas = $<HTMLCanvasElement>("world");
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  const gl = renderer.getContext(),
    debug = gl.getExtension("WEBGL_debug_renderer_info"),
    software = debug
      ? /swiftshader|llvmpipe|software/i.test(
          gl.getParameter(debug.UNMASKED_RENDERER_WEBGL),
        )
      : false,
    pixelLimit = software ? 0.75 : 1.6;
  renderer.setPixelRatio(Math.min(devicePixelRatio, pixelLimit));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = LIGHTING.exposure;
  renderer.shadowMap.enabled = !software;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.autoClear = false;
  renderer.info.autoReset = false;
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(
      72,
      innerWidth / innerHeight,
      0.06,
      440,
    ),
    viewScene = new THREE.Scene();
  viewScene.add(camera);
  const pmrem = new THREE.PMREMGenerator(renderer),
    room = new RoomEnvironment();
  viewScene.environment = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  pmrem.dispose();
  viewScene.add(
    new THREE.HemisphereLight(0xcde6e4, 0x31483b, LIGHTING.viewSky),
  );
  const viewLight = new THREE.DirectionalLight(0xffe2bb, LIGHTING.viewKey);
  viewLight.position.set(-2, 3, 2);
  viewScene.add(viewLight);
  const world = new World(scene),
    input = new Input(canvas),
    player = new Player(input, world.solids),
    weapon = new Weapon(camera),
    battle = new Battle(world.solids),
    enemies = new Enemies(scene, battle),
    audio = new Audio(),
    clock = new FixedClock(),
    effects = new Effects(scene, battle, camera),
    abilityPresentation = new AbilityPresentation(),
    feedback = new HitFeedback();
  const ui = new UI(battle, weapon, () => {
    input.clear();
    if (document.pointerLockElement) document.exitPointerLock();
    setActive(false);
  });
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let active = false,
    started = false,
    time = 0,
    ambientTime = 0,
    last = performance.now(),
    fps = 0,
    frames = 0,
    frameTime = 0,
    bellTimer = 0,
    footstep = 0,
    kick = 0,
    uiTimer = 0;
  let hurtKick = 0,
    hurtVelocity = 0,
    shotSerial = 0;
  let lastBulletHit: {
    enemyId: number;
    killed: boolean;
    point: number[];
    time: number;
    critical: boolean;
  } | null = null;
  let confirmedHits = 0,
    confirmedKills = 0;
  const rng = seededRandom(92);
  const direction = new THREE.Vector3(),
    center = new THREE.Vector2(),
    raycaster = new THREE.Raycaster();
  const occluders = world.solids.map(
    (b) =>
      new THREE.Box3(
        new THREE.Vector3(b.minX, b.base ?? 0, b.minZ),
        new THREE.Vector3(b.maxX, b.height, b.maxZ),
      ),
  );
  const intersection = new THREE.Vector3();
  const solidPoint = new THREE.Vector3(),
    bellPoint = new THREE.Vector3(),
    bellSphere = new THREE.Sphere(world.bellPosition, 0.8);
  function setActive(value: boolean) {
    active = value && !ui.dialogOpen && battle.phase !== "lost";
    clock.reset();
    player.stop();
    $("menu").classList.toggle("hidden", active || ui.dialogOpen);
    $("hud").classList.toggle("hidden", !active);
    document.body.classList.toggle("playing", active);
    $("enter-label").textContent =
      battle.phase === "lost"
        ? "BEGIN ANOTHER HARVEST"
        : started
          ? "RETURN TO THE KEEP"
          : "ENTER THE COURTYARD";
  }
  function reset() {
    battle.reset();
    weapon.reset();
    effects.reset();
    player.reset();
    input.yaw = 0;
    input.pitch = 0;
    input.clear();
    kick = 0;
    footstep = 0;
    bellTimer = 0;
    time = 0;
    ui.reset();
    ui.update(0, false);
    feedback.reset();
    abilityPresentation.reset();
    hurtKick = 0;
    hurtVelocity = 0;
    shotSerial = 0;
    lastBulletHit = null;
    confirmedHits = 0;
    confirmedKills = 0;
  }
  async function enter() {
    if (battle.phase === "lost") reset();
    try {
      await input.capture();
      started = true;
      void audio.activate();
    } catch {
      ui.toast("Allow mouse capture or open the game in its own browser tab.");
    }
  }
  input.onLockChange = (locked) => {
    if (locked) started = true;
    setActive(locked);
  };
  for (const dialog of document.querySelectorAll("dialog"))
    dialog.addEventListener("close", () => {
      document.body.classList.toggle("has-panel", ui.dialogOpen);
      setActive(input.locked);
    });
  $("enter").onclick = enter;
  $("notes").onclick = () => ui.open("guide");
  $("close-guide").onclick = () => $<HTMLDialogElement>("guide").close();
  $("guide-enter").onclick = () => {
    $<HTMLDialogElement>("guide").close();
    void enter();
  };
  $("restart").onclick = () => {
    $<HTMLDialogElement>("lost-dialog").close();
    reset();
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
  document.addEventListener("pointerlockerror", () =>
    ui.toast("Allow mouse capture. An embedded host must permit pointer-lock."),
  );
  function ringBell() {
    if (battle.phase === "lost") return;
    if (battle.startWave()) {
      bellTimer = 1.2;
      audio.bell();
    } else ui.toast(`${WAVE_LIMIT} / ${WAVE_LIMIT}`);
  }
  function interact() {
    if (player.position.distanceTo(world.skillStation) < 3.5)
      ui.open("skills-dialog");
    else if (player.position.distanceTo(world.weaponStation) < 3.5)
      ui.open("shop-dialog");
    else if (
      Math.hypot(player.position.x, player.position.z - MAP.bell.z) < 6
    ) {
      if (battle.baseHealth < 500 && battle.phase === "battle")
        ui.toast(
          battle.repair()
            ? "Bell repaired: +100 integrity."
            : "Repair requires 15 gold.",
        );
      else ringBell();
    }
  }
  function melee() {
    camera.getWorldDirection(direction);
    if (battle.melee(player.position, { x: direction.x, z: direction.z })) {
      weapon.melee();
      audio.melee();
    }
  }
  input.onAction = (action) => {
    if (action === "KeyR") {
      if (weapon.reload()) audio.reload();
    } else if (action === "KeyE") interact();
    else if (action === "KeyV") melee();
    else if (action === "Digit1") weapon.switch("blade");
    else if (action === "Digit2") weapon.switch("pistol");
    else if (action === "Digit3") weapon.switch("rifle");
    else if (action === "KeyK") ui.open("skills-dialog");
    else if (action === "KeyF") {
      if (battle.requestBurst()) {
        abilityPresentation.begin("burst");
        weapon.cast();
      }
    } else if (action === "KeyQ") {
      if (battle.canOrb()) {
        abilityPresentation.begin("orb");
        weapon.cast();
      }
    }
  };
  function shoot() {
    if (weapon.id === "blade") {
      melee();
      return;
    }
    if (!weapon.fire()) {
      if (
        weapon.ammo === 0 &&
        weapon.reserve > 0 &&
        !weapon.reloading &&
        weapon.reload()
      )
        audio.reload();
      return;
    }
    audio.shot();
    camera.updateMatrixWorld();
    raycaster.setFromCamera(center, camera);
    direction.copy(raycaster.ray.direction);
    effects.shell(
      camera.position,
      new THREE.Vector3(Math.cos(input.yaw), 0, -Math.sin(input.yaw)),
    );
    const hit = enemies.raycast(raycaster.ray, time, input.yaw)[0];
    let solidDistance = Infinity;
    for (const box of occluders) {
      if (raycaster.ray.intersectBox(box, intersection)) {
        const d = intersection.distanceTo(camera.position);
        if (d < solidDistance) {
          solidDistance = d;
          solidPoint.copy(intersection);
        }
      }
    }
    const bellDistance = raycaster.ray.intersectSphere(bellSphere, bellPoint)
      ? camera.position.distanceTo(bellPoint)
      : Infinity;
    const target = shotTarget(
      hit?.distance ?? Infinity,
      bellDistance < 40 ? bellDistance : Infinity,
      solidDistance,
    );
    if (target === "enemy" && hit) {
      const critical =
        (hit.uv?.y ?? 0) > 0.73 || rng() < 0.05 + battle.stats.instinct * 0.03;
      const damage =
        weapon.config.damage * battle.damageMultiplier * (critical ? 1.5 : 1);
      const killed = battle.damageEnemy(
        hit.enemyId,
        damage,
        player.position,
        weapon.id === "rifle" ? 2 : 4,
        {
          x: hit.point.x,
          y: hit.point.y,
          z: hit.point.z,
          critical,
          bullet: true,
        },
      );
      feedback.confirm(killed);
      audio.hit(killed, critical);
      confirmedHits++;
      if (killed) confirmedKills++;
      lastBulletHit = {
        enemyId: hit.enemyId,
        killed,
        point: hit.point.toArray(),
        time,
        critical,
      };
    } else if (target === "bell") ringBell();
    else if (target === "solid") effects.burst(solidPoint, 0xbbad85, 5, 1.5);
    shotSerial++;
    if (shotSerial % 3 === 0 || weapon.id === "pistol") {
      const endpoint =
        target === "enemy" && hit
          ? hit.point
          : target === "bell"
            ? bellPoint
            : target === "solid"
              ? solidPoint
              : camera.position.clone().addScaledVector(direction, 70);
      effects.tracer(weapon.muzzlePoint(), endpoint);
    }
    kick = Math.min(
      0.12,
      kick +
        (weapon.id === "rifle" ? 0.008 : 0.018) /
          (1 + battle.skills.marksmanship * 0.25),
    );
  }
  function processEvents() {
    let gold = 0,
      xp = 0;
    for (const event of battle.events) {
      if (event.kind === "gold" || event.kind === "xp") {
        effects.pickup(event.kind, event.x, event.z, event.y);
        audio.pickup(event.kind);
        if (event.kind === "gold") gold += event.value;
        else xp += event.value;
      } else if (event.kind === "complete") ui.banner("KEEP DEFENDED");
      else if (event.kind === "hit") {
        effects.number(event.x, event.z, event.value, event.y, event.critical);
        effects.impact(
          event.x,
          event.y ?? groundHeight(event.x, event.z) + 0.9,
          event.z,
          event.critical,
          event.bullet === true,
        );
      } else if (event.kind === "kill") {
        effects.death(event.x, event.z, event.value);
        audio.death();
      } else if (event.kind === "playerHit") {
        ui.hit();
        audio.hurt();
        if (!reducedMotion) {
          hurtVelocity = Math.min(0.18, hurtVelocity + 0.09);
          weapon.hurt();
        }
      } else if (event.kind === "baseHit") {
        effects.burst(
          new THREE.Vector3(0, groundHeight(0, 19) + 1.4, 19),
          0xe9ba6e,
          10,
          2,
        );
      } else if (event.kind === "wave") {
        ui.banner(`WAVE ${event.value}`);
      } else if (event.kind === "level") {
        ui.levelUp(event.value);
        effects.levelUp(player.position.x, player.position.z);
        audio.level();
      } else if (event.kind === "lost") ui.lost();
      else if (event.kind === "spawn") effects.spawn(event.x, event.z);
    }
    if (gold) ui.pickup("gold", gold);
    if (xp) ui.pickup("xp", xp);
    battle.events.length = 0;
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
      "Graphics context was lost. Reload to restore the keep.";
    $("fatal").classList.remove("hidden");
  });
  function animate(now: number) {
    requestAnimationFrame(animate);
    const rawDt = (now - last) / 1000,
      dt = Math.min(rawDt, 0.1);
    last = now;
    ambientTime += dt;
    frames++;
    frameTime += rawDt;
    if (frameTime >= 1) {
      fps = Math.round(frames / frameTime);
      frames = 0;
      frameTime = 0;
    }
    if (active) {
      const alpha = clock.advance(dt, (step) => {
        if (!active) return;
        time += step;
        feedback.update(step);
        player.athletics = battle.skills.athletics;
        player.moveMultiplier = 1 + battle.stats.agility * 0.04;
        weapon.reloadMultiplier = 1 / (1 + battle.skills.marksmanship * 0.15);
        player.update(step);
        if (player.position.y < -5) {
          battle.hurtPlayer(20);
          const north = player.position.z < -6;
          player.position.set(
            0,
            groundHeight(0, north ? -17 : 5),
            north ? -17 : 5,
          );
          player.previous.copy(player.position);
          player.stop();
          ui.toast("The ravine takes its toll. Stay on the bridge.");
        }
        player.render(camera, 1, reducedMotion);
        kick = damp(kick, 0, 14, step);
        const hurt = springStep(hurtKick, hurtVelocity, 0, 14, step);
        hurtKick = hurt.position;
        hurtVelocity = hurt.velocity;
        camera.rotation.x += kick + hurtKick;
        camera.updateMatrixWorld();
        weapon.update(step, time, player.speed, reducedMotion, input.aiming);
        for (const ability of abilityPresentation.update(step)) {
          const origin = weapon.castOrigin();
          camera.getWorldDirection(direction);
          if (ability === "burst") {
            battle.releaseBurst(player.position);
            effects.pulse(player.position.x, player.position.z);
          } else effects.orb(origin, direction);
          effects.cast(origin, ability === "orb");
          audio.cast();
        }
        if (input.firing || input.fireQueued) {
          input.fireQueued = false;
          shoot();
        }
        battle.update(step, player.position);
        if (battle.ammoReward > 0) {
          weapon.addAmmo(battle.ammoReward);
          battle.ammoReward = 0;
        }
        effects.followPlayer(player.position.x, player.position.z);
        effects.step(step, time);
        processEvents();
      });
      player.render(camera, alpha, reducedMotion);
      camera.rotation.x += kick + hurtKick;
      enemies.update(time, input.yaw);
      const fov =
        input.aiming && weapon.id !== "blade" ? 55 : player.speed > 6 ? 76 : 72;
      camera.fov = damp(camera.fov, fov, 10, dt);
      camera.updateProjectionMatrix();
      $("stamina").style.width = `${player.stamina * 100}%`;
      let label = "";
      if (player.position.distanceTo(world.skillStation) < 3.5)
        label = "SKILLS";
      else if (player.position.distanceTo(world.weaponStation) < 3.5)
        label = "UPGRADE";
      else if (
        Math.hypot(player.position.x, player.position.z - MAP.bell.z) < 6
      )
        label =
          battle.baseHealth < 500 && battle.phase === "battle"
            ? "REPAIR BELL · 15 GOLD"
            : battle.wave < WAVE_LIMIT
              ? "CALL NEXT WAVE"
              : "";
      $("interact").classList.toggle("hidden", !label || input.aiming);
      $("interact-label").textContent = label;
      if (player.grounded && player.distance - footstep > 2.1) {
        audio.step();
        footstep = player.distance;
      }
    } else {
      if (!started) {
        camera.position.set(
          10.5 + Math.sin(ambientTime * 0.045) * 0.3,
          3.8 + groundHeight(10.5, 16),
          16,
        );
        camera.lookAt(0, 4, -39);
      }
    }
    weapon.group.visible = active;
    weapon.present();
    $("hitmarker").classList.toggle("show", feedback.remaining > 0);
    $("hitmarker").classList.toggle("kill", feedback.kill);
    $("crosshair").classList.toggle("confirmed", feedback.remaining > 0);
    $("hitmarker").style.opacity = String(Math.min(1, feedback.fraction * 4));
    $("hitmarker").style.transform =
      `translate(-50%,-50%) scale(${(feedback.kill ? 1.22 : 1) * (1 + Math.sin(feedback.fraction * Math.PI) * 0.18)})`;
    world.update(ambientTime, camera.position);
    if (bellTimer > 0) {
      bellTimer = Math.max(0, bellTimer - dt);
      world.bell.rotation.z =
        Math.sin(ambientTime * 15) * Math.min(0.3, bellTimer * 0.3);
    } else world.bell.rotation.z = 0;
    uiTimer -= dt;
    if (uiTimer <= 0) {
      ui.update(
        0.08,
        input.aiming,
        Math.hypot(player.position.x, player.position.z - MAP.bell.z) < 7,
      );
      uiTimer = 0.08;
    }
    camera.updateMatrixWorld();
    effects.render(time);
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
  Object.defineProperty(window, "__soulHarvester", {
    value: () => ({
      ready: true,
      version: "0.6.0",
      active,
      started,
      softwareRenderer: software,
      position: player.position.toArray(),
      yaw: input.yaw,
      pitch: input.pitch,
      ammo: weapon.ammo,
      reserve: weapon.reserve,
      weapon: weapon.id,
      aiming: input.aiming,
      casting: weapon.casting,
      pendingAbilities: abilityPresentation.count,
      reloadProgress: weapon.reloadProgress,
      aimAmount: weapon.aimAmount,
      ground: groundHeight(player.position.x, player.position.z),
      bellPosition: world.bellPosition.toArray(),
      burstCooldown: battle.burstCooldown,
      orbCooldown: battle.orbCooldown,
      fov: camera.fov,
      reloading: weapon.reloading,
      health: battle.health,
      baseHealth: battle.baseHealth,
      phase: battle.phase,
      wave: battle.wave,
      souls: battle.souls,
      coins: battle.coins,
      points: battle.points,
      level: battle.level,
      xp: battle.xp,
      stats: { ...battle.stats },
      skills: { ...battle.skills },
      enemies: battle.alive.map((e) => ({
        id: e.id,
        x: e.x,
        z: e.z,
        hp: e.hp,
        target: e.target,
        windup: e.windup,
        kind: e.kind,
        wave: e.wave,
        hitFlash: e.hitFlash,
        spawnZone: e.spawnZone,
        gait: e.gait,
        vx: e.vx,
        vz: e.vz,
        speedFactor: e.speedFactor,
      })),
      targets: enemies.positions,
      enemyRender: enemies.diagnostics(),
      drops: battle.drops
        .filter((d) => d.active)
        .map((d) => ({
          id: d.id,
          kind: d.kind,
          x: d.x,
          y: d.y,
          z: d.z,
          magnet: d.magnet,
          age: d.age,
          bounces: d.bounces,
          value: d.value,
        })),
      lootRender: effects.diagnostics(),
      activeWaves: battle.activeWaves,
      pending: battle.pending,
      plannedEnemies: battle.waveJobs.reduce((n, j) => n + j.plan.length, 0),
      spawnZones: battle.spawner.zones.map((z, i) => ({
        validPoints: z.length,
        spawned: battle.spawner.counts[i],
      })),
      hitFeedback: {
        visible: feedback.remaining > 0,
        kill: feedback.kill,
        confirmedHits,
        confirmedKills,
        lastBulletHit,
      },
      sightProjection: weapon
        .sightPoints()
        .map((p) => p.project(camera).toArray()),
      colliders: world.solids.length,
      fps,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      memory: {
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
      },
      surfaces: surfaceSummary(),
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
