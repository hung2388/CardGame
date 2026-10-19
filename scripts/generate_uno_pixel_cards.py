import os
from PIL import Image, ImageDraw

# ==========================================
# 1. CẤU HÌNH KÍCH THƯỚC & BẢNG MÀU PIXEL
# ==========================================
BASE_W, BASE_H = 43, 64       # Kích thước lưới pixel gốc
TARGET_W, TARGET_H = 170, 253 # Kích thước xuất file thực tế

OUTPUT_DIR_UNIQUE = "pixel_deck_unique" # 55 file ảnh gốc
OUTPUT_DIR_FULL = "pixel_deck_108"      # Đủ 108 lá bài chuẩn

ASSETS_DIR_UNIQUE = os.path.join("assets", "cards", "uno", "pixel_deck_unique")
ASSETS_DIR_FULL = os.path.join("assets", "cards", "uno", "pixel_deck_108")

COLORS = {
    "red":    {"main": (217, 56, 49),  "dark": (163, 35, 30)},
    "yellow": {"main": (245, 186, 39), "dark": (196, 138, 16)},
    "green":  {"main": (59, 166, 76),  "dark": (37, 117, 50)},
    "blue":   {"main": (36, 130, 219), "dark": (21, 87, 156)},
    "wild":   {"main": (38, 38, 43),   "dark": (20, 20, 24)}
}

WHITE = (255, 255, 255, 255)
BLACK = (24, 24, 28, 255)

# ==========================================
# 2. MA TRẬN BITMAP CHO SỐ & KÝ HIỆU GÓC
# ==========================================
GLYPHS = {
    # Số 0 chuẩn (rỗng giữa, không có gạch chéo)
    "0": [
        " 111 ",
        "1   1",
        "1   1",
        "1   1",
        "1   1",
        "1   1",
        " 111 "
    ],
    "1": [
        "  1  ",
        " 11  ",
        "  1  ",
        "  1  ",
        "  1  ",
        "  1  ",
        " 111 "
    ],
    "2": [
        " 111 ",
        "1   1",
        "    1",
        "  11 ",
        " 1   ",
        "1    ",
        "11111"
    ],
    "3": [
        " 111 ",
        "1   1",
        "    1",
        "  11 ",
        "    1",
        "1   1",
        " 111 "
    ],
    "4": [
        "   1 ",
        "  11 ",
        " 1 1 ",
        "1  1 ",
        "11111",
        "   1 ",
        "   1 "
    ],
    "5": [
        "11111",
        "1    ",
        "1111 ",
        "    1",
        "    1",
        "1   1",
        " 111 "
    ],
    "6": [
        " 111 ",
        "1    ",
        "1111 ",
        "1   1",
        "1   1",
        "1   1",
        " 111 "
    ],
    "7": [
        "11111",
        "    1",
        "   1 ",
        "  1  ",
        "  1  ",
        "  1  ",
        "  1  "
    ],
    "8": [
        " 111 ",
        "1   1",
        "1   1",
        " 111 ",
        "1   1",
        "1   1",
        " 111 "
    ],
    "9": [
        " 111 ",
        "1   1",
        "1   1",
        " 1111",
        "    1",
        "    1",
        " 111 "
    ],
    "+": [
        "     ",
        "  1  ",
        "  1  ",
        "11111",
        "  1  ",
        "  1  ",
        "     "
    ],
    "wild": [
        " 111 ",
        "11 11",
        "11 11",
        "     ",
        "11 11",
        "11 11",
        " 111 "
    ],
    # Ký hiệu góc nhỏ (7x7) cho Skip: Hình tròn có gạch chéo rõ ràng
    "skip_small": [
        "  111  ",
        " 1   1 ",
        "1 1   1",
        "1  1  1",
        "1   1 1",
        " 1   1 ",
        "  111  "
    ],
    # Ký hiệu góc nhỏ (7x7) cho Reverse: Vòng tròn mũi tên xoay
    "rev_small": [
        "  1111 ",
        " 1   11",
        "1   111",
        "       ",
        "111   1",
        "11   1 ",
        " 1111  "
    ]
}

