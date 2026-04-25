"""
P2 픽셀아트 생성기
- breeds/{shiba,maltese,poodle,husky}.png (32x32 머리만, 종 선택 카드용)
- accessories/{hat_red,ribbon,collar,scarf,glasses}.png (32x32, 강아지 위 오버레이)
- icons/icon-256.png, icon-512.png (PWA 아이콘, happy 스프라이트 업스케일)
"""
from PIL import Image, ImageFilter
import os

BASE = os.path.dirname(os.path.abspath(__file__))

TR = (0, 0, 0, 0)
OUT = (60, 36, 28, 255)
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


# ----- 종별 머리 (32x32) ------------------------------------------------
# 각 종 — 색감만 다르게. 둥근 머리 + 귀 + 얼굴.
def head(fur, fur_d, belly, ear_style="droop", extra=None):
    img = Image.new("RGBA", (32, 32), TR)
    # ears
    if ear_style == "droop":
        # left ear (drooping)
        for i in range(4):
            hline(img, 7 - i, 7 + i, 8 + i, OUT)
        rect(img, 5, 9, 7, 12, fur_d)
        # right ear
        for i in range(4):
            hline(img, 24 - i, 24 + i, 8 + i, OUT)
        rect(img, 24, 9, 26, 12, fur_d)
    elif ear_style == "perked":
        # pointed up
        for i in range(5):
            hline(img, 7 - i + max(0, i-2), 7 + i - max(0, i-2), 4 + i, OUT)
        rect(img, 6, 5, 8, 8, fur_d)
        for i in range(5):
            hline(img, 24 - i + max(0, i-2), 24 + i - max(0, i-2), 4 + i, OUT)
        rect(img, 23, 5, 25, 8, fur_d)
    elif ear_style == "fluffy":
        # round fluffy ears
        rect(img, 5, 7, 8, 11, fur_d)
        px(img, 4, 8, OUT); px(img, 4, 9, OUT); px(img, 4, 10, OUT)
        px(img, 9, 7, OUT); px(img, 8, 6, OUT); px(img, 7, 6, OUT); px(img, 6, 7, OUT); px(img, 5, 7, OUT)
        rect(img, 23, 7, 26, 11, fur_d)
        px(img, 27, 8, OUT); px(img, 27, 9, OUT); px(img, 27, 10, OUT)
        px(img, 22, 7, OUT); px(img, 23, 6, OUT); px(img, 24, 6, OUT); px(img, 25, 6, OUT); px(img, 26, 7, OUT)

    # head outline
    hline(img, 10, 21, 9, OUT)
    px(img, 9, 10, OUT); px(img, 22, 10, OUT)
    vline(img, 8, 11, 22, OUT)
    vline(img, 23, 11, 22, OUT)
    hline(img, 9, 22, 23, OUT)

    # head fill
    rect(img, 9, 10, 22, 22, fur)
    rect(img, 12, 16, 19, 22, belly)

    # darker top
    hline(img, 10, 12, 10, fur_d)
    hline(img, 19, 21, 10, fur_d)

    # eyes (open)
    px(img, 12, 14, EYE); px(img, 12, 15, EYE); px(img, 13, 14, EYE_HL)
    px(img, 18, 14, EYE); px(img, 18, 15, EYE); px(img, 19, 14, EYE_HL)

    # nose
    rect(img, 14, 17, 17, 18, NOSE)
    px(img, 15, 17, (90, 60, 50, 255))

    # mouth — small smile
    px(img, 13, 20, OUT)
    px(img, 14, 21, OUT); px(img, 15, 20, OUT); px(img, 16, 20, OUT); px(img, 17, 21, OUT)
    px(img, 18, 20, OUT)

    if extra: extra(img, fur, fur_d, belly)
    return img


def shiba_extra(img, fur, fur_d, belly):
    # 시바: 갈색 + 흰 가슴 + 짙은 점 (이미 기본 톤)
    pass


def maltese_extra(img, fur, fur_d, belly):
    # 말티즈: 흰. extra fluff 점들
    px(img, 10, 11, fur_d); px(img, 21, 11, fur_d)


def poodle_extra(img, fur, fur_d, belly):
    # 푸들: 곱슬 점 패턴 추가
    for (x, y) in [(11,12),(13,11),(15,11),(17,11),(19,12),(20,13),(11,13)]:
        px(img, x, y, fur_d)


