"""
방 장식 / 가구 / mess / 산책 아이템 픽셀아트 스프라이트 생성
출력: assets/items/{id}.png  (32×32 RGBA)
"""
from PIL import Image, ImageDraw
import os, math

SIZE = 32
OUT = os.path.join(os.path.dirname(__file__), 'items')
os.makedirs(OUT, exist_ok=True)

def new():
    return Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))

def save(img, name):
    img.save(os.path.join(OUT, f'{name}.png'))

# ── 공통 색상 ──────────────────────────────────────────────
W      = (255, 255, 255, 255)
BLK    = (40,  40,  40,  255)

BONE_L = (238, 226, 185, 255)
BONE_D = (185, 168, 120, 255)

PINK_L = (255, 182, 200, 255)
PINK_D = (220, 120, 150, 255)

YEL    = (255, 215, 50,  255)
YEL_D  = (200, 160, 20,  255)

BLU_L  = (140, 185, 255, 255)
BLU_M  = (90,  140, 240, 255)
BLU_D  = (50,  90,  200, 255)

RED    = (220, 65,  65,  255)
RED_D  = (165, 30,  30,  255)

GRN_L  = (110, 210, 100, 255)
GRN_M  = (60,  165, 55,  255)
GRN_D  = (35,  110, 35,  255)
YLWGRN = (160, 220, 65,  255)

BRWN_L = (175, 118, 65,  255)
BRWN_M = (130, 80,  30,  255)
BRWN_D = (90,  50,  15,  255)

ORG    = (235, 125, 45,  255)
ORG_D  = (185, 85,  20,  255)

PRP    = (165, 85,  215, 255)
PRP_D  = (115, 45,  165, 255)

GRY_L  = (205, 205, 215, 255)
GRY_M  = (150, 150, 165, 255)
GRY_D  = (95,  95,  110, 255)

CYAN   = (85,  215, 225, 255)
CYAN_D = (45,  165, 180, 255)

CREAM  = (255, 248, 215, 255)
POT_L  = (205, 105, 65,  255)
POT_D  = (155, 65,  35,  255)

POOP_L = (125, 72,  32,  255)
POOP_D = (80,  42,  12,  255)
PEE_L  = (255, 240, 100, 210)
PEE_D  = (215, 198, 48,  210)


# ── 장식 아이템 ────────────────────────────────────────────

def draw_bone():
    img = new(); d = ImageDraw.Draw(img)
    d.rectangle([10, 13, 22, 19], fill=BONE_L)
    for cx, cy in [(9, 12), (9, 20), (23, 12), (23, 20)]:
        d.ellipse([cx-5, cy-4, cx+5, cy+4], fill=BONE_L, outline=BONE_D)
    d.rectangle([10, 13, 22, 19], fill=BONE_L, outline=BONE_D)
    save(img, 'bone')

def draw_flower():
    img = new(); d = ImageDraw.Draw(img)
    cx, cy = 16, 17
    for i in range(5):
        a = math.radians(i * 72 - 90)
        px = int(cx + 7 * math.cos(a)); py = int(cy + 7 * math.sin(a))
        d.ellipse([px-5, py-5, px+5, py+5], fill=PINK_L, outline=PINK_D)
    d.ellipse([12, 13, 20, 21], fill=YEL, outline=YEL_D)
    # 잎
    d.ellipse([5, 20, 13, 28], fill=GRN_L, outline=GRN_M)
    save(img, 'flower')

