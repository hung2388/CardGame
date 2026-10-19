import os
import sys

# Ensure UTF-8 output on Windows terminal
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

from PIL import Image, ImageDraw

# ==========================================
# CẤU HÌNH KÍCH THƯỚC & ĐẦU RA BÀI TÂY PIXEL
# ==========================================
BASE_W, BASE_H = 43, 64
SCALE = 4
TARGET_W, TARGET_H = BASE_W * SCALE, BASE_H * SCALE

OUTPUT_DIR = "pixel_deck_standard"
ASSETS_DIR = os.path.join("assets", "cards", "standard")
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(ASSETS_DIR, exist_ok=True)

# Bảng màu chuẩn Pixel Neo-Brutalist
C_WHITE     = (255, 255, 255, 255)
C_CARD_BG   = (250, 248, 240, 255) # Hơi ngà vintage
C_BORDER    = (15, 23, 42, 255)
C_INNER_BORDER = (226, 232, 240, 255)
C_RED       = (225, 29, 72, 255)   # Đỏ Rô / Cơ
C_DARK_RED  = (159, 18, 57, 255)
C_BLACK     = (24, 24, 27, 255)    # Đen Bích / Tép
C_DARK_GREY = (82, 82, 91, 255)
C_GOLD      = (245, 158, 11, 255)  # Màu vàng viền hoàng gia cho J, Q, K
C_BLUE_ROYAL= (59, 130, 246, 255)
C_PURPLE    = (147, 51, 234, 255)

# ==========================================
# BITMAP GLYPHS CHO CÁC QUÂN BÀI
# ==========================================

# 1. Chất bài (5x5 pixels)
SUIT_PIXELS = {
    # Bích (Spade ♠)
    "spades": [
        "  #  ",
        " ### ",
        "#####",
        "## ##",
        "  #  "
    ],
    # Cơ (Heart ♥)
    "hearts": [
        " # # ",
        "#####",
        "#####",
        " ### ",
        "  #  "
    ],
    # Rô (Diamond ♦)
    "diamonds": [
        "  #  ",
        " ### ",
        "#####",
        " ### ",
        "  #  "
    ],
    # Tép (Club ♣)
    "clubs": [
        "  #  ",
        "# # #",
        "#####",
        "  #  ",
        " ### "
    ]
}

# 2. Ký tự góc (Rank Glyphs: 3x5 pixels)
RANK_PIXELS_3x5 = {
    "2": [
        "###",
        "  #",
        "###",
        "#  ",
        "###"
    ],
    "3": [
        "###",
        "  #",
        "###",
        "  #",
        "###"
    ],
    "4": [
        "# #",
        "# #",
        "###",
        "  #",
        "  #"
    ],
    "5": [
        "###",
        "#  ",
        "###",
        "  #",
        "###"
    ],
    "6": [
        "###",
        "#  ",
        "###",
        "# #",
        "###"
    ],
    "7": [
        "###",
        "  #",
        "  #",
        "  #",
        "  #"
    ],
    "8": [
        "###",
        "# #",
        "###",
        "# #",
        "###"
    ],
    "9": [
        "###",
        "# #",
        "###",
        "  #",
        "###"
    ],
    "10": [
        "# ###",
        "# # #",
        "# # #",
        "# # #",
        "# ###"
    ],
    "J": [
        "  #",
        "  #",
        "  #",
        "# #",
        "###"
    ],
    "Q": [
        "###",
        "# #",
        "# #",
        "###",
        "  #"
    ],
    "K": [
        "# #",
        "## ",
        "#  ",
        "## ",
        "# #"
    ],
    "A": [
        " # ",
        "# #",
        "###",
        "# #",
        "# #"
    ]
}

# 3. Chân dung Pixel Art ở trung tâm cho Jack, Queen, King (15x19)
PORTRAITS_15x19 = {
    "J": [
        "     #####     ",
        "    #######    ",
        "   ##.####.##  ",
        "   ##.####.##  ",
        "    ###==###   ",
        "     ######    ",
        "    ###..###   ",
        "   ###.##.###  ",
        "  ####====#### ",
        "  ############ ",
        "  ###======### ",
        "   ###====###  ",
        "    ########   ",
        "    ###==###   ",
        "   ###.##.###  ",
        "  ####====#### ",
        "  ############ ",
        "   ##########  ",
        "     ######    "
    ],
    "Q": [
        "   #   #   #   ",
        "   #########   ",
        "    #######    ",
        "   ##.###.##   ",
        "   ##.###.##   ",
        "    ###=###    ",
        "     #####     ",
        "    ###.###    ",
        "   ###...###   ",
        "  ####===####  ",
        "  ###########  ",
        "  ###=====###  ",
        "   ###===###   ",
        "    #######    ",
        "    ###=###    ",
        "   ###...###   ",
        "  ####===####  ",
        "   #########   ",
        "    #######    "
    ],
    "K": [
        "  ###  #  ###  ",
        "  ###########  ",
        "   #########   ",
        "   ##.###.##   ",
        "   ##.###.##   ",
        "   ####=####   ",
        "    #######    ",
        "    ###=###    ",
        "   ###...###   ",
        "  ####===####  ",
        "  ###########  ",
        "  ###=====###  ",
        "   ###===###   ",
        "    #######    ",
        "    ###=###    ",
        "   ###...###   ",
        "  ####===####  ",
        "  ###########  ",
        "   #########   "
    ]
}