def husky_extra(img, fur, fur_d, belly):
    # 허스키: 파란 눈 + 마스크 패턴
    BLUE = (130, 200, 240, 255); BLUE_D = (90, 160, 220, 255)
    px(img, 12, 14, BLUE_D); px(img, 13, 14, EYE_HL); px(img, 12, 15, BLUE)
    px(img, 18, 14, BLUE_D); px(img, 19, 14, EYE_HL); px(img, 18, 15, BLUE)
    # white mask on muzzle 영역은 belly가 이미 그려서 OK
    # 어두운 마스크 위 양 옆
    rect(img, 9, 11, 11, 13, fur_d)
    rect(img, 20, 11, 22, 13, fur_d)


BREEDS = {
    "shiba":   {"fur":(235,178,110,255), "fur_d":(200,138,78,255),  "belly":(252,232,200,255), "ear":"droop",  "extra":shiba_extra},
    "maltese": {"fur":(252,248,238,255), "fur_d":(220,210,196,255), "belly":(255,255,250,255), "ear":"droop",  "extra":maltese_extra},
    "poodle":  {"fur":(240,228,210,255), "fur_d":(180,160,140,255), "belly":(252,244,228,255), "ear":"fluffy", "extra":poodle_extra},
    "husky":   {"fur":(180,180,200,255), "fur_d":(110,110,140,255), "belly":(245,245,250,255), "ear":"perked", "extra":husky_extra},
}


def gen_breeds():
    out = os.path.join(BASE, "breeds")
    os.makedirs(out, exist_ok=True)
    for bid, p in BREEDS.items():
        img = head(p["fur"], p["fur_d"], p["belly"], p["ear"], p["extra"])
        img.save(os.path.join(out, f"{bid}.png"))


# ----- 액세서리 32x32 -------------------------------------------------
def acc_canvas():
    return Image.new("RGBA", (32, 32), TR)


def make_hat_red():
    img = acc_canvas()
    # 빨간 모자 (top hat 아닌, 둥근 야구모자/베레)
    RED = (220, 60, 70, 255); RED_D = (160, 30, 40, 255); WHITE = (255, 255, 255, 255)
    # brim
    hline(img, 5, 26, 22, OUT)
    hline(img, 6, 25, 21, RED_D)
    # crown
    rect(img, 8, 12, 23, 21, RED)
    rect(img, 8, 12, 23, 13, RED_D)
    # outline
    hline(img, 8, 23, 11, OUT)
    vline(img, 7, 12, 21, OUT)
    vline(img, 24, 12, 21, OUT)
    # white star
    px(img, 14, 16, WHITE); px(img, 15, 15, WHITE); px(img, 16, 15, WHITE); px(img, 17, 16, WHITE)
    px(img, 14, 17, WHITE); px(img, 17, 17, WHITE); px(img, 15, 18, WHITE); px(img, 16, 18, WHITE)
    return img


def make_ribbon():
    img = acc_canvas()
    PINK_R = (255, 130, 170, 255); PINK_RD = (200, 80, 130, 255); CENTER = (255, 230, 240, 255)
    # left bow
    rect(img, 5, 11, 12, 19, PINK_R)
    px(img, 5, 11, OUT); px(img, 12, 11, OUT); px(img, 5, 19, OUT); px(img, 12, 19, OUT)
    vline(img, 4, 12, 18, OUT); vline(img, 13, 12, 18, PINK_RD)
    # right bow
    rect(img, 19, 11, 26, 19, PINK_R)
    px(img, 19, 11, OUT); px(img, 26, 11, OUT); px(img, 19, 19, OUT); px(img, 26, 19, OUT)
    vline(img, 18, 12, 18, PINK_RD); vline(img, 27, 12, 18, OUT)
    # center knot
    rect(img, 13, 13, 18, 17, CENTER)
    rect(img, 13, 13, 18, 13, OUT); rect(img, 13, 17, 18, 17, OUT)
    vline(img, 13, 13, 17, OUT); vline(img, 18, 13, 17, OUT)
    return img


def make_collar():
    img = acc_canvas()
    LEATHER = (170, 90, 50, 255); LEATHER_D = (110, 60, 30, 255); GOLD = (245, 210, 80, 255); GOLD_D = (200, 150, 30, 255)
    # collar band
    rect(img, 2, 13, 29, 18, LEATHER)
    hline(img, 2, 29, 13, OUT)
    hline(img, 2, 29, 18, OUT)
    hline(img, 2, 29, 14, LEATHER_D)
    hline(img, 2, 29, 17, LEATHER_D)
    # studs
    for x in [6, 11, 21, 26]:
        rect(img, x, 15, x+1, 16, GOLD)
        px(img, x, 15, OUT); px(img, x+1, 16, GOLD_D)
    # bone tag
    rect(img, 13, 19, 18, 24, GOLD)
    rect(img, 13, 19, 18, 19, OUT); rect(img, 13, 24, 18, 24, OUT)
    vline(img, 12, 20, 23, OUT); vline(img, 19, 20, 23, OUT)
    px(img, 13, 21, OUT); px(img, 18, 21, OUT)
    rect(img, 14, 21, 17, 22, GOLD_D)
    return img


