import { resolveCircle } from "./math";
import * as THREE from "three";
import type { Input } from "./input";
import type { World } from "./world";
import type { Effects } from "./effects";
import { LIGHTING, TUNING } from "./tuning";
import { islandSurfaceHeight } from "./island";
import { surface, type Surface } from "./surfaces";
import { applyDeveloperWorld, editorRootName } from "./developer-world";
import {
  applyTuning,
  DEFAULT_TUNING,
  DEV_KEY,
  SETTINGS,
  TEXTURES,
  validateProject,
  type DevProject,
  type DevObject,
} from "./developer-project";
import "./developer.css";
const clone = <T>(v: T): T => structuredClone(v);
const title = (s: string) =>
  s.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll(".", " › ");
function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text = "",
  parent?: HTMLElement,
) {
  const e = document.createElement(tag);
  e.textContent = text;
  parent?.append(e);
  return e;
}
export class Developer {
  enabled = false;
  flying = true;
  panelOpen = true;
  private tab = "Welcome";
  private selected: string | null = null;
  private tool = "select";
  private texture = "stone";
  private kind: DevObject["kind"] = "block";
  private tint = "#a5b6a0";
  private snap = 1;
  private brushRadius = 10;
  private brushStrength = 2;
  private previewKind = 0;
  private slow = 1;
  private frozen = false;
  private previewTime = 0;
  private panel = element("aside");
  private content = element("div");
  private status = element("span");
  private badge = element("div");
  private hotbar = element("div");
  private history: string[] = [];
  private future: string[] = [];
  private dirty = false;
  private lights: THREE.Light[] = [];
  private pending: ReturnType<typeof setTimeout> | undefined;
  private ray = new THREE.Raycaster();
  private direction = new THREE.Vector3();
  private verticalAxis = new THREE.Vector3(0, 1, 0);
  private move = new THREE.Vector3();
  private marker = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({
      color: 0xaadd88,
      wireframe: true,
      depthTest: true,
    }),
  );
  private hit: THREE.Vector3 | null = null;
  constructor(
    private world: World,
    private camera: THREE.PerspectiveCamera,
    private input: Input,
    private effects: Effects,
    private renderer: THREE.WebGLRenderer,
    public project: DevProject,
    private activate: (v: boolean) => void,
  ) {
    this.renderer.domElement.tabIndex = 0;
    this.panel.id = "developer-panel";
    this.panel.hidden = true;
    this.panel.setAttribute("aria-label", "Developer editor");
    this.panel.setAttribute("role", "region");
    document.body.append(this.panel);
    this.badge.id = "developer-badge";
    this.badge.hidden = true;
    this.hotbar.hidden = true;
    document.body.append(this.badge);
    this.hotbar.id = "developer-hotbar";
    this.hotbar.hidden = true;
    document.body.append(this.hotbar);
    TEXTURES.slice(0, 8).forEach((name, i) => {
      const b = this.button(
        `${i + 1} · ${name}`,
        () => {
          this.texture = name;
          this.tool = "build";
        },
        this.hotbar,
      );
      b.dataset.texture = name;
      const image = element("img", "", b);
      image.alt = name;
      image.src = (
        surface(name as Surface).image as HTMLCanvasElement
      ).toDataURL();
    });
    this.lights = this.world.scene.children.filter(
      (o) =>
        o instanceof THREE.HemisphereLight ||
        o instanceof THREE.DirectionalLight,
    ) as THREE.Light[];
    this.marker.visible = false;
    this.marker.name = "Developer placement preview";
    world.scene.add(this.marker);
    const header = element("header", "", this.panel);
    element("div", "SOUL HARVESTER · STUDIO", header);
    element("h2", "Developer workspace", header);
    element(
      "p",
      "Your local project · F1 toggles cursor · Left Alt toggles flight",
      header,
    );
    const actions = element("div", "", header);
    this.button("Resume / F1", () => this.togglePanel(), actions);
    this.button("Undo", () => this.undo(), actions);
    this.button("Redo", () => this.redo(), actions);
    this.button("Save now", () => this.save(), actions);
    this.button("Export JSON", () => this.export(), actions);
    this.button("Import JSON", () => this.import(), actions);
    this.button(
      "Reload saved project",
      () => {
        if (this.save()) location.reload();
      },
      actions,
    );
    this.button("Exit to menu", () => this.exit(), actions);
    header.append(this.status);
    const nav = element("nav", "", this.panel);
    for (const tab of [
      "Welcome",
      "Effects",
      "Map Design",
      "Terrain",
      "Graphics",
      "Materials",
      "Game Tuning",
    ])
      this.button(
        tab,
        () => {
          this.tab = tab;
          this.render();
        },
        nav,
      );
    this.content.className = "dev-content";
    this.panel.append(this.content);
    const button = element("button", "Developer Button");
    button.id = "developer-button";
    button.className = "secondary";
    document.querySelector(".menu-actions")!.append(button);
    button.onclick = () => this.enter();
    window.addEventListener(
      "keydown",
      (e) => {
        if (!this.enabled) return;
        const typing = (e.target as HTMLElement)?.matches(
          "input,select,textarea",
        );
        if (e.code === "F1") {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (!e.repeat) this.togglePanel();
          return;
        }
        if (typing) return;
        if (/^Digit[1-8]$/.test(e.code)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.texture = TEXTURES[Number(e.code.slice(-1)) - 1];
          this.tool = "build";
          return;
        }
        if (e.code === "AltLeft") {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (!e.repeat) {
            this.flying = !this.flying;
            this.input.clear();
          }
          return;
        }
        if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") {
          e.preventDefault();
          e.shiftKey ? this.redo() : this.undo();
        }
        if (e.code === "Delete" && this.panelOpen) this.remove();
      },
      true,
    );
    document.addEventListener("pointerlockchange", () => {
      if (this.enabled && !this.input.locked && !this.panelOpen) {
        this.panelOpen = true;
        this.panel.hidden = false;
        this.render();
      }
    });
    this.renderer.domElement.addEventListener(
      "mousedown",
      (e) => {
        if (
          !this.enabled ||
          this.panelOpen ||
          document.pointerLockElement !== this.renderer.domElement
        )
          return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.button === 0) this.useTool();
        if (e.button === 2 && this.tool === "build") {
          this.ray.setFromCamera(new THREE.Vector2(), this.camera);
          const root = this.world.scene.getObjectByName(editorRootName);
          this.selected = root
            ? (this.ray.intersectObject(root, true)[0]?.object.userData.devId ??
              null)
            : null;
          this.remove();
        }
      },
      true,
    );
    window.addEventListener("pagehide", () => {
      if (this.dirty) this.save();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.dirty) this.save();
    });
    this.status.textContent =
      "Saved locally · export a backup before clearing browser data";
    this.render();
  }
  get diagnostics() {
    return {
      enabled: this.enabled,
      panel: this.panelOpen,
      captured: this.input.locked,
      flying: this.flying,
      tool: this.tool,
      objects: this.project.objects.length,
      brushes: this.project.brushes.length,
      dirty: this.dirty,
    };
  }
  private button(
    label: string,
    fn: () => void,
    parent: HTMLElement = this.content,
  ) {
    const b = element("button", label, parent);
    b.type = "button";
    b.onclick = fn;
    return b;
  }
  private note(text: string) {
    element("p", text, this.content).className = "dev-note";
  }
  private number(
    label: string,
    value: number,
    fn: (n: number) => void,
    min = -1000,
    max = 1000,
    step = 0.1,
    parent: HTMLElement = this.content,
  ) {
    const row = element("label", "", parent);
    element("span", label, row);
    const n = element("input", "", row);
    n.type = "number";
    n.setAttribute("aria-label", label);
    n.value = String(value);
    n.min = String(min);
    n.max = String(max);
    n.step = String(step);
    n.onchange = () => {
      const v = Number(n.value);
      if (n.value === "" || !Number.isFinite(v) || v < min || v > max) {
        n.value = String(value);
        this.status.textContent = `Use a value between ${min} and ${max}`;
        return;
      }
      fn(v);
    };
    return n;
  }
  private color(
    label: string,
    value: string,
    fn: (c: string) => void,
    parent: HTMLElement = this.content,
  ) {
    const row = element("label", "", parent);
    element("span", label, row);
    const input = element("input", "", row);
    input.type = "color";
    input.setAttribute("aria-label", label);
    input.value = value;
    input.onchange = () => fn(input.value);
    return input;
  }
  private select(
    label: string,
    values: string[],
    value: string,
    fn: (s: string) => void,
  ) {
    const row = element("label", "", this.content);
    element("span", label, row);
    const s = element("select", "", row);
    for (const v of values) {
      const o = element("option", title(v), s);
      o.value = v;
    }
    s.setAttribute("aria-label", label);
    s.value = value;
    s.onchange = () => fn(s.value);
    return s;
  }
  enter() {
    this.enabled = true;
    this.panelOpen = true;
    this.flying = true;
    this.input.clear();
    this.activate(true);
    document.exitPointerLock();
    this.panel.hidden = false;
    this.badge.hidden = false;
    this.hotbar.hidden = true;
    this.camera.position.set(0, 9, 8);
    this.input.yaw = 0;
    this.input.pitch = -0.15;
    this.render();
  }
  exit() {
    if (!this.save()) return;
    this.enabled = false;
    this.panel.hidden = true;
    this.badge.hidden = true;
    this.hotbar.hidden = true;
    this.marker.visible = false;
    this.effects.reset();
    this.input.clear();
    document.exitPointerLock();
    this.activate(false); // Reload reconstructs collision/navigation from the saved project before play.
    location.reload();
  }
  private togglePanel() {
    this.panelOpen = !this.panelOpen;
    this.panel.hidden = !this.panelOpen;
    this.hotbar.hidden = this.panelOpen;
    this.input.clear();
    if (this.panelOpen) {
      document.exitPointerLock();
      this.render();
    } else {
      this.renderer.domElement.focus({ preventScroll: true });
      void this.input.capture().catch(() => {
        this.panelOpen = true;
        this.panel.hidden = false;
        this.status.textContent =
          "Mouse capture blocked. Open in its own tab and press Resume.";
      });
    }
  }
  private checkpoint() {
    this.history.push(JSON.stringify(this.project));
    while (
      this.history.length > 40 ||
      this.history.reduce((n, s) => n + s.length, 0) > 12000000
    )
      this.history.shift();
    this.future = [];
  }
  private changed(world = false) {
    this.dirty = true;
    this.status.textContent = "Saving…";
    if (world) applyDeveloperWorld(this.world, this.project, true);
    clearTimeout(this.pending);
    this.pending = setTimeout(() => this.save(), 350);
  }
  private restore(raw: string) {
    this.project = validateProject(JSON.parse(raw));
    applyTuning(DEFAULT_TUNING);
    applyTuning(this.project.tuning);
    applyDeveloperWorld(this.world, this.project, true);
    this.selected = null;
    this.changed();
    this.render();
  }
  undo() {
    const s = this.history.pop();
    if (s) {
      this.future.push(JSON.stringify(this.project));
      this.restore(s);
    }
  }
  redo() {
    const s = this.future.pop();
    if (s) {
      this.history.push(JSON.stringify(this.project));
      this.restore(s);
    }
  }
  save() {
    clearTimeout(this.pending);
    try {
      localStorage.setItem(DEV_KEY, JSON.stringify(this.project));
      this.dirty = false;
      this.status.textContent = `Saved on this browser · ${new Date().toLocaleTimeString()}`;
      return true;
    } catch {
      this.status.textContent =
        "SAVE FAILED: browser storage is full/disabled. Export JSON now; your current scene is still available.";
      return false;
    }
  }
  private export() {
    this.save();
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(this.project, null, 2)], {
        type: "application/json",
      }),
    );
    const a = element("a");
    a.href = url;
    a.download = "soul-harvester-project.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  private import() {
    const file = element("input");
    file.type = "file";
    file.accept = ".json,application/json";
    file.onchange = async () => {
      try {
        const f = file.files?.[0];
        if (!f || f.size > 12000000) throw Error("Project limit is 12 MB.");
        const next = validateProject(JSON.parse(await f.text()));
        this.checkpoint();
        this.restore(JSON.stringify(next));
        this.save();
      } catch (e) {
        this.status.textContent = String(e);
      }
    };
    file.click();
  }
  private remove() {
    if (!this.selected) return;
    this.checkpoint();
    this.project.objects = this.project.objects.filter(
      (o) => o.id !== this.selected,
    );
    this.selected = null;
    this.changed(true);
    this.render();
  }
  private render() {
    this.content.replaceChildren();
    element("h3", this.tab, this.content);
    for (const b of this.panel.querySelectorAll("nav button"))
      b.classList.toggle("selected", b.textContent === this.tab);
    if (this.tab === "Welcome") {
      this.note(
        "A local editor for your game. Changes are autosaved in this browser, shared by Developer Mode and normal play. Export JSON for a portable backup. Browser data is not an online account backup.",
      );
      this.note(
        "FLY: Resume / F1, then Left Alt toggles flight. WASD + mouse, Space up, Left Ctrl down, Shift faster. F1 releases the cursor. Right Alt is not used. Flight ignores walls, objects and pickups.",
      );
      this.note(
        "BUILD: choose a texture and shape in Map Design, choose Build, then Resume. Aim at terrain and left-click to place. Right-click removes an editor-created object. Select returns an object to the inspector.",
      );
      this.note(
        "TERRAIN: choose Raise or Lower, radius and strength, then Resume and click. The brush uses a smooth radial profile. Use gentle strokes near buildings: architecture does not automatically move with edited ground.",
      );
      this.note(
        "LIVE / RELOAD: effects and current values read by simulation update live. Pool sizes, shader constants, map layout and cached gameplay state require Reload saved project. Exit rebuilds the saved map, bullet collisions and enemy navigation before normal play.",
      );
      this.note(
        "Map inspector currently edits objects placed with this editor. Existing castle/forest meshes remain authored scenery; terrain shaping and world colors are editable.",
      );
      this.button("Start building", () => {
        this.tab = "Map Design";
        this.render();
      });
      this.button("Tune effects", () => {
        this.tab = "Effects";
        this.render();
      });
      return;
    }
    if (this.tab === "Effects") {
      this.select(
        "Enemy type",
        ["0", "1", "2", "3"],
        String(this.previewKind),
        (s) => (this.previewKind = Number(s)),
      );
      const row = element("div", "", this.content);
      for (const event of ["Hit", "Critical", "Death", "Nova"])
        this.button(`Preview ${event}`, () => this.preview(event), row);
      this.number(
        "Preview time scale",
        this.slow,
        (v) => (this.slow = v),
        0.05,
        2,
        0.05,
      );
      this.button(this.frozen ? "Resume effects" : "Freeze effects", () => {
        this.frozen = !this.frozen;
        this.render();
      });
      this.button("Clear effects", () => this.effects.reset());
      this.note(
        "Splatter: bright blood rays. Bleeding: dark weighted fragments. Smoke: one coherent death cloud. Set gravity to 0 for weightless motion. Sizes do not depend on weight. Color inputs edit hexadecimal RGB.",
      );
      this.settings("effects");
      return;
    }
    if (this.tab === "Game Tuning") {
      this.settings("");
      return;
    }
    if (this.tab === "Map Design") {
      this.note(
        "Choose Build, resume with F1, aim and click. Grid snap is in metres. Select + click picks only editor-created objects. Object edits autosave; Exit/Reload rebuilds gameplay collision and pathfinding.",
      );
      this.select(
        "Tool",
        ["select", "build"],
        this.tool,
        (s) => (this.tool = s),
      );
      this.select(
        "Shape",
        ["block", "rock", "tree"],
        this.kind,
        (s) => (this.kind = s as DevObject["kind"]),
      );
      this.number(
        "Grid snap",
        this.snap,
        (n) => (this.snap = n),
        0.25,
        8,
        0.25,
      );
      this.color("Placement tint", this.tint, (s) => (this.tint = s));
      this.palette();
      const o = this.project.objects.find((o) => o.id === this.selected);
      if (o) {
        element("h4", `Selected ${o.kind}`, this.content);
        for (const [i, axis] of ["X", "Y", "Z"].entries()) {
          this.number(
            `Position ${axis}`,
            o.position[i],
            (v) => {
              this.checkpoint();
              o.position[i] = v;
              this.changed(true);
            },
            -500,
            500,
            0.25,
          );
          this.number(
            `Size ${axis}`,
            o.scale[i],
            (v) => {
              this.checkpoint();
              o.scale[i] = v;
              this.changed(true);
            },
            0.1,
            100,
            0.1,
          );
        }
        this.number(
          "Rotation Y (degrees)",
          o.yaw,
          (v) => {
            this.checkpoint();
            o.yaw = v;
            this.changed(true);
          },
          -360,
          360,
          5,
        );
        this.color("Object color", o.color, (c) => {
          this.checkpoint();
          o.color = c;
          this.changed(true);
        });
        this.button("Apply selected texture", () => {
          this.checkpoint();
          o.texture = this.texture;
          this.changed(true);
        });
        this.button("Duplicate", () => {
          if (this.project.objects.length >= 512) return;
          this.checkpoint();
          const copy = clone(o);
          copy.id = crypto.randomUUID();
          copy.position[0] += this.snap;
          this.project.objects.push(copy);
          this.selected = copy.id;
          this.changed(true);
          this.render();
        });
        this.button("Delete selected", () => this.remove());
      }
      element(
        "h4",
        `Placed objects (${this.project.objects.length}/512)`,
        this.content,
      );
      for (const o of this.project.objects)
        this.button(
          `${o.kind} · ${o.position.map((n) => n.toFixed(1)).join(", ")}`,
          () => {
            this.selected = o.id;
            this.render();
          },
        );
      return;
    }
    if (this.tab === "Terrain") {
      this.note(
        "Smooth raise/lower strokes affect the island mesh and gameplay ground height. Fixed structures stay in place. Brush history is limited to 128 strokes to keep terrain updates bounded. Undo reverses a whole stroke.",
      );
      this.select(
        "Tool",
        ["raise", "lower", "select"],
        this.tool,
        (s) => (this.tool = s),
      );
      this.number(
        "Brush radius (m)",
        this.brushRadius,
        (v) => (this.brushRadius = v),
        1,
        80,
        1,
      );
      this.number(
        "Height per click (m)",
        this.brushStrength,
        (v) => (this.brushStrength = v),
        0.1,
        20,
        0.1,
      );
      this.note(`${this.project.brushes.length}/128 terrain strokes`);
      this.button("Clear terrain strokes", () => {
        this.checkpoint();
        this.project.brushes = [];
        this.changed(true);
        this.render();
      });
      return;
    }
    if (this.tab === "Graphics") {
      this.note(
        "World colors apply live. Fog and exposure are live. Shader/geometry construction settings need Reload.",
      );
      for (const k of ["fog", "background", "terrain"] as const)
        this.color(title(k), this.project.graphics[k], (c) => {
          this.checkpoint();
          this.project.graphics[k] = c;
          this.changed(true);
        });
      this.settings("lighting");
      this.settings("environment");
      this.settings("view");
      return;
    }
    if (this.tab === "Materials") {
      this.note(
        "Original game textures. Pick one to use on new objects, or apply it to the selected editor object. Custom images are local to this project and included in JSON export. PNG/JPEG/WebP only; 1 MB, 2048×2048 maximum, eight custom images.",
      );
      this.palette();
      this.button("Import texture image", () => this.importTexture());
      if (this.texture.startsWith("custom-"))
        this.button("Delete selected custom texture", () => {
          if (this.project.objects.some((o) => o.texture === this.texture)) {
            this.status.textContent =
              "Replace this texture on placed objects before deleting it.";
            return;
          }
          this.checkpoint();
          delete this.project.textures[this.texture];
          this.texture = "stone";
          this.changed();
          this.render();
        });
    }
  }
  private palette() {
    const grid = element("div", "", this.content);
    grid.className = "dev-palette";
    for (const name of [...TEXTURES, ...Object.keys(this.project.textures)]) {
      const b = this.button(
        name,
        () => {
          this.texture = name;
          this.render();
        },
        grid,
      );
      b.classList.toggle("selected", this.texture === name);
      const img = element("img", "", b);
      img.alt = name;
      img.src =
        this.project.textures[name] ??
        (surface(name as Surface).image as HTMLCanvasElement).toDataURL();
    }
  }
  private settings(group: string) {
    const search = element("input", "", this.content);
    search.placeholder = "Search settings — smoke, gravity, lifetime…";
    search.setAttribute("aria-label", "Search tuning");
    const list = element("div", "", this.content);
    const draw = () => {
      list.replaceChildren();
      for (const s of SETTINGS.filter(
        (s) =>
          (!group || s.path.startsWith(group + ".")) &&
          s.path.toLowerCase().includes(search.value.toLowerCase()),
      )) {
        const value = this.project.tuning[s.path] ?? s.value;
        const change = (v: number | boolean) => {
          try {
            validateProject({
              ...this.project,
              tuning: { ...this.project.tuning, [s.path]: v },
            });
          } catch (e) {
            this.status.textContent = String(e);
            return;
          }
          this.checkpoint();
          this.project.tuning[s.path] = v;
          applyTuning(this.project.tuning);
          this.changed();
        };
        const label = title(s.path);
        if (typeof value === "boolean") {
          const row = element("label", "", list);
          element("span", label, row);
          const n = element("input", "", row);
          n.type = "checkbox";
          n.checked = value;
          n.onchange = () => change(n.checked);
        } else if (s.color)
          this.color(
            label,
            `#${value.toString(16).padStart(6, "0")}`,
            (c) => change(parseInt(c.slice(1), 16)),
            list,
          );
        else this.number(label, value, change, s.min, s.max, s.step, list);
        const info = element(
          "small",
          `${s.description} Default: ${String(s.value)}`,
          list,
        );
        info.className = "dev-description";
      }
    };
    search.oninput = draw;
    draw();
    this.button(`Reset ${group || "all tuning"} defaults`, () => {
      this.checkpoint();
      for (const s of SETTINGS)
        if (!group || s.path.startsWith(group + "."))
          delete this.project.tuning[s.path];
      applyTuning(DEFAULT_TUNING);
      applyTuning(this.project.tuning);
      this.changed();
      this.render();
    });
  }
  private async importTexture() {
    const input = element("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.onchange = async () => {
      try {
        const f = input.files?.[0];
        if (
          !f ||
          f.size > 1000000 ||
          !["image/png", "image/jpeg", "image/webp"].includes(f.type) ||
          Object.keys(this.project.textures).length >= 8
        )
          throw Error(
            "Use PNG/JPEG/WebP up to 1 MB; eight custom textures maximum.",
          );
        const bmp = await createImageBitmap(f);
        if (bmp.width > 2048 || bmp.height > 2048) {
          bmp.close();
          throw Error("Maximum image size is 2048×2048.");
        }
        bmp.close();
        const reader = new FileReader();
        reader.onload = () => {
          this.checkpoint();
          const id = `custom-${crypto.randomUUID()}`;
          this.project.textures[id] = String(reader.result);
          this.texture = id;
          this.changed();
          this.render();
        };
        reader.readAsDataURL(f);
      } catch (e) {
        this.status.textContent = String(e);
      }
    };
    input.click();
  }
  private preview(event: string) {
    const target = this.camera
      .getWorldDirection(this.direction)
      .multiplyScalar(6)
      .add(this.camera.position);
    target.y = Math.max(islandSurfaceHeight(target.x, target.z) + 1, target.y);
    if (event === "Death")
      this.effects.death(
        target.x,
        target.z,
        this.previewKind,
        false,
        this.direction.x,
        this.direction.z,
        false,
        {
          x: target.x,
          y: target.y,
          z: target.z,
          dx: this.direction.x,
          dy: this.direction.y,
          dz: this.direction.z,
          nx: -this.direction.x,
          ny: -this.direction.y,
          nz: -this.direction.z,
        },
      );
    else if (event === "Nova") this.effects.pulse(target.x, target.z);
    else
      this.effects["procedural"].emit(
        event === "Critical" ? "critical" : "hit",
        target.x,
        target.y,
        target.z,
      );
  }
  private pickTarget() {
    this.camera.rotation.set(this.input.pitch, this.input.yaw, 0, "YXZ");
    this.camera.updateMatrixWorld();
    this.ray.setFromCamera(new THREE.Vector2(), this.camera);
    const hit = this.world.ballistics.hit(this.ray.ray, 180);
    if (!hit) return null;
    const point = hit.point;
    point.x = Math.round(point.x / this.snap) * this.snap;
    point.z = Math.round(point.z / this.snap) * this.snap;
    return point;
  }
  private useTool() {
    if (this.tool === "select") {
      const root = this.world.scene.getObjectByName(editorRootName);
      this.ray.setFromCamera(new THREE.Vector2(), this.camera);
      const hit = root ? this.ray.intersectObject(root, true)[0] : undefined;
      this.selected = hit?.object.userData.devId ?? null;
      this.panelOpen = true;
      this.panel.hidden = false;
      document.exitPointerLock();
      this.render();
      return;
    }
    this.hit = this.pickTarget();
    if (!this.hit) return;
    this.checkpoint();
    if (this.tool === "build") {
      if (this.project.objects.length >= 512) {
        this.status.textContent = "Object limit: 512";
        return;
      }
      this.project.objects.push({
        id: crypto.randomUUID(),
        kind: this.kind,
        texture: this.texture,
        color: this.tint,
        position: [this.hit.x, this.hit.y + 0.5, this.hit.z],
        scale: [1, 1, 1],
        yaw: 0,
      });
    } else if (this.tool === "raise" || this.tool === "lower") {
      if (this.project.brushes.length >= 128) return;
      this.project.brushes.push({
        x: this.hit.x,
        z: this.hit.z,
        radius: this.brushRadius,
        height: this.brushStrength * (this.tool === "raise" ? 1 : -1),
      });
    }
    this.changed(true);
  }
  step(dt: number) {
    if (!this.enabled) return;

    for (const b of this.hotbar.querySelectorAll("button"))
      b.classList.toggle("selected", b.dataset.texture === this.texture);
    this.badge.textContent = `DEVELOPER · ${this.flying ? "FLY / NOCLIP" : "WALK"} · ${this.tool.toUpperCase()} · F1 editor · Left Alt flight · ${this.project.objects.length} objects`;
    if (!this.panelOpen && this.input.locked) {
      this.camera.rotation.order = "YXZ";
      this.camera.rotation.set(this.input.pitch, this.input.yaw, 0, "YXZ");
      this.move.set(
        Number(this.input.keys.has("KeyD")) -
          Number(this.input.keys.has("KeyA")),
        0,
        Number(this.input.keys.has("KeyS")) -
          Number(this.input.keys.has("KeyW")),
      );
      if (this.move.lengthSq()) this.move.normalize();
      this.move.applyAxisAngle(this.verticalAxis, this.input.yaw);
      if (this.flying)
        this.move.y =
          Number(this.input.keys.has("Space")) -
          Number(this.input.keys.has("ControlLeft"));
      if (this.move.lengthSq()) this.move.normalize();
      this.camera.position.addScaledVector(
        this.move,
        dt * (this.input.keys.has("ShiftLeft") ? 30 : 9),
      );
      if (!this.flying) {
        const p = resolveCircle(
          this.camera.position.x,
          this.camera.position.z,
          0.35,
          this.camera.position.y - 1.72,
          this.world.solids,
        );
        this.camera.position.x = p.x;
        this.camera.position.z = p.z;
      }
      if (!this.flying)
        this.camera.position.y =
          this.world.ballistics.supportHeight(
            this.camera.position.x,
            this.camera.position.z,
            this.camera.position.y - 0.4,
            islandSurfaceHeight(this.camera.position.x, this.camera.position.z),
          ) + 1.72;
    }
    this.camera.updateMatrixWorld();
    this.hit = null;
    this.marker.visible = false;
    if (!this.panelOpen && this.tool !== "select") {
      this.ray.setFromCamera(new THREE.Vector2(), this.camera);
      const hit = this.world.ballistics.hit(this.ray.ray, 180);
      if (hit && hit.distance < 180) {
        this.hit = hit.point.clone();
        this.hit.x = Math.round(this.hit.x / this.snap) * this.snap;
        this.hit.z = Math.round(this.hit.z / this.snap) * this.snap;
        this.marker.visible = true;
        this.marker.position.copy(this.hit);
        this.marker.position.y += 0.51;
        this.marker.scale.set(
          this.tool === "build" ? 1 : this.brushRadius * 2,
          this.tool === "build" ? 1 : 0.05,
          this.tool === "build" ? 1 : this.brushRadius * 2,
        );
      }
    }
    let directional = 0;
    for (const light of this.lights)
      light.intensity =
        light instanceof THREE.HemisphereLight
          ? LIGHTING.sky
          : directional++ === 0
            ? LIGHTING.moon
            : LIGHTING.fill;
    this.renderer.toneMappingExposure = LIGHTING.exposure;
    if (this.world.scene.fog instanceof THREE.FogExp2)
      this.world.scene.fog.density = LIGHTING.fogDensity;
    if (!this.frozen) {
      this.previewTime += dt * this.slow;
      this.effects.step(dt * this.slow, this.previewTime);
    }
  }
}
