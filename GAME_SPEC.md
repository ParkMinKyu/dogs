# 우리 강아지 — 게임 스펙 문서

> 소스 코드 직독 기준 / 작성일: 2026-04-26 (최종 동기화: 2026-04-29)  
> 버전: `manifest.json` → `17.2.0-beta` / 캐시 키: `dogs-v2-v206`

---

## 1. 게임 개요

| 항목 | 내용 |
|---|---|
| **장르** | 다마고치 스타일 펫 케어 (어린이 대상) |
| **플랫폼** | PWA (Progressive Web App), 모바일 세로 우선 |
| **언어** | 한국어 |
| **상태 저장** | `localStorage` (`dogs.p0.state.v1` 키) |
| **기본 정책** | 강아지 절대 안 죽음 — 게이지 0이어도 가출(game over)까지 최소 15분 유예 |

### 주요 파일 구성

| 파일 | 역할 |
|---|---|
| `index.html` | 앱 셸, 게이지 버튼 4개, 헤더, 무대(stage) 구조 |
| `style.css` | 파스텔 테마, 종별 CSS filter, TOD(시간대) 창문 효과, 원형 게이지, 모달 등 |
| `game.js` | 전체 게임 로직 (단일 IIFE, ~4200줄) |
| `sw.js` | Service Worker — offline-first cache |
| `manifest.json` | PWA 메타데이터 (아이콘 256/512px) |

---

## 2. 게이지 시스템

### 게이지 4종

| 키 | 표시명 | 아이콘 | 기본값 |
|---|---|---|---|
| `hunger` | 먹이 | 🍖 | 80 |
| `happy` | 놀이 | 💖 | 80 |
| `clean` | 씻기 | 🫧 | 80 |
| `energy` | 재우기 | ⚡ | 80 |

### 감소 규칙

- **주기**: 30초(`TICK_MS`)마다 **−5**(`DECAY_PER_TICK`) 일괄 감소
- **오프라인 캐치업**: 최대 4시간 분량만 소급 적용 (밤새 방치해도 극단 상황 방지)
- **청결 특이 규칙**: 방(mess)이 있을 때 `clean` 추가 감소 (`messes.length × 2`)
- **아플 때**: `happy` 추가 −2/tick

### 색상 표시

| 퍼센트 | 색 |
|---|---|
| 70 이상 | 게이지별 고유색 (hunger=빨, happy=파, clean=초록, energy=노랑) |
| 40–69 | 노랑/오렌지 `hsl(45,90%,55%)` |
| 20–39 | 오렌지 `hsl(20,90%,55%)` |
| 0–19 | 빨강 `hsl(0,75%,50%)` — **critical pulse 애니메이션** |

### `ACTION_EFFECT` — 액션별 게이지 트레이드오프

| 액션 | hunger | happy | clean | energy |
|---|---|---|---|---|
| `feed` (먹이) | **+50** | +5 | **−15** | 0 |
| `play` (놀이) | −10 | **+35** | −10 | **−15** |
| `wash` (씻기) | 0 | −10 | **0**(드래그 누적) | −5 |
| `sleep` (재우기) | −15 | +5 | 0 | **+60** |

> **주의**: wash는 `ACTION_EFFECT.wash.clean = 0`이지만 실제 청결 회복은 드래그 누적 거리로 별도 계산됨 (30px당 +1). `finishBusy` 호출 시 트레이드오프(`happy −10`, `energy −5`)만 적용.  
> **야간 보너스**: `sleep` 액션이 밤(`tod === 'night'`)에 수행되면 `energy +15` 추가.

---

## 3. 액션 시스템

### 4개 기본 액션