# ==========================================
# 3. MA TRẬN BITMAP LỚN (15x15) Ở GIỮA LÁ BÀI
# ==========================================
CENTER_ICONS = {
    # Biểu tượng Cấm (Skip) 15x15: Vòng tròn dày có thanh chắn chéo
    "skip": [
        "    1111111    ",
        "  11111111111  ",
        " 1111     1111 ",
        " 11111     111 ",
        "111 111     111",
        "11   111     11",
        "11    111    11",
        "11     111   11",
        "11    111    11",
        "11     111   11",
        "111     111 111",
        " 111     11111 ",
        " 1111     1111 ",
        "  11111111111  ",
        "    1111111    "
    ],
    # Biểu tượng Đổi chiều (Reverse) 15x15: Vòng tròn 2 mũi tên cong
    "reverse": [
        "    11111  11  ",
        "  11111111 111 ",
        " 111    1111111",
        " 11      111111",
        "11         111 ",
        "11             ",
        "               ",
        "               ",
        "               ",
        "             11",
        " 111         11",
        "111111      11 ",
        "1111111    111 ",
        " 111 11111111  ",
        "  11  11111    "
    ]
}

# ==========================================
# 4. CÁC HÀM VẼ CHI TIẾT PIXEL ART
# ==========================================
def draw_matrix(img, matrix, x, y, scale, color, shadow_color=None):
    """Vẽ một ma trận điểm ảnh bất kỳ lên ảnh với tỷ lệ scale và đổ bóng."""
    for r, row in enumerate(matrix):
        for c, val in enumerate(row):
            if val == "1":
                if shadow_color:
                    for sy in range(scale):
                        for sx in range(scale):
                            px = x + c * scale + sx
                            py = y + r * scale + sy
                            if 0 <= px + 1 < BASE_W and 0 <= py + 1 < BASE_H:
                                img.putpixel((px + 1, py + 1), shadow_color)
                for sy in range(scale):
                    for sx in range(scale):
                        px = x + c * scale + sx
                        py = y + r * scale + sy
                        if 0 <= px < BASE_W and 0 <= py < BASE_H:
                            img.putpixel((px, py), color)

def draw_glyph(img, glyph_key, x, y, scale, color, shadow_color=None):
    """Vẽ ký hiệu từ từ điển GLYPHS."""
    draw_matrix(img, GLYPHS[glyph_key], x, y, scale, color, shadow_color)

