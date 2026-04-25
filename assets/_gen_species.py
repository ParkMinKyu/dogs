"""
v2 — 다른 동물 (고양이/토끼/햄스터) head sprite 32x32 + 4 stage sprites
간단한 픽셀아트로 종/표정별 sprite 생성.
"""
from PIL import Image, ImageDraw
import os

BASE = os.path.dirname(os.path.abspath(__file__))
TR = (0, 0, 0, 0)
OUT = (50, 32, 26, 255)
EYE = (40, 26, 22, 255)
EYE_HL = (255, 255, 255, 255)
NOSE = (50, 32, 26, 255)
PINK = (255, 168, 178, 255)


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


# 동물 정의
ANIMALS = {
    'cat_yellow': {
        'fur': (255, 200, 100, 255),
        'fur_d': (210, 150, 60, 255),
        'belly': (255, 240, 200, 255),
        'kind': 'cat',
        'ears': 'pointed',
    },
    'cat_black': {
        'fur': (60, 60, 70, 255),
        'fur_d': (30, 30, 40, 255),
        'belly': (110, 110, 120, 255),
        'kind': 'cat',
        'ears': 'pointed',
        'eye_color': (180, 220, 100, 255),
    },
    'cat_gray': {
        'fur': (170, 170, 180, 255),
        'fur_d': (110, 110, 120, 255),
        'belly': (220, 220, 230, 255),
        'kind': 'cat',
        'ears': 'pointed',
    },
    'rabbit_white': {
        'fur': (250, 250, 250, 255),
        'fur_d': (210, 210, 215, 255),
        'belly': (255, 240, 240, 255),
        'kind': 'rabbit',
        'ears': 'long',
    },
    'rabbit_brown': {
        'fur': (180, 130, 90, 255),
        'fur_d': (130, 90, 60, 255),
        'belly': (240, 220, 200, 255),
        'kind': 'rabbit',
        'ears': 'long',
    },
    'hamster': {
        'fur': (235, 200, 130, 255),
        'fur_d': (190, 150, 90, 255),
        'belly': (255, 240, 210, 255),
        'kind': 'hamster',
        'ears': 'round',
    },
}


def draw_head(img, fur, fur_d, belly, ears='pointed', eye_color=None):
    """32x32 head + body."""
    eye_color = eye_color or EYE
    # Ears
    if ears == 'pointed':
        # cat
        for i in range(4):
            hline(img, 7 - i, 7 + i, 6 + i, OUT) if i < 3 else None
        rect(img, 5, 7, 7, 9, fur_d)
        for i in range(4):
            hline(img, 24 - i, 24 + i, 6 + i, OUT) if i < 3 else None
        rect(img, 24, 7, 26, 9, fur_d)
    elif ears == 'long':
        # rabbit — tall ears
        rect(img, 9, 1, 11, 8, OUT)
        rect(img, 10, 2, 10, 7, fur_d)
        rect(img, 20, 1, 22, 8, OUT)
        rect(img, 21, 2, 21, 7, fur_d)
        # 안쪽 분홍
        px(img, 10, 3, PINK); px(img, 10, 4, PINK); px(img, 10, 5, PINK)
        px(img, 21, 3, PINK); px(img, 21, 4, PINK); px(img, 21, 5, PINK)
    elif ears == 'round':
        # hamster — small round
        rect(img, 6, 7, 8, 10, fur_d)
        px(img, 5, 8, OUT); px(img, 5, 9, OUT)
        rect(img, 23, 7, 25, 10, fur_d)
        px(img, 26, 8, OUT); px(img, 26, 9, OUT)

    # Head outline
    hline(img, 10, 21, 9, OUT)
    px(img, 9, 10, OUT); px(img, 22, 10, OUT)
    vline(img, 8, 11, 22, OUT)
    vline(img, 23, 11, 22, OUT)
    hline(img, 9, 22, 23, OUT)

    rect(img, 9, 10, 22, 22, fur)
    rect(img, 12, 16, 19, 22, belly)

    hline(img, 10, 12, 10, fur_d)
    hline(img, 19, 21, 10, fur_d)

    # Eyes
    px(img, 12, 14, eye_color); px(img, 12, 15, eye_color); px(img, 13, 14, EYE_HL)
    px(img, 18, 14, eye_color); px(img, 18, 15, eye_color); px(img, 19, 14, EYE_HL)

    # Nose
    rect(img, 14, 17, 17, 18, NOSE)
    px(img, 15, 17, (90, 60, 50, 255))

    # Mouth
    px(img, 13, 20, OUT); px(img, 14, 21, OUT); px(img, 15, 20, OUT)
    px(img, 16, 20, OUT); px(img, 17, 21, OUT); px(img, 18, 20, OUT)


def main():
    out_dir = os.path.join(BASE, 'breeds')
    os.makedirs(out_dir, exist_ok=True)
    for name, p in ANIMALS.items():
        img = Image.new('RGBA', (32, 32), TR)
        draw_head(img, p['fur'], p['fur_d'], p['belly'],
                  ears=p.get('ears', 'pointed'),
                  eye_color=p.get('eye_color'))
        img.save(os.path.join(out_dir, f'{name}.png'))
    print(f'wrote {len(ANIMALS)} animal sprites to breeds/')


if __name__ == '__main__':
    main()
