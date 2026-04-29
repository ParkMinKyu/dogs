/* ======================================================================
   강아지 키우기 — P0+P1+P2 게임 로직
   - 4 게이지 + 4 액션 + 진화 + 낮/밤 (P0/P1)
   - 이름/종/액세서리/미니게임/일일미션/PWA/사운드 (P2)
   - localStorage 저장, 강아지 절대 안 죽음
   ====================================================================== */

(() => {
  'use strict';

  // ----- Constants --------------------------------------------------------
  const GAUGES = ['hunger', 'happy', 'clean', 'energy'];
  const MAX = 100;

  const TICK_MS = 30 * 1000;
  const DECAY_PER_TICK = 5;

  // 트레이드오프: 한 액션이 한 게이지만 채우는 게 아니라 다른 것 살짝 깎음.
  // 어린이가 한 가지만 누르지 못하게 균형 잡힌 케어 강제.
  const ACTION_EFFECT = {
    feed:  { hunger: +50, happy:  +5, clean: -15, energy:  +0 },
    play:  { hunger: -10, happy: +35, clean: -10, energy: -15 },
    wash:  { hunger:   0, happy: -10, clean:   0, energy:  -5 },
    sleep: { hunger: -15, happy:  +5, clean:   0, energy: +60 },
  };

  const ACTION_FACE = {
    feed:  { state: 'eating',   ms: 1800, sound: 'eat' },
    play:  { state: 'happy',    ms: 1600, sound: 'happy' },
    wash:  { state: 'happy',    ms: 1400, sound: 'splash' },
    sleep: { state: 'sleeping', ms: 2200, sound: 'sleep' },
  };

  const ACTION_BUBBLE = { feed: '🍖', play: '💖', wash: '✨', sleep: '💤' };

  const STAGES = [
    { id: 'puppy', label: '아기',     threshold: 0   },
    { id: 'teen',  label: '청소년',   threshold: 180 },
    { id: 'adult', label: '어른',     threshold: 900 },
  ];

  // 진화 점수 적립 rate cap — 12초당 +1 (= 분당 +5)
  // 미친듯이 클릭해도 게이지는 회복하지만 진화는 천천히 진행
  const CARE_TICK_MS = 12 * 1000;

  const BREEDS = [
    // 강아지 (species: 'dog') — 1종 대표 (다른 종은 자체 sprite 가진 것만)
    { id: 'shiba',   name: '강아지', desc: '귀여운 친구', species: 'dog' },
    // 고양이 (v2)
    { id: 'cat_yellow', name: '노랑이',   desc: '햇살 같은',  species: 'cat' },
    { id: 'cat_black',  name: '까망이',   desc: '신비로운',   species: 'cat' },
    { id: 'cat_gray',   name: '회색냥',   desc: '고급스러운', species: 'cat' },
    // 토끼 (v2)
    { id: 'rabbit_white', name: '흰토끼', desc: '폭신폭신',   species: 'rabbit' },
    { id: 'rabbit_brown', name: '갈토끼', desc: '네덜란드',   species: 'rabbit' },
    // 햄스터 (v2)
    { id: 'hamster', name: '햄찌', desc: '귀여운 작은 친구', species: 'hamster' },
  ];

  // v2 — 50개 액세서리 (5 부위 × 10), 자동 생성
  const ACC_SLOTS = ['hat','neck','feet'];
  const ACC_SLOT_NAMES = {
    hat: '머리', neck: '목', feet: '발',
  };
  const ACC_NAMES = {
    hat: ['빨간 모자', '밀짚 모자', '베레모', '캡 모자', '왕관', '헬멧', '머리띠', '꽃모자', '뿔모자', '새모자'],
    neck: ['목걸이', '스카프', '나비넥', '방울', '리본', '밧줄', '체인', '꽃다발', '이름표', '넥타이'],
    feet: ['양말', '부츠', '운동화', '샌들', '스케이트', '발토시', '슬리퍼', '빛나는 신발', '줄무늬 양말', '하이힐'],
  };
  const ACC_PRICES = {
    hat: [80, 80, 100, 100, 250, 200, 60, 90, 220, 130],
    neck: [80, 90, 90, 60, 70, 70, 130, 100, 80, 100],
    feet: [60, 110, 100, 70, 150, 90, 70, 200, 80, 180],
  };
  const ACCESSORIES = (() => {
    const list = [];
    for (const slot of ACC_SLOTS) {
      for (let i = 1; i <= 10; i++) {
        const id = `${slot}_${String(i).padStart(2,'0')}`;
        list.push({
          id, slot,
          name: ACC_NAMES[slot][i-1],
          price: ACC_PRICES[slot][i-1],
        });
      }
    }
    return list;
  })();
  // 옛 액세서리 id → 새 id 마이그레이션 매핑 (한 번만)
  const ACC_LEGACY_MAP = {
    hat_red: 'hat_01', ribbon: 'hat_07',
    collar: 'neck_01', scarf: 'neck_02',
  };

  const MISSION_TEMPLATES = [
    { id: 'feed_3',  action: 'feed',  count: 3, name: '밥을 3번 주기',     emoji: '🍖', reward: 20 },
    { id: 'feed_5',  action: 'feed',  count: 5, name: '밥을 5번 주기',     emoji: '🍖', reward: 30 },
    { id: 'play_3',  action: 'play',  count: 3, name: '3번 놀아주기',     emoji: '🎾', reward: 20 },
    { id: 'play_5',  action: 'play',  count: 5, name: '5번 놀아주기',     emoji: '🎾', reward: 30 },
    { id: 'wash_2',  action: 'wash',  count: 2, name: '목욕 2번',          emoji: '🛁', reward: 25 },
    { id: 'wash_3',  action: 'wash',  count: 3, name: '목욕 3번',          emoji: '🛁', reward: 35 },
    { id: 'sleep_2', action: 'sleep', count: 2, name: '재우기 2번',        emoji: '💤', reward: 25 },
    { id: 'mg_1',    action: 'minigame', count: 1, name: '공놀이 1판',      emoji: '🎯', reward: 30 },
  ];

  const MINIGAME_DURATION_MS = 30 * 1000;
  const MINIGAME_COOLDOWN_MS = 5 * 60 * 1000;
  const MINIGAME_HAPPY_BOOST = 30;

  // ----- 미니게임 난이도 — 케어(진화) 점수 기반 ----------------------------
  // 1.0(쉬움) → 1.15(보통) → 1.3(어려움). 게임별 hot 파라미터에 곱해서 적용.
  function diffMul() {
    const care = state.care || 0;
    if (care < 100) return 1.0;
    if (care < 500) return 1.15;
    return 1.3;
  }
  function diffLabel() {
    const m = diffMul();
    if (m >= 1.3) return '🔥 어려움';
    if (m >= 1.15) return '⚡ 보통';
    return '🌱 쉬움';
  }

  // ----- 병원 시스템 — 질병/약품 카탈로그 -----------------------------------
  const DISEASES = {
    cold:  { id:'cold',  name:'감기',     emoji:'🤧', cause:'energy', cost:40, med:'fever',  bubble:'🤧 콜록콜록...', tip:'에너지가 부족하면 잘 걸려요' },
    upset: { id:'upset', name:'배탈',     emoji:'🤢', cause:'hunger', cost:40, med:'digest', bubble:'🤢 배가 아파...',   tip:'배고픔을 방치하면 와요' },
    skin:  { id:'skin',  name:'피부병',   emoji:'🩹', cause:'clean',  cost:70, med:'cream',  bubble:'🩹 간지러워...',     tip:'씻기지 않으면 생겨요' },
    flea:  { id:'flea',  name:'벼룩',     emoji:'🐛', cause:'clean',  cost:50, med:'spray',  bubble:'🐛 근질근질...',     tip:'더러우면 벼룩이 와요' },
    blue:  { id:'blue',  name:'우울증',   emoji:'😔', cause:'happy',  cost:60, med:'vitamin',bubble:'😔 같이 놀고 싶어...', tip:'외로우면 우울해져요' },
  };
  const MEDICINES = {
    fever:   { id:'fever',   name:'해열제',     emoji:'💊', price:80,  treats:'cold' },
    digest:  { id:'digest',  name:'지사제',     emoji:'💊', price:80,  treats:'upset' },
    cream:   { id:'cream',   name:'연고',       emoji:'🧴', price:120, treats:'skin' },
    spray:   { id:'spray',   name:'벼룩 스프레이', emoji:'🧴', price:90,  treats:'flea' },
    vitamin: { id:'vitamin', name:'영양제',     emoji:'🥤', price:70,  treats:'blue' },
    vaccine: { id:'vaccine', name:'예방주사',   emoji:'💉', price:200, vaccine:true },
  };
  const VACCINE_DAYS = 7;
  const CHECKUP_INTERVAL_DAYS = 7;
  const CHECKUP_REWARD = 30;

  // 질병 결정 — 가장 낮은 게이지 기반
  function pickDiseaseFromState(p) {
    const map = { hunger:'upset', clean: Math.random()<0.5?'skin':'flea', energy:'cold', happy:'blue' };
    const sorted = GAUGES.map(g=>({g,v:p[g]})).sort((a,b)=>a.v-b.v);
    const low = sorted[0].g;
    return map[low] || 'cold';
  }

  // ----- 시즌 -------------------------------------------------------------
  const SEASONS = {
    spring: { id: 'spring', name: '봄',   emoji: '🌸', months: [3,4,5] },
    summer: { id: 'summer', name: '여름', emoji: '☀️', months: [6,7,8] },
    autumn: { id: 'autumn', name: '가을', emoji: '🍂', months: [9,10,11] },
    winter: { id: 'winter', name: '겨울', emoji: '❄️', months: [12,1,2] },
  };
  function currentSeason() {
    const m = new Date().getMonth() + 1;
    if (m >= 3 && m <= 5) return 'spring';
    if (m >= 6 && m <= 8) return 'summer';
    if (m >= 9 && m <= 11) return 'autumn';
    return 'winter';
  }
  // 시즌 한정 미션 — 일일 미션 풀에 시즌별 1개씩 가산 (높은 보상)
  const SEASONAL_MISSIONS = {
    spring: { id: 'season_spring', action: 'minigame', count: 1, name: '봄맞이 산책 1번', emoji: '🌸', reward: 50 },
    summer: { id: 'season_summer', action: 'wash',     count: 4, name: '여름 물놀이! 씻기 4번', emoji: '🌊', reward: 50 },
    autumn: { id: 'season_autumn', action: 'play',     count: 5, name: '가을 단풍 산책 5번', emoji: '🍁', reward: 50 },
    winter: { id: 'season_winter', action: 'sleep',    count: 3, name: '겨울 포근하게 재우기 3번', emoji: '🛌', reward: 50 },
  };

  function timeOfDayFor(date) {
    const h = date.getHours();
    if (h >= 4 && h < 6)   return 'dawn';
    if (h >= 6 && h < 10)  return 'morning';
    if (h >= 10 && h < 17) return 'day';
    if (h >= 17 && h < 19) return 'evening';
    return 'night';
  }
  const TOD_LABEL = { dawn: '🌄 새벽', morning: '🌅 아침', day: '☀️ 낮', evening: '🌆 저녁', night: '🌙 밤' };

  // ----- Storage ----------------------------------------------------------
  const STORAGE_KEY = 'dogs.p0.state.v1';
  const MUTE_KEY    = 'dogs.p0.muted.v1';

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || typeof s !== 'object') return null;
      // 게이지 하나가 NaN/누락이어도 전체 초기화하지 않고 50 으로 복구.
      // 과거에 단일 깨진 값으로 저장본 통째 폐기되어 캐릭터가 통째로
      // 사라지는 사례 방지.
      for (const g of GAUGES) {
        if (typeof s[g] !== 'number' || !Number.isFinite(s[g])) s[g] = 50;
      }
      if (typeof s.lastTs !== 'number') s.lastTs = Date.now();
      if (typeof s.care !== 'number') s.care = 0;
      if (typeof s.careLastTick !== 'number') s.careLastTick = 0;
      // 마이그레이션 — 한 번만! schemaVersion 으로 가드.
      // 옛 임계값 30/100 또는 60/300 → 새 180/900으로 옮길 때만 boost.
      // care === 0 fresh state는 절대 건드리지 않음 (reset 후 무조건 아기).
      const SCHEMA = 3;
      if (typeof s.schemaVer !== 'number') s.schemaVer = 0;
      if (s.schemaVer < SCHEMA && s.care > 0) {
        // care=180 이상은 이미 새 스케일 → 건드리지 않음.
        // 100~179 (옛 어른): 900 으로
        // 30~99 (옛 청소년): 180 으로
        if (s.care >= 100 && s.care < 180) s.care = 900;
        else if (s.care >= 30 && s.care < 100) s.care = 180;
      }
      s.schemaVer = SCHEMA;
      // stage는 항상 care로부터 재계산 (이전 stage 무시 — care가 source of truth)
      s.stage = stageForCare(s.care);
      // P2 보강
      if (typeof s.name !== 'string') s.name = '';
      if (typeof s.breed !== 'string') s.breed = '';
      if (typeof s.points !== 'number') s.points = 0;
      if (!s.inventory || typeof s.inventory !== 'object') s.inventory = {};
      if (!s.equipped || typeof s.equipped !== 'object') s.equipped = {};
      // 폐기된 슬롯 (back, clothes, glasses) — 키 자체 제거
      delete s.equipped.back;
      delete s.equipped.clothes;
      delete s.equipped.glasses;
      // 3 슬롯 모두 키 보장
      for (const slot of ACC_SLOTS) {
        if (!(slot in s.equipped)) s.equipped[slot] = null;
        // 옛 acc id → 새 id 마이그레이션
        if (s.equipped[slot] && typeof s.equipped[slot] === 'string') {
          if (ACC_LEGACY_MAP[s.equipped[slot]]) s.equipped[slot] = ACC_LEGACY_MAP[s.equipped[slot]];
        }
      }
      // inventory 옛 acc id 마이그레이션
      if (s.inventory && typeof s.inventory === 'object') {
        for (const oldId of Object.keys(ACC_LEGACY_MAP)) {
          if (s.inventory[oldId]) {
            s.inventory[ACC_LEGACY_MAP[oldId]] = true;
            delete s.inventory[oldId];
          }
        }
      }
      if (typeof s.minigameLastTs !== 'number') s.minigameLastTs = 0;
      if (!s.playLast || typeof s.playLast !== 'object') s.playLast = {};
      if (!s.roomInv || typeof s.roomInv !== 'object') s.roomInv = {};
      if (!Array.isArray(s.roomLayout)) s.roomLayout = [];
      if (typeof s.wallpaper !== 'string') s.wallpaper = 'default';
      if (typeof s.floor !== 'string') s.floor = 'default';
      if (!s.furnitureInv || typeof s.furnitureInv !== 'object') s.furnitureInv = {};
      if (!Array.isArray(s.furnitureLayout)) s.furnitureLayout = [];
      if (!s.styleInv || typeof s.styleInv !== 'object') s.styleInv = {}; // wallpaper/floor 보유
      if (!s.lastReqTs || typeof s.lastReqTs !== 'object') s.lastReqTs = {};
      if (!Array.isArray(s.messes)) s.messes = [];
      if (s.sick && typeof s.sick === 'object') {
        if (typeof s.sick.since !== 'number') s.sick = null;
        else if (s.sick && !s.sick.id) s.sick.id = 'cold';   // 마이그: 옛 boolean-ish 객체
      } else { s.sick = null; }
      // 새 필드 기본값
      if (typeof s.vaccineUntil !== 'number') s.vaccineUntil = 0;
      if (typeof s.lastCheckup !== 'number') s.lastCheckup = 0;
      if (!s.medInv || typeof s.medInv !== 'object') s.medInv = {};
      if (!Array.isArray(s.vetLog)) s.vetLog = [];
      if (typeof s.lowCleanSince !== 'number') s.lowCleanSince = 0;
      if (!s.gaugeZeroSince || typeof s.gaugeZeroSince !== 'object') s.gaugeZeroSince = { hunger: null, happy: null, clean: null, energy: null };
      if (typeof s.gameOver !== 'boolean') s.gameOver = false;
      // v2 — 멀티 펫 마이그레이션
      if (!Array.isArray(s.pets)) {
        // v1 단일 → pets[0]로 변환 (기존 모든 펫별 필드 그대로 유지)
        s.pets = [{ id: 0 }];
        s.activePetId = 0;
      }
      if (typeof s.activePetId !== 'number') s.activePetId = 0;
      if (typeof s.nextPetId !== 'number') s.nextPetId = (s.pets.length > 0 ? Math.max(...s.pets.map(p => p.id || 0)) + 1 : 1);
      // 진화 비활성 — 모든 펫 stage='puppy' 강제 (snapshot에 저장된 옛 값도 puppy로)
      // 폐기된 breed → shiba로 (maltese/poodle/husky)
      const RETIRED_BREEDS = new Set(['maltese', 'poodle', 'husky']);
      for (const p of s.pets) {
        if (p && typeof p === 'object') {
          p.stage = 'puppy';
          if (RETIRED_BREEDS.has(p.breed)) p.breed = 'shiba';
          // species는 항상 breed에서 재계산
          if (p.breed) {
            const meta = BREEDS.find(b => b.id === p.breed);
            if (meta) p.species = meta.species;
          }
        }
      }
      if (RETIRED_BREEDS.has(s.breed)) s.breed = 'shiba';
      if (s.breed) {
        const meta = BREEDS.find(b => b.id === s.breed);
        if (meta) s.species = meta.species;
      }
      if (s.busy && typeof s.busy === 'object') {
        if (typeof s.busy.action !== 'string' || typeof s.busy.endsAt !== 'number') s.busy = null;
      } else { s.busy = null; }
      if (!s.missions || typeof s.missions !== 'object') s.missions = { date: '', list: [] };
      return s;
    } catch { return null; }
  }

  // saveState — 즉시 저장. 디바운스 800ms 였으나 새로고침 시 timer
  // pending 상태에서 페이지가 사라져 데이터가 가끔 누락되던 문제로 제거.
  // 호출 빈도는 액션 경계(수십회/세션) 수준이라 IO 부담 없음.
  function _saveStateImmediate() {
    try {
      if (typeof snapshotActivePet === 'function') snapshotActivePet();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }
  function flushSaveState() { _saveStateImmediate(); }
  function saveState() { _saveStateImmediate(); }

  function defaultState() {
    return {
      hunger: 80, happy: 80, clean: 80, energy: 80,
      lastTs: Date.now(),
      care: 0,
      careLastTick: 0,
      schemaVer: 3,
      stage: 'puppy',
      name: '',
      breed: '',
      points: 0,
      inventory: {},
      equipped: { hat: null, neck: null, feet: null },
      minigameLastTs: 0,
      playLast: {},
      roomInv: {},
      roomLayout: [],
      wallpaper: 'default',
      floor: 'default',
      furnitureInv: {},
      furnitureLayout: [],
      styleInv: { wp_default: true, fl_default: true },
      lastReqTs: {},
      messes: [],
      sick: null,
      lowCleanSince: 0,
      gaugeZeroSince: { hunger: null, happy: null, clean: null, energy: null },
      gameOver: false,
      busy: null,
      missions: { date: '', list: [] },
      pets: [{ id: 0 }],
      activePetId: 0,
      vaccineUntil: 0,
      lastCheckup: 0,
      medInv: {},
      vetLog: [],
      nextPetId: 1,
    };
  }

  // v2 — 펫별 필드 (이 키들이 각 펫에 독립). 글로벌(points/inventory/styleInv/missions/etc)은 공유.
  const PET_FIELDS = [
    'hunger', 'happy', 'clean', 'energy', 'lastTs',
    'care', 'careLastTick', 'stage',
    'name', 'breed', 'species',
    'equipped',
    'roomInv', 'roomLayout',
    'wallpaper', 'floor',
    'furnitureInv', 'furnitureLayout',
    'lastReqTs', 'messes', 'sick', 'lowCleanSince',
    'gaugeZeroSince', 'busy', 'minigameLastTs', 'playLast',
    'wanderX', 'wanderY', // v2 — 펫별 위치
  ];
  // Deep clone — 객체/배열의 reference 공유 방지 (snapshot/restore 안전)
  function petClone(v) {
    if (v === null || v === undefined) return v;
    if (typeof v !== 'object') return v;
    try { return JSON.parse(JSON.stringify(v)); } catch { return v; }
  }
  function snapshotActivePet() {
    if (!Array.isArray(state.pets)) return;
    const idx = state.pets.findIndex(p => p.id === state.activePetId);
    if (idx < 0) return;
    const snap = { id: state.activePetId };
    for (const k of PET_FIELDS) snap[k] = petClone(state[k]);
    state.pets[idx] = snap;
  }
  function loadPetIntoState(petId) {
    if (!Array.isArray(state.pets)) return;
    const pet = state.pets.find(p => p.id === petId);
    if (!pet) return;
    for (const k of PET_FIELDS) {
      if (k in pet) state[k] = petClone(pet[k]);
    }
    state.activePetId = petId;
  }
  function switchToPet(petId) {
    if (petId === state.activePetId) return;
    snapshotActivePet();
    loadPetIntoState(petId);
    // 글로벌 잔재 즉시 청소 — 옛 펫의 임시 표정/prop/클래스가 0.1s tick 전에 잔존하지 않도록
    tempFaceState = null;
    tempFaceUntil = 0;
    if (typeof state.wanderX !== 'number') state.wanderX = 50;
    if (typeof state.wanderY !== 'number') state.wanderY = 86;
    if (puppyWrap) {
      puppyWrap.classList.remove('is-bathing', 'is-on-cushion', 'is-evolving',
        'is-happy', 'is-eating', 'is-sad', 'is-sleeping');
      delete puppyWrap.dataset.mood;
      // 새 펫의 저장된 wander 위치로
      puppyWrap.style.left = state.wanderX + '%';
      puppyWrap.style.bottom = (100 - state.wanderY) + '%';
    }
    // 옛 펫의 speech bubble 즉시 제거
    if (typeof __speechEl !== 'undefined' && __speechEl) {
      try { __speechEl.remove(); } catch {}
      __speechEl = null;
    }
    // stage prop/overlay element 즉시 제거 (cushion/bathtub/bowl/mood-overlay/messes/busy-gauge)
    const stageEl = document.querySelector('.stage');
    if (stageEl) {
      stageEl.querySelectorAll('.action-prop, .mood-overlay, .busy-gauge, .wander-footprint').forEach(n => n.remove());
    }
    document.body.classList.remove('is-sick');
    saveState();
    render();
  }
  function addNewPet() {
    snapshotActivePet();
    const id = state.nextPetId || (state.pets.length);
    state.nextPetId = id + 1;
    // 빈 펫 — 이름/종 미설정 (bootstrap이 mandatory 모달 띄움)
    const fresh = {
      id, name: '', breed: '', species: 'dog',
      hunger: 80, happy: 80, clean: 80, energy: 80, lastTs: Date.now(),
      care: 0, careLastTick: 0, stage: 'puppy',
      equipped: { hat: null, neck: null, feet: null },
      roomInv: {}, roomLayout: [],
      wallpaper: 'default', floor: 'default',
      furnitureInv: {}, furnitureLayout: [],
      lastReqTs: {}, messes: [], sick: null, lowCleanSince: 0,
      gaugeZeroSince: { hunger: null, happy: null, clean: null, energy: null },
      busy: null, minigameLastTs: 0, playLast: {},
      wanderX: 12 + Math.random() * 76, wanderY: 78 + Math.random() * 14,
    };
    state.pets.push(fresh);
    loadPetIntoState(id);
    saveState();
    render();
    bootstrap(); // 새 펫 이름/종 설정 모달
  }

  // 액션별 진행 시간 (ms). play_menu 는 즉시.
  // wash는 무제한 — 청결 100% 도달 시 자동 종료. ACTION_DURATION에 없음.
  const ACTION_DURATION = { feed: 5000, sleep: 8000 };

  // 진화 시스템 일시 비활성 — care 값과 무관하게 항상 puppy 고정.
  // 차후 살리려면 이 함수만 원복하면 됨.
  function stageForCare(_care) {
    return 'puppy';
  }

  // 액션 1번 = 진화 점수 후보 +1, 단 careLastTick 이후 12초 지나야만 적립.
  // 이전 적립 후 지난 시간만큼 누적 (예: 24초면 +2, 60초면 +5).
  // 결과: 분당 최대 5점, 미친 클릭에도 영향 없음.
  function addCareScore() {
    const now = Date.now();
    let last = state.careLastTick || 0;
    // 첫 적립이거나 비정상 값이면 첫 액션부터 +1 인정하고 careLastTick은 12초 전으로 세팅
    if (last <= 0 || now - last < 0) {
      state.care = (state.care || 0) + 1;
      state.careLastTick = now;
      return true;
    }
    const elapsed = now - last;
    const ticks = Math.floor(elapsed / CARE_TICK_MS);
    if (ticks <= 0) return false;
    state.care = (state.care || 0) + ticks;
    state.careLastTick = last + ticks * CARE_TICK_MS; // 남은 ms 보존
    return true;
  }

  // ----- 한글 받침 처리 ---------------------------------------------------
  function lastCharHasBatchim(s) {
    if (!s) return false;
    const ch = s.charAt(s.length - 1);
    const code = ch.charCodeAt(0);
    if (code < 0xAC00 || code > 0xD7A3) return false;
    return ((code - 0xAC00) % 28) !== 0;
  }
  function josa(name, withBatchim, withoutBatchim) {
    return lastCharHasBatchim(name) ? withBatchim : withoutBatchim;
  }
  // 강아지 호칭: "[이름]이/가" 또는 "[이름]은/는"
  function nameWithSubject(name) { return name + josa(name, '이가', '가'); }
  function nameTopic(name)        { return name + josa(name, '은', '는'); }

  // ----- 풀 하드 리셋 (재사용) -------------------------------------------
  // localStorage / sessionStorage / IndexedDB / cookies / SW caches / SW 등록 모두 정리.
  // ?nuke=1 / ?reset=1 / ?clear=1 URL 진입과 in-app "처음부터 다시" 모두 동일.
  async function hardReset() {
    try { localStorage.clear(); } catch {}
    try { sessionStorage.clear(); } catch {}
    try {
      if (typeof indexedDB !== 'undefined' && indexedDB.databases) {
        const dbs = await indexedDB.databases();
        await Promise.all((dbs || []).map(db => new Promise(res => {
          if (!db.name) return res();
          const req = indexedDB.deleteDatabase(db.name);
          req.onsuccess = req.onerror = req.onblocked = () => res();
        })));
      }
    } catch {}
    try {
      // 모든 쿠키 만료 — path/domain 모두 시도
      document.cookie.split(';').forEach(c => {
        const eq = c.indexOf('=');
        const name = (eq > -1 ? c.slice(0, eq) : c).trim();
        if (!name) return;
        const exp = '; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
        document.cookie = name + '=' + exp;
        document.cookie = name + '=' + exp + '; domain=' + location.hostname;
      });
    } catch {}
    try {
      if ('caches' in window) {
        const ks = await caches.keys();
        await Promise.all(ks.map(k => caches.delete(k)));
      }
    } catch {}
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
    } catch {}
    // cache-busted URL로 새 진입 — SW 우회 + 옛 IIFE 메모리 완전 폐기
    try { location.replace(location.pathname + '?_=' + Date.now()); }
    catch { location.reload(); }
  }

  // 강제 리셋 비상구 — 폰에서 UI reset 버튼이 안 눌릴 때 URL로 진입.
  {
    let __resetting = false;
    try {
      const params = new URLSearchParams(location.search);
      if (params.get('nuke') === '1' || params.get('reset') === '1' || params.get('clear') === '1') {
        __resetting = true;
        hardReset();
      }
    } catch {}
    if (__resetting) return; // IIFE 즉시 종료 — 페이지 navigation 대기
  }

  // ----- QA query params -------------------------------------------------
  try {
    const params = new URLSearchParams(location.search);
    if (params.get('notrans') === '1') {
      const s = document.createElement('style');
      s.textContent = '*,*::before,*::after{transition:none!important;animation:none!important}';
      document.head.appendChild(s);
    }
    if (params.get('demo') === '1') {
      const today = (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); })();
      const seed = {
        hunger: 85, happy: 92, clean: 75, energy: 80,
        lastTs: Date.now(), care: 35, stage: 'teen',
        name: '콩이', breed: 'shiba', points: 320,
        inventory: { hat_red: true, ribbon: true },
        equipped: { hat: 'hat_red', neck: null },
        minigameLastTs: 0,
        missions: { date: today, list: [
          { id: 'feed_3', action: 'feed', count: 3, name: '밥을 3번 주기', emoji: '🍖', reward: 20, progress: 2, claimed: false },
          { id: 'play_3', action: 'play', count: 3, name: '3번 놀아주기', emoji: '🎾', reward: 20, progress: 3, claimed: true },
          { id: 'wash_2', action: 'wash', count: 2, name: '목욕 2번', emoji: '🛁', reward: 25, progress: 0, claimed: false },
        ]},
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    }
  } catch {}

  // ----- Game state -------------------------------------------------------
  let state = loadState() || defaultState();
  applyOfflineDecay();
  ensureTodayMissions();

  let tempFaceUntil = 0;
  let tempFaceState = null;
  let evolveAnimUntil = 0;
  let timeOverride = null;
  let decayPaused = false;

  // ----- DOM refs ---------------------------------------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const root = $('.app');
  const puppyEl    = $('#puppy');
  const puppyWrap  = $('.puppy-wrap');
  const bubbleEl   = $('#bubble');
  const stageBadge = $('#stageBadge');
  const todBadge   = $('#todBadge');
  const seasonBadge = $('#seasonBadge');
  const careBadge  = $('#careBadge');
  const evolveFx   = $('#evolveFx');
  const titleEl    = $('#titleEl');
  const titleAvatar = $('#titleAvatar');
  const titleName  = $('#titleName');
  const settingsBtn = $('#settingsBtn');
  const shopBtn    = $('#shopBtn');
  const missionBtn = $('#missionBtn');
  const roomBtn    = $('#roomBtn');
  const vetBtn     = $('#vetBtn');
  const missionDot = $('#missionDot');
  const modalRoot  = $('#modalRoot');
  const accHatEl   = $('#accHat');
  const accNeckEl  = $('#accNeck');
  const accFeetEl  = $('#accFeet');
  // 새 원형 게이지 — 각 .gauge[data-key]의 .gauge-circle 과 .pct 셀렉터
  const gaugeEls = {};
  for (const g of GAUGES) {
    const root = document.querySelector('.gauge[data-key="' + g + '"]');
    if (!root) continue;
    gaugeEls[g] = {
      root,
      circle: root.querySelector('.gauge-circle'),
      pct:    root.querySelector('.pct'),
    };
  }
  const actionBtns = document.querySelectorAll('.action');

  // 게이지별 거부/감정 모드 메타
  const GAUGE_MOODS = {
    hunger: { sprite: 'sad',      bubble: '🍖 배고파!',     overlay: 'hunger', rebellion: '싫어... 밥부터...' },
    happy:  { sprite: 'sad',      bubble: '💧 같이 놀아줘...', overlay: 'happy',  rebellion: '심심해...' },
    clean:  { sprite: 'sad',      bubble: '🛁 너무 더러워!',   overlay: 'clean',  rebellion: '씻고 나서...' },
    energy: { sprite: 'sleeping', bubble: '💤 너무 졸려...',   overlay: 'energy', rebellion: '졸려...' },
  };
  // 액션 → 그 액션이 회복하는 게이지
  const ACTION_GAUGE = { feed: 'hunger', play: 'happy', play_menu: 'happy', wash: 'clean', sleep: 'energy' };

  // 색상: 퍼센트별 hsl 보간 (red→yellow→green)
  function colorForGauge(key, pct) {
    // base hue per gauge
    const baseHue = { hunger: 350, happy: 200, clean: 150, energy: 45 }[key] || 120;
    if (pct >= 70) return `hsl(${baseHue}, 60%, 50%)`;
    if (pct >= 40) return `hsl(45, 90%, 55%)`;     // yellow/orange
    if (pct >= 20) return `hsl(20, 90%, 55%)`;     // orange
    return `hsl(0, 75%, 50%)`;                      // red
  }

  // 가장 시급한 ≤20% 게이지 (priority key)
  function criticalLowGauge() {
    const lows = GAUGES.filter(g => state[g] <= 20);
    if (!lows.length) return null;
    return lows.sort((a, b) => state[a] - state[b])[0];
  }

  // ----- Audio ------------------------------------------------------------
  let audioCtx = null;
  let muted = localStorage.getItem(MUTE_KEY) === '1';

  function ensureAudio() {
    if (muted) return null;
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch { audioCtx = null; }
    }
    return audioCtx;
  }

  // 단순 blip
  function blip(freqs, dur = 0.12, type = 'sine', vol = 0.06) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t0 + i * dur);
      g.gain.setValueAtTime(0, t0 + i * dur);
      g.gain.linearRampToValueAtTime(vol, t0 + i * dur + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * dur + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t0 + i * dur);
      o.stop(t0 + i * dur + dur + 0.02);
    });
  }

  // 다중 oscillator 합성 (P2.7) — type 조합 + envelope + 노이즈 층
  function richBlip({ partials, dur = 0.18, vol = 0.07, attack = 0.012, release = 0.08, vibrato = 0 }) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0, t0);
    master.gain.linearRampToValueAtTime(vol, t0 + attack);
    master.gain.linearRampToValueAtTime(vol * 0.7, t0 + dur - release);
    master.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    master.connect(ctx.destination);
    partials.forEach(p => {
      const o = ctx.createOscillator();
      o.type = p.type || 'sine';
      o.frequency.setValueAtTime(p.f, t0);
      if (p.bend) o.frequency.exponentialRampToValueAtTime(p.f * p.bend, t0 + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(p.g || 0.5, t0);
      o.connect(g).connect(master);
      // vibrato LFO
      if (vibrato > 0) {
        const lfo = ctx.createOscillator();
        const lfoG = ctx.createGain();
        lfo.frequency.setValueAtTime(vibrato, t0);
        lfoG.gain.setValueAtTime(p.f * 0.02, t0);
        lfo.connect(lfoG).connect(o.frequency);
        lfo.start(t0);
        lfo.stop(t0 + dur);
      }
      o.start(t0);
      o.stop(t0 + dur);
    });
  }

  // 짧은 노이즈 버스트 (씻기/스플래시용)
  function noiseBurst({ dur = 0.18, vol = 0.05, hp = 800 }) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const samples = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, samples, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < samples; i++) data[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'highpass';
    filt.frequency.value = hp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt).connect(g).connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + dur);
  }

  // 강아지 짖기/낑낑 — 노이즈 + 빠른 vowel formant 시뮬
  function dogBark({ short = false, pitch = 1 } = {}) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const dur = short ? 0.12 : 0.22;
    // 배음 풍부한 sawtooth + bandpass(공명) + 짧은 envelope
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(360 * pitch, t0);
    o.frequency.exponentialRampToValueAtTime(180 * pitch, t0 + dur);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(900 * pitch, t0);
    bp.frequency.exponentialRampToValueAtTime(500 * pitch, t0 + dur);
    bp.Q.setValueAtTime(6, t0);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.18, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    // 노이즈 살짝 — bark 거친 텍스처
    const samples = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, samples, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < samples; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
    const nsrc = ctx.createBufferSource();
    nsrc.buffer = buf;
    const nbp = ctx.createBiquadFilter();
    nbp.type = 'bandpass'; nbp.frequency.value = 1200 * pitch; nbp.Q.value = 4;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.05, t0);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(bp).connect(g).connect(ctx.destination);
    nsrc.connect(nbp).connect(ng).connect(ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
    nsrc.start(t0); nsrc.stop(t0 + dur + 0.02);
  }

  function dogWhimper() {
    const ctx = ensureAudio();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const dur = 0.5;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(700, t0);
    o.frequency.exponentialRampToValueAtTime(400, t0 + dur * 0.4);
    o.frequency.exponentialRampToValueAtTime(550, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.07, t0 + 0.04);
    g.gain.linearRampToValueAtTime(0.05, t0 + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  function dogSnore() {
    const ctx = ensureAudio();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const dur = 0.7;
    // 들이쉬는 코골이 — 노이즈 + low LPF + 천천히 swell
    const samples = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, samples, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < samples; i++) data[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 350; lp.Q.value = 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.06, t0 + dur * 0.4);
    g.gain.linearRampToValueAtTime(0.03, t0 + dur * 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(lp).connect(g).connect(ctx.destination);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  function coinPickup() {
    // 산책 아이템 — 동전 같은 짧은 두 음 띠리링
    richBlip({ partials: [{ f: 1568, type: 'square', g: 0.3 }, { f: 2350, type: 'sine', g: 0.15 }], dur: 0.05, vol: 0.05 });
    setTimeout(() => richBlip({ partials: [{ f: 2093, type: 'square', g: 0.3 }, { f: 3136, type: 'sine', g: 0.15 }], dur: 0.08, vol: 0.05 }), 50);
  }

  const SOUNDS = {
    eat: () => {
      // 두 번 씹는 듯한 짧은 톤 + 약간의 휨
      richBlip({ partials: [{ f: 480, type: 'triangle', g: 0.5, bend: 1.1 }, { f: 720, type: 'sine', g: 0.3 }], dur: 0.10, vol: 0.07 });
      setTimeout(() => richBlip({ partials: [{ f: 540, type: 'triangle', g: 0.5, bend: 0.9 }, { f: 800, type: 'sine', g: 0.3 }], dur: 0.10, vol: 0.07 }), 130);
    },
    happy: () => {
      // 강아지 왈왈 — 두 번 짧게
      dogBark({ short: true, pitch: 1.1 });
      setTimeout(() => dogBark({ short: true, pitch: 1.0 }), 180);
    },
    bark: () => dogBark({ short: false, pitch: 1.0 }),
    whimper: dogWhimper,
    splash: () => {
      // 노이즈 버스트 + 음정 하강 = 물 튀는 느낌
      noiseBurst({ dur: 0.22, vol: 0.04, hp: 1500 });
      richBlip({ partials: [{ f: 920, type: 'sine', g: 0.5, bend: 0.6 }, { f: 1400, type: 'sine', g: 0.3, bend: 0.6 }], dur: 0.22, vol: 0.05 });
    },
    sleep: () => {
      // 코고는 소리 — 낮은 노이즈 + 짧은 톤 결합
      dogSnore();
      setTimeout(() => richBlip({ partials: [{ f: 247, type: 'triangle', g: 0.4 }], dur: 0.18, vol: 0.04, attack: 0.04 }), 600);
    },
    evolve: () => {
      // 4음 상승 아르페지오 + 빛나는 화음 잔향
      const seq = [523, 659, 784, 1046, 1318];
      seq.forEach((f, i) => {
        setTimeout(() => richBlip({
          partials: [{ f, type: 'triangle', g: 0.5 }, { f: f * 2, type: 'sine', g: 0.25 }, { f: f * 3, type: 'sine', g: 0.15 }],
          dur: 0.14, vol: 0.07,
        }), i * 80);
      });
    },
    bounce: () => {
      // 공 튀는 깡 소리
      richBlip({ partials: [{ f: 1100, type: 'square', g: 0.4, bend: 1.2 }, { f: 1650, type: 'sine', g: 0.2 }], dur: 0.06, vol: 0.05, attack: 0.002, release: 0.04 });
    },
    catch: () => {
      // 잡았을 때 — 강아지 짧은 왈
      dogBark({ short: true, pitch: 1.15 });
    },
    coin: coinPickup,
    pop: () => {
      // UI 클릭 — 짧은 팝
      blip([880, 1100], 0.06, 'triangle', 0.04);
    },
    cash: () => {
      // 구매 — 동전음 두 번
      richBlip({ partials: [{ f: 1320, type: 'square', g: 0.4 }, { f: 1980, type: 'sine', g: 0.2 }], dur: 0.08, vol: 0.05 });
      setTimeout(() => richBlip({ partials: [{ f: 1760, type: 'square', g: 0.4 }, { f: 2640, type: 'sine', g: 0.2 }], dur: 0.10, vol: 0.05 }), 70);
    },
    fanfare: () => {
      // 미션 완료 / 의미 있는 보상 — 작은 팡파레
      const seq = [659, 784, 1046];
      seq.forEach((f, i) => {
        setTimeout(() => richBlip({
          partials: [{ f, type: 'triangle', g: 0.5 }, { f: f * 1.5, type: 'sine', g: 0.25 }],
          dur: 0.14, vol: 0.06,
        }), i * 90);
      });
    },
  };

  // ----- Decay ------------------------------------------------------------
  // 오프라인 catchup — 최대 4시간 분만 decay 적용 (밤새 떠나도 가출 안 됨)
  function applyOfflineDecay() {
    const OFFLINE_DECAY_CAP_MS = 4 * 60 * 60 * 1000;
    const now = Date.now();
    let elapsed = Math.max(0, now - (state.lastTs || now));
    if (elapsed > OFFLINE_DECAY_CAP_MS) elapsed = OFFLINE_DECAY_CAP_MS;
    const ticks = Math.floor(elapsed / TICK_MS);
    if (ticks > 0) {
      for (const g of GAUGES) {
        state[g] = clamp(state[g] - DECAY_PER_TICK * ticks);
      }
      // 오프라인 동안의 게이지 0 카운트는 0으로 — 가출 안 일어남
      state.gaugeZeroSince = { hunger: null, happy: null, clean: null, energy: null };
      // sick.since도 오프라인 시간 빼고 재시작 (현재 시점부터 카운트)
      if (state.sick) state.sick.since = now;
    }
    // lastTs는 항상 now로 업데이트 (실제 경과 시간 기록)
    state.lastTs = now;
  }

  // v2 — 단일 펫(객체)에 decay/sick/runaway 검사 적용. p는 state 또는 pets[i].
  // 반환: 이 펫이 가출 조건 충족 시 true.
  function applyDecayToPet(p) {
    if (!p) return false;
    if (!p.name || !p.breed) { p.lastTs = Date.now(); return false; }
    for (const g of GAUGES) {
      let dec = DECAY_PER_TICK;
      if (g === 'clean' && p.messes && p.messes.length > 0) {
        dec += p.messes.length * 2;
      }
      if (g === 'happy' && p.sick) dec += 2;
      p[g] = clamp((p[g] ?? 0) - dec);
    }
    p.lastTs = Date.now();
    const now = Date.now();
    // 면역 — 예방접종 유효 기간 내라면 발병 안 함
    const immune = (state.vaccineUntil || 0) > now;
    if (p.clean <= 10) {
      if (!p.lowCleanSince) p.lowCleanSince = now;
      if (!p.sick && !immune && now - p.lowCleanSince > 5 * 60 * 1000) {
        const id = pickDiseaseFromState(p);
        p.sick = { id, since: now };
      }
    } else {
      p.lowCleanSince = 0;
    }
    if (!p.sick && !immune && GAUGES.filter(g => p[g] <= 10).length >= 2) {
      const id = pickDiseaseFromState(p);
      p.sick = { id, since: now };
    }
    if (!p.sick && !immune && Math.random() < 0.05 / (30 * 60 * 1000 / TICK_MS)) {
      const id = pickDiseaseFromState(p);
      p.sick = { id, since: now };
    }
    if (!p.gaugeZeroSince) p.gaugeZeroSince = { hunger: null, happy: null, clean: null, energy: null };
    for (const g of GAUGES) {
      if (p[g] <= 0) {
        if (!p.gaugeZeroSince[g]) p.gaugeZeroSince[g] = now;
      } else {
        p.gaugeZeroSince[g] = null;
      }
    }
    const zeroes = GAUGES.filter(g => p.gaugeZeroSince[g]);
    if (zeroes.length >= 3) {
      const oldest = Math.min(...zeroes.map(g => p.gaugeZeroSince[g]));
      if (now - oldest >= 15 * 60 * 1000) return true;
    }
    for (const g of zeroes) {
      if (now - p.gaugeZeroSince[g] >= 60 * 60 * 1000) return true;
    }
    if (p.sick && now - p.sick.since >= 30 * 60 * 1000) return true;
    return false;
  }

  function tickDecay() {
    if (decayPaused) { state.lastTs = Date.now(); return; }
    if (state.gameOver) return;
    // 활성 펫: state.* 직접 변경 (UI 즉시 반영)
    const activeRunaway = applyDecayToPet(state);
    // 비활성 펫: pets[] 객체 직접 변경 (시간 흐름이 모든 펫에 영향)
    let inactiveRunawayPet = null;
    if (Array.isArray(state.pets)) {
      for (const pet of state.pets) {
        if (pet.id === state.activePetId) continue;
        if (applyDecayToPet(pet) && !inactiveRunawayPet) inactiveRunawayPet = pet;
      }
    }
    saveState();
    render();
    if (activeRunaway) {
      triggerRunaway();
    } else if (inactiveRunawayPet) {
      const nm = inactiveRunawayPet.name || '강아지';
      flashBubble('🚪');
      showSpeech(`${nameWithSubject(nm)} 너무 외로워서 떠났어요...`, 3000);
      switchToPet(inactiveRunawayPet.id);
      setTimeout(() => triggerRunaway(), 400);
    }
  }
  setInterval(tickDecay, TICK_MS);

  // ----- 똥/오줌 spawn (5~10분에 한 번, 펫별) ----------------------------
  const MESS_INTERVAL_MIN = 5 * 60 * 1000;
  const MESS_INTERVAL_RANGE = 5 * 60 * 1000; // 5~10분
  const _nextMessAt = new Map(); // petId → ts
  function _scheduleNextMess(petId) {
    _nextMessAt.set(petId, Date.now() + MESS_INTERVAL_MIN + Math.random() * MESS_INTERVAL_RANGE);
  }
  function _spawnMessOn(p) {
    if (!p || !p.name || !p.breed) return false;
    if (p.busy) return false;
    if (!Array.isArray(p.messes)) p.messes = [];
    if (p.messes.length >= 4) return false;
    const type = Math.random() < 0.7 ? 'poop' : 'pee';
    const x = 12 + Math.random() * 76;
    const y = 70 + Math.random() * 18;
    p.messes.push({ type, x, y, ts: Date.now() });
    return true;
  }
  function maybeSpawnMess() {
    const now = Date.now();
    let activeChanged = false;
    // 활성 펫
    if (!_nextMessAt.has(state.activePetId)) _scheduleNextMess(state.activePetId);
    if (now >= _nextMessAt.get(state.activePetId)) {
      _scheduleNextMess(state.activePetId);
      if (_spawnMessOn(state)) {
        activeChanged = true;
        flashBubble(state.messes[state.messes.length - 1].type === 'poop' ? '💩' : '💧');
      }
    }
    // 비활성 펫
    if (Array.isArray(state.pets)) {
      for (const pet of state.pets) {
        if (pet.id === state.activePetId) continue;
        if (!_nextMessAt.has(pet.id)) _scheduleNextMess(pet.id);
        if (now >= _nextMessAt.get(pet.id)) {
          _scheduleNextMess(pet.id);
          _spawnMessOn(pet);
        }
      }
    }
    saveState();
    if (activeChanged) render();
  }
  setInterval(maybeSpawnMess, 30 * 1000);

  // 똥/오줌 치워달라고 주기적으로 말하기 (30초마다 체크, mess 있을 때만)
  const MESS_NAG_MSGS = [
    '저기... 좀 치워줄 수 있어요? 💩',
    '냄새나요... 빨리 치워주세요! 🥺',
    '여기 더럽다고요!! 💦',
    '똥 치워주세요... 🐾',
    '냄새 너무 심해요 😭',
  ];
  setInterval(() => {
    if (!state.messes || state.messes.length === 0) return;
    if (state.busy) return;
    showSpeech(MESS_NAG_MSGS[Math.floor(Math.random() * MESS_NAG_MSGS.length)], 3500);
  }, 10 * 1000);

  // mess 렌더 + 청소 핸들러
  // v2 — 헤더 펫 슬롯 카드 (현재 펫 + 다른 펫 + "추가" 버튼)
  // 펫 슬롯 해금 임계값 (state.points 누적 기준, 차감 없음)
  const PET_UNLOCK = [0, 1000, 5000, 15000]; // 1/2/3/4번 펫
  const MAX_PETS = PET_UNLOCK.length;

  function renderPetSlots() {
    const countEl = document.getElementById('petPickerCount');
    if (!countEl) return;
    const count = (state.pets || []).length;
    if (count > 1) {
      countEl.textContent = count;
      countEl.hidden = false;
    } else {
      countEl.hidden = true;
    }
  }

  function openPetPicker() {
    const pets = state.pets || [];
    const have = state.points || 0;

    const grid = document.createElement('div');
    grid.className = 'pet-picker-grid';

    pets.forEach(pet => {
      const isActive = pet.id === state.activePetId;
      const data = isActive ? state : pet;
      const breed = data.breed || 'shiba';
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'pet-picker-card' + (isActive ? ' active' : '');
      const sickHtml = data.sick ? '<span class="pet-picker-sick">🤒</span>' : '';
      card.innerHTML = `
        <img class="pet-picker-img" src="assets/breeds/${breed}.png" alt="" />
        <span class="pet-picker-name">${data.name || '?'}</span>
        ${sickHtml}
      `;
      card.addEventListener('click', () => {
        closeModal();
        if (!isActive) switchToPet(pet.id);
      });
      grid.appendChild(card);
    });

    if (pets.length < MAX_PETS) {
      const need = PET_UNLOCK[pets.length] || 0;
      const unlocked = have >= need;
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'pet-picker-card pet-picker-add' + (unlocked ? '' : ' locked');
      if (unlocked) {
        add.innerHTML = '<span class="pet-picker-plus">+</span><span class="pet-picker-name">추가하기</span>';
        add.addEventListener('click', () => { closeModal(); addNewPet(); });
      } else {
        add.innerHTML = `<span class="pet-picker-lock">🔒</span><span class="pet-picker-name" style="font-size:11px">🌟 ${have}/${need}</span>`;
        add.addEventListener('click', () => {
          closeModal();
          flashBubble('🔒');
          showSpeech(`더 키우면 풀려요! (🌟 ${need}점 필요)`, 2400);
        });
      }
      grid.appendChild(add);
    }

    openModal({ title: '강아지 선택', body: grid });
  }

  function renderMessLayer() {
    const layer = document.getElementById('messLayer');
    if (!layer) return;
    layer.innerHTML = '';
    (state.messes || []).forEach((m, idx) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'mess-item';
      el.innerHTML = (m.type === 'poop' ? '💩' : '💧') + '<span class="fly">🪰</span>';
      el.style.left = m.x + '%';
      el.style.top  = m.y + '%';
      el.dataset.idx = idx;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        // 청소
        state.messes.splice(idx, 1);
        state.clean = clamp(state.clean + 5);
        addCareScore();
        try { SOUNDS.splash(); } catch {}
        flashBubble('✨');
        showGaugeDelta('clean', 5);
        saveState();
        render();
      });
      layer.appendChild(el);
    });
  }

  // ----- Actions ----------------------------------------------------------
  actionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      // 보호자 일일 제한 체크 — 모든 액션 차단
      if (typeof checkDailyLimit === 'function' && checkDailyLimit()) return;
      if (state.sick && action !== 'vet') {
        btn.classList.remove('shake'); void btn.offsetWidth; btn.classList.add('shake');
        showSpeech('🤒 아파서 못 해요... 병원에 데려가 주세요!');
        try { SOUNDS.whimper(); } catch {}
        return;
      }
      // 액션 통계 카운트 (play_menu는 미니게임 진입, 실제 카운트는 미니게임에서)
      if (typeof logGuardianAction === 'function') {
        if (action === 'feed' || action === 'wash' || action === 'sleep') logGuardianAction(action);
        else if (action === 'play_menu') logGuardianAction('play');
      }
      if (action === 'play_menu') { openPlayMenu(); return; }
      if (action === 'minigame')  { openMinigame(); return; } // 하위 호환
      onAction(btn);
    });
  });

  function onAction(btn) {
    const action = btn.dataset.action;
    const eff = ACTION_EFFECT[action];
    if (!eff) return;
    // 아플 때는 병원(vet) 외 모든 액션 차단
    if (state.sick && action !== 'vet') {
      btn.classList.remove('shake'); void btn.offsetWidth; btn.classList.add('shake');
      showSpeech('🤒 아파서 못 해요... 병원에 데려가 주세요!');
      try { SOUNDS.whimper(); } catch {}
      return;
    }
    // 진행 중이면 다른 액션 차단
    if (state.busy && state.busy.endsAt && Date.now() < state.busy.endsAt) return;
    if (state.busy && !state.busy.endsAt) return; // wash 등 무제한 진행 중

    // 해당 게이지가 이미 100%면 메시지만
    const fullGauge = ACTION_GAUGE[action];
    if (fullGauge && state[fullGauge] >= 100) {
      const fullMsg = {
        hunger: '배가 불러요! 🍖',
        happy:  '충분히 행복해요! 💖',
        clean:  '이미 깨끗해요! 🛁',
        energy: '에너지가 넘쳐요! ⚡',
      }[fullGauge] || '이미 충분해요! 😊';
      showSpeech(fullMsg);
      return;
    }

    // 거부 검사 (데드락 방지):
    // - sleep은 항상 허용 (잠은 기본 회복권)
    // - ≤20% 게이지가 있으면, 그 게이지를 회복하는 액션들은 모두 허용
    //   (예: hunger=10, happy=15 → 먹이/놀이 둘 다 OK)
    // - 그 외엔 거부
    if (action !== 'sleep') {
      const lows = GAUGES.filter(g => state[g] <= 20);
      if (lows.length > 0) {
        const ag = ACTION_GAUGE[action];
        if (!lows.includes(ag)) {
          // 가장 낮은 게이지 기준으로 mood 메시지
          const lowest = lows.sort((a, b) => state[a] - state[b])[0];
          const mood = GAUGE_MOODS[lowest];
          btn.classList.remove('shake'); void btn.offsetWidth; btn.classList.add('shake');
          showSpeech(mood.rebellion);
          tempFaceState = mood.sprite;
          tempFaceUntil = Date.now() + 1200;
          try { SOUNDS.whimper(); } catch {}
          render();
          return;
        }
      }
    }

    btn.classList.remove('cheer'); void btn.offsetWidth; btn.classList.add('cheer');
    const face = ACTION_FACE[action];
    if (face?.sound && SOUNDS[face.sound]) SOUNDS[face.sound]();

    if (action === 'wash') {
      // 무제한 — 청결 100 도달 또는 그만하기 버튼으로 종료
      startBusyAction('wash');
      return;
    }
    const dur = ACTION_DURATION[action] || 0;
    if (dur > 0) {
      startBusyAction(action);
    } else {
      applyActionEffect(action);
    }
  }

  // 액션 효과를 한 번에 적용 — 트레이드오프 적용 + 변화량 floating text
  function applyActionEffect(action) {
    const eff = ACTION_EFFECT[action];
    if (!eff) return;
    const tod = currentTod();
    let scaled = { ...eff };
    if (action === 'sleep' && tod === 'night') {
      scaled.energy = Math.min(MAX, eff.energy + 15);
    }
    const before = {};
    for (const g of GAUGES) before[g] = state[g];
    for (const g of GAUGES) {
      if (typeof scaled[g] === 'number') state[g] = clamp(state[g] + scaled[g]);
    }
    // floating text 표시
    for (const g of GAUGES) {
      const delta = state[g] - before[g];
      if (delta !== 0) showGaugeDelta(g, delta);
    }
    addCareScore();
    state.points = (state.points || 0) + 1;
    const newStage = stageForCare(state.care);
    if (newStage !== state.stage) {
      const prev = state.stage;
      state.stage = newStage;
      triggerEvolveFx(prev, newStage);
    }
    bubbleEl.textContent = ACTION_BUBBLE[action] || '✨';
    bubbleEl.classList.add('show');
    clearTimeout(bubbleEl._t);
    bubbleEl._t = setTimeout(() => bubbleEl.classList.remove('show'), 900);
    progressMission(action, 1);
    saveState();
    render();
  }

  // ----- Busy / 진행 시스템 ----------------------------------------------
  let busyTimerId = null;

  // 액션별 강아지 이동 목표 위치 (prop 위치와 일치)
  const ACTION_DOG_POS = {
    feed:  { x: 36, y: 86 }, // 그릇이 left:30%, 강아지는 옆에
    wash:  { x: 50, y: 82 }, // 욕조 중앙
    sleep: { x: 50, y: 86 }, // 쿠션 위
  };
  function moveDogToActionPos(action) {
    const pos = ACTION_DOG_POS[action];
    if (!pos || !puppyWrap) return;
    const oldX = state.wanderX || 50;
    state.wanderX = pos.x;
    state.wanderY = pos.y;
    puppyWrap.dataset.direction = pos.x < oldX ? 'left' : 'right';
    puppyWrap.style.left = pos.x + '%';
    puppyWrap.style.bottom = (100 - pos.y) + '%';
    updateDepthSort();
  }

  const ACTION_START_SPEECH = {
    feed:  '냠냠... 맛있어요! 🍖',
    play:  '신난다! 같이 놀아요! 💖',
    wash:  '뽀득뽀득 씻겨주세요~ 🫧',
    sleep: '쿨쿨... 잘게요 💤',
  };
  const ACTION_DONE_SPEECH = {
    feed:  '배불러요~ 🍖',
    play:  '재밌었어요! 💖',
    sleep: '잘 잤어요! ⚡',
  };

  function startBusyAction(action) {
    const dur = ACTION_DURATION[action] || 0;
    moveDogToActionPos(action);
    updateDepthSort();
    if (ACTION_START_SPEECH[action]) showSpeech(ACTION_START_SPEECH[action], 2500);
    // wash는 무제한 — endsAt null
    if (action === 'wash') {
      state.busy = { action: 'wash', startedAt: Date.now(), endsAt: null };
      tempFaceState = ACTION_FACE.wash?.state;
      tempFaceUntil = Date.now() + 60000;
      saveState();
      render();
      return;
    }
    if (!dur) return;
    state.busy = { action, startedAt: Date.now(), endsAt: Date.now() + dur };
    const face = ACTION_FACE[action];
    if (face) {
      tempFaceState = face.state;
      tempFaceUntil = state.busy.endsAt + 200;
    }
    saveState();
    render();
    scheduleBusyEnd();
  }

  function scheduleBusyEnd() {
    clearTimeout(busyTimerId);
    if (!state.busy) return;
    const remain = state.busy.endsAt - Date.now();
    if (remain <= 0) { finishBusy(); return; }
    busyTimerId = setTimeout(finishBusy, remain + 30);
  }

  function finishBusy() {
    if (!state.busy) return;
    const action = state.busy.action;
    state.busy = null;
    state.washScrub = 0;
    updateDepthSort();
    applyActionEffect(action);
    tempFaceState = 'happy';
    tempFaceUntil = Date.now() + 700;
    if (ACTION_DONE_SPEECH[action]) showSpeech(ACTION_DONE_SPEECH[action], 2000);
    // 밥 먹고 나면 5~10초 안에 용변
    if (action === 'feed') {
      const delay = 5000 + Math.random() * 5000;
      setTimeout(() => {
        if (_spawnMessOn(state)) {
          flashBubble(state.messes[state.messes.length - 1].type === 'poop' ? '💩' : '💧');
          saveState(); render();
        }
      }, delay);
    }
    saveState();
    render();
  }

  // 진행 중 게이지 element
  let busyGaugeEl = null;
  function ensureBusyGauge() {
    const stageEl = document.querySelector('.stage');
    if (!stageEl) return null;
    let el = stageEl.querySelector('.busy-gauge');
    if (!el) {
      el = document.createElement('div');
      el.className = 'busy-gauge';
      el.innerHTML = '<div class="bg-emo"></div><div class="bg-bar"><div class="bg-fill"></div></div>';
      stageEl.appendChild(el);
    }
    busyGaugeEl = el;
    return el;
  }
  function removeBusyGauge() {
    const stageEl = document.querySelector('.stage');
    const el = stageEl?.querySelector('.busy-gauge');
    if (el) el.remove();
    busyGaugeEl = null;
  }

  // 씻기 인터랙티브 — 문지르기(드래그) 누적 거리 30px당 청결 +1
  const SCRUB_PIXELS_PER_POINT = 30;
  let scrubLastX = null, scrubLastY = null, scrubAccum = 0, scrubBubbleCooldown = 0;

  function spawnScrubBubble(clientX, clientY) {
    const stageEl = document.querySelector('.stage');
    const tub = stageEl?.querySelector('.prop-bathtub');
    const host = tub || stageEl;
    if (!host) return;
    const r = host.getBoundingClientRect();
    const sp = document.createElement('span');
    sp.className = 'bath-scrub';
    sp.textContent = ['✨','🫧','💧'][Math.floor(Math.random()*3)];
    sp.style.left = ((clientX - r.left) / r.width * 100) + '%';
    sp.style.top  = ((clientY - r.top)  / r.height * 100) + '%';
    host.appendChild(sp);
    setTimeout(() => sp.remove(), 600);
  }

  let scrubActive = false;
  function scrubMove(clientX, clientY) {
    if (!state.busy || state.busy.action !== 'wash') return;
    if (!scrubActive) return; // 누른 상태에서만 인정 — hover/proximity 무시
    if (scrubLastX === null) { scrubLastX = clientX; scrubLastY = clientY; return; }
    const dx = clientX - scrubLastX, dy = clientY - scrubLastY;
    const dist = Math.hypot(dx, dy);
    scrubLastX = clientX; scrubLastY = clientY;
    if (dist <= 0) return;
    scrubAccum += dist;
    let added = 0;
    while (scrubAccum >= SCRUB_PIXELS_PER_POINT) {
      state.clean = clamp(state.clean + 1);
      scrubAccum -= SCRUB_PIXELS_PER_POINT;
      added += 1;
    }
    if (added > 0) {
      const now = performance.now();
      if (now - scrubBubbleCooldown > 80) {
        spawnScrubBubble(clientX, clientY);
        scrubBubbleCooldown = now;
      }
      puppyWrap.style.setProperty('--scrub-tilt', (dx >= 0 ? '3deg' : '-3deg'));
      puppyWrap.classList.add('scrub-tilt');
      clearTimeout(scrubMove._t);
      scrubMove._t = setTimeout(() => puppyWrap.classList.remove('scrub-tilt'), 120);
      try { if (added >= 2) SOUNDS.splash(); } catch {}
      render();
      // 청결 100 도달 시 축하 + 자동 종료
      if (state.clean >= 100 && state.busy?.action === 'wash') {
        scrubReset();
        // 콘페티 + 큰 글씨
        const stageEl = document.querySelector('.stage');
        if (stageEl) {
          const cel = document.createElement('div');
          cel.className = 'wash-celebrate';
          cel.textContent = '깨끗해졌어요! ✨';
          stageEl.appendChild(cel);
          setTimeout(() => cel.remove(), 1400);
          for (let i = 0; i < 14; i++) {
            const c = document.createElement('span');
            c.className = 'wash-confetti';
            c.textContent = ['✨','🫧','💧','💖','⭐'][Math.floor(Math.random()*5)];
            c.style.left = (10 + Math.random()*80) + '%';
            c.style.animationDelay = (Math.random()*0.3) + 's';
            stageEl.appendChild(c);
            setTimeout(() => c.remove(), 1300);
          }
        }
        try { SOUNDS.fanfare(); } catch {}
        // 살짝 딜레이 후 종료 (축하 보고 마무리)
        setTimeout(() => finishBusy(), 600);
      }
    }
  }
  function scrubReset() { scrubActive = false; scrubLastX = scrubLastY = null; }

  const stageEl_ = document.querySelector('.stage');
  if (stageEl_) {
    stageEl_.addEventListener('pointerdown', (e) => {
      if (state.busy?.action !== 'wash') return;
      e.preventDefault();
      scrubActive = true;
      scrubLastX = e.clientX; scrubLastY = e.clientY;
    });
    stageEl_.addEventListener('pointermove', (e) => {
      if (state.busy?.action !== 'wash') return;
      if (!scrubActive) return;
      if (e.pointerType === 'mouse' && e.buttons === 0) { scrubReset(); return; }
      scrubMove(e.clientX, e.clientY);
    });
    stageEl_.addEventListener('pointerup', scrubReset);
    stageEl_.addEventListener('pointerleave', scrubReset);
    stageEl_.addEventListener('pointercancel', scrubReset);
    // 보조: touch 명시적
    stageEl_.addEventListener('touchstart', (e) => {
      if (state.busy?.action !== 'wash') return;
      scrubActive = true;
      const t = e.touches[0];
      if (t) { scrubLastX = t.clientX; scrubLastY = t.clientY; }
    }, { passive: false });
    stageEl_.addEventListener('touchmove', (e) => {
      if (state.busy?.action !== 'wash') return;
      if (!scrubActive) return;
      e.preventDefault();
      const t = e.touches[0];
      if (t) scrubMove(t.clientX, t.clientY);
    }, { passive: false });
    stageEl_.addEventListener('touchend', scrubReset);
    stageEl_.addEventListener('touchcancel', scrubReset);
  }

  // 액션별 prop (욕조/쿠션/그릇) 관리
  function ensureProp(action) {
    const propHost = document.querySelector('.stage');
    if (!propHost) return null;
    let el = propHost.querySelector('.action-prop');
    const desired = { feed: 'bowl', wash: 'bathtub', sleep: 'cushion' }[action];
    if (!desired) { if (el) el.remove(); return null; }
    if (!el || el.dataset.kind !== desired) {
      if (el) el.remove();
      el = document.createElement('div');
      el.className = 'action-prop prop-' + desired;
      el.dataset.kind = desired;
      if (desired === 'bathtub') {
        el.innerHTML = `
          <div class="bath-label">🛁 씻는 중!</div>
          <div class="bath-pct-wrap"><div class="bath-pct">0%</div></div>
          <div class="bath-bubbles">
            <span style="left:8%;animation-delay:.1s">✨</span>
            <span style="left:24%;animation-delay:.5s">✨</span>
            <span style="left:42%;animation-delay:.2s">✨</span>
            <span style="left:62%;animation-delay:.7s">✨</span>
            <span style="left:80%;animation-delay:.3s">✨</span>
          </div>
          <div class="bath-water"></div>
          <div class="bath-rim"></div>
          <button type="button" class="bath-stop" aria-label="그만하기">그만하기</button>
        `;
        // 그만하기 — 즉시 종료 (현재 청결값 그대로, 트레이드오프만 적용)
        el.querySelector('.bath-stop').addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          if (state.busy?.action === 'wash') finishBusy();
        });
        // 인터랙티브 — 욕조 영역에서 일어나는 pointerdown은 stage 핸들러가 흡수.
        // (별도 처리 불필요)
      } else if (desired === 'cushion') {
        el.innerHTML = `
          <div class="cushion-zzz">
            <span class="z z1">Z</span><span class="z z2">Z</span><span class="z z3">Z</span>
          </div>
          <div class="cushion-pad"></div>
        `;
      } else if (desired === 'bowl') {
        el.innerHTML = `
          <div class="bowl-rim"></div>
          <div class="bowl-food"></div>
        `;
      }
      propHost.appendChild(el);
    }
    return el;
  }
  function removeProp() {
    const el = document.querySelector('.stage .action-prop');
    if (el) el.remove();
  }

  // 매 100ms render 갱신용 tick
  setInterval(() => {
    if (state.busy) {
      const now = Date.now();
      const { startedAt, endsAt, action } = state.busy;
      // 시간 기반 종료 — endsAt 있을 때만
      if (endsAt && now >= endsAt) { finishBusy(); }
      else {
        removeBusyGauge();
        ensureProp(action);
        if (action === 'wash') puppyWrap.classList.add('is-bathing');
        else puppyWrap.classList.remove('is-bathing');
        if (action === 'sleep') puppyWrap.classList.add('is-on-cushion');
        else puppyWrap.classList.remove('is-on-cushion');
      }
    } else {
      removeBusyGauge();
      removeProp();
      puppyWrap.classList.remove('is-bathing', 'is-on-cushion');
    }
    const busy = !!state.busy && Date.now() < state.busy.endsAt;
    document.querySelectorAll('.action').forEach(b => b.classList.toggle('is-busy', busy));
    document.querySelectorAll('.icon-btn').forEach(b => b.classList.toggle('is-busy', busy));
  }, 100);

  function triggerEvolveFx() {
    evolveAnimUntil = Date.now() + 1500;
    puppyWrap.classList.add('is-evolving');
    evolveFx.classList.add('show');
    SOUNDS.evolve();
    setTimeout(() => {
      puppyWrap.classList.remove('is-evolving');
      evolveFx.classList.remove('show');
    }, 1500);
  }

  // ----- Time of day ------------------------------------------------------
  function currentTod() {
    if (timeOverride) return timeOverride;
    return timeOfDayFor(new Date());
  }

  function applyTod() {
    const tod = currentTod();
    if (root.dataset.tod !== tod) {
      root.dataset.tod = tod;
    }
    if (todBadge) todBadge.textContent = TOD_LABEL[tod];
    // 시즌 — 월 기반이라 빠르게 안 변하지만 같이 갱신
    const sId = currentSeason();
    const s = SEASONS[sId];
    if (root.dataset.season !== sId) root.dataset.season = sId;
    if (seasonBadge && s) { seasonBadge.textContent = s.emoji + ' ' + s.name; seasonBadge.hidden = false; }
  }
  // 시간대 갱신 — 5분마다 + 페이지 visibility 회복 시 즉시
  setInterval(applyTod, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') applyTod();
  });

  // ----- Render -----------------------------------------------------------
  function pickPuppyState() {
    const now = Date.now();
    if (tempFaceState && now < tempFaceUntil) return tempFaceState;

    // 아플 때 — sad sprite 우선 (게이지 정상이어도 슬픔)
    if (state.sick) return 'sad';

    // 게이지 ≤30% 가장 낮은 거에 우선순위 부여
    const lows = GAUGES.filter(g => state[g] <= 30);
    if (lows.length) {
      const lowest = lows.sort((a, b) => state[a] - state[b])[0];
      return GAUGE_MOODS[lowest]?.sprite || 'sad';
    }

    const avg = GAUGES.reduce((s, g) => s + state[g], 0) / GAUGES.length;
    const tod = currentTod();
    // 자동 sleeping은 에너지 매우 낮을 때만 (≤20). 그 이상이면 깨어있음.
    if (state.energy <= 20) return 'sleeping';
    if (avg >= 75) return 'happy';
    return 'idle';
  }

  // species별 sprite 라우팅.
  // - dog: assets/{stage}/{mood}.png + breed CSS hue-rotate
  // - cat/rabbit/hamster: assets/{breed}/{mood}.png — breed별 sprite에 색 하드코딩
  const VALID_MOODS = new Set(['idle', 'happy', 'eating', 'sad', 'sleeping']);
  const NON_DOG_SPECIES = new Set(['cat', 'rabbit', 'hamster']);
  function decideSpriteSrc(mood, stage) {
    const m = VALID_MOODS.has(mood) ? mood : 'idle';
    const sp = state.species || 'dog';
    if (NON_DOG_SPECIES.has(sp) && state.breed) {
      return `assets/${state.breed}/${m}.png`;
    }
    const s = stage || state.stage || 'puppy';
    return `assets/${s}/${m}.png`;
  }

  // ----- Render — 분할된 부분 함수들 ---------------------------------------
  // 각 함수는 독립적으로 호출 가능 → 후속 최적화에서 변경된 영역만 갱신 가능.
  // render()는 호환성 유지를 위해 모두 호출.

  function renderGauges() {
    const isWashing = state.busy?.action === 'wash';
    for (const g of GAUGES) {
      const v = state[g];
      const els = gaugeEls[g];
      if (!els) continue;
      els.circle.style.setProperty('--pct', v);
      els.circle.style.setProperty('--col', colorForGauge(g, v));
      els.pct.textContent = v;
      els.circle.classList.toggle('is-critical', v <= 20);
      els.root.classList.toggle('is-washing', isWashing && g === 'clean');
      els.root.classList.toggle('is-dim', isWashing && g !== 'clean');
    }
    // 욕조 prop 안 청결 % 표시
    const tubPct = document.querySelector('.prop-bathtub .bath-pct');
    if (tubPct) tubPct.textContent = state.clean + '%';
    const tubLbl = document.querySelector('.prop-bathtub .bath-label');
    if (tubLbl) tubLbl.textContent = state.clean >= 100 ? '깨끗해졌어요! ✨' : '🛁 씻는 중!';
  }

  function renderPuppyAndMood() {
    const isWashing = state.busy?.action === 'wash';
    const s = pickPuppyState();
    const stage = state.stage || 'puppy';
    const want = decideSpriteSrc(s, stage);
    if (!puppyEl.src.endsWith(want)) puppyEl.src = want;

    puppyWrap.classList.remove('is-happy','is-eating','is-sad','is-sleeping');
    if (s !== 'idle') puppyWrap.classList.add('is-' + s);

    // mood 데이터
    const crit = criticalLowGauge();
    if (crit) puppyWrap.dataset.mood = crit;
    else if (state.energy <= 20) puppyWrap.dataset.mood = 'energy';
    else delete puppyWrap.dataset.mood;

    // 청결 레벨 4단계 (씻는 중은 'clean' 강제)
    const cleanLevel = isWashing ? 'clean'
      : state.clean >= 70 ? 'clean'
      : state.clean >= 50 ? 'mild'
      : state.clean >= 30 ? 'dirty'
      : 'filthy';
    puppyWrap.dataset.cleanLevel = cleanLevel;

    // mood overlay 관리
    const stageEl = document.querySelector('.stage');
    let ov = stageEl.querySelector('.mood-overlay');
    const needOverlay = !!crit || state.energy <= 20 || cleanLevel === 'dirty' || cleanLevel === 'filthy';
    if (needOverlay) {
      if (!ov) { ov = document.createElement('div'); ov.className = 'mood-overlay'; stageEl.appendChild(ov); }
      const cls = ['mood-overlay'];
      if (crit === 'hunger') cls.push('hunger');
      else if (crit === 'happy') cls.push('happy');
      if (state.energy <= 20) cls.push('sleepy');
      if (cleanLevel === 'filthy') cls.push('filthy');
      else if (cleanLevel === 'dirty') cls.push('dirty');
      ov.className = cls.join(' ');
    } else if (ov) { ov.remove(); }
  }

  function renderActionStates() {
    const reqs = activeRequestsFor(state);
    const reqByAction = {};
    for (const [g, r] of Object.entries(reqs)) reqByAction[r.def.action] = r.severity;
    const lows = GAUGES.filter(g => state[g] <= 20);
    actionBtns.forEach(btn => {
      const a = btn.dataset.action;
      if (!a) return;
      let blocked = false;
      if (a !== 'sleep' && a !== 'minigame' && lows.length > 0) {
        const ag = ACTION_GAUGE[a];
        if (!lows.includes(ag)) blocked = true;
      }
      btn.classList.toggle('is-blocked', blocked);
      const sev = reqByAction[a];
      btn.classList.toggle('has-request', !!sev);
      btn.classList.toggle('req-critical', sev === 'hard');
    });
  }

  function renderHeaderBadges() {
    const stage = state.stage || 'puppy';
    if (root) {
      root.dataset.stage = stage;
      root.dataset.breed = state.breed || 'shiba';
    }
    if (stageBadge) {
      const meta = STAGES.find(x => x.id === stage) || STAGES[0];
      stageBadge.textContent = meta.label;
    }
    if (careBadge) {
      const careDot = document.getElementById('careDot');
      const pts = state.points || 0;
      careBadge.childNodes[0].textContent = '🌟 ' + pts;
      if (careDot) careDot.hidden = pts <= 0;
    }
    if (titleAvatar) {
      const want = decideSpriteSrc('idle');
      if (!titleAvatar.src.endsWith(want)) titleAvatar.src = want;
    }
    if (titleName) titleName.textContent = state.name || '우리 강아지';
  }

  function renderSickness() {
    if (vetBtn) vetBtn.hidden = !state.sick;
    document.body.classList.toggle('is-sick', !!state.sick);
  }

  function render() {
    renderGauges();
    renderPuppyAndMood();
    renderActionStates();
    renderHeaderBadges();
    renderAccessories();
    renderActionCooldowns();
    renderMissionDot();
    renderRoomDeco();
    renderMessLayer();
    renderPetSlots();
    renderSickness();
    applyTod();
  }

  // 강아지 요청 시스템 — 게이지가 임계 아래면 능동적으로 말풍선 + 사운드 발화.
  const REQ_DEFS = {
    hunger: { soft: 50, hard: 20, msg: '🍖 배고파!',     action: 'feed' },
    happy:  { soft: 50, hard: 20, msg: '🎮 같이 놀자!',  action: 'play_menu' },
    clean:  { soft: 50, hard: 20, msg: '🛁 씻고 싶어...', action: 'wash' },
    energy: { soft: 30, hard: 20, msg: '💤 졸려...',      action: 'sleep' },
  };
  const REQ_INTERVAL_SOFT = 30 * 1000;
  const REQ_INTERVAL_HARD = 15 * 1000;

  function activeRequestsFor(pet) {
    const out = {};
    for (const g of GAUGES) {
      const def = REQ_DEFS[g];
      if (!def) continue;
      const v = pet[g];
      if (v <= def.hard) out[g] = { def, severity: 'hard' };
      else if (v <= def.soft) out[g] = { def, severity: 'soft' };
    }
    return out;
  }

  function pickRequest(pet, reqs) {
    let pick = null;
    for (const [g, r] of Object.entries(reqs)) {
      if (r.severity === 'hard' && (!pick || pet[g] < pet[pick.g])) pick = { g, r };
    }
    if (!pick) {
      for (const [g, r] of Object.entries(reqs)) {
        if (r.severity === 'soft' && (!pick || pet[g] < pet[pick.g])) pick = { g, r };
      }
    }
    return pick;
  }

  function tickRequests() {
    if (!state.name || !state.breed) return; // setup-pending
    if (state.busy) return; // 진행 중엔 요청 X
    const now = Date.now();

    // 비활성 펫: lastReqTs만 조용히 갱신 (말풍선/사운드 X, 단 타이밍은 개별 추적)
    if (Array.isArray(state.pets)) {
      for (const pet of state.pets) {
        if (pet.id === state.activePetId) continue;
        if (!pet.name || !pet.breed) continue;
        if (!pet.lastReqTs) pet.lastReqTs = {};
        const reqs = activeRequestsFor(pet);
        const pick = pickRequest(pet, reqs);
        if (!pick) continue;
        const interval = pick.r.severity === 'hard' ? REQ_INTERVAL_HARD : REQ_INTERVAL_SOFT;
        const last = pet.lastReqTs[pick.g] || 0;
        if (now - last >= interval) {
          pet.lastReqTs[pick.g] = now; // 타이밍 기록만, 표시 X
        }
      }
    }

    // 활성 펫: 말풍선 + 사운드 발화
    if (!state.lastReqTs) state.lastReqTs = {};
    const reqs = activeRequestsFor(state);
    const pick = pickRequest(state, reqs);
    if (!pick) return;
    const interval = pick.r.severity === 'hard' ? REQ_INTERVAL_HARD : REQ_INTERVAL_SOFT;
    const last = state.lastReqTs[pick.g] || 0;
    if (now - last < interval) return;
    state.lastReqTs[pick.g] = now;
    // 만화 speech bubble로 강아지 머리 위에 띄움
    showSpeech(pick.r.def.msg, pick.r.severity === 'hard' ? 4000 : 3000);
    if (pick.r.severity === 'hard') {
      try { SOUNDS.whimper(); } catch {}
    } else {
      try { SOUNDS.bounce(); } catch {}
    }
    saveState();
  }

  // 1초마다 요청 평가
  setInterval(tickRequests, 1000);

  // ----- 강아지 자율 이동 (wander) ---------------------------------------
  // idle/happy 상태일 때만 이동. busy/거부/편집/미니게임 중 정지.
  // wanderX/Y는 state(pet)에 저장. 글로벌 변수는 폐기.
  // state 초기 진입 시 기본값 보장
  if (typeof state.wanderX !== 'number') state.wanderX = 50;
  if (typeof state.wanderY !== 'number') state.wanderY = 86;
  function wanderActive() {
    if (state.busy) return false;
    if (criticalLowGauge()) return false;
    if (document.body.classList.contains('is-editing-room')) return false;
    if (activeModal) return false;
    const s = pickPuppyState();
    return s === 'idle' || s === 'happy';
  }
  const WANDER_MSGS = {
    idle: [
      '오늘 날씨 좋다~ 🌤️',
      '심심하다... 뭐 없나?',
      '낮잠 자고 싶어 😴',
      '간식 생각나는데 🍖',
      '저기 뭐지? 👀',
      '콧노래 흥얼흥얼~ 🎵',
      '창문 밖에 새가 있어! 🐦',
      '방이 참 아늑하다 🏠',
      '스트레칭~ 💪',
      '뒹굴뒹굴...',
      '발바닥이 간지럽다 🐾',
      '배꼽이 어디있지? 🤔',
      '오늘도 평화로운 하루~',
      '낙엽이 생각나는 날이야 🍂',
      '꼬리가 잘 흔들리네 🐕',
      '으음~ 기지개 켜기!',
      '아무것도 안 하는 중 🙄',
      '응... 그냥 걷는 중',
      '이리저리 탐험 중 🗺️',
      '방 구석구석 살펴보는 중',
    ],
    happy: [
      '너무 행복해요! 💖',
      '최고의 하루야! 🌟',
      '신나신나~ 🎉',
      '킁킁 좋은 냄새~',
      '오늘 기분 최고 😄',
      '뛰어다니고 싶어! 🏃',
      '꼬리가 저절로 흔들려요 🐕',
      '주인이 최고야! 💕',
      '세상이 다 아름다워 🌈',
      '히히 기분 너무 좋아',
      '나 웃고 있지? 😁',
      '오늘 뭐 맛있는 거 먹었어! 😋',
      '왈왈! 신난다!',
      '행복해서 폴짝폴짝 🐾',
      '오늘도 최고야 최고!',
      '이 기분 영원했으면~ 💫',
      '사랑 넘쳐 흘러요 💗',
      '세상에서 제일 행복한 강아지',
      '콧노래가 절로 나와 🎶',
      '지금 이 순간이 좋아 ✨',
    ],
    sad: [
      '왜 이렇게 슬프지... 😢',
      '누가 놀아줬으면 좋겠어...',
      '혼자 있기 싫어 😞',
      '기분이 별로야... 💧',
      '저 구석에 가서 있을래',
      '뭔가 허전해 😔',
      '나 괜찮아... 괜찮아...',
      '오늘은 좀 외롭다 🌧️',
      '꼬리가 안 올라가 ㅠ',
      '빨리 기분 나아졌으면 좋겠어',
      '왜 이렇게 우울하지...',
      '누군가 쓰다듬어줬으면...',
      '조용히 있고 싶어',
      '오늘은 많이 힘들어 😿',
      '기운이 없어요...',
      '기다리는 중이야... 🥺',
      '날이 왜 이렇게 흐리지',
      '나 지금 많이 슬퍼',
      '혼자 걷는 게 슬프다',
      '주인이 더 봐줬으면 해 🥺',
    ],
    eating: [
      '냠냠냠... 맛있어! 🍖',
      '오늘 밥 진짜 맛있다!',
      '더 주면 안 돼요? 😋',
      '꿀꺽꿀꺽~',
      '배부르게 먹어야지 😤',
    ],
    sleeping: [
      '쿨쿨... 💤',
      '꿈에서 뛰어놀고 있어 🐾',
      '음냐음냐...',
      'zzz... 🌙',
      '좋은 꿈 꾸는 중 🌟',
    ],
  };
  const _wanderMsgIdx = {};


  function wanderTick() {
    if (!wanderActive()) return;
    const oldX = state.wanderX || 50;
    state.wanderX = 12 + Math.random() * 76;
    state.wanderY = 78 + Math.random() * 14;
    if (puppyWrap) {
      puppyWrap.dataset.direction = state.wanderX < oldX ? 'left' : 'right';
      puppyWrap.style.left = state.wanderX + '%';
      puppyWrap.style.bottom = (100 - state.wanderY) + '%';
      puppyWrap.style.removeProperty('right');
      const stageEl = document.querySelector('.stage');
      if (stageEl) {
        const fp = document.createElement('div');
        fp.className = 'wander-footprint';
        fp.textContent = '🐾';
        fp.style.left = oldX + '%';
        fp.style.bottom = (100 - state.wanderY) + '%';
        stageEl.appendChild(fp);
        setTimeout(() => fp.remove(), 1800);
      }
      updateDepthSort();

    }
  }
  setInterval(() => {
    if (Math.random() < 0.3) wanderTick();
  }, 2500);

  // 방랑 말풍선 — 5~10초 랜덤 인터벌
  function scheduleWanderSpeech() {
    const delay = 5000 + Math.random() * 5000;
    setTimeout(() => {
      // 요청/액션 말풍선이 이미 떠있거나 busy/모달 중이면 건너뜀
      if (!state.busy && !activeModal && !__speechEl) {
        const s = pickPuppyState(); // 'idle' | 'happy' | 'sad' | 'eating' | 'sleeping'
        const pool = WANDER_MSGS[s] || WANDER_MSGS.idle;
        const idx = _wanderMsgIdx[s] ?? 0;
        showSpeech(pool[idx % pool.length], 2800);
        _wanderMsgIdx[s] = (idx + 1) % pool.length;
      }
      scheduleWanderSpeech();
    }, delay);
  }
  scheduleWanderSpeech();

  // Y 기반 depth sort — 강아지와 deco/furn 아이템 z-index를 Y 좌표로 동적 설정.
  // 강아지가 화면상 더 아래(=Y%가 큰)면 앞에. 위면 뒤에 가려짐.
  function updateDepthSort() {
    if (!puppyWrap) return;
    // 씻는 중 or 방 편집 중: action-prop(z:6) / room-edit-panel(z:90) 아래로
    const isBusy = !!state.busy;
    const isEditing = document.body.classList.contains('is-editing-room');
    puppyWrap.style.zIndex = (isBusy || isEditing) ? '3' : String(Math.floor((state.wanderY || 86) * 10));
    // back layer 안 deco-item / furn-item: Y 좌표 기반 z-index
    document.querySelectorAll('#decoLayerBack .deco-item, #decoLayerBack .furn-item').forEach(el => {
      const top = parseFloat(el.style.top || '50');
      el.style.zIndex = Math.floor(top * 10);
    });
    // front layer (나비/새/풍선/별): 항상 강아지 위 — 큰 값
    document.querySelectorAll('#decoLayerFront .deco-item').forEach(el => {
      el.style.zIndex = 9999;
    });
  }

  // 방 데코 — state.roomLayout을 메인 stage에 렌더 (배경/전경 분리)
  // 종류별 z-index 분류: 바닥류는 deco-back, 떠다니는 류는 deco-front
  const DECO_LAYER = {
    bone: 'back', flower: 'back', gem: 'back', gift: 'back',
    butter: 'front', bird: 'front', balloon: 'front', star: 'front',
  };
  function renderRoomDeco() {
    const back = document.getElementById('decoLayerBack');
    const front = document.getElementById('decoLayerFront');
    if (!back || !front) return;
    back.innerHTML = ''; front.innerHTML = '';
    // 장식품
    const layout = state.roomLayout || [];
    layout.forEach((it, idx) => {
      const def = ROOM_ITEMS[it.kind];
      if (!def) return;
      const layer = DECO_LAYER[it.kind] === 'front' ? front : back;
      const el = document.createElement('div');
      el.className = 'deco-item deco-' + it.kind;
      el.textContent = def.emoji;
      el.style.left = it.x + '%';
      el.style.top  = it.y + '%';
      if (it.scale) el.style.setProperty('--item-scale', it.scale);
      el.dataset.idx = idx;
      attachItemInteraction(el, 'deco', idx);
      layer.appendChild(el);
    });
    // 가구 — 항상 back layer (강아지 뒤)
    const fl = state.furnitureLayout || [];
    fl.forEach((it, idx) => {
      const def = FURNITURE[it.kind];
      if (!def) return;
      const el = document.createElement('div');
      el.className = 'furn-item furn-' + it.kind;
      el.textContent = def.emoji;
      el.style.left = it.x + '%';
      el.style.top  = it.y + '%';
      if (it.scale) el.style.setProperty('--item-scale', it.scale);
      el.dataset.idx = idx;
      attachItemInteraction(el, 'furn', idx);
      back.appendChild(el);
    });
    // 벽지/바닥 — stage data 속성으로
    const stageEl = document.querySelector('.stage');
    if (stageEl) {
      stageEl.dataset.wallpaper = state.wallpaper || 'default';
      stageEl.dataset.floor = state.floor || 'default';
    }
    // Y 기반 z-index 정렬
    updateDepthSort();
  }

  function renderAccessories() {
    const slots = [
      { slot: 'hat',     el: accHatEl },
      { slot: 'neck',    el: accNeckEl },
      { slot: 'feet',    el: accFeetEl },
    ];
    for (const { slot, el } of slots) {
      const id = state.equipped[slot];
      if (!id) {
        el.classList.remove('show');
        el.innerHTML = '';
        continue;
      }
      const acc = ACCESSORIES.find(a => a.id === id);
      if (!acc) continue;
      el.classList.add('show');
      el.innerHTML = `<img src="assets/accessories/${acc.id}.png" alt="${acc.name}" />`;
    }
  }

  function renderActionCooldowns() {
    const mgBtn = document.querySelector('.action[data-action="minigame"]');
    if (!mgBtn) return;
    const remain = minigameCooldownRemain();
    if (remain > 0) {
      mgBtn.disabled = true;
      const sec = Math.ceil(remain / 1000);
      let cdEl = mgBtn.querySelector('.cooldown');
      if (!cdEl) { cdEl = document.createElement('span'); cdEl.className = 'cooldown'; mgBtn.appendChild(cdEl); }
      cdEl.textContent = sec + '초';
    } else {
      mgBtn.disabled = false;
      const cdEl = mgBtn.querySelector('.cooldown');
      if (cdEl) cdEl.remove();
    }
  }

  setInterval(() => {
    if (tempFaceState && Date.now() >= tempFaceUntil) {
      tempFaceState = null;
      render();
    }
    renderActionCooldowns();
  }, 250);

  // ----- Modal system -----------------------------------------------------
  let activeModal = null;

  function openModal({ title, sub, body, mandatory = false, onClose = null }) {
    closeModal(true);
    modalRoot.hidden = false;
    if (mandatory) modalRoot.classList.add('modal-mandatory');
    else modalRoot.classList.remove('modal-mandatory');
    const m = document.createElement('div');
    m.className = 'modal';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    if (!mandatory) {
      const close = document.createElement('button');
      close.className = 'modal-close';
      close.type = 'button';
      close.setAttribute('aria-label', '닫기');
      close.textContent = '✕';
      close.addEventListener('click', () => closeModal());
      m.appendChild(close);
    }
    if (title) {
      const h = document.createElement('h2');
      h.className = 'modal-title';
      h.textContent = title;
      m.appendChild(h);
    }
    if (sub) {
      const p = document.createElement('p');
      p.className = 'modal-sub';
      p.textContent = sub;
      m.appendChild(p);
    }
    if (body) m.appendChild(body);
    modalRoot.innerHTML = '';
    modalRoot.appendChild(m);
    activeModal = { mandatory, onClose };
  }

  function closeModal(silent = false) {
    if (!activeModal) { modalRoot.hidden = true; return; }
    const cb = activeModal.onClose;
    activeModal = null;
    modalRoot.innerHTML = '';
    modalRoot.hidden = true;
    if (cb && !silent) try { cb(); } catch {}
  }

  // ESC key + 액션 단축키 (1/2/3/4)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activeModal && !activeModal.mandatory) { closeModal(); return; }
    // 입력 폼 포커스 중이거나 modifier 누르면 무시
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const tag = (e.target && e.target.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.target && e.target.isContentEditable) return;
    // 모달 열려 있으면 액션 단축키 비활성
    if (activeModal) return;
    const map = { '1': 'feed', '2': 'play_menu', '3': 'wash', '4': 'sleep' };
    const action = map[e.key];
    if (!action) return;
    const btn = document.querySelector(`.action[data-action="${action}"]`);
    if (btn) { e.preventDefault(); btn.click(); }
  });
  // backdrop click
  modalRoot.addEventListener('click', (e) => {
    if (e.target === modalRoot && activeModal && !activeModal.mandatory) closeModal();
  });

  // ----- P2.1 / P2.4: 이름/종 첫 진입 ------------------------------------
  function openNameModal({ initial = state.name, mandatory = false, onSet = null } = {}) {
    const body = document.createElement('div');
    const input = document.createElement('input');
    input.className = 'modal-input';
    input.type = 'text';
    input.maxLength = 20; // 여유 있게 (모바일 IME 조합 안전)
    input.placeholder = '예: 콩이, 뽀삐';
    input.value = initial || '';
    input.autocomplete = 'off';
    input.autocapitalize = 'off';
    input.spellcheck = false;
    input.setAttribute('inputmode', 'text');
    input.setAttribute('enterkeyhint', 'done');
    body.appendChild(input);
    const btn = document.createElement('button');
    btn.className = 'modal-btn';
    btn.type = 'button';
    btn.textContent = '확인';
    body.appendChild(btn);
    const hint = document.createElement('p');
    hint.className = 'modal-hint';
    hint.textContent = '한글/영문 1~12자';
    body.appendChild(hint);

    function commit() {
      // Array.from으로 한글/이모지 등 단일 char 안전 자르기, 12자까지
      const v = Array.from((input.value || '').trim()).slice(0, 12).join('');
      if (!v) { input.focus(); return; }
      state.name = v;
      saveState();
      render();
      SOUNDS.fanfare();
      closeModal();
      if (onSet) onSet(v);
    }
    btn.addEventListener('click', commit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(); });

    openModal({
      title: mandatory ? '강아지 이름을 지어주세요' : '강아지 이름 바꾸기',
      sub: mandatory ? '귀여운 이름을 골라봐요!' : '새 이름은 12자 이내로 적어주세요',
      body, mandatory,
    });
    setTimeout(() => input.focus(), 100);
  }

  function openBreedModal({ mandatory = false } = {}) {
    const body = document.createElement('div');
    const grid = document.createElement('div');
    grid.className = 'breed-grid';
    let picked = state.breed || BREEDS[0].id;
    BREEDS.forEach(b => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'breed-card' + (b.id === picked ? ' selected' : '');
      card.dataset.id = b.id;
      card.innerHTML = `
        <div class="swatch"><img src="assets/breeds/${b.id}.png" alt="${b.name}" /></div>
        <div class="name">${b.name}</div>
        <div class="desc">${b.desc}</div>
      `;
      card.addEventListener('click', () => {
        picked = b.id;
        grid.querySelectorAll('.breed-card').forEach(c => c.classList.toggle('selected', c.dataset.id === picked));
        SOUNDS.pop();
      });
      grid.appendChild(card);
    });
    body.appendChild(grid);
    const btn = document.createElement('button');
    btn.className = 'modal-btn';
    btn.type = 'button';
    btn.textContent = mandatory ? '이 친구로 시작!' : '바꾸기';
    body.appendChild(btn);
    if (!mandatory) {
      const hint = document.createElement('p');
      hint.className = 'modal-hint';
      hint.textContent = '종 변경은 케어포인트 500점이 필요해요';
      body.appendChild(hint);
    }

    btn.addEventListener('click', () => {
      if (!mandatory && state.breed && picked !== state.breed) {
        if ((state.points || 0) < 500) { return; }
        state.points -= 500;
      }
      state.breed = picked;
      const meta = BREEDS.find(b => b.id === picked);
      state.species = meta?.species || 'dog';
      saveState();
      render();
      SOUNDS.fanfare();
      closeModal();
    });

    openModal({
      title: mandatory ? '어떤 강아지가 좋아?' : '강아지 종 바꾸기',
      sub: mandatory ? '한 번 정한 친구는 오랫동안 함께 해요' : '500점이 필요해요',
      body, mandatory,
    });
  }

  // ----- P2.5: 일일 미션 --------------------------------------------------
  function todayKey() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }

  function ensureTodayMissions() {
    const today = todayKey();
    if (state.missions && state.missions.date === today && state.missions.list && state.missions.list.length) return;
    const pool = MISSION_TEMPLATES.slice();
    // shuffle simple
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    // 시즌 한정 미션 1개를 가장 위에 고정 + 일반 풀에서 2개
    const seasonal = SEASONAL_MISSIONS[currentSeason()];
    const picked = [
      { ...seasonal, seasonal: true, progress: 0, claimed: false },
      ...pool.slice(0, 2).map(t => ({ ...t, progress: 0, claimed: false })),
    ];
    state.missions = { date: today, list: picked };
    saveState();
  }

  function progressMission(action, n) {
    if (!state.missions || !state.missions.list) return;
    // 'minigame'은 'play' 미션도 같이 진행시킴 (놀아주기 카운트 포함)
    const matchActions = action === 'minigame' ? ['minigame', 'play'] : [action];
    let any = false;
    for (const m of state.missions.list) {
      if (matchActions.includes(m.action) && m.progress < m.count) {
        m.progress = Math.min(m.count, m.progress + n);
        any = true;
        if (m.progress >= m.count && !m.claimed) {
          m.claimed = true;
          state.points = (state.points || 0) + m.reward;
          SOUNDS.fanfare();
          flashBubble('🎉');
        }
      }
    }
    if (any) saveState();
  }

  function flashBubble(emoji) {
    bubbleEl.textContent = emoji;
    bubbleEl.classList.add('show');
    clearTimeout(bubbleEl._t);
    bubbleEl._t = setTimeout(() => bubbleEl.classList.remove('show'), 1100);
  }

  // 미니게임 결과 모달 (등급 배지 + 큰 카운트 + 보상 박스)
  function openResultModal({ title, bigCount, countLabel, badge, tier, rewards }) {
    const body = document.createElement('div');
    body.className = 'result-body tier-' + (tier || 'ok');

    const big = document.createElement('div');
    big.className = 'result-bigcount';
    big.innerHTML = `<span class="num">${bigCount}</span><span class="lbl">${countLabel}</span>`;
    body.appendChild(big);

    const bd = document.createElement('div');
    bd.className = 'result-badge';
    bd.textContent = badge;
    body.appendChild(bd);

    const rewBox = document.createElement('div');
    rewBox.className = 'result-rewards';
    const rewHead = document.createElement('div');
    rewHead.className = 'result-rew-head';
    rewHead.textContent = '받은 보상';
    rewBox.appendChild(rewHead);
    rewards.forEach(([emo, name, val]) => {
      const row = document.createElement('div');
      row.className = 'result-rew-row';
      row.innerHTML = `<span class="e">${emo}</span><span class="n">${name}</span><span class="v">${val}</span>`;
      rewBox.appendChild(row);
    });
    body.appendChild(rewBox);

    const ok = document.createElement('button');
    ok.type = 'button'; ok.className = 'modal-btn'; ok.textContent = '좋아요!';
    ok.addEventListener('click', () => closeModal());
    body.appendChild(ok);

    openModal({ title, body, mandatory: true });
  }

  // 만화 speech bubble — 강아지 머리 위 텍스트
  let __speechEl = null;
  function showSpeech(text, durationMs = 3500) {
    if (!puppyWrap) return;
    if (__speechEl) { try { __speechEl.remove(); } catch {} __speechEl = null; }
    const el = document.createElement('div');
    el.className = 'speech-bubble';
    el.textContent = text;
    puppyWrap.appendChild(el);
    __speechEl = el;
    setTimeout(() => {
      el.classList.add('fade');
      setTimeout(() => { try { el.remove(); } catch {}; if (__speechEl === el) __speechEl = null; }, 250);
    }, durationMs);
  }

  // 게이지 변화 floating text — 원형 게이지 위에 +N / -N 1초 띄움
  function showGaugeDelta(g, delta) {
    const els = gaugeEls[g];
    if (!els) return;
    const fl = document.createElement('div');
    fl.className = 'gauge-float ' + (delta > 0 ? 'up' : 'down');
    fl.textContent = (delta > 0 ? '+' : '') + delta;
    els.root.appendChild(fl);
    setTimeout(() => fl.remove(), 1100);
  }

  function renderMissionDot() {
    if (!missionDot) return;
    const incomplete = (state.missions?.list || []).some(m => m.progress < m.count);
    missionDot.hidden = !incomplete;
  }

  function openMissionsModal() {
    ensureTodayMissions();
    const body = document.createElement('div');
    const list = document.createElement('div');
    list.className = 'mission-list';
    state.missions.list.forEach(m => {
      const item = document.createElement('div');
      const done = m.progress >= m.count;
      item.className = 'mission-item' + (done ? ' done' : '') + (m.seasonal ? ' seasonal' : '');
      item.innerHTML = `
        <span class="emo">${m.emoji}</span>
        <div class="body">
          <div class="name">${m.seasonal ? '<span class="mission-season-tag">시즌 한정</span> ' : ''}${m.name}</div>
          <div class="progress">${m.progress} / ${m.count}</div>
        </div>
        <div class="reward">${done ? '✓' : '+'}${m.reward}🌟</div>
      `;
      list.appendChild(item);
    });
    body.appendChild(list);
    const hint = document.createElement('p');
    hint.className = 'modal-hint';
    hint.textContent = '매일 자정에 새 미션이 도착해요';
    hint.style.marginTop = '12px';
    body.appendChild(hint);
    openModal({ title: '오늘의 미션', body });
  }

  // ----- P2.3: 상점 -------------------------------------------------------
  let __shopTab = 'hat';
  function openShopModal() {
    const body = document.createElement('div');
    const head = document.createElement('div');
    head.className = 'shop-care';
    head.innerHTML = `보유: <span class="pts">🌟 ${state.points || 0}점</span>`;
    body.appendChild(head);

    // 5 부위 탭
    const tabs = document.createElement('div');
    tabs.className = 'shop-tabs';
    for (const slot of ['hat','neck','feet']) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'shop-tab' + (slot === __shopTab ? ' active' : '');
      b.textContent = ACC_SLOT_NAMES[slot];
      b.addEventListener('click', () => { __shopTab = slot; openShopModal(); });
      tabs.appendChild(b);
    }
    body.appendChild(tabs);

    const grid = document.createElement('div');
    grid.className = 'shop-grid';
    ACCESSORIES.filter(a => a.slot === __shopTab).forEach(acc => {
      const owned = !!state.inventory[acc.id];
      const equipped = state.equipped[acc.slot] === acc.id;
      const item = document.createElement('div');
      item.className = 'shop-item' + (equipped ? ' equipped' : (owned ? ' owned' : ''));
      const status = equipped ? '장착중' : (owned ? '보유' : '🌟 ' + acc.price);
      item.innerHTML = `
        <div class="icon-wrap"><img src="assets/accessories/${acc.id}.png" alt="${acc.name}" /></div>
        <div>${acc.name}</div>
        <div class="price">${status}</div>
      `;
      const btn = document.createElement('button');
      btn.type = 'button';
      if (!owned) {
        btn.textContent = '구매';
        btn.disabled = (state.points || 0) < acc.price;
        btn.addEventListener('click', () => {
          if ((state.points || 0) < acc.price) return;
          state.points -= acc.price;
          state.inventory[acc.id] = true;
          state.equipped[acc.slot] = acc.id; // 자동 장착
          saveState();
          SOUNDS.cash();
          render();
          openShopModal(); // 다시 그림
        });
      } else if (equipped) {
        btn.textContent = '벗기';
        btn.className = 'unequip';
        btn.addEventListener('click', () => {
          state.equipped[acc.slot] = null;
          saveState();
          SOUNDS.pop();
          render();
          openShopModal();
        });
      } else {
        btn.textContent = '장착';
        btn.className = 'equip';
        btn.addEventListener('click', () => {
          state.equipped[acc.slot] = acc.id;
          saveState();
          SOUNDS.pop();
          render();
          openShopModal();
        });
      }
      item.appendChild(btn);
      grid.appendChild(item);
    });
    body.appendChild(grid);

    const hint = document.createElement('p');
    hint.className = 'modal-hint';
    hint.textContent = '🌟 점수는 강아지를 돌볼 때마다 모여요';
    hint.style.marginTop = '12px';
    body.appendChild(hint);

    openModal({ title: '🛍️ 상점', body });
  }

  // ----- 강아지 방 (수집 아이템 배치) -----------------------------------
  // 산책 등에서 모은 아이템을 방에 배치. state.roomInv는 카운트, state.roomLayout은
  // 배치된 아이템 [{kind, x, y}] (x,y는 방 영역 0~100% 비율).
  const ROOM_ITEMS = {
    bone:    { emoji: '🦴', name: '뼈다귀' },
    flower:  { emoji: '🌸', name: '꽃' },
    butter:  { emoji: '🦋', name: '나비' },
    bird:    { emoji: '🐦', name: '새' },
    balloon: { emoji: '🎈', name: '풍선' },
    star:    { emoji: '⭐', name: '별' },
    gem:     { emoji: '💎', name: '보석' },
    gift:    { emoji: '🎁', name: '선물' },
  };

  // 가구 카탈로그 (배치형)
  const FURNITURE = {
    sofa:     { emoji: '🛋️', name: '소파' },
    bed:      { emoji: '🛏️', name: '침대' },
    plant:    { emoji: '🪴', name: '화분' },
    chair:    { emoji: '🪑', name: '의자' },
    mirror:   { emoji: '🪞', name: '거울' },
    picture:  { emoji: '🖼️', name: '액자' },
    tv:       { emoji: '📺', name: 'TV' },
    bookshelf:{ emoji: '📚', name: '책장' },
    lamp:     { emoji: '🪔', name: '등불' },
  };

  // 벽지/바닥 카탈로그 — id → CSS 적용
  const WALLPAPERS = {
    default:   { name: '기본 베이지' },
    pink_dot:  { name: '분홍 도트' },
    blue_stripe: { name: '하늘 줄무늬' },
    star_pattern: { name: '별달 패턴' },
    bear:      { name: '곰돌이 패턴' },
    rainbow:   { name: '무지개' },
  };
  const FLOORS = {
    default:   { name: '장판' },
    wood:      { name: '나무 마루' },
    carpet_red: { name: '빨강 카펫' },
    carpet_blue: { name: '파랑 카펫' },
    wool:      { name: '양털 카펫' },
    tile:      { name: '격자 타일' },
  };

  let __roomPickedKind = null;
  let __roomEditPanelEl = null;
  let __roomSelectedItem = null; // { type:'deco'|'furn', idx, el }
  let __roomDragState = null;

  function clearRoomSelection() {
    if (__roomSelectedItem) {
      __roomSelectedItem.el.classList.remove('room-item-selected');
      __roomSelectedItem = null;
    }
    document.getElementById('roomItemToolbar')?.remove();
  }

  // 아이템/툴바 외부 클릭 시 선택 해제
  document.addEventListener('pointerdown', (e) => {
    if (!__roomSelectedItem) return;
    if (e.target.closest('.deco-item, .furn-item, #roomItemToolbar')) return;
    clearRoomSelection();
  }, true);

  function showItemToolbar(type, idx, el) {
    document.getElementById('roomItemToolbar')?.remove();
    const layout = type === 'deco' ? state.roomLayout : state.furnitureLayout;
    const it = layout[idx];
    if (!it) return;

    const toolbar = document.createElement('div');
    toolbar.id = 'roomItemToolbar';
    toolbar.className = 'room-item-toolbar';
    toolbar.innerHTML = `
      <button class="rit-btn" data-act="smaller" title="작게">－</button>
      <button class="rit-btn" data-act="bigger"  title="크게">＋</button>
      <button class="rit-btn rit-delete" data-act="delete" title="회수">🗑️</button>
    `;
    toolbar.addEventListener('click', (e) => {
      e.stopPropagation();
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      const it2 = layout[idx];
      if (!it2) return;
      if (act === 'delete') {
        if (type === 'deco') {
          state.roomInv[it2.kind] = (state.roomInv[it2.kind] || 0) + 1;
          state.roomLayout.splice(idx, 1);
        } else {
          state.furnitureInv[it2.kind] = (state.furnitureInv[it2.kind] || 0) + 1;
          state.furnitureLayout.splice(idx, 1);
        }
        clearRoomSelection();
        saveState(); render(); renderEditPanel();
        return;
      }
      const cur = it2.scale || 1;
      it2.scale = act === 'bigger'
        ? Math.min(3, Math.round((cur + 0.25) * 100) / 100)
        : Math.max(0.5, Math.round((cur - 0.25) * 100) / 100);
      el.style.setProperty('--item-scale', it2.scale);
      saveState();
    });
    document.querySelector('.stage').appendChild(toolbar);
    positionToolbar(toolbar, el);
  }

  function positionToolbar(toolbar, el) {
    const stageR = document.querySelector('.stage').getBoundingClientRect();
    const elR = el.getBoundingClientRect();
    let top = elR.top - stageR.top - 44;
    let left = elR.left - stageR.left + elR.width / 2;
    if (top < 4) top = elR.bottom - stageR.top + 6;
    toolbar.style.top  = top + 'px';
    toolbar.style.left = left + 'px';
  }

  function attachItemInteraction(el, type, idx) {
    let dragMoved = false;
    let dragStartX, dragStartY, dragStartLeft, dragStartTop;

    el.addEventListener('pointerdown', (e) => {
      if (__roomPickedKind) return; // 배치 모드 중엔 드래그 안 함
      e.stopPropagation();
      e.preventDefault();
      dragMoved = false;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      const layout = type === 'deco' ? state.roomLayout : state.furnitureLayout;
      const it = layout[idx];
      if (!it) return;
      dragStartLeft = it.x;
      dragStartTop  = it.y;
      el.setPointerCapture(e.pointerId);
    });

    el.addEventListener('pointermove', (e) => {
      if (!el.hasPointerCapture(e.pointerId)) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      if (Math.hypot(dx, dy) > 4) dragMoved = true;
      if (!dragMoved) return;
      const stageR = document.querySelector('.stage').getBoundingClientRect();
      const layout = type === 'deco' ? state.roomLayout : state.furnitureLayout;
      const it = layout[idx];
      if (!it) return;
      const nx = Math.max(2, Math.min(98, dragStartLeft + (dx / stageR.width) * 100));
      const ny = Math.max(4, Math.min(96, dragStartTop  + (dy / stageR.height) * 100));
      it.x = nx; it.y = ny;
      el.style.left = nx + '%';
      el.style.top  = ny + '%';
      const tb = document.getElementById('roomItemToolbar');
      if (tb) positionToolbar(tb, el);
    });

    el.addEventListener('pointerup', (e) => {
      if (!dragMoved) {
        // 탭 → 선택/선택해제
        if (__roomSelectedItem?.el === el) {
          clearRoomSelection();
        } else {
          clearRoomSelection();
          __roomSelectedItem = { type, idx, el };
          el.classList.add('room-item-selected');
          showItemToolbar(type, idx, el);
        }
      } else {
        saveState();
        const tb = document.getElementById('roomItemToolbar');
        if (tb) positionToolbar(tb, el);
      }
      dragMoved = false;
    });
  }

  // 🏠 버튼 = 편집 모드 토글. 메인 stage에서 직접 아이템 배치/회수 가능.
  function openRoomModal() {
    if (document.body.classList.contains('is-editing-room')) {
      exitRoomEdit();
    } else {
      enterRoomEdit();
    }
  }

  function enterRoomEdit() {
    document.body.classList.add('is-editing-room');
    updateDepthSort();
    __roomPickedKind = null;
    showSpeech('방을 꾸며볼까요? 아이템을 골라 탭해요! 🏠', 3000);
    // 편집 패널 — 화면 하단 고정
    const panel = document.createElement('div');
    panel.id = 'roomEditPanel';
    panel.className = 'room-edit-panel';
    document.body.appendChild(panel);
    __roomEditPanelEl = panel;
    renderEditPanel();

    // stage 클릭 핸들러 — 배치 모드일 때만 작동
    const stageEl = document.querySelector('.stage');
    if (stageEl && !stageEl.__roomClickBound) {
      stageEl.addEventListener('click', stageRoomEditClick);
      stageEl.__roomClickBound = true;
    }
  }

  function exitRoomEdit() {
    clearRoomSelection();
    document.body.classList.remove('is-editing-room');
    updateDepthSort();
    __roomPickedKind = null;
    if (__roomEditPanelEl) { __roomEditPanelEl.remove(); __roomEditPanelEl = null; }
    saveState();
    render();
  }

  // 편집 모드 — 어떤 탭의 어떤 카드가 picked인가
  let __editTab = 'deco'; // deco | furn | wallpaper | floor

  function stageRoomEditClick(e) {
    if (!document.body.classList.contains('is-editing-room')) return;
    // 아이템/툴바 클릭은 무시
    if (e.target.closest('.deco-item, .furn-item, #roomItemToolbar')) return;
    // 배치 모드가 아니면 선택 해제만
    if (!__roomPickedKind) { clearRoomSelection(); return; }

    const stageEl = e.currentTarget;
    const r = stageEl.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top)  / r.height) * 100;
    if (__editTab === 'deco') {
      const inv = state.roomInv[__roomPickedKind] || 0;
      if (inv <= 0) { __roomPickedKind = null; renderEditPanel(); return; }
      const def = ROOM_ITEMS[__roomPickedKind];
      state.roomLayout.push({ kind: __roomPickedKind, x: Math.max(2, Math.min(98, x)), y: Math.max(4, Math.min(94, y)) });
      state.roomInv[__roomPickedKind] -= 1;
      if (state.roomInv[__roomPickedKind] <= 0) __roomPickedKind = null;
      showSpeech(`${def?.emoji || ''} 여기 좋다! ✨`, 1800);
    } else if (__editTab === 'furn') {
      const inv = state.furnitureInv[__roomPickedKind] || 0;
      if (inv <= 0) { __roomPickedKind = null; renderEditPanel(); return; }
      const def = FURNITURE[__roomPickedKind];
      state.furnitureLayout.push({ kind: __roomPickedKind, x: Math.max(8, Math.min(92, x)), y: Math.max(40, Math.min(90, y)) });
      state.furnitureInv[__roomPickedKind] -= 1;
      if (state.furnitureInv[__roomPickedKind] <= 0) __roomPickedKind = null;
      showSpeech(`${def?.emoji || ''} 여기 좋다! ✨`, 1800);
    }
    saveState();
    render();
    renderEditPanel();
  }

  function renderEditPanel() {
    const panel = __roomEditPanelEl;
    if (!panel) return;
    panel.innerHTML = '';

    // 탭 버튼들
    const tabs = document.createElement('div');
    tabs.className = 'room-edit-tabs';
    [
      { id: 'deco',      label: '🌟 장식' },
      { id: 'furn',      label: '🛋️ 가구' },
      { id: 'wallpaper', label: '🎨 벽지' },
      { id: 'floor',     label: '🟫 바닥' },
    ].forEach(t => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'room-edit-tab' + (t.id === __editTab ? ' active' : '');
      b.textContent = t.label;
      b.addEventListener('click', () => {
        __editTab = t.id; __roomPickedKind = null; renderEditPanel();
      });
      tabs.appendChild(b);
    });
    panel.appendChild(tabs);

    const head = document.createElement('div');
    head.className = 'room-edit-head';
    if (__editTab === 'deco' || __editTab === 'furn') {
      const cat = __editTab === 'deco' ? ROOM_ITEMS : FURNITURE;
      head.textContent = __roomPickedKind
        ? `📍 ${cat[__roomPickedKind]?.name || ''} 둘 자리 탭하세요`
        : '카드 탭 → 방에 배치';
    } else if (__editTab === 'wallpaper') {
      head.textContent = '벽지 골라요 (즉시 적용)';
    } else if (__editTab === 'floor') {
      head.textContent = '바닥 골라요 (즉시 적용)';
    }
    panel.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'room-edit-grid';
    if (__editTab === 'deco') {
      const entries = Object.entries(state.roomInv || {}).filter(([_, c]) => c > 0);
      if (!entries.length) appendEmpty(grid, '산책 가서 모아 봐요! 🚶');
      else entries.forEach(([kind, count]) => {
        const def = ROOM_ITEMS[kind]; if (!def) return;
        appendItemCard(grid, def, count, kind, () => {
          const picking = __roomPickedKind !== kind;
          __roomPickedKind = picking ? kind : null;
          if (picking) showSpeech(`${def.emoji} ${def.name} 어디에 둘까요?`, 2500);
          renderEditPanel();
        });
      });
    } else if (__editTab === 'furn') {
      const entries = Object.entries(state.furnitureInv || {}).filter(([_, c]) => c > 0);
      if (!entries.length) appendEmpty(grid, '가구는 산책에서 발견해요 🪴');
      else entries.forEach(([kind, count]) => {
        const def = FURNITURE[kind]; if (!def) return;
        appendItemCard(grid, def, count, kind, () => {
          const picking = __roomPickedKind !== kind;
          __roomPickedKind = picking ? kind : null;
          if (picking) showSpeech(`${def.emoji} ${def.name} 어디에 둘까요?`, 2500);
          renderEditPanel();
        });
      });
    } else if (__editTab === 'wallpaper') {
      Object.entries(WALLPAPERS).forEach(([id, def]) => {
        const owned = id === 'default' || (state.styleInv && state.styleInv['wp_' + id]);
        appendStyleCard(grid, def.name, '🎨', id === state.wallpaper, !owned, () => {
          if (!owned) return;
          state.wallpaper = id;
          saveState(); render(); renderEditPanel();
        });
      });
    } else if (__editTab === 'floor') {
      Object.entries(FLOORS).forEach(([id, def]) => {
        const owned = id === 'default' || (state.styleInv && state.styleInv['fl_' + id]);
        appendStyleCard(grid, def.name, '🟫', id === state.floor, !owned, () => {
          if (!owned) return;
          state.floor = id;
          saveState(); render(); renderEditPanel();
        });
      });
    }
    panel.appendChild(grid);

    const done = document.createElement('button');
    done.type = 'button';
    done.className = 'modal-btn';
    done.textContent = '완료';
    done.addEventListener('click', exitRoomEdit);
    panel.appendChild(done);

    const hint = document.createElement('p');
    hint.className = 'modal-hint';
    hint.textContent = (__editTab === 'deco' || __editTab === 'furn') ? '배치된 것 탭하면 회수' : '잠긴 것은 산책에서 발견해요';
    panel.appendChild(hint);
  }
  function appendEmpty(grid, msg) {
    const e = document.createElement('div'); e.className = 'room-inv-empty'; e.textContent = msg; grid.appendChild(e);
  }
  function appendItemCard(grid, def, count, kind, onClick) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'room-inv-card' + (__roomPickedKind === kind ? ' picked' : '');
    card.innerHTML = `<span class="emo">${def.emoji}</span><span class="name">${def.name}</span><span class="count">×${count}</span>`;
    card.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    grid.appendChild(card);
  }
  function appendStyleCard(grid, name, emoji, isCurrent, locked, onClick) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'room-inv-card' + (isCurrent ? ' picked' : '') + (locked ? ' locked' : '');
    card.innerHTML = `<span class="emo">${emoji}</span><span class="name">${name}</span><span class="count">${locked ? '🔒' : (isCurrent ? '✓' : '선택')}</span>`;
    card.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    grid.appendChild(card);
  }

  // ----- 놀이 메뉴 + 미니게임 ------------------------------------------
  // 게임별 쿨타임은 state.playLast[id], 동일하게 5분.
  function playCooldownRemain(id) {
    const last = (state.playLast && state.playLast[id]) || 0;
    return Math.max(0, MINIGAME_COOLDOWN_MS - (Date.now() - last));
  }
  function markPlayDone(id) {
    if (!state.playLast) state.playLast = {};
    state.playLast[id] = Date.now();
    if (id === 'ball') state.minigameLastTs = Date.now(); // 하위 호환
    if (typeof logGuardianAction === 'function') logGuardianAction('minigame');
  }

  function minigameCooldownRemain() { return playCooldownRemain('ball'); }

  // 놀이 카탈로그 — walk는 항상 마지막 (메뉴에서 두 칸 차지)
  const PLAY_GAMES = [
    { id: 'ball',  name: '공놀이',     emoji: '🎾', desc: '공 받기 (30초)',         open: () => openMinigame() },
    { id: 'pet',   name: '풍선 터뜨리기', emoji: '🎈', desc: '3초 안에 풍선 터뜨리기! (30초)', open: () => openPetGame() },
    { id: 'dance', name: '춤추기',     emoji: '🎵', desc: '박자 맞추기 (30초)',       open: () => openDanceGame() },
    { id: 'treat', name: '간식 받기',   emoji: '🦴', desc: '많이 받기 (30초)',         open: () => openTreatGame() },
    { id: 'seq',   name: '발자국 따라가기', emoji: '🐾', desc: '순서대로 누르기',           open: () => openSequenceGame() },
    { id: 'hide',  name: '숨바꼭질',    emoji: '🌳', desc: '숨은 강아지 찾기 (30초)',     open: () => openHideSeekGame() },
    { id: 'match', name: '짝 맞추기',   emoji: '🃏', desc: '같은 카드 찾기 (60초)',       open: () => openMatchGame() },
    { id: 'bury',  name: '뼈 묻기',     emoji: '⛰️', desc: '묻은 뼈 위치 기억!',         open: () => openBuryGame() },
    { id: 'walk',  name: '산책',       emoji: '🚶', desc: '아이템 찾기 (30초)',       open: () => openWalkGame() },
  ];

  function openPlayMenu() {
    const body = document.createElement('div');
    const grid = document.createElement('div');
    grid.className = 'play-grid';
    const cards = []; // {el, id, cdEl, lastCool}
    PLAY_GAMES.forEach(g => {
      const cd = playCooldownRemain(g.id);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'play-card' + (cd > 0 ? ' is-cooling' : '') + (g.id === 'walk' ? ' play-card-wide' : '');
      const cdEl = document.createElement('div');
      cdEl.className = 'cd';
      if (cd <= 0) cdEl.style.display = 'none';
      else {
        const sec = Math.ceil(cd / 1000);
        const mm = Math.floor(sec / 60), ss = sec % 60;
        cdEl.textContent = `${mm}:${String(ss).padStart(2,'0')}`;
      }
      card.innerHTML = `
        <div class="emo">${g.emoji}</div>
        <div class="name">${g.name}</div>
        <div class="desc">${g.desc}</div>
      `;
      card.appendChild(cdEl);
      card.addEventListener('click', () => {
        if (playCooldownRemain(g.id) > 0) { SOUNDS.pop(); return; }
        SOUNDS.pop();
        closeModal();
        setTimeout(() => g.open(), 80);
      });
      grid.appendChild(card);
      cards.push({ el: card, id: g.id, cdEl });
    });
    body.appendChild(grid);
    const hint = document.createElement('p');
    hint.className = 'modal-hint';
    hint.textContent = '한 번 놀고 나면 5분 후에 다시 놀 수 있어요';
    hint.style.marginTop = '12px';
    body.appendChild(hint);

    // 1초마다 쿨다운 시간 갱신.
    // 모달이 다른 모달로 교체될 때 closeModal(silent=true)가 onClose를
    // 호출하지 않아 interval이 leak되는 것을 방지하기 위해 매 tick마다
    // DOM 부착 여부를 직접 체크한다.
    const refresher = setInterval(() => {
      if (!cards.length || !cards[0].el.isConnected) {
        clearInterval(refresher);
        return;
      }
      cards.forEach(c => {
        const cd = playCooldownRemain(c.id);
        if (cd <= 0) {
          c.el.classList.remove('is-cooling');
          c.cdEl.style.display = 'none';
        } else {
          c.el.classList.add('is-cooling');
          const sec = Math.ceil(cd / 1000);
          const mm = Math.floor(sec / 60), ss = sec % 60;
          c.cdEl.textContent = `${mm}:${String(ss).padStart(2,'0')}`;
          c.cdEl.style.display = '';
        }
      });
    }, 1000);

    openModal({
      title: '🎉 놀이 골라요',
      body,
      onClose: () => { clearInterval(refresher); },
    });
  }

  // ----- 풍선 터뜨리기: 풍선 3초 안에 탭, 못 누르면 끝 (최대 30초) ----------
  function openPetGame() {
    decayPaused = true;
    const body = document.createElement('div');
    const guide = document.createElement('div');
    guide.className = 'mg-guide';
    guide.innerHTML = `🎈 풍선이 나오면 <b>3초 안에 터뜨려요!</b> 놓치면 끝! <span class="mg-diff">${diffLabel()}</span>`;
    body.appendChild(guide);

    const stats = document.createElement('div');
    stats.className = 'minigame-stats';
    const timeEl = document.createElement('span');
    const comboEl = document.createElement('span');
    const scoreEl = document.createElement('span');
    timeEl.textContent = '⏱ 30';
    comboEl.textContent = '';
    scoreEl.textContent = '🎈 0';
    stats.appendChild(timeEl); stats.appendChild(comboEl); stats.appendChild(scoreEl);
    body.appendChild(stats);

    const tBar = document.createElement('div'); tBar.className = 'mg-timebar';
    const tFill = document.createElement('div'); tFill.className = 'mg-timebar-fill';
    tBar.appendChild(tFill); body.appendChild(tBar);

    const arena = document.createElement('div');
    arena.className = 'minigame-arena big balloon-arena';
    arena.dataset.breed = state.breed || 'shiba';

    // 강아지 — 바닥 가운데
    const dogWrap = document.createElement('div');
    dogWrap.className = 'balloon-dog-wrap';
    const dog = document.createElement('img');
    dog.className = 'mg-dog balloon-dog';
    dog.src = decideSpriteSrc('happy');
    dogWrap.appendChild(dog);
    arena.appendChild(dogWrap);

    body.appendChild(arena);

    const endBtn = document.createElement('button');
    endBtn.className = 'modal-btn secondary'; endBtn.type = 'button'; endBtn.textContent = '끝내기';
    endBtn.style.marginTop = '6px';
    body.appendChild(endBtn);

    // 게임 상태
    let popped = 0, escaped = 0, score = 0, combo = 0, maxCombo = 0;
    let endedFlag = false;
    const TOTAL = 30000;
    const _diff = diffMul();
    // 어린이 난이도 — 쉬움 1.5초 / 보통 1초 / 어려움 0.5초
    const SPAWN_MS = _diff < 1.1 ? 1500 : _diff < 1.25 ? 1000 : 500;
    const LIFE_MS = 3000;                 // 3초 안에 안 누르면 자동 폭발 → 게임 끝
    const started = performance.now();
    let lastSpawn = -SPAWN_MS;
    let lastPopAt = -9999;
    const balloons = []; // {el, x, y, color, birthTs, popped}

    const COLORS = ['#ff7aa1','#5eb8ff','#7ad06e','#ffc94a','#c685ff','#ff9466'];
    function arenaRect() { return arena.getBoundingClientRect(); }

    function spawnBalloon() {
      const r = arenaRect();
      // 화면 랜덤 위치 — 강아지 영역(아래쪽 100px) + 가장자리 회피
      const x = 35 + Math.random() * (r.width - 70);
      const y = 35 + Math.random() * (r.height - 140);
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const el = document.createElement('div');
      el.className = 'balloon';
      el.style.background = color;
      el.style.boxShadow = `inset -6px -8px 0 rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.18)`;
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.transform = 'scale(0)';
      arena.appendChild(el);
      balloons.push({ el, x, y, color, birthTs: performance.now(), popped: false });
    }

    let dogJumpUntil = 0;
    function jumpDogTo(targetX) {
      // 강아지를 풍선의 x 위치까지 점프시킴 + 위로 솟구침
      const r = arenaRect();
      const dW = dogWrap.getBoundingClientRect();
      const dx = Math.max(0, Math.min(r.width - dW.width, targetX - dW.width / 2));
      // 점프 높이 (콤보 따라 더 높이)
      const h = 60 + Math.min(40, combo * 4);
      dogWrap.style.transition = 'transform 280ms cubic-bezier(0.22, 1.4, 0.4, 1)';
      dogWrap.style.transform = `translateX(${dx - (r.width / 2 - dW.width / 2)}px) translateY(${-h}px)`;
      dogJumpUntil = performance.now() + 350;
    }

    function spawnPopFx(x, y, color) {
      // 폭발 — 작은 점들이 사방으로
      const N = 8;
      for (let i = 0; i < N; i++) {
        const p = document.createElement('div');
        p.className = 'balloon-burst';
        p.style.left = x + 'px';
        p.style.top = y + 'px';
        p.style.background = color;
        const angle = (Math.PI * 2 * i) / N + Math.random() * 0.3;
        const speed = 50 + Math.random() * 40;
        p.style.setProperty('--dx', `${Math.cos(angle) * speed}px`);
        p.style.setProperty('--dy', `${Math.sin(angle) * speed}px`);
        arena.appendChild(p);
        setTimeout(() => p.remove(), 600);
      }
      // 펑 텍스트
      const pop = document.createElement('div');
      pop.className = 'balloon-pop-txt';
      pop.textContent = '펑!';
      pop.style.left = x + 'px';
      pop.style.top = y + 'px';
      arena.appendChild(pop);
      setTimeout(() => pop.remove(), 600);
    }

    function popBalloon(b) {
      if (b.popped) return;
      b.popped = true;
      const r = arenaRect();
      const cx = b.x;
      const cy = b.y;
      // 콤보 — 1.5초 안에 연속 터뜨리면 콤보 +
      const now = performance.now();
      if (now - lastPopAt < 1500) combo += 1;
      else combo = 1;
      if (combo > maxCombo) maxCombo = combo;
      lastPopAt = now;
      popped += 1;
      const gain = 10 + Math.min(40, (combo - 1) * 2);
      score += gain;
      scoreEl.textContent = '🎈 ' + popped;
      comboEl.textContent = combo > 1 ? `🔥 ${combo}` : '';
      // 강아지 점프 + 풍선 터지는 사운드
      jumpDogTo(cx);
      spawnPopFx(cx, cy, b.color);
      try { SOUNDS.catch(); } catch {}
      // 풍선 element 제거
      b.el.classList.add('popped');
      setTimeout(() => { try { b.el.remove(); } catch {} }, 200);
    }

    function onTap(e) {
      if (endedFlag) return;
      const t = e.touches && e.touches[0] ? e.touches[0] : e;
      if (e.preventDefault) e.preventDefault();
      const r = arenaRect();
      const cx = (t.clientX !== undefined) ? (t.clientX - r.left) : 0;
      const cy = (t.clientY !== undefined) ? (t.clientY - r.top) : 0;
      // 가장 가까운 미터짐 풍선 (탭 위치에서 60px 이내)
      let best = null, bestD = 60;
      for (const b of balloons) {
        if (b.popped) continue;
        const d = Math.hypot(b.x - cx, b.y - cy);
        if (d < bestD) { bestD = d; best = b; }
      }
      if (best) popBalloon(best);
      else { try { SOUNDS.pop(); } catch {} }
    }
    arena.addEventListener('click', onTap);
    arena.addEventListener('touchstart', onTap, { passive: false });

    let lastFrame = started;
    function step(now) {
      if (endedFlag) return;
      const dt = Math.min(40, now - lastFrame) / 1000;
      lastFrame = now;
      const elapsed = now - started;
      const remain = Math.max(0, TOTAL - elapsed);
      timeEl.textContent = '⏱ ' + Math.ceil(remain / 1000);
      tFill.style.width = (remain / TOTAL * 100) + '%';
      if (remain < TOTAL / 3) tFill.classList.add('low'); else tFill.classList.remove('low');

      // spawn — 마지막 LIFE_MS는 정지 (놓친 폭발 방지)
      if (remain > LIFE_MS && now - lastSpawn >= SPAWN_MS) {
        lastSpawn = now;
        spawnBalloon();
      }

      // 풍선 — 점점 커지면서 점점 흔들림. LIFE_MS 지나면 자동 폭발 → 게임 끝.
      for (let i = balloons.length - 1; i >= 0; i--) {
        const b = balloons[i];
        if (b.popped) continue;
        const age = now - b.birthTs;
        const ratio = Math.min(1, age / LIFE_MS);
        // 흔들림 — 시간 지날수록 진폭 ↑ (나이 ratio 비례)
        const wobAmp = ratio * 14;                       // 최대 14도
        const wobAngle = Math.sin(now * 0.04) * wobAmp;
        // 스케일 — 마지막 15%에 부풀음 강조
        let scale = ratio;
        if (ratio > 0.85) scale = 1 + (ratio - 0.85) * 1.5;
        b.el.style.transform = `rotate(${wobAngle}deg) scale(${scale})`;

        if (age >= LIFE_MS) {
          // 자동 폭발 — 즉시 게임 종료
          b.popped = true;
          escaped += 1;
          spawnPopFx(b.x, b.y, b.color);
          try { SOUNDS.whimper(); } catch {}
          b.el.classList.add('popped');
          setTimeout(() => { try { b.el.remove(); } catch {} }, 200);
          balloons.splice(i, 1);
          endGame();
          return;
        }
      }

      // 강아지 점프 복귀 — 살짝 지연 후 원래 위치로
      if (now > dogJumpUntil) {
        dogWrap.style.transform = 'translateX(0) translateY(0)';
      }

      if (remain <= 0) { endGame(); return; }
      requestAnimationFrame(step);
    }

    function endGame() {
      if (endedFlag) return;
      endedFlag = true;
      decayPaused = false;
      // 남은 풍선 정리
      while (balloons.length) { try { balloons[0].el.remove(); } catch {}; balloons.shift(); }

      // 0.5초 게임 — 놓치면 끝나므로 popped 개수가 곧 살아남은 결과
      let happyGain, careBoost, badge, tier;
      if (popped >= 15)     { happyGain = 50; careBoost = 2; badge = '⭐ 최고예요!';   tier = 'best'; }
      else if (popped >= 10){ happyGain = 35; careBoost = 1; badge = '👍 잘했어요!';   tier = 'good'; }
      else if (popped >= 5) { happyGain = 22; careBoost = 1; badge = '🙂 좋아요!';     tier = 'ok';   }
      else                   { happyGain = 10; careBoost = 0; badge = '😅 다시 도전!'; tier = 'low'; }
      state.happy = clamp(state.happy + happyGain);
      for (let i = 0; i < careBoost; i++) {
        state.careLastTick = (state.careLastTick || 0) - CARE_TICK_MS;
        addCareScore();
      }
      state.points = (state.points || 0) + Math.floor(score / 4);
      markPlayDone('pet');
      progressMission('minigame', 1);
      saveState(); render(); SOUNDS.fanfare();
      openResultModal({
        title: '풍선 터뜨리기 끝!',
        bigCount: popped + '개',
        countLabel: `최고 ${maxCombo} 콤보`,
        badge, tier,
        rewards: [
          ['💖', '행복', '+' + happyGain],
          ...(careBoost ? [['🌟', '케어', '+' + careBoost]] : []),
          ['🎈', '터뜨림', popped],
          ['💨', '놓친', escaped],
        ],
      });
    }

    endBtn.addEventListener('click', () => endGame());
    openModal({
      title: '🎈 풍선 터뜨리기', body, mandatory: true,
      onClose: () => { if (!endedFlag) { endedFlag = true; decayPaused = false; markPlayDone('pet'); saveState(); } },
    });
    setTimeout(() => requestAnimationFrame(step), 80);
  }

  // ----- 춤추기: 30초 박자, 박자 시점 탭하면 +5 -----------------------
  // ----- DDR 춤추기 — 4 lane 화살표 떨어뜨리기 ----------------------------
  function openDanceGame() {
    decayPaused = true;
    const body = document.createElement('div');
    const guide = document.createElement('div');
    guide.className = 'mg-guide';
    guide.innerHTML = `🎵 화살표가 내려오면 <b>맞춰서 누르기!</b> <span class="mg-diff">${diffLabel()}</span>`;
    body.appendChild(guide);

    const stats = document.createElement('div');
    stats.className = 'minigame-stats';
    const timeEl = document.createElement('span');
    const comboEl = document.createElement('span');
    const scoreEl = document.createElement('span');
    timeEl.textContent = '⏱ 30';
    comboEl.textContent = '';
    scoreEl.textContent = '🎯 0';
    stats.appendChild(timeEl); stats.appendChild(comboEl); stats.appendChild(scoreEl);
    body.appendChild(stats);

    const tBar = document.createElement('div'); tBar.className = 'mg-timebar';
    const tFill = document.createElement('div'); tFill.className = 'mg-timebar-fill';
    tBar.appendChild(tFill); body.appendChild(tBar);

    const arena = document.createElement('div');
    arena.className = 'minigame-arena big dance-arena ddr-arena';
    arena.dataset.breed = state.breed || 'shiba';

    // 4개 레인 배경
    const lanesEl = document.createElement('div');
    lanesEl.className = 'ddr-lanes';
    for (let i = 0; i < 4; i++) {
      const l = document.createElement('div');
      l.className = 'ddr-lane';
      l.dataset.lane = String(i);
      lanesEl.appendChild(l);
    }
    arena.appendChild(lanesEl);

    // 강아지 — 가운데 (히트라인 위)
    const dogWrap = document.createElement('div');
    dogWrap.className = 'ddr-dog-wrap';
    const dog = document.createElement('img');
    dog.className = 'mg-dog ddr-dog';
    dog.src = decideSpriteSrc('happy');
    dogWrap.appendChild(dog);
    arena.appendChild(dogWrap);

    // 히트 라인
    const hitLine = document.createElement('div');
    hitLine.className = 'ddr-hitline';
    arena.appendChild(hitLine);

    // 판정 팝업
    const judge = document.createElement('div');
    judge.className = 'ddr-judge';
    arena.appendChild(judge);

    // 하단 버튼 — 4 레인 컬러 원형 receptor
    const KEYS = ['ArrowLeft','ArrowUp','ArrowDown','ArrowRight'];
    const LANE_COLORS = ['#ff5d8f', '#4ea1d3', '#76c043', '#f4a623'];
    function noteSVG(lane, opts = {}) {
      const c = LANE_COLORS[lane];
      const stroke = opts.stroke || '#ffffff';
      const sw = opts.strokeWidth != null ? opts.strokeWidth : 2.5;
      const fillOpacity = opts.fillOpacity != null ? opts.fillOpacity : 1;
      return `<svg viewBox="0 0 44 44" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <circle cx="22" cy="22" r="17"
          fill="${c}" fill-opacity="${fillOpacity}"
          stroke="${stroke}" stroke-width="${sw}"/>
        <circle cx="22" cy="22" r="6"
          fill="${stroke}" fill-opacity="0.9"/>
      </svg>`;
    }
    const btnRow = document.createElement('div');
    btnRow.className = 'ddr-btns';
    const btns = [];
    for (let i = 0; i < 4; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'ddr-btn';
      b.dataset.lane = String(i);
      b.innerHTML = noteSVG(i, { stroke: 'rgba(255,255,255,0.95)', strokeWidth: 2 });
      b.setAttribute('aria-label', ['왼쪽','위','아래','오른쪽'][i]);
      btnRow.appendChild(b);
      btns.push(b);
    }
    arena.appendChild(btnRow);

    body.appendChild(arena);

    const endBtn = document.createElement('button');
    endBtn.className = 'modal-btn secondary'; endBtn.type = 'button'; endBtn.textContent = '끝내기';
    endBtn.style.marginTop = '6px';
    body.appendChild(endBtn);

    // 게임 상태
    let score = 0, combo = 0, maxCombo = 0;
    let great = 0, good = 0, miss = 0;
    let endedFlag = false;
    const TOTAL = 30000;
    const _diff = diffMul();
    const SPAWN_MS = 750 / _diff;
    const FALL_MS = 1500;
    // 음악 — 8th note (= SPAWN_MS / 2). 화살표 spawn은 매 2 step.
    const STEP_MS = SPAWN_MS / 2;
    let nextBeatAt = 0;
    let beatIdx = 0;

    function playBeat(idx) {
      const ctx = ensureAudio();
      if (!ctx) return;
      const t0 = ctx.currentTime;
      const s = idx % 8; // 8 8th note cycle (1 measure of 4/4)
      // kick — 4분음표마다 (하우스 패턴): 0,2,4,6
      if (s % 2 === 0) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(140, t0);
        o.frequency.exponentialRampToValueAtTime(48, t0 + 0.16);
        g.gain.setValueAtTime(0.22, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
        o.connect(g).connect(ctx.destination);
        o.start(t0); o.stop(t0 + 0.24);
      }
      // hihat — 오프비트(8분음표 사이): 1,3,5,7
      if (s % 2 === 1) {
        const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.04), ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource(); src.buffer = buf;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.06, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.04);
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = 6500;
        src.connect(hp).connect(g).connect(ctx.destination);
        src.start(t0); src.stop(t0 + 0.06);
      }
      // 클랩 (스네어처럼) — 2, 4박: step 2, 6
      if (s === 2 || s === 6) {
        const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.08), ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource(); src.buffer = buf;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.10, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.08);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 1.2;
        src.connect(bp).connect(g).connect(ctx.destination);
        src.start(t0); src.stop(t0 + 0.10);
      }
      // bell 멜로디 — 다운비트(0)에서 펜타토닉(C major) 무작위
      if (s === 0) {
        const NOTES = [392, 440, 523, 587, 659, 784];
        const f = NOTES[Math.floor(Math.random() * NOTES.length)];
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.05, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.30);
        o.connect(g).connect(ctx.destination);
        o.start(t0); o.stop(t0 + 0.32);
      }
      // 모든 4분음표마다 히트라인 펄스 + receptor 박자 깜빡 — 화살표 spawn과 정확히 동기
      if (s % 2 === 0) {
        try { hitLine.classList.add('beat'); setTimeout(() => hitLine.classList.remove('beat'), 110); } catch {}
        try {
          btns.forEach(b => {
            b.classList.remove('beat-pulse');
            // reflow로 애니메이션 재시작
            void b.offsetWidth;
            b.classList.add('beat-pulse');
          });
        } catch {}
      }
    }
    const HIT_GREAT_PX = 36;
    const HIT_GOOD_PX = 80;
    const started = performance.now();
    const arrows = [];

    // arena/hitLine 위치 캐싱 — 게임 중 크기가 변하지 않으므로 매 프레임 측정
    // 하지 않고 한 번만 계산. 노트8 등 구형 기기에서 매 프레임 forced
    // reflow 누적이 화살표 순간이동의 주된 원인이라 제거.
    let cachedHitY = 0;
    function recomputeHitY() {
      const r = arena.getBoundingClientRect();
      const hr = hitLine.getBoundingClientRect();
      cachedHitY = hr.top - r.top + hr.height / 2;
    }
    // 첫 프레임에 hitLine 이 layout 되도록 dual-RAF 후 측정
    requestAnimationFrame(() => requestAnimationFrame(recomputeHitY));
    const _onResize = () => recomputeHitY();
    window.addEventListener('resize', _onResize);

    function spawnArrow(scheduledTs) {
      const lane = Math.floor(Math.random() * 4);
      const el = document.createElement('div');
      el.className = 'ddr-arrow';
      el.dataset.lane = String(lane);
      el.innerHTML = noteSVG(lane);
      // 가로 위치는 spawn 시 한 번만 — 이후 매 프레임 만지지 않음
      el.style.left = `${(lane + 0.5) * 25}%`;
      // 초기 위치를 화면 위쪽으로
      el.style.transform = 'translate3d(0, -50px, 0)';
      arena.appendChild(el);
      // spawnTs를 RAF의 실제 now가 아닌 스케줄된 비트 시각으로 기록 →
      // FALL_MS 후 정확히 다음 spawn 비트와 같은 시각에 hit 라인에 도달
      arrows.push({ el, lane, spawnTs: scheduledTs, hit: false });
    }

    function showJudge(text, klass) {
      judge.textContent = text;
      judge.className = 'ddr-judge ' + klass;
      void judge.offsetWidth;
      judge.classList.add('show');
    }

    let dogJumpUntil = 0;
    function jumpDog(amount) {
      // amount 0..1 → 점프 높이
      const h = 14 + amount * 90;
      dog.style.transform = `translateY(${-h}px)`;
      dogJumpUntil = performance.now() + 350;
    }

    // 히트 시 receptor 위에서 파티클 폭발 + 링 확장
    function spawnHitBurst(lane, klass) {
      const btn = btns[lane];
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const aR = arenaRect();
      const cx = r.left - aR.left + r.width / 2;
      const cy = r.top - aR.top + r.height / 2;
      const color = LANE_COLORS[lane];
      const N = klass === 'great' ? 10 : 6;
      for (let i = 0; i < N; i++) {
        const p = document.createElement('div');
        p.className = 'ddr-burst';
        p.style.left = cx + 'px';
        p.style.top = cy + 'px';
        const angle = (Math.PI * 2 * i) / N + Math.random() * 0.4;
        const speed = 40 + Math.random() * (klass === 'great' ? 50 : 25);
        p.style.setProperty('--dx', `${Math.cos(angle) * speed}px`);
        p.style.setProperty('--dy', `${Math.sin(angle) * speed - 10}px`);
        p.style.background = color;
        p.style.boxShadow = `0 0 8px ${color}`;
        arena.appendChild(p);
        setTimeout(() => p.remove(), 600);
      }
      // 링 확장
      const ring = document.createElement('div');
      ring.className = 'ddr-ring ' + klass;
      ring.style.left = cx + 'px';
      ring.style.top = cy + 'px';
      ring.style.borderColor = color;
      arena.appendChild(ring);
      setTimeout(() => ring.remove(), 500);
      // receptor 강한 글로우
      btn.classList.add('hit-strong');
      setTimeout(() => btn.classList.remove('hit-strong'), 300);
    }

    function tryHit(lane) {
      if (endedFlag) return;
      // 시간 기반으로 화살표 위치 계산 — DOM rect 측정(forced reflow) 회피
      const hY = cachedHitY;
      const now = performance.now();
      let best = null;
      let bestDist = Infinity;
      for (const a of arrows) {
        if (a.hit || a.lane !== lane) continue;
        const t = (now - a.spawnTs) / FALL_MS;
        const y = -50 + t * (hY + 50);
        const ay = y + 25; // 화살표 50px 의 중심
        const d = Math.abs(ay - hY);
        if (d < bestDist) { bestDist = d; best = a; }
      }
      if (!best || bestDist > HIT_GOOD_PX + 30) {
        try { SOUNDS.pop(); } catch {}
        return;
      }
      let label, klass;
      if (bestDist <= HIT_GREAT_PX) {
        score += 10;
        combo += 1; if (combo > maxCombo) maxCombo = combo;
        great += 1;
        label = 'Great!'; klass = 'great';
        jumpDog(Math.min(1, 0.4 + combo / 12));
        try { SOUNDS.catch(); } catch {}
      } else {
        score += 5;
        combo += 1; if (combo > maxCombo) maxCombo = combo;
        good += 1;
        label = 'Good!'; klass = 'good';
        jumpDog(Math.min(0.6, 0.2 + combo / 18));
        try { SOUNDS.catch(); } catch {}
      }
      spawnHitBurst(lane, klass);
      showJudge(label, klass);
      best.hit = true;
      // 화살표는 즉시 제거 — burst 가 hit 효과를 대신 표현. transform 상태에서
      // scale 애니메이션을 덧입히면 위치가 (0,0) 으로 튀는 문제도 해결됨.
      try { best.el.remove(); } catch {}
      scoreEl.textContent = '🎯 ' + score;
      comboEl.textContent = combo > 1 ? `🔥 ${combo}` : '';
    }

    // 입력 — 버튼 + 키보드 화살표
    btns.forEach((b, i) => {
      const trigger = (e) => { e.preventDefault(); e.stopPropagation(); b.classList.add('press'); setTimeout(() => b.classList.remove('press'), 120); tryHit(i); };
      b.addEventListener('click', trigger);
      b.addEventListener('touchstart', trigger, { passive: false });
    });
    function onKey(e) {
      if (endedFlag) return;
      const i = KEYS.indexOf(e.key);
      if (i < 0) return;
      e.preventDefault();
      const b = btns[i];
      b.classList.add('press'); setTimeout(() => b.classList.remove('press'), 120);
      tryHit(i);
    }
    document.addEventListener('keydown', onKey);

    function step(now) {
      if (endedFlag) return;
      const elapsed = now - started;
      const remain = Math.max(0, TOTAL - elapsed);
      timeEl.textContent = '⏱ ' + Math.ceil(remain / 1000);
      tFill.style.width = (remain / TOTAL * 100) + '%';
      if (remain < 10000) tFill.classList.add('low'); else tFill.classList.remove('low');

      // 박자 음악 — 8th note 간격으로 schedule. RAF lag 시 따라잡기 위해 while 루프.
      // 화살표 spawn 도 같은 스케줄러 안에서 처리해 비트와 영구히 동기화.
      if (nextBeatAt === 0) nextBeatAt = now;
      while (now >= nextBeatAt) {
        const scheduled = nextBeatAt;
        const isSpawnBeat = beatIdx % 2 === 0; // 4분음표마다 spawn
        playBeat(beatIdx++);
        if (isSpawnBeat && remain > FALL_MS) spawnArrow(scheduled);
        nextBeatAt += STEP_MS;
      }

      // 화살표 이동 — transform 으로 GPU 합성, top/left 변경 안 함
      const hY = cachedHitY;
      for (let i = arrows.length - 1; i >= 0; i--) {
        const a = arrows[i];
        const t = (now - a.spawnTs) / FALL_MS;
        const y = -50 + t * (hY + 50);
        a.el.style.transform = `translate3d(0, ${y}px, 0)`;
        // 못 친 채 한참 지나면 miss
        if (!a.hit && y > hY + HIT_GOOD_PX + 24) {
          a.hit = true;
          miss += 1;
          combo = 0;
          comboEl.textContent = '';
          showJudge('Miss', 'miss');
          try { SOUNDS.whimper(); } catch {}
          a.el.classList.add('missed');
          setTimeout(() => { try { a.el.remove(); } catch {} }, 200);
        }
      }

      // 강아지 점프 복귀
      if (now > dogJumpUntil) dog.style.transform = 'translateY(0)';

      if (remain <= 0) { endGame(); return; }
      requestAnimationFrame(step);
    }

    function endGame() {
      if (endedFlag) return;
      endedFlag = true;
      decayPaused = false;
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', _onResize);
      while (arrows.length) { try { arrows[0].el.remove(); } catch {}; arrows.shift(); }

      const happyGain = 20 + Math.min(30, Math.floor(score / 8));
      state.happy = clamp(state.happy + happyGain);
      let careBoost = 0;
      if (great >= 15) careBoost = 2;
      else if (great >= 8) careBoost = 1;
      for (let i = 0; i < careBoost; i++) {
        state.careLastTick = (state.careLastTick || 0) - CARE_TICK_MS;
        addCareScore();
      }
      state.points = (state.points || 0) + Math.floor(score / 2);
      markPlayDone('dance');
      progressMission('minigame', 1);
      saveState(); render(); SOUNDS.fanfare();

      let badge, tier;
      if (great >= 15)     { badge = '⭐ 최고예요!';   tier = 'best'; }
      else if (great >= 8) { badge = '👍 잘했어요!';   tier = 'good'; }
      else if (great >= 3) { badge = '🙂 좋아요!';     tier = 'ok';   }
      else                  { badge = '😅 조금만 더!'; tier = 'low';  }
      openResultModal({
        title: '춤추기 끝!',
        bigCount: score + '점',
        countLabel: `최고 ${maxCombo} 콤보`,
        badge, tier,
        rewards: [
          ['💖', '행복', '+' + happyGain],
          ...(careBoost ? [['🌟', '케어', '+' + careBoost]] : []),
          ['⭐', 'Great', great],
          ['👌', 'Good', good],
          ['💔', 'Miss', miss],
        ],
      });
    }

    endBtn.addEventListener('click', () => endGame());
    openModal({
      title: '🎵 DDR 춤추기', body, mandatory: true,
      onClose: () => {
        if (!endedFlag) {
          endedFlag = true;
          decayPaused = false;
          document.removeEventListener('keydown', onKey);
          markPlayDone('dance');
          saveState();
        }
      },
    });
    setTimeout(() => requestAnimationFrame(step), 80);
  }

  // ----- 간식 받기: 위에서 떨어지는 간식을 강아지가 받음 -----------------
  function openTreatGame() {
    decayPaused = true;
    const body = document.createElement('div');
    const guide = document.createElement('div');
    guide.className = 'mg-guide';
    guide.innerHTML = `🦴 강아지로 옮겨서 <b>간식 많이 받아요!</b> (30초) <span class="mg-diff">${diffLabel()}</span>`;
    body.appendChild(guide);
    const stats = document.createElement('div');
    stats.className = 'minigame-stats';
    const timeEl = document.createElement('span');
    const gotEl = document.createElement('span');
    timeEl.textContent = '⏱ 30';
    gotEl.textContent = '🦴 0';
    stats.appendChild(timeEl);
    stats.appendChild(gotEl);
    body.appendChild(stats);
    const tBar = document.createElement('div'); tBar.className = 'mg-timebar';
    const tFill = document.createElement('div'); tFill.className = 'mg-timebar-fill';
    tBar.appendChild(tFill); body.appendChild(tBar);
    const arena = document.createElement('div');
    arena.className = 'minigame-arena big treat-arena';
    arena.dataset.breed = state.breed || 'shiba';
    const dog = document.createElement('img');
    dog.className = 'mg-dog treat-dog';
    dog.src = decideSpriteSrc('happy');
    arena.appendChild(dog);
    body.appendChild(arena);
    const endBtn = document.createElement('button');
    endBtn.className = 'modal-btn secondary'; endBtn.type = 'button'; endBtn.textContent = '끝내기';
    endBtn.style.marginTop = '6px';
    body.appendChild(endBtn);

    let got = 0;
    let endedFlag = false;
    let dogX = null;
    const TOTAL = 30000;
    const started = performance.now();
    let lastFrame = started;
    const _diff = diffMul();
    let nextSpawn = (600 + Math.random() * 400) / _diff;
    let spawnAccum = 0;
    const treats = []; // {el, x, y, vy}

    function arenaRect() { return arena.getBoundingClientRect(); }

    function spawnTreat() {
      const r = arenaRect();
      const x = 30 + Math.random() * (r.width - 60);
      const el = document.createElement('div');
      el.className = 'treat-item';
      el.textContent = ['🦴','🍪','🍖'][Math.floor(Math.random()*3)];
      el.style.left = x + 'px';
      el.style.top = '0px';
      arena.appendChild(el);
      treats.push({ el, x, y: 0, vy: 80 + Math.random() * 60 });
    }

    function onTap(e) {
      if (e) { e.stopPropagation(); if (e.preventDefault) e.preventDefault(); }
      const r = arenaRect();
      const t = e.touches && e.touches[0] ? e.touches[0] : e;
      const cx = (t.clientX !== undefined) ? (t.clientX - r.left) : (r.width / 2);
      dogX = Math.max(40, Math.min(r.width - 40, cx));
    }
    arena.addEventListener('click', onTap);
    arena.addEventListener('touchstart', onTap, { passive: false });
    arena.addEventListener('touchmove', onTap, { passive: false });

    function step(now) {
      if (endedFlag) return;
      const dt = Math.min(40, now - lastFrame) / 1000;
      lastFrame = now;
      const elapsed = now - started;
      const remain = Math.max(0, TOTAL - elapsed);
      timeEl.textContent = '⏱ ' + Math.ceil(remain / 1000);
      tFill.style.width = (remain / TOTAL * 100) + '%';
      if (remain < 10000) tFill.classList.add('low'); else tFill.classList.remove('low');

      const r = arenaRect();
      if (dogX === null) dogX = r.width / 2;
      dog.style.left = dogX + 'px';
      dog.style.transform = 'translateX(-50%)';

      // spawn
      spawnAccum += (now - (step._lastT || now));
      step._lastT = now;
      if (spawnAccum >= nextSpawn) {
        spawnAccum = 0;
        nextSpawn = (700 + Math.random() * 600) / _diff;
        spawnTreat();
      }
      // update treats
      for (let i = treats.length - 1; i >= 0; i--) {
        const t = treats[i];
        t.vy += 200 * dt;
        t.y += t.vy * dt;
        t.el.style.top = t.y + 'px';
        // 강아지 머리 zone
        const dogY = r.height - 60;
        if (t.y >= dogY - 30 && Math.abs(t.x - dogX) < 50) {
          got += 1;
          gotEl.textContent = '🦴 ' + got;
          state.hunger = clamp(state.hunger + 2);
          try { SOUNDS.eat(); } catch {}
          flashBubble('😋');
          t.el.remove();
          treats.splice(i, 1);
          // 30초 타이머 끝까지 — 더 많이 받을수록 더 좋은 등급
          continue;
        }
        if (t.y > r.height + 40) { t.el.remove(); treats.splice(i, 1); }
      }

      if (remain <= 0) { endGame(); return; }
      requestAnimationFrame(step);
    }

    function endGame() {
      if (endedFlag) return;
      endedFlag = true;
      decayPaused = false;
      while (treats.length) { try { treats[0].el.remove(); } catch {}; treats.shift(); }
      // 차등 보상
      let happyGain, hungerGain, careBoost;
      if (got >= 8)      { happyGain = 40; hungerGain = 20; careBoost = 2; }
      else if (got >= 5) { happyGain = 30; hungerGain = 15; careBoost = 1; }
      else if (got >= 3) { happyGain = 20; hungerGain = 10; careBoost = 1; }
      else                { happyGain = 10; hungerGain = 5;  careBoost = 0; }
      state.happy  = clamp(state.happy + happyGain);
      state.hunger = clamp(state.hunger + hungerGain);
      for (let i = 0; i < careBoost; i++) {
        state.careLastTick = (state.careLastTick || 0) - CARE_TICK_MS;
        addCareScore();
      }
      state.points = (state.points || 0) + got * 4;
      markPlayDone('treat');
      progressMission('minigame', 1);
      saveState(); render(); SOUNDS.fanfare();
      let badge, tier;
      if (got >= 8)      { badge = '⭐ 최고예요!';   tier = 'best'; }
      else if (got >= 5) { badge = '👍 잘했어요!';   tier = 'good'; }
      else if (got >= 3) { badge = '🙂 좋아요!';     tier = 'ok'; }
      else                { badge = '😅 조금만 더!'; tier = 'low'; }
      openResultModal({
        title: '간식 받기 끝!',
        bigCount: got + '개',
        countLabel: '받았어요',
        badge, tier,
        rewards: [
          ['💖', '행복', '+' + happyGain],
          ['🍖', '배고픔', '+' + hungerGain],
          ...(careBoost ? [['🌟', '케어', '+' + careBoost]] : []),
        ],
      });
    }
    endBtn.addEventListener('click', () => endGame());
    openModal({
      title: '🦴 간식 받기', body, mandatory: true,
      onClose: () => { if (!endedFlag) { endedFlag = true; decayPaused = false; markPlayDone('treat'); saveState(); } },
    });
    setTimeout(() => { lastFrame = performance.now(); step._lastT = lastFrame; requestAnimationFrame(step); }, 80);
  }

  // ----- 산책: 횡스크롤 — 배경이 흘러가고 아이템이 오른쪽에서 등장, 강아지가 점프해서 수집 ---------
  function openWalkGame() {
    if (state.energy <= 30) {
      const body = document.createElement('div');
      const p = document.createElement('p'); p.className = 'modal-sub'; p.textContent = '💤 너무 졸려서 산책 못 가요. 먼저 재워 주세요.';
      body.appendChild(p);
      const ok = document.createElement('button'); ok.className = 'modal-btn'; ok.type = 'button'; ok.textContent = '알겠어요';
      ok.addEventListener('click', () => closeModal()); body.appendChild(ok);
      openModal({ title: '산책은 잠시 후', body });
      return;
    }
    if (state.hunger <= 30) {
      const body = document.createElement('div');
      const p = document.createElement('p'); p.className = 'modal-sub'; p.textContent = '🍖 배고파서 산책 못 가요. 먼저 밥 주세요.';
      body.appendChild(p);
      const ok = document.createElement('button'); ok.className = 'modal-btn'; ok.type = 'button'; ok.textContent = '알겠어요';
      ok.addEventListener('click', () => closeModal()); body.appendChild(ok);
      openModal({ title: '산책은 잠시 후', body });
      return;
    }
    decayPaused = true;

    // 스테이지 전환 — 기존 UI 숨기고 산책 화면으로 교체
    const appEl = document.querySelector('.app');
    const stageSection = document.querySelector('.stage');
    const bottomPanelEl = document.querySelector('.bottom-panel') || document.querySelector('.actions');
    const topbarEl = document.querySelector('.topbar');
    appEl.classList.add('walk-mode');

    // 산책 전용 컨테이너 (스테이지 전체 차지)
    const walkRoot = document.createElement('div');
    walkRoot.className = 'walk-stage-root';
    const walkInner = document.createElement('div');
    walkInner.className = 'walk-stage-inner';
    walkRoot.appendChild(walkInner);

    // HUD — 상단 고정
    const hud = document.createElement('div');
    hud.className = 'walk-hud';
    const timeEl = document.createElement('span'); timeEl.className = 'walk-hud-time'; timeEl.textContent = '⏱ 30';
    const scoreEl = document.createElement('span'); scoreEl.className = 'walk-hud-score'; scoreEl.textContent = '🎯 0';
    const tBar = document.createElement('div'); tBar.className = 'walk-hud-bar';
    const tFill = document.createElement('div'); tFill.className = 'walk-hud-fill';
    tBar.appendChild(tFill);
    const endBtn = document.createElement('button');
    endBtn.className = 'walk-hud-end'; endBtn.type = 'button'; endBtn.textContent = '끝내기';
    hud.appendChild(timeEl); hud.appendChild(tBar); hud.appendChild(scoreEl); hud.appendChild(endBtn);
    walkInner.appendChild(hud);

    // 아레나 — 나머지 공간 전체
    const arena = document.createElement('div');
    arena.className = 'walk-arena-full walk-scroll-arena';
    arena.dataset.breed = state.breed || 'shiba';

    // 고정 하늘 레이어
    const skyFixed = document.createElement('div'); skyFixed.className = 'wsc-sky-fixed';
    skyFixed.innerHTML = `
      <div class="wsc-sky"></div>
      <div class="wsc-sun"></div>
      <div class="wsc-cloud wsc-cloud1"></div>
      <div class="wsc-cloud wsc-cloud2"></div>
    `;
    arena.appendChild(skyFixed);

    // 파노라마 배경
    const bgWrap = document.createElement('div'); bgWrap.className = 'wsc-bg-wrap';
    for (let i = 0; i < 2; i++) {
      const bg = document.createElement('div'); bg.className = 'wsc-bg';
      bg.innerHTML = `
        <div class="wsc-tree wsc-tree1">🌳</div>
        <div class="wsc-tree wsc-tree2">🌲</div>
        <div class="wsc-tree wsc-tree3">🌳</div>
        <div class="wsc-bench">🪑</div>
        <div class="wsc-grass"></div>
        <div class="wsc-path"></div>
      `;
      bgWrap.appendChild(bg);
    }
    arena.appendChild(bgWrap);

    // 강아지
    const dogWrap = document.createElement('div'); dogWrap.className = 'wsc-dog-wrap';
    const dogShadow = document.createElement('div'); dogShadow.className = 'wsc-dog-shadow';
    const dog = document.createElement('img');
    dog.className = 'wsc-dog';
    dog.src = decideSpriteSrc('idle');
    dogWrap.appendChild(dogShadow);
    dogWrap.appendChild(dog);
    arena.appendChild(dogWrap);

    walkInner.appendChild(arena);
    appEl.appendChild(walkRoot);

    // 아이템 카탈로그
    const ITEM_DEFS = [
      { kind: 'bone',   emoji: '🦴', score: 5,  weight: 30, rare: false },
      { kind: 'flower', emoji: '🌸', score: 3,  weight: 22, rare: false },
      { kind: 'butter', emoji: '🦋', score: 5,  weight: 14, rare: false },
      { kind: 'bird',   emoji: '🐦', score: 5,  weight: 10, rare: false },
      { kind: 'balloon',emoji: '🎈', score: 10, weight: 5,  rare: true },
      { kind: 'star',   emoji: '⭐', score: 20, weight: 3,  rare: true, careBonus: 1 },
      { kind: 'gem',    emoji: '💎', score: 30, weight: 1,  rare: true, careBonus: 5 },
      { kind: 'gift',   emoji: '🎁', score: 15, weight: 2,  rare: true, gift: true },
      { kind: 'furn_chair', emoji: '🪑', score: 25, weight: 0.5, rare: true, furn: 'chair' },
      { kind: 'furn_plant', emoji: '🪴', score: 25, weight: 0.5, rare: true, furn: 'plant' },
      { kind: 'furn_lamp',  emoji: '🪔', score: 25, weight: 0.4, rare: true, furn: 'lamp' },
      { kind: 'wp_roll',    emoji: '🎨', score: 30, weight: 0.3, rare: true, wpRoll: true },
      { kind: 'fl_roll',    emoji: '🟫', score: 30, weight: 0.3, rare: true, flRoll: true },
    ];
    const totalWeight = ITEM_DEFS.reduce((s, d) => s + d.weight, 0);
    function pickItemDef() {
      let r = Math.random() * totalWeight;
      for (const d of ITEM_DEFS) { r -= d.weight; if (r <= 0) return d; }
      return ITEM_DEFS[0];
    }

    // 상태
    const items = []; // { el, def, x, baseY, captured }
    const collected = {};
    let score = 0;
    let endedFlag = false;
    const TOTAL_MS = 30000;
    // 속도는 calibrate()에서 아레나 너비 기준으로 설정
    let SCROLL_SPEED = 0;
    let ITEM_SPEED  = 0;
    let bgOffset = 0;
    let lastFrame = performance.now();
    let started = lastFrame;
    let spawnAccum = 0;
    const _diff = diffMul();
    let nextSpawn = (1200 + Math.random() * 800) / _diff;

    // 점프 상태
    let jumping = false;
    let jumpVy = 0;
    let dogY = 0; // 0 = 지면, 양수 = 공중 (px)
    const GROUND_PCT = 0.13;
    const DOG_X_PCT = 22;
    const GRAVITY = 1800;
    let JUMP_VY = -320;
    let DOG_GROUND_BOTTOM = 52;

    function arenaRect() { return arena.getBoundingClientRect(); }

    function calibrate() {
      const r = arenaRect();
      DOG_GROUND_BOTTOM = r.height * GROUND_PCT;
      const peakTarget = Math.min(r.height * 0.20, 120);
      JUMP_VY = -Math.sqrt(2 * GRAVITY * peakTarget);
      const travelPx = r.width * (1 - DOG_X_PCT / 100);
      ITEM_SPEED = travelPx / 3;
      SCROLL_SPEED = ITEM_SPEED * 0.9;
    }

    function applyDogPos(r) {
      const bottomPx = DOG_GROUND_BOTTOM + dogY;
      dogWrap.style.bottom = bottomPx + 'px';
      dogShadow.style.transform = `translateX(-50%) scaleX(${Math.max(0.4, 1 - dogY / 160)})`;
      dogShadow.style.opacity = String(Math.max(0.15, 0.55 - dogY / 260));
    }

    function triggerJump() {
      if (jumping) return;
      jumping = true;
      jumpVy = JUMP_VY;
      dog.src = decideSpriteSrc('happy');
    }

    function spawnItem(r) {
      const def = pickItemDef();
      const airborne = def.rare; // rare 아이템만 공중
      const jumpPeak = (JUMP_VY * JUMP_VY) / (2 * GRAVITY);
      const baseY = airborne
        ? DOG_GROUND_BOTTOM + jumpPeak * 0.65 + Math.random() * jumpPeak * 0.3
        : DOG_GROUND_BOTTOM + 4;
      const el = document.createElement('div');
      el.className = 'walk-item' + (def.rare ? ' rare' : '');
      el.textContent = def.emoji;
      el.style.right = '-40px';
      el.style.bottom = baseY + 'px';
      arena.appendChild(el);
      items.push({ el, def, x: r.width + 40, baseY, captured: false, airborne });
    }

    function captureItem(it) {
      if (it.captured) return;
      it.captured = true;
      const def = it.def;
      collected[def.kind] = (collected[def.kind] || 0) + 1;
      score += def.score;
      scoreEl.textContent = '🎯 ' + score;
      it.el.classList.add('walk-item-pop');
      setTimeout(() => { try { it.el.remove(); } catch {} }, 240);
      try { SOUNDS.coin(); } catch {}
      flashBubble('💖');
      let extraMsg = null;

      if (def.furn) {
        if (!state.furnitureInv) state.furnitureInv = {};
        state.furnitureInv[def.furn] = (state.furnitureInv[def.furn] || 0) + 1;
        extraMsg = `🪴 ${FURNITURE[def.furn].name} 발견!`;
      } else if (def.wpRoll) {
        const all = Object.keys(WALLPAPERS).filter(k => k !== 'default');
        const candidates = all.filter(k => !(state.styleInv || {})['wp_' + k]);
        if (candidates.length) {
          const pick = candidates[Math.floor(Math.random() * candidates.length)];
          state.styleInv['wp_' + pick] = true;
          extraMsg = `🎨 ${WALLPAPERS[pick].name} 벽지 발견!`;
        } else { extraMsg = `🎨 모든 벽지 보유 중`; }
      } else if (def.flRoll) {
        const all = Object.keys(FLOORS).filter(k => k !== 'default');
        const candidates = all.filter(k => !(state.styleInv || {})['fl_' + k]);
        if (candidates.length) {
          const pick = candidates[Math.floor(Math.random() * candidates.length)];
          state.styleInv['fl_' + pick] = true;
          extraMsg = `🟫 ${FLOORS[pick].name} 바닥 발견!`;
        } else { extraMsg = `🟫 모든 바닥 보유 중`; }
      } else if (def.gift) {
        const buckets = ['furn', 'wp', 'fl', 'acc'];
        const bucket = buckets[Math.floor(Math.random() * buckets.length)];
        if (bucket === 'furn') {
          const all = Object.keys(FURNITURE);
          const pick = all[Math.floor(Math.random() * all.length)];
          if (!state.furnitureInv) state.furnitureInv = {};
          state.furnitureInv[pick] = (state.furnitureInv[pick] || 0) + 1;
          extraMsg = `🎁 ${FURNITURE[pick].name} 받았어요!`;
        } else if (bucket === 'wp') {
          const all = Object.keys(WALLPAPERS).filter(k => k !== 'default');
          const cand = all.filter(k => !(state.styleInv || {})['wp_' + k]);
          if (cand.length) { const pick = cand[Math.floor(Math.random() * cand.length)]; state.styleInv['wp_' + pick] = true; extraMsg = `🎁 ${WALLPAPERS[pick].name} 벽지!`; }
        } else if (bucket === 'fl') {
          const all = Object.keys(FLOORS).filter(k => k !== 'default');
          const cand = all.filter(k => !(state.styleInv || {})['fl_' + k]);
          if (cand.length) { const pick = cand[Math.floor(Math.random() * cand.length)]; state.styleInv['fl_' + pick] = true; extraMsg = `🎁 ${FLOORS[pick].name} 바닥!`; }
        } else {
          const owned = state.inventory || {};
          const cand = ACCESSORIES.filter(a => !owned[a.id]);
          if (cand.length) { const pick = cand[Math.floor(Math.random() * cand.length)]; state.inventory[pick.id] = true; extraMsg = `🎁 ${pick.name} 받았어요!`; }
        }
      } else {
        if (ROOM_ITEMS[def.kind]) {
          if (!state.roomInv) state.roomInv = {};
          state.roomInv[def.kind] = (state.roomInv[def.kind] || 0) + 1;
        }
      }

      if (def.rare || extraMsg) {
        const cel = document.createElement('div');
        cel.className = 'walk-celebrate';
        cel.textContent = extraMsg || `와! ${def.emoji} 발견!`;
        arena.appendChild(cel);
        setTimeout(() => cel.remove(), 1400);
      }
    }

    function step(now) {
      if (endedFlag) return;
      const dt = Math.min(50, now - lastFrame) / 1000;
      lastFrame = now;
      const elapsed = now - started;
      const remain = Math.max(0, TOTAL_MS - elapsed);
      timeEl.textContent = '⏱ ' + Math.ceil(remain / 1000);
      tFill.style.width = (remain / TOTAL_MS * 100) + '%';
      if (remain < 10000) tFill.classList.add('low'); else tFill.classList.remove('low');

      const r = arenaRect();
      if (r.width > 10 && ITEM_SPEED === 0) calibrate(); // 크기 확정 후 딱 한 번
      const bgW = r.width || 1;

      // 배경 스크롤
      bgOffset = (bgOffset + SCROLL_SPEED * dt) % bgW;
      bgWrap.style.transform = `translateX(-${bgOffset}px)`;

      // 아이템 스폰
      spawnAccum += dt * 1000;
      if (spawnAccum >= nextSpawn && items.filter(i => !i.captured).length < 8) {
        spawnAccum = 0;
        nextSpawn = (600 + Math.random() * 500) / _diff;
        spawnItem(r);
      }

      // 아이템 이동 + 수집 판정
      const dogPixelX = r.width * DOG_X_PCT / 100;
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        if (it.captured) continue;
        it.x -= ITEM_SPEED * dt;
        it.el.style.left = it.x + 'px';
        it.el.style.right = 'auto';
        if (it.x < -50) {
          try { it.el.remove(); } catch {}
          items.splice(i, 1);
          continue;
        }
        const xOk = Math.abs(it.x - dogPixelX) < 52;
        // 레어(공중) 아이템은 점프 중일 때만 판정
        if (it.airborne && !jumping) continue;
        const itemBot = it.baseY;
        const itemTop = it.baseY + 36;
        const dogFeetY_ = DOG_GROUND_BOTTOM + dogY;
        const dogHeadY_ = dogFeetY_ + 88;
        const yOk = dogFeetY_ < itemTop && dogHeadY_ > itemBot;
        if (xOk && yOk) {
          captureItem(it);
          items.splice(i, 1);
        }
      }

      // 점프 물리
      if (jumping) {
        jumpVy += GRAVITY * dt;
        dogY -= jumpVy * dt; // y 증가 = 위로
        if (dogY <= 0) {
          dogY = 0;
          jumping = false;
          jumpVy = 0;
          dog.src = decideSpriteSrc('idle');
        }
      }
      applyDogPos(r);

      if (remain <= 0) { endGame(); return; }
      requestAnimationFrame(step);
    }

    function exitWalkMode() {
      appEl.classList.remove('walk-mode');
      try { walkRoot.remove(); } catch {}
    }

    function endGame() {
      if (endedFlag) return;
      endedFlag = true;
      decayPaused = false;
      for (const it of items) { try { it.el.remove(); } catch {} }
      items.length = 0;
      exitWalkMode();
      const before = {};
      for (const g of GAUGES) before[g] = state[g];
      state.happy  = clamp(state.happy  + 40);
      state.energy = clamp(state.energy - 20);
      state.hunger = clamp(state.hunger - 10);
      state.clean  = clamp(state.clean  - 15);
      for (const g of GAUGES) {
        const d = state[g] - before[g];
        if (d !== 0) showGaugeDelta(g, d);
      }
      let careBoost = 1;
      for (const def of ITEM_DEFS) {
        const c = collected[def.kind] || 0;
        if (def.careBonus && c > 0) careBoost += def.careBonus * c;
      }
      for (let i = 0; i < careBoost; i++) {
        state.careLastTick = (state.careLastTick || 0) - CARE_TICK_MS;
        addCareScore();
      }
      state.points = (state.points || 0) + score;
      markPlayDone('walk');
      progressMission('minigame', 1);
      saveState(); render(); SOUNDS.fanfare();

      const rb = document.createElement('div');
      const p = document.createElement('p'); p.className = 'modal-sub';
      const lines = ['🐾 산책 완료!', '주운 것:'];
      const collectedItems = ITEM_DEFS.filter(d => (collected[d.kind] || 0) > 0)
        .map(d => `${d.emoji} ×${collected[d.kind]}`);
      lines.push(collectedItems.length ? collectedItems.join(', ') : '(없음)');
      lines.push(`총점: <b>${score}점</b>`);
      p.innerHTML = lines.join('<br>');
      rb.appendChild(p);
      const ok = document.createElement('button');
      ok.className = 'modal-btn'; ok.type = 'button'; ok.textContent = '좋아요';
      ok.addEventListener('click', () => closeModal());
      rb.appendChild(ok);
      openModal({ title: '🚶 산책 끝!', body: rb, mandatory: true });
    }

    // 아레나 탭 → 점프
    arena.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (!endedFlag) triggerJump();
    });

    endBtn.addEventListener('click', () => endGame());

    setTimeout(() => {
      calibrate();
      lastFrame = performance.now(); started = lastFrame;
      const r = arenaRect();
      dogWrap.style.left = DOG_X_PCT + '%';
      applyDogPos(r);
      requestAnimationFrame(step);
    }, 80);
  }

  function openMinigame() {
    if (state.energy <= 20) {
      const body = document.createElement('div');
      const p = document.createElement('p'); p.className = 'modal-sub';
      p.textContent = '💤 졸려서 놀 수 없어요. 먼저 재워 주세요.';
      body.appendChild(p);
      const btn = document.createElement('button');
      btn.className = 'modal-btn'; btn.type = 'button'; btn.textContent = '알겠어요';
      btn.addEventListener('click', () => closeModal());
      body.appendChild(btn);
      openModal({ title: '잠이 와요...', body });
      return;
    }
    if (minigameCooldownRemain() > 0) {
      const body = document.createElement('div');
      const sec = Math.ceil(minigameCooldownRemain() / 1000);
      const min = Math.floor(sec / 60); const ss = sec % 60;
      const p = document.createElement('p');
      p.className = 'modal-sub';
      p.textContent = `${min > 0 ? min + '분 ' : ''}${ss}초 후에 다시 놀 수 있어요`;
      body.appendChild(p);
      const btn = document.createElement('button');
      btn.className = 'modal-btn'; btn.type = 'button'; btn.textContent = '알겠어요';
      btn.addEventListener('click', () => closeModal());
      body.appendChild(btn);
      openModal({ title: '잠시 쉬는 중', body });
      return;
    }

    decayPaused = true;
    const body = document.createElement('div');

    const guide = document.createElement('div');
    guide.className = 'mg-guide';
    guide.innerHTML = `🎾 강아지를 움직여서 <b>공을 머리로 받아요!</b> <span class="mg-diff">${diffLabel()}</span>`;
    body.appendChild(guide);

    const stats = document.createElement('div');
    stats.className = 'minigame-stats';
    const timeEl = document.createElement('span');
    const comboEl = document.createElement('span');
    const scoreEl = document.createElement('span');
    timeEl.textContent = '⏱ 30';
    comboEl.textContent = '';
    scoreEl.textContent = '🎯 0';
    stats.appendChild(timeEl);
    stats.appendChild(comboEl);
    stats.appendChild(scoreEl);
    body.appendChild(stats);

    const tBar = document.createElement('div'); tBar.className = 'mg-timebar';
    const tFill = document.createElement('div'); tFill.className = 'mg-timebar-fill';
    tBar.appendChild(tFill); body.appendChild(tBar);

    const arena = document.createElement('div');
    arena.className = 'minigame-arena big keepup-arena';
    arena.dataset.breed = state.breed || 'shiba';
    const dog = document.createElement('img');
    dog.className = 'mg-dog keepup-dog';
    dog.src = decideSpriteSrc('happy');
    arena.appendChild(dog);

    const ball = document.createElement('div');
    ball.className = 'mg-ball';
    ball.textContent = '🎾';
    arena.appendChild(ball);

    const shadow = document.createElement('div');
    shadow.className = 'keepup-shadow';
    arena.appendChild(shadow);

    const comboPop = document.createElement('div');
    comboPop.className = 'mg-combo-pop';
    arena.appendChild(comboPop);

    body.appendChild(arena);

    const endBtn = document.createElement('button');
    endBtn.className = 'modal-btn secondary';
    endBtn.type = 'button';
    endBtn.textContent = '끝내기';
    endBtn.style.marginTop = '6px';
    body.appendChild(endBtn);

    let score = 0;
    let combo = 0;
    let lastBounceMs = 0;
    const COMBO_WINDOW_MS = 1000;
    const TOTAL_MS = 30000;
    let endedFlag = false;

    // 공 물리 — arena 좌표 (난이도에 따라 중력 가중)
    let bx = 0, by = 0, vx = 0, vy = 0;
    const _diff = diffMul();
    const GRAVITY = 700 * _diff;
    const BOUNCE_VY = -560;
    const BALL_R = 26;
    let dogX = null;
    const DOG_HALF = 50;

    let lastFrame = performance.now();
    let started = lastFrame;

    function arenaRect() { return arena.getBoundingClientRect(); }

    function spawnBall() {
      const r = arenaRect();
      bx = 60 + Math.random() * (r.width - 120);
      by = -10;
      vx = (Math.random() - 0.5) * 80;
      vy = 0;
      ball.classList.remove('mg-ball-popped','mg-ball-fade','mg-ball-thrown');
      ball.style.opacity = '1';
      placeBall();
    }
    function placeBall() {
      ball.style.left = bx + 'px';
      ball.style.top  = by + 'px';
    }

    function showCombo(text, big) {
      comboPop.textContent = text;
      comboPop.classList.remove('show', 'big');
      void comboPop.offsetWidth;
      comboPop.classList.add('show');
      if (big) comboPop.classList.add('big');
    }

    // 사용자 입력 — 강아지 target X 업데이트
    function setDogTarget(clientX) {
      const r = arenaRect();
      const x = clientX - r.left;
      dogX = Math.max(DOG_HALF, Math.min(r.width - DOG_HALF, x));
    }
    function onPointer(e) {
      if (endedFlag) return;
      e.preventDefault();
      setDogTarget(e.clientX);
    }
    function onTouchMove(e) {
      if (endedFlag) return;
      const t = e.touches[0]; if (!t) return;
      e.preventDefault();
      setDogTarget(t.clientX);
    }
    arena.addEventListener('pointerdown', onPointer);
    arena.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType !== 'mouse') onPointer(e); });
    arena.addEventListener('touchstart', onTouchMove, { passive: false });
    arena.addEventListener('touchmove', onTouchMove, { passive: false });

    function step(now) {
      if (endedFlag) return;
      const dt = Math.min(40, now - lastFrame) / 1000;
      lastFrame = now;
      const elapsed = now - started;
      const remain = Math.max(0, TOTAL_MS - elapsed);
      timeEl.textContent = '⏱ ' + Math.ceil(remain / 1000);
      tFill.style.width = (remain / TOTAL_MS * 100) + '%';
      if (remain < 10000) tFill.classList.add('low'); else tFill.classList.remove('low');

      const r = arenaRect();
      if (dogX === null) dogX = r.width / 2;

      // 강아지 부드럽게 target으로 이동
      dog.style.left = dogX + 'px';
      dog.style.transform = 'translateX(-50%)';

      // 공 물리
      vy += GRAVITY * dt;
      bx += vx * dt;
      by += vy * dt;
      // 좌우 벽
      if (bx < BALL_R) { bx = BALL_R; vx = Math.abs(vx) * 0.6; }
      if (bx > r.width - BALL_R) { bx = r.width - BALL_R; vx = -Math.abs(vx) * 0.6; }
      // 위 천장
      if (by < BALL_R) { by = BALL_R; vy = Math.abs(vy) * 0.4; }

      // 그림자 — 공 X에 따라 바닥에 표시
      const shadowSize = Math.max(20, 50 - by * 0.04);
      shadow.style.left = bx + 'px';
      shadow.style.width = shadowSize + 'px';
      shadow.style.opacity = Math.max(0.2, Math.min(0.6, 1 - by / r.height));

      // 충돌 감지 — 공이 떨어지는 중이고 강아지 머리 zone에 들어옴
      const headY = r.height - 110; // 강아지 머리 대략 높이
      if (vy > 0 && by >= headY - 20 && by <= headY + 30) {
        const dx = bx - dogX;
        if (Math.abs(dx) < DOG_HALF + BALL_R - 6) {
          // 자동 튕김
          vy = BOUNCE_VY - Math.random() * 60;
          vx = (Math.random() - 0.5) * 220 + dx * 4;
          by = headY - 22;
          // 콤보
          if (now - lastBounceMs <= COMBO_WINDOW_MS) combo += 1;
          else combo = 1;
          lastBounceMs = now;
          const mul = combo >= 5 ? 5 : combo >= 3 ? 3 : combo >= 2 ? 2 : 1;
          score += mul;
          scoreEl.textContent = '🎯 ' + score;
          comboEl.textContent = combo >= 2 ? `🔥 ${combo}` : '';
          if (combo >= 2) showCombo(`콤보 ×${mul}!`, mul >= 3);
          try { SOUNDS.bounce(); } catch {}
          // 강아지 살짝 점프
          dog.classList.remove('keepup-jump'); void dog.offsetWidth; dog.classList.add('keepup-jump');
          // sparkle
          const sp = document.createElement('div');
          sp.className = 'mg-sparkle';
          sp.textContent = '✨';
          sp.style.left = bx + 'px';
          sp.style.top = headY + 'px';
          arena.appendChild(sp);
          setTimeout(() => sp.remove(), 400);
        }
      }

      placeBall();

      // 콤보 만료
      if (combo > 0 && now - lastBounceMs > COMBO_WINDOW_MS) {
        combo = 0;
        comboEl.textContent = '';
      }

      // 바닥 — 새 공
      if (by > r.height - BALL_R - 10) {
        try { SOUNDS.pop(); } catch {}
        flashBubble('😯');
        spawnBall();
      }

      if (remain <= 0) { endGame(); return; }
      requestAnimationFrame(step);
    }

    function endGame() {
      if (endedFlag) return;
      endedFlag = true;
      decayPaused = false;
      let happyGain, careBoost, msg;
      if (score >= 25)      { happyGain = 50; careBoost = 3; msg = '최고! 🎉'; }
      else if (score >= 15) { happyGain = 35; careBoost = 2; msg = '잘했어요!'; }
      else if (score >= 5)  { happyGain = 25; careBoost = 1; msg = '좋아요!'; }
      else                   { happyGain = 15; careBoost = 0; msg = '재밌었지?'; }
      state.happy = clamp(state.happy + happyGain);
      for (let i = 0; i < careBoost; i++) {
        state.careLastTick = (state.careLastTick || 0) - CARE_TICK_MS;
        addCareScore();
      }
      state.points = (state.points || 0) + score;
      markPlayDone('ball');
      progressMission('minigame', 1);
      saveState(); render(); SOUNDS.fanfare();

      const rb = document.createElement('div');
      const p = document.createElement('p'); p.className = 'modal-sub';
      const nm = state.name || '강아지';
      p.innerHTML = `🎉 <b>${score}점!</b><br>${nameTopic(nm)} 행복해해요 💖<br><span style="color:#c47b00">${msg}</span><br><span style="font-size:13px;color:#836a55">행복 +${happyGain}${careBoost ? `, 케어 +${careBoost}` : ''}</span>`;
      rb.appendChild(p);
      const ok = document.createElement('button');
      ok.className = 'modal-btn'; ok.type = 'button'; ok.textContent = '좋아요';
      ok.addEventListener('click', () => closeModal());
      rb.appendChild(ok);
      openModal({ title: '공놀이 끝!', body: rb, mandatory: true });
    }

    endBtn.addEventListener('click', () => endGame());

    openModal({
      title: '🎾 공놀이',
      body,
      mandatory: true,
      onClose: () => {
        if (!endedFlag) {
          endedFlag = true;
          decayPaused = false;
          state.minigameLastTs = Date.now() - MINIGAME_COOLDOWN_MS + 30 * 1000;
          saveState();
        }
      },
    });

    setTimeout(() => {
      spawnBall();
      started = performance.now();
      lastFrame = started;
      requestAnimationFrame(step);
    }, 80);
  }


  // ----- 발자국 따라가기 (Simon-says) ------------------------------------
  function openSequenceGame() {
    decayPaused = true;
    const body = document.createElement('div');
    const guide = document.createElement('div');
    guide.className = 'mg-guide';
    guide.innerHTML = `🐾 발자국 <b>순서대로 따라 눌러요!</b> <span class="mg-diff">${diffLabel()}</span>`;
    body.appendChild(guide);

    const stats = document.createElement('div');
    stats.className = 'minigame-stats';
    const roundEl = document.createElement('span');
    const stateEl = document.createElement('span');
    roundEl.textContent = '🎯 라운드 1';
    stateEl.textContent = '👀 잘 봐요...';
    stats.appendChild(roundEl); stats.appendChild(stateEl);
    body.appendChild(stats);

    const arena = document.createElement('div');
    arena.className = 'minigame-arena big seq-arena';
    arena.dataset.breed = state.breed || 'shiba';

    // 6개 컬러 발자국 패드 (3x2)
    const COLORS = ['#ff7aa1','#5eb8ff','#7ad06e','#ffc94a','#c685ff','#ff9466'];
    const pad = document.createElement('div');
    pad.className = 'seq-pad';
    const btns = [];
    for (let i = 0; i < 6; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'seq-btn';
      b.dataset.idx = String(i);
      b.style.background = COLORS[i];
      b.textContent = '🐾';
      pad.appendChild(b);
      btns.push(b);
    }
    arena.appendChild(pad);
    body.appendChild(arena);

    const endBtn = document.createElement('button');
    endBtn.className = 'modal-btn secondary'; endBtn.type = 'button'; endBtn.textContent = '끝내기';
    endBtn.style.marginTop = '6px';
    body.appendChild(endBtn);

    let endedFlag = false;
    let round = 1;
    let sequence = [];
    let userIdx = 0;
    let acceptInput = false;

    const _diff = diffMul();
    const PLAY_MS = Math.max(280, 480 - 60 * (_diff - 1) * 4); // 어려울수록 빠르게 보여줌

    function flash(i) {
      const b = btns[i];
      b.classList.add('lit');
      // 6개 발자국 — 펜타토닉 6 노트
      try {
        const ctx = ensureAudio();
        if (ctx) {
          const t0 = ctx.currentTime;
          const o = ctx.createOscillator(); const g = ctx.createGain();
          o.type = 'triangle';
          o.frequency.value = [392, 440, 523, 587, 659, 784][i];
          g.gain.setValueAtTime(0.05, t0);
          g.gain.exponentialRampToValueAtTime(0.001, t0 + PLAY_MS / 1000 * 0.9);
          o.connect(g).connect(ctx.destination);
          o.start(t0); o.stop(t0 + PLAY_MS / 1000);
        }
      } catch {}
      setTimeout(() => b.classList.remove('lit'), Math.max(160, PLAY_MS * 0.7));
    }

    function playSequence() {
      stateEl.textContent = '👀 잘 봐요...';
      acceptInput = false;
      let i = 0;
      function next() {
        if (endedFlag) return;
        if (i >= sequence.length) {
          stateEl.textContent = '✋ 따라하세요!';
          acceptInput = true;
          userIdx = 0;
          return;
        }
        flash(sequence[i]);
        i += 1;
        setTimeout(next, PLAY_MS);
      }
      setTimeout(next, 400);
    }

    function startRound() {
      // 매 라운드 새로 랜덤 — 길이만 라운드+1
      const len = round + 1;
      sequence = [];
      for (let i = 0; i < len; i++) sequence.push(Math.floor(Math.random() * 6));
      roundEl.textContent = '🎯 라운드 ' + round;
      playSequence();
    }

    function onTap(i) {
      if (!acceptInput || endedFlag) return;
      const expected = sequence[userIdx];
      const b = btns[i];
      b.classList.add('press');
      setTimeout(() => b.classList.remove('press'), 160);
      flash(i);
      if (i !== expected) {
        endGame(false);
        return;
      }
      userIdx += 1;
      if (userIdx >= sequence.length) {
        // 라운드 클리어
        round += 1;
        acceptInput = false;
        try { SOUNDS.fanfare(); } catch {}
        stateEl.textContent = '✨ 잘했어요!';
        setTimeout(() => { if (!endedFlag) startRound(); }, 700);
      }
    }

    btns.forEach((b, i) => {
      b.addEventListener('click', (e) => { e.preventDefault(); onTap(i); });
      b.addEventListener('touchstart', (e) => { e.preventDefault(); onTap(i); }, { passive: false });
    });

    function endGame(success) {
      if (endedFlag) return;
      endedFlag = true;
      decayPaused = false;
      const reached = round - 1;       // 클리어한 라운드 수
      const final = round;              // 마지막 시도한 라운드
      const score = reached * 5 + (success ? 0 : 0);
      let happyGain, careBoost, badge, tier;
      if (reached >= 6)      { happyGain = 50; careBoost = 2; badge = '⭐ 천재예요!';     tier = 'best'; }
      else if (reached >= 4) { happyGain = 35; careBoost = 1; badge = '👍 잘했어요!';     tier = 'good'; }
      else if (reached >= 2) { happyGain = 22; careBoost = 1; badge = '🙂 좋아요!';       tier = 'ok';   }
      else                    { happyGain = 10; careBoost = 0; badge = '😅 다시 도전!';   tier = 'low';  }
      state.happy = clamp(state.happy + happyGain);
      for (let i = 0; i < careBoost; i++) {
        state.careLastTick = (state.careLastTick || 0) - CARE_TICK_MS;
        addCareScore();
      }
      state.points = (state.points || 0) + reached * 3;
      markPlayDone('seq');
      progressMission('minigame', 1);
      saveState(); render(); SOUNDS.fanfare();
      openResultModal({
        title: '발자국 따라가기 끝!',
        bigCount: reached + ' 라운드',
        countLabel: '클리어',
        badge, tier,
        rewards: [
          ['💖', '행복', '+' + happyGain],
          ...(careBoost ? [['🌟', '케어', '+' + careBoost]] : []),
        ],
      });
    }

    endBtn.addEventListener('click', () => endGame(true));
    openModal({
      title: '🐾 발자국 따라가기', body, mandatory: true,
      onClose: () => { if (!endedFlag) { endedFlag = true; decayPaused = false; markPlayDone('seq'); saveState(); } },
    });
    setTimeout(startRound, 600);
  }

  // ----- 숨바꼭질 ---------------------------------------------------------
  // 야바위 — 박스 6개 중 강아지 들어있는 위치 추적
  function openHideSeekGame() {
    decayPaused = true;
    const body = document.createElement('div');
    const guide = document.createElement('div');
    guide.className = 'mg-guide';
    guide.innerHTML = `📦 강아지가 들어간 상자를 <b>잘 따라가요!</b> <span class="mg-diff">${diffLabel()}</span>`;
    body.appendChild(guide);

    const stats = document.createElement('div');
    stats.className = 'minigame-stats';
    const roundEl = document.createElement('span');
    const stateEl = document.createElement('span');
    roundEl.textContent = '🎯 라운드 1';
    stateEl.textContent = '👀 보세요...';
    stats.appendChild(roundEl); stats.appendChild(stateEl);
    body.appendChild(stats);

    const arena = document.createElement('div');
    arena.className = 'minigame-arena big hide-arena';
    arena.dataset.breed = state.breed || 'shiba';

    const grid = document.createElement('div');
    grid.className = 'hide-grid';
    arena.appendChild(grid);
    body.appendChild(arena);

    const endBtn = document.createElement('button');
    endBtn.className = 'modal-btn secondary'; endBtn.type = 'button'; endBtn.textContent = '끝내기';
    endBtn.style.marginTop = '6px';
    body.appendChild(endBtn);

    const NUM = 6, COLS = 3, ROWS = 2;
    const spots = [];
    let positions = Array.from({length: NUM}, (_, i) => i); // spot[i] → cell positions[i]
    let dogIdx = 0;
    let endedFlag = false;
    let round = 1;
    let totalFound = 0, totalWrong = 0;
    const _diff = diffMul();

    for (let i = 0; i < NUM; i++) {
      const s = document.createElement('button');
      s.type = 'button';
      s.className = 'hide-spot';
      s.dataset.idx = String(i);
      const sprite = decideSpriteSrc('happy');
      s.innerHTML = `<span class="hide-cover">📦</span><img class="hide-dog" src="${sprite}" alt="" draggable="false">`;
      grid.appendChild(s);
      spots.push(s);
    }

    function applyPositions(animate) {
      const r = grid.getBoundingClientRect();
      const gap = 8;
      const w = (r.width - gap * (COLS - 1)) / COLS;
      const h = (r.height - gap * (ROWS - 1)) / ROWS;
      spots.forEach((s, i) => {
        s.style.width = w + 'px';
        s.style.height = h + 'px';
        const cell = positions[i];
        const col = cell % COLS, row = Math.floor(cell / COLS);
        s.style.left = (col * (w + gap)) + 'px';
        s.style.top = (row * (h + gap)) + 'px';
        s.style.transition = animate ? 'left 480ms cubic-bezier(0.55, 0.1, 0.45, 1), top 480ms cubic-bezier(0.55, 0.1, 0.45, 1)' : 'none';
      });
    }

    let acceptInput = false;
    function setStatus(t) { stateEl.textContent = t; }

    function startRound() {
      if (endedFlag) return;
      acceptInput = false;
      roundEl.textContent = '🎯 라운드 ' + round;
      // 위치 초기화 (식별 단순화)
      positions = Array.from({length: NUM}, (_, i) => i);
      spots.forEach(s => s.classList.remove('peek','correct','wrong','open'));
      applyPositions(false);
      // 새 강아지 위치 선택
      dogIdx = Math.floor(Math.random() * NUM);
      // 보여주기
      setTimeout(() => {
        if (endedFlag) return;
        setStatus('👀 강아지 봤어요!');
        spots[dogIdx].classList.add('peek');
        try { SOUNDS.pop(); } catch {}
      }, 200);
      // 가리기 → 셔플
      const PEEK_MS = Math.max(700, 1100 / _diff);
      setTimeout(() => {
        if (endedFlag) return;
        spots[dogIdx].classList.remove('peek');
        setStatus('🌀 섞는 중...');
        // 라운드별 셔플 횟수: 3 / 4 / 5 / 6 / 7
        const shuffles = Math.min(7, 2 + round);
        const SWAP_MS = Math.max(420, 600 / _diff);
        let i = 0;
        function nextSwap() {
          if (endedFlag) return;
          if (i >= shuffles) {
            setStatus('🤔 어디 있을까?');
            acceptInput = true;
            return;
          }
          let a, b;
          do {
            a = Math.floor(Math.random() * NUM);
            b = Math.floor(Math.random() * NUM);
          } while (a === b);
          [positions[a], positions[b]] = [positions[b], positions[a]];
          applyPositions(true);
          i += 1;
          setTimeout(nextSwap, SWAP_MS);
        }
        setTimeout(nextSwap, 250);
      }, 200 + PEEK_MS);
    }

    spots.forEach((s, i) => {
      const trigger = (e) => {
        e.preventDefault();
        if (!acceptInput || endedFlag) return;
        acceptInput = false;
        if (i === dogIdx) {
          totalFound += 1;
          s.classList.add('correct','peek');
          setStatus('✨ 정답!');
          try { SOUNDS.fanfare(); } catch {}
          round += 1;
          if (round > 5) setTimeout(() => endGame(), 900);
          else setTimeout(startRound, 1100);
        } else {
          totalWrong += 1;
          s.classList.add('wrong');
          // 정답 위치도 공개
          spots[dogIdx].classList.add('peek');
          setStatus('😢 여기였어요');
          try { SOUNDS.whimper(); } catch {}
          round += 1;
          if (round > 5) setTimeout(() => endGame(), 1300);
          else setTimeout(startRound, 1400);
        }
      };
      s.addEventListener('click', trigger);
      s.addEventListener('touchstart', trigger, { passive: false });
    });

    function endGame() {
      if (endedFlag) return;
      endedFlag = true;
      decayPaused = false;
      let happyGain, careBoost, badge, tier;
      if (totalFound >= 5)     { happyGain = 50; careBoost = 2; badge = '⭐ 완벽해요!';   tier = 'best'; }
      else if (totalFound >= 4){ happyGain = 38; careBoost = 1; badge = '👍 잘했어요!';   tier = 'good'; }
      else if (totalFound >= 2){ happyGain = 22; careBoost = 1; badge = '🙂 좋아요!';     tier = 'ok';   }
      else                      { happyGain = 10; careBoost = 0; badge = '😅 다시 도전!'; tier = 'low';  }
      state.happy = clamp(state.happy + happyGain);
      for (let i = 0; i < careBoost; i++) {
        state.careLastTick = (state.careLastTick || 0) - CARE_TICK_MS;
        addCareScore();
      }
      state.points = (state.points || 0) + totalFound * 6;
      markPlayDone('hide');
      progressMission('minigame', 1);
      saveState(); render(); SOUNDS.fanfare();
      openResultModal({
        title: '숨바꼭질 끝!',
        bigCount: totalFound + '/5',
        countLabel: '맞춤',
        badge, tier,
        rewards: [
          ['💖', '행복', '+' + happyGain],
          ...(careBoost ? [['🌟', '케어', '+' + careBoost]] : []),
          ['❌', '틀림', totalWrong],
        ],
      });
    }

    endBtn.addEventListener('click', () => endGame());
    openModal({
      title: '📦 숨바꼭질', body, mandatory: true,
      onClose: () => { if (!endedFlag) { endedFlag = true; decayPaused = false; markPlayDone('hide'); saveState(); } },
    });
    setTimeout(() => { applyPositions(false); startRound(); }, 100);
  }

  // ----- 짝 맞추기 (메모리 카드) ------------------------------------------
  function openMatchGame() {
    decayPaused = true;
    const body = document.createElement('div');
    const guide = document.createElement('div');
    guide.className = 'mg-guide';
    guide.innerHTML = `🃏 같은 카드 <b>두 장 찾기!</b> <span class="mg-diff">${diffLabel()}</span>`;
    body.appendChild(guide);

    const stats = document.createElement('div');
    stats.className = 'minigame-stats';
    const timeEl = document.createElement('span');
    const pairEl = document.createElement('span');
    timeEl.textContent = '⏱ 60';
    pairEl.textContent = '🎯 0/8';
    stats.appendChild(timeEl); stats.appendChild(pairEl);
    body.appendChild(stats);

    const tBar = document.createElement('div'); tBar.className = 'mg-timebar';
    const tFill = document.createElement('div'); tFill.className = 'mg-timebar-fill';
    tBar.appendChild(tFill); body.appendChild(tBar);

    const arena = document.createElement('div');
    arena.className = 'minigame-arena big match-arena';
    arena.dataset.breed = state.breed || 'shiba';

    // 8 페어 = 16 카드, 4x4 그리드
    const SYMBOLS = ['🦴','🎾','🍖','🐾','💖','⭐','🎀','🦋'];
    let deck = [];
    SYMBOLS.forEach(sym => { deck.push(sym); deck.push(sym); });
    // shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    const grid = document.createElement('div');
    grid.className = 'match-grid';
    const cards = [];
    deck.forEach((sym, i) => {
      const c = document.createElement('button');
      c.type = 'button';
      c.className = 'match-card';
      c.dataset.idx = String(i);
      c.dataset.sym = sym;
      c.innerHTML = `<span class="match-back">?</span><span class="match-face">${sym}</span>`;
      grid.appendChild(c);
      cards.push(c);
    });
    arena.appendChild(grid);
    body.appendChild(arena);

    const endBtn = document.createElement('button');
    endBtn.className = 'modal-btn secondary'; endBtn.type = 'button'; endBtn.textContent = '끝내기';
    endBtn.style.marginTop = '6px';
    body.appendChild(endBtn);

    let endedFlag = false;
    let pairs = 0, attempts = 0;
    const TOTAL = 60000;
    const _diff = diffMul();
    const FLIP_BACK_MS = Math.max(500, 900 / _diff);
    const started = performance.now();
    let flipped = []; // 현재 뒤집힌 카드(매칭 안된)

    function onCardTap(c) {
      if (endedFlag) return;
      if (c.classList.contains('matched') || c.classList.contains('flipped')) return;
      if (flipped.length >= 2) return;
      c.classList.add('flipped');
      try { SOUNDS.pop(); } catch {}
      flipped.push(c);
      if (flipped.length === 2) {
        attempts += 1;
        const [a, b] = flipped;
        if (a.dataset.sym === b.dataset.sym) {
          // match
          a.classList.add('matched');
          b.classList.add('matched');
          flipped = [];
          pairs += 1;
          pairEl.textContent = `🎯 ${pairs}/8`;
          try { SOUNDS.fanfare(); } catch {}
          if (pairs >= 8) endGame();
        } else {
          // mismatch — 잠시 후 다시 뒤집기
          setTimeout(() => {
            a.classList.remove('flipped');
            b.classList.remove('flipped');
            flipped = [];
          }, FLIP_BACK_MS);
        }
      }
    }
    cards.forEach(c => {
      c.addEventListener('click', (e) => { e.preventDefault(); onCardTap(c); });
      c.addEventListener('touchstart', (e) => { e.preventDefault(); onCardTap(c); }, { passive: false });
    });

    function step(now) {
      if (endedFlag) return;
      const elapsed = now - started;
      const remain = Math.max(0, TOTAL - elapsed);
      timeEl.textContent = '⏱ ' + Math.ceil(remain / 1000);
      tFill.style.width = (remain / TOTAL * 100) + '%';
      if (remain < TOTAL / 3) tFill.classList.add('low'); else tFill.classList.remove('low');
      if (remain <= 0) { endGame(); return; }
      requestAnimationFrame(step);
    }

    function endGame() {
      if (endedFlag) return;
      endedFlag = true;
      decayPaused = false;
      const elapsed = performance.now() - started;
      const remainSec = Math.max(0, (TOTAL - elapsed) / 1000);
      const cleared = pairs >= 8;
      let happyGain, careBoost, badge, tier;
      if (cleared && remainSec >= 25)     { happyGain = 55; careBoost = 2; badge = '⭐ 천재예요!';     tier = 'best'; }
      else if (cleared)                    { happyGain = 40; careBoost = 2; badge = '👍 잘했어요!';   tier = 'good'; }
      else if (pairs >= 5)                 { happyGain = 28; careBoost = 1; badge = '🙂 좋아요!';     tier = 'ok';   }
      else if (pairs >= 2)                 { happyGain = 18; careBoost = 1; badge = '🙂 괜찮아요';   tier = 'ok';   }
      else                                  { happyGain = 10; careBoost = 0; badge = '😅 다시 도전!'; tier = 'low';  }
      state.happy = clamp(state.happy + happyGain);
      for (let i = 0; i < careBoost; i++) {
        state.careLastTick = (state.careLastTick || 0) - CARE_TICK_MS;
        addCareScore();
      }
      state.points = (state.points || 0) + pairs * 5;
      markPlayDone('match');
      progressMission('minigame', 1);
      saveState(); render(); SOUNDS.fanfare();
      openResultModal({
        title: '짝 맞추기 끝!',
        bigCount: pairs + '/8',
        countLabel: '짝 맞춤',
        badge, tier,
        rewards: [
          ['💖', '행복', '+' + happyGain],
          ...(careBoost ? [['🌟', '케어', '+' + careBoost]] : []),
          ['🔁', '시도', attempts],
        ],
      });
    }

    endBtn.addEventListener('click', () => endGame());
    openModal({
      title: '🃏 짝 맞추기', body, mandatory: true,
      onClose: () => { if (!endedFlag) { endedFlag = true; decayPaused = false; markPlayDone('match'); saveState(); } },
    });
    setTimeout(() => requestAnimationFrame(step), 80);
  }

  // ----- 뼈 묻기 (메모리) -------------------------------------------------
  function openBuryGame() {
    decayPaused = true;
    const body = document.createElement('div');
    const guide = document.createElement('div');
    guide.className = 'mg-guide';
    guide.innerHTML = `⛰️ 뼈를 묻은 자리를 <b>기억해서 다시 찾아요!</b> <span class="mg-diff">${diffLabel()}</span>`;
    body.appendChild(guide);

    const stats = document.createElement('div');
    stats.className = 'minigame-stats';
    const roundEl = document.createElement('span');
    const stateEl = document.createElement('span');
    roundEl.textContent = '🎯 라운드 1';
    stateEl.textContent = '👀 보세요...';
    stats.appendChild(roundEl); stats.appendChild(stateEl);
    body.appendChild(stats);

    const arena = document.createElement('div');
    arena.className = 'minigame-arena big bury-arena';
    arena.dataset.breed = state.breed || 'shiba';

    // 6개 흙더미 (3x2 그리드)
    const moundsRow = document.createElement('div');
    moundsRow.className = 'bury-row';
    const mounds = [];
    for (let i = 0; i < 6; i++) {
      const m = document.createElement('button');
      m.type = 'button';
      m.className = 'bury-mound';
      m.dataset.idx = String(i);
      m.innerHTML = `<span class="bury-bone">🦴</span><span class="bury-dirt">⛰️</span>`;
      moundsRow.appendChild(m);
      mounds.push(m);
    }
    arena.appendChild(moundsRow);
    body.appendChild(arena);

    const endBtn = document.createElement('button');
    endBtn.className = 'modal-btn secondary'; endBtn.type = 'button'; endBtn.textContent = '끝내기';
    endBtn.style.marginTop = '6px';
    body.appendChild(endBtn);

    let endedFlag = false;
    let round = 1;
    let totalFound = 0, totalWrong = 0;
    let bones = new Set(); // 현재 라운드 뼈 위치
    let dug = new Set();   // 이미 판 곳
    let acceptInput = false;
    const _diff = diffMul();

    function showRound() {
      acceptInput = false;
      // 라운드별 뼈 개수: 라운드 1=2, 2=3, 3=4, 4=4
      const n = Math.min(4, round + 1);
      // 라운드별 보여주는 시간 (난이도 따라 짧아짐)
      const PEEK_MS = Math.max(900, 1500 / _diff);
      bones = new Set();
      dug = new Set();
      while (bones.size < n) bones.add(Math.floor(Math.random() * 6));
      mounds.forEach(m => m.classList.remove('reveal','correct','wrong','dug'));
      stateEl.textContent = '👀 보세요...';
      // 보여주기
      bones.forEach(idx => mounds[idx].classList.add('reveal'));
      try { SOUNDS.pop(); } catch {}
      setTimeout(() => {
        if (endedFlag) return;
        mounds.forEach(m => m.classList.remove('reveal'));
        stateEl.textContent = '🤔 어디였더라?';
        acceptInput = true;
      }, PEEK_MS);
    }

    function onMoundTap(idx) {
      if (!acceptInput || endedFlag) return;
      if (dug.has(idx)) return;
      dug.add(idx);
      const m = mounds[idx];
      if (bones.has(idx)) {
        m.classList.add('correct');
        totalFound += 1;
        try { SOUNDS.fanfare(); } catch {}
      } else {
        m.classList.add('wrong');
        totalWrong += 1;
        try { SOUNDS.whimper(); } catch {}
      }
      // 모든 뼈 찾으면 다음 라운드
      const foundNow = [...bones].filter(b => dug.has(b)).length;
      if (foundNow === bones.size) {
        acceptInput = false;
        round += 1;
        roundEl.textContent = '🎯 라운드 ' + round;
        if (round > 4) endGame();
        else setTimeout(showRound, 700);
      }
      // 너무 많이 틀리면 라운드 강제 종료
      const wrongs = [...dug].filter(d => !bones.has(d)).length;
      if (wrongs >= 3) {
        acceptInput = false;
        endGame();
      }
    }
    mounds.forEach((m, i) => {
      m.addEventListener('click', (e) => { e.preventDefault(); onMoundTap(i); });
      m.addEventListener('touchstart', (e) => { e.preventDefault(); onMoundTap(i); }, { passive: false });
    });

    function endGame() {
      if (endedFlag) return;
      endedFlag = true;
      decayPaused = false;
      let happyGain, careBoost, badge, tier;
      if (totalFound >= 12)      { happyGain = 50; careBoost = 2; badge = '⭐ 최고예요!';   tier = 'best'; }
      else if (totalFound >= 8)  { happyGain = 35; careBoost = 1; badge = '👍 잘했어요!';   tier = 'good'; }
      else if (totalFound >= 4)  { happyGain = 22; careBoost = 1; badge = '🙂 좋아요!';     tier = 'ok';   }
      else                        { happyGain = 10; careBoost = 0; badge = '😅 다시 도전!'; tier = 'low';  }
      state.happy = clamp(state.happy + happyGain);
      for (let i = 0; i < careBoost; i++) {
        state.careLastTick = (state.careLastTick || 0) - CARE_TICK_MS;
        addCareScore();
      }
      state.points = (state.points || 0) + totalFound * 3;
      markPlayDone('bury');
      progressMission('minigame', 1);
      saveState(); render(); SOUNDS.fanfare();
      openResultModal({
        title: '뼈 묻기 끝!',
        bigCount: totalFound + '개',
        countLabel: '찾았어요',
        badge, tier,
        rewards: [
          ['💖', '행복', '+' + happyGain],
          ...(careBoost ? [['🌟', '케어', '+' + careBoost]] : []),
          ['❌', '틀림', totalWrong],
        ],
      });
    }

    endBtn.addEventListener('click', () => endGame());
    openModal({
      title: '⛰️ 뼈 묻기', body, mandatory: true,
      onClose: () => { if (!endedFlag) { endedFlag = true; decayPaused = false; markPlayDone('bury'); saveState(); } },
    });
    setTimeout(showRound, 600);
  }

  // ----- 설정 모달 --------------------------------------------------------
  function openSettingsModal() {
    const body = document.createElement('div');
    const rows = [
      { label: '소리', val: muted ? '꺼짐' : '켜짐', btnLabel: muted ? '켜기' : '끄기', action: () => {
        muted = !muted;
        localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
        if (!muted) SOUNDS.happy();
        openSettingsModal();
      }},
      { label: '이름', val: state.name || '없음', btnLabel: '바꾸기', action: () => openNameModal({ initial: state.name }) },
      { label: '강아지 종', val: (BREEDS.find(b => b.id === state.breed) || {}).name || '없음', btnLabel: '바꾸기 (500점)', action: () => openBreedModal({ mandatory: false }) },
      { label: '케어포인트', val: '🌟 ' + (state.points || 0), btnLabel: null, action: null },
      { label: '진화점수', val: state.care + '점', btnLabel: null, action: null },
    ];
    rows.forEach(r => {
      const div = document.createElement('div');
      div.className = 'settings-row';
      const lbl = document.createElement('span'); lbl.className = 'lbl'; lbl.textContent = r.label;
      const val = document.createElement('span'); val.className = 'val'; val.textContent = r.val;
      div.appendChild(lbl);
      div.appendChild(val);
      if (r.btnLabel) {
        const btn = document.createElement('button');
        btn.type = 'button'; btn.textContent = r.btnLabel;
        btn.addEventListener('click', () => { SOUNDS.pop(); r.action(); });
        div.appendChild(btn);
      }
      body.appendChild(div);
    });

    // 백업/복원 — 설정 안에 별도 영역
    const backup = document.createElement('div');
    backup.className = 'settings-row';
    const bLbl = document.createElement('span'); bLbl.className = 'lbl'; bLbl.textContent = '백업';
    const bVal = document.createElement('span'); bVal.className = 'val'; bVal.textContent = '내보내기/불러오기';
    const exportBtn = document.createElement('button');
    exportBtn.type = 'button'; exportBtn.textContent = '⬇️ 내보내기';
    exportBtn.addEventListener('click', () => { SOUNDS.pop(); exportSaveFile(); });
    const importBtn = document.createElement('button');
    importBtn.type = 'button'; importBtn.textContent = '⬆️ 불러오기';
    importBtn.style.marginLeft = '6px';
    importBtn.addEventListener('click', () => { SOUNDS.pop(); openImportModal(); });
    backup.appendChild(bLbl);
    backup.appendChild(bVal);
    backup.appendChild(exportBtn);
    backup.appendChild(importBtn);
    body.appendChild(backup);

    // 보호자 모드 진입
    const guardianRow = document.createElement('div');
    guardianRow.className = 'settings-row';
    const gl = document.createElement('span'); gl.className = 'lbl'; gl.textContent = '보호자 모드';
    const gv = document.createElement('span'); gv.className = 'val';
    gv.textContent = guardian.pin
      ? (guardian.limitMin > 0 ? `켜짐 (${guardian.limitMin}분/일)` : '켜짐')
      : '꺼짐';
    const gBtn = document.createElement('button');
    gBtn.type = 'button';
    gBtn.textContent = guardian.pin ? '열기' : '설정';
    gBtn.addEventListener('click', () => { SOUNDS.pop(); openGuardianEntry(); });
    guardianRow.appendChild(gl); guardianRow.appendChild(gv); guardianRow.appendChild(gBtn);
    body.appendChild(guardianRow);

    // 처음부터 다시 시작 — 설정 맨 아래 위험 액션 영역
    const danger = document.createElement('div');
    danger.className = 'settings-danger';
    const dangerBtn = document.createElement('button');
    dangerBtn.type = 'button';
    dangerBtn.className = 'modal-btn danger';
    dangerBtn.textContent = '🔄 처음부터 다시';
    dangerBtn.addEventListener('click', () => { SOUNDS.pop(); openResetConfirmModal(); });
    danger.appendChild(dangerBtn);
    body.appendChild(danger);

    openModal({ title: '⚙️ 설정', body });
  }

  // ----- 백업/복원 --------------------------------------------------------
  function exportSaveFile() {
    flushSaveState();
    try {
      const payload = {
        app: 'dogs',
        version: 1,
        exportedAt: new Date().toISOString(),
        state: state,
      };
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const nm = (state.name || 'pet').replace(/[^a-zA-Z0-9가-힣_-]/g, '');
      a.href = url;
      a.download = `dogs-save-${nm}-${ts}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      try { SOUNDS.fanfare(); } catch {}
    } catch (e) {
      alert('내보내기 실패 — 브라우저 저장 권한을 확인해주세요.');
    }
  }

  function openImportModal() {
    const body = document.createElement('div');
    const warn = document.createElement('p');
    warn.className = 'modal-sub';
    warn.textContent = '불러오면 지금 저장된 데이터를 덮어써요. 먼저 내보내기로 백업하는 걸 추천해요.';
    body.appendChild(warn);

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json,.json';
    fileInput.style.display = 'block';
    fileInput.style.margin = '10px 0';
    body.appendChild(fileInput);

    const status = document.createElement('p');
    status.className = 'modal-sub';
    status.style.minHeight = '1.4em';
    body.appendChild(status);

    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.className = 'modal-btn';
    okBtn.textContent = '불러오기';
    okBtn.disabled = true;
    body.appendChild(okBtn);

    let pendingState = null;
    fileInput.addEventListener('change', () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const obj = JSON.parse(String(reader.result));
          const s = (obj && obj.state) ? obj.state : obj;
          if (!s || typeof s !== 'object' || typeof s.hunger !== 'number') {
            throw new Error('형식이 올바르지 않아요');
          }
          pendingState = s;
          status.textContent = '✓ 파일 확인됨 — "불러오기" 버튼을 눌러주세요';
          okBtn.disabled = false;
        } catch (e) {
          pendingState = null;
          status.textContent = '✕ 올바른 백업 파일이 아니에요';
          okBtn.disabled = true;
        }
      };
      reader.readAsText(f);
    });
    okBtn.addEventListener('click', () => {
      if (!pendingState) return;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingState));
        location.reload();
      } catch (e) {
        status.textContent = '✕ 저장 실패';
      }
    });

    openModal({ title: '⬆️ 불러오기', body });
  }

  // ----- 리셋 확인 + 핸들러 -----------------------------------------------
  function openResetConfirmModal() {
    const body = document.createElement('div');
    const p = document.createElement('p');
    p.className = 'modal-sub reset-warn';
    const nm = state.name || '강아지';
    p.textContent = `정말 처음부터 다시 시작할까요? 그동안 키운 ${nameWithSubject(nm)} 사라져요.`;
    body.appendChild(p);

    const yes = document.createElement('button');
    yes.type = 'button';
    yes.className = 'modal-btn danger';
    yes.textContent = '네, 다시 시작할게요';
    yes.addEventListener('click', () => { performReset(); });
    body.appendChild(yes);

    const no = document.createElement('button');
    no.type = 'button';
    no.className = 'modal-btn secondary';
    no.textContent = '아니요, 취소';
    no.style.marginTop = '8px';
    no.addEventListener('click', () => { SOUNDS.pop(); closeModal(); openSettingsModal(); });
    body.appendChild(no);

    openModal({ title: '처음부터 다시 시작?', body });
  }

  // in-app "처음부터 다시" — ?nuke=1 페이지로 navigate (가장 확실한 청소).
  // hardReset을 직접 호출하는 대신 nuke URL 진입으로 옛 IIFE/SW 메모리도 함께 폐기.
  // ----- 게임오버 (가출) ----------------------------------------------------
  function triggerRunaway() {
    if (state.gameOver) return;
    state.gameOver = true;
    saveState();
    // 가출 연출 — 강아지 화면 밖으로
    if (puppyWrap) {
      puppyWrap.dataset.direction = 'right';
      puppyWrap.style.transition = 'left 4s linear, opacity 4s';
      puppyWrap.style.left = '120%';
      puppyWrap.style.opacity = '0';
    }
    setTimeout(() => openGameOverModal(), 3500);
  }
  function openGameOverModal() {
    const body = document.createElement('div');
    const p = document.createElement('p');
    p.className = 'modal-sub';
    const nm = state.name || '강아지';
    p.innerHTML = `${nameWithSubject(nm)} 너무 외로워서 떠나갔어요...<br><br>
      함께한 추억:<br>
      🌟 케어포인트 ${state.points || 0}점<br>
      🐾 ${state.care} 진화점수<br>
      🛍 보유 액세서리 ${Object.keys(state.inventory||{}).length}개`;
    body.appendChild(p);
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'modal-btn danger'; btn.textContent = '🔄 다시 시작';
    btn.addEventListener('click', () => { performReset(); });
    body.appendChild(btn);
    openModal({ title: '강아지가 떠났어요', body, mandatory: true });
  }

  // ----- 병원 — 메인 메뉴 + 진단 + 치료 + 약품 + 예방 + 기록 ----------------
  function isEmergency() {
    if (!state.sick) return false;
    return GAUGES.filter(g => state[g] <= 10).length >= 2;
  }

  function performHeal(diseaseId, sourceLabel, costPaid) {
    const d = DISEASES[diseaseId] || DISEASES.cold;
    state.sick = null;
    state.happy = clamp(state.happy + 20);
    for (const g of GAUGES) state[g] = clamp(state[g] + 10);
    if (!Array.isArray(state.vetLog)) state.vetLog = [];
    state.vetLog.unshift({
      ts: Date.now(),
      disease: d.id,
      diseaseName: d.name,
      cost: costPaid,
      source: sourceLabel || '병원',
    });
    if (state.vetLog.length > 30) state.vetLog.length = 30;
    saveState(); render();
    SOUNDS.fanfare();
    showSpeech('다 나았어요! 💖 고마워요!', 3000);
  }

  function openVetModal() {
    const body = document.createElement('div');

    // 헤더 — 의사 강아지 + 인사말
    const npc = document.createElement('div');
    npc.className = 'vet-npc';
    npc.innerHTML = `<span class="vet-doc">👨‍⚕️</span><span class="vet-msg"></span>`;
    const msgEl = npc.querySelector('.vet-msg');
    body.appendChild(npc);

    // 상태 카드
    const status = document.createElement('div');
    status.className = 'vet-status';
    if (state.sick) {
      const d = DISEASES[state.sick.id] || DISEASES.cold;
      const emerg = isEmergency();
      msgEl.textContent = emerg ? '🚨 응급이에요! 빨리 치료해요' : `${d.bubble}`;
      status.innerHTML = `
        <div class="vet-disease ${emerg ? 'emergency' : ''}">
          <span class="vet-disease-emoji">${d.emoji}</span>
          <div>
            <div class="vet-disease-name">${d.name}${emerg ? ' (응급)' : ''}</div>
            <div class="vet-disease-tip">${d.tip}</div>
          </div>
        </div>
      `;
    } else {
      msgEl.textContent = '오늘은 건강하네요! 👍';
      status.innerHTML = `<div class="vet-healthy">🌟 ${state.name || '강아지'}는 건강해요</div>`;
    }
    body.appendChild(status);

    // 메인 액션 — 카드 그리드
    const grid = document.createElement('div');
    grid.className = 'vet-grid';
    const cards = [];

    if (state.sick) {
      const d = DISEASES[state.sick.id] || DISEASES.cold;
      const emerg = isEmergency();
      const cost = emerg ? d.cost + 50 : d.cost;
      // 1) 직접 치료 (병원)
      cards.push({
        title: emerg ? '🚨 응급 치료' : '🩺 진료받기',
        sub: `${d.name} 치료 — ${cost}점`,
        onClick: () => {
          if ((state.points || 0) < cost) { showSpeech('🌟 점수가 부족해요', 1800); return; }
          state.points -= cost;
          closeModal();
          const stageEl = document.querySelector('.stage');
          if (stageEl) {
            const cel = document.createElement('div');
            cel.className = 'wash-celebrate';
            cel.textContent = emerg ? '🚨 응급 처치 중...' : '🏥 진료 중...';
            stageEl.appendChild(cel);
            setTimeout(() => cel.remove(), 4500);
          }
          setTimeout(() => performHeal(d.id, emerg ? '응급실' : '병원', cost), emerg ? 3500 : 5000);
        },
      });
      // 2) 약품 인벤토리에 맞는 약 있으면
      const med = MEDICINES[d.med];
      const have = (state.medInv || {})[d.med] || 0;
      if (med && have > 0) {
        cards.push({
          title: `${med.emoji} ${med.name}`,
          sub: `보유 ${have}개 — 집에서 치료 (무료)`,
          onClick: () => {
            state.medInv[d.med] = have - 1;
            closeModal();
            // 처치 미니게임 또는 즉시
            openTreatMinigame(d.id, () => performHeal(d.id, '집에서 약', 0));
          },
        });
      }
    } else {
      // 정기 검진
      const last = state.lastCheckup || 0;
      const daysAgo = Math.floor((Date.now() - last) / (24 * 60 * 60 * 1000));
      const canCheckup = !last || daysAgo >= CHECKUP_INTERVAL_DAYS;
      cards.push({
        title: '🩺 정기 검진',
        sub: canCheckup ? `보너스 +${CHECKUP_REWARD}점` : `${CHECKUP_INTERVAL_DAYS - daysAgo}일 후 다시 가능`,
        disabled: !canCheckup,
        onClick: () => {
          state.points = (state.points || 0) + CHECKUP_REWARD;
          state.lastCheckup = Date.now();
          saveState(); render();
          showSpeech(`✨ 검진 완료! +${CHECKUP_REWARD}점`, 2400);
          SOUNDS.fanfare();
          closeModal();
        },
      });
    }
    // 예방접종 — 유효기간 표시
    const now = Date.now();
    const vu = state.vaccineUntil || 0;
    const vaccineActive = vu > now;
    const remDays = vaccineActive ? Math.ceil((vu - now) / (24 * 60 * 60 * 1000)) : 0;
    const vaccineMed = MEDICINES.vaccine;
    cards.push({
      title: `💉 예방접종`,
      sub: vaccineActive ? `${remDays}일 면역 중` : `${vaccineMed.price}점 — ${VACCINE_DAYS}일 동안 안 아파요`,
      disabled: vaccineActive,
      onClick: () => {
        if ((state.points || 0) < vaccineMed.price) { showSpeech('🌟 점수가 부족해요', 1800); return; }
        state.points -= vaccineMed.price;
        state.vaccineUntil = now + VACCINE_DAYS * 24 * 60 * 60 * 1000;
        saveState(); render();
        showSpeech('💉 예방접종 완료!', 2400);
        SOUNDS.fanfare();
        closeModal();
      },
    });
    // 약품 사기 (상점)
    cards.push({
      title: '🛒 약 사기',
      sub: '집에 두면 가벼운 병 셀프 치료',
      onClick: () => { closeModal(); openMedShopModal(); },
    });
    // 진료 기록
    cards.push({
      title: '📋 진료 기록',
      sub: `최근 ${(state.vetLog || []).length}건`,
      onClick: () => { closeModal(); openVetLogModal(); },
    });

    cards.forEach(c => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'vet-card' + (c.disabled ? ' is-disabled' : '');
      b.innerHTML = `<div class="vet-card-title">${c.title}</div><div class="vet-card-sub">${c.sub}</div>`;
      if (!c.disabled) b.addEventListener('click', () => { SOUNDS.pop(); c.onClick(); });
      grid.appendChild(b);
    });
    body.appendChild(grid);

    openModal({ title: '🏥 병원', body });
  }

  function openMedShopModal() {
    const body = document.createElement('div');
    const grid = document.createElement('div');
    grid.className = 'vet-grid';
    Object.values(MEDICINES).forEach(m => {
      if (m.vaccine) return; // 예방접종은 메인 메뉴에
      const owned = (state.medInv || {})[m.id] || 0;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'vet-card';
      const canBuy = (state.points || 0) >= m.price;
      if (!canBuy) card.classList.add('is-disabled');
      card.innerHTML = `
        <div class="vet-card-title">${m.emoji} ${m.name}</div>
        <div class="vet-card-sub">${m.price}점 — ${DISEASES[m.treats]?.name || ''} 치료</div>
        <div class="vet-card-tag">보유 ${owned}</div>
      `;
      if (canBuy) card.addEventListener('click', () => {
        state.points -= m.price;
        if (!state.medInv) state.medInv = {};
        state.medInv[m.id] = owned + 1;
        SOUNDS.pop();
        saveState(); render();
        openMedShopModal();
      });
      grid.appendChild(card);
    });
    body.appendChild(grid);
    const back = document.createElement('button');
    back.type = 'button'; back.className = 'modal-btn secondary'; back.textContent = '← 병원';
    back.style.marginTop = '8px';
    back.addEventListener('click', () => { closeModal(); openVetModal(); });
    body.appendChild(back);
    openModal({ title: '🛒 약국', body });
  }

  function openVetLogModal() {
    const body = document.createElement('div');
    const log = (state.vetLog || []);
    if (!log.length) {
      const p = document.createElement('p'); p.className = 'modal-sub';
      p.textContent = '아직 진료 기록이 없어요';
      body.appendChild(p);
    } else {
      const list = document.createElement('div');
      list.className = 'vet-log-list';
      log.forEach(e => {
        const d = new Date(e.ts);
        const item = document.createElement('div');
        item.className = 'vet-log-item';
        item.innerHTML = `
          <div class="vet-log-date">${d.getMonth()+1}월 ${d.getDate()}일</div>
          <div class="vet-log-body">${DISEASES[e.disease]?.emoji || ''} ${e.diseaseName} · ${e.source}</div>
          <div class="vet-log-cost">${e.cost > 0 ? '−' + e.cost : '무료'}</div>
        `;
        list.appendChild(item);
      });
      body.appendChild(list);
    }
    const back = document.createElement('button');
    back.type = 'button'; back.className = 'modal-btn secondary'; back.textContent = '← 병원';
    back.style.marginTop = '12px';
    back.addEventListener('click', () => { closeModal(); openVetModal(); });
    body.appendChild(back);
    openModal({ title: '📋 진료 기록', body });
  }

  // 처치 미니게임 — 약 먹이기 (떨어지는 알약을 강아지 입에 받기, 5초)
  function openTreatMinigame(diseaseId, onDone) {
    const d = DISEASES[diseaseId] || DISEASES.cold;
    const body = document.createElement('div');
    const guide = document.createElement('div');
    guide.className = 'mg-guide';
    guide.innerHTML = `${d.emoji} <b>${d.name}</b> 치료 중! 약을 입에 받아주세요`;
    body.appendChild(guide);

    const stats = document.createElement('div');
    stats.className = 'minigame-stats';
    const timeEl = document.createElement('span');
    const gotEl = document.createElement('span');
    timeEl.textContent = '⏱ 6';
    gotEl.textContent = '💊 0/3';
    stats.appendChild(timeEl); stats.appendChild(gotEl);
    body.appendChild(stats);

    const tBar = document.createElement('div'); tBar.className = 'mg-timebar';
    const tFill = document.createElement('div'); tFill.className = 'mg-timebar-fill';
    tBar.appendChild(tFill); body.appendChild(tBar);

    const arena = document.createElement('div');
    arena.className = 'minigame-arena big treat-arena';
    arena.dataset.breed = state.breed || 'shiba';
    const dog = document.createElement('img');
    dog.className = 'mg-dog treat-dog';
    dog.src = decideSpriteSrc('eating');
    arena.appendChild(dog);
    body.appendChild(arena);

    let got = 0, missed = 0, dogX = null;
    const TARGET = 3;
    const TOTAL = 6000;
    const started = performance.now();
    let lastFrame = started;
    let nextSpawn = 700;
    let spawnAccum = 0;
    const pills = [];
    let endedFlag = false;

    function arenaRect() { return arena.getBoundingClientRect(); }
    function spawnPill() {
      const r = arenaRect();
      const x = 30 + Math.random() * (r.width - 60);
      const el = document.createElement('div');
      el.className = 'treat-item';
      el.textContent = '💊';
      el.style.left = x + 'px';
      el.style.top = '0px';
      arena.appendChild(el);
      pills.push({ el, x, y: 0, vy: 70 });
    }
    function onTap(e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      const r = arenaRect();
      const t = e.touches && e.touches[0] ? e.touches[0] : e;
      const cx = (t.clientX !== undefined) ? (t.clientX - r.left) : r.width / 2;
      dogX = Math.max(40, Math.min(r.width - 40, cx));
    }
    arena.addEventListener('click', onTap);
    arena.addEventListener('touchstart', onTap, { passive: false });
    arena.addEventListener('touchmove', onTap, { passive: false });

    function step(now) {
      if (endedFlag) return;
      const dt = Math.min(40, now - lastFrame) / 1000;
      lastFrame = now;
      const elapsed = now - started;
      const remain = Math.max(0, TOTAL - elapsed);
      timeEl.textContent = '⏱ ' + Math.ceil(remain / 1000);
      tFill.style.width = (remain / TOTAL * 100) + '%';
      const r = arenaRect();
      if (dogX === null) dogX = r.width / 2;
      dog.style.left = dogX + 'px';
      dog.style.transform = 'translateX(-50%)';
      spawnAccum += (now - (step._lastT || now));
      step._lastT = now;
      if (spawnAccum >= nextSpawn) {
        spawnAccum = 0; nextSpawn = 700 + Math.random() * 400;
        if (got < TARGET) spawnPill();
      }
      for (let i = pills.length - 1; i >= 0; i--) {
        const p = pills[i];
        p.vy += 200 * dt;
        p.y += p.vy * dt;
        p.el.style.top = p.y + 'px';
        const dogY = r.height - 60;
        if (p.y >= dogY - 30 && Math.abs(p.x - dogX) < 50) {
          got += 1;
          gotEl.textContent = `💊 ${got}/${TARGET}`;
          try { SOUNDS.eat(); } catch {}
          p.el.remove();
          pills.splice(i, 1);
          if (got >= TARGET) { endedFlag = true; finish(true); return; }
          continue;
        }
        if (p.y > r.height + 40) { missed += 1; p.el.remove(); pills.splice(i, 1); }
      }
      if (remain <= 0) { endedFlag = true; finish(false); return; }
      requestAnimationFrame(step);
    }
    function finish(success) {
      while (pills.length) { try { pills[0].el.remove(); } catch {}; pills.shift(); }
      const body2 = document.createElement('div');
      const p = document.createElement('p'); p.className = 'modal-sub';
      p.innerHTML = success ? `✨ ${d.name} 치료 성공!<br>약 ${got}개 다 먹었어요` : `약을 ${got}개만 먹어서 효과가 약해요...<br>그래도 조금은 나아졌어요`;
      body2.appendChild(p);
      const ok = document.createElement('button');
      ok.className = 'modal-btn'; ok.type = 'button'; ok.textContent = '좋아요';
      ok.addEventListener('click', () => { closeModal(); if (typeof onDone === 'function') onDone(); });
      body2.appendChild(ok);
      openModal({ title: success ? '💊 완치!' : '💊 부분 치료', body: body2, mandatory: true });
    }
    openModal({ title: '💊 약 먹이기', body, mandatory: true,
      onClose: () => { endedFlag = true; }
    });
    setTimeout(() => { lastFrame = performance.now(); step._lastT = lastFrame; requestAnimationFrame(step); }, 80);
  }

  function performReset() {
    try { location.replace(location.pathname + '?nuke=1&t=' + Date.now()); }
    catch { hardReset(); }
  }

  // ----- 헤더 버튼 핸들러 -------------------------------------------------
  settingsBtn.addEventListener('click', () => { SOUNDS.pop(); openSettingsModal(); });
  missionBtn.addEventListener('click', () => { SOUNDS.pop(); openMissionsModal(); });
  vetBtn?.addEventListener('click', () => { SOUNDS.pop(); openVetModal(); });
  document.getElementById('petPickerBtn')?.addEventListener('click', () => { SOUNDS.pop(); openPetPicker(); });
  careBadge?.addEventListener('click', () => { SOUNDS.pop(); openCareMenu(); });

  function openCareMenu() {
    const body = document.createElement('div');
    body.className = 'care-menu-grid';
    const items = [
      { emoji: '🛍️', label: '상점', fn: openShopModal },
      { emoji: '🏠', label: '방 꾸미기', fn: openRoomModal },
    ];
    items.forEach(({ emoji, label, fn }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'care-menu-item';
      btn.innerHTML = `<span class="care-menu-emoji">${emoji}</span><span class="care-menu-label">${label}</span>`;
      btn.addEventListener('click', () => { closeModal(); fn(); });
      body.appendChild(btn);
    });
    openModal({ title: '🌟 ' + (state.points || 0), body });
  }

  // ----- 보호자 모드 ------------------------------------------------------
  // 4~7세 사용자 대상 → PIN은 토들러 차단용 (보안 아님). 별도 storage 키.
  const GUARDIAN_KEY = 'dogs.guardian.v1';
  function todayKey() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${dd}`;
  }
  function loadGuardian() {
    try {
      const raw = localStorage.getItem(GUARDIAN_KEY);
      if (!raw) return { pin: '', limitMin: 0, log: {}, actions: {}, sessionStart: 0 };
      const g = JSON.parse(raw);
      return {
        pin: typeof g.pin === 'string' ? g.pin : '',
        limitMin: typeof g.limitMin === 'number' ? g.limitMin : 0,
        log: (g.log && typeof g.log === 'object') ? g.log : {},
        actions: (g.actions && typeof g.actions === 'object') ? g.actions : {},
        sessionStart: 0,
      };
    } catch { return { pin: '', limitMin: 0, log: {}, actions: {}, sessionStart: 0 }; }
  }
  function saveGuardian() {
    try {
      const persisted = { pin: guardian.pin, limitMin: guardian.limitMin, log: guardian.log, actions: guardian.actions };
      localStorage.setItem(GUARDIAN_KEY, JSON.stringify(persisted));
    } catch {}
  }
  const guardian = loadGuardian();

  // 7일 초과한 로그 정리 (저장공간 절약 — 통계는 7일치만 보여줌)
  function pruneGuardianLog() {
    const keys = Object.keys(guardian.log).sort();
    if (keys.length <= 14) return; // 2주치는 보존 (안전 여유)
    const keep = keys.slice(-14);
    const keepSet = new Set(keep);
    for (const k of keys) if (!keepSet.has(k)) delete guardian.log[k];
  }

  // 플레이 시간 트래킹 — 보이는 동안만 누적
  function startGuardianSession() {
    if (guardian.sessionStart) return;
    guardian.sessionStart = Date.now();
  }
  function commitGuardianSession() {
    if (!guardian.sessionStart) return;
    const elapsedMin = (Date.now() - guardian.sessionStart) / 60000;
    if (elapsedMin > 0.05) {
      const k = todayKey();
      guardian.log[k] = Math.round(((guardian.log[k] || 0) + elapsedMin) * 10) / 10;
      pruneGuardianLog();
      saveGuardian();
    }
    guardian.sessionStart = 0;
  }
  function todayPlayedMin() {
    let m = guardian.log[todayKey()] || 0;
    if (guardian.sessionStart) m += (Date.now() - guardian.sessionStart) / 60000;
    return m;
  }
  function logGuardianAction(action) {
    if (!action) return;
    guardian.actions[action] = (guardian.actions[action] || 0) + 1;
    // 액션 통계는 자주 호출되므로 saveGuardian은 디바운스
    if (!logGuardianAction._t) {
      logGuardianAction._t = setTimeout(() => { logGuardianAction._t = null; saveGuardian(); }, 1500);
    }
  }
  function isOverDailyLimit() {
    if (!guardian.limitMin || guardian.limitMin <= 0) return false;
    return todayPlayedMin() >= guardian.limitMin;
  }
  let lockShown = false;
  function showLockModal() {
    if (lockShown) return;
    lockShown = true;
    const body = document.createElement('div');
    const p = document.createElement('p');
    p.className = 'modal-sub';
    p.textContent = `오늘은 ${guardian.limitMin}분 다 놀았어요. 내일 또 만나요!`;
    body.appendChild(p);
    const hint = document.createElement('p');
    hint.className = 'modal-sub';
    hint.style.opacity = '0.7';
    hint.style.fontSize = '0.9em';
    hint.textContent = '보호자: 설정 → 보호자 모드에서 시간을 늘릴 수 있어요.';
    body.appendChild(hint);
    openModal({ title: '⏰ 잠시 쉬어요', body, mandatory: true });
  }
  function checkDailyLimit() {
    if (isOverDailyLimit()) { showLockModal(); return true; }
    return false;
  }

  // 1분마다 세션 누적 저장 (백그라운드 손실 최소화)
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    commitGuardianSession();
    startGuardianSession();
    if (isOverDailyLimit()) showLockModal();
  }, 60 * 1000);

  // ----- 보호자 PIN/설정 모달 ----------------------------------------------
  function openGuardianGateModal({ onPass }) {
    if (!guardian.pin) { onPass(); return; }
    const body = document.createElement('div');
    const p = document.createElement('p');
    p.className = 'modal-sub';
    p.textContent = '보호자 PIN 4자리를 입력해 주세요';
    body.appendChild(p);

    const display = document.createElement('div');
    display.style.fontSize = '32px';
    display.style.letterSpacing = '12px';
    display.style.textAlign = 'center';
    display.style.margin = '12px 0';
    display.style.minHeight = '40px';
    body.appendChild(display);

    const pad = document.createElement('div');
    pad.style.display = 'grid';
    pad.style.gridTemplateColumns = 'repeat(3, 1fr)';
    pad.style.gap = '8px';
    let pin = '';
    function refresh() {
      display.textContent = '●'.repeat(pin.length) + '○'.repeat(4 - pin.length);
    }
    refresh();
    const layout = ['1','2','3','4','5','6','7','8','9','','0','⌫'];
    layout.forEach(ch => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'modal-btn secondary';
      b.style.fontSize = '20px';
      b.style.padding = '14px';
      if (!ch) { b.disabled = true; b.style.visibility = 'hidden'; }
      b.textContent = ch || '';
      b.addEventListener('click', () => {
        if (ch === '⌫') { pin = pin.slice(0, -1); }
        else if (/^\d$/.test(ch) && pin.length < 4) { pin += ch; }
        refresh();
        if (pin.length === 4) {
          if (pin === guardian.pin) { closeModal(); onPass(); }
          else {
            display.textContent = '✕ 다시 시도';
            pin = '';
            setTimeout(refresh, 700);
          }
        }
      });
      pad.appendChild(b);
    });
    body.appendChild(pad);

    openModal({ title: '🛡️ 보호자', body });
  }

  function openGuardianSetupModal() {
    const body = document.createElement('div');
    const p = document.createElement('p');
    p.className = 'modal-sub';
    p.textContent = '새 PIN 4자리를 설정해 주세요 (보호자만 알 수 있도록)';
    body.appendChild(p);

    const display = document.createElement('div');
    display.style.fontSize = '32px';
    display.style.letterSpacing = '12px';
    display.style.textAlign = 'center';
    display.style.margin = '12px 0';
    body.appendChild(display);

    let pin = '';
    function refresh() { display.textContent = pin + '○'.repeat(4 - pin.length); }
    refresh();

    const pad = document.createElement('div');
    pad.style.display = 'grid';
    pad.style.gridTemplateColumns = 'repeat(3, 1fr)';
    pad.style.gap = '8px';
    const layout = ['1','2','3','4','5','6','7','8','9','','0','⌫'];
    layout.forEach(ch => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'modal-btn secondary';
      b.style.fontSize = '20px';
      b.style.padding = '14px';
      if (!ch) { b.disabled = true; b.style.visibility = 'hidden'; }
      b.textContent = ch || '';
      b.addEventListener('click', () => {
        if (ch === '⌫') pin = pin.slice(0, -1);
        else if (/^\d$/.test(ch) && pin.length < 4) pin += ch;
        refresh();
      });
      pad.appendChild(b);
    });
    body.appendChild(pad);

    const ok = document.createElement('button');
    ok.type = 'button';
    ok.className = 'modal-btn';
    ok.textContent = '저장';
    ok.style.marginTop = '12px';
    ok.addEventListener('click', () => {
      if (pin.length !== 4) return;
      guardian.pin = pin;
      saveGuardian();
      openGuardianDashboard();
    });
    body.appendChild(ok);

    openModal({ title: '🛡️ 보호자 PIN 설정', body });
  }

  function openGuardianDashboard() {
    const body = document.createElement('div');

    // 오늘 플레이 시간
    const today = todayPlayedMin();
    const todayRow = document.createElement('div');
    todayRow.className = 'settings-row';
    const tl = document.createElement('span'); tl.className = 'lbl'; tl.textContent = '오늘 놀이 시간';
    const tv = document.createElement('span'); tv.className = 'val';
    tv.textContent = `${today.toFixed(1)}분` + (guardian.limitMin > 0 ? ` / ${guardian.limitMin}분` : '');
    todayRow.appendChild(tl); todayRow.appendChild(tv);
    body.appendChild(todayRow);

    // 일일 시간 제한
    const limitRow = document.createElement('div');
    limitRow.className = 'settings-row';
    const ll = document.createElement('span'); ll.className = 'lbl'; ll.textContent = '일일 시간 제한';
    const lv = document.createElement('span'); lv.className = 'val';
    lv.textContent = guardian.limitMin > 0 ? `${guardian.limitMin}분` : '없음';
    limitRow.appendChild(ll); limitRow.appendChild(lv);
    [0, 30, 60, 120].forEach(min => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = min === 0 ? '없음' : `${min}분`;
      if (guardian.limitMin === min) b.style.fontWeight = 'bold';
      b.style.marginLeft = '4px';
      b.addEventListener('click', () => {
        guardian.limitMin = min;
        saveGuardian();
        lockShown = false;
        openGuardianDashboard();
      });
      limitRow.appendChild(b);
    });
    body.appendChild(limitRow);

    // 7일 미니 차트 (텍스트)
    const chartRow = document.createElement('div');
    chartRow.style.padding = '10px 0';
    const chartTitle = document.createElement('div');
    chartTitle.style.fontSize = '0.9em';
    chartTitle.style.opacity = '0.7';
    chartTitle.textContent = '최근 7일 놀이 시간';
    chartRow.appendChild(chartTitle);
    const chart = document.createElement('div');
    chart.style.display = 'flex';
    chart.style.alignItems = 'flex-end';
    chart.style.gap = '4px';
    chart.style.height = '60px';
    chart.style.marginTop = '6px';
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({ k, label: ['일','월','화','수','목','금','토'][d.getDay()], min: guardian.log[k] || 0 });
    }
    if (days[6].k === todayKey() && guardian.sessionStart) {
      days[6].min += (Date.now() - guardian.sessionStart) / 60000;
    }
    const maxMin = Math.max(30, ...days.map(d => d.min));
    days.forEach(d => {
      const col = document.createElement('div');
      col.style.flex = '1';
      col.style.textAlign = 'center';
      col.style.fontSize = '0.75em';
      const bar = document.createElement('div');
      bar.style.height = `${Math.max(2, (d.min / maxMin) * 50)}px`;
      bar.style.background = 'var(--accent, #f4b183)';
      bar.style.borderRadius = '3px';
      bar.style.marginBottom = '2px';
      bar.title = `${d.k}: ${d.min.toFixed(1)}분`;
      col.appendChild(bar);
      const lbl = document.createElement('div');
      lbl.textContent = d.label;
      col.appendChild(lbl);
      chart.appendChild(col);
    });
    chartRow.appendChild(chart);
    body.appendChild(chartRow);

    // 액션 통계
    const statsTitle = document.createElement('div');
    statsTitle.style.fontSize = '0.9em';
    statsTitle.style.opacity = '0.7';
    statsTitle.style.marginTop = '8px';
    statsTitle.textContent = '액션 통계';
    body.appendChild(statsTitle);
    const labels = { feed: '🍖 먹이', play: '💖 놀이', wash: '🫧 씻기', sleep: '⚡ 재우기', minigame: '🎮 미니게임' };
    Object.entries(labels).forEach(([k, v]) => {
      const r = document.createElement('div');
      r.className = 'settings-row';
      const a = document.createElement('span'); a.className = 'lbl'; a.textContent = v;
      const c = document.createElement('span'); c.className = 'val'; c.textContent = `${guardian.actions[k] || 0}회`;
      r.appendChild(a); r.appendChild(c);
      body.appendChild(r);
    });

    // PIN 변경 / 해제
    const danger = document.createElement('div');
    danger.className = 'settings-danger';
    const changePin = document.createElement('button');
    changePin.type = 'button';
    changePin.className = 'modal-btn secondary';
    changePin.textContent = 'PIN 바꾸기';
    changePin.addEventListener('click', () => openGuardianSetupModal());
    danger.appendChild(changePin);
    const removePin = document.createElement('button');
    removePin.type = 'button';
    removePin.className = 'modal-btn secondary';
    removePin.textContent = '보호자 모드 끄기';
    removePin.style.marginTop = '6px';
    removePin.addEventListener('click', () => {
      guardian.pin = '';
      guardian.limitMin = 0;
      saveGuardian();
      lockShown = false;
      closeModal();
    });
    danger.appendChild(removePin);
    body.appendChild(danger);

    openModal({ title: '🛡️ 보호자 모드', body });
  }

  function openGuardianEntry() {
    if (!guardian.pin) { openGuardianSetupModal(); return; }
    openGuardianGateModal({ onPass: openGuardianDashboard });
  }

  // ----- visibility / lifecycle -------------------------------------------
  startGuardianSession();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { commitGuardianSession(); flushSaveState(); }
    else { startGuardianSession(); applyTod(); ensureTodayMissions(); render(); if (isOverDailyLimit()) showLockModal(); }
  });
  window.addEventListener('beforeunload', () => { commitGuardianSession(); flushSaveState(); });
  window.addEventListener('pagehide', () => { commitGuardianSession(); flushSaveState(); });

  // ----- PWA: service worker 등록 ----------------------------------------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }

  // ----- 첫 진입 흐름: 이름 → 종 -----------------------------------------
  applyTod();
  render();
  // busy 복귀 — 페이지 reload 후 진행 중이었으면 이어서
  if (state.busy && Date.now() < state.busy.endsAt) {
    scheduleBusyEnd();
  } else if (state.busy) {
    finishBusy(); // 이미 끝났으면 즉시 마무리
  }

  function bootstrap() {
    if (!state.name) {
      openNameModal({ mandatory: true, onSet: () => {
        if (!state.breed) openBreedModal({ mandatory: true });
      }});
    } else if (!state.breed) {
      openBreedModal({ mandatory: true });
    }
  }
  bootstrap();

  function clamp(v) {
    const n = Math.round(v);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(MAX, n));
  }

  // ----- Dev hooks --------------------------------------------------------
  window.__dogs = {
    reset() {
      localStorage.removeItem(STORAGE_KEY);
      state = defaultState();
      ensureTodayMissions();
      saveState();
      render();
      bootstrap();
    },
    get() { return JSON.parse(JSON.stringify(state)); },
    addCare(n) {
      state.care = (state.care || 0) + (n || 1);
      const newStage = stageForCare(state.care);
      if (newStage !== state.stage) {
        const prev = state.stage;
        state.stage = newStage;
        triggerEvolveFx(prev, newStage);
      }
      saveState();
      render();
      return state.care;
    },
    addPoints(n) { state.points = (state.points || 0) + (n || 100); saveState(); render(); return state.points; },
    setStage(stage) { state.stage = stage; saveState(); render(); },
    setBreed(b) { state.breed = b; saveState(); render(); },
    setTod(tod) { timeOverride = tod; applyTod(); render(); },
    clearTod() { timeOverride = null; applyTod(); render(); },
    forceEvolveFx() { triggerEvolveFx(); },
    openMinigame, openShop: openShopModal, openMissions: openMissionsModal,
    openPlayMenu, openPet: openPetGame, openDance: openDanceGame, openTreat: openTreatGame,
    openRoom: openRoomModal,
    openName: () => openNameModal({}), openBreed: () => openBreedModal({}),
    openSettings: openSettingsModal,
    openResetConfirm: openResetConfirmModal,
    josa,
    completeAllMissions() {
      ensureTodayMissions();
      state.missions.list.forEach(m => { m.progress = m.count; if (!m.claimed) { m.claimed = true; state.points += m.reward; } });
      saveState(); render();
    },
    // ----- Accessory test helpers -----
    giveAllAcc() {
      state.inventory = state.inventory || {};
      ACCESSORIES.forEach(a => { state.inventory[a.id] = true; });
      saveState(); render();
      return Object.keys(state.inventory).length;
    },
    tryAcc(slot, idx) {
      const id = `${slot}_${String(idx).padStart(2,'0')}`;
      if (!ACCESSORIES.find(a => a.id === id)) return null;
      state.inventory = state.inventory || {};
      state.inventory[id] = true;
      state.equipped[slot] = id;
      saveState(); render();
      return id;
    },
    tryAccCycle() {
      const slots = ['hat','neck','feet'];
      const next = {};
      for (const slot of slots) {
        const cur = state.equipped[slot];
        let n = 1;
        if (cur && /_(\d{2})$/.test(cur)) {
          n = (parseInt(cur.match(/_(\d{2})$/)[1], 10) % 10) + 1;
        }
        const id = `${slot}_${String(n).padStart(2,'0')}`;
        state.inventory = state.inventory || {};
        state.inventory[id] = true;
        state.equipped[slot] = id;
        next[slot] = id;
      }
      saveState(); render();
      return next;
    },
    tryAccUnequip() {
      ['hat','neck','feet'].forEach(s => state.equipped[s] = null);
      saveState(); render();
    },
  };

  // ----- ?testacc=1 — 디자이너 빠른 확인 모드 -----
  // 50개 인벤 시드 + 5 슬롯 1번 자동 장착 + 헤더 배지 표시
  if (new URLSearchParams(location.search).get('testacc') === '1') {
    setTimeout(() => {
      try {
        // 이름/종 미설정이면 자동 채우기 + setup 모달 닫기
        if (!state.name) state.name = '테스트';
        if (!state.breed) { state.breed = 'shiba'; state.species = 'dog'; }
        if (Array.isArray(state.pets) && state.pets[0]) {
          if (!state.pets[0].name) state.pets[0].name = state.name;
          if (!state.pets[0].breed) { state.pets[0].breed = state.breed; state.pets[0].species = 'dog'; }
        }
        document.querySelectorAll('.modal-backdrop, .modal').forEach(m => m.remove());
        window.__dogs.giveAllAcc();
        ['hat','neck','feet'].forEach(s => {
          state.equipped[s] = `${s}_01`;
        });
        saveState(); render();
        const badge = document.createElement('div');
        badge.textContent = '🧪 acc test — 콘솔: __dogs.tryAccCycle() / tryAcc(slot,idx) / tryAccUnequip()';
        badge.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#ffd800;color:#000;padding:4px 8px;font:bold 11px monospace;z-index:9999;text-align:center;cursor:pointer;';
        badge.title = '클릭으로 다음 액세서리 셋';
        badge.addEventListener('click', () => window.__dogs.tryAccCycle());
        document.body.appendChild(badge);
      } catch (e) { console.error('testacc setup failed', e); }
    }, 600);
  }
})();