def create_card_base(main_color, dark_color):
    """Tạo khung lá bài pixel bo góc và hình tròn ở chính giữa."""
    img = Image.new("RGBA", (BASE_W, BASE_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 1. Viền đen ngoài cùng (bo góc pixel)
    draw.rectangle([2, 0, BASE_W - 3, BASE_H - 1], fill=BLACK)
    draw.rectangle([0, 2, BASE_W - 1, BASE_H - 3], fill=BLACK)
    draw.rectangle([1, 1, BASE_W - 2, BASE_H - 2], fill=BLACK)

    # 2. Khung trắng bên trong
    draw.rectangle([2, 1, BASE_W - 3, BASE_H - 2], fill=WHITE)
    draw.rectangle([1, 2, BASE_W - 2, BASE_H - 3], fill=WHITE)

    # 3. Nền màu chính của lá bài
    draw.rectangle([4, 3, BASE_W - 5, BASE_H - 4], fill=main_color)
    draw.rectangle([3, 4, BASE_W - 4, BASE_H - 5], fill=main_color)

    # Viền dập nổi (shading)
    draw.line([4, BASE_H - 4, BASE_W - 5, BASE_H - 4], fill=dark_color)
    draw.line([BASE_W - 4, 4, BASE_W - 4, BASE_H - 5], fill=dark_color)

    # 4. Hình tròn trắng ở chính giữa (Bán kính R = 14px, Tâm = (21, 32))
    cx, cy, r = 21, 32, 14
    draw.ellipse([cx - r + 1, cy - r + 1, cx + r + 1, cy + r + 1], fill=dark_color)
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=WHITE)

    return img

def draw_center_icon(img, card_type, main_color, dark_color):
    """Vẽ biểu tượng chính giữa hình tròn."""
    draw = ImageDraw.Draw(img)
    cx, cy = 21, 32

    if card_type in ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]:
        # Vẽ số lớn ở giữa (scale = 2 -> kích thước 10x14)
        draw_glyph(img, card_type, cx - 5, cy - 7, scale=2, color=main_color, shadow_color=dark_color)
        # Gạch chân dưới số 6 và số 9
        if card_type in ["6", "9"]:
            draw.rectangle([cx - 4, cy + 9, cx + 3, cy + 10], fill=main_color)

    elif card_type in ["skip", "reverse"]:
        # Vẽ biểu tượng 15x15 chi tiết cao ở chính giữa hình tròn
        draw_matrix(img, CENTER_ICONS[card_type], cx - 7, cy - 7, scale=1, color=main_color, shadow_color=dark_color)

    elif card_type == "draw2":
        # Vẽ "+2" ở giữa vòng tròn
        draw_glyph(img, "+", cx - 8, cy - 4, scale=1, color=main_color, shadow_color=dark_color)
        draw_glyph(img, "2", cx - 1, cy - 7, scale=2, color=main_color, shadow_color=dark_color)

    elif card_type == "wild":
        # Vòng tròn chia 4 góc màu (Đỏ, Vàng, Lục, Lam)
        r_inner = 11
        for y in range(cy - r_inner, cy + r_inner + 1):
            for x in range(cx - r_inner, cx + r_inner + 1):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r_inner ** 2:
                    if x <= cx and y <= cy:
                        img.putpixel((x, y), COLORS["red"]["main"])
                    elif x > cx and y <= cy:
                        img.putpixel((x, y), COLORS["yellow"]["main"])
                    elif x <= cx and y > cy:
                        img.putpixel((x, y), COLORS["blue"]["main"])
                    else:
                        img.putpixel((x, y), COLORS["green"]["main"])

    elif card_type == "wild_draw4":
        # 4 lá bài nhỏ chồng lên nhau ở giữa
        mini_cards = [
            (cx - 7, cy - 8, COLORS["red"]["main"]),
            (cx - 2, cy - 10, COLORS["blue"]["main"]),
            (cx - 5, cy - 2, COLORS["yellow"]["main"]),
            (cx + 1, cy - 4, COLORS["green"]["main"]),
        ]
        for mx, my, mcol in mini_cards:
            draw.rectangle([mx, my, mx + 6, my + 9], fill=WHITE, outline=BLACK)
            draw.rectangle([mx + 1, my + 1, mx + 5, my + 8], fill=mcol)

def draw_corner_icons(img, card_type, dark_color):
    """Vẽ ký hiệu nhỏ ở góc trên bên trái và góc dưới bên phải."""
    tl_x, tl_y = 5, 5
    br_x, br_y = BASE_W - 10, BASE_H - 12

    if card_type in ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]:
        draw_glyph(img, card_type, tl_x, tl_y, scale=1, color=WHITE, shadow_color=dark_color)
        draw_glyph(img, card_type, br_x, br_y, scale=1, color=WHITE, shadow_color=dark_color)
    elif card_type == "skip":
        draw_glyph(img, "skip_small", tl_x, tl_y, scale=1, color=WHITE, shadow_color=dark_color)
        draw_glyph(img, "skip_small", BASE_W - 12, BASE_H - 12, scale=1, color=WHITE, shadow_color=dark_color)
    elif card_type == "reverse":
        draw_glyph(img, "rev_small", tl_x, tl_y, scale=1, color=WHITE, shadow_color=dark_color)
        draw_glyph(img, "rev_small", BASE_W - 12, BASE_H - 12, scale=1, color=WHITE, shadow_color=dark_color)
    elif card_type == "draw2":
        draw_glyph(img, "+", tl_x - 1, tl_y, scale=1, color=WHITE, shadow_color=dark_color)
        draw_glyph(img, "2", tl_x + 4, tl_y, scale=1, color=WHITE, shadow_color=dark_color)
        draw_glyph(img, "+", br_x - 5, br_y, scale=1, color=WHITE, shadow_color=dark_color)
        draw_glyph(img, "2", br_x, br_y, scale=1, color=WHITE, shadow_color=dark_color)
    elif card_type == "wild":
        draw_glyph(img, "wild", tl_x, tl_y, scale=1, color=WHITE, shadow_color=dark_color)
        draw_glyph(img, "wild", br_x, br_y, scale=1, color=WHITE, shadow_color=dark_color)
    elif card_type == "wild_draw4":
        draw_glyph(img, "+", tl_x - 1, tl_y, scale=1, color=WHITE, shadow_color=dark_color)
        draw_glyph(img, "4", tl_x + 4, tl_y, scale=1, color=WHITE, shadow_color=dark_color)
        draw_glyph(img, "+", br_x - 5, br_y, scale=1, color=WHITE, shadow_color=dark_color)
        draw_glyph(img, "4", br_x, br_y, scale=1, color=WHITE, shadow_color=dark_color)