| 액션 ID | 버튼 라벨 | 진행 방식 | 지속시간 | 시작 말풍선 | 완료 말풍선 |
|---|---|---|---|---|---|
| `feed` | 먹이 | Busy (타이머) | **5초** | 냠냠... 맛있어요! 🍖 | 배불러요~ 🍖 |
| `play_menu` | 놀이 | 즉시 → 놀이 메뉴 열기 | — | — | — |
| `wash` | 씻기 | Busy (무제한, 청결 100% 도달 또는 수동 종료) | 무제한 | 뽀득뽀득 씻겨주세요~ 🫧 | — |
| `sleep` | 재우기 | Busy (타이머) | **8초** | 쿨쿨... 잘게요 💤 | 잘 잤어요! ⚡ |

### 씻기 인터랙션

- 무대 영역에서 **드래그(포인터/터치)**로 강아지 문지르기
- 누적 거리 **30px당 clean +1**
- 청결 100% 도달 시 자동 종료 + 팡파레 + 14개 컨페티 이펙트

### 액션 prop (소품) 매핑

| 액션 | prop 종류 |
|---|---|
| `feed` | 밥그릇 (`.prop-bowl`) |
| `wash` | 욕조 (`.prop-bathtub`) |
| `sleep` | 쿠션 (`.prop-cushion`) |

### 거부/차단 로직

1. 아픈 상태(`state.sick`)이면 모든 액션 차단 → `🤒 아파서 못 해요... 병원에 데려가 주세요!`
2. 게이지 ≤20% 인 것이 있으면, 해당 게이지를 회복하는 액션만 허용 (나머지 dim 처리)  
   - sleep은 예외 — 항상 허용
3. 해당 게이지가 이미 100%이면 "이미 충분해요" 메시지

### 말풍선 이모지 (`ACTION_BUBBLE`)

| 액션 | 이모지 |
|---|---|
| feed | 🍖 |
| play | 💖 |
| wash | ✨ |
| sleep | 💤 |

---

## 4. 펫 시스템

### 종(breed) 목록

| ID | 이름 | 설명 | species |
|---|---|---|---|
| `shiba` | 강아지 | 귀여운 친구 | dog |
| `cat_yellow` | 노랑이 | 햇살 같은 | cat |
| `cat_black` | 까망이 | 신비로운 | cat |
| `cat_gray` | 회색냥 | 고급스러운 | cat |
| `rabbit_white` | 흰토끼 | 폭신폭신 | rabbit |
| `rabbit_brown` | 갈토끼 | 네덜란드 | rabbit |
| `hamster` | 햄찌 | 귀여운 작은 친구 | hamster |

> `maltese`, `poodle`, `husky`는 `RETIRED_BREEDS`로 비활성 처리 — 선택 시 자동으로 `shiba`로 교체됨.  
> 색감은 CSS `filter: hue-rotate / saturate / brightness`로 구현 — 동일 스프라이트 재사용.

### 성장 단계

```js
const STAGES = [
  { id: 'puppy', label: '아기',   threshold: 0   },
  { id: 'teen',  label: '청소년', threshold: 180 },
  { id: 'adult', label: '어른',   threshold: 900 },
];
```

> **현재 진화 비활성화** — `stageForCare()` 함수가 항상 `'puppy'`를 반환. care 점수는 쌓이지만 외관 변화 없음. 차후 함수 원복으로 재활성화 가능.  
> 스프라이트 경로: `assets/{stage}/{mood}.png` (puppy/teen/adult × idle/happy/eating/sad/sleeping)

### 케어 점수 적립 (진화 점수)

- 액션 1회당 최대 +1점 (12초 쿨타임 `CARE_TICK_MS`)
- 분당 최대 5점 (도배 클릭 방지)

### 멀티 펫

- 최대 **4마리** (`MAX_PETS = PET_UNLOCK.length`)
- 해금 조건: 누적 케어포인트 기준 (`PET_UNLOCK = [0, 1000, 5000, 15000]`)
- 펫 전환: 헤더 아바타 버튼 → 펫 선택 그리드
- 각 펫마다 독립된 필드: 게이지, 이름, 종, 방 인테리어, 장비, 미션 진행, 위치 등
- 비활성 펫도 시간 경과(decay)가 동시에 진행됨