def draw_glyph(draw, glyph_lines, start_x, start_y, color, color_map=None):
    """Vẽ một khối pixel bitmap theo tọa độ"""
    for row_idx, line in enumerate(glyph_lines):
        for col_idx, char in enumerate(line):
            if char != ' ':
                px_color = color
                if color_map and char in color_map:
                    px_color = color_map[char]
                draw.point((start_x + col_idx, start_y + row_idx), fill=px_color)

def draw_card_base():
    """Tạo phôi thẻ bài 43x64 với bo viền chuẩn Neo-Brutalist"""
    img = Image.new("RGBA", (BASE_W, BASE_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Nền bài
    for y in range(BASE_H):
        for x in range(BASE_W):
            # Bo góc 3px
            if (x < 3 and y < 3) and (x + y < 3): continue
            if (x > BASE_W - 4 and y < 3) and ((BASE_W - 1 - x) + y < 3): continue
            if (x < 3 and y > BASE_H - 4) and (x + (BASE_H - 1 - y) < 3): continue
            if (x > BASE_W - 4 and y > BASE_H - 4) and ((BASE_W - 1 - x) + (BASE_H - 1 - y) < 3): continue
            draw.point((x, y), fill=C_CARD_BG)

    # Viền đen bên ngoài
    # Viền ngang
    for x in range(3, BASE_W - 3):
        draw.point((x, 0), fill=C_BORDER)
        draw.point((x, BASE_H - 1), fill=C_BORDER)
    # Viền dọc
    for y in range(3, BASE_H - 3):
        draw.point((0, y), fill=C_BORDER)
        draw.point((BASE_W - 1, y), fill=C_BORDER)

    # Bo góc viền
    corner_pixels = [
        (2, 0), (1, 1), (0, 2),
        (BASE_W - 3, 0), (BASE_W - 2, 1), (BASE_W - 1, 2),
        (0, BASE_H - 3), (1, BASE_H - 2), (2, BASE_H - 1),
        (BASE_W - 1, BASE_H - 3), (BASE_W - 2, BASE_H - 2), (BASE_W - 3, BASE_H - 1)
    ]
    for pt in corner_pixels:
        draw.point(pt, fill=C_BORDER)

    # Viền mảnh bên trong (Khung tranh)
    for x in range(3, BASE_W - 3):
        draw.point((x, 2), fill=C_INNER_BORDER)
        draw.point((x, BASE_H - 3), fill=C_INNER_BORDER)
    for y in range(3, BASE_H - 3):
        draw.point((2, y), fill=C_INNER_BORDER)
        draw.point((BASE_W - 3, y), fill=C_INNER_BORDER)

    return img

def render_standard_card(suit, rank):
    """Tạo 1 lá bài chuẩn với số và biểu tượng chất"""
    img = draw_card_base()
    draw = ImageDraw.Draw(img)

    suit_color = C_RED if suit in ["hearts", "diamonds"] else C_BLACK
    suit_glyph = SUIT_PIXELS[suit]
    rank_glyph = RANK_PIXELS_3x5[rank]

    # 1. Góc trên bên trái: Số + Chất
    draw_glyph(draw, rank_glyph, 4, 4, suit_color)
    rank_w = len(rank_glyph[0])
    draw_glyph(draw, suit_glyph, 4, 11, suit_color)

    # 2. Góc dưới bên phải: Số + Chất (Đối xứng lộn ngược)
    # Vẽ góc dưới bên phải
    start_x_br = BASE_W - 4 - rank_w
    draw_glyph(draw, rank_glyph, start_x_br, BASE_H - 9, suit_color)
    draw_glyph(draw, suit_glyph, BASE_W - 9, BASE_H - 16, suit_color)

    # 3. Khu vực trung tâm bài
    cx, cy = BASE_W // 2, BASE_H // 2

    if rank in ["J", "Q", "K"]:
        # Khung viền hoàng gia
        draw.rectangle((10, 16, BASE_W - 11, BASE_H - 17), fill=(255, 255, 255, 255), outline=C_BORDER)
        portrait = PORTRAITS_15x19[rank]
        color_map = {
            "#": suit_color,
            "=": C_GOLD,
            ".": (255, 230, 200, 255) # Màu da pixel
        }
        draw_glyph(draw, portrait, 14, 22, suit_color, color_map)
    elif rank == "A":
        # Át: Đại biểu tượng chất 11x11 ở chính giữa
        # Phóng đại biểu tượng chất
        for r_idx, row in enumerate(suit_glyph):
            for c_idx, ch in enumerate(row):
                if ch == '#':
                    # Scale 2x2 cho mỗi pixel
                    px = (cx - 5) + c_idx * 2
                    py = (cy - 5) + r_idx * 2
                    draw.rectangle((px, py, px + 1, py + 1), fill=suit_color)
    else:
        # Số 2 - 10: Phân bố pip theo số lượng
        num = int(rank)
        # Các tọa độ pip chuẩn
        pips = []
        if num == 2:
            pips = [(cx - 2, 20), (cx - 2, 40)]
        elif num == 3:
            pips = [(cx - 2, 18), (cx - 2, cy - 2), (cx - 2, 42)]
        elif num == 4:
            pips = [(14, 20), (BASE_W - 18, 20), (14, 40), (BASE_W - 18, 40)]
        elif num == 5:
            pips = [(14, 20), (BASE_W - 18, 20), (cx - 2, cy - 2), (14, 40), (BASE_W - 18, 40)]
        elif num == 6:
            pips = [(14, 20), (BASE_W - 18, 20), (14, cy - 2), (BASE_W - 18, cy - 2), (14, 40), (BASE_W - 18, 40)]
        elif num == 7:
            pips = [(14, 20), (BASE_W - 18, 20), (cx - 2, 26), (14, cy - 2), (BASE_W - 18, cy - 2), (14, 40), (BASE_W - 18, 40)]
        elif num == 8:
            pips = [(14, 18), (BASE_W - 18, 18), (cx - 2, 24), (14, 30), (BASE_W - 18, 30), (cx - 2, 36), (14, 42), (BASE_W - 18, 42)]
        elif num == 9:
            pips = [(14, 18), (BASE_W - 18, 18), (14, 26), (BASE_W - 18, 26), (cx - 2, cy - 2), (14, 34), (BASE_W - 18, 34), (14, 42), (BASE_W - 18, 42)]
        elif num == 10:
            pips = [(14, 18), (BASE_W - 18, 18), (cx - 2, 22), (14, 28), (BASE_W - 18, 28), (14, 34), (BASE_W - 18, 34), (cx - 2, 40), (14, 44), (BASE_W - 18, 44)]

        for px, py in pips:
            draw_glyph(draw, suit_glyph, px, py, suit_color)

    # Phóng to theo chuẩn Nearest Neighbor (Giữ sắc cạnh pixel)
    scaled = img.resize((TARGET_W, TARGET_H), Image.Resampling.NEAREST)
    return scaled

def render_joker(is_red=False):
    """Tạo quân bài Joker Đỏ / Đen Pixel Art"""
    img = draw_card_base()
    draw = ImageDraw.Draw(img)
    color = C_RED if is_red else C_PURPLE

    # Chữ J-K ở góc
    draw_glyph(draw, ["#"], 4, 4, color)
    draw_glyph(draw, ["# #", "## ", "#  ", "## ", "# #"], 4, 7, color)

    # Chữ JOKER dọc ở viền
    joker_text = ["J", "O", "K", "E", "R"]

    # Biểu tượng Jester Hat (Mũ chú hề) ở chính giữa (17x19)
    jester_hat = [
        "   #   #   #   ",
        "  ### ### ###  ",
        "  #.# #.# #.#  ",
        "   #   #   #   ",
        "   #########   ",
        "  ###########  ",
        "  ###.###.###  ",
        "   ##.###.##   ",
        "    ###=###    ",
        "     #####     ",
        "   #########   ",
        "  ###########  ",
        "  # ####### #  ",
        "  #  #####  #  ",
        "      ###      ",
        "    #######    ",
        "   #########   ",
        "   ### # ###   ",
        "    #     #    "
    ]
    color_map = {
        "#": color,
        "=": C_GOLD,
        ".": (255, 235, 180, 255)
    }
    draw_glyph(draw, jester_hat, 13, 20, color, color_map)

    # Banner chữ JOKER ở đáy
    banner_bg = C_DARK_RED if is_red else C_BORDER
    draw.rectangle((8, 46, BASE_W - 9, 54), fill=banner_bg, outline=C_BORDER)
    # Tên Joker
    draw_glyph(draw, [
        "# ### # # ### ###",
        "# # # ##  #   # #",
        "# # # # # ##  ## ",
        "# # # # # #   # #",
        "### ### # # ### # #"
    ], 11, 48, C_WHITE)

    return img.resize((TARGET_W, TARGET_H), Image.Resampling.NEAREST)

def render_standard_back():
    """Tạo lưng bài Tây Neo-Brutalist Pixel Art"""
    img = Image.new("RGBA", (BASE_W, BASE_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Nền chính: Navy Blue sâu
    for y in range(BASE_H):
        for x in range(BASE_W):
            if (x < 3 and y < 3) and (x + y < 3): continue
            if (x > BASE_W - 4 and y < 3) and ((BASE_W - 1 - x) + y < 3): continue
            if (x < 3 and y > BASE_H - 4) and (x + (BASE_H - 1 - y) < 3): continue
            if (x > BASE_W - 4 and y > BASE_H - 4) and ((BASE_W - 1 - x) + (BASE_H - 1 - y) < 3): continue
            draw.point((x, y), fill=(30, 27, 75, 255))

    # Viền đen bên ngoài
    for x in range(3, BASE_W - 3):
        draw.point((x, 0), fill=C_BORDER)
        draw.point((x, BASE_H - 1), fill=C_BORDER)
    for y in range(3, BASE_H - 3):
        draw.point((0, y), fill=C_BORDER)
        draw.point((BASE_W - 1, y), fill=C_BORDER)

    # Viền vàng trong
    for x in range(3, BASE_W - 3):
        draw.point((x, 2), fill=C_GOLD)
        draw.point((x, BASE_H - 3), fill=C_GOLD)
    for y in range(3, BASE_H - 3):
        draw.point((2, y), fill=C_GOLD)
        draw.point((BASE_W - 3, y), fill=C_GOLD)

    # Họa tiết quả trám chéo (Diamond lattice pattern)
    for y in range(4, BASE_H - 4):
        for x in range(4, BASE_W - 4):
            if (x + y) % 4 == 0:
                draw.point((x, y), fill=(49, 46, 129, 255))
            elif (x - y) % 4 == 0:
                draw.point((x, y), fill=(67, 56, 202, 255))

    # Huy hiệu trung tâm hình thoi vàng
    cx, cy = BASE_W // 2, BASE_H // 2
    for dy in range(-7, 8):
        max_dx = 7 - abs(dy)
        for dx in range(-max_dx, max_dx + 1):
            draw.point((cx + dx, cy + dy), fill=C_GOLD)

    # Viền đen huy hiệu
    for dy in range(-8, 9):
        max_dx = 8 - abs(dy)
        draw.point((cx + max_dx, cy + dy), fill=C_BORDER)
        draw.point((cx - max_dx, cy + dy), fill=C_BORDER)

    # Chữ CP (CARDPUNK) bên trong
    cp_glyph = [
        "### ###",
        "#   # #",
        "#   ###",
        "#   #  ",
        "### #  "
    ]
    draw_glyph(draw, cp_glyph, cx - 3, cy - 2, C_BORDER)

    return img.resize((TARGET_W, TARGET_H), Image.Resampling.NEAREST)

def main():
    suits = ["spades", "clubs", "diamonds", "hearts"]
    ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]

    total = 0
    print(f"[PIXEL ENGINE] Bắt đầu xuất 54 lá bài Tây Pixel chuẩn ({TARGET_W}x{TARGET_H})...")

    # 1. 52 lá bài thông thường
    for suit in suits:
        for rank in ranks:
            card_img = render_standard_card(suit, rank)
            filename = f"{suit}_{rank}.png"
            p1 = os.path.join(OUTPUT_DIR, filename)
            p2 = os.path.join(ASSETS_DIR, filename)
            card_img.save(p1)
            card_img.save(p2)
            total += 1

    # 2. 2 quân Joker
    joker_red = render_joker(is_red=True)
    joker_red.save(os.path.join(OUTPUT_DIR, "joker_red.png"))
    joker_red.save(os.path.join(ASSETS_DIR, "joker_red.png"))

    joker_black = render_joker(is_red=False)
    joker_black.save(os.path.join(OUTPUT_DIR, "joker_black.png"))
    joker_black.save(os.path.join(ASSETS_DIR, "joker_black.png"))
    total += 2

    # 3. Lưng bài
    back_img = render_standard_back()
    back_img.save(os.path.join(OUTPUT_DIR, "card_back.png"))
    back_img.save(os.path.join(ASSETS_DIR, "card_back.png"))
    total += 1

    print(f"[SUCCESS] Đã tạo thành công {total} file ảnh Bài Tây Pixel Art sắc nét tại '{OUTPUT_DIR}/'!")

if __name__ == "__main__":
    main()
