"""species 별 32×32 body sprite 5표정 (idle/happy/eating/sad/sleeping).

종별 식별 가능한 단순 픽셀아트:
- cat: 뾰족한 V 귀, 슬림 몸, 가는 꼬리
- rabbit: 길쭉한 두 귀, 둥근 몸
- hamster: 작은 둥근 귀, 통통한 몸, 짧은 다리

출력: assets/cat/{mood}.png, assets/rabbit/{mood}.png, assets/hamster/{mood}.png
"""
from PIL import Image
import os

W = H = 32
BASE = os.path.dirname(os.path.abspath(__file__))

TR = (0, 0, 0, 0)
OUT = (60, 36, 28, 255)
BELLY = (252, 232, 200, 255)
NOSE = (50, 32, 26, 255)
EYE = (40, 26, 22, 255)
EYE_HL = (255, 255, 255, 255)
PINK = (255, 168, 178, 255)
ZZZ = (120, 150, 220, 255)
TEAR = (130, 200, 240, 255)


def new(): return Image.new('RGBA', (W, H), TR)


def px(img, x, y, c):
    if 0 <= x < W and 0 <= y < H:
        img.putpixel((x, y), c)


def rect(img, x0, y0, x1, y1, c):
    for y in range(y0, y1+1):
        for x in range(x0, x1+1): px(img, x, y, c)


def hline(img, x0, x1, y, c):
    for x in range(x0, x1+1): px(img, x, y, c)


def vline(img, x, y0, y1, c):
    for y in range(y0, y1+1): px(img, x, y, c)


# ---------- CAT (breed별 색) ----------
# (fur, fur_dark, belly) tuples
CAT_BREEDS = {
    'cat_yellow': ((250, 200, 90, 255),  (210, 160, 60, 255),  (255, 240, 200, 255)),
    'cat_black':  ((45, 40, 50, 255),    (25, 22, 30, 255),    (90, 85, 95, 255)),
    'cat_gray':   ((150, 150, 160, 255), (110, 110, 120, 255), (220, 220, 225, 255)),
}


def cat_body(img, fur, fur_d, belly):
    # 뾰족한 V 귀 (좌우)
    for i in range(4):
        hline(img, 6+i, 7-i, 6+i, OUT)
        hline(img, 24+i, 25-i, 6+i, OUT)
    # ear interior (lighter)
    px(img, 6, 7, fur_d); px(img, 7, 8, fur_d)
    px(img, 25, 7, fur_d); px(img, 24, 8, fur_d)
    # head
    hline(img, 9, 22, 8, OUT)
    vline(img, 8, 9, 16, OUT)
    vline(img, 23, 9, 16, OUT)
    hline(img, 9, 22, 17, OUT)
    rect(img, 9, 9, 22, 16, fur)
    rect(img, 12, 13, 19, 16, belly)
    # body
    vline(img, 9, 18, 24, OUT)
    vline(img, 22, 18, 24, OUT)
    hline(img, 10, 21, 25, OUT)
    rect(img, 10, 18, 21, 24, fur)
    rect(img, 13, 20, 18, 24, belly)
    # 발 분리
    px(img, 13, 25, OUT); px(img, 18, 25, OUT)
    # 꼬리
    px(img, 22, 19, OUT); px(img, 23, 18, OUT); px(img, 24, 17, OUT)
    px(img, 25, 16, OUT); px(img, 26, 15, OUT)


# ---------- RABBIT (breed별 색) ----------
RABBIT_BREEDS = {
    'rabbit_white': ((250, 250, 250, 255), (210, 210, 215, 255), (255, 255, 255, 255)),
    'rabbit_brown': ((155, 110, 70, 255),  (115, 80, 50, 255),   (220, 190, 160, 255)),
}


def rabbit_body(img, fur, fur_d, belly):
    # 길쭉한 두 귀 (위로)
    rect(img, 9, 1, 11, 9, OUT)
    rect(img, 10, 2, 10, 8, fur)
    rect(img, 20, 1, 22, 9, OUT)
    rect(img, 21, 2, 21, 8, fur)
    # 귀 안 핑크
    px(img, 10, 4, PINK); px(img, 10, 5, PINK)
    px(img, 21, 4, PINK); px(img, 21, 5, PINK)
    # 둥근 머리
    hline(img, 9, 22, 9, OUT)
    vline(img, 8, 10, 16, OUT)
    vline(img, 23, 10, 16, OUT)
    hline(img, 9, 22, 17, OUT)
    rect(img, 9, 10, 22, 16, fur)
    rect(img, 12, 13, 19, 16, belly)
    # 둥근 몸 (chubby)
    vline(img, 7, 18, 24, OUT)
    vline(img, 24, 18, 24, OUT)
    hline(img, 8, 23, 25, OUT)
    rect(img, 8, 18, 23, 24, fur)
    rect(img, 12, 20, 19, 24, belly)
    # 발 분리
    px(img, 12, 25, OUT); px(img, 13, 25, OUT)
    px(img, 18, 25, OUT); px(img, 19, 25, OUT)
    # 짧은 솜 꼬리
    rect(img, 24, 21, 25, 22, fur_d)


