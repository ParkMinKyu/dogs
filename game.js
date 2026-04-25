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
    { id: 'shiba',   name: '시바이누', desc: '용감한 친구' },
    { id: 'maltese', name: '말티즈',   desc: '뽀송뽀송' },
    { id: 'poodle',  name: '푸들',     desc: '곱슬곱슬' },
    { id: 'husky',   name: '허스키',   desc: '눈송이 눈' },
  ];

  const ACCESSORIES = [
    { id: 'hat_red',   slot: 'hat',     name: '빨간 모자', price: 80,  emoji: '🎩' },
    { id: 'ribbon',    slot: 'hat',     name: '리본',     price: 60,  emoji: '🎀' },
    { id: 'collar',    slot: 'neck',    name: '목걸이',   price: 100, emoji: '🦴' },
    { id: 'scarf',     slot: 'neck',    name: '스카프',   price: 90,  emoji: '🧣' },
    { id: 'glasses',   slot: 'glasses', name: '안경',     price: 150, emoji: '🕶️' },
  ];

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

  function timeOfDayFor(date) {
    const h = date.getHours();
    if (h >= 6 && h < 18) return 'day';
    if (h >= 18 && h < 22) return 'evening';
    return 'night';
  }
  const TOD_LABEL = { day: '☀️ 낮', evening: '🌆 저녁', night: '🌙 밤' };

  // ----- Storage ----------------------------------------------------------
  const STORAGE_KEY = 'dogs.p0.state.v1';
  const MUTE_KEY    = 'dogs.p0.muted.v1';

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || typeof s !== 'object') return null;
      for (const g of GAUGES) {
        if (typeof s[g] !== 'number') return null;
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
      if (!s.equipped || typeof s.equipped !== 'object') s.equipped = { hat: null, neck: null, glasses: null };
      if (typeof s.minigameLastTs !== 'number') s.minigameLastTs = 0;
      if (!s.playLast || typeof s.playLast !== 'object') s.playLast = {};
      if (!s.roomInv || typeof s.roomInv !== 'object') s.roomInv = {};
      if (!Array.isArray(s.roomLayout)) s.roomLayout = [];
      if (s.busy && typeof s.busy === 'object') {
        if (typeof s.busy.action !== 'string' || typeof s.busy.endsAt !== 'number') s.busy = null;
      } else { s.busy = null; }
      if (!s.missions || typeof s.missions !== 'object') s.missions = { date: '', list: [] };
      return s;
    } catch { return null; }
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }

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
      equipped: { hat: null, neck: null, glasses: null },
      minigameLastTs: 0,
      playLast: {},
      roomInv: {},
      roomLayout: [],
      busy: null,
      missions: { date: '', list: [] },
    };
  }

  // 액션별 진행 시간 (ms). play_menu 는 즉시.
  // wash는 무제한 — 청결 100% 도달 시 자동 종료. ACTION_DURATION에 없음.
  const ACTION_DURATION = { feed: 5000, sleep: 8000 };

  function stageForCare(care) {
    // 0 또는 비정상 값은 무조건 puppy. fresh state 확실히 보호.
    if (!Number.isFinite(care) || care <= 0) return STAGES[0].id;
    let cur = STAGES[0].id;
    for (const s of STAGES) {
      if (care >= s.threshold) cur = s.id;
    }
    return cur;
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
        equipped: { hat: 'hat_red', neck: null, glasses: null },
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
  const careBadge  = $('#careBadge');
  const evolveFx   = $('#evolveFx');
  const titleEl    = $('#titleEl');
  const settingsBtn = $('#settingsBtn');
  const shopBtn    = $('#shopBtn');
  const missionBtn = $('#missionBtn');
  const roomBtn    = $('#roomBtn');
  const missionDot = $('#missionDot');
  const modalRoot  = $('#modalRoot');
  const accHatEl   = $('#accHat');
  const accNeckEl  = $('#accNeck');
  const accGlassesEl = $('#accGlasses');
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

  const SOUNDS = {
    eat: () => {
      // 두 번 씹는 듯한 짧은 톤 + 약간의 휨
      richBlip({ partials: [{ f: 480, type: 'triangle', g: 0.5, bend: 1.1 }, { f: 720, type: 'sine', g: 0.3 }], dur: 0.10, vol: 0.07 });
      setTimeout(() => richBlip({ partials: [{ f: 540, type: 'triangle', g: 0.5, bend: 0.9 }, { f: 800, type: 'sine', g: 0.3 }], dur: 0.10, vol: 0.07 }), 130);
    },
    happy: () => {
      // 상승 멜로디 + 화음
      richBlip({ partials: [{ f: 660, type: 'triangle', g: 0.5 }, { f: 990, type: 'sine', g: 0.3 }], dur: 0.12, vol: 0.06 });
      setTimeout(() => richBlip({ partials: [{ f: 880, type: 'triangle', g: 0.5 }, { f: 1320, type: 'sine', g: 0.3 }], dur: 0.16, vol: 0.06, vibrato: 8 }), 130);
    },
    splash: () => {
      // 노이즈 버스트 + 음정 하강 = 물 튀는 느낌
      noiseBurst({ dur: 0.22, vol: 0.04, hp: 1500 });
      richBlip({ partials: [{ f: 920, type: 'sine', g: 0.5, bend: 0.6 }, { f: 1400, type: 'sine', g: 0.3, bend: 0.6 }], dur: 0.22, vol: 0.05 });
    },
    sleep: () => {
      // 낮은 음 가벼운 비브라토 → 졸림
      richBlip({ partials: [{ f: 330, type: 'sine', g: 0.6 }, { f: 247, type: 'triangle', g: 0.4 }], dur: 0.32, vol: 0.05, attack: 0.04, release: 0.16, vibrato: 5 });
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
      // 잡았을 때 — 짧고 밝은 화음
      richBlip({ partials: [{ f: 880, type: 'triangle', g: 0.5 }, { f: 1320, type: 'sine', g: 0.3 }, { f: 1760, type: 'sine', g: 0.2 }], dur: 0.18, vol: 0.07 });
    },
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
  function applyOfflineDecay() {
    const now = Date.now();
    const elapsed = Math.max(0, now - (state.lastTs || now));
    const ticks = Math.floor(elapsed / TICK_MS);
    if (ticks > 0) {
      for (const g of GAUGES) {
        state[g] = clamp(state[g] - DECAY_PER_TICK * ticks);
      }
      state.lastTs = state.lastTs + ticks * TICK_MS;
    } else if (!state.lastTs) {
      state.lastTs = now;
    }
  }

  function tickDecay() {
    if (decayPaused) { state.lastTs = Date.now(); return; }
    for (const g of GAUGES) {
      state[g] = clamp(state[g] - DECAY_PER_TICK);
    }
    state.lastTs = Date.now();
    saveState();
    render();
  }
  setInterval(tickDecay, TICK_MS);

  // ----- Actions ----------------------------------------------------------
  actionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'play_menu') { openPlayMenu(); return; }
      if (action === 'minigame')  { openMinigame(); return; } // 하위 호환
      onAction(btn);
    });
  });

  function onAction(btn) {
    const action = btn.dataset.action;
    const eff = ACTION_EFFECT[action];
    if (!eff) return;
    // 진행 중이면 다른 액션 차단
    if (state.busy && Date.now() < state.busy.endsAt) return;

    // 거부 검사
    const crit = criticalLowGauge();
    if (crit && ACTION_GAUGE[action] !== crit) {
      const mood = GAUGE_MOODS[crit];
      btn.classList.remove('shake'); void btn.offsetWidth; btn.classList.add('shake');
      flashBubble(mood.rebellion);
      tempFaceState = mood.sprite;
      tempFaceUntil = Date.now() + 1200;
      try { SOUNDS.pop(); } catch {}
      render();
      return;
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

  function startBusyAction(action) {
    const dur = ACTION_DURATION[action] || 0;
    // wash는 무제한 — endsAt null
    if (action === 'wash') {
      state.busy = { action: 'wash', startedAt: Date.now(), endsAt: null };
      tempFaceState = ACTION_FACE.wash?.state;
      tempFaceUntil = Date.now() + 60000; // 길게 잡고, finishBusy에서 reset
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
    applyActionEffect(action);
    tempFaceState = 'happy';
    tempFaceUntil = Date.now() + 700;
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
    const stageEl = document.querySelector('.stage');
    if (!stageEl) return null;
    let el = stageEl.querySelector('.action-prop');
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
      stageEl.appendChild(el);
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
        if (endsAt) {
          // 시간 진행 ring
          const el = ensureBusyGauge();
          if (el) {
            const total = endsAt - startedAt;
            const pct = Math.max(0, Math.min(100, ((now - startedAt) / total) * 100));
            el.querySelector('.bg-fill').style.width = pct + '%';
            const emo = { feed: '🍖', wash: '🫧', sleep: '💤' }[action] || '⏳';
            el.querySelector('.bg-emo').textContent = emo;
          }
        } else {
          // 무제한 — 진행 ring 대신 청결 게이지 자체가 진행 표시 (wash 한정)
          // ring 없이 깔끔히
          removeBusyGauge();
        }
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

    // 게이지 ≤30% 가장 낮은 거에 우선순위 부여
    const lows = GAUGES.filter(g => state[g] <= 30);
    if (lows.length) {
      const lowest = lows.sort((a, b) => state[a] - state[b])[0];
      return GAUGE_MOODS[lowest]?.sprite || 'sad';
    }

    const avg = GAUGES.reduce((s, g) => s + state[g], 0) / GAUGES.length;
    const tod = currentTod();
    if (tod === 'night' && state.energy <= 60) return 'sleeping';
    if (avg >= 75) return 'happy';
    return 'idle';
  }

  function render() {
    const isWashing = state.busy?.action === 'wash';
    // 원형 게이지 갱신: pct, 색, critical pulse, 씻기 중 highlight
    for (const g of GAUGES) {
      const v = state[g];
      const els = gaugeEls[g];
      if (!els) continue;
      els.circle.style.setProperty('--pct', v);
      els.circle.style.setProperty('--col', colorForGauge(g, v));
      els.pct.textContent = v;
      els.circle.classList.toggle('is-critical', v <= 20);
      // 씻기 진행 중엔 clean 게이지만 highlight (다른건 dim)
      els.root.classList.toggle('is-washing', isWashing && g === 'clean');
      els.root.classList.toggle('is-dim', isWashing && g !== 'clean');
    }
    // 욕조 prop 안 청결 % 표시 갱신
    const tubPct = document.querySelector('.prop-bathtub .bath-pct');
    if (tubPct) tubPct.textContent = state.clean + '%';
    const tubLbl = document.querySelector('.prop-bathtub .bath-label');
    if (tubLbl) tubLbl.textContent = state.clean >= 100 ? '깨끗해졌어요! ✨' : '🛁 씻는 중!';

    const s = pickPuppyState();
    const stage = state.stage || 'puppy';
    const src = `assets/${stage}/${s}.png`;
    if (!puppyEl.src.endsWith(src)) puppyEl.src = src;

    puppyWrap.classList.remove('is-happy','is-eating','is-sad','is-sleeping');
    if (s !== 'idle') puppyWrap.classList.add('is-' + s);

    // mood 데이터 — puppy-wrap에 data-mood 부여, stage에 mood-overlay 추가
    const crit = criticalLowGauge();
    if (crit) {
      puppyWrap.dataset.mood = crit;
    } else {
      delete puppyWrap.dataset.mood;
    }
    // 청결 레벨 4단계 — 점진적 더러움 (clean이 critical이 아니어도 50/30 단계 표현)
    const cleanLevel = state.clean >= 70 ? 'clean'
      : state.clean >= 50 ? 'mild'
      : state.clean >= 30 ? 'dirty'
      : 'filthy';
    puppyWrap.dataset.cleanLevel = cleanLevel;

    // overlay element 관리 — clean 레벨도 반영
    const stageEl = document.querySelector('.stage');
    let ov = stageEl.querySelector('.mood-overlay');
    let needOverlay = !!crit || cleanLevel === 'dirty' || cleanLevel === 'filthy';
    if (needOverlay) {
      if (!ov) { ov = document.createElement('div'); ov.className = 'mood-overlay'; stageEl.appendChild(ov); }
      const cls = ['mood-overlay'];
      if (crit === 'hunger') cls.push('hunger');
      else if (crit === 'happy') cls.push('happy');
      else if (crit === 'energy') cls.push('sleepy');
      // 청결 별도 레벨
      if (cleanLevel === 'filthy') cls.push('filthy');
      else if (cleanLevel === 'dirty') cls.push('dirty');
      ov.className = cls.join(' ');
    } else if (ov) { ov.remove(); }

    // 액션 dim — 거부 상태일 때
    actionBtns.forEach(btn => {
      const a = btn.dataset.action;
      if (!a) return;
      const blocked = !!crit && a !== 'minigame' && ACTION_GAUGE[a] !== crit;
      btn.classList.toggle('is-blocked', blocked);
    });

    if (root) {
      root.dataset.stage = stage;
      root.dataset.breed = state.breed || 'shiba';
    }
    if (stageBadge) {
      const meta = STAGES.find(x => x.id === stage) || STAGES[0];
      stageBadge.textContent = meta.label;
    }
    if (careBadge) careBadge.textContent = '🌟 ' + (state.points || 0);
    if (titleEl) {
      const n = state.name;
      titleEl.textContent = n ? `🐶 ${n}` : '🐶 우리 강아지';
    }

    renderAccessories();
    renderActionCooldowns();
    renderMissionDot();
    applyTod();
  }

  function renderAccessories() {
    const slots = [
      { slot: 'hat',     el: accHatEl },
      { slot: 'neck',    el: accNeckEl },
      { slot: 'glasses', el: accGlassesEl },
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

  // ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activeModal && !activeModal.mandatory) closeModal();
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
    input.maxLength = 12;
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
      const v = (input.value || '').trim().slice(0, 12);
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
    const picked = pool.slice(0, 3).map(t => ({ ...t, progress: 0, claimed: false }));
    state.missions = { date: today, list: picked };
    saveState();
  }

  function progressMission(action, n) {
    if (!state.missions || !state.missions.list) return;
    let any = false;
    for (const m of state.missions.list) {
      if (m.action === action && m.progress < m.count) {
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
      item.className = 'mission-item' + (done ? ' done' : '');
      item.innerHTML = `
        <span class="emo">${m.emoji}</span>
        <div class="body">
          <div class="name">${m.name}</div>
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
  function openShopModal() {
    const body = document.createElement('div');
    const head = document.createElement('div');
    head.className = 'shop-care';
    head.innerHTML = `보유: <span class="pts">🌟 ${state.points || 0}점</span>`;
    body.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'shop-grid';
    ACCESSORIES.forEach(acc => {
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

  let __roomPickedKind = null; // 모달 안에서 배치 모드 — 선택된 아이템 종류

  function openRoomModal() {
    const body = document.createElement('div');

    // 방 영역
    const room = document.createElement('div');
    room.className = 'room-area';
    body.appendChild(room);
    // 강아지 (방 한가운데)
    const dog = document.createElement('img');
    dog.className = 'room-dog';
    dog.src = `assets/${state.stage || 'puppy'}/idle.png`;
    room.appendChild(dog);
    // 배치된 아이템 그리기
    function renderRoom() {
      // 강아지 외 모든 아이템 element 제거 후 재생성
      room.querySelectorAll('.room-item').forEach(n => n.remove());
      (state.roomLayout || []).forEach((it, idx) => {
        const def = ROOM_ITEMS[it.kind];
        if (!def) return;
        const el = document.createElement('div');
        el.className = 'room-item';
        el.textContent = def.emoji;
        el.style.left = it.x + '%';
        el.style.top  = it.y + '%';
        el.dataset.idx = idx;
        // 탭 시 회수
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          if (__roomPickedKind) return; // 배치 모드 중엔 무시
          state.roomInv[it.kind] = (state.roomInv[it.kind] || 0) + 1;
          state.roomLayout.splice(idx, 1);
          saveState();
          renderInventory();
          renderRoom();
        });
        room.appendChild(el);
      });
    }
    // 방 영역 클릭 → 배치 모드라면 거기 놓기
    room.addEventListener('click', (e) => {
      if (!__roomPickedKind) return;
      const inv = state.roomInv[__roomPickedKind] || 0;
      if (inv <= 0) { __roomPickedKind = null; renderInventory(); return; }
      const r = room.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 100;
      const y = ((e.clientY - r.top)  / r.height) * 100;
      state.roomLayout.push({ kind: __roomPickedKind, x: Math.max(2, Math.min(98, x)), y: Math.max(2, Math.min(96, y)) });
      state.roomInv[__roomPickedKind] -= 1;
      // 더 이상 없으면 배치 모드 해제
      if (state.roomInv[__roomPickedKind] <= 0) __roomPickedKind = null;
      saveState();
      renderRoom();
      renderInventory();
    });

    // 인벤토리
    const inv = document.createElement('div');
    inv.className = 'room-inv';
    body.appendChild(inv);

    function renderInventory() {
      inv.innerHTML = '';
      const heading = document.createElement('div');
      heading.className = 'room-inv-heading';
      heading.textContent = __roomPickedKind
        ? `📍 ${ROOM_ITEMS[__roomPickedKind].name} 배치할 자리 탭하세요 (취소: 다른 카드 탭)`
        : '🎒 모은 아이템 — 카드 탭하면 배치 모드';
      inv.appendChild(heading);
      const grid = document.createElement('div');
      grid.className = 'room-inv-grid';
      inv.appendChild(grid);
      const entries = Object.entries(state.roomInv || {}).filter(([_, c]) => c > 0);
      if (!entries.length) {
        const empty = document.createElement('div');
        empty.className = 'room-inv-empty';
        empty.textContent = '아직 모은 아이템이 없어요. 산책 가서 모아 봐요! 🚶';
        grid.appendChild(empty);
        return;
      }
      entries.forEach(([kind, count]) => {
        const def = ROOM_ITEMS[kind];
        if (!def) return;
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'room-inv-card' + (__roomPickedKind === kind ? ' picked' : '');
        card.innerHTML = `<span class="emo">${def.emoji}</span><span class="name">${def.name}</span><span class="count">×${count}</span>`;
        card.addEventListener('click', (e) => {
          e.stopPropagation();
          __roomPickedKind = (__roomPickedKind === kind ? null : kind);
          renderInventory();
        });
        grid.appendChild(card);
      });
    }

    renderRoom();
    renderInventory();

    openModal({
      title: '🏠 강아지 방',
      body,
      onClose: () => { __roomPickedKind = null; },
    });
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
  }

  function minigameCooldownRemain() { return playCooldownRemain('ball'); }

  // 4가지 놀이 카탈로그
  const PLAY_GAMES = [
    { id: 'ball',  name: '공놀이',  emoji: '🎾', desc: '톡톡 튕기기', open: () => openMinigame() },
    { id: 'pet',   name: '쓰다듬기', emoji: '✋', desc: '15번 만져요', open: () => openPetGame() },
    { id: 'dance', name: '춤추기',  emoji: '🎵', desc: '박자 맞추기', open: () => openDanceGame() },
    { id: 'treat', name: '간식 받기', emoji: '🦴', desc: '5개 받기',    open: () => openTreatGame() },
    { id: 'walk',  name: '산책',    emoji: '🚶', desc: '아이템 찾기',  open: () => openWalkGame() },
  ];

  function openPlayMenu() {
    const body = document.createElement('div');
    const grid = document.createElement('div');
    grid.className = 'play-grid';
    PLAY_GAMES.forEach(g => {
      const cd = playCooldownRemain(g.id);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'play-card' + (cd > 0 ? ' is-cooling' : '');
      let cdText = '';
      if (cd > 0) {
        const sec = Math.ceil(cd / 1000);
        const mm = Math.floor(sec / 60), ss = sec % 60;
        cdText = `<div class="cd">${mm}:${String(ss).padStart(2,'0')}</div>`;
      }
      card.innerHTML = `
        <div class="emo">${g.emoji}</div>
        <div class="name">${g.name}</div>
        <div class="desc">${g.desc}</div>
        ${cdText}
      `;
      card.addEventListener('click', () => {
        if (playCooldownRemain(g.id) > 0) { SOUNDS.pop(); return; }
        SOUNDS.pop();
        closeModal();
        setTimeout(() => g.open(), 80);
      });
      grid.appendChild(card);
    });
    body.appendChild(grid);
    const hint = document.createElement('p');
    hint.className = 'modal-hint';
    hint.textContent = '한 번 놀고 나면 5분 후에 다시 놀 수 있어요';
    hint.style.marginTop = '12px';
    body.appendChild(hint);
    openModal({ title: '🎉 놀이 골라요', body });
  }

  // ----- 쓰다듬기: 30초 안에 강아지 15번 탭 ----------------------------
  function openPetGame() {
    decayPaused = true;
    const body = document.createElement('div');
    const guide = document.createElement('div');
    guide.className = 'mg-guide';
    guide.innerHTML = '✋ 강아지를 <b>15번 쓰다듬어요!</b>';
    body.appendChild(guide);
    const stats = document.createElement('div');
    stats.className = 'minigame-stats';
    const timeEl = document.createElement('span');
    const cntEl = document.createElement('span');
    timeEl.textContent = '⏱ 30';
    cntEl.textContent = '❤️ 0/15';
    stats.appendChild(timeEl);
    stats.appendChild(cntEl);
    body.appendChild(stats);

    const tBar = document.createElement('div'); tBar.className = 'mg-timebar';
    const tFill = document.createElement('div'); tFill.className = 'mg-timebar-fill';
    tBar.appendChild(tFill); body.appendChild(tBar);

    const arena = document.createElement('div');
    arena.className = 'minigame-arena big pet-arena';
    arena.dataset.breed = state.breed || 'shiba';
    const dog = document.createElement('img');
    dog.className = 'mg-dog pet-dog';
    dog.src = `assets/${state.stage || 'puppy'}/happy.png`;
    arena.appendChild(dog);
    body.appendChild(arena);

    const endBtn = document.createElement('button');
    endBtn.className = 'modal-btn secondary'; endBtn.type = 'button'; endBtn.textContent = '끝내기';
    endBtn.style.marginTop = '6px';
    body.appendChild(endBtn);

    let count = 0;
    let endedFlag = false;
    const TOTAL = 30000;
    const started = performance.now();
    let lastFrame = started;

    function onPet(e) {
      if (e) { e.stopPropagation(); if (e.preventDefault) e.preventDefault(); }
      if (endedFlag) return;
      count += 1;
      cntEl.textContent = '❤️ ' + count + '/15';
      // 하트 떠오름
      const h = document.createElement('div');
      h.className = 'pet-heart';
      h.textContent = '❤️';
      const r = arena.getBoundingClientRect();
      h.style.left = (r.width / 2 + (Math.random()-0.5) * 80) + 'px';
      h.style.top = (r.height * 0.4) + 'px';
      arena.appendChild(h);
      setTimeout(() => h.remove(), 700);
      dog.classList.remove('wiggle'); void dog.offsetWidth; dog.classList.add('wiggle');
      try { SOUNDS.happy(); } catch {}
      if (count >= 15) endGame();
    }
    dog.addEventListener('click', onPet);
    dog.addEventListener('touchstart', onPet, { passive: false });
    arena.addEventListener('click', onPet);

    function step(now) {
      if (endedFlag) return;
      lastFrame = now;
      const elapsed = now - started;
      const remain = Math.max(0, TOTAL - elapsed);
      timeEl.textContent = '⏱ ' + Math.ceil(remain / 1000);
      tFill.style.width = (remain / TOTAL * 100) + '%';
      if (remain < 10000) tFill.classList.add('low'); else tFill.classList.remove('low');
      if (remain <= 0) { endGame(); return; }
      requestAnimationFrame(step);
    }

    function endGame() {
      if (endedFlag) return;
      endedFlag = true;
      decayPaused = false;
      const success = count >= 15;
      const happyGain = success ? 25 : 15;
      state.happy = clamp(state.happy + happyGain);
      state.careLastTick = (state.careLastTick || 0) - CARE_TICK_MS;
      addCareScore();
      state.points = (state.points || 0) + Math.min(20, count);
      markPlayDone('pet');
      progressMission('minigame', 1);
      saveState();
      render();
      SOUNDS.fanfare();

      const rb = document.createElement('div');
      const p = document.createElement('p'); p.className = 'modal-sub';
      const nm = state.name || '강아지';
      p.innerHTML = `${count}번 쓰다듬었어요!<br>${nameTopic(nm)} 행복해해요 💖${success ? '<br>🎉 목표 달성!' : ''}`;
      rb.appendChild(p);
      const ok = document.createElement('button');
      ok.className = 'modal-btn'; ok.type = 'button'; ok.textContent = '좋아요';
      ok.addEventListener('click', () => closeModal());
      rb.appendChild(ok);
      openModal({ title: '쓰다듬기 끝!', body: rb });
    }

    endBtn.addEventListener('click', () => endGame());
    openModal({
      title: '✋ 쓰다듬기', body,
      onClose: () => { if (!endedFlag) { endedFlag = true; decayPaused = false; markPlayDone('pet'); saveState(); } },
    });
    setTimeout(() => requestAnimationFrame(step), 80);
  }

  // ----- 춤추기: 30초 박자, 박자 시점 탭하면 +5 -----------------------
  function openDanceGame() {
    decayPaused = true;
    const body = document.createElement('div');
    const guide = document.createElement('div');
    guide.className = 'mg-guide';
    guide.innerHTML = '🎵 강아지가 점프할 때 <b>탭!</b>';
    body.appendChild(guide);
    const stats = document.createElement('div');
    stats.className = 'minigame-stats';
    const timeEl = document.createElement('span');
    const scoreEl = document.createElement('span');
    timeEl.textContent = '⏱ 30';
    scoreEl.textContent = '🎯 0';
    stats.appendChild(timeEl);
    stats.appendChild(scoreEl);
    body.appendChild(stats);
    const tBar = document.createElement('div'); tBar.className = 'mg-timebar';
    const tFill = document.createElement('div'); tFill.className = 'mg-timebar-fill';
    tBar.appendChild(tFill); body.appendChild(tBar);
    const arena = document.createElement('div');
    arena.className = 'minigame-arena big dance-arena';
    arena.dataset.breed = state.breed || 'shiba';
    const dog = document.createElement('img');
    dog.className = 'mg-dog dance-dog';
    dog.src = `assets/${state.stage || 'puppy'}/happy.png`;
    arena.appendChild(dog);
    body.appendChild(arena);
    const endBtn = document.createElement('button');
    endBtn.className = 'modal-btn secondary'; endBtn.type = 'button'; endBtn.textContent = '끝내기';
    endBtn.style.marginTop = '6px';
    body.appendChild(endBtn);

    let score = 0;
    let endedFlag = false;
    const TOTAL = 30000;
    const BEAT_MS = 800;
    const started = performance.now();
    let lastBeatStart = started;
    let beatActive = false; // 박자 윈도우 (탭 가능 시점)
    const TAP_WINDOW_MS = 350;

    // 강아지 박자 점프 — CSS animation iteration
    dog.classList.add('beat');

    function onTap(e) {
      if (e) { e.stopPropagation(); if (e.preventDefault) e.preventDefault(); }
      if (endedFlag) return;
      const now = performance.now();
      const phase = (now - lastBeatStart) % BEAT_MS;
      const inWindow = phase < TAP_WINDOW_MS;
      if (inWindow) {
        score += 5;
        scoreEl.textContent = '🎯 ' + score;
        try { SOUNDS.catch(); } catch {}
        const note = document.createElement('div');
        note.className = 'dance-note';
        note.textContent = ['🎵','🎶','✨'][Math.floor(Math.random()*3)];
        const r = arena.getBoundingClientRect();
        note.style.left = (r.width/2 + (Math.random()-0.5)*120) + 'px';
        note.style.top = (r.height*0.45) + 'px';
        arena.appendChild(note);
        setTimeout(() => note.remove(), 700);
      } else {
        try { SOUNDS.pop(); } catch {}
      }
    }
    arena.addEventListener('click', onTap);
    arena.addEventListener('touchstart', onTap, { passive: false });

    function step(now) {
      if (endedFlag) return;
      const elapsed = now - started;
      const remain = Math.max(0, TOTAL - elapsed);
      timeEl.textContent = '⏱ ' + Math.ceil(remain / 1000);
      tFill.style.width = (remain / TOTAL * 100) + '%';
      if (remain < 10000) tFill.classList.add('low'); else tFill.classList.remove('low');
      if (remain <= 0) { endGame(); return; }
      requestAnimationFrame(step);
    }
    function endGame() {
      if (endedFlag) return;
      endedFlag = true;
      decayPaused = false;
      const happyGain = 25 + Math.min(20, Math.floor(score / 5));
      state.happy = clamp(state.happy + happyGain);
      state.careLastTick = (state.careLastTick || 0) - CARE_TICK_MS;
      addCareScore();
      state.points = (state.points || 0) + score;
      markPlayDone('dance');
      progressMission('minigame', 1);
      saveState(); render(); SOUNDS.fanfare();

      const rb = document.createElement('div');
      const p = document.createElement('p'); p.className = 'modal-sub';
      const nm = state.name || '강아지';
      p.innerHTML = `🎵 <b>${score}점!</b><br>${nameTopic(nm)} 신났어요 💖`;
      rb.appendChild(p);
      const ok = document.createElement('button');
      ok.className = 'modal-btn'; ok.type = 'button'; ok.textContent = '좋아요';
      ok.addEventListener('click', () => closeModal());
      rb.appendChild(ok);
      openModal({ title: '춤추기 끝!', body: rb });
    }
    endBtn.addEventListener('click', () => endGame());
    openModal({
      title: '🎵 춤추기', body,
      onClose: () => { if (!endedFlag) { endedFlag = true; decayPaused = false; markPlayDone('dance'); saveState(); } },
    });
    setTimeout(() => requestAnimationFrame(step), 80);
  }

  // ----- 간식 받기: 위에서 떨어지는 간식을 강아지가 받음 -----------------
  function openTreatGame() {
    decayPaused = true;
    const body = document.createElement('div');
    const guide = document.createElement('div');
    guide.className = 'mg-guide';
    guide.innerHTML = '🦴 화면 아래로 옮겨서 <b>간식 5개</b> 받아요';
    body.appendChild(guide);
    const stats = document.createElement('div');
    stats.className = 'minigame-stats';
    const timeEl = document.createElement('span');
    const gotEl = document.createElement('span');
    timeEl.textContent = '⏱ 30';
    gotEl.textContent = '🦴 0/5';
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
    dog.src = `assets/${state.stage || 'puppy'}/happy.png`;
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
    let nextSpawn = 600 + Math.random() * 400;
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
        nextSpawn = 700 + Math.random() * 600;
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
          gotEl.textContent = '🦴 ' + got + '/5';
          state.hunger = clamp(state.hunger + 2);
          try { SOUNDS.eat(); } catch {}
          flashBubble('😋');
          t.el.remove();
          treats.splice(i, 1);
          if (got >= 5) { endGame(); return; }
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
      const success = got >= 5;
      state.happy = clamp(state.happy + (success ? 30 : 18));
      state.hunger = clamp(state.hunger + 10);
      state.careLastTick = (state.careLastTick || 0) - CARE_TICK_MS;
      addCareScore();
      state.points = (state.points || 0) + got * 4;
      markPlayDone('treat');
      progressMission('minigame', 1);
      saveState(); render(); SOUNDS.fanfare();
      const rb = document.createElement('div');
      const p = document.createElement('p'); p.className = 'modal-sub';
      const nm = state.name || '강아지';
      p.innerHTML = `${got}개 받았어요!<br>${nameTopic(nm)} 배도 부르고 행복해요 💖${success ? '<br>🎉 목표 달성!' : ''}`;
      rb.appendChild(p);
      const ok = document.createElement('button');
      ok.className = 'modal-btn'; ok.type = 'button'; ok.textContent = '좋아요';
      ok.addEventListener('click', () => closeModal());
      rb.appendChild(ok);
      openModal({ title: '간식 받기 끝!', body: rb });
    }
    endBtn.addEventListener('click', () => endGame());
    openModal({
      title: '🦴 간식 받기', body,
      onClose: () => { if (!endedFlag) { endedFlag = true; decayPaused = false; markPlayDone('treat'); saveState(); } },
    });
    setTimeout(() => { lastFrame = performance.now(); step._lastT = lastFrame; requestAnimationFrame(step); }, 80);
  }

  // ----- 산책: 30초 동안 야외 배경 + 아이템 등장 + 수집 -----------------
  function openWalkGame() {
    // 거부: 에너지/배고픔 너무 낮으면 거부
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
    const body = document.createElement('div');
    const guide = document.createElement('div');
    guide.className = 'mg-guide';
    guide.innerHTML = '🐾 아이템을 <b>탭!</b> 해서 모아요';
    body.appendChild(guide);
    const stats = document.createElement('div');
    stats.className = 'minigame-stats';
    const timeEl = document.createElement('span');
    const scoreEl = document.createElement('span');
    timeEl.textContent = '⏱ 30';
    scoreEl.textContent = '🎯 0';
    stats.appendChild(timeEl);
    stats.appendChild(scoreEl);
    body.appendChild(stats);
    const tBar = document.createElement('div'); tBar.className = 'mg-timebar';
    const tFill = document.createElement('div'); tFill.className = 'mg-timebar-fill';
    tBar.appendChild(tFill); body.appendChild(tBar);

    const arena = document.createElement('div');
    arena.className = 'minigame-arena big walk-arena';
    arena.dataset.breed = state.breed || 'shiba';
    // 야외 배경 요소
    arena.innerHTML = `
      <div class="walk-sky"></div>
      <div class="walk-grass"></div>
      <div class="walk-path"></div>
    `;
    const dog = document.createElement('img');
    dog.className = 'mg-dog walk-dog';
    dog.src = `assets/${state.stage || 'puppy'}/idle.png`;
    arena.appendChild(dog);
    body.appendChild(arena);

    const endBtn = document.createElement('button');
    endBtn.className = 'modal-btn secondary'; endBtn.type = 'button'; endBtn.textContent = '끝내기';
    endBtn.style.marginTop = '6px';
    body.appendChild(endBtn);

    // 아이템 카탈로그
    const ITEM_DEFS = [
      { kind: 'bone',    emoji: '🦴', score: 5, weight: 30, rare: false },
      { kind: 'flower',  emoji: '🌸', score: 3, weight: 22, rare: false },
      { kind: 'butter',  emoji: '🦋', score: 5, weight: 14, rare: false, moves: true },
      { kind: 'bird',    emoji: '🐦', score: 5, weight: 10, rare: false, moves: true },
      { kind: 'balloon', emoji: '🎈', score: 10, weight: 5, rare: true },
      { kind: 'star',    emoji: '⭐', score: 20, weight: 3, rare: true, careBonus: 1 },
      { kind: 'gem',     emoji: '💎', score: 30, weight: 1, rare: true, careBonus: 5 },
      { kind: 'gift',    emoji: '🎁', score: 15, weight: 1, rare: true, gift: true },
    ];
    const totalWeight = ITEM_DEFS.reduce((s, d) => s + d.weight, 0);
    function pickItemDef() {
      let r = Math.random() * totalWeight;
      for (const d of ITEM_DEFS) { r -= d.weight; if (r <= 0) return d; }
      return ITEM_DEFS[0];
    }

    const items = []; // {el, def, x, y, vx, born, life}
    const collected = {}; // kind -> count
    let score = 0;
    let endedFlag = false;
    let dogX = null;
    let dogTarget = null;
    let lastFrame = performance.now();
    let started = lastFrame;
    let spawnAccum = 0;
    let nextSpawn = 700 + Math.random() * 500;
    const TOTAL_MS = 30000;
    let lastFootprintTs = 0;

    function arenaRect() { return arena.getBoundingClientRect(); }

    function spawnItem() {
      const def = pickItemDef();
      const r = arenaRect();
      const margin = 30;
      const y = 30 + Math.random() * (r.height - 130);
      const fromLeft = Math.random() < 0.5;
      const x = def.moves ? (fromLeft ? -20 : r.width + 20) : margin + Math.random() * (r.width - margin * 2);
      const el = document.createElement('div');
      el.className = 'walk-item' + (def.rare ? ' rare' : '');
      el.textContent = def.emoji;
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      arena.appendChild(el);
      const data = {
        el, def, x, y,
        vx: def.moves ? (fromLeft ? 70 + Math.random() * 50 : -(70 + Math.random() * 50)) : 0,
        born: performance.now(),
        life: def.moves ? 8000 : 4500 + Math.random() * 1500,
        captured: false,
      };
      items.push(data);
      const onTap = (e) => {
        e.stopPropagation();
        if (data.captured || endedFlag) return;
        // 강아지가 그쪽으로 가도록 target 지정
        dogTarget = data;
      };
      el.addEventListener('click', onTap);
      el.addEventListener('touchstart', (e) => { e.preventDefault(); onTap(e); }, { passive: false });
    }

    function captureItem(it) {
      if (it.captured) return;
      it.captured = true;
      const def = it.def;
      collected[def.kind] = (collected[def.kind] || 0) + 1;
      // 방 인벤토리 누적 — 영구 저장
      if (!state.roomInv) state.roomInv = {};
      state.roomInv[def.kind] = (state.roomInv[def.kind] || 0) + 1;
      score += def.score;
      scoreEl.textContent = '🎯 ' + score;
      it.el.classList.add('walk-item-pop');
      setTimeout(() => { try { it.el.remove(); } catch {}; }, 240);
      try { SOUNDS.catch(); } catch {}
      flashBubble('💖');
      // 희귀 아이템 — 큰 축하
      if (def.rare) {
        const cel = document.createElement('div');
        cel.className = 'walk-celebrate';
        cel.textContent = `와! ${def.emoji} 발견!`;
        arena.appendChild(cel);
        setTimeout(() => cel.remove(), 1300);
      }
      // 선물 — 미보유 액세서리 자동 추가
      if (def.gift) {
        const owned = state.inventory || {};
        const candidates = ACCESSORIES.filter(a => !owned[a.id]);
        if (candidates.length) {
          const pick = candidates[Math.floor(Math.random() * candidates.length)];
          state.inventory[pick.id] = true;
          const giftMsg = document.createElement('div');
          giftMsg.className = 'walk-celebrate';
          giftMsg.textContent = `🎁 ${pick.name} 받았어요!`;
          arena.appendChild(giftMsg);
          setTimeout(() => giftMsg.remove(), 1500);
        }
      }
    }

    function spawnFootprint(x, y) {
      const fp = document.createElement('div');
      fp.className = 'walk-footprint';
      fp.textContent = '🐾';
      fp.style.left = (x - 8) + 'px';
      fp.style.top = (y + 30) + 'px';
      arena.appendChild(fp);
      setTimeout(() => fp.remove(), 1400);
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
      // spawn
      spawnAccum += (now - (step._lastT || now));
      step._lastT = now;
      if (spawnAccum >= nextSpawn && items.filter(i => !i.captured).length < 5) {
        spawnAccum = 0;
        nextSpawn = 700 + Math.random() * 600;
        spawnItem();
      }
      // 아이템 업데이트
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        if (it.captured) continue;
        const age = now - it.born;
        if (it.def.moves) {
          it.x += it.vx * dt;
          it.el.style.left = it.x + 'px';
          if (it.x < -40 || it.x > r.width + 40) {
            try { it.el.remove(); } catch {}
            items.splice(i, 1);
            if (it === dogTarget) dogTarget = null;
            continue;
          }
        }
        if (age > it.life) {
          it.el.classList.add('walk-item-fade');
          setTimeout(() => { try { it.el.remove(); } catch {}; }, 300);
          if (it === dogTarget) dogTarget = null;
          items.splice(i, 1);
        }
      }
      // 강아지 이동
      if (dogX === null) dogX = r.width / 2;
      let targetX = r.width / 2;
      if (dogTarget && !dogTarget.captured) targetX = dogTarget.x;
      const dx = targetX - dogX;
      const move = Math.sign(dx) * Math.min(Math.abs(dx), 260 * dt);
      dogX += move;
      dog.style.left = dogX + 'px';
      dog.style.transform = 'translateX(-50%)';
      // 발자국 200ms마다
      if (Math.abs(move) > 0.5 && now - lastFootprintTs > 220) {
        spawnFootprint(dogX, r.height - 70);
        lastFootprintTs = now;
      }
      // 도착 시 capture
      if (dogTarget && !dogTarget.captured && Math.abs(dogTarget.x - dogX) < 40) {
        captureItem(dogTarget);
        dogTarget = null;
      }
      if (remain <= 0) { endGame(); return; }
      requestAnimationFrame(step);
    }

    function endGame() {
      if (endedFlag) return;
      endedFlag = true;
      decayPaused = false;
      // 정리
      for (const it of items) { try { it.el.remove(); } catch {} }
      items.length = 0;
      // 보상 — 트레이드오프
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
      // 케어 보너스 — 잡은 별/보석 만큼
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

      // 결과 모달
      const rb = document.createElement('div');
      const p = document.createElement('p');
      p.className = 'modal-sub';
      const lines = ['🐾 산책 완료!', '잡은 것:'];
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
      openModal({ title: '🚶 산책 끝!', body: rb });
    }

    endBtn.addEventListener('click', () => endGame());
    openModal({
      title: '🚶 산책', body,
      onClose: () => { if (!endedFlag) { endedFlag = true; decayPaused = false; markPlayDone('walk'); saveState(); } },
    });
    setTimeout(() => { lastFrame = performance.now(); step._lastT = lastFrame; requestAnimationFrame(step); }, 80);
  }

  function openMinigame() {
    // 에너지 너무 낮으면 거부
    if (state.energy <= 20) {
      const body = document.createElement('div');
      const p = document.createElement('p');
      p.className = 'modal-sub';
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

    // 안내 박스
    const guide = document.createElement('div');
    guide.className = 'mg-guide';
    guide.innerHTML = '🎾 공이 떨어지지 않게 <b>톡톡!</b> 눌러요';
    body.appendChild(guide);

    // 통계 (시간/콤보/점수) + 타이머 막대
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

    const tBar = document.createElement('div');
    tBar.className = 'mg-timebar';
    const tFill = document.createElement('div');
    tFill.className = 'mg-timebar-fill';
    tBar.appendChild(tFill);
    body.appendChild(tBar);

    const arena = document.createElement('div');
    arena.className = 'minigame-arena big';
    arena.dataset.breed = state.breed || 'shiba';
    const dog = document.createElement('img');
    dog.className = 'mg-dog';
    dog.src = `assets/${state.stage || 'puppy'}/happy.png`;
    arena.appendChild(dog);

    const ball = document.createElement('div');
    ball.className = 'mg-ball';
    ball.textContent = '🎾';
    arena.appendChild(ball);

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

    // 게임 상태
    let score = 0;
    let combo = 0;
    let lastTapMs = 0;
    const COMBO_WINDOW_MS = 1000;
    const TOTAL_MS = 30000;
    let endedFlag = false;

    // 공 물리: arena 내 좌표(x: center, y: center). px / sec 단위 속도.
    let bx = 0, by = 0, vx = 0, vy = 0;
    const GRAVITY = 1100;       // px/s^2
    const TAP_VY = -680;        // 위로 튀어오를 때 vy
    const TAP_VX_RANGE = 220;   // 좌우 랜덤 ±
    const BALL_RADIUS = 26;
    let lastFrame = performance.now();
    let started = lastFrame;
    let dogX = null;
    let scaredUntil = 0; // 공 떨어진 직후 강아지 "어어!" 표정

    function arenaRect() { return arena.getBoundingClientRect(); }

    function placeBall() {
      ball.style.left = bx + 'px';
      ball.style.top  = by + 'px';
    }

    function spawnBall() {
      const r = arenaRect();
      bx = r.width / 2;
      by = r.height * 0.4;
      vx = 0;
      vy = TAP_VY * 0.6; // 부드럽게 살짝 띄움
      ball.classList.remove('mg-ball-popped', 'mg-ball-fade');
      ball.style.opacity = '1';
      placeBall();
    }

    function showCombo(text, big) {
      comboPop.textContent = text;
      comboPop.classList.remove('show', 'big');
      void comboPop.offsetWidth;
      comboPop.classList.add('show');
      if (big) comboPop.classList.add('big');
    }

    function onTap(e) {
      if (e) { e.stopPropagation(); if (e.preventDefault) e.preventDefault(); }
      if (endedFlag) return;
      // 콤보 갱신
      const now = performance.now();
      if (now - lastTapMs <= COMBO_WINDOW_MS) combo += 1;
      else combo = 1;
      lastTapMs = now;
      const mul = combo >= 5 ? 5 : combo >= 3 ? 3 : combo >= 2 ? 2 : 1;
      score += mul;
      scoreEl.textContent = '🎯 ' + score;
      comboEl.textContent = combo >= 2 ? `🔥 ${combo}` : '';
      if (combo >= 2) showCombo(`콤보 ×${mul}!`, mul >= 3);
      // 공 위로 튕김
      vy = TAP_VY - Math.random() * 80;
      vx = (Math.random() - 0.5) * TAP_VX_RANGE;
      ball.classList.remove('mg-ball-thrown');
      void ball.offsetWidth;
      ball.classList.add('mg-ball-thrown');
      // 사운드
      SOUNDS.bounce();
      // 작은 sparkle
      const sp = document.createElement('div');
      sp.className = 'mg-sparkle';
      sp.textContent = '✨';
      sp.style.left = bx + 'px';
      sp.style.top = by + 'px';
      arena.appendChild(sp);
      setTimeout(() => sp.remove(), 400);
    }

    ball.addEventListener('click', onTap);
    ball.addEventListener('touchstart', onTap, { passive: false });

    function step(now) {
      if (endedFlag) return;
      const dt = Math.min(40, now - lastFrame) / 1000;
      lastFrame = now;
      const elapsed = now - started;
      const remain = Math.max(0, TOTAL_MS - elapsed);

      timeEl.textContent = '⏱ ' + Math.ceil(remain / 1000);
      tFill.style.width = (remain / TOTAL_MS * 100) + '%';
      if (remain < 10000) tFill.classList.add('low');
      else tFill.classList.remove('low');

      // 콤보 만료
      if (combo > 0 && now - lastTapMs > COMBO_WINDOW_MS) {
        combo = 0;
        comboEl.textContent = '';
      }

      // 공 물리
      const r = arenaRect();
      vy += GRAVITY * dt;
      bx += vx * dt;
      by += vy * dt;
      // 좌우 벽
      if (bx < BALL_RADIUS) { bx = BALL_RADIUS; vx = Math.abs(vx) * 0.6; }
      if (bx > r.width - BALL_RADIUS) { bx = r.width - BALL_RADIUS; vx = -Math.abs(vx) * 0.6; }
      // 위쪽 천장
      if (by < BALL_RADIUS) { by = BALL_RADIUS; vy = Math.abs(vy) * 0.4; }
      placeBall();

      // 강아지 시선 따라가기 — dog x를 ball x 쪽으로 부드럽게
      if (dogX === null) dogX = r.width / 2;
      const targetDX = bx;
      const dxd = targetDX - dogX;
      dogX += Math.sign(dxd) * Math.min(Math.abs(dxd), 240 * dt);
      dog.style.left = dogX + 'px';
      dog.style.transform = 'translateX(-50%)';
      // 공이 강아지 머리 위 zone에 있으면 happy, 떨어지는 중이면 평소
      if (now < scaredUntil) {
        dog.src = `assets/${state.stage || 'puppy'}/sad.png`;
      } else {
        dog.src = `assets/${state.stage || 'puppy'}/happy.png`;
      }

      // 바닥 충돌
      const floor = r.height - BALL_RADIUS - 10;
      if (by >= floor) {
        // 공 떨어짐 — round 종료, 새 공 등장
        scaredUntil = now + 700;
        ball.classList.add('mg-ball-popped');
        SOUNDS.pop();
        flashBubble('😯');
        setTimeout(() => {
          if (endedFlag) return;
          spawnBall();
        }, 600);
        // 잠시 ball을 멈춰둠
        vx = 0; vy = 0;
        by = floor;
        placeBall();
      }

      if (remain <= 0) { endGame(); return; }
      requestAnimationFrame(step);
    }

    function endGame() {
      if (endedFlag) return;
      endedFlag = true;
      decayPaused = false;
      // 보상
      let happyGain, careBoost, msg;
      if (score >= 25) { happyGain = 50; careBoost = 3; msg = '최고! 🎉'; }
      else if (score >= 10) { happyGain = 30; careBoost = 2; msg = '잘했어요! 💖'; }
      else { happyGain = 20; careBoost = 1; msg = '재밌었지? 🐾'; }
      state.happy = clamp(state.happy + happyGain);
      for (let i = 0; i < careBoost; i++) {
        state.careLastTick = (state.careLastTick || 0) - CARE_TICK_MS;
        addCareScore();
      }
      state.points = (state.points || 0) + score;
      markPlayDone('ball');
      progressMission('minigame', 1);
      saveState();
      render();
      SOUNDS.fanfare();

      const resultBody = document.createElement('div');
      const p = document.createElement('p');
      p.className = 'modal-sub';
      const nm = state.name || '강아지';
      p.innerHTML = `🎉 <b>${score}점!</b><br>${nameTopic(nm)} 행복해해요 💖<br><span style="color:#c47b00">${msg}</span>`;
      resultBody.appendChild(p);
      const ok = document.createElement('button');
      ok.className = 'modal-btn';
      ok.type = 'button';
      ok.textContent = '좋아요';
      ok.addEventListener('click', () => closeModal());
      resultBody.appendChild(ok);
      openModal({ title: '공놀이 끝!', body: resultBody });
    }

    endBtn.addEventListener('click', () => endGame());

    openModal({
      title: '🎾 공놀이',
      body,
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
  function performReset() {
    try { location.replace(location.pathname + '?nuke=1&t=' + Date.now()); }
    catch { hardReset(); }
  }

  // ----- 헤더 버튼 핸들러 -------------------------------------------------
  settingsBtn.addEventListener('click', () => { SOUNDS.pop(); openSettingsModal(); });
  shopBtn.addEventListener('click', () => { SOUNDS.pop(); openShopModal(); });
  missionBtn.addEventListener('click', () => { SOUNDS.pop(); openMissionsModal(); });
  roomBtn?.addEventListener('click', () => { SOUNDS.pop(); openRoomModal(); });

  // ----- visibility / lifecycle -------------------------------------------
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveState();
    else { applyTod(); ensureTodayMissions(); render(); }
  });
  window.addEventListener('beforeunload', saveState);

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

  function clamp(v) { return Math.max(0, Math.min(MAX, Math.round(v))); }

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
  };
})();
