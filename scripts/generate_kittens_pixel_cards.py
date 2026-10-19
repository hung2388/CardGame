import os
import sys

# Ensure UTF-8 output on Windows terminal
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

from PIL import Image, ImageDraw

# ==========================================
# CẤU HÌNH KÍCH THƯỚC & ĐẦU RA MÈO NỔ PIXEL
# ==========================================
BASE_W, BASE_H = 43, 64
SCALE = 4
TARGET_W, TARGET_H = BASE_W * SCALE, BASE_H * SCALE

OUTPUT_DIR = "pixel_deck_kittens"
ASSETS_DIR = os.path.join("assets", "cards", "kittens")
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(ASSETS_DIR, exist_ok=True)

# Bảng màu chuẩn Neo-Brutalist
C_WHITE     = (255, 255, 255, 255)
C_BLACK     = (15, 23, 42, 255)
C_BORDER    = (15, 23, 42, 255)
C_DARK_SHADOW = (10, 15, 30, 255)

# Bảng màu cho từng loại thẻ Mèo Nổ
KITTENS_THEMES = {
    "exploding_kitten": {
        "bg": (239, 68, 68, 255),      # Đỏ rực
        "dark": (185, 28, 28, 255),
        "title": "MEO NO",
        "sub": "BOM NOH!",
        "accent": (254, 240, 138, 255)
    },
    "defuse": {
        "bg": (34, 197, 94, 255),      # Xanh lá
        "dark": (21, 128, 61, 255),
        "title": "GO BOM",
        "sub": "DEFUSE",
        "accent": (255, 255, 255, 255)
    },
    "attack": {
        "bg": (249, 115, 22, 255),     # Cam
        "dark": (194, 65, 12, 255),
        "title": "TAN CONG",
        "sub": "ATTACK 2X",
        "accent": (254, 240, 138, 255)
    },
    "skip": {
        "bg": (6, 182, 212, 255),      # Xanh Cyan
        "dark": (14, 116, 144, 255),
        "title": "QUA LUOT",
        "sub": "SKIP TURN",
        "accent": (255, 255, 255, 255)
    },
    "see_future": {
        "bg": (168, 85, 247, 255),     # Tím huyền bí
        "dark": (126, 34, 206, 255),
        "title": "TUONG LAI",
        "sub": "SEE 3 CARDS",
        "accent": (254, 240, 138, 255)
    },
    "shuffle": {
        "bg": (234, 179, 8, 255),      # Vàng tươi
        "dark": (161, 98, 7, 255),
        "title": "XAO BAI",
        "sub": "SHUFFLE",
        "accent": (255, 255, 255, 255)
    },
    "favor": {
        "bg": (236, 72, 153, 255),     # Hồng
        "dark": (190, 24, 93, 255),
        "title": "XIN XO",
        "sub": "FAVOR",
        "accent": (255, 255, 255, 255)
    },
    "nope": {
        "bg": (244, 63, 94, 255),      # Đỏ hồng chặn đứng
        "dark": (190, 18, 60, 255),
        "title": "CHAN DUNG",
        "sub": "NOPE!",
        "accent": (255, 255, 255, 255)
    },
    "cat_taco": {
        "bg": (250, 204, 21, 255),     # Vàng Taco
        "dark": (202, 138, 4, 255),
        "title": "MEO TACO",
        "sub": "TACO CAT",
        "accent": (255, 255, 255, 255)
    },
    "cat_melon": {
        "bg": (134, 239, 172, 255),    # Xanh dưa hấu
        "dark": (34, 197, 94, 255),
        "title": "MEO DUA",
        "sub": "MELON CAT",
        "accent": (239, 68, 68, 255)
    },
    "cat_potato": {
        "bg": (253, 186, 116, 255),    # Nâu khoai tây
        "dark": (234, 88, 12, 255),
        "title": "MEO KHOAI",
        "sub": "POTATO CAT",
        "accent": (255, 255, 255, 255)
    }
}

