"""
v2 — 액세서리 50개 (5 부위 × 10) 32×32 픽셀아트.
부위: hat / neck / glasses / back / feet
간단한 모양, 종별 호환되는 단순 디자인.
"""
from PIL import Image
import os

BASE = os.path.dirname(os.path.abspath(__file__))
TR = (0, 0, 0, 0)
OUT = (40, 30, 25, 255)


def px(img, x, y, c):
    w, h = img.size
    if 0 <= x < w and 0 <= y < h:
        img.putpixel((x, y), c)


def rect(img, x0, y0, x1, y1, c):
    for y in range(y0, y1+1):
        for x in range(x0, x1+1):
            px(img, x, y, c)


def hline(img, x0, x1, y, c):
    for x in range(x0, x1+1): px(img, x, y, c)


def vline(img, x, y0, y1, c):
    for y in range(y0, y1+1): px(img, x, y, c)


def new(): return Image.new('RGBA', (32, 32), TR)


# === HAT (10) ===
def hat_red():
    img = new()
    rect(img, 8, 12, 23, 21, (220,60,70,255))
    hline(img, 5, 26, 22, OUT); hline(img, 6, 25, 21, (160,30,40,255))
    rect(img, 8, 12, 23, 13, (160,30,40,255))
    hline(img, 8, 23, 11, OUT); vline(img, 7, 12, 21, OUT); vline(img, 24, 12, 21, OUT)
    return img

def hat_straw():
    img = new()
    rect(img, 6, 12, 25, 21, (220,180,80,255))
    rect(img, 4, 21, 27, 23, (200,160,70,255))
    hline(img, 4, 27, 24, OUT); rect(img, 6, 12, 25, 13, (180,140,60,255))
    return img

def hat_beret():
    img = new()
    rect(img, 7, 11, 24, 19, (60,80,140,255))
    rect(img, 7, 19, 24, 21, (40,60,110,255))
    rect(img, 14, 9, 17, 11, (60,80,140,255))
    return img

def hat_cap():
    img = new()
    rect(img, 8, 12, 23, 19, (60,140,200,255))
    rect(img, 5, 19, 26, 21, (40,100,160,255))  # brim
    rect(img, 14, 14, 17, 16, (255,255,255,255))  # logo
    return img

def hat_crown():
    img = new()
    rect(img, 8, 14, 23, 21, (245,210,80,255))
    # spikes
    for i, x in enumerate([8, 13, 18, 23]):
        vline(img, x, 11, 14, (245,210,80,255))
    rect(img, 13, 16, 14, 17, (200,40,60,255))  # gem
    return img

def hat_helmet():
    img = new()
    rect(img, 7, 12, 24, 22, (140,140,160,255))
    rect(img, 7, 12, 24, 14, (110,110,130,255))
    rect(img, 11, 17, 20, 19, (180,180,200,255))  # visor
    return img

def hat_band():
    img = new()
    # +1 아래
    rect(img, 6, 18, 25, 20, (255,130,170,255))
    return img

def hat_flower():
    img = new()
    # +1 아래
    rect(img, 12, 15, 19, 20, (255,180,200,255))
    rect(img, 14, 14, 17, 15, (255,200,220,255))
    px(img, 15, 17, (240,200,80,255)); px(img, 16, 17, (240,200,80,255))
    return img

def hat_horn():
    img = new()
    # 작은 뿔 두 개 — +6 아래 (이전 +4 → +6)
    for x in [10, 21]:
        for i in range(4):
            hline(img, x - i, x + i, 15 + i, OUT)
        rect(img, x-1, 17, x+1, 19, (220,180,140,255))
    return img

def hat_bird():
    img = new()
    # +2 아래 (이전 +1 → +2)
    rect(img, 12, 16, 19, 20, (255,200,80,255))
    px(img, 19, 17, (255,140,40,255))  # 부리
    px(img, 13, 17, (40,30,25,255))  # 눈
    return img


# === NECK (10) ===
def neck_collar():
    img = new()
    rect(img, 4, 14, 27, 18, (170,90,50,255))
    rect(img, 14, 19, 17, 22, (245,210,80,255))  # tag
    return img

def neck_scarf():
    img = new()
    rect(img, 5, 14, 26, 18, (110,180,230,255))
    for x in range(8, 26, 4):
        vline(img, x, 14, 17, (60,120,180,255))
    rect(img, 21, 18, 25, 24, (110,180,230,255))  # tail
    return img

def neck_bow():
    img = new()
    rect(img, 6, 13, 12, 19, (255,130,170,255))
    rect(img, 19, 13, 25, 19, (255,130,170,255))
    rect(img, 13, 14, 18, 18, (255,230,240,255))
    return img

