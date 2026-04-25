"""
Pixel-art puppy sprite generator (32x32, indexed palette via RGBA).
Generates 5 states: idle, happy, eating, sad, sleeping.
Style: chubby Shiba/Dachshund mix, 4-color palette + outline, soft pastel-friendly.
Also writes 8x nearest-neighbor previews into ../preview/.
"""
from PIL import Image
import os

W = H = 32
BASE = os.path.dirname(os.path.abspath(__file__))
PREVIEW = os.path.normpath(os.path.join(BASE, "..", "preview"))
os.makedirs(PREVIEW, exist_ok=True)

# Palette
TR = (0, 0, 0, 0)
OUT = (60, 36, 28, 255)        # dark brown outline
FUR = (235, 178, 110, 255)     # warm tan
FUR_D = (200, 138, 78, 255)    # darker tan (shading / ear tips / tail)
BELLY = (252, 232, 200, 255)   # cream belly/muzzle
NOSE = (50, 32, 26, 255)       # near-black nose
EYE = (40, 26, 22, 255)        # eye
EYE_HL = (255, 255, 255, 255)  # eye highlight
PINK = (255, 168, 178, 255)    # tongue / cheeks
BOWL = (180, 140, 220, 255)    # food bowl (pastel purple)
BOWL_D = (140, 104, 180, 255)
KIBBLE = (230, 168, 92, 255)
TEAR = (130, 200, 240, 255)    # blue tear
ZZZ = (120, 150, 220, 255)     # sleep Z


def new_canvas():
    return Image.new("RGBA", (W, H), TR)


def px(img, x, y, c):
    if 0 <= x < W and 0 <= y < H:
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


# ---------- Body builders ----------

def draw_body_standing(img, mouth="neutral", eye="open", cheeks=False):
    """Front-facing chubby puppy. Returns nothing, draws into img.
    mouth: 'neutral' | 'smile' | 'open' | 'frown'
    eye:   'open' | 'closed' | 'sad'
    """
    # ===== Outline (head + body silhouette) =====
    # Ears (triangular, drooping a bit)
    # Left ear
    for i in range(4):
        hline(img, 7 - i, 7 + i, 6 + i, OUT)
    # Right ear
    for i in range(4):
        hline(img, 24 - i, 24 + i, 6 + i, OUT)

    # Head outline (rounded square)
    # top
    hline(img, 10, 21, 7, OUT)
    # sides
    vline(img, 8, 9, 16, OUT)
    vline(img, 9, 8, 8, OUT)
    vline(img, 23, 9, 16, OUT)
    vline(img, 22, 8, 8, OUT)
    # rounded top corners
    px(img, 9, 8, OUT)
    px(img, 22, 8, OUT)
    # bottom of head -> blends into body, draw chin curve
    hline(img, 10, 21, 17, OUT)

    # Body outline (chubby)
    vline(img, 8, 18, 24, OUT)
    vline(img, 23, 18, 24, OUT)
    hline(img, 9, 22, 25, OUT)
    # feet split (small notches at bottom)
    px(img, 12, 25, OUT)
    px(img, 13, 25, OUT)
    px(img, 18, 25, OUT)
    px(img, 19, 25, OUT)

    # ===== Fill fur =====
    # Ears interior (darker)
    for i in range(3):
        hline(img, 7 - i + 1, 7 + i - 1, 6 + i + 1 if False else 7 + i, FUR_D)
    # simpler ear fill
    rect(img, 5, 7, 7, 9, FUR_D)
    rect(img, 24, 7, 26, 9, FUR_D)

    # Head fill
    rect(img, 9, 8, 22, 16, FUR)
    # belly/muzzle cream patch
    rect(img, 12, 13, 19, 16, BELLY)

    # Body fill
    rect(img, 9, 18, 22, 24, FUR)
    # belly cream
    rect(img, 12, 20, 19, 24, BELLY)

    # Darker patch on top of head (between ears)
    hline(img, 10, 12, 8, FUR_D)
    hline(img, 19, 21, 8, FUR_D)

    # ===== Face =====
    # Eyes
    if eye == "open":
        # left eye
        px(img, 12, 11, EYE)
        px(img, 12, 12, EYE)
        px(img, 13, 11, EYE_HL)
        # right eye
        px(img, 18, 11, EYE)
        px(img, 18, 12, EYE)
        px(img, 19, 11, EYE_HL)
    elif eye == "closed":
        hline(img, 11, 13, 12, EYE)
        hline(img, 18, 20, 12, EYE)
    elif eye == "sad":
        # downward droop
        px(img, 12, 12, EYE)
        px(img, 13, 11, EYE)
        px(img, 18, 11, EYE)
        px(img, 19, 12, EYE)

    # Nose
    rect(img, 14, 14, 17, 15, NOSE)
    # nose highlight
    px(img, 15, 14, (90, 60, 50, 255))

    # Mouth
    if mouth == "smile":
        # subtle "w" smile under nose
        px(img, 13, 16, OUT)
        px(img, 14, 17, OUT)
        px(img, 15, 16, OUT)
        px(img, 16, 16, OUT)
        px(img, 17, 17, OUT)
        px(img, 18, 16, OUT)
    elif mouth == "open":
        # tongue out
        rect(img, 14, 16, 17, 17, PINK)
        px(img, 13, 16, OUT)
        px(img, 18, 16, OUT)
        # tongue line
        px(img, 15, 17, (220, 130, 145, 255))
    elif mouth == "frown":
        # downturn
        px(img, 13, 17, OUT)
        px(img, 14, 16, OUT)
        px(img, 15, 16, OUT)
        px(img, 16, 16, OUT)
        px(img, 17, 16, OUT)
        px(img, 18, 17, OUT)
    else:  # neutral
        hline(img, 14, 17, 16, OUT)

    if cheeks:
        px(img, 10, 13, PINK)
        px(img, 11, 13, PINK)
        px(img, 20, 13, PINK)
        px(img, 21, 13, PINK)

    # Tail (small wag stub on right)
    # default tail will be added per-state to allow wagging variations