def draw_butter():
    img = new(); d = ImageDraw.Draw(img)
    # 날개 (상)
    d.ellipse([2,  4, 15, 17], fill=PRP,   outline=PRP_D)
    d.ellipse([17, 4, 30, 17], fill=PRP,   outline=PRP_D)
    # 날개 (하)
    d.ellipse([3, 16, 14, 27], fill=ORG,   outline=ORG_D)
    d.ellipse([18, 16, 29, 27], fill=ORG,  outline=ORG_D)
    # 날개 문양
    d.ellipse([5,  7, 11, 13], fill=YEL,   outline=YEL_D)
    d.ellipse([21, 7, 27, 13], fill=YEL,   outline=YEL_D)
    # 몸통
    d.ellipse([14, 8, 18, 24], fill=BLK)
    # 더듬이
    d.line([16, 8, 12, 3], fill=BLK, width=1)
    d.line([16, 8, 20, 3], fill=BLK, width=1)
    d.ellipse([10, 1, 14, 5], fill=BLK)
    d.ellipse([18, 1, 22, 5], fill=BLK)
    save(img, 'butter')

def draw_bird():
    img = new(); d = ImageDraw.Draw(img)
    # 몸통
    d.ellipse([6, 12, 26, 25], fill=CYAN,  outline=CYAN_D)
    # 머리
    d.ellipse([17, 5, 30, 17], fill=CYAN,  outline=CYAN_D)
    # 날개
    d.ellipse([7, 15, 19, 23], fill=CYAN_D)
    # 꼬리
    d.polygon([(6, 19), (1, 24), (6, 24)], fill=CYAN_D)
    # 부리
    d.polygon([(29, 10), (31, 12), (29, 14)], fill=YEL)
    # 눈
    d.ellipse([22, 7, 27, 12], fill=W)
    d.ellipse([23, 8, 26, 11], fill=BLK)
    d.ellipse([23, 8, 25, 10], fill=W)
    save(img, 'bird')

def draw_balloon():
    img = new(); d = ImageDraw.Draw(img)
    d.ellipse([5, 2, 27, 22], fill=RED,    outline=RED_D)
    # 하이라이트
    d.ellipse([8, 5, 15, 11], fill=(255, 130, 130, 160))
    # 매듭
    d.ellipse([13, 21, 19, 26], fill=RED_D)
    # 실
    d.line([16, 26, 13, 31], fill=GRY_M, width=1)
    save(img, 'balloon')

def draw_star():
    img = new(); d = ImageDraw.Draw(img)
    cx, cy = 16, 16
    pts = []
    for i in range(10):
        r = 13 if i % 2 == 0 else 6
        a = math.radians(i * 36 - 90)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    d.polygon(pts, fill=YEL, outline=YEL_D)
    save(img, 'star')

def draw_gem():
    img = new(); d = ImageDraw.Draw(img)
    # 상단 패싯
    d.polygon([(16, 3), (6, 12), (16, 12)],  fill=BLU_L)
    d.polygon([(16, 3), (26, 12), (16, 12)], fill=BLU_M)
    # 하단
    d.polygon([(6, 12), (16, 30), (26, 12)], fill=BLU_D)
    # 상단 모서리 선
    d.polygon([(16, 3), (6, 12), (26, 12)],  outline=BLU_L, fill=None)
    # 하이라이트
    d.polygon([(10, 12), (16, 8), (16, 12)], fill=(200, 225, 255, 180))
    save(img, 'gem')

def draw_gift():
    img = new(); d = ImageDraw.Draw(img)
    # 박스
    d.rectangle([4, 14, 28, 28], fill=RED,   outline=RED_D)
    # 뚜껑
    d.rectangle([4, 10, 28, 14], fill=RED_D, outline=RED_D)
    # 리본 세로
    d.rectangle([14, 10, 18, 28], fill=YEL)
    # 리본 가로
    d.rectangle([4,  14, 28, 18], fill=YEL)
    # 리본 활 (좌)
    d.ellipse([5, 4, 14, 12], fill=YEL, outline=YEL_D)
    # 리본 활 (우)
    d.ellipse([18, 4, 27, 12], fill=YEL, outline=YEL_D)
    # 활 중심
    d.ellipse([13, 7, 19, 13], fill=YEL_D)
    save(img, 'gift')


# ── 가구 ──────────────────────────────────────────────────

