"""
Pixel-art generator for teen and adult dog stages.
- teen: 32x40, leaner body, perked ears, slightly more detail
- adult: 32x48, taller stance, full ears, refined fur shading

Each stage produces 5 expressions: idle, happy, eating, sad, sleeping.
8x previews go to ../preview/.
"""
from PIL import Image
import os

BASE = os.path.dirname(os.path.abspath(__file__))
PREVIEW = os.path.normpath(os.path.join(BASE, "preview"))
os.makedirs(PREVIEW, exist_ok=True)

# Shared palette (matches puppy)
TR     = (0, 0, 0, 0)
OUT    = (60, 36, 28, 255)
FUR    = (235, 178, 110, 255)
FUR_D  = (200, 138, 78, 255)
FUR_DD = (160, 102, 56, 255)
BELLY  = (252, 232, 200, 255)
NOSE   = (50, 32, 26, 255)
EYE    = (40, 26, 22, 255)
EYE_HL = (255, 255, 255, 255)
PINK   = (255, 168, 178, 255)
BOWL   = (180, 140, 220, 255)
BOWL_D = (140, 104, 180, 255)
KIBBLE = (230, 168, 92, 255)
TEAR   = (130, 200, 240, 255)
ZZZ    = (120, 150, 220, 255)
COLLAR = (220, 88, 110, 255)   # adult only
COLLAR_D = (160, 56, 80, 255)
TAG    = (245, 215, 90, 255)


def px(img, x, y, c):
    w, h = img.size
    if 0 <= x < w and 0 <= y < h:
        img.putpixel((x, y), c)


def rect(img, x0, y0, x1, y1, c):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            px(img, x, y, c)


def hline(img, x0, x1, y, c):
    for x in range(x0, x1 + 1):
        px(img, x, y, c)


def vline(img, x, y0, y1, c):
    for y in range(y0, y1 + 1):
        px(img, x, y, c)


# ============================================================
# TEEN — 32x40, leaner, perked ears, longer legs
# ============================================================

TW, TH = 32, 40

def teen_canvas():
    return Image.new("RGBA", (TW, TH), TR)


def teen_body(img, mouth="neutral", eye="open", cheeks=False):
    # Ears (perked, taller)
    # left
    for i in range(5):
        hline(img, 7 - i + max(0, i-2), 7 + i - max(0, i-2), 4 + i, OUT)
    rect(img, 6, 5, 8, 8, FUR_D)
    # right
    for i in range(5):
        hline(img, 24 - i + max(0, i-2), 24 + i - max(0, i-2), 4 + i, OUT)
    rect(img, 23, 5, 25, 8, FUR_D)

    # Head (slightly narrower than puppy)
    hline(img, 11, 20, 9, OUT)
    vline(img, 9, 11, 17, OUT)
    px(img, 10, 10, OUT)
    px(img, 21, 10, OUT)
    vline(img, 22, 11, 17, OUT)
    hline(img, 11, 20, 18, OUT)

    rect(img, 10, 10, 21, 17, FUR)
    rect(img, 12, 14, 19, 17, BELLY)
    # darker patch on top of head
    hline(img, 11, 13, 10, FUR_D)
    hline(img, 18, 20, 10, FUR_D)

    # Body — leaner torso
    vline(img, 10, 19, 28, OUT)
    vline(img, 21, 19, 28, OUT)
    hline(img, 11, 20, 29, OUT)
    rect(img, 11, 19, 20, 28, FUR)
    rect(img, 13, 21, 18, 28, BELLY)

    # Legs (longer)
    rect(img, 11, 30, 13, 33, FUR)
    rect(img, 18, 30, 20, 33, FUR)
    px(img, 11, 33, OUT); px(img, 13, 33, OUT)
    px(img, 18, 33, OUT); px(img, 20, 33, OUT)
    hline(img, 11, 13, 34, OUT)
    hline(img, 18, 20, 34, OUT)

    # Eyes
    if eye == "open":
        px(img, 13, 13, EYE); px(img, 13, 14, EYE)
        px(img, 14, 13, EYE_HL)
        px(img, 18, 13, EYE); px(img, 18, 14, EYE)
        px(img, 19, 13, EYE_HL)
    elif eye == "closed":
        hline(img, 12, 14, 14, EYE)
        hline(img, 18, 20, 14, EYE)
    elif eye == "sad":
        px(img, 13, 14, EYE); px(img, 14, 13, EYE)
        px(img, 18, 13, EYE); px(img, 19, 14, EYE)

    # Nose
    rect(img, 14, 16, 17, 17, NOSE)
    px(img, 15, 16, (90, 60, 50, 255))

    # Mouth
    if mouth == "smile":
        px(img, 13, 18, OUT)
        px(img, 14, 19, OUT); px(img, 15, 18, OUT)
        px(img, 16, 18, OUT); px(img, 17, 19, OUT)
        px(img, 18, 18, OUT)
    elif mouth == "open":
        rect(img, 14, 18, 17, 19, PINK)
        px(img, 13, 18, OUT); px(img, 18, 18, OUT)
        px(img, 15, 19, (220, 130, 145, 255))
    elif mouth == "frown":
        px(img, 13, 19, OUT); px(img, 14, 18, OUT)
        rect(img, 15, 18, 16, 18, OUT)
        px(img, 17, 18, OUT); px(img, 18, 19, OUT)
    else:
        hline(img, 14, 17, 18, OUT)

    if cheeks:
        rect(img, 11, 15, 12, 15, PINK)
        rect(img, 19, 15, 20, 15, PINK)


