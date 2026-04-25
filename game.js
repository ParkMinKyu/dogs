/* ======================================================================
   강아지 키우기 — P0+P1 게임 로직
   - 4 게이지 (hunger/happy/clean/energy), 0~100, 시간 따라 감소
   - 4 액션 (feed/play/wash/sleep), 누르면 회복 + 표정/애니메이션
   - 진화 단계 stage: puppy → teen (30) → adult (100)
   - 낮/밤 사이클 (낮 6~18, 저녁 18~22, 밤 22~6) — CSS 변수로 색감 전환
   - localStorage 저장, 강아지 절대 안 죽음
   ====================================================================== */

(() => {
  'use strict';

  // ----- Tunables ---------------------------------------------------------
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
    feed:  { state: 'eating',  ms: 1800, sound: 'eat' },
    play:  { state: 'happy',   ms: 1600, sound: 'happy' },
    wash:  { state: 'happy',   ms: 1400, sound: 'splash' },
    sleep: { state: 'sleeping', ms: 2200, sound: 'sleep' },
  };

  const ACTION_BUBBLE = { feed: '🍖', play: '💖', wash: '✨', sleep: '💤' };

  // 진화 단계 — 누적 케어 점수 임계값.
  // 액션 1회당 +1, 30점 = 약 30번 케어 (어린이가 1~2일 안에 첫 진화 보기 적당)
  const STAGES = [
    { id: 'puppy', label: '아기',     threshold: 0   },
    { id: 'teen',  label: '청소년',   threshold: 30  },
    { id: 'adult', label: '어른',     threshold: 100 },
  ];

  // 시간대 정의 — system clock 기반
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
      // P1: 누적 케어 점수 + stage. 기존 세이브에 없으면 보강.
      if (typeof s.care !== 'number') s.care = 0;
      if (typeof s.stage !== 'string') s.stage = stageForCare(s.care);
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
      stage: 'puppy',
    };
  }

  function stageForCare(care) {
    let cur = STAGES[0].id;
    for (const s of STAGES) {
      if (care >= s.threshold) cur = s.id;
    }
    return cur;
  }

  // ----- Game state -------------------------------------------------------
  let state = loadState() || defaultState();
  applyOfflineDecay();

  let tempFaceUntil = 0;
  let tempFaceState = null;
  let evolveAnimUntil = 0;
  let timeOverride = null; // for QA — 'day' | 'evening' | 'night' | null

  // ----- DOM refs ---------------------------------------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const root = $('.app');
  const puppyEl  = $('#puppy');
  const bubbleEl = $('#bubble');
  const muteBtn  = $('#muteBtn');
  const stageBadge = $('#stageBadge');
  const todBadge   = $('#todBadge');
  const evolveFx   = $('#evolveFx');
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
  updateMuteUI();

  function ensureAudio() {
    if (muted) return null;
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch { audioCtx = null; }
    }
    return audioCtx;
  }

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

  const SOUNDS = {
    eat:    () => blip([520, 660], 0.10, 'triangle', 0.07),
    happy:  () => blip([660, 880, 990], 0.11, 'sine', 0.06),
    splash: () => blip([880, 740, 620], 0.09, 'sine', 0.05),
    sleep:  () => blip([330, 247], 0.18, 'sine', 0.05),
    evolve: () => blip([523, 659, 784, 1046], 0.13, 'triangle', 0.07),
  };

  function updateMuteUI() {
    muteBtn.setAttribute('aria-pressed', String(muted));
    muteBtn.setAttribute('aria-label', muted ? '소리 켜기' : '소리 끄기');
    muteBtn.querySelector('.icon').textContent = muted ? '🔇' : '🔊';
  }

  muteBtn.addEventListener('click', () => {
    muted = !muted;
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    updateMuteUI();
    if (!muted) SOUNDS.happy();
  });

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
    btn.addEventListener('click', () => onAction(btn));
  });

  function onAction(btn) {
    const action = btn.dataset.action;
    const eff = ACTION_EFFECT[action];
    if (!eff) return;

    // 밤이면 sleep 액션 부스트
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

    // 진화 점수 누적
    state.care = (state.care || 0) + 1;
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

    saveState();
    render();
  }

  function triggerEvolveFx() {
    evolveAnimUntil = Date.now() + 1500;
    puppyEl.classList.add('is-evolving');
    evolveFx.classList.add('show');
    SOUNDS.evolve();
    setTimeout(() => {
      puppyEl.classList.remove('is-evolving');
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

  // 30분마다 시간대 체크
  setInterval(applyTod, 30 * 60 * 1000);

  // ----- Render -----------------------------------------------------------
  function pickPuppyState() {
    const now = Date.now();
    if (tempFaceState && now < tempFaceUntil) return tempFaceState;

    const lows = GAUGES.filter(g => state[g] <= 20).length;
    const avg = GAUGES.reduce((s, g) => s + state[g], 0) / GAUGES.length;
    const tod = currentTod();

    if (lows >= 1) return 'sad';
    // 밤이면 잠자기 우선 (에너지가 어느 정도 있어도 졸림)
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
    puppyEl.classList.remove('is-happy','is-eating','is-sad','is-sleeping');
    if (s !== 'idle') puppyEl.classList.add('is-' + s);
    puppyEl.classList.remove('is-puppy','is-teen','is-adult');
    puppyEl.classList.add('is-' + stage);

    if (root) root.dataset.stage = stage;
    if (stageBadge) {
      const meta = STAGES.find(x => x.id === stage) || STAGES[0];
      stageBadge.textContent = meta.label;
    }

    applyTod();
  }

  setInterval(() => {
    if (tempFaceState && Date.now() >= tempFaceUntil) {
      tempFaceState = null;
      render();
    }
  }, 250);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveState();
    else applyTod(); // tab 다시 열 때 시간대 즉시 갱신
  });
  window.addEventListener('beforeunload', saveState);

  applyTod();
  render();

  function clamp(v) { return Math.max(0, Math.min(MAX, Math.round(v))); }

  // Dev hooks for QA
  window.__dogs = {
    reset() { state = defaultState(); saveState(); render(); },
    get() { return { ...state }; },
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
    setStage(stage) {
      state.stage = stage;
      saveState();
      render();
    },
    setTod(tod) {
      timeOverride = tod;
      applyTod();
      render();
    },
    clearTod() { timeOverride = null; applyTod(); render(); },
    forceEvolveFx() { triggerEvolveFx(); },
  };
})();
