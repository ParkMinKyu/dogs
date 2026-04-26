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
    """기본 셔츠 형태 — 32×32 박스를 거의 가득 채움 (28×28 영역).
    어깨 (4,4), 허리 (28,30) 근처. 소매 양쪽 큼직.
    """
    # 몸통 사다리꼴 (위는 약간 좁고, 아래는 넓음)
    poly = [(7, 4), (24, 4), (29, 29), (2, 29)]
    draw.polygon(poly, fill=body_color, outline=(40, 40, 40, 255))
    # 목 V (옷 위쪽 V자)
    neck = [(11, 4), (15, 11), (20, 4)]
    draw.polygon(neck, fill=(0, 0, 0, 0))
    # 소매 양쪽 (어깨 큼직)
    draw.rectangle((2, 4, 6, 14), fill=body_color, outline=(40, 40, 40, 255))
    draw.rectangle((25, 4, 29, 14), fill=body_color, outline=(40, 40, 40, 255))
    if accent:
        # accent: 가슴 가로 줄 (3 줄)
        for y in (16, 19, 22):
            draw.line((5, y, 26, y), fill=accent)


def shirt_red(draw):
    base_shirt(draw, (220, 60, 60, 255))


def shirt_hoodie_blue(draw):
    base_shirt(draw, (60, 110, 200, 255))
    # 후드 (어깨 위)
    draw.polygon([(8, 0), (23, 0), (24, 6), (7, 6)],
                 fill=(40, 80, 160, 255), outline=(40, 40, 40, 255))


def shirt_yellow(draw):
    base_shirt(draw, (240, 210, 60, 255), accent=(180, 140, 30, 255))


def shirt_pink_dress(draw):
    """원피스 — 아래 더 넓음."""
    body = (240, 130, 180, 255)
    poly = [(7, 4), (24, 4), (31, 31), (0, 31)]
    draw.polygon(poly, fill=body, outline=(40, 40, 40, 255))
    neck = [(11, 4), (15, 11), (20, 4)]
    draw.polygon(neck, fill=(0, 0, 0, 0))
    # 허리 라인
    draw.line((4, 22, 27, 22), fill=(255, 200, 220, 255))
    # 소매
    draw.rectangle((2, 4, 6, 14), fill=body, outline=(40, 40, 40, 255))
    draw.rectangle((25, 4, 29, 14), fill=body, outline=(40, 40, 40, 255))


def sweater_green(draw):
    base_shirt(draw, (90, 170, 90, 255))
    # 점박 무늬
    for (x, y) in [(8, 16), (15, 16), (22, 16), (10, 22), (18, 22), (24, 22)]:
        draw.rectangle((x, y, x+1, y+1), fill=(60, 120, 60, 255))


def shirt_stripe(draw):
    """줄무늬 티 (흰 + 파랑)."""
    base_shirt(draw, (240, 240, 250, 255))
    for y in range(8, 28, 3):
        draw.line((4, y, 27, y), fill=(60, 110, 200, 255))


def shirt_star(draw):
    """별 패턴."""
    base_shirt(draw, (140, 80, 200, 255))
    # 작은 별들 (점 십자)
    for (cx, cy) in [(9, 14), (20, 14), (15, 18), (10, 23), (22, 23)]:
        draw.point((cx, cy), fill=(255, 240, 100, 255))
        draw.point((cx-1, cy), fill=(255, 240, 100, 255))
        draw.point((cx+1, cy), fill=(255, 240, 100, 255))
        draw.point((cx, cy-1), fill=(255, 240, 100, 255))
        draw.point((cx, cy+1), fill=(255, 240, 100, 255))


def shirt_rainbow(draw):
    """무지개 옷 — 가로 줄무늬 6색."""
    poly = [(7, 4), (24, 4), (29, 29), (2, 29)]
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
        y = 6 + i * 4
        if y < 29:
            draw.line((4, y, 27, y), fill=c)
            draw.line((4, y+1, 27, y+1), fill=c)
    neck = [(11, 4), (15, 11), (20, 4)]
    draw.polygon(neck, fill=(0, 0, 0, 0))
    # 소매
    draw.rectangle((2, 4, 6, 14), fill=(255, 255, 255, 255), outline=(40, 40, 40, 255))
    draw.rectangle((25, 4, 29, 14), fill=(255, 255, 255, 255), outline=(40, 40, 40, 255))


def cardigan_brown(draw):
    """카디건 — 베이지 + 단추."""
    base_shirt(draw, (210, 180, 130, 255))
    # 단추 4개 (세로)
    for y in [13, 17, 21, 25]:
        draw.rectangle((14, y, 16, y+1), fill=(80, 60, 40, 255))
    # 가운데 세로 라인 (앞섶)
    draw.line((15, 6, 15, 28), fill=(150, 120, 80, 255))


def jacket_field(draw):
    """야상 자켓 (카키)."""
    base_shirt(draw, (110, 130, 80, 255))
    # 가슴 양쪽 주머니 큼직
    draw.rectangle((6, 14, 12, 20), outline=(60, 70, 40, 255))
    draw.rectangle((19, 14, 25, 20), outline=(60, 70, 40, 255))
    # 지퍼
    draw.line((15, 6, 15, 28), fill=(200, 200, 200, 255))


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