def add_tail_up(img):
    # curled tail up-right
    px(img, 24, 19, OUT)
    px(img, 25, 18, OUT)
    px(img, 26, 18, OUT)
    px(img, 27, 19, OUT)
    px(img, 26, 20, FUR_D)
    px(img, 25, 19, FUR)


def add_tail_wag(img):
    # tail to the right, fluffy
    px(img, 24, 18, OUT)
    px(img, 25, 17, OUT)
    px(img, 26, 17, OUT)
    px(img, 27, 18, OUT)
    px(img, 28, 19, OUT)
    px(img, 27, 19, FUR_D)
    px(img, 26, 18, FUR)
    px(img, 25, 18, FUR)


def add_tail_down(img):
    # tail droopy
    px(img, 24, 22, OUT)
    px(img, 25, 23, OUT)
    px(img, 26, 24, OUT)
    px(img, 25, 22, FUR_D)


# ---------- States ----------

def make_idle():
    img = new_canvas()
    draw_body_standing(img, mouth="neutral", eye="open")
    add_tail_up(img)
    return img


def make_happy():
    img = new_canvas()
    draw_body_standing(img, mouth="open", eye="open", cheeks=True)
    add_tail_wag(img)
    # little sparkle
    px(img, 4, 6, EYE_HL)
    px(img, 5, 5, EYE_HL)
    px(img, 28, 4, EYE_HL)
    return img