def neck_bell():
    img = new()
    rect(img, 4, 14, 27, 17, (170,90,50,255))
    rect(img, 14, 18, 17, 22, (245,210,80,255))
    return img

def neck_ribbon():
    img = new()
    rect(img, 8, 14, 12, 19, (200,80,130,255))
    rect(img, 19, 14, 23, 19, (200,80,130,255))
    rect(img, 13, 15, 18, 18, (255,200,220,255))
    return img

def neck_rope():
    img = new()
    for x in range(4, 28, 2):
        vline(img, x, 14, 17, (180,120,80,255))
        vline(img, x+1, 14, 17, (140,90,60,255))
    return img

def neck_chain():
    img = new()
    for x in range(4, 28, 3):
        rect(img, x, 14, x+1, 17, (220,210,80,255))
        rect(img, x, 15, x+1, 16, (255,240,140,255))
    return img

def neck_flowers():
    img = new()
    rect(img, 4, 15, 27, 17, (130,180,90,255))  # 줄기
    for x in [7, 12, 17, 22]:
        rect(img, x, 13, x+2, 15, (255,180,200,255))
    return img

def neck_tag():
    img = new()
    rect(img, 4, 14, 27, 17, (140,140,160,255))
    rect(img, 13, 18, 18, 22, (245,210,80,255))
    rect(img, 14, 19, 17, 21, (200,160,40,255))
    return img

def neck_tie():
    img = new()
    rect(img, 13, 14, 18, 17, (200,40,60,255))
    rect(img, 14, 18, 17, 25, (200,40,60,255))
    return img


# === GLASSES (10) ===
# Glasses geometry — 두 lens 중심이 충분히 떨어져 bridge 자리 확보.
LEFT_CX = 8
RIGHT_CX = 23
LENS_TOP = 11
LENS_BOT = 19   # 직경 9px (반지름 4)
BRIDGE_LEFT = 13
BRIDGE_RIGHT = 18
BRIDGE_Y = 15
FRAME = (40, 40, 50, 255)
LENS_TINT = (150, 200, 240, 180)


def gl_round():
    img = new()
    for cx in [LEFT_CX, RIGHT_CX]:
        rect(img, cx-3, LENS_TOP+1, cx+3, LENS_BOT-1, LENS_TINT)
        hline(img, cx-3, cx+3, LENS_TOP, FRAME)
        hline(img, cx-3, cx+3, LENS_BOT, FRAME)
        vline(img, cx-4, LENS_TOP+1, LENS_BOT-1, FRAME)
        vline(img, cx+4, LENS_TOP+1, LENS_BOT-1, FRAME)
    hline(img, BRIDGE_LEFT, BRIDGE_RIGHT, BRIDGE_Y, FRAME)
    return img

def gl_square():
    img = new()
    for cx in [LEFT_CX, RIGHT_CX]:
        rect(img, cx-4, LENS_TOP, cx+4, LENS_BOT, LENS_TINT)
        rect(img, cx-4, LENS_TOP, cx+4, LENS_TOP, FRAME)
        rect(img, cx-4, LENS_BOT, cx+4, LENS_BOT, FRAME)
        vline(img, cx-4, LENS_TOP, LENS_BOT, FRAME)
        vline(img, cx+4, LENS_TOP, LENS_BOT, FRAME)
    hline(img, BRIDGE_LEFT, BRIDGE_RIGHT, BRIDGE_Y, FRAME)
    return img

def gl_sun():
    img = new()
    for cx in [LEFT_CX, RIGHT_CX]:
        rect(img, cx-4, LENS_TOP, cx+4, LENS_BOT, FRAME)
    hline(img, BRIDGE_LEFT, BRIDGE_RIGHT, BRIDGE_Y, FRAME)
    return img

def gl_monocle():
    img = new()
    cx = RIGHT_CX
    rect(img, cx-3, LENS_TOP+1, cx+3, LENS_BOT-1, LENS_TINT)
    hline(img, cx-3, cx+3, LENS_TOP, FRAME)
    hline(img, cx-3, cx+3, LENS_BOT, FRAME)
    vline(img, cx-4, LENS_TOP+1, LENS_BOT-1, FRAME)
    vline(img, cx+4, LENS_TOP+1, LENS_BOT-1, FRAME)
    vline(img, cx-6, BRIDGE_Y, 26, (245, 210, 80, 255))  # chain
    return img