---

## 5. 방 꾸미기

### 진입 방법

헤더 케어포인트 배지 탭 → 케어 메뉴 → **방 꾸미기** 버튼 → 편집 모드 토글

### 편집 탭 4종

| 탭 ID | 탭 라벨 | 내용 |
|---|---|---|
| `deco` | 🌟 장식 | 수집한 장식품 배치 |
| `furn` | 🛋️ 가구 | 수집한 가구 배치 |
| `wallpaper` | 🎨 벽지 | 벽지 선택 (즉시 적용) |
| `floor` | 🟫 바닥 | 바닥재 선택 (즉시 적용) |

### 장식 아이템 (`ROOM_ITEMS`)

| ID | 이모지 | 이름 | 레이어 |
|---|---|---|---|
| `bone` | 🦴 | 뼈다귀 | 바닥(back) |
| `flower` | 🌸 | 꽃 | 바닥(back) |
| `gem` | 💎 | 보석 | 바닥(back) |
| `gift` | 🎁 | 선물 | 바닥(back) |
| `butter` | 🦋 | 나비 | 전경(front) |
| `bird` | 🐦 | 새 | 전경(front) |
| `balloon` | 🎈 | 풍선 | 전경(front) |
| `star` | ⭐ | 별 | 전경(front) |

### 가구 (`FURNITURE`)

| ID | 이모지 | 이름 |
|---|---|---|
| `sofa` | 🛋️ | 소파 |
| `bed` | 🛏️ | 침대 |
| `plant` | 🪴 | 화분 |
| `chair` | 🪑 | 의자 |
| `mirror` | 🪞 | 거울 |
| `picture` | 🖼️ | 액자 |
| `tv` | 📺 | TV |
| `bookshelf` | 📚 | 책장 |
| `lamp` | 🪔 | 등불 |

### 벽지 (`WALLPAPERS`)

| ID | 이름 |
|---|---|
| `default` | 기본 베이지 (기본 보유) |
| `pink_dot` | 분홍 도트 |
| `blue_stripe` | 하늘 줄무늬 |
| `star_pattern` | 별달 패턴 |
| `bear` | 곰돌이 패턴 |
| `rainbow` | 무지개 |

### 바닥 (`FLOORS`)

| ID | 이름 |
|---|---|
| `default` | 장판 (기본 보유) |
| `wood` | 나무 마루 |
| `carpet_red` | 빨강 카펫 |
| `carpet_blue` | 파랑 카펫 |
| `wool` | 양털 카펫 |
| `tile` | 격자 타일 |

> 벽지/바닥 기본형 외에는 산책 미니게임에서 획득 (`wp_roll`, `fl_roll`, `gift` 아이템).

### 배치/크기 조절 기능

- 아이템 **드래그**로 자유 위치 이동 (무대 좌표 0~100%)
- 아이템 탭 → 툴바 출현 → **－ / ＋** 버튼으로 크기 0.5× ~ 3× (0.25 단위)
- **🗑️** 버튼으로 인벤토리로 회수
- Y 좌표 기반 **depth sort** (z-index 자동 조정, 강아지와 레이어 순서 자연스럽게 처리)

---

## 6. 놀이 메뉴 및 미니게임

### 놀이 목록 (`PLAY_GAMES`)

| ID | 이름 | 이모지 | 설명 |
|---|---|---|---|
| `ball` | 공놀이 | 🎾 | 공 머리로 받기 (30초) |
| `pet` | 풍선 터뜨리기 | 🎈 | 3초 안에 풍선 터뜨리기! (30초) |
| `dance` | 춤추기 | 🎵 | 박자 맞추기 (30초) |
| `treat` | 간식 받기 | 🦴 | 낙하 아이템 받기 (30초) |
| `seq` | 발자국 따라가기 | 🐾 | 순서대로 누르기 |
| `hide` | 숨바꼭질 | 🌳 | 숨은 강아지 찾기 (30초) |
| `match` | 짝 맞추기 | 🃏 | 같은 카드 찾기 (60초) |
| `bury` | 뼈 묻기 | ⛰️ | 묻은 뼈 위치 기억! |
| `walk` | 산책 | 🚶 | 횡스크롤 점프 아이템 수집 (30초) |

