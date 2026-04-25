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

  const ACTION_EFFECT = {
    feed:  { hunger: +35, happy:  +5, clean:  -5, energy:  +0 },
    play:  { hunger:  -5, happy: +35, clean:  -5, energy: -10 },
    wash:  { hunger:   0, happy:  -3, clean: +40, energy:  -3 },
    sleep: { hunger:  -5, happy:  +0, clean:   0, energy: +50 },
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
      // 마이그레이션 — 임계값이 점진적으로 올라옴: 30/100 → 60/300 → 180/900.
      // 기존 단계를 유지하기 위한 보정:
      //   어른이었던 사람(care >= 300, 또는 옛 100~299): care = 900 으로 어른 유지
      //   청소년이었던 사람(care 60~299, 또는 옛 30~99): care = 180 으로 청소년 유지
      //   아기는 그대로
      if (s.care >= 100) s.care = Math.max(s.care, 900);
      else if (s.care >= 30) s.care = Math.max(s.care, 180);
      if (typeof s.stage !== 'string') s.stage = stageForCare(s.care);
      else s.stage = stageForCare(s.care); // 마이그레이션 후 stage 재계산 보장
      // P2 보강
      if (typeof s.name !== 'string') s.name = '';
      if (typeof s.breed !== 'string') s.breed = '';
      if (typeof s.points !== 'number') s.points = 0;
      if (!s.inventory || typeof s.inventory !== 'object') s.inventory = {};
      if (!s.equipped || typeof s.equipped !== 'object') s.equipped = { hat: null, neck: null, glasses: null };
      if (typeof s.minigameLastTs !== 'number') s.minigameLastTs = 0;
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
      stage: 'puppy',
      name: '',
      breed: '',
      points: 0,
      inventory: {},
      equipped: { hat: null, neck: null, glasses: null },
      minigameLastTs: 0,
      missions: { date: '', list: [] },
    };
  }

  function stageForCare(care) {
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
  // localStorage / sessionStorage / SW caches / SW 등록 모두 정리 후 클린 reload.
  // ?nuke=1 / ?reset=1 / ?clear=1 URL 진입과 in-app "처음부터 다시" 모두 같은 함수 호출.
  async function hardReset() {
    try { localStorage.clear(); } catch {}
    try { sessionStorage.clear(); } catch {}
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
    try { location.replace(location.pathname); } catch { location.reload(); }
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
  const missionDot = $('#missionDot');
  const modalRoot  = $('#modalRoot');
  const accHatEl   = $('#accHat');
  const accNeckEl  = $('#accNeck');
  const accGlassesEl = $('#accGlasses');
  const fills = {
    hunger: $('.fill-hunger'),
    happy:  $('.fill-happy'),
    clean:  $('.fill-clean'),
    energy: $('.fill-energy'),
  };
  const actionBtns = document.querySelectorAll('.action');

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
      if (action === 'minigame') { openMinigame(); return; }
      onAction(btn);
    });
  });

  function onAction(btn) {
    const action = btn.dataset.action;
    const eff = ACTION_EFFECT[action];
    if (!eff) return;

    const tod = currentTod();
    let scaled = { ...eff };
    if (action === 'sleep' && tod === 'night') {
      scaled.energy = Math.min(MAX, eff.energy + 15);
    }

    for (const g of GAUGES) {
      if (typeof scaled[g] === 'number') {
        state[g] = clamp(state[g] + scaled[g]);
      }
    }

    // 진화 점수: 분당 최대 5점 cap (12초 간격). 케어포인트는 매 액션마다 +1.
    addCareScore();
    state.points = (state.points || 0) + 1;
    const newStage = stageForCare(state.care);
    if (newStage !== state.stage) {
      const prev = state.stage;
      state.stage = newStage;
      triggerEvolveFx(prev, newStage);
    }

    btn.classList.remove('cheer');
    void btn.offsetWidth;
    btn.classList.add('cheer');

    bubbleEl.textContent = ACTION_BUBBLE[action] || '✨';
    bubbleEl.classList.add('show');
    clearTimeout(bubbleEl._t);
    bubbleEl._t = setTimeout(() => bubbleEl.classList.remove('show'), 900);

    const face = ACTION_FACE[action];
    if (face) {
      tempFaceState = face.state;
      tempFaceUntil = Date.now() + face.ms;
      if (face.sound && SOUNDS[face.sound]) SOUNDS[face.sound]();
    }

    progressMission(action, 1);

    saveState();
    render();
  }

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
  setInterval(applyTod, 30 * 60 * 1000);

  // ----- Render -----------------------------------------------------------
  function pickPuppyState() {
    const now = Date.now();
    if (tempFaceState && now < tempFaceUntil) return tempFaceState;

    const lows = GAUGES.filter(g => state[g] <= 20).length;
    const avg = GAUGES.reduce((s, g) => s + state[g], 0) / GAUGES.length;
    const tod = currentTod();

    if (lows >= 1) return 'sad';
    if (tod === 'night' && state.energy <= 60) return 'sleeping';
    if (state.energy <= 25) return 'sleeping';
    if (avg >= 75)  return 'happy';
    return 'idle';
  }

  function render() {
    for (const g of GAUGES) {
      const v = state[g];
      const el = fills[g];
      if (!el) continue;
      el.style.width = v + '%';
      el.classList.toggle('is-low', v <= 25);
    }

    const s = pickPuppyState();
    const stage = state.stage || 'puppy';
    const src = `assets/${stage}/${s}.png`;
    if (!puppyEl.src.endsWith(src)) puppyEl.src = src;

    puppyWrap.classList.remove('is-happy','is-eating','is-sad','is-sleeping');
    if (s !== 'idle') puppyWrap.classList.add('is-' + s);

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

  // ----- P2.2: 미니게임 (공놀이) -----------------------------------------
  function minigameCooldownRemain() {
    const last = state.minigameLastTs || 0;
    const elapsed = Date.now() - last;
    return Math.max(0, MINIGAME_COOLDOWN_MS - elapsed);
  }

  function openMinigame() {
    if (minigameCooldownRemain() > 0) {
      // 토스트 대신 모달
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
    const stats = document.createElement('div');
    stats.className = 'minigame-stats';
    const timeEl = document.createElement('span');
    const scoreEl = document.createElement('span');
    timeEl.textContent = '⏱ 30';
    scoreEl.textContent = '🎯 0';
    stats.appendChild(timeEl);
    stats.appendChild(scoreEl);
    body.appendChild(stats);

    const arena = document.createElement('div');
    arena.className = 'minigame-arena';
    const dog = document.createElement('img');
    dog.className = 'mg-dog';
    dog.src = `assets/${state.stage || 'puppy'}/happy.png`;
    arena.appendChild(dog);

    const ball = document.createElement('div');
    ball.className = 'mg-ball';
    ball.textContent = '🎾';
    arena.appendChild(ball);

    body.appendChild(arena);

    const hint = document.createElement('p');
    hint.className = 'modal-hint';
    hint.textContent = '공을 탭하면 강아지가 잡아요!';
    hint.style.marginTop = '8px';
    body.appendChild(hint);

    const endBtn = document.createElement('button');
    endBtn.className = 'modal-btn secondary';
    endBtn.type = 'button';
    endBtn.textContent = '끝내기';
    endBtn.style.marginTop = '6px';
    body.appendChild(endBtn);

    let score = 0;
    let timeLeft = MINIGAME_DURATION_MS;
    let throwsLeft = 5;
    let ballState = 'idle'; // idle | flying | popping
    let ballPos = { x: 0, y: 0 };
    let ballVel = { vx: 0, vy: 0 };
    let lastFrame = performance.now();
    let endedFlag = false;

    function placeBall(x, y) {
      // arena 내부 좌표 (left, top)
      ball.style.left = x + 'px';
      ball.style.top = y + 'px';
      ball.style.bottom = 'auto';
      ball.style.transform = 'translate(-50%, -50%)';
    }

    function resetBall() {
      const r = arena.getBoundingClientRect();
      ballPos = { x: r.width / 2, y: r.height - 60 };
      ballVel = { vx: 0, vy: 0 };
      ballState = 'idle';
      ball.classList.remove('popped');
      placeBall(ballPos.x, ballPos.y);
    }

    function throwUp() {
      if (ballState !== 'idle' || throwsLeft <= 0 || endedFlag) return;
      const r = arena.getBoundingClientRect();
      ballVel = {
        vx: (Math.random() - 0.5) * 220,
        vy: -650 - Math.random() * 80,
      };
      ballState = 'flying';
      throwsLeft -= 1;
      SOUNDS.bounce();
    }

    ball.addEventListener('click', (e) => { e.stopPropagation(); throwUp(); });
    ball.addEventListener('touchstart', (e) => { e.preventDefault(); throwUp(); }, { passive: false });

    function step(now) {
      if (endedFlag) return;
      const dt = Math.min(40, now - lastFrame) / 1000;
      lastFrame = now;
      timeLeft -= (now - (step._lastT || now));
      step._lastT = now;
      const r = arena.getBoundingClientRect();

      if (ballState === 'flying') {
        ballVel.vy += 1500 * dt; // gravity
        ballPos.x += ballVel.vx * dt;
        ballPos.y += ballVel.vy * dt;

        // walls
        if (ballPos.x < 24) { ballPos.x = 24; ballVel.vx = Math.abs(ballVel.vx) * 0.6; }
        if (ballPos.x > r.width - 24) { ballPos.x = r.width - 24; ballVel.vx = -Math.abs(ballVel.vx) * 0.6; }

        // dog catch zone — bottom center
        const dogCx = r.width / 2;
        const dogCy = r.height - 50;
        const dx = ballPos.x - dogCx;
        const dy = ballPos.y - dogCy;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 60 && ballVel.vy > 0 && ballPos.y > r.height * 0.55) {
          // caught
          ballState = 'popping';
          ball.classList.add('popped');
          score += 1;
          state.happy = clamp(state.happy + Math.round(MINIGAME_HAPPY_BOOST / 5));
          state.points = (state.points || 0) + 2;
          addCareScore(); // 동일하게 분당 5점 cap
          SOUNDS.catch();
          flashBubble('💖');
          scoreEl.textContent = '🎯 ' + score;
          setTimeout(() => {
            if (endedFlag) return;
            resetBall();
            if (throwsLeft <= 0) endGame(true);
          }, 280);
          return;
        }

        // floor — miss
        if (ballPos.y > r.height - 30) {
          ballPos.y = r.height - 30;
          ballVel.vy = -Math.abs(ballVel.vy) * 0.4;
          ballVel.vx *= 0.7;
          if (Math.abs(ballVel.vy) < 80) {
            ballState = 'idle';
            ballVel = { vx: 0, vy: 0 };
            ballPos.x = r.width / 2;
            ballPos.y = r.height - 60;
            placeBall(ballPos.x, ballPos.y);
            if (throwsLeft <= 0) {
              setTimeout(() => endGame(true), 200);
            }
            requestAnimationFrame(step);
            return;
          }
        }

        placeBall(ballPos.x, ballPos.y);
      }

      timeEl.textContent = '⏱ ' + Math.max(0, Math.ceil(timeLeft / 1000));
      if (timeLeft <= 0) { endGame(false); return; }
      requestAnimationFrame(step);
    }

    function endGame(natural) {
      if (endedFlag) return;
      endedFlag = true;
      decayPaused = false;
      // 보상
      const happyGain = Math.min(MINIGAME_HAPPY_BOOST, score * 8);
      state.happy = clamp(state.happy + happyGain - Math.round(MINIGAME_HAPPY_BOOST / 5) * score); // 누적 만큼 차감 보정
      // 단순화: 그냥 마무리 보너스
      state.happy = clamp(state.happy + 5);
      state.minigameLastTs = Date.now();
      progressMission('minigame', 1);
      saveState();
      render();
      SOUNDS.fanfare();

      // 결과 모달
      const resultBody = document.createElement('div');
      const p = document.createElement('p');
      p.className = 'modal-sub';
      const nm = state.name || '강아지';
      p.textContent = `${score}번 잡았어요! ${nameTopic(nm)} 행복해해요 💖`;
      resultBody.appendChild(p);
      const ok = document.createElement('button');
      ok.className = 'modal-btn';
      ok.type = 'button';
      ok.textContent = '좋아요';
      ok.addEventListener('click', () => closeModal());
      resultBody.appendChild(ok);
      openModal({ title: '공놀이 끝!', body: resultBody });
    }

    openModal({
      title: '🎯 공놀이',
      body,
      onClose: () => {
        if (!endedFlag) {
          endedFlag = true;
          decayPaused = false;
          state.minigameLastTs = Date.now() - MINIGAME_COOLDOWN_MS + 30 * 1000; // 짧은 쿨타임
          saveState();
        }
      },
    });

    setTimeout(() => {
      resetBall();
      lastFrame = performance.now();
      step._lastT = lastFrame;
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

  // in-app "처음부터 다시" — URL ?nuke=1과 동일한 풀 청소
  function performReset() { return hardReset(); }

  // ----- 헤더 버튼 핸들러 -------------------------------------------------
  settingsBtn.addEventListener('click', () => { SOUNDS.pop(); openSettingsModal(); });
  shopBtn.addEventListener('click', () => { SOUNDS.pop(); openShopModal(); });
  missionBtn.addEventListener('click', () => { SOUNDS.pop(); openMissionsModal(); });

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