def teen_tail_up(img):
    # angled up tail
    px(img, 22, 22, OUT)
    px(img, 23, 21, OUT)
    px(img, 24, 20, OUT)
    px(img, 25, 19, OUT)
    px(img, 25, 20, FUR_D)
    px(img, 24, 21, FUR)
    px(img, 23, 22, FUR)


def teen_tail_wag(img):
    # tail flicked higher
    px(img, 22, 21, OUT)
    px(img, 23, 19, OUT)
    px(img, 24, 18, OUT)
    px(img, 26, 18, OUT)
    px(img, 27, 19, OUT)
    px(img, 25, 19, FUR_D)
    px(img, 24, 19, FUR); px(img, 25, 20, FUR)


def teen_tail_down(img):
    px(img, 22, 25, OUT)
    px(img, 23, 26, OUT)
    px(img, 24, 27, OUT)
    px(img, 23, 25, FUR_D)


def make_teen_idle():
    img = teen_canvas()
    teen_body(img, mouth="neutral", eye="open")
    teen_tail_up(img)
    return img


def make_teen_happy():
    img = teen_canvas()
    teen_body(img, mouth="open", eye="open", cheeks=True)
    teen_tail_wag(img)
    px(img, 4, 6, EYE_HL); px(img, 5, 5, EYE_HL)
    px(img, 28, 5, EYE_HL)
    return img


def make_teen_eating():
    img = teen_canvas()
    teen_body(img, mouth="open", eye="closed")
    teen_tail_wag(img)
    # bowl on the ground at right (consistent placement: bottom-left)
    hline(img, 1, 9, 35, OUT)
    px(img, 1, 36, OUT); px(img, 9, 36, OUT)
    rect(img, 2, 36, 8, 36, BOWL)
    px(img, 2, 37, OUT); px(img, 8, 37, OUT)
    rect(img, 3, 37, 7, 37, BOWL_D)
    hline(img, 4, 6, 38, OUT)
    # kibble
    px(img, 3, 35, KIBBLE); px(img, 5, 35, KIBBLE); px(img, 7, 35, KIBBLE)
    px(img, 4, 34, KIBBLE); px(img, 6, 34, KIBBLE)
    return img


def make_teen_sad():
    img = teen_canvas()
    teen_body(img, mouth="frown", eye="sad")
    teen_tail_down(img)
    # droopy ears: paint over with lower fur block
    rect(img, 6, 6, 8, 11, FUR_D)
    px(img, 6, 11, OUT); px(img, 8, 11, OUT)
    rect(img, 23, 6, 25, 11, FUR_D)
    px(img, 23, 11, OUT); px(img, 25, 11, OUT)
    # tear
    px(img, 12, 15, TEAR); px(img, 12, 16, TEAR)
    return img