- 공통 **쿨타임**: 게임당 5분 (`MINIGAME_COOLDOWN_MS = 5 * 60 * 1000`)

---

### 공놀이 (ball) — 물리 시뮬레이션

| 파라미터 | 값 |
|---|---|
| `GRAVITY` | 700 px/s² |
| `BOUNCE_VY` | −560 (튕김 초속) |
| `BALL_R` | 26px |
| `DOG_HALF` | 50px (충돌 폭) |
| `COMBO_WINDOW_MS` | 1000ms |

**점수 체계**

| 콤보 | 배수 |
|---|---|
| 1 (단타) | ×1 |
| 2 | ×2 |
| 3–4 | ×3 |
| 5+ | ×5 |

**보상**

| 점수 | happyGain | careBoost | 메시지 |
|---|---|---|---|
| ≥25 | +50 | +3 | 최고! 🎉 |
| ≥15 | +35 | +2 | 잘했어요! |
| ≥5 | +25 | +1 | 좋아요! |
| <5 | +15 | 0 | 재밌었지? |

---

### 풍선 터뜨리기 (pet)

- 30초 동안 풍선이 순서대로 등장 — 각 풍선을 **3초 안에 탭**해야 함
- 시간 내 터뜨리면 콤보 누적, 놓치면 게임 종료

**보상**: ball 게임과 동일한 점수/happyGain 구조 적용

---

### 춤추기 (dance)

- 박자(800ms 주기)에 맞춰 탭 — **350ms 윈도우** 안에 탭 시 +5점
- 박자 밖 탭은 팝 사운드만 (점수 없음)

**보상**: `happyGain = 25 + min(20, score ÷ 5)`, points += score, careBoost +1

---

### 간식 받기 (treat)

- 위에서 떨어지는 🦴/🍪/🍖 를 강아지로 이동해서 받기 (물리: 중력 가속도 200 px/s²)

**보상**

| 개수 | happyGain | hungerGain | careBoost |
|---|---|---|---|
| ≥8 | +40 | +20 | +2 |
| ≥5 | +30 | +15 | +1 |
| ≥3 | +20 | +10 | +1 |
| <3 | +10 | +5 | 0 |

---

### 산책 (walk) — 횡스크롤 미니게임

**진입 조건**: `energy > 30` AND `hunger > 30`

**물리 파라미터**

| 파라미터 | 값 |
|---|---|
| `GRAVITY` | 1800 px/s² |
| `JUMP_VY` | `−sqrt(2 × GRAVITY × peakTarget)` (아레나 높이 20% 목표) |
| `ITEM_SPEED` | 아레나 너비의 약 77% px/s |
| `SCROLL_SPEED` | `ITEM_SPEED × 0.9` |

**아이템 카탈로그**

| Kind | 이모지 | 점수 | 가중치 | rare | 특수 효과 |
|---|---|---|---|---|---|
| `bone` | 🦴 | 5 | 30 | — | roomInv 추가 |
| `flower` | 🌸 | 3 | 22 | — | roomInv 추가 |
| `butter` | 🦋 | 5 | 14 | — | roomInv 추가 |
| `bird` | 🐦 | 5 | 10 | — | roomInv 추가 |
| `balloon` | 🎈 | 10 | 5 | ✓ | roomInv 추가 |
| `star` | ⭐ | 20 | 3 | ✓ | careBonus +1 |
| `gem` | 💎 | 30 | 1 | ✓ | careBonus +5 |
| `gift` | 🎁 | 15 | 2 | ✓ | 가구/벽지/바닥/액세서리 랜덤 |
| `furn_chair` | 🪑 | 25 | 0.5 | ✓ | furnitureInv `chair` 추가 |
| `furn_plant` | 🪴 | 25 | 0.5 | ✓ | furnitureInv `plant` 추가 |
| `furn_lamp` | 🪔 | 25 | 0.4 | ✓ | furnitureInv `lamp` 추가 |
| `wp_roll` | 🎨 | 30 | 0.3 | ✓ | 랜덤 미보유 벽지 해금 |
| `fl_roll` | 🟫 | 30 | 0.3 | ✓ | 랜덤 미보유 바닥 해금 |