# ---------- HAMSTER (breed별 색) ----------
HAMSTER_BREEDS = {
    'hamster': ((235, 200, 140, 255), (200, 170, 110, 255), (255, 240, 210, 255)),
}


def hamster_body(img, fur, fur_d, belly):
    # 작은 둥근 귀
    rect(img, 9, 7, 11, 9, OUT)
    rect(img, 10, 8, 10, 8, fur_d)
    rect(img, 20, 7, 22, 9, OUT)
    rect(img, 21, 8, 21, 8, fur_d)
    # 통통한 머리
    hline(img, 9, 22, 9, OUT)
    vline(img, 7, 10, 16, OUT)
    vline(img, 24, 10, 16, OUT)
    hline(img, 8, 23, 17, OUT)
    rect(img, 8, 10, 23, 16, fur)
    rect(img, 11, 13, 20, 16, belly)
    # 통통한 몸 (round)
    vline(img, 6, 18, 23, OUT)
    vline(img, 25, 18, 23, OUT)
    hline(img, 7, 24, 24, OUT)
    rect(img, 7, 18, 24, 23, fur)
    rect(img, 12, 20, 19, 23, belly)
    # 짧은 발 (양쪽 작은 노치)
    px(img, 11, 24, OUT); px(img, 20, 24, OUT)


# ---------- 표정 helpers ----------

def add_face(img, eye='open', mouth='neutral', cheeks=False):
    if eye == 'open':
        px(img, 12, 11, EYE); px(img, 12, 12, EYE)
        px(img, 13, 11, EYE_HL)
        px(img, 18, 11, EYE); px(img, 18, 12, EYE)
        px(img, 19, 11, EYE_HL)
    elif eye == 'closed':
        hline(img, 11, 13, 12, EYE)
        hline(img, 18, 20, 12, EYE)
    elif eye == 'sad':
        px(img, 12, 12, EYE); px(img, 13, 11, EYE)
        px(img, 18, 11, EYE); px(img, 19, 12, EYE)
    # nose
    rect(img, 14, 14, 17, 15, NOSE)
    # mouth
    if mouth == 'smile':
        px(img, 13, 16, OUT); px(img, 14, 17, OUT); px(img, 15, 16, OUT)
        px(img, 16, 16, OUT); px(img, 17, 17, OUT); px(img, 18, 16, OUT)
    elif mouth == 'open':
        rect(img, 14, 16, 17, 17, PINK)
        px(img, 13, 16, OUT); px(img, 18, 16, OUT)
    elif mouth == 'frown':
        px(img, 13, 17, OUT); px(img, 14, 16, OUT); px(img, 15, 16, OUT)
        px(img, 16, 16, OUT); px(img, 17, 16, OUT); px(img, 18, 17, OUT)
    else:
        hline(img, 14, 17, 16, OUT)
    if cheeks:
        px(img, 10, 13, PINK); px(img, 11, 13, PINK)
        px(img, 20, 13, PINK); px(img, 21, 13, PINK)


def add_zzz(img):
    rect(img, 25, 6, 27, 6, ZZZ)
    px(img, 27, 7, ZZZ); px(img, 26, 8, ZZZ)
    rect(img, 25, 9, 27, 9, ZZZ)


def add_tear(img):
    px(img, 11, 13, TEAR); px(img, 11, 14, TEAR)


# ---------- breed별 5 moods 생성 ----------
# breed_id → (body_fn, palette tuple)
BREEDS = {}
for k, pal in CAT_BREEDS.items(): BREEDS[k] = (cat_body, pal)
for k, pal in RABBIT_BREEDS.items(): BREEDS[k] = (rabbit_body, pal)
for k, pal in HAMSTER_BREEDS.items(): BREEDS[k] = (hamster_body, pal)


def make_mood(breed_id, mood):
    img = new()
    body_fn, (fur, fur_d, belly) = BREEDS[breed_id]
    body_fn(img, fur, fur_d, belly)
    if mood == 'idle':
        add_face(img, eye='open', mouth='neutral')
    elif mood == 'happy':
        add_face(img, eye='open', mouth='open', cheeks=True)
    elif mood == 'eating':
        add_face(img, eye='closed', mouth='open')
    elif mood == 'sad':
        add_face(img, eye='sad', mouth='frown')
        add_tear(img)
    elif mood == 'sleeping':
        add_face(img, eye='closed', mouth='neutral')
        add_zzz(img)
    return img


def main():
    for breed_id in BREEDS:
        out_dir = os.path.join(BASE, breed_id)
        os.makedirs(out_dir, exist_ok=True)
        for mood in ['idle', 'happy', 'eating', 'sad', 'sleeping']:
            img = make_mood(breed_id, mood)
            path = os.path.join(out_dir, f'{mood}.png')
            img.save(path)
            print('wrote', path)


if __name__ == '__main__':
    main()