def make_scarf():
    img = acc_canvas()
    BLUE = (110, 180, 230, 255); BLUE_D = (60, 120, 180, 255); WHITE = (240, 248, 255, 255)
    # wrap around neck
    rect(img, 3, 13, 28, 18, BLUE)
    hline(img, 3, 28, 13, OUT); hline(img, 3, 28, 18, OUT)
    # stripes
    for x in range(4, 28, 4):
        vline(img, x, 14, 17, BLUE_D)
        vline(img, x+1, 14, 17, WHITE)
    # tail flowing down right
    rect(img, 21, 18, 26, 26, BLUE)
    px(img, 21, 18, OUT); px(img, 26, 18, OUT)
    vline(img, 20, 19, 26, OUT); vline(img, 27, 19, 25, OUT)
    hline(img, 21, 26, 27, OUT)
    # stripe on tail
    vline(img, 22, 20, 25, BLUE_D)
    vline(img, 24, 20, 25, WHITE)
    return img


def make_glasses():
    img = acc_canvas()
    FRAME = (40, 40, 50, 255); LENS = (150, 200, 240, 180); LENS_HL = (255, 255, 255, 220)
    # left lens
    rect(img, 4, 12, 13, 19, LENS)
    hline(img, 4, 13, 11, FRAME); hline(img, 4, 13, 20, FRAME)
    vline(img, 3, 12, 19, FRAME); vline(img, 14, 12, 19, FRAME)
    # right lens
    rect(img, 18, 12, 27, 19, LENS)
    hline(img, 18, 27, 11, FRAME); hline(img, 18, 27, 20, FRAME)
    vline(img, 17, 12, 19, FRAME); vline(img, 28, 12, 19, FRAME)
    # bridge
    hline(img, 14, 17, 14, FRAME); hline(img, 14, 17, 16, FRAME)
    # highlights
    rect(img, 5, 13, 7, 14, LENS_HL)
    rect(img, 19, 13, 21, 14, LENS_HL)
    return img


ACC = {
    "hat_red": make_hat_red,
    "ribbon": make_ribbon,
    "collar": make_collar,
    "scarf": make_scarf,
    "glasses": make_glasses,
}


def gen_accessories():
    out = os.path.join(BASE, "accessories")
    os.makedirs(out, exist_ok=True)
    for name, fn in ACC.items():
        img = fn()
        img.save(os.path.join(out, f"{name}.png"))


# ----- PWA 아이콘 (256, 512) ------------------------------------------
def gen_icons():
    out = os.path.join(BASE, "icons")
    os.makedirs(out, exist_ok=True)
    # base: puppy/happy.png 32x32 → upscale NEAREST
    happy = Image.open(os.path.join(BASE, "puppy", "happy.png")).convert("RGBA")
    # composite onto pastel background with rounded mask
    for size in (256, 512):
        bg = Image.new("RGBA", (size, size), (253, 233, 217, 255))
        # soft circle gradient — simple radial via mask
        # round corners
        radius = size // 7
        # mask for rounded square
        mask = Image.new("L", (size, size), 0)
        from PIL import ImageDraw
        d = ImageDraw.Draw(mask)
        d.rounded_rectangle((0, 0, size-1, size-1), radius=radius, fill=255)
        # decorative: sun in corner
        d2 = ImageDraw.Draw(bg)
        d2.ellipse((size*0.06, size*0.06, size*0.22, size*0.22), fill=(255, 226, 138, 255))
        # puppy in center, large
        ph = happy.resize((int(size*0.7), int(size*0.7)), Image.NEAREST)
        cx = (size - ph.width) // 2
        cy = (size - ph.height) // 2 + int(size*0.04)
        bg.alpha_composite(ph, (cx, cy))
        # apply mask
        out_img = Image.new("RGBA", (size, size), (0,0,0,0))
        out_img.paste(bg, (0, 0), mask)
        out_img.save(os.path.join(out, f"icon-{size}.png"))


def main():
    gen_breeds()
    gen_accessories()
    gen_icons()
    print("P2 assets generated")


if __name__ == "__main__":
    main()
