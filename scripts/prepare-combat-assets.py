#!/usr/bin/env python3
"""Inspect originals, then repack explicitly measured frames. Requires Pillow (build tool only)."""
import argparse
from collections import deque
import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
KINDS = {"normal", "critical", "death"}


def remove_connected_black(image, threshold=0):
    """Remove only near-black areas connected to the frame boundary, not all dark texels."""
    if not isinstance(threshold, int) or not 0 <= threshold <= 16:
        raise ValueError("blackThreshold must be an integer in [0, 16]; inspect dark outlines first")
    image = image.copy().convert("RGBA")
    w, h = image.size
    pixels = image.load()
    seen = bytearray(w * h)
    todo = deque()

    def visit(x, y):
        at = y * w + x
        if seen[at]:
            return
        seen[at] = 1
        r, g, b, a = pixels[x, y]
        if a == 0 or max(r, g, b) <= threshold:
            pixels[x, y] = (0, 0, 0, 0)
            todo.append((x, y))

    for x in range(w):
        visit(x, 0)
        visit(x, h - 1)
    for y in range(h):
        visit(0, y)
        visit(w - 1, y)
    while todo:
        x, y = todo.popleft()
        if x:
            visit(x - 1, y)
        if x + 1 < w:
            visit(x + 1, y)
        if y:
            visit(x, y - 1)
        if y + 1 < h:
            visit(x, y + 1)
    return image


def inspect(path):
    with Image.open(path) as original:
        image = original.convert("RGBA")
    alpha = image.getchannel("A")
    histogram = alpha.histogram()
    border = list(image.crop((0, 0, image.width, 1)).getdata())
    border += list(image.crop((0, image.height - 1, image.width, image.height)).getdata())
    print(json.dumps({
        "source": str(path), "size": image.size,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "alphaRange": alpha.getextrema(), "alphaBounds": alpha.getbbox(),
        "transparentPixels": histogram[0], "semiTransparentPixels": sum(histogram[1:255]),
        "opaqueBlackBorderPixels": sum(a == 255 and max(r, g, b) == 0 for r, g, b, a in border),
    }, indent=2))