def draw_sofa():
    img = new(); d = ImageDraw.Draw(img)
    # 방석
    d.rectangle([5, 17, 27, 24], fill=ORG,   outline=ORG_D)
    # 등받이
    d.rectangle([5,  9, 27, 17], fill=ORG_D, outline=ORG_D)
    # 좌 팔걸이
    d.rectangle([2, 14, 6,  24], fill=ORG_D, outline=ORG_D)
    # 우 팔걸이
    d.rectangle([26, 14, 30, 24], fill=ORG_D, outline=ORG_D)
    # 쿠션
    d.rectangle([7, 17, 16, 22], fill=(245, 148, 58, 255), outline=ORG_D)
    d.rectangle([17, 17, 26, 22], fill=(245, 148, 58, 255), outline=ORG_D)
    # 다리
    d.rectangle([5,  24, 8,  29], fill=BRWN_M)
    d.rectangle([24, 24, 27, 29], fill=BRWN_M)
    save(img, 'sofa')

def draw_bed():
    img = new(); d = ImageDraw.Draw(img)
    # 헤드보드
    d.rectangle([3, 7, 29, 14], fill=BRWN_M, outline=BRWN_D)
    # 프레임
    d.rectangle([3, 14, 29, 27], fill=BRWN_L, outline=BRWN_M)
    # 이불
    d.rectangle([5, 16, 27, 25], fill=(155, 205, 255, 255), outline=(100, 160, 220, 255))
    # 베개
    d.rectangle([6, 14, 16, 18], fill=W, outline=GRY_L)
    # 이불 줄무늬
    for x in range(7, 27, 4):
        d.line([x, 16, x, 25], fill=(120, 175, 230, 180), width=1)
    # 다리
    d.rectangle([4,  27, 7,  31], fill=BRWN_D)
    d.rectangle([25, 27, 28, 31], fill=BRWN_D)
    save(img, 'bed')

def draw_plant():
    img = new(); d = ImageDraw.Draw(img)
    # 화분
    d.polygon([(9, 22), (23, 22), (21, 30), (11, 30)], fill=POT_L, outline=POT_D)
    d.rectangle([7, 19, 25, 23], fill=POT_D, outline=POT_D)
    # 줄기
    d.rectangle([15, 13, 17, 22], fill=GRN_D)
    # 잎
    d.ellipse([5,  6, 17, 18], fill=GRN_L,  outline=GRN_M)
    d.ellipse([15, 8, 27, 20], fill=GRN_L,  outline=GRN_M)
    d.ellipse([9,  3, 22, 15], fill=YLWGRN, outline=GRN_M)
    save(img, 'plant')

def draw_chair():
    img = new(); d = ImageDraw.Draw(img)
    # 등받이
    d.rectangle([7, 8, 25, 14], fill=BRWN_L, outline=BRWN_M)
    # 뒷다리
    d.rectangle([7,  10, 10, 29], fill=BRWN_M, outline=BRWN_D)
    d.rectangle([22, 10, 25, 29], fill=BRWN_M, outline=BRWN_D)
    # 좌석
    d.rectangle([5, 16, 27, 20], fill=BRWN_L, outline=BRWN_M)
    # 앞다리
    d.rectangle([6,  20, 9,  29], fill=BRWN_M)
    d.rectangle([23, 20, 26, 29], fill=BRWN_M)
    save(img, 'chair')

def draw_mirror():
    img = new(); d = ImageDraw.Draw(img)
    # 프레임
    d.ellipse([3, 2, 29, 26], fill=BRWN_L,  outline=BRWN_M)
    # 거울면
    d.ellipse([6, 5, 26, 23], fill=(205, 235, 255, 255), outline=GRY_L)
    # 하이라이트
    d.ellipse([8, 7, 14, 13], fill=(240, 252, 255, 180))
    # 받침대
    d.rectangle([13, 26, 19, 30], fill=BRWN_M)
    d.rectangle([9,  29, 23, 32], fill=BRWN_M, outline=BRWN_D)
    save(img, 'mirror')

