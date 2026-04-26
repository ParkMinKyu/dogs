"""Generate 10 clothes (옷) sprites — 32×32 픽셀아트, 강아지 몸통에 입혀지는 셔츠 형태.
위는 좁고(목 부분), 아래는 넓어지는 사다리꼴/셔츠 모양.
출력: assets/accessories/clothes_01.png ~ clothes_10.png
"""
from PIL import Image, ImageDraw
import os

W, H = 32, 32
OUT = os.path.join(os.path.dirname(__file__), 'accessories')
os.makedirs(OUT, exist_ok=True)


def base_shirt(draw, body_color, accent=None):
    """기본 셔츠 형태 (사다리꼴): 목 부분 좁고, 아래 넓음.
    좌표: 어깨 (8,11)-(23,11), 허리 (5,24)-(26,24).
    소매 살짝.
    """
    # 몸통 사다리꼴 — outline 진하게
    poly = [(10, 11), (21, 11), (24, 23), (7, 23)]
    draw.polygon(poly, fill=body_color, outline=(40, 40, 40, 255))
    # 목 V (옷 위쪽 V자)
    neck = [(13, 11), (15, 14), (18, 11)]
    draw.polygon(neck, fill=(0, 0, 0, 0))
    # 소매 살짝 (양쪽 어깨 약간)
    draw.rectangle((7, 11, 9, 14), fill=body_color, outline=(40, 40, 40, 255))
    draw.rectangle((22, 11, 24, 14), fill=body_color, outline=(40, 40, 40, 255))
    if accent:
        # accent: 가슴 한 줄 무늬
        draw.line((9, 16, 22, 16), fill=accent)
        draw.line((9, 18, 22, 18), fill=accent)


def shirt_red(draw):
    base_shirt(draw, (220, 60, 60, 255))


def shirt_hoodie_blue(draw):
    base_shirt(draw, (60, 110, 200, 255))
    # 후드 (어깨 위 작은 부분)
    draw.polygon([(11, 9), (20, 9), (19, 11), (12, 11)],
                 fill=(40, 80, 160, 255), outline=(40, 40, 40, 255))


def shirt_yellow(draw):
    base_shirt(draw, (240, 210, 60, 255), accent=(180, 140, 30, 255))


def shirt_pink_dress(draw):
    """원피스 — 아래 더 넓음."""
    body = (240, 130, 180, 255)
    poly = [(10, 11), (21, 11), (27, 26), (4, 26)]  # 원피스 (아래 매우 넓음)
    draw.polygon(poly, fill=body, outline=(40, 40, 40, 255))
    neck = [(13, 11), (15, 14), (18, 11)]
    draw.polygon(neck, fill=(0, 0, 0, 0))
    # 허리 라인
    draw.line((6, 21, 25, 21), fill=(255, 200, 220, 255))


def sweater_green(draw):
    base_shirt(draw, (90, 170, 90, 255))
    # 점박 무늬
    for (x, y) in [(11, 15), (15, 15), (19, 15), (13, 19), (17, 19), (21, 19)]:
        draw.point((x, y), fill=(60, 120, 60, 255))


def shirt_stripe(draw):
    """줄무늬 티 (흰 + 파랑)."""
    base_shirt(draw, (240, 240, 250, 255))
    for y in range(13, 23, 2):
        draw.line((8, y, 23, y), fill=(60, 110, 200, 255))


def shirt_star(draw):
    """별 패턴."""
    base_shirt(draw, (140, 80, 200, 255))
    # 작은 별들 (점 십자)
    for (cx, cy) in [(12, 15), (19, 17), (15, 19), (12, 21), (20, 21)]:
        draw.point((cx, cy), fill=(255, 240, 100, 255))
        draw.point((cx-1, cy), fill=(255, 240, 100, 255))
        draw.point((cx+1, cy), fill=(255, 240, 100, 255))
        draw.point((cx, cy-1), fill=(255, 240, 100, 255))
        draw.point((cx, cy+1), fill=(255, 240, 100, 255))


def shirt_rainbow(draw):
    """무지개 옷 — 가로 줄무늬 7색."""
    poly = [(10, 11), (21, 11), (24, 23), (7, 23)]
    draw.polygon(poly, fill=(255, 255, 255, 255), outline=(40, 40, 40, 255))
    colors = [
        (255, 90, 90, 255),
        (255, 160, 70, 255),
        (240, 220, 70, 255),
        (90, 200, 90, 255),
        (90, 150, 240, 255),
        (140, 90, 200, 255),
    ]
    for i, c in enumerate(colors):
        y = 12 + i * 2
        if y < 23:
            draw.line((9 - (y - 12) // 4, y, 22 + (y - 12) // 4, y), fill=c)
    neck = [(13, 11), (15, 14), (18, 11)]
    draw.polygon(neck, fill=(0, 0, 0, 0))


def cardigan_brown(draw):
    """카디건 — 베이지 + 단추."""
    base_shirt(draw, (210, 180, 130, 255))
    # 단추
    for y in [14, 17, 20]:
        draw.point((15, y), fill=(80, 60, 40, 255))
        draw.point((16, y), fill=(80, 60, 40, 255))
    # 가운데 세로 라인 (앞섶)
    draw.line((15, 12, 15, 22), fill=(150, 120, 80, 255))


def jacket_field(draw):
    """야상 자켓 (카키)."""
    base_shirt(draw, (110, 130, 80, 255))
    # 가슴 양쪽 주머니
    draw.rectangle((10, 16, 13, 19), outline=(60, 70, 40, 255))
    draw.rectangle((18, 16, 21, 19), outline=(60, 70, 40, 255))
    # 지퍼
    draw.line((15, 13, 15, 22), fill=(200, 200, 200, 255))


CLOTHES_FUNCS = [
    shirt_red, shirt_hoodie_blue, shirt_yellow, shirt_pink_dress, sweater_green,
    shirt_stripe, shirt_star, shirt_rainbow, cardigan_brown, jacket_field,
]


def main():
    for i, fn in enumerate(CLOTHES_FUNCS, 1):
        img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        fn(draw)
        path = os.path.join(OUT, f'clothes_{i:02d}.png')
        img.save(path)
        print('wrote', path)


if __name__ == '__main__':
    main()