# ==========================================
# BITMAP ICONS CHO TỪNG LOẠI THẺ (17x17)
# ==========================================
ICONS_17x17 = {
    # 1. Bom nổ + Mèo gian ác
    "exploding_kitten": [
        "      #####      ",
        "     #..#..#     ",
        "      #####      ",
        "    ###...###    ",
        "   ##.......##   ",
        "  ##..#...#..##  ",
        "  ##..#...#..##  ",
        "  ##.........##  ",
        "  ##..#...#..##  ",
        "   ##..###..##   ",
        "    ###===###    ",
        "   ###=====###   ",
        "  ####=====####  ",
        "  ## ####### ##  ",
        "      #####      ",
        "     ##   ##     ",
        "    ###   ###    "
    ],
    # 2. Cờ lê / Bộ gỡ bom laser
    "defuse": [
        "      ###        ",
        "     #####       ",
        "    ### ###      ",
        "    ##   ##      ",
        "     ## ##       ",
        "      ###        ",
        "       ##        ",
        "       ###       ",
        "        ###      ",
        "         ###     ",
        "          ###    ",
        "           ###   ",
        "         ####### ",
        "        #########",
        "        ###   ###",
        "         ##   ## ",
        "          #####  "
    ],
    # 3. Kiếm chéo (Tấn công)
    "attack": [
        " #             # ",
        "###           ###",
        " ###         ### ",
        "  ###       ###  ",
        "   ###     ###   ",
        "    ###   ###    ",
        "     ### ###     ",
        "      #####      ",
        "       ###       ",
        "      #####      ",
        "     ### ###     ",
        "    ###   ###    ",
        "   ###     ###   ",
        "  ###       ###  ",
        " ###         ### ",
        "###           ###",
        " #             # "
    ],
    # 4. Mũi tên kép (Qua lượt)
    "skip": [
        "  #       #      ",
        "  ##      ##     ",
        "  ###     ###    ",
        "  ####    ####   ",
        "  #####   #####  ",
        "  ######  ###### ",
        "  ####### #######",
        "  ######  ###### ",
        "  #####   #####  ",
        "  ####    ####   ",
        "  ###     ###    ",
        "  ##      ##     ",
        "  #       #      ",
        "                 ",
        "  #############  ",
        "  #############  ",
        "                 "
    ],
    # 5. Quả cầu tiên tri (Xem tương lai)
    "see_future": [
        "      #####      ",
        "    #########    ",
        "   ###########   ",
        "  #############  ",
        "  #####...#####  ",
        "  ####.###.####  ",
        "  ###.#####.###  ",
        "  ###.#.#.#.###  ",
        "  ###.#####.###  ",
        "  ####.###.####  ",
        "  #####...#####  ",
        "  #############  ",
        "   ###########   ",
        "    #########    ",
        "     #######     ",
        "    #########    ",
        "   ###########   "
    ],
    # 6. Mũi tên xáo trộn (Xáo bài)
    "shuffle": [
        "  ####     ####  ",
        "  ###### ######  ",
        "  ############## ",
        "   ###  #  ###   ",
        "   ##       ##   ",
        "        #        ",
        "       ###       ",
        "      #####      ",
        "     #######     ",
        "      #####      ",
        "       ###       ",
        "        #        ",
        "   ##       ##   ",
        "   ###  #  ###   ",
        "  ############## ",
        "  ###### ######  ",
        "  ####     ####  "
    ],
    # 7. Bàn chân mèo xin xỏ (Favor)
    "favor": [
        "   ##   #   ##   ",
        "  #### ### ####  ",
        "  #### ### ####  ",
        "   ##   #   ##   ",
        "    #########    ",
        "   ###########   ",
        "  #############  ",
        "  #############  ",
        "  #############  ",
        "   ###########   ",
        "    #########    ",
        "     #######     ",
        "      #####      ",
        "      #####      ",
        "      #####      ",
        "      #####      ",
        "       ###       "
    ],
    # 8. Biển báo cấm (Nope)
    "nope": [
        "      #####      ",
        "    #########    ",
        "   ###########   ",
        "  ###   #   ###  ",
        "  ##     #   ##  ",
        "  #   #   #   #  ",
        "  #    #   #  #  ",
        "  #     #     #  ",
        "  #      #    #  ",
        "  #   #   #   #  ",
        "  ##   #     ##  ",
        "  ###   #   ###  ",
        "   ###########   ",
        "    #########    ",
        "      #####      ",
        "                 ",
        "  #############  "
    ],
    # 9. Mèo Taco
    "cat_taco": [
        "   #         #   ",
        "  ###       ###  ",
        "  #####   #####  ",
        " ############### ",
        "#################",
        "## ########### ##",
        "#  ###..#..###  #",
        "#  ###..#..###  #",
        "   ####===####   ",
        "  ###############",
        "  #.#.#.#.#.#.#.#",
        "  ###############",
        "   #.#.#.#.#.#.# ",
        "   ############# ",
        "    ###########  ",
        "     #########   ",
        "       #####     "
    ],
    # 10. Mèo Dưa Hấu
    "cat_melon": [
        "   #         #   ",
        "  ###       ###  ",
        "  #####   #####  ",
        " ############### ",
        "#################",
        "## ########### ##",
        "#  ###..#..###  #",
        "   ###..#..###   ",
        "   ####===####   ",
        "  ###############",
        "  ##.#.##.#.##.##",
        "  ###############",
        "   ##.#.##.#.##  ",
        "   ############# ",
        "    ###########  ",
        "     #########   ",
        "       #####     "
    ],
    # 11. Mèo Khoai Tây
    "cat_potato": [
        "   #         #   ",
        "  ###       ###  ",
        "  #####   #####  ",
        "  #############  ",
        " ############### ",
        "## ########### ##",
        "#  ###..#..###  #",
        "#  ###..#..###  #",
        "   ####===####   ",
        "   ###########   ",
        "   ###.#####.##  ",
        "   ############  ",
        "    ##.#####.##  ",
        "    ###########  ",
        "     #########   ",
        "      #######    ",
        "       #####     "
    ]
}