def draw_picture():
    img = new(); d = ImageDraw.Draw(img)
    # 외부 프레임
    d.rectangle([3, 4, 29, 26], fill=BRWN_L, outline=BRWN_M)
    # 내부 그림 영역
    d.rectangle([6, 7, 26, 23], fill=W)
    # 그림 — 단순 풍경
    d.rectangle([6, 16, 26, 23], fill=GRN_L)          # 들판
    d.rectangle([6,  7, 26, 16], fill=(160, 210, 255, 255))  # 하늘
    d.ellipse([8, 8, 18, 16],   fill=(255, 245, 130, 255))   # 태양
    d.polygon([(19, 7), (24, 16), (14, 16)], fill=W)         # 구름/산
    save(img, 'picture')

def draw_tv():
    img = new(); d = ImageDraw.Draw(img)
    # 본체
    d.rectangle([3, 4, 29, 23], fill=GRY_M,  outline=GRY_D)
    # 화면
    d.rectangle([6, 7, 26, 20], fill=(35, 35, 70, 255))
    # 화면 빛
    d.rectangle([7, 8, 25, 19], fill=(75, 115, 200, 200))
    d.rectangle([7, 8, 14, 13], fill=(120, 160, 230, 160))
    # 받침
    d.rectangle([12, 23, 20, 27], fill=GRY_M)
    d.rectangle([8,  27, 24, 30], fill=GRY_M, outline=GRY_D)
    # 전원 버튼
    d.ellipse([25, 13, 28, 16], fill=RED)
    save(img, 'tv')

def draw_bookshelf():
    img = new(); d = ImageDraw.Draw(img)
    # 선반 프레임
    d.rectangle([3, 4, 29, 29], fill=BRWN_L, outline=BRWN_M)
    # 선반 판
    d.rectangle([3, 14, 29, 16], fill=BRWN_M)
    d.rectangle([3, 22, 29, 24], fill=BRWN_M)
    # 책 (상단)
    books_top = [RED, BLU_D, GRN_M, YEL_D, PRP, ORG]
    for i, c in enumerate(books_top):
        x = 4 + i * 4
        d.rectangle([x, 5, x+3, 14], fill=c)
    # 책 (중간)
    books_mid = [GRN_D, YEL, RED_D, BLU_L, ORG_D, PRP_D]
    for i, c in enumerate(books_mid):
        x = 4 + i * 4
        d.rectangle([x, 16, x+3, 22], fill=c)
    # 책 (하단, 살짝 다양한 너비)
    books_bot = [(RED,4,7),(BLU_M,8,11),(YEL_D,13,15),(GRN_L,17,20),(PRP,22,25)]
    for c, x0, x1 in books_bot:
        d.rectangle([x0, 24, x1, 29], fill=c)
    save(img, 'bookshelf')

def draw_lamp():
    img = new(); d = ImageDraw.Draw(img)
    # 받침
    d.rectangle([9, 27, 23, 30], fill=GRY_M, outline=GRY_D)
    # 기둥
    d.rectangle([14, 16, 18, 27], fill=GRY_M)
    # 갓
    d.polygon([(8, 16), (24, 16), (21, 8), (11, 8)], fill=YEL, outline=YEL_D)
    # 빛 후광
    d.ellipse([11, 4, 21, 12], fill=(255, 240, 150, 160))
    # 전구
    d.ellipse([13, 9, 19, 15], fill=(255, 252, 200, 255))
    save(img, 'lamp')


# ── 똥 / 오줌 ──────────────────────────────────────────────

