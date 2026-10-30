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
    reverb: Boolean(saved.reverb),
    bpm: Number.isFinite(Number(saved.bpm)) ? Math.max(40, Math.min(200, Number(saved.bpm))) : 90,
    chord: null,
    pendingChord: null,
    playing: false,
    audio: null,
    convolver: null,
    reverbGain: null,
    timer: null,
    nextStepAt: 0,
    stepPosition: 0,
    pressed: new Set(),
    gesture: new Set(),
    voices: new Set(),
    heldVoices: [],
    heldSource: null,
    heldChord: null
  };

  function savePrefs() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ root: state.root, accidental: state.accidental, quality: state.quality, rhythm: state.rhythm, instrument: state.instrument, theme: state.theme, reverb: state.reverb, bpm: state.bpm }));
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
    el('jam-reverb-toggle').setAttribute('aria-pressed', String(state.reverb));
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
      setStatus(`${nextChord.name} sẽ vào ở nhịp kế tiếp.`);
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
    const context = state.audio;
    const convolver = context.createConvolver();
    const reverbGain = context.createGain();
    const impulseLength = Math.floor(context.sampleRate * 4.2);
    const impulse = context.createBuffer(2, impulseLength, context.sampleRate);
    for (let channelIndex = 0; channelIndex < impulse.numberOfChannels; channelIndex++) {
      const samples = impulse.getChannelData(channelIndex);
      for (let index = 0; index < impulseLength; index++) {
        const decay = (1 - index / impulseLength) ** 2.5;
        samples[index] = (Math.random() * 2 - 1) * decay;
      }
    }
    convolver.buffer = impulse;
    reverbGain.gain.setValueAtTime(state.reverb ? 0.38 : 0, context.currentTime);
    convolver.connect(reverbGain);
    reverbGain.connect(context.destination);
    state.convolver = convolver;
    state.reverbGain = reverbGain;
    return state.audio;
  }

  function midiFrequency(midi) {
    return 440 * 2 ** ((midi - 69) / 12);
  }

  function playVoice(frequency, at, strength, instrument, { sustain = false } = {}) {
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
    const peak = Math.max(0.018, 0.105 * strength);
    envelope.gain.exponentialRampToValueAtTime(peak, at + 0.012);
    if (sustain) envelope.gain.setValueAtTime(peak, at + 0.018);
    else envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(filter);
    filter.connect(envelope);
    envelope.connect(context.destination);
    if (state.convolver) envelope.connect(state.convolver);
    const voice = { oscillator, envelope, sustained: sustain };
    state.voices.add(voice);
    oscillator.onended = () => state.voices.delete(voice);
    oscillator.start(at);
    if (!sustain) oscillator.stop(at + duration + 0.02);
    return voice;
  }

  function releaseVoice(voice) {
    if (!voice || !state.audio) return;
    const at = state.audio.currentTime;
    try {
      if (typeof voice.envelope.gain.cancelAndHoldAtTime === 'function') voice.envelope.gain.cancelAndHoldAtTime(at);
      else {
        voice.envelope.gain.cancelScheduledValues(at);
        voice.envelope.gain.setValueAtTime(Math.max(0.0001, voice.envelope.gain.value), at);
      }
      voice.envelope.gain.setTargetAtTime(0.0001, at, state.reverb ? 0.035 : 0.008);
      voice.oscillator.stop(at + 0.12);
    } catch { /* The note may already have ended. */ }
  }

  async function startHeldChord(chord, source) {
    releaseHeldChord();
    state.heldSource = source;
    state.heldChord = chord;
    try {
      const context = audioContext();
      await context.resume();
      if (state.heldSource !== source) return;
      const baseMidi = state.instrument === 'guitar' ? 48 : 60;
      const at = context.currentTime + 0.018;
      state.heldVoices = chord.intervals.map(interval => playVoice(midiFrequency(baseMidi + chord.pitchClass + interval), at, 0.68, state.instrument, { sustain: true }));
    } catch (error) {
      if (state.heldSource === source) setStatus(error.message || 'Không khởi tạo được âm thanh.');
    }
  }

  function releaseHeldChord(source = null) {
    if (source && state.heldSource !== source) return;
    const voices = state.heldVoices;
    state.heldVoices = [];
    state.heldSource = null;
    state.heldChord = null;
    voices.forEach(releaseVoice);
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
    state.heldVoices = [];
    state.heldSource = null;
    state.heldChord = null;
    state.pressed.clear();
    state.gesture.clear();
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
    if (!silent) setStatus('Đã dừng phần đệm. Giữ hợp âm để phát thử.');
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

  function setReverb(enabled) {
    state.reverb = Boolean(enabled);
    if (state.reverbGain && state.audio) {
      const at = state.audio.currentTime;
      if (typeof state.reverbGain.gain.cancelAndHoldAtTime === 'function') state.reverbGain.gain.cancelAndHoldAtTime(at);
      else state.reverbGain.gain.cancelScheduledValues(at);
      state.reverbGain.gain.setTargetAtTime(state.reverb ? 0.38 : 0, at, 0.045);
    }
    el('jam-reverb-toggle').setAttribute('aria-pressed', String(state.reverb));
    savePrefs();
    setStatus(state.reverb ? 'Đã bật vang dài. Âm sẽ tiếp tục ngân sau khi thả hợp âm.' : 'Đã tắt vang dài. Âm sẽ ngắt nhanh khi thả hợp âm.');
  }

  function announceHeldChord(chord) {
    if (state.playing) setStatus(`Đang giữ ${chord.name}; điệu đệm đổi sang hợp âm này ở nhịp kế tiếp.`);
    else setStatus(`Đang giữ ${chord.name}; thả phím để ngắt${state.reverb ? ', âm vang sẽ còn ngân.' : '.'}`);
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

  function syncKeyboardChord() {
    const roots = [...state.pressed].filter(key => Object.hasOwn(rootSemitones, key));
    if (!roots.length) {
      releaseHeldChord('keyboard');
      if (state.pressed.size) el('jam-keyboard-feedback').textContent = `Đang giữ: ${[...state.pressed].join(' + ')} · chờ nốt gốc.`;
      else {
        el('jam-keyboard-feedback').textContent = state.reverb ? 'Đã thả phím — hợp âm đang ngân vang.' : 'Thả hết phím — âm đã ngắt.';
        if (state.playing) setStatus(`${(state.pendingChord || state.chord).name} tiếp tục theo điệu đệm.`);
        else setStatus(state.reverb ? 'Đã thả hợp âm; âm vang đang ngân.' : 'Đã thả hợp âm; âm đã ngắt.');
      }
      return;
    }
    if (roots.length !== 1) {
      releaseHeldChord('keyboard');
      setStatus('Tổ hợp cần đúng một nốt gốc: C, D, E, F, G, A hoặc B.');
      el('jam-keyboard-feedback').textContent = `Đang giữ nhiều nốt gốc: ${roots.join(' + ')}. Chỉ giữ một nốt gốc.`;
      return;
    }
    const minor = state.pressed.has('M');
    const seventh = state.pressed.has('7');
    const quality = minor ? seventh ? 'minorSeventh' : 'minor' : seventh ? 'seventh' : 'major';
    const root = roots[0];
    const accidental = state.accidental;
    const chord = makeChord(root, accidental, quality);
    el('jam-keyboard-feedback').textContent = `Đang giữ ${rootLabel(root, accidental)}${qualities[quality].suffix} · thả phím để ngắt.`;
    if (state.heldSource === 'keyboard' && state.heldChord?.name === chord.name) return;
    setChord({ root, accidental, quality, playPreview: false });
    startHeldChord(chord, 'keyboard');
    announceHeldChord(chord);
  }

  function clearGesture() {
    state.pressed.clear();
    state.gesture.clear();
    releaseHeldChord('keyboard');
    el('jam-keyboard-feedback').textContent = 'Máy tính: giữ C + M + 7 để phát Cm7; thả phím để ngắt.';
  }

  view.querySelectorAll('[data-root]').forEach(button => {
    button.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      const source = `pointer:${event.pointerId}`;
      try { button.setPointerCapture(event.pointerId); } catch { /* Capture is optional. */ }
      setChord({ root: button.dataset.root, playPreview: false });
      const chord = makeChord();
      startHeldChord(chord, source);
      announceHeldChord(chord);
    });
    const releasePointer = event => {
      const source = `pointer:${event.pointerId}`;
      if (state.heldSource !== source) return;
      releaseHeldChord(source);
      setStatus(state.playing ? `${(state.pendingChord || state.chord).name} tiếp tục theo điệu đệm.` : state.reverb ? 'Đã thả hợp âm; âm vang đang ngân.' : 'Đã thả hợp âm; âm đã ngắt.');
    };
    button.addEventListener('pointerup', releasePointer);
    button.addEventListener('pointercancel', releasePointer);
    button.addEventListener('lostpointercapture', releasePointer);
    button.addEventListener('click', event => {
      if (event.detail !== 0) return;
      setChord({ root: button.dataset.root, playPreview: false });
      playSingleChord(makeChord());
    });
  });
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
  el('jam-reverb-toggle').addEventListener('click', () => setReverb(!state.reverb));
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
    syncKeyboardChord();
  });

  document.addEventListener('keyup', event => {
    if (!view.classList.contains('active')) return;
    const token = keyboardToken(event);
    if (!token || !state.pressed.has(token)) return;
    event.preventDefault();
    state.pressed.delete(token);
    state.gesture.delete(token);
    if (isOverlayOpen()) {
      releaseHeldChord('keyboard');
      el('jam-keyboard-feedback').textContent = 'Đã ngắt hợp âm khi một cửa sổ đang mở.';
    } else syncKeyboardChord();
  });

  const viewObserver = new MutationObserver(() => {
    if (!view.classList.contains('active')) {
      if (state.playing) stop({ silent: true });
      else releaseHeldChord();
      clearGesture();
    }
  });
  viewObserver.observe(view, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (state.playing) stop({ silent: true });
      else releaseHeldChord();
    }
  });
  window.addEventListener('blur', () => {
    state.pressed.clear();
    state.gesture.clear();
    releaseHeldChord();
  });

  updateSettingsUI();
  updateChordDisplay();
  updatePlayButton();
})();