def generate_single_card(color_name, card_type):
    """Tạo và phóng to lá bài lên 170x253 bằng thuật toán NEAREST."""
    main_col = COLORS[color_name]["main"]
    dark_col = COLORS[color_name]["dark"]

    img = create_card_base(main_col, dark_col)
    draw_center_icon(img, card_type, main_col, dark_col)
    draw_corner_icons(img, card_type, dark_col)

    return img.resize((TARGET_W, TARGET_H), resample=Image.Resampling.NEAREST)

def generate_card_back():
    """Tạo mặt lưng lá bài (Card Back)."""
    img = create_card_base(COLORS["wild"]["main"], COLORS["wild"]["dark"])
    draw = ImageDraw.Draw(img)
    cx, cy, r = 21, 32, 12
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=COLORS["red"]["main"])
    draw_matrix(img, CENTER_ICONS["reverse"], cx - 7, cy - 7, scale=1, color=COLORS["yellow"]["main"], shadow_color=BLACK)
    return img.resize((TARGET_W, TARGET_H), resample=Image.Resampling.NEAREST)

# ==========================================
# 5. XUẤT TOÀN BỘ FILE RA CÁC THƯ MỤC
# ==========================================
def main():
    os.makedirs(OUTPUT_DIR_UNIQUE, exist_ok=True)
    os.makedirs(OUTPUT_DIR_FULL, exist_ok=True)
    os.makedirs(ASSETS_DIR_UNIQUE, exist_ok=True)
    os.makedirs(ASSETS_DIR_FULL, exist_ok=True)

    color_list = ["red", "yellow", "green", "blue"]
    type_list = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "skip", "reverse", "draw2"]

    card_index = 1

    for col in color_list:
        for ctype in type_list:
            card_img = generate_single_card(col, ctype)
            
            unique_name = f"{col}_{ctype}.png"
            card_img.save(os.path.join(OUTPUT_DIR_UNIQUE, unique_name))
            card_img.save(os.path.join(ASSETS_DIR_UNIQUE, unique_name))

            copies = 1 if ctype == "0" else 2
            for copy_num in range(1, copies + 1):
                full_name = f"{card_index:03d}_{col}_{ctype}_v{copy_num}.png"
                card_img.save(os.path.join(OUTPUT_DIR_FULL, full_name))
                card_img.save(os.path.join(ASSETS_DIR_FULL, full_name))
                card_index += 1

    for wtype in ["wild", "wild_draw4"]:
        card_img = generate_single_card("wild", wtype)
        card_img.save(os.path.join(OUTPUT_DIR_UNIQUE, f"{wtype}.png"))
        card_img.save(os.path.join(ASSETS_DIR_UNIQUE, f"{wtype}.png"))

        for copy_num in range(1, 5):
            full_name = f"{card_index:03d}_{wtype}_v{copy_num}.png"
            card_img.save(os.path.join(OUTPUT_DIR_FULL, full_name))
            card_img.save(os.path.join(ASSETS_DIR_FULL, full_name))
            card_index += 1

    back_img = generate_card_back()
    back_img.save(os.path.join(OUTPUT_DIR_UNIQUE, "card_back.png"))
    back_img.save(os.path.join(OUTPUT_DIR_FULL, "000_card_back.png"))
    back_img.save(os.path.join(ASSETS_DIR_UNIQUE, "card_back.png"))
    back_img.save(os.path.join(ASSETS_DIR_FULL, "000_card_back.png"))

    print("Da cap nhat xong bo bai voi bieu tuong so 0, Skip va Reverse moi!")

if __name__ == "__main__":
    main()
