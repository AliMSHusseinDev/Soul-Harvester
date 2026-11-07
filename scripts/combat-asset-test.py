"""Importer checks use tiny diagnostic images, never substitute combat artwork."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from PIL import Image, ImageDraw

spec = importlib.util.spec_from_file_location("combat_importer", Path(__file__).with_name("prepare-combat-assets.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ImporterTests(unittest.TestCase):
    def test_background_removal_preserves_dark_outline_holes_and_original_alpha(self):
        image = Image.new("RGBA", (12, 12), (0, 0, 0, 255))
        draw = ImageDraw.Draw(image)
        draw.rectangle((3, 3, 8, 8), fill=(6, 3, 4, 255))
        draw.rectangle((4, 4, 7, 7), fill=(200, 32, 64, 255))
        image.putpixel((5, 5), (0, 0, 0, 255))
        image.putpixel((4, 3), (150, 120, 0, 96))
        result = module.remove_connected_black(image)
        self.assertEqual(result.getpixel((0, 0)), (0, 0, 0, 0))
        self.assertEqual(result.getpixel((3, 3)), (6, 3, 4, 255))
        self.assertEqual(result.getpixel((4, 3)), (150, 120, 0, 96))
        self.assertEqual(result.getpixel((5, 5)), (0, 0, 0, 255))
        self.assertEqual(image.getpixel((0, 0)), (0, 0, 0, 255))

    def test_union_crop_keeps_frame_origins_and_orders_explicitly(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            image = Image.new("RGBA", (32, 16))
            image.putpixel((2, 3), (255, 0, 0, 255))
            image.putpixel((27, 12), (0, 255, 0, 96))
            image.save(base / "test-only.png")
            config = {"kind": "normal", "source": "test-only.png", "frameRects": [[16, 0, 16, 16], [0, 0, 16, 16]]}
            sheet, atlas, _, report = module.prepare(config, base)
            self.assertEqual(report["unionCrop"], (2, 3, 12, 13))
            self.assertEqual(sheet["anchor"], [0.6, 0.5])
            a, b = sheet["frames"]
            self.assertEqual(atlas.getpixel((a["x"] + 9, a["y"] + 9)), (0, 255, 0, 96))
            self.assertEqual(atlas.getpixel((b["x"], b["y"])), (255, 0, 0, 255))
            self.assertEqual(atlas.getpixel((a["x"] - 1, a["y"])), (0, 0, 0, 0))
            config["frameRects"][1][2] = 15
            with self.assertRaisesRegex(ValueError, "equal animation canvases"):
                module.prepare(config, base)


if __name__ == "__main__":
    unittest.main()
