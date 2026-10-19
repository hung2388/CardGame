import os
import sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

from PIL import Image, ImageDraw

ASSETS_BG_DIR = os.path.join("assets", "bg")
os.makedirs(ASSETS_BG_DIR, exist_ok=True)

# 1. Tạo Seamless 16-bit Pixel Green Felt (64x64)
def create_pixel_felt():
    w, h = 64, 64
    img = Image.new("RGBA", (w, h))
    draw = ImageDraw.Draw(img)

    # Base emerald green
    base_color = (13, 92, 54) # #0d5c36
    alt_color_1 = (16, 110, 64)
    alt_color_2 = (10, 77, 45)
    alt_color_3 = (19, 128, 75)

    for y in range(h):
        for x in range(w):
            pattern = (x * 7 + y * 13) % 17
            if pattern == 0:
                c = alt_color_1
            elif pattern == 3:
                c = alt_color_2
            elif pattern == 7:
                c = alt_color_3
            else:
                c = base_color
            draw.point((x, y), fill=(*c, 255))

    img.save(os.path.join(ASSETS_BG_DIR, "pixel_felt_pattern.png"))
    print("[SUCCESS] Tạo xong pixel_felt_pattern.png")

# 2. Tạo pixel chips trang trí bàn (Red, Gold, Blue, Green chips)
def create_pixel_chips():
    w, h = 96, 24
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    chips = [
        {"x": 12, "main": (239, 68, 68), "accent": (254, 240, 138)},
        {"x": 36, "main": (59, 130, 246), "accent": (255, 255, 255)},
        {"x": 60, "main": (245, 158, 11), "accent": (30, 27, 75)},
        {"x": 84, "main": (34, 197, 94), "accent": (254, 240, 138)}
    ]

    for chip in chips:
        cx, cy = chip["x"], 12
        r = 9
        # Draw circular pixel chip
        for y in range(cy - r, cy + r + 1):
            for x in range(cx - r, cx + r + 1):
                dist_sq = (x - cx) ** 2 + (y - cy) ** 2
                if dist_sq <= r ** 2:
                    if dist_sq >= (r - 1) ** 2:
                        draw.point((x, y), fill=(15, 23, 42, 255)) # Border
                    elif (abs(x - cx) <= 2 or abs(y - cy) <= 2) and dist_sq > 4:
                        draw.point((x, y), fill=(*chip["accent"], 255))
                    else:
                        draw.point((x, y), fill=(*chip["main"], 255))

    img_scaled = img.resize((w * 3, h * 3), Image.Resampling.NEAREST)
    img_scaled.save(os.path.join(ASSETS_BG_DIR, "pixel_chips.png"))
    print("[SUCCESS] Tạo xong pixel_chips.png")

if __name__ == "__main__":
    create_pixel_felt()
    create_pixel_chips()