def make_teen_sleeping():
    img = teen_canvas()
    # curled body, longer than puppy
    hline(img, 10, 21, 18, OUT)
    px(img, 9, 19, OUT); px(img, 22, 19, OUT)
    px(img, 8, 20, OUT); px(img, 23, 20, OUT)
    vline(img, 7, 21, 27, OUT)
    vline(img, 24, 21, 27, OUT)
    px(img, 8, 28, OUT); px(img, 23, 28, OUT)
    hline(img, 9, 22, 29, OUT)
    rect(img, 8, 20, 23, 20, FUR)
    rect(img, 8, 21, 23, 27, FUR)
    rect(img, 9, 28, 22, 28, FUR)
    rect(img, 12, 25, 19, 28, BELLY)
    # head tucked left
    rect(img, 9, 19, 14, 19, FUR)
    rect(img, 9, 20, 13, 20, FUR_D)
    # ear flop
    px(img, 10, 18, OUT); px(img, 11, 17, OUT)
    px(img, 12, 17, OUT); px(img, 13, 18, OUT)
    rect(img, 11, 18, 12, 18, FUR_D)
    # closed eye
    hline(img, 10, 12, 21, EYE)
    px(img, 9, 22, NOSE)
    # tail curl
    px(img, 22, 21, OUT); px(img, 23, 22, FUR_D); px(img, 22, 22, FUR_D)
    # Z marks
    rect(img, 25, 8, 27, 8, ZZZ); px(img, 27, 9, ZZZ); px(img, 26, 10, ZZZ); rect(img, 25, 11, 27, 11, ZZZ)
    rect(img, 22, 4, 25, 4, ZZZ); px(img, 25, 5, ZZZ); px(img, 24, 6, ZZZ); px(img, 23, 7, ZZZ)
    return img


# ============================================================
# ADULT — 32x48, taller, full ears, collar
# ============================================================

AW, AH = 32, 48


def adult_canvas():
    return Image.new("RGBA", (AW, AH), TR)


def adult_body(img, mouth="neutral", eye="open", cheeks=False):
    # Ears: larger, slightly down at sides
    # left ear
    for i in range(6):
        hline(img, 6 - i, 6 + i, 3 + i, OUT) if i < 4 else None
    rect(img, 5, 4, 7, 9, FUR_D)
    # cap
    px(img, 5, 10, OUT); px(img, 7, 10, OUT)
    # right ear
    for i in range(6):
        hline(img, 25 - i, 25 + i, 3 + i, OUT) if i < 4 else None
    rect(img, 24, 4, 26, 9, FUR_D)
    px(img, 24, 10, OUT); px(img, 26, 10, OUT)

    # Head outline (slightly larger)
    hline(img, 10, 21, 8, OUT)
    px(img, 9, 9, OUT); px(img, 22, 9, OUT)
    vline(img, 8, 10, 19, OUT)
    vline(img, 23, 10, 19, OUT)
    hline(img, 9, 22, 20, OUT)

    rect(img, 9, 9, 22, 19, FUR)
    rect(img, 11, 14, 20, 19, BELLY)
    # head top darker
    hline(img, 10, 12, 9, FUR_D)
    hline(img, 19, 21, 9, FUR_D)
    # cheek tufts
    px(img, 8, 17, FUR_D); px(img, 23, 17, FUR_D)

    # Eyes (slightly larger)
    if eye == "open":
        rect(img, 12, 12, 12, 13, EYE); px(img, 13, 12, EYE_HL)
        rect(img, 18, 12, 18, 13, EYE); px(img, 19, 12, EYE_HL)
    elif eye == "closed":
        hline(img, 11, 13, 13, EYE)
        hline(img, 18, 20, 13, EYE)
    elif eye == "sad":
        px(img, 12, 13, EYE); px(img, 13, 12, EYE)
        px(img, 18, 12, EYE); px(img, 19, 13, EYE)

    # Nose (a bit larger)
    rect(img, 14, 15, 17, 17, NOSE)
    px(img, 15, 15, (90, 60, 50, 255))

    if mouth == "smile":
        px(img, 13, 19, OUT)
        px(img, 14, 20, OUT); px(img, 15, 19, OUT); px(img, 16, 19, OUT); px(img, 17, 20, OUT)
        px(img, 18, 19, OUT)
    elif mouth == "open":
        rect(img, 14, 19, 17, 20, PINK)
        px(img, 13, 19, OUT); px(img, 18, 19, OUT)
        px(img, 15, 20, (220, 130, 145, 255))
    elif mouth == "frown":
        px(img, 13, 20, OUT); px(img, 14, 19, OUT)
        rect(img, 15, 19, 16, 19, OUT)
        px(img, 17, 19, OUT); px(img, 18, 20, OUT)
    else:
        hline(img, 14, 17, 19, OUT)

    if cheeks:
        rect(img, 10, 16, 11, 16, PINK)
        rect(img, 20, 16, 21, 16, PINK)

    # Body (taller, broad chest)
    vline(img, 8, 21, 36, OUT)
    vline(img, 23, 21, 36, OUT)
    hline(img, 9, 22, 37, OUT)
    rect(img, 9, 21, 22, 36, FUR)
    rect(img, 12, 24, 19, 36, BELLY)

    # Collar
    hline(img, 9, 22, 21, COLLAR)
    hline(img, 9, 22, 22, COLLAR_D)
    px(img, 15, 23, TAG); px(img, 16, 23, TAG)
    px(img, 15, 24, TAG); px(img, 16, 24, TAG)
    px(img, 14, 22, OUT); px(img, 17, 22, OUT)

    # Legs (4 visible)
    rect(img, 9, 38, 12, 42, FUR)
    rect(img, 19, 38, 22, 42, FUR)
    px(img, 9, 42, OUT); px(img, 12, 42, OUT)
    px(img, 19, 42, OUT); px(img, 22, 42, OUT)
    hline(img, 9, 12, 43, OUT)
    hline(img, 19, 22, 43, OUT)
    # paw pads hint
    px(img, 10, 43, FUR_DD); px(img, 11, 43, FUR_DD)
    px(img, 20, 43, FUR_DD); px(img, 21, 43, FUR_DD)