def gl_heart():
    img = new()
    color = (255, 100, 140, 255)
    for cx in [LEFT_CX, RIGHT_CX]:
        # 하트 (직경 ~9): 두 봉오리 + 점차 좁아지는 아래
        for dx in [-3, -2, 2, 3]:
            px(img, cx+dx, LENS_TOP, color)
        for dx in range(-4, 5):
            px(img, cx+dx, LENS_TOP+1, color)
            px(img, cx+dx, LENS_TOP+2, color)
        for dx in range(-3, 4):
            px(img, cx+dx, LENS_TOP+3, color)
        for dx in range(-2, 3):
            px(img, cx+dx, LENS_TOP+4, color)
        for dx in range(-1, 2):
            px(img, cx+dx, LENS_TOP+5, color)
        px(img, cx, LENS_TOP+6, color)
    hline(img, BRIDGE_LEFT, BRIDGE_RIGHT, BRIDGE_Y, color)
    return img

def gl_star():
    img = new()
    color = (245, 210, 80, 255)
    for cx in [LEFT_CX, RIGHT_CX]:
        # 별 (직경 ~9): 가로 십자 + 세로 십자
        rect(img, cx-3, LENS_TOP+2, cx+3, LENS_BOT-2, color)
        rect(img, cx-1, LENS_TOP, cx+1, LENS_BOT, color)
        for dy in [LENS_TOP+1, LENS_BOT-1]:
            for dx in [-2, -1, 0, 1, 2]:
                px(img, cx+dx, dy, color)
        # 양쪽 가시
        px(img, cx-4, LENS_TOP+4, color); px(img, cx+4, LENS_TOP+4, color)
    hline(img, BRIDGE_LEFT, BRIDGE_RIGHT, BRIDGE_Y, color)
    return img

def gl_mask():
    img = new()
    rect(img, 2, 14, 29, 26, (255, 255, 255, 255))
    rect(img, 2, 14, 29, 15, (200, 200, 210, 255))
    return img

def gl_eyepatch():
    img = new()
    rect(img, LEFT_CX-4, LENS_TOP, LEFT_CX+4, LENS_BOT, FRAME)
    rect(img, LEFT_CX+4, BRIDGE_Y, 31, BRIDGE_Y+1, FRAME)  # strap
    return img

def gl_paint():
    img = new()
    px(img, 9, 13, (255,80,80,255)); px(img, 11, 13, (255,80,80,255))
    px(img, 10, 14, (255,80,80,255))
    px(img, 21, 13, (80,160,255,255)); px(img, 23, 13, (80,160,255,255))
    px(img, 22, 14, (80,160,255,255))
    return img

def gl_mustache():
    img = new()
    for x in [9, 10, 11]:
        px(img, x, 19, (40,30,25,255))
        px(img, x, 20, (40,30,25,255))
    for x in [20, 21, 22]:
        px(img, x, 19, (40,30,25,255))
        px(img, x, 20, (40,30,25,255))
    return img


# === BACK (10) — 등에 매는 것 ===
def back_cape():
    img = new()
    rect(img, 8, 8, 23, 28, (200,40,60,255))
    rect(img, 8, 8, 23, 10, (160,20,40,255))
    return img

def back_wings():
    img = new()
    # 좌측 날개
    for i in range(6):
        hline(img, 4 + i, 4 + 6, 8 + i, (255,255,255,255))
    # 우측 날개
    for i in range(6):
        hline(img, 26 - 6, 26 - i, 8 + i, (255,255,255,255))
    return img

def back_backpack():
    img = new()
    rect(img, 9, 8, 22, 24, (60,140,200,255))
    rect(img, 13, 12, 18, 16, (40,100,160,255))
    rect(img, 9, 8, 22, 10, (40,100,160,255))
    return img

def back_bow():
    img = new()
    rect(img, 5, 4, 11, 12, (255,130,170,255))
    rect(img, 20, 4, 26, 12, (255,130,170,255))
    rect(img, 12, 6, 19, 11, (255,200,220,255))
    return img

def back_shell():
    img = new()
    for r in range(3):
        rect(img, 10+r, 8+r, 21-r, 22-r, (130,180,90,255) if r%2==0 else (90,140,60,255))
    return img

def back_jet():
    img = new()
    rect(img, 8, 6, 11, 22, (180,180,200,255))
    rect(img, 20, 6, 23, 22, (180,180,200,255))
    rect(img, 8, 22, 11, 24, (255,140,40,255))
    rect(img, 20, 22, 23, 24, (255,140,40,255))
    return img