> rare 아이템은 공중에 위치 — 점프 중에만 수집 가능.  
> 지면 아이템은 자동 수집 (X축 52px 범위 내 통과 시).

**산책 종료 게이지 변화**

| 게이지 | 변화 |
|---|---|
| happy | +40 |
| energy | −20 |
| hunger | −10 |
| clean | −15 |

---

## 7. 말풍선/메시지 시스템

### `showSpeech(text, durationMs)`

- 강아지 `puppyWrap` 안에 `.speech-bubble` div 동적 생성
- 기본 표시 시간: 3500ms
- 이전 말풍선 있으면 즉시 교체
- durationMs 후 fade 클래스 추가 → 250ms 후 DOM 제거

### `flashBubble(emoji)`

- `#bubble` 요소에 이모지 표시 + `show` 클래스 추가
- 1100ms 후 자동 제거
- 주로 액션 즉시 피드백(🍖💖✨💤), 청소(✨), 용변(💩💧), 미션 완료(🎉)에 사용

### 상태별 방랑 메시지 (`WANDER_MSGS`)

5~10초 랜덤 인터벌로 현재 강아지 상태에 따라 순환 출력 (각 20개):

| 상태 | 예시 메시지 |
|---|---|
| `idle` | 오늘 날씨 좋다~ 🌤️ / 심심하다... 뭐 없나? / 간식 생각나는데 🍖 등 |
| `happy` | 너무 행복해요! 💖 / 최고의 하루야! 🌟 / 왈왈! 신난다! 등 |
| `sad` | 왜 이렇게 슬프지... 😢 / 혼자 있기 싫어 😞 / 누군가 쓰다듬어줬으면... 등 |
| `eating` | 냠냠냠... 맛있어! 🍖 / 더 주면 안 돼요? 😋 등 |
| `sleeping` | 쿨쿨... 💤 / 꿈에서 뛰어놀고 있어 🐾 등 |

### 게이지 요청 메시지 (`REQ_DEFS`)

| 게이지 | soft 임계 | hard 임계 | 메시지 | 주기 |
|---|---|---|---|---|
| `hunger` | ≤50 | ≤20 | 🍖 배고파! | soft 30초 / hard 15초 |
| `happy` | ≤50 | ≤20 | 🎮 같이 놀자! | soft 30초 / hard 15초 |
| `clean` | ≤50 | ≤20 | 🛁 씻고 싶어... | soft 30초 / hard 15초 |
| `energy` | ≤30 | ≤20 | 💤 졸려... | soft 30초 / hard 15초 |

hard일 때 낑낑(`SOUNDS.whimper`), soft일 때 팡(`SOUNDS.bounce`) 사운드.

### 똥/오줌 청소 독촉 메시지

5개 중 랜덤, 10초마다 체크 (mess 있고 busy 아닐 때):

```
저기... 좀 치워줄 수 있어요? 💩
냄새나요... 빨리 치워주세요! 🥺
여기 더럽다고요!! 💦
똥 치워주세요... 🐾
냄새 너무 심해요 😭
```

---

## 8. 서비스 워커 / PWA

### 캐시 전략

| 요청 대상 | 전략 |
|---|---|
| **동일 출처** | **Cache-First** → 없으면 네트워크 fetch 후 캐시 저장 |
| **외부 출처** (폰트 등) | **Network-First** → 실패 시 캐시 폴백 |