def adult_tail_up(img):
    # majestic curved tail
    px(img, 23, 25, OUT)
    px(img, 24, 24, OUT)
    px(img, 25, 23, OUT)
    px(img, 26, 22, OUT)
    px(img, 27, 22, OUT)
    px(img, 28, 23, OUT)
    px(img, 28, 24, OUT)
    px(img, 27, 23, FUR_D); px(img, 26, 23, FUR)
    px(img, 25, 24, FUR)


def adult_tail_wag(img):
    px(img, 23, 24, OUT)
    px(img, 24, 22, OUT); px(img, 25, 21, OUT)
    px(img, 27, 21, OUT); px(img, 28, 22, OUT)
    px(img, 26, 22, FUR_D)
    px(img, 25, 22, FUR); px(img, 24, 23, FUR); px(img, 26, 23, FUR)


def adult_tail_down(img):
    px(img, 23, 28, OUT)
    px(img, 24, 30, OUT)
    px(img, 25, 32, OUT)
    px(img, 24, 29, FUR_D)


def make_adult_idle():
    img = adult_canvas()
    adult_body(img, mouth="neutral", eye="open")
    adult_tail_up(img)
    return img


def make_adult_happy():
    img = adult_canvas()
    adult_body(img, mouth="open", eye="open", cheeks=True)
    adult_tail_wag(img)
    px(img, 4, 6, EYE_HL); px(img, 5, 5, EYE_HL)
    px(img, 28, 4, EYE_HL); px(img, 29, 5, EYE_HL)
    return img


def make_adult_eating():
    img = adult_canvas()
    adult_body(img, mouth="open", eye="closed")
    adult_tail_wag(img)
    # bowl bottom-left
    hline(img, 1, 9, 44, OUT)
    px(img, 1, 45, OUT); px(img, 9, 45, OUT)
    rect(img, 2, 45, 8, 45, BOWL)
    px(img, 2, 46, OUT); px(img, 8, 46, OUT)
    rect(img, 3, 46, 7, 46, BOWL_D)
    hline(img, 4, 6, 47, OUT)
    px(img, 3, 43, KIBBLE); px(img, 5, 43, KIBBLE); px(img, 7, 43, KIBBLE)
    px(img, 4, 42, KIBBLE); px(img, 6, 42, KIBBLE)
    return img


