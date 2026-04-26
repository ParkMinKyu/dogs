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
    # 매우 뾰족한 V 귀 (위로 솟음, 머리 위로 4px)
    # 좌측 귀 — 삼각형
    for i in range(5):
        hline(img, 8-i//2, 9+i//2, 4+i, OUT if i in (0, 4) else fur)
    px(img, 7, 8, fur_d); px(img, 9, 8, fur_d)
    px(img, 8, 7, fur_d)
    # 우측 귀
    for i in range(5):
        hline(img, 22-i//2, 23+i//2, 4+i, OUT if i in (0, 4) else fur)
    px(img, 22, 8, fur_d); px(img, 24, 8, fur_d)
    px(img, 23, 7, fur_d)
    # 슬림 머리 (가로 좁고 세로 짧음)
    hline(img, 10, 21, 9, OUT)
    vline(img, 9, 10, 16, OUT)
    vline(img, 22, 10, 16, OUT)
    hline(img, 10, 21, 17, OUT)
    rect(img, 10, 10, 21, 16, fur)
    rect(img, 12, 13, 19, 16, belly)
    # 슬림 몸통 (가로 좁게)
    vline(img, 11, 18, 24, OUT)
    vline(img, 20, 18, 24, OUT)
    hline(img, 12, 19, 25, OUT)
    rect(img, 12, 18, 19, 24, fur)
    rect(img, 13, 20, 18, 24, belly)
    # 가는 다리 분리
    px(img, 13, 25, OUT); px(img, 14, 25, OUT)
    px(img, 17, 25, OUT); px(img, 18, 25, OUT)
    # 긴 곡선 꼬리 (몸 옆에서 위로 휘감음)
    px(img, 20, 19, OUT); px(img, 21, 18, OUT); px(img, 22, 18, OUT)
    px(img, 23, 17, OUT); px(img, 24, 16, OUT); px(img, 25, 14, OUT)
    px(img, 26, 12, OUT); px(img, 27, 10, OUT)
    px(img, 22, 19, fur); px(img, 24, 17, fur)
    # 수염 (양쪽 3가닥씩)
    for dy in [13, 14, 15]:
        px(img, 6, dy, OUT); px(img, 7, dy, OUT); px(img, 8, dy, OUT)
        px(img, 23, dy, OUT); px(img, 24, dy, OUT); px(img, 25, dy, OUT)


# ---------- RABBIT (breed별 색) ----------
RABBIT_BREEDS = {
    'rabbit_white': ((250, 250, 250, 255), (210, 210, 215, 255), (255, 255, 255, 255)),
    'rabbit_brown': ((155, 110, 70, 255),  (115, 80, 50, 255),   (220, 190, 160, 255)),
}


def rabbit_body(img, fur, fur_d, belly):
    # 매우 긴 귀 (머리 위로 8px, 머리 높이의 2배)
    # 좌측 귀 — 길쭉
    rect(img, 9, 0, 11, 11, OUT)
    rect(img, 10, 1, 10, 10, fur)
    px(img, 10, 4, PINK); px(img, 10, 5, PINK); px(img, 10, 6, PINK)
    # 우측 귀
    rect(img, 20, 0, 22, 11, OUT)
    rect(img, 21, 1, 21, 10, fur)
    px(img, 21, 4, PINK); px(img, 21, 5, PINK); px(img, 21, 6, PINK)
    # 머리 (작게)
    hline(img, 10, 21, 11, OUT)
    vline(img, 9, 12, 16, OUT)
    vline(img, 22, 12, 16, OUT)
    hline(img, 10, 21, 17, OUT)
    rect(img, 10, 12, 21, 16, fur)
    rect(img, 12, 14, 19, 16, belly)
    # 매우 둥근 통통한 몸 (가로 가득)
    hline(img, 8, 23, 18, OUT)
    vline(img, 7, 19, 24, OUT)
    vline(img, 24, 19, 24, OUT)
    hline(img, 8, 23, 25, OUT)
    rect(img, 8, 19, 23, 24, fur)
    rect(img, 12, 20, 19, 24, belly)
    # 큰 뒷다리 (양쪽 끝 살짝 나와있음)
    rect(img, 6, 23, 7, 25, OUT)
    rect(img, 24, 23, 25, 25, OUT)
    # 짧은 발 (앞)
    px(img, 13, 26, OUT); px(img, 14, 26, OUT)
    px(img, 17, 26, OUT); px(img, 18, 26, OUT)
    # 작은 솜 퐁퐁 꼬리
    rect(img, 23, 20, 25, 22, fur_d)
    px(img, 24, 19, fur_d); px(img, 26, 21, fur_d)


# ---------- HAMSTER (breed별 색) ----------
HAMSTER_BREEDS = {
    'hamster': ((235, 200, 140, 255), (200, 170, 110, 255), (255, 240, 210, 255)),
}


def hamster_body(img, fur, fur_d, belly):
    # 매우 작은 둥근 귀 (작은 반원, 머리 위에 살짝)
    px(img, 9, 9, OUT); px(img, 10, 8, OUT); px(img, 11, 9, OUT)
    px(img, 10, 9, fur_d)
    px(img, 20, 9, OUT); px(img, 21, 8, OUT); px(img, 22, 9, OUT)
    px(img, 21, 9, fur_d)
    # 통통한 둥근 머리 (가로 가득)
    hline(img, 9, 22, 10, OUT)
    px(img, 8, 11, OUT); px(img, 23, 11, OUT)
    vline(img, 7, 12, 16, OUT)
    vline(img, 24, 12, 16, OUT)
    hline(img, 8, 23, 17, OUT)
    rect(img, 8, 11, 23, 16, fur)
    rect(img, 11, 13, 20, 16, belly)
    # 매우 둥근 통통한 몸 (몸통 너비 = 키)
    hline(img, 8, 23, 18, OUT)
    px(img, 7, 19, OUT); px(img, 24, 19, OUT)
    vline(img, 6, 20, 24, OUT)
    vline(img, 25, 20, 24, OUT)
    hline(img, 7, 24, 25, OUT)
    rect(img, 7, 19, 24, 24, fur)
    rect(img, 11, 21, 20, 24, belly)
    # 통통한 볼 (머리 양옆 살짝 튀어나옴 — 햄스터 특징)
    rect(img, 5, 13, 6, 16, OUT)
    px(img, 5, 14, fur); px(img, 5, 15, fur); px(img, 6, 14, fur); px(img, 6, 15, fur)
    rect(img, 25, 13, 26, 16, OUT)
    px(img, 26, 14, fur); px(img, 26, 15, fur); px(img, 25, 14, fur); px(img, 25, 15, fur)
    # 볼 핑크 블러시
    px(img, 5, 14, PINK); px(img, 26, 15, PINK)
    # 짧은 작은 발
    px(img, 10, 25, OUT); px(img, 11, 25, OUT)
    px(img, 20, 25, OUT); px(img, 21, 25, OUT)


# ---------- 표정 helpers ----------

def add_face(img, eye='open', mouth='neutral', cheeks=False, y_off=0):
    """y_off — 얼굴 row 전체 shift (rabbit/hamster는 머리 위치 다름)."""
    eye_row = 11 + y_off
    nose_row = 14 + y_off
    mouth_row = 16 + y_off
    if eye == 'open':
        px(img, 12, eye_row, EYE); px(img, 12, eye_row+1, EYE)
        px(img, 13, eye_row, EYE_HL)
        px(img, 18, eye_row, EYE); px(img, 18, eye_row+1, EYE)
        px(img, 19, eye_row, EYE_HL)
    elif eye == 'closed':
        hline(img, 11, 13, eye_row+1, EYE)
        hline(img, 18, 20, eye_row+1, EYE)
    elif eye == 'sad':
        px(img, 12, eye_row+1, EYE); px(img, 13, eye_row, EYE)
        px(img, 18, eye_row, EYE); px(img, 19, eye_row+1, EYE)
    # nose
    rect(img, 14, nose_row, 17, nose_row+1, NOSE)
    # mouth
    if mouth == 'smile':
        px(img, 13, mouth_row, OUT); px(img, 14, mouth_row+1, OUT); px(img, 15, mouth_row, OUT)
        px(img, 16, mouth_row, OUT); px(img, 17, mouth_row+1, OUT); px(img, 18, mouth_row, OUT)
    elif mouth == 'open':
        rect(img, 14, mouth_row, 17, mouth_row+1, PINK)
        px(img, 13, mouth_row, OUT); px(img, 18, mouth_row, OUT)
    elif mouth == 'frown':
        px(img, 13, mouth_row+1, OUT); px(img, 14, mouth_row, OUT); px(img, 15, mouth_row, OUT)
        px(img, 16, mouth_row, OUT); px(img, 17, mouth_row, OUT); px(img, 18, mouth_row+1, OUT)
    else:
        hline(img, 14, 17, mouth_row, OUT)
    if cheeks:
        px(img, 10, nose_row-1, PINK); px(img, 11, nose_row-1, PINK)
        px(img, 20, nose_row-1, PINK); px(img, 21, nose_row-1, PINK)


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
    # body 함수별 face row offset (cat 0 / rabbit +2 / hamster +1)
    species = breed_id.split('_')[0]
    y_off = {'cat': 0, 'rabbit': 2, 'hamster': 1}.get(species, 0)
    if mood == 'idle':
        add_face(img, eye='open', mouth='neutral', y_off=y_off)
    elif mood == 'happy':
        add_face(img, eye='open', mouth='open', cheeks=True, y_off=y_off)
    elif mood == 'eating':
        add_face(img, eye='closed', mouth='open', y_off=y_off)
    elif mood == 'sad':
        add_face(img, eye='sad', mouth='frown', y_off=y_off)
        add_tear(img)
    elif mood == 'sleeping':
        add_face(img, eye='closed', mouth='neutral', y_off=y_off)
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