def draw_poop():
    img = new(); d = ImageDraw.Draw(img)
    # 층층이 쌓인 모양
    d.ellipse([6,  20, 26, 28], fill=POOP_L, outline=POOP_D)
    d.ellipse([8,  15, 24, 23], fill=POOP_L, outline=POOP_D)
    d.ellipse([10, 10, 22, 18], fill=POOP_L, outline=POOP_D)
    d.ellipse([12,  6, 20, 13], fill=POOP_L, outline=POOP_D)
    # 얼굴
    d.ellipse([12,  8, 15, 11], fill=W)
    d.ellipse([17,  8, 20, 11], fill=W)
    d.ellipse([12,  9, 14, 11], fill=BLK)
    d.ellipse([17,  9, 19, 11], fill=BLK)
    d.arc([13, 10, 19, 14], 10, 170, fill=BLK, width=1)
    # 반짝이
    d.text if False else None
    for px, py in [(7, 19), (25, 21), (16, 5)]:
        d.line([px-1, py, px+1, py], fill=YEL)
        d.line([px, py-1, px, py+1], fill=YEL)
    save(img, 'poop')

def draw_pee():
    img = new(); d = ImageDraw.Draw(img)
    # 물웅덩이
    d.ellipse([3, 19, 29, 29], fill=PEE_L,  outline=PEE_D)
    d.ellipse([7, 21, 25, 28], fill=PEE_L)
    # 방울들
    d.polygon([(14, 4), (12, 14), (16, 14)], fill=PEE_L, outline=PEE_D)
    d.polygon([(20, 8), (18, 16), (22, 16)], fill=PEE_L, outline=PEE_D)
    d.polygon([(10, 11), (8, 18), (12, 18)], fill=PEE_L, outline=PEE_D)
    save(img, 'pee')


# ── 산책 특수 아이템 ───────────────────────────────────────

def draw_wp_roll():
    """벽지 두루마리"""
    img = new(); d = ImageDraw.Draw(img)
    # 두루마리 몸통
    d.rectangle([6, 9, 26, 23], fill=CREAM, outline=BRWN_L)
    # 원통 끝
    d.ellipse([4,  9, 10, 23], fill=(245, 238, 200, 255), outline=BRWN_L)
    d.ellipse([22, 9, 28, 23], fill=(245, 238, 200, 255), outline=BRWN_L)
    # 패턴 (꽃무늬)
    for ry in [13, 19]:
        for rx in [11, 16, 21]:
            d.ellipse([rx-2, ry-2, rx+2, ry+2], fill=PINK_L)
    # 붓
    d.rectangle([23, 3, 26, 20], fill=BRWN_L, outline=BRWN_M)
    d.polygon([(23, 20), (26, 20), (25, 27), (24, 27)], fill=YEL)
    save(img, 'wp_roll')

def draw_fl_roll():
    """바닥재 샘플"""
    img = new(); d = ImageDraw.Draw(img)
    # 보드 배경
    d.rectangle([3, 5, 28, 28], fill=(220, 208, 188, 255), outline=BRWN_L)
    # 타일 격자 (4×4)
    tile_colors = [
        (BRWN_L, BRWN_M),
        (BRWN_M, BRWN_L),
    ]
    tw, th = 6, 5
    for row in range(4):
        for col in range(4):
            x0 = 4 + col * tw
            y0 = 6 + row * th
            c = tile_colors[(row + col) % 2][0]
            d.rectangle([x0, y0, x0+tw-1, y0+th-1], fill=c, outline=BRWN_D)
    # 태그
    d.rectangle([22, 2, 29, 9], fill=RED,  outline=RED_D)
    d.rectangle([24, 0, 27, 3], fill=W,    outline=GRY_L)
    save(img, 'fl_roll')


# ── 실행 ──────────────────────────────────────────────────
if __name__ == '__main__':
    fns = [
        draw_bone, draw_flower, draw_butter, draw_bird,
        draw_balloon, draw_star, draw_gem, draw_gift,
        draw_sofa, draw_bed, draw_plant, draw_chair,
        draw_mirror, draw_picture, draw_tv, draw_bookshelf, draw_lamp,
        draw_poop, draw_pee,
        draw_wp_roll, draw_fl_roll,
    ]
    for fn in fns:
        fn()
    files = sorted(os.listdir(OUT))
    print(f"생성 완료: {len(files)}개 → {OUT}/")
    for f in files:
        print(f"  {f}")