def back_balloon():
    img = new()
    rect(img, 12, 4, 19, 12, (255,80,140,255))
    vline(img, 15, 12, 24, (40,30,25,255))
    return img

def back_flag():
    img = new()
    vline(img, 15, 4, 24, (60,40,30,255))
    rect(img, 16, 4, 25, 11, (255,80,80,255))
    return img

def back_book():
    img = new()
    rect(img, 9, 8, 22, 22, (140,90,60,255))
    rect(img, 11, 10, 20, 20, (245,230,200,255))
    hline(img, 13, 18, 14, (140,90,60,255))
    hline(img, 13, 18, 16, (140,90,60,255))
    return img

def back_star():
    img = new()
    rect(img, 13, 8, 18, 14, (245,210,80,255))
    px(img, 12, 11, (245,210,80,255)); px(img, 19, 11, (245,210,80,255))
    px(img, 14, 15, (245,210,80,255)); px(img, 17, 15, (245,210,80,255))
    return img


# === FEET (10) — 좌우 신발 간격 2배 (cx 7,24 → 4,27, gap 2 → 6) ===
def feet_socks():
    img = new()
    for x in [4, 27]:
        rect(img, x-4, 20, x+4, 30, (255,255,255,255))
        rect(img, x-4, 20, x+4, 22, (255,80,80,255))
    return img

def feet_boots():
    img = new()
    for x in [4, 27]:
        rect(img, x-4, 18, x+4, 30, (140,90,60,255))
        rect(img, x-4, 27, x+4, 30, (60,40,30,255))
    return img

def feet_sneakers():
    img = new()
    for x in [4, 27]:
        rect(img, x-4, 21, x+4, 28, (255,255,255,255))
        rect(img, x-4, 29, x+4, 30, (60,140,200,255))
    return img

def feet_sandals():
    img = new()
    for x in [4, 27]:
        rect(img, x-4, 24, x+4, 28, (140,90,60,255))
        rect(img, x-1, 21, x+1, 23, (140,90,60,255))
    return img

def feet_skates():
    img = new()
    for x in [4, 27]:
        rect(img, x-4, 22, x+4, 26, (60,140,200,255))
        rect(img, x-4, 27, x+4, 30, (160,160,180,255))
    return img

def feet_paws():
    img = new()
    for x in [4, 27]:
        rect(img, x-4, 21, x+4, 28, (255,180,200,255))
        rect(img, x-2, 23, x+2, 26, (200,80,130,255))
    return img

def feet_slippers():
    img = new()
    for x in [4, 27]:
        rect(img, x-4, 22, x+4, 30, (255,180,200,255))
    return img

def feet_glow():
    img = new()
    for x in [4, 27]:
        rect(img, x-4, 22, x+4, 30, (255,255,200,255))
        rect(img, x-3, 25, x+3, 28, (255,200,80,255))
    return img

def feet_stripe():
    img = new()
    for x in [4, 27]:
        rect(img, x-4, 20, x+4, 30, (255,255,255,255))
        for y in [22, 24, 26, 28]:
            hline(img, x-4, x+4, y, (60,140,200,255))
    return img

def feet_high():
    img = new()
    for x in [4, 27]:
        rect(img, x-4, 16, x+4, 30, (255,80,80,255))
        rect(img, x-4, 16, x+4, 18, (200,40,60,255))
    return img


CATALOG = {
    'hat': [hat_red, hat_straw, hat_beret, hat_cap, hat_crown, hat_helmet, hat_band, hat_flower, hat_horn, hat_bird],
    'neck': [neck_collar, neck_scarf, neck_bow, neck_bell, neck_ribbon, neck_rope, neck_chain, neck_flowers, neck_tag, neck_tie],
    'glasses': [gl_round, gl_square, gl_sun, gl_monocle, gl_heart, gl_star, gl_mask, gl_eyepatch, gl_paint, gl_mustache],
    'back': [back_cape, back_wings, back_backpack, back_bow, back_shell, back_jet, back_balloon, back_flag, back_book, back_star],
    'feet': [feet_socks, feet_boots, feet_sneakers, feet_sandals, feet_skates, feet_paws, feet_slippers, feet_glow, feet_stripe, feet_high],
}


def main():
    out = os.path.join(BASE, 'accessories')
    os.makedirs(out, exist_ok=True)
    count = 0
    for slot, fns in CATALOG.items():
        for i, fn in enumerate(fns, 1):
            img = fn()
            path = os.path.join(out, f'{slot}_{i:02d}.png')
            img.save(path, optimize=True)
            count += 1
    print(f'wrote {count} accessory sprites to accessories/')


if __name__ == '__main__':
    main()