def make_adult_sad():
    img = adult_canvas()
    adult_body(img, mouth="frown", eye="sad")
    adult_tail_down(img)
    # droopy ears (paint over upper ear with lower fur)
    rect(img, 5, 6, 7, 13, FUR_D)
    px(img, 5, 13, OUT); px(img, 7, 13, OUT)
    rect(img, 24, 6, 26, 13, FUR_D)
    px(img, 24, 13, OUT); px(img, 26, 13, OUT)
    px(img, 11, 14, TEAR); px(img, 11, 15, TEAR)
    return img


def make_adult_sleeping():
    img = adult_canvas()
    # large curled adult
    hline(img, 9, 22, 24, OUT)
    px(img, 8, 25, OUT); px(img, 23, 25, OUT)
    px(img, 7, 26, OUT); px(img, 24, 26, OUT)
    vline(img, 6, 27, 35, OUT)
    vline(img, 25, 27, 35, OUT)
    px(img, 7, 36, OUT); px(img, 24, 36, OUT)
    hline(img, 8, 23, 37, OUT)
    rect(img, 7, 26, 24, 26, FUR)
    rect(img, 7, 27, 24, 35, FUR)
    rect(img, 8, 36, 23, 36, FUR)
    rect(img, 11, 32, 20, 36, BELLY)
    # collar visible while curled
    hline(img, 9, 12, 27, COLLAR)
    px(img, 11, 28, TAG)
    # head tucked left
    rect(img, 8, 25, 14, 25, FUR)
    rect(img, 8, 26, 13, 26, FUR_D)
    # ear flop
    px(img, 9, 24, OUT); px(img, 10, 23, OUT)
    px(img, 12, 23, OUT); px(img, 13, 24, OUT)
    rect(img, 10, 24, 12, 24, FUR_D)
    hline(img, 9, 12, 27, EYE)  # closed eye line drawn over collar — fix order
    # restore collar bit
    hline(img, 13, 16, 27, COLLAR)
    px(img, 14, 28, TAG); px(img, 15, 28, TAG)
    # tiny nose
    px(img, 8, 28, NOSE)
    # tail curl
    px(img, 23, 26, OUT); px(img, 24, 27, FUR_D); px(img, 23, 27, FUR_D)
    # Zzz
    rect(img, 26, 10, 28, 10, ZZZ); px(img, 28, 11, ZZZ); px(img, 27, 12, ZZZ); rect(img, 26, 13, 28, 13, ZZZ)
    rect(img, 23, 4, 26, 4, ZZZ); px(img, 26, 5, ZZZ); px(img, 25, 6, ZZZ); px(img, 24, 7, ZZZ)
    return img


TEEN_STATES = {
    "idle": make_teen_idle,
    "happy": make_teen_happy,
    "eating": make_teen_eating,
    "sad": make_teen_sad,
    "sleeping": make_teen_sleeping,
}

ADULT_STATES = {
    "idle": make_adult_idle,
    "happy": make_adult_happy,
    "eating": make_adult_eating,
    "sad": make_adult_sad,
    "sleeping": make_adult_sleeping,
}


def main():
    teen_dir = os.path.join(BASE, "teen")
    adult_dir = os.path.join(BASE, "adult")
    os.makedirs(teen_dir, exist_ok=True)
    os.makedirs(adult_dir, exist_ok=True)
    for name, fn in TEEN_STATES.items():
        img = fn()
        img.save(os.path.join(teen_dir, f"{name}.png"))
        big = img.resize((TW * 8, TH * 8), Image.NEAREST)
        big.save(os.path.join(PREVIEW, f"teen_{name}_8x.png"))
    for name, fn in ADULT_STATES.items():
        img = fn()
        img.save(os.path.join(adult_dir, f"{name}.png"))
        big = img.resize((AW * 8, AH * 8), Image.NEAREST)
        big.save(os.path.join(PREVIEW, f"adult_{name}_8x.png"))
    print("teen + adult sprites generated")


if __name__ == "__main__":
    main()