def prepare(entry, base):
    kind = entry["kind"]
    if kind not in KINDS:
        raise ValueError(f"Unknown effect kind: {kind}")
    source = (base / entry["source"]).resolve()
    with Image.open(source) as original:
        image = original.convert("RGBA")
    rects = entry["frameRects"]
    if not 2 <= len(rects) <= 256:
        raise ValueError("List every used frame in playback order (2–256 rectangles)")
    frames = []
    mode = entry.get("background", "alpha")
    if mode not in {"alpha", "connected-black"}:
        raise ValueError("background must be alpha or connected-black")
    requested_canvas = entry.get("canvasSize")
    if requested_canvas is not None and (len(requested_canvas) != 2 or
            any(not isinstance(n, int) or n < 1 for n in requested_canvas)):
        raise ValueError("canvasSize must be an explicit positive [width,height]")
    canvas = tuple(requested_canvas) if requested_canvas else None
    combined = None
    for rect in rects:
        if len(rect) != 4 or any(not isinstance(n, int) for n in rect):
            raise ValueError("frameRects entries must be integer [x,y,width,height]")
        x, y, w, h = rect
        if min(x, y) < 0 or min(w, h) < 1 or x + w > image.width or y + h > image.height:
            raise ValueError(f"Out-of-bounds frame in {kind}: {rect}")
        if requested_canvas and (w > canvas[0] or h > canvas[1]):
            raise ValueError("canvasSize cannot crop source frame pixels")
        if not requested_canvas and canvas is not None and canvas != (w, h):
            raise ValueError("Use equal animation canvases; separately cropped frames would jitter")
        if canvas is None:
            canvas = (w, h)
        frame = image.crop((x, y, x + w, y + h))
        if mode == "connected-black":
            frame = remove_connected_black(frame, entry.get("blackThreshold", 0))
        if frame.size != canvas:
            normalized = Image.new("RGBA", canvas)
            normalized.paste(frame, ((canvas[0] - w) // 2, (canvas[1] - h) // 2))
            frame = normalized
        frames.append(frame)
        alpha = frame.getchannel("A")
        combined = ImageChops.lighter(combined, alpha) if combined else alpha.copy()
    bounds = combined.getbbox()
    if bounds is None:
        raise ValueError(f"Empty animation: {kind}")
    left, top, right, bottom = bounds
    w, h = right - left, bottom - top
    anchor = entry.get("anchor", [0.5, 0.5])
    if len(anchor) != 2 or any(not math.isfinite(n) or not 0 <= n <= 1 for n in anchor):
        raise ValueError("anchor is a normalized [x,y] on the ORIGINAL frame canvas")
    anchor = [(anchor[0] * canvas[0] - left) / w, (anchor[1] * canvas[1] - top) / h]
    if any(n < 0 or n > 1 for n in anchor):
        raise ValueError("Anchor falls outside union crop; expand authored canvas/bounds explicitly")
    fps = entry.get("fps")
    if fps is not None and (not math.isfinite(fps) or fps <= 0):
        raise ValueError("fps must be positive")
    padding = 2
    columns = math.ceil(math.sqrt(len(frames)))
    rows = math.ceil(len(frames) / columns)
    atlas = Image.new("RGBA", ((w + padding * 2) * columns, (h + padding * 2) * rows))
    if max(atlas.size) > 8192:
        raise ValueError("Prepared atlas exceeds 8192px; inspect the frame boundaries")
    metadata = []
    checker = Image.new("RGBA", atlas.size)
    draw = ImageDraw.Draw(checker)
    for y in range(0, checker.height, 16):
        for x in range(0, checker.width, 16):
            draw.rectangle((x, y, x + 15, y + 15), fill=(48, 56, 62) if (x // 16 + y // 16) % 2 else (90, 96, 102))
    for i, frame in enumerate(frames):
        x = (i % columns) * (w + padding * 2) + padding
        y = (i // columns) * (h + padding * 2) + padding
        cropped = frame.crop(bounds)
        atlas.paste(cropped, (x, y))  # No alpha mask: preserve original semi-transparent texels exactly.
        histogram = cropped.getchannel("A").histogram()
        metadata.append({"x": x, "y": y, "width": w, "height": h,
                         "coverage": round(sum(i * n for i, n in enumerate(histogram)) / (255 * w * h), 6)})
    checker.alpha_composite(atlas)
    sheet = {"kind": kind, "source": source.name, "url": f"vfx/combat/{kind}.png", "width": atlas.width,
             "height": atlas.height, "anchor": anchor, "frames": metadata}
    if fps is not None:
        sheet["fps"] = fps
    report = {"kind": kind, "source": source.name, "sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
              "originalSize": image.size, "frameRects": rects, "background": mode,
              "unionCrop": bounds, "frameCanvas": canvas,
              "frameCount": len(frames), "atlasSize": atlas.size}
    return sheet, atlas, checker, report


def build(config_path):
    config = json.loads(config_path.read_text())
    entries = config["sheets"]
    if len(entries) != 3 or {e["kind"] for e in entries} != KINDS:
        raise ValueError("Supply exactly the original normal, critical and death sheets")
    # Validate/process all sources before modifying the catalog or public assets.
    prepared = [prepare(e, config_path.parent) for e in entries]
    out = ROOT / "public/vfx/combat"
    review = ROOT / "artifacts/combat-assets"
    out.mkdir(parents=True, exist_ok=True)
    review.mkdir(parents=True, exist_ok=True)
    for sheet, atlas, checker, report in prepared:
        target = out / f"{sheet['kind']}.png"
        atlas.save(target, optimize=True)
        content_hash = hashlib.sha256(target.read_bytes()).hexdigest()[:12]
        sheet["url"] += f"?v={content_hash}"
        checker.convert("RGB").save(review / f"{sheet['kind']}-review.png")
    # URLs follow the document's project path; no root-relative /vfx paths.
    sheets = json.dumps([p[0] for p in prepared], indent=2)
    catalog = 'import type { CombatSheet } from "./combat-sprites";\n\n'
    catalog += f"const sheets = {sheets};\n"
    catalog += "export const COMBAT_ASSETS: readonly CombatSheet[] = sheets.map(s => ({ ...s, "
    catalog += "kind: s.kind as CombatSheet['kind'], anchor: s.anchor as [number, number], "
    catalog += "url: s.url }));\n"
    (ROOT / "src/game/combat-assets.ts").write_text(catalog)
    (review / "report.json").write_text(json.dumps([p[3] for p in prepared], indent=2))
    print(f"Prepared three ORIGINAL atlases; inspect checkerboard previews in {review}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("inspect").add_argument("images", nargs="+", type=Path)
    sub.add_parser("build").add_argument("config", type=Path)
    args = parser.parse_args()
    if args.command == "inspect":
        for path in args.images:
            inspect(path)
    else:
        build(args.config.resolve())