def make_eating():
    img = new_canvas()
    # Lower head a bit: shift face down by 1 row by re-drawing custom
    # We'll just use idle base then add bowl + chewing mouth
    draw_body_standing(img, mouth="open", eye="closed")
    add_tail_wag(img)
    # Food bowl in front (bottom-left area, on ground)
    # bowl rim
    hline(img, 1, 9, 27, OUT)
    # bowl body
    px(img, 1, 28, OUT)
    px(img, 9, 28, OUT)
    rect(img, 2, 28, 8, 28, BOWL)
    px(img, 2, 29, OUT)
    px(img, 8, 29, OUT)
    rect(img, 3, 29, 7, 29, BOWL_D)
    hline(img, 4, 6, 30, OUT)
    # kibbles
    px(img, 3, 27, KIBBLE)
    px(img, 5, 27, KIBBLE)
    px(img, 7, 27, KIBBLE)
    px(img, 4, 26, KIBBLE)
    px(img, 6, 26, KIBBLE)
    return img


def make_sad():
    img = new_canvas()
    draw_body_standing(img, mouth="frown", eye="sad")
    add_tail_down(img)
    # droopy ears: overdraw ears lower
    rect(img, 5, 8, 7, 11, FUR_D)
    px(img, 5, 11, OUT)
    px(img, 7, 11, OUT)
    rect(img, 24, 8, 26, 11, FUR_D)
    px(img, 24, 11, OUT)
    px(img, 26, 11, OUT)
    # tear drop
    px(img, 11, 13, TEAR)
    px(img, 11, 14, TEAR)
    return img


def make_sleeping():
    img = new_canvas()
    # Curled body — draw an oval blob instead of standing pose
    # Outline of curl
    # top arc
    hline(img, 10, 21, 14, OUT)
    px(img, 9, 15, OUT)
    px(img, 22, 15, OUT)
    px(img, 8, 16, OUT)
    px(img, 23, 16, OUT)
    vline(img, 7, 17, 21, OUT)
    vline(img, 24, 17, 21, OUT)
    px(img, 8, 22, OUT)
    px(img, 23, 22, OUT)
    hline(img, 9, 22, 23, OUT)
    # fill
    rect(img, 8, 16, 23, 16, FUR)
    rect(img, 8, 17, 23, 21, FUR)
    rect(img, 9, 22, 22, 22, FUR)
    # belly cream
    rect(img, 12, 19, 19, 22, BELLY)
    # head tucked on left side
    rect(img, 9, 15, 14, 15, FUR)
    rect(img, 9, 16, 13, 16, FUR_D)
    # ear flopped
    px(img, 10, 14, OUT)
    px(img, 11, 13, OUT)
    px(img, 12, 13, OUT)
    px(img, 13, 14, OUT)
    rect(img, 11, 14, 12, 14, FUR_D)
    # closed eye
    hline(img, 10, 12, 17, EYE)
    # tiny nose
    px(img, 9, 18, NOSE)
    # tail curled around
    px(img, 22, 17, OUT)
    px(img, 23, 18, FUR_D)
    px(img, 22, 18, FUR_D)
    # Zzz
    # small Z
    rect(img, 25, 6, 27, 6, ZZZ)
    px(img, 27, 7, ZZZ)
    px(img, 26, 8, ZZZ)
    rect(img, 25, 9, 27, 9, ZZZ)
    # bigger Z
    rect(img, 22, 2, 25, 2, ZZZ)
    px(img, 25, 3, ZZZ)
    px(img, 24, 4, ZZZ)
    px(img, 23, 5, ZZZ)
    rect(img, 22, 6, 25, 6, ZZZ) if False else None
    return img


STATES = {
    "idle": make_idle,
    "happy": make_happy,
    "eating": make_eating,
    "sad": make_sad,
    "sleeping": make_sleeping,
}


def main():
    for name, fn in STATES.items():
        img = fn()
        out = os.path.join(BASE, f"{name}.png")
        img.save(out)
        # 8x preview
        big = img.resize((W * 8, H * 8), Image.NEAREST)
        big.save(os.path.join(PREVIEW, f"{name}_8x.png"))
        print(f"wrote {out} and preview")


if __name__ == "__main__":
    main()