- `install`: PRECACHE 목록 전체 캐싱 + `skipWaiting()`
- `activate`: 이전 버전 캐시(`dogs-v2-v206` 외) 모두 삭제 + `clients.claim()`

### 프리캐시 목록 (`PRECACHE`)

```
./ , index.html, style.css, game.js, manifest.json
assets/puppy/idle.png, happy.png, eating.png, sad.png, sleeping.png
assets/teen/idle.png, happy.png, eating.png, sad.png, sleeping.png
assets/adult/idle.png, happy.png, eating.png, sad.png, sleeping.png
assets/cat_yellow/idle.png, happy.png, eating.png, sad.png, sleeping.png
assets/cat_black/idle.png, happy.png, eating.png, sad.png, sleeping.png
assets/cat_gray/idle.png, happy.png, eating.png, sad.png, sleeping.png
assets/rabbit_white/idle.png, happy.png, eating.png, sad.png, sleeping.png
assets/rabbit_brown/idle.png, happy.png, eating.png, sad.png, sleeping.png
assets/hamster/idle.png, happy.png, eating.png, sad.png, sleeping.png
assets/breeds/shiba.png
assets/icons/icon-256.png, icon-512.png
```

총 **58개** 파일.

---

## 9. 케어포인트 / 상점

### 케어포인트(`state.points`) 적립

| 조건 | 적립량 |
|---|---|
| 기본 액션 1회 (feed/wash/sleep) | +1 |
| 공놀이 점수 | 점수 그대로 (score점) |
| 쓰다듬기 | min(20, count)점 |
| 춤추기 | score점 |
| 간식 받기 | got × 4점 |
| 산책 | score점 |
| 일일 미션 완료 | 미션별 reward (20~35점) |

### 케어포인트 소비

| 항목 | 비용 |
|---|---|
| 액세서리 구매 | 60~250점 (아이템별 상이) |
| 강아지 종 변경 | 500점 |
| 병원 진료 | 질병별 40~70점 (감기/배탈: 40, 벼룩: 50, 우울증: 60, 피부병: 70) |
| 예방주사 | 200점 (7일간 발병 면역) |

### 상점 구성 (`openShopModal`)

탭 3종: **머리 / 목 / 발**

**액세서리 목록 (슬롯별 10종, 총 30종)**

| 슬롯 | 아이템 목록 | 가격 |
|---|---|---|
| 머리(hat) | 빨간 모자, 밀짚 모자, 베레모, 캡 모자, 왕관, 헬멧, 머리띠, 꽃모자, 뿔모자, 새모자 | 60~250점 |
| 목(neck) | 목걸이, 스카프, 나비넥, 방울, 리본, 밧줄, 체인, 꽃다발, 이름표, 넥타이 | 60~130점 |
| 발(feet) | 양말, 부츠, 운동화, 샌들, 스케이트, 발토시, 슬리퍼, 빛나는 신발, 줄무늬 양말, 하이힐 | 60~200점 |

- 구매 시 자동 장착
- 이미 보유한 경우 "장착 / 벗기" 버튼으로 전환

### 케어 메뉴 진입

헤더 `🌟 N점` 배지 탭 → **상점** 또는 **방 꾸미기** 선택

---

## 10. 일일 미션

### 미션 풀 (`MISSION_TEMPLATES`)

| ID | 액션 | 목표 | 이름 | 이모지 | 보상 |
|---|---|---|---|---|---|
| `feed_3` | feed | 3회 | 밥을 3번 주기 | 🍖 | 20🌟 |
| `feed_5` | feed | 5회 | 밥을 5번 주기 | 🍖 | 30🌟 |
| `play_3` | play | 3회 | 3번 놀아주기 | 🎾 | 20🌟 |
| `play_5` | play | 5회 | 5번 놀아주기 | 🎾 | 30🌟 |
| `wash_2` | wash | 2회 | 목욕 2번 | 🛁 | 25🌟 |
| `wash_3` | wash | 3회 | 목욕 3번 | 🛁 | 35🌟 |
| `sleep_2` | sleep | 2회 | 재우기 2번 | 💤 | 25🌟 |
| `mg_1` | minigame | 1회 | 공놀이 1판 | 🎯 | 30🌟 |

