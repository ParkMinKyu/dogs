/* ======================================================================
   강아지 키우기 — P0 게임 로직
   - 4 게이지 (hunger/happy/clean/energy), 0~100, 시간 따라 감소
   - 4 액션 (feed/play/wash/sleep), 누르면 회복 + 표정/애니메이션
   - localStorage로 상태 저장, 탭 닫고 다시 열어도 이어짐
   - 강아지는 절대 안 죽음. 0 되면 슬픈 표정만.
   - WebAudio로 가벼운 효과음, 음소거 토글.
   ====================================================================== */

(() => {
  'use strict';

  // ----- Tunables ---------------------------------------------------------
  const GAUGES = ['hunger', 'happy', 'clean', 'energy'];
  const MAX = 100;

  // 게이지 감소: 30초마다 -5 (P0 스펙)
  const TICK_MS = 30 * 1000;
  const DECAY_PER_TICK = 5;

  // 액션 효과
  const ACTION_EFFECT = {
    feed:  { hunger: +35, happy:  +5, clean:  -5, energy:  +0 },
    play:  { hunger:  -5, happy: +35, clean:  -5, energy: -10 },
    wash:  { hunger:   0, happy:  -3, clean: +40, energy:  -3 },
    sleep: { hunger:  -5, happy:  +0, clean:   0, energy: +50 },
  };

  // 액션 → 일시적 표정 (ms)
  const ACTION_FACE = {
    feed:  { state: 'eating',  ms: 1800, sound: 'eat' },
    play:  { state: 'happy',   ms: 1600, sound: 'happy' },
    wash:  { state: 'happy',   ms: 1400, sound: 'splash' },
    sleep: { state: 'sleeping', ms: 2200, sound: 'sleep' },
  };

  // 버블 이모지
  const ACTION_BUBBLE = {
    feed: '🍖',
    play: '💖',
    wash: '✨',
    sleep: '💤',
  };

  // ----- Storage ----------------------------------------------------------
  const STORAGE_KEY = 'dogs.p0.state.v1';
  const MUTE_KEY    = 'dogs.p0.muted.v1';

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      // sanity
      if (!s || typeof s !== 'object') return null;
      for (const g of GAUGES) {
        if (typeof s[g] !== 'number') return null;
      }
      if (typeof s.lastTs !== 'number') s.lastTs = Date.now();
      return s;
    } catch { return null; }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }

  function defaultState() {
    return {
      hunger: 80,
      happy:  80,
      clean:  80,
      energy: 80,
      lastTs: Date.now(),
    };
  }

  // ----- Game state -------------------------------------------------------
  let state = loadState() || defaultState();

  // Catch-up decay for time spent away from the tab.
  applyOfflineDecay();

  let tempFaceUntil = 0;     // ms timestamp; while now < this, hold special face
  let tempFaceState = null;  // 'eating' | 'happy' | 'sleeping' | 'sad'

  // ----- DOM refs ---------------------------------------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const puppyEl  = $('#puppy');
  const bubbleEl = $('#bubble');
  const muteBtn  = $('#muteBtn');
  const fills = {
    hunger: $('.fill-hunger'),
    happy:  $('.fill-happy'),
    clean:  $('.fill-clean'),
    energy: $('.fill-energy'),
  };
  const actionBtns = document.querySelectorAll('.action');

  // ----- Audio (very small WebAudio blips) --------------------------------
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
    if (!muted) SOUNDS.happy(); // little confirmation tone
  });

  // ----- Decay loop -------------------------------------------------------
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

    for (const g of GAUGES) {
      if (typeof eff[g] === 'number') {
        state[g] = clamp(state[g] + eff[g]);
      }
    }

    // visual feedback on button
    btn.classList.remove('cheer');
    void btn.offsetWidth; // restart animation
    btn.classList.add('cheer');

    // bubble emoji
    bubbleEl.textContent = ACTION_BUBBLE[action] || '✨';
    bubbleEl.classList.add('show');
    clearTimeout(bubbleEl._t);
    bubbleEl._t = setTimeout(() => bubbleEl.classList.remove('show'), 900);

    // temp face
    const face = ACTION_FACE[action];
    if (face) {
      tempFaceState = face.state;
      tempFaceUntil = Date.now() + face.ms;
      if (face.sound && SOUNDS[face.sound]) SOUNDS[face.sound]();
    }

    saveState();
    render();
  }

  // ----- Render -----------------------------------------------------------
  function pickPuppyState() {
    const now = Date.now();
    if (tempFaceState && now < tempFaceUntil) return tempFaceState;

    // Resting state derived from gauges
    const lows = GAUGES.filter(g => state[g] <= 20).length;
    const avg = GAUGES.reduce((s, g) => s + state[g], 0) / GAUGES.length;

    if (lows >= 1) return 'sad';
    if (state.energy <= 25) return 'sleeping';
    if (avg >= 75)  return 'happy';
    return 'idle';
  }

  function render() {
    // gauges
    for (const g of GAUGES) {
      const v = state[g];
      const el = fills[g];
      if (!el) continue;
      el.style.width = v + '%';
      el.classList.toggle('is-low', v <= 25);
    }

    // puppy sprite + animation class
    const s = pickPuppyState();
    const src = `assets/puppy/${s}.png`;
    if (!puppyEl.src.endsWith(src)) puppyEl.src = src;
    puppyEl.classList.remove('is-happy','is-eating','is-sad','is-sleeping');
    if (s !== 'idle') puppyEl.classList.add('is-' + s);
  }

  // Re-render periodically so temp-face expiry shows up smoothly
  setInterval(() => {
    if (tempFaceState && Date.now() >= tempFaceUntil) {
      tempFaceState = null;
      render();
    }
  }, 250);

  // Save when tab hidden / closed
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveState();
  });
  window.addEventListener('beforeunload', saveState);

  // First paint
  render();

  // Helpers
  function clamp(v) { return Math.max(0, Math.min(MAX, Math.round(v))); }

  // Tiny dev hook (handy for kids' parent to reset)
  window.__dogs = {
    reset() { state = defaultState(); saveState(); render(); },
    get() { return { ...state }; },
  };
})();
