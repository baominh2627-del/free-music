(() => {
  const view = document.getElementById('view-danh-dan');
  if (!view) return;

  const workspace = document.getElementById('jam-workspace');
  const el = id => document.getElementById(id);
  const rootSemitones = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const rootNames = { C: 'Đô', D: 'Rê', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };
  const qualities = {
    major: { suffix: '', label: 'trưởng', intervals: [0, 4, 7] },
    minor: { suffix: 'm', label: 'thứ', intervals: [0, 3, 7] },
    seventh: { suffix: '7', label: 'bảy', intervals: [0, 4, 7, 10] },
    minorSeventh: { suffix: 'm7', label: 'thứ bảy', intervals: [0, 3, 7, 10] }
  };
  const rhythms = {
    pop: { label: 'Pop 4/4', beats: 4, hits: [{ beat: 0, direction: 'down', strength: 1 }, { beat: 1, direction: 'up', strength: 0.62 }, { beat: 2, direction: 'down', strength: 0.84 }, { beat: 3, direction: 'up', strength: 0.62 }] },
    ballad: { label: 'Ballad', beats: 4, hits: [{ beat: 0, direction: 'down', strength: 0.92 }, { beat: 0.75, direction: 'pick', strength: 0.48 }, { beat: 1.5, direction: 'down', strength: 0.64 }, { beat: 2, direction: 'down', strength: 0.8 }, { beat: 3, direction: 'up', strength: 0.54 }] },
    waltz: { label: 'Waltz 3/4', beats: 3, hits: [{ beat: 0, direction: 'down', strength: 1 }, { beat: 1, direction: 'up', strength: 0.52 }, { beat: 2, direction: 'up', strength: 0.62 }] },
    rock: { label: 'Rock 4/4', beats: 4, hits: [{ beat: 0, direction: 'down', strength: 1 }, { beat: 0.5, direction: 'up', strength: 0.56 }, { beat: 1, direction: 'down', strength: 0.78 }, { beat: 1.5, direction: 'up', strength: 0.56 }, { beat: 2, direction: 'down', strength: 0.92 }, { beat: 2.5, direction: 'up', strength: 0.58 }, { beat: 3, direction: 'down', strength: 0.78 }, { beat: 3.5, direction: 'up', strength: 0.58 }] },
    sixEight: { label: 'Slow 6/8', beats: 3, hits: [{ beat: 0, direction: 'down', strength: 1 }, { beat: 0.5, direction: 'up', strength: 0.48 }, { beat: 1, direction: 'up', strength: 0.62 }, { beat: 1.5, direction: 'down', strength: 0.78 }, { beat: 2, direction: 'up', strength: 0.5 }, { beat: 2.5, direction: 'up', strength: 0.64 }] }
  };
  const storageKey = 'pink-tune-danh-dan:v1';
  const readPrefs = () => {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch { return {}; }
  };
  const saved = readPrefs();
  const state = {
    root: Object.hasOwn(rootSemitones, saved.root) ? saved.root : 'C',
    accidental: [-1, 0, 1].includes(Number(saved.accidental)) ? Number(saved.accidental) : 0,
    quality: Object.hasOwn(qualities, saved.quality) ? saved.quality : 'major',
    rhythm: Object.hasOwn(rhythms, saved.rhythm) ? saved.rhythm : 'pop',
    instrument: ['guitar', 'piano', 'ukulele'].includes(saved.instrument) ? saved.instrument : 'guitar',
    theme: ['pink', 'mint', 'night'].includes(saved.theme) ? saved.theme : 'pink',
    bpm: Number.isFinite(Number(saved.bpm)) ? Math.max(40, Math.min(200, Number(saved.bpm))) : 90,
    chord: null,
    pendingChord: null,
    playing: false,
    audio: null,
    timer: null,
    nextStepAt: 0,
    stepPosition: 0,
    pressed: new Set(),
    gesture: new Set(),
    voices: new Set()
  };

  function savePrefs() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ root: state.root, accidental: state.accidental, quality: state.quality, rhythm: state.rhythm, instrument: state.instrument, theme: state.theme, bpm: state.bpm }));
    } catch { /* Preferences are optional when storage is unavailable. */ }
  }

  function rootPitchClass(root = state.root, accidental = state.accidental) {
    return (rootSemitones[root] + accidental + 12) % 12;
  }

  function rootLabel(root = state.root, accidental = state.accidental) {
    return `${root}${accidental === 1 ? '♯' : accidental === -1 ? '♭' : ''}`;
  }

  function rootName(root = state.root, accidental = state.accidental) {
    return `${rootNames[root]}${accidental === 1 ? ' thăng' : accidental === -1 ? ' giáng' : ''}`;
  }

  function makeChord(root = state.root, accidental = state.accidental, quality = state.quality) {
    const spec = qualities[quality];
    return { root, accidental, quality, name: `${rootLabel(root, accidental)}${spec.suffix}`, label: spec.label, pitchClass: rootPitchClass(root, accidental), intervals: spec.intervals };
  }

  state.chord = makeChord();

  function updateChordDisplay() {
    if (!state.pendingChord) state.chord = makeChord();
    const visibleChord = state.pendingChord || state.chord;
    el('jam-current-chord').textContent = visibleChord.name;
    el('jam-current-description').textContent = `${rootName()} ${visibleChord.label}`;
    el('jam-now-caption').textContent = state.playing ? 'ĐANG ĐỆM HỢP ÂM' : 'SẴN SÀNG CHƠI';
    view.querySelectorAll('[data-root]').forEach(button => {
      const active = button.dataset.root === state.root;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
      button.querySelector('b').textContent = button.dataset.root + (active && state.accidental === 1 ? '♯' : active && state.accidental === -1 ? '♭' : '');
    });
    view.querySelectorAll('[data-quality]').forEach(button => {
      const active = button.dataset.quality === state.quality;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function updateSettingsUI() {
    el('jam-rhythm').value = state.rhythm;
    el('jam-instrument').value = state.instrument;
    el('jam-tempo').value = String(state.bpm);
    workspace.dataset.jamTheme = state.theme;
    view.querySelectorAll('[data-accidental]').forEach(button => {
      const active = Number(button.dataset.accidental) === state.accidental;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    view.querySelectorAll('[data-theme]').forEach(button => {
      const active = button.dataset.theme === state.theme;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    updateMeter();
  }

  function updateMeter(activeBeat = -1) {
    const beats = rhythms[state.rhythm].beats;
    [...el('jam-beat-meter').children].forEach((dot, index) => {
      dot.hidden = index >= beats;
      dot.classList.toggle('active', index === activeBeat);
    });
  }

  function setStatus(message) {
    el('jam-status').textContent = message;
  }

  function setChord({ root = state.root, accidental = state.accidental, quality = state.quality, playPreview = true } = {}) {
    state.root = root;
    state.accidental = accidental;
    state.quality = quality;
    const nextChord = makeChord();
    if (state.playing) state.pendingChord = nextChord;
    else {
      state.chord = nextChord;
      state.pendingChord = null;
    }
    updateChordDisplay();
    savePrefs();
    if (state.playing) {
      setStatus(`${state.chord.name} sẽ vào ở nhịp kế tiếp.`);
    } else if (playPreview) {
      setStatus(`Đang nghe thử ${state.chord.name}. Bấm Space hoặc “Chạy điệu” để đệm liên tục.`);
      playSingleChord(state.chord).catch(() => {});
    } else {
      setStatus(`Đã chọn ${state.chord.name}. Chạm nốt gốc để nghe thử.`);
    }
  }

  function audioContext() {
    if (state.audio) return state.audio;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) throw new Error('Trình duyệt này chưa hỗ trợ Web Audio. Hãy thử Chrome hoặc Safari mới hơn.');
    state.audio = new Context();
    return state.audio;
  }

  function midiFrequency(midi) {
    return 440 * 2 ** ((midi - 69) / 12);
  }

  function playVoice(frequency, at, strength, instrument) {
    const context = audioContext();
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    const duration = instrument === 'piano' ? 0.48 : instrument === 'ukulele' ? 0.25 : 0.34;
    oscillator.type = instrument === 'piano' ? 'sine' : instrument === 'ukulele' ? 'sawtooth' : 'triangle';
    oscillator.frequency.setValueAtTime(frequency, at);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(instrument === 'ukulele' ? 2600 : 1900, at);
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.018, 0.105 * strength), at + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(filter);
    filter.connect(envelope);
    envelope.connect(context.destination);
    const voice = { oscillator, envelope };
    state.voices.add(voice);
    oscillator.onended = () => state.voices.delete(voice);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.02);
  }

  function strum(chord, at, direction = 'down', strength = 0.8) {
    if (!chord) return;
    const context = audioContext();
    const baseMidi = state.instrument === 'guitar' ? 48 : 60;
    const notes = chord.intervals.map(interval => baseMidi + chord.pitchClass + interval);
    if (direction === 'up') notes.reverse();
    if (direction === 'pick') {
      const note = notes[Math.floor(state.stepPosition * 4) % notes.length];
      playVoice(midiFrequency(note), at, strength * 0.9, state.instrument);
      return;
    }
    const spread = state.instrument === 'piano' ? 0.008 : 0.016;
    notes.forEach((note, index) => playVoice(midiFrequency(note), at + index * spread, strength * (index === 0 ? 1 : 0.78), state.instrument));
    void context;
  }

  async function playSingleChord(chord) {
    try {
      const context = audioContext();
      await context.resume();
      strum(chord, context.currentTime + 0.025, 'down', 0.9);
    } catch (error) {
      setStatus(error.message || 'Không khởi tạo được âm thanh.');
    }
  }

  function pulseBeat(beat) {
    updateMeter(beat);
    window.setTimeout(() => {
      if (state.playing) updateMeter();
    }, Math.max(90, 30000 / state.bpm));
  }

  function scheduleWindow() {
    if (!state.playing || !state.audio) return;
    const now = state.audio.currentTime;
    const stepDuration = 60 / state.bpm / 4;
    if (state.nextStepAt < now - 0.2) {
      state.nextStepAt = now + 0.03;
      state.stepPosition = 0;
    }
    const pattern = rhythms[state.rhythm];
    if (state.stepPosition >= pattern.beats) state.stepPosition = 0;
    while (state.nextStepAt < now + 0.11) {
      if (state.pendingChord && Math.abs(state.stepPosition - Math.round(state.stepPosition)) < 0.001) {
        state.chord = state.pendingChord;
        state.pendingChord = null;
        updateChordDisplay();
        setStatus(`${rhythms[state.rhythm].label} · ${state.bpm} BPM · ${state.chord.name}`);
      }
      const hit = pattern.hits.find(item => Math.abs(item.beat - state.stepPosition) < 0.001);
      if (hit) {
        strum(state.chord, state.nextStepAt, hit.direction, hit.strength);
        pulseBeat(Math.min(pattern.beats - 1, Math.floor(hit.beat)));
      }
      state.stepPosition += 0.25;
      if (state.stepPosition >= pattern.beats) state.stepPosition = 0;
      state.nextStepAt += stepDuration;
    }
  }

  async function start() {
    if (state.playing) return;
    try {
      const context = audioContext();
      await context.resume();
      state.playing = true;
      state.chord = makeChord();
      state.pendingChord = null;
      state.stepPosition = 0;
      state.nextStepAt = context.currentTime + 0.045;
      state.timer = window.setInterval(scheduleWindow, 24);
      scheduleWindow();
      updatePlayButton();
      updateChordDisplay();
      setStatus(`${rhythms[state.rhythm].label} · ${state.bpm} BPM · ${state.chord.name}`);
    } catch (error) {
      setStatus(error.message || 'Không khởi tạo được âm thanh.');
    }
  }

  function stop({ silent = false } = {}) {
    if (state.timer) window.clearInterval(state.timer);
    state.timer = null;
    state.playing = false;
    if (state.pendingChord) state.chord = state.pendingChord;
    state.pendingChord = null;
    const context = state.audio;
    if (context) {
      const at = context.currentTime;
      state.voices.forEach(({ oscillator, envelope }) => {
        try {
          envelope.gain.cancelScheduledValues(at);
          envelope.gain.setTargetAtTime(0.0001, at, 0.018);
          oscillator.stop(at + 0.08);
        } catch { /* The note may already have ended. */ }
      });
    }
    updatePlayButton();
    updateChordDisplay();
    updateMeter();
    if (!silent) setStatus('Đã dừng phần đệm. Chạm hợp âm để nghe thử.');
  }

  function updatePlayButton() {
    const button = el('jam-play-toggle');
    button.setAttribute('aria-pressed', String(state.playing));
    button.classList.toggle('playing', state.playing);
    button.querySelector('span:first-child').textContent = state.playing ? 'Ⅱ' : '▶';
    button.querySelector('span:last-child').textContent = state.playing ? 'Tạm dừng' : 'Chạy điệu';
  }

  function togglePlay() {
    if (state.playing) stop();
    else start();
  }

  function setTempo(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return;
    state.bpm = Math.max(40, Math.min(200, Math.round(number)));
    el('jam-tempo').value = String(state.bpm);
    savePrefs();
    if (state.playing) setStatus(`${rhythms[state.rhythm].label} · ${state.bpm} BPM · ${state.chord.name}`);
  }

  function setRhythm(value) {
    if (!rhythms[value]) return;
    state.rhythm = value;
    state.stepPosition = 0;
    if (state.audio && state.playing) state.nextStepAt = state.audio.currentTime + 0.04;
    updateMeter();
    savePrefs();
    setStatus(`${rhythms[state.rhythm].label} · ${state.bpm} BPM · ${state.chord.name}`);
  }

  function setQuality(value) {
    if (!qualities[value]) return;
    setChord({ quality: value, playPreview: false });
  }

  function keyboardToken(event) {
    const key = String(event.key || '').toUpperCase();
    if (Object.hasOwn(rootSemitones, key)) return key;
    if (key === 'M') return 'M';
    if (key === '7' || event.code === 'Digit7' || event.code === 'Numpad7') return '7';
    return null;
  }

  function isEditable(target) {
    return target instanceof Element && !!target.closest('input, textarea, select, [contenteditable="true"]');
  }

  function isOverlayOpen() {
    return !!document.querySelector('dialog[open]') || !el('now-playing-screen').hidden;
  }

  function resolveGesture(keys) {
    const roots = [...keys].filter(key => Object.hasOwn(rootSemitones, key));
    if (roots.length !== 1) {
      setStatus('Tổ hợp cần đúng một nốt gốc: C, D, E, F, G, A hoặc B.');
      el('jam-keyboard-feedback').textContent = 'Thử lại: giữ một nốt gốc, có thể thêm M và/hoặc 7.';
      return;
    }
    const minor = keys.has('M');
    const seventh = keys.has('7');
    const quality = minor ? seventh ? 'minorSeventh' : 'minor' : seventh ? 'seventh' : 'major';
    const root = roots[0];
    const accidental = state.accidental;
    el('jam-keyboard-feedback').textContent = `Vừa bấm: ${rootLabel(root, accidental)}${qualities[quality].suffix} · giữ nốt gốc cùng M/7 rồi thả để chơi.`;
    setChord({ root, accidental, quality, playPreview: true });
  }

  function clearGesture() {
    state.pressed.clear();
    state.gesture.clear();
    el('jam-keyboard-feedback').textContent = 'Máy tính: giữ C + M + 7 cùng lúc rồi thả để phát Cm7.';
  }

  view.querySelectorAll('[data-root]').forEach(button => button.addEventListener('click', () => {
    setChord({ root: button.dataset.root, playPreview: true });
  }));
  view.querySelectorAll('[data-quality]').forEach(button => button.addEventListener('click', () => setQuality(button.dataset.quality)));
  view.querySelectorAll('[data-accidental]').forEach(button => button.addEventListener('click', () => {
    const accidental = Number(button.dataset.accidental);
    setChord({ accidental, playPreview: false });
    updateSettingsUI();
    savePrefs();
    if (!state.playing) setStatus(`Dấu hóa ${button.textContent.trim()} đã chọn. Chạm nốt gốc để phát ${state.chord.name}.`);
  }));
  view.querySelectorAll('[data-theme]').forEach(button => button.addEventListener('click', () => {
    state.theme = button.dataset.theme;
    updateSettingsUI();
    savePrefs();
  }));
  el('jam-play-toggle').addEventListener('click', togglePlay);
  el('jam-stop').addEventListener('click', () => stop());
  el('jam-rhythm').addEventListener('change', event => setRhythm(event.target.value));
  el('jam-instrument').addEventListener('change', event => {
    state.instrument = event.target.value;
    savePrefs();
  });
  el('jam-tempo').addEventListener('change', event => setTempo(event.target.value || state.bpm));
  el('jam-tempo-down').addEventListener('click', () => setTempo(state.bpm - 5));
  el('jam-tempo-up').addEventListener('click', () => setTempo(state.bpm + 5));

  document.addEventListener('keydown', event => {
    if (!view.classList.contains('active') || isOverlayOpen() || isEditable(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === 'Space') {
      event.preventDefault();
      if (!event.repeat) togglePlay();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      stop();
      clearGesture();
      return;
    }
    const token = keyboardToken(event);
    if (!token) return;
    event.preventDefault();
    if (event.repeat) return;
    state.pressed.add(token);
    state.gesture.add(token);
    el('jam-keyboard-feedback').textContent = `Đang giữ: ${[...state.gesture].join(' + ')}`;
  });

  document.addEventListener('keyup', event => {
    if (!view.classList.contains('active')) return;
    const token = keyboardToken(event);
    if (!token || !state.gesture.has(token)) return;
    event.preventDefault();
    state.pressed.delete(token);
    if (!state.pressed.size) {
      const gesture = new Set(state.gesture);
      state.gesture.clear();
      if (isOverlayOpen()) el('jam-keyboard-feedback').textContent = 'Đã hủy tổ hợp phím khi một cửa sổ đang mở.';
      else resolveGesture(gesture);
    } else {
      el('jam-keyboard-feedback').textContent = `Đang giữ: ${[...state.gesture].join(' + ')}`;
    }
  });

  const viewObserver = new MutationObserver(() => {
    if (!view.classList.contains('active')) {
      if (state.playing) stop({ silent: true });
      clearGesture();
    }
  });
  viewObserver.observe(view, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.playing) stop({ silent: true });
  });

  updateSettingsUI();
  updateChordDisplay();
  updatePlayButton();
})();