> `mg_1` 미션은 5가지 놀이 게임 모두에서 카운트됨 (minigame 액션으로 통합 처리).

### 미션 운영 방식

- 매일 자정 갱신 (`todayKey()` 날짜 비교)
- 8개 풀에서 **랜덤 셔플 후 3개** 선택
- 목표 달성 즉시 케어포인트 자동 지급 + 팡파레 사운드 + 🎉 말풍선
- 미션 버튼(📋)에 미완료 dot 표시

---

## 부록: 기타 시스템

### 시간대(TOD)

| 시간대 | 시간 범위 | 표시 |
|---|---|---|
| `dawn` | 04:00–06:00 | 🌄 새벽 |
| `morning` | 06:00–10:00 | 🌅 아침 |
| `day` | 10:00–17:00 | ☀️ 낮 |
| `evening` | 17:00–19:00 | 🌆 저녁 |
| `night` | 19:00–04:00 | 🌙 밤 |

TOD는 창문 내부(`.window-sky`) 시각에만 영향. 실내 방 배경색은 시간 무관 고정.

### 질병(sick) 시스템

발병 조건 (OR):
1. `clean ≤ 10`인 상태가 5분 이상 지속
2. 게이지 2개 이상이 동시에 ≤10
3. 랜덤 발병 (30분당 약 5% 확률)

**질병 카탈로그 (`DISEASES`)**

| ID | 이름 | 이모지 | 원인 게이지 | 치료비 | 약품 |
|---|---|---|---|---|---|
| `cold` | 감기 | 🤧 | energy | 40점 | 해열제(fever) |
| `upset` | 배탈 | 🤢 | hunger | 40점 | 지사제(digest) |
| `skin` | 피부병 | 🩹 | clean | 70점 | 연고(cream) |
| `flea` | 벼룩 | 🐛 | clean | 50점 | 벼룩 스프레이(spray) |
| `blue` | 우울증 | 😔 | happy | 60점 | 영양제(vitamin) |

> 가장 낮은 게이지에 따라 발병 질병이 결정됨. 치료 시 전 게이지 +10, happy 추가 +20.

**예방/정기검진**

| 항목 | 비용 | 효과 |
|---|---|---|
| 예방주사 (vaccine) | 200점 | 7일간 발병 면역 |
| 정기검진 (checkup) | 무료 | +30점, 7일 주기 가능 |

가출 조건 (OR):
- 게이지 3개 이상 0인 상태가 15분 지속
- 게이지 1개가 0인 상태가 60분 지속
- 아픈 상태가 30분 이상 지속

### 똥/오줌(mess) 시스템

- 5~10분 간격으로 랜덤 spawn (최대 4개)
- 밥 먹고 나서 5~10초 후 추가 spawn
- 종류: 💩 poop (70%), 💧 pee (30%)
- 탭하면 청소 → `clean +5`, 케어점수 +1
- 청소 안 하면 `clean` 추가 감소 (`messes.length × 2` per tick)

### 자율 이동(wander)

- 2.5초마다 30% 확률로 이동
- idle/happy 상태에서만 활성 (busy, 편집 모드, 모달, critical 게이지 시 정지)
- 이동 방향에 따라 스프라이트 좌우 반전, 발자국(🐾) 1.8초간 표시

### 하드 리셋

URL 파라미터 `?nuke=1`, `?reset=1`, `?clear=1` 로 긴급 진입 가능.  
localStorage / sessionStorage / IndexedDB / 쿠키 / SW 캐시 / SW 등록 모두 삭제 후 `location.replace()`로 재시작.
