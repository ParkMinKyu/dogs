# v2 — 멀티 펫 + 다른 동물 + 50 액세서리

## 자율 결정한 사항

### 1. 펫 슬롯
- **최대 4마리**. 더 늘리려면 헤더 공간 부족.
- 헤더에 펫 카드 행 추가 (이름 + 작은 sprite + 활성 표시)
- "+ 추가" 버튼은 4마리 미만일 때만
- **해금 임계값** (state.points 누적 기준, 차감 X):
  - 1번: 무료
  - 2번: 100점
  - 3번: 500점
  - 4번: 1500점
- 잠긴 카드는 🔒 + "🌟 진행/필요" 표시 + 회색 dim, 누르면 안내 말풍선

### 2. 전역 vs 펫별
- **전역 공유**:
  - 케어 포인트 (state.points) — 한 가족이 같이 모음
  - 액세서리 인벤토리 (state.inventory) — 어떤 펫이든 장착 가능 (장착은 펫별)
  - 미션 (오늘의 미션) — 어떤 펫에게든 액션하면 진행
  - 벽지/바닥 styleInv (공동 보유)
- **펫별 분리**:
  - 게이지(배고픔/행복/청결/에너지)
  - 진화 stage / care 점수
  - 액세서리 장착 (각 펫 머리/목/안경 슬롯)
  - 방 데코 layout / 가구 layout (각 방 독립)
  - 방 인벤토리 (꽃/뼈/별 등) — 산책에서 액티브 펫이 모은 것
  - sick / mess / busy / wander 위치
  - 미션 진행은 어떤 펫이든 카운트

### 3. 새 동물 종
- 강아지: 기존 시바/말티즈/푸들/허스키 (4)
- 고양이: 노란/검은/회색 (3)
- 토끼: 흰/갈색 (2)
- 햄스터: 노란 (1)
- 총 **10종** — Pillow로 32×32 head sprite 생성 (시바 sheet은 puppy idle만 적용)
- 다른 동물의 4 stage sprite는 강아지 generated와 동일한 톤(_gen.py 기반)

### 4. 액세서리 5 부위 × 10개 = 50
- **부위 5개**: 모자 / 목 / 안경 / 등 / 발
- 각 10종, 32×32 픽셀아트 (Pillow 자동 생성)
- 가격 50~250 케어포인트 차등
- 산책에서도 1% 확률 등장

### 5. UI — 펫 전환
- **헤더에 펫 카드 행** (스와이프 X, 더 명확)
- 카드 탭 → activePetId 전환 → 메인 화면 그 펫의 방으로 즉시 전환
- "+ 추가" 카드는 끝에

## 구현 단계 (구현 중 결정)
1. ✅ 태그 v1.0-stable + 브랜치 feat/v2-multi-pet
2. state migration: 단일 → pets 배열
3. 펫 slot 헤더 + 추가/전환 모달
4. 동물 sprite 생성 스크립트
5. 종 선택 모달에 새 동물 추가
6. 액세서리 50개 카탈로그 + sprite 생성
7. 부위별 인벤토리 탭

## 결정 필요 (유저 확인용)

- **펫 가족 이름** — 4마리 모두 같은 성? 별도?
- **여러 펫 동시 wander** — 한 화면에 4마리 같이? 활성 1마리만 보임?
  - 현재 결정: **활성 1마리만 메인 화면, 다른 펫은 헤더 카드 + 별도 방**
- **상점 가격** — 케어 포인트 시스템 그대로 (200점 평균?)
- **산책 동시 진행** — 한 번에 1마리만 가능?
- **미션 보상 분배** — 펫별? 가족 공유?

## 마이그레이션 호환
- 기존 단일 state가 있으면 첫 진입 시 자동으로 pets[0]로 변환
- v1 데이터 그대로 유지 + activePetId = 0
- 옛 액세서리 id (hat_red 등) → 새 id (hat_01 등) 자동 매핑

## 완료 상태 (2026-04-26)
✅ v1.0-stable 태그 + feat/v2-multi-pet 브랜치 (main에 머지됨)
✅ 멀티 펫 state + snapshotActivePet/loadPetIntoState/switchToPet/addNewPet
✅ 헤더 펫 슬롯 행 (#petSlots) + "+ 추가" 카드 + 활성 펫 분홍 강조
✅ 6 새 동물 head sprite (cat_yellow/cat_black/cat_gray/rabbit_white/rabbit_brown/hamster)
✅ BREEDS 카탈로그 4 → 10, species 필드 + 종 선택 모달 3-col grid
✅ 50 액세서리 (5 부위 × 10) — assets/_gen_acc50.py
✅ 상점 모달 5 부위 탭 — 부위별 10개 카드
✅ equipped 슬롯 5개로 확장 (back/feet 추가)
✅ acc-back / acc-feet CSS 위치 매핑
✅ 옛 acc id 마이그레이션 (hat_red→hat_01 등)
✅ sw v50 / manifest 5.0.0-beta
✅ stage area 1fr 보존 (.pet-slots height 78px 고정)
✅ 헤드리스 캡처 검증 — JS 에러 없음, 레이아웃 정상

## 알려진 한계 / TODO
- 다른 펫의 wander/요청/sick 자동 진행은 현재 활성 펫만 — 백그라운드 멀티펫 simulation X
  (현재 결정: 활성 1마리만 활동, 다른 펫은 정적 snapshot)
- 새 동물(cat/rabbit/hamster)은 head sprite만 — stage별 표정 sprite는 강아지 generated 톤에 hue-rotate filter로 대체
  (시바처럼 4프레임 sprite sheet 받으면 별도 통합 필요)
- 액세서리 50개 모두 32×32 단순 픽셀 — 디자인 다양성은 한정적
- 미니게임 보상 흐름은 활성 펫에만 적용