def draw_glyph(draw, glyph_lines, start_x, start_y, color, color_map=None):
    for row_idx, line in enumerate(glyph_lines):
        for col_idx, char in enumerate(line):
            if char != ' ':
                px_color = color
                if color_map and char in color_map:
                    px_color = color_map[char]
                draw.point((start_x + col_idx, start_y + row_idx), fill=px_color)

def draw_kittens_card(card_key):
    theme = KITTENS_THEMES[card_key]
    img = Image.new("RGBA", (BASE_W, BASE_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Nền bài
    bg_color = theme["bg"]
    for y in range(BASE_H):
        for x in range(BASE_W):
            if (x < 3 and y < 3) and (x + y < 3): continue
            if (x > BASE_W - 4 and y < 3) and ((BASE_W - 1 - x) + y < 3): continue
            if (x < 3 and y > BASE_H - 4) and (x + (BASE_H - 1 - y) < 3): continue
            if (x > BASE_W - 4 and y > BASE_H - 4) and ((BASE_W - 1 - x) + (BASE_H - 1 - y) < 3): continue
            draw.point((x, y), fill=bg_color)

    # Viền đen bên ngoài
    for x in range(3, BASE_W - 3):
        draw.point((x, 0), fill=C_BORDER)
        draw.point((x, BASE_H - 1), fill=C_BORDER)
    for y in range(3, BASE_H - 3):
        draw.point((0, y), fill=C_BORDER)
        draw.point((BASE_W - 1, y), fill=C_BORDER)

    corner_pixels = [
        (2, 0), (1, 1), (0, 2),
        (BASE_W - 3, 0), (BASE_W - 2, 1), (BASE_W - 1, 2),
        (0, BASE_H - 3), (1, BASE_H - 2), (2, BASE_H - 1),
        (BASE_W - 1, BASE_H - 3), (BASE_W - 2, BASE_H - 2), (BASE_W - 3, BASE_H - 1)
    ]
    for pt in corner_pixels:
        draw.point(pt, fill=C_BORDER)

    # Khung tranh trung tâm màu trắng
    draw.rectangle((5, 12, BASE_W - 6, BASE_H - 16), fill=(255, 255, 255, 255), outline=C_BORDER)

    # Banner tiêu đề trên cùng
    draw.rectangle((3, 3, BASE_W - 4, 10), fill=theme["dark"], outline=C_BORDER)

    # Icon trung tâm
    icon = ICONS_17x17[card_key]
    color_map = {
        "#": theme["dark"] if theme["dark"] != C_BLACK else C_BORDER,
        ".": theme["accent"],
        "=": (239, 68, 68, 255) # Đỏ
    }
    draw_glyph(draw, icon, 13, 16, C_BORDER, color_map)

    # Banner phụ ở đáy
    draw.rectangle((4, BASE_H - 14, BASE_W - 5, BASE_H - 4), fill=C_BORDER)
    
    # Text pixel nhỏ 3x5 ở góc hoặc thanh chữ
    # Vẽ pixel decoration ở 4 góc khung tranh
    draw.point((6, 13), fill=theme["bg"])
    draw.point((BASE_W - 7, 13), fill=theme["bg"])
    draw.point((6, BASE_H - 17), fill=theme["bg"])
    draw.point((BASE_W - 7, BASE_H - 17), fill=theme["bg"])

    return img.resize((TARGET_W, TARGET_H), Image.Resampling.NEAREST)

def draw_kittens_back():
    img = Image.new("RGBA", (BASE_W, BASE_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Nền đỏ bầm Exploding Kittens
    for y in range(BASE_H):
        for x in range(BASE_W):
            if (x < 3 and y < 3) and (x + y < 3): continue
            if (x > BASE_W - 4 and y < 3) and ((BASE_W - 1 - x) + y < 3): continue
            if (x < 3 and y > BASE_H - 4) and (x + (BASE_H - 1 - y) < 3): continue
            if (x > BASE_W - 4 and y > BASE_H - 4) and ((BASE_W - 1 - x) + (BASE_H - 1 - y) < 3): continue
            draw.point((x, y), fill=(153, 27, 27, 255))

    # Viền đen bên ngoài
    for x in range(3, BASE_W - 3):
        draw.point((x, 0), fill=C_BORDER)
        draw.point((x, BASE_H - 1), fill=C_BORDER)
    for y in range(3, BASE_H - 3):
        draw.point((0, y), fill=C_BORDER)
        draw.point((BASE_W - 1, y), fill=C_BORDER)

    # Viền vàng trong
    for x in range(3, BASE_W - 3):
        draw.point((x, 2), fill=(245, 158, 11, 255))
        draw.point((x, BASE_H - 3), fill=(245, 158, 11, 255))
    for y in range(3, BASE_H - 3):
        draw.point((2, y), fill=(245, 158, 11, 255))
        draw.point((BASE_W - 3, y), fill=(245, 158, 11, 255))

    # Họa tiết xương cá / móng mèo chéo
    for y in range(4, BASE_H - 4):
        for x in range(4, BASE_W - 4):
            if (x * 2 + y) % 6 == 0:
                draw.point((x, y), fill=(127, 29, 29, 255))

    # Mặt mèo Pixel lớn ở chính giữa
    cat_face = [
        "  #           #  ",
        " ###         ### ",
        "#####       #####",
        "#################",
        "#################",
        "###  #######  ###",
        "## # ####### # ##",
        "## # ####### # ##",
        "###  #######  ###",
        "#################",
        "#####   #   #####",
        "###### === ######",
        " ############### ",
        "  #############  ",
        "   ###########   "
    ]
    color_map = {
        "#": (245, 158, 11, 255),
        "=": (239, 68, 68, 255)
    }
    draw_glyph(draw, cat_face, 13, 24, (245, 158, 11, 255), color_map)

    return img.resize((TARGET_W, TARGET_H), Image.Resampling.NEAREST)

def main():
    total = 0
    print(f"[KITTENS ENGINE] Bắt đầu xuất 12 lá bài Mèo Nổ Pixel chuẩn ({TARGET_W}x{TARGET_H})...")

    for key in KITTENS_THEMES.keys():
        card_img = draw_kittens_card(key)
        filename = f"{key}.png"
        p1 = os.path.join(OUTPUT_DIR, filename)
        p2 = os.path.join(ASSETS_DIR, filename)
        card_img.save(p1)
        card_img.save(p2)
        total += 1

    # Lưng bài Mèo nổ
    back_img = draw_kittens_back()
    back_img.save(os.path.join(OUTPUT_DIR, "card_back.png"))
    back_img.save(os.path.join(ASSETS_DIR, "card_back.png"))
    total += 1

    print(f"[SUCCESS] Đã tạo thành công {total} file ảnh Mèo Nổ Pixel Art tại '{OUTPUT_DIR}/'!")

if __name__ == "__main__":
    main()
