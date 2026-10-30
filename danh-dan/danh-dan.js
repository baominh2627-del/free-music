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
  const sectionKeys = [
    { key: '1', id: 'intro', name: 'Mở đầu', defaultBars: 2, intensity: 0.64 },
    { key: '2', id: 'verse', name: 'Phiên khúc', defaultBars: 4, intensity: 0.72 },
    { key: '3', id: 'prechorus', name: 'Tiền điệp khúc', defaultBars: 2, intensity: 0.84 },
    { key: '4', id: 'chorus', name: 'Điệp khúc', defaultBars: 4, intensity: 1 },
    { key: '5', id: 'bridge', name: 'Cầu nối', defaultBars: 4, intensity: 0.76 },
    { key: '6', id: 'instrumental', name: 'Dạo nhạc', defaultBars: 4, intensity: 0.86 },
    { key: '7', id: 'fill', name: 'Câu nhạc nối', defaultBars: 1, intensity: 0.94 },
    { key: '8', id: 'outro', name: 'Kết', defaultBars: 2, intensity: 0.62 }
  ];
  const sectionsById = Object.fromEntries(sectionKeys.map(section => [section.id, section]));
  const accompanimentModes = ['strum', 'arpeggio', 'bassChord'];
  const transitionModes = ['fill', 'direct', 'break', 'stop', 'swell'];
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
    accompaniment: accompanimentModes.includes(saved.accompaniment) ? saved.accompaniment : 'strum',
    variation: Boolean(saved.variation),
    dynamics: Number.isFinite(Number(saved.dynamics)) ? Math.max(20, Math.min(100, Number(saved.dynamics))) : 75,
    transition: transitionModes.includes(saved.transition) ? saved.transition : 'fill',
    sequence: Array.isArray(saved.sequence) ? saved.sequence.slice(0, 32).flatMap(item => {
      if (!item || !Object.hasOwn(sectionsById, item.section)) return [];
      const section = sectionsById[item.section];
      return [{ section: section.id, bars: Math.max(1, Math.min(16, Math.round(Number(item.bars) || section.defaultBars))) }];
    }) : [],
    arrangementPlayback: false,
    sequenceIndex: 0,
    sectionBars: 0,
    barCount: 0,
    nextSectionAccent: false,
    arpeggioIndex: 0,
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
    pendingSevenSection: false,
    gestureHadChord: false,
    voices: new Set(),
    heldVoices: [],
    heldSource: null,
    heldChord: null
  };

  function savePrefs() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ root: state.root, accidental: state.accidental, quality: state.quality, rhythm: state.rhythm, instrument: state.instrument, theme: state.theme, reverb: state.reverb, accompaniment: state.accompaniment, variation: state.variation, dynamics: state.dynamics, transition: state.transition, sequence: state.sequence, bpm: state.bpm }));
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
    el('jam-pattern').value = state.accompaniment;
    el('jam-transition').value = state.transition;
    el('jam-tempo').value = String(state.bpm);
    el('jam-dynamics').value = String(state.dynamics);
    el('jam-dynamics-value').value = `${state.dynamics}%`;
    el('jam-dynamics-value').textContent = `${state.dynamics}%`;
    workspace.dataset.jamTheme = state.theme;
    el('jam-reverb-toggle').setAttribute('aria-pressed', String(state.reverb));
    el('jam-variation-toggle').setAttribute('aria-pressed', String(state.variation));
    el('jam-variation-toggle').textContent = state.variation ? 'Bật biến tấu' : 'Tắt biến tấu';
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
    renderArrangement();
  }

  function updateMeter(activeBeat = -1) {
    const beats = rhythms[state.rhythm].beats;
    [...el('jam-beat-meter').children].forEach((dot, index) => {
      dot.hidden = index >= beats;
      dot.classList.toggle('active', index === activeBeat);
    });
  }

  function renderArrangement() {
    const sequence = el('jam-arrangement-sequence');
    sequence.innerHTML = state.sequence.map((item, index) => {
      const section = sectionsById[item.section];
      const active = state.arrangementPlayback && index === state.sequenceIndex;
      return `<div class="jam-arrangement-item${active ? ' jam-arrangement-current' : ''}">
        <span class="jam-arrangement-order">${String(index + 1).padStart(2, '0')}</span>
        <span class="jam-arrangement-section"><b>${section.name}</b><small>Phím ${section.key}</small></span>
        <span class="jam-arrangement-bars"><button type="button" data-sequence-bars="-1" data-index="${index}" aria-label="Giảm ô nhịp"${item.bars <= 1 || state.playing ? ' disabled' : ''}>−</button><b>${item.bars} ô</b><button type="button" data-sequence-bars="1" data-index="${index}" aria-label="Tăng ô nhịp"${item.bars >= 16 || state.playing ? ' disabled' : ''}>＋</button></span>
        <span class="jam-arrangement-move"><button type="button" data-sequence-move="-1" data-index="${index}" aria-label="Chuyển lên"${index === 0 || state.playing ? ' disabled' : ''}>↑</button><button type="button" data-sequence-move="1" data-index="${index}" aria-label="Chuyển xuống"${index === state.sequence.length - 1 || state.playing ? ' disabled' : ''}>↓</button></span>
        <button type="button" class="jam-arrangement-remove" data-sequence-remove="${index}" data-index="${index}" aria-label="Xóa ${section.name}"${state.playing ? ' disabled' : ''}>×</button>
      </div>`;
    }).join('');
    el('jam-arrangement-empty').hidden = state.sequence.length > 0;
    const totalBars = state.sequence.reduce((sum, item) => sum + item.bars, 0);
    el('jam-arrangement-count').textContent = `${state.sequence.length} phần · ${totalBars} ô nhịp`;
    el('jam-arrangement-undo').disabled = !state.sequence.length || state.playing;
    el('jam-arrangement-clear').disabled = !state.sequence.length || state.playing;
    el('jam-arrangement-play').disabled = !state.sequence.length || state.playing;
    view.querySelectorAll('[data-arrangement-key]').forEach(button => { button.disabled = state.playing || state.sequence.length >= 32; });
    if (state.arrangementPlayback) {
      const item = state.sequence[state.sequenceIndex];
      const section = item && sectionsById[item.section];
      el('jam-arrangement-status').textContent = section ? `Đang phát ${section.name} · ô nhịp ${state.sectionBars + 1}/${item.bars}.` : '';
    } else if (state.sequence.length) {
      el('jam-arrangement-status').textContent = `Sẵn sàng: ${state.sequence.map(item => sectionsById[item.section].name).join(' → ')}.`;
    } else {
      el('jam-arrangement-status').textContent = 'Chưa có trình tự phối khí.';
    }
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
    const peak = Math.max(0.0002, 0.105 * strength * (state.dynamics / 100) * currentSectionIntensity());
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
    if (state.accompaniment === 'arpeggio' && direction !== 'pick') {
      const note = notes[state.arpeggioIndex % notes.length];
      state.arpeggioIndex += 1;
      playVoice(midiFrequency(note), at, strength * 0.9, state.instrument);
      return;
    }
    if (direction === 'pick') {
      const note = notes[Math.floor(state.stepPosition * 4) % notes.length];
      playVoice(midiFrequency(note), at, strength * 0.9, state.instrument);
      return;
    }
    const spread = state.instrument === 'piano' ? 0.008 : 0.016;
    notes.forEach((note, index) => playVoice(midiFrequency(note), at + index * spread, strength * (index === 0 ? 1 : 0.78), state.instrument));
    void context;
  }

  function currentSectionIntensity() {
    if (!state.arrangementPlayback) return 1;
    const item = state.sequence[state.sequenceIndex];
    return item ? sectionsById[item.section].intensity : 1;
  }

  function currentTransitionWindow(pattern) {
    const item = state.sequence[state.sequenceIndex];
    const hasNext = state.arrangementPlayback && state.sequenceIndex < state.sequence.length - 1;
    const isLastBar = item && state.sectionBars === item.bars - 1;
    const finalBeat = state.stepPosition >= pattern.beats - 1;
    return { active: Boolean(hasNext && isLastBar && finalBeat), hasNext, isLastBar };
  }

  function playAccompanimentHit(hit, at, strength) {
    if (state.accompaniment === 'bassChord' && Number.isInteger(hit.beat) && hit.beat % 2 === 0) {
      const baseMidi = state.instrument === 'guitar' ? 48 : 60;
      playVoice(midiFrequency(Math.max(36, baseMidi - 12 + state.chord.pitchClass)), at, strength * 0.95, state.instrument);
      strum(state.chord, at + 0.035, hit.direction, strength * 0.62);
      return;
    }
    strum(state.chord, at, hit.direction, strength);
  }

  function finishArrangementBar() {
    state.barCount += 1;
    if (!state.arrangementPlayback) return true;
    const item = state.sequence[state.sequenceIndex];
    if (!item) return true;
    state.sectionBars += 1;
    if (state.sectionBars < item.bars) {
      renderArrangement();
      return true;
    }
    if (state.sequenceIndex >= state.sequence.length - 1) {
      state.arrangementPlayback = false;
      stop({ silent: true });
      renderArrangement();
      setStatus('Đã phát xong trình tự phối khí.');
      return false;
    }
    state.sequenceIndex += 1;
    state.sectionBars = 0;
    state.nextSectionAccent = state.transition === 'stop';
    state.arpeggioIndex = 0;
    renderArrangement();
    setStatus(`Chuyển sang ${sectionsById[state.sequence[state.sequenceIndex].section].name}.`);
    return true;
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
      const position = state.stepPosition;
      const transition = currentTransitionWindow(pattern);
      const fillTransition = transition.active && state.transition === 'fill';
      const quietTransition = transition.active && ['break', 'stop'].includes(state.transition);
      if (fillTransition) {
        strum(state.chord, state.nextStepAt, 'pick', 0.72);
      } else if (!quietTransition) {
        const hit = pattern.hits.find(item => Math.abs(item.beat - position) < 0.001);
        if (hit) {
          const activeBar = state.arrangementPlayback ? state.sectionBars : state.barCount;
          let direction = hit.direction;
          if (state.variation && activeBar % 2 === 1) {
            if (direction === 'down') direction = 'up';
            else if (direction === 'up') direction = 'down';
          }
          let strength = hit.strength;
          if (transition.active && state.transition === 'swell') strength *= 0.55 + (position - (pattern.beats - 1)) * 0.45;
          if (state.nextSectionAccent && hit.beat === 0) {
            strength *= 1.35;
            state.nextSectionAccent = false;
          }
          playAccompanimentHit({ ...hit, direction }, state.nextStepAt, strength);
          pulseBeat(Math.min(pattern.beats - 1, Math.floor(hit.beat)));
        }
      }
      state.stepPosition += 0.25;
      if (state.stepPosition >= pattern.beats) {
        state.stepPosition = 0;
        if (!finishArrangementBar()) {
          state.nextStepAt += stepDuration;
          break;
        }
      }
      state.nextStepAt += stepDuration;
    }
  }

  async function start({ arrangement = false } = {}) {
    if (state.playing) return;
    if (arrangement && !state.sequence.length) {
      setStatus('Thêm các phần bằng phím 1–8 rồi chạy trình tự phối khí.');
      return;
    }
    try {
      const context = audioContext();
      await context.resume();
      state.playing = true;
      state.arrangementPlayback = arrangement && state.sequence.length > 0;
      state.sequenceIndex = 0;
      state.sectionBars = 0;
      state.barCount = 0;
      state.nextSectionAccent = false;
      state.arpeggioIndex = 0;
      state.chord = makeChord();
      state.pendingChord = null;
      state.stepPosition = 0;
      state.nextStepAt = context.currentTime + 0.045;
      state.timer = window.setInterval(scheduleWindow, 24);
      scheduleWindow();
      updatePlayButton();
      updateChordDisplay();
      renderArrangement();
      if (state.arrangementPlayback) setStatus(`Bắt đầu ${sectionsById[state.sequence[0].section].name} · ${state.chord.name}.`);
      else setStatus(`${rhythms[state.rhythm].label} · ${state.bpm} BPM · ${state.chord.name}`);
    } catch (error) {
      setStatus(error.message || 'Không khởi tạo được âm thanh.');
    }
  }

  function stop({ silent = false } = {}) {
    if (state.timer) window.clearInterval(state.timer);
    state.timer = null;
    state.playing = false;
    state.arrangementPlayback = false;
    state.sequenceIndex = 0;
    state.sectionBars = 0;
    state.barCount = 0;
    state.nextSectionAccent = false;
    if (state.pendingChord) state.chord = state.pendingChord;
    state.pendingChord = null;
    state.heldVoices = [];
    state.heldSource = null;
    state.heldChord = null;
    state.pressed.clear();
    state.gesture.clear();
    state.pendingSevenSection = false;
    state.gestureHadChord = false;
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
    renderArrangement();
    if (!silent) setStatus('Đã dừng phần đệm. Giữ hợp âm để phát thử.');
  }

  function updatePlayButton() {
    const button = el('jam-play-toggle');
    button.setAttribute('aria-pressed', String(state.playing));
    button.classList.toggle('playing', state.playing);
    button.querySelector('span:first-child').textContent = state.playing ? 'Ⅱ' : '▶';
    button.querySelector('span:last-child').textContent = state.playing ? 'Dừng điệu' : 'Chạy điệu';
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

  function appendArrangementSection(key) {
    const section = sectionKeys.find(item => item.key === String(key));
    if (!section || state.playing) return;
    if (state.sequence.length >= 32) {
      setStatus('Trình tự đã đủ 32 phần. Hãy xóa bớt một bước để thêm tiếp.');
      return;
    }
    state.sequence.push({ section: section.id, bars: section.defaultBars });
    savePrefs();
    renderArrangement();
    setStatus(`Đã thêm ${section.name} vào bước ${state.sequence.length}.`);
  }

  function editArrangementItem(index, action, amount = 0) {
    if (state.playing || !Number.isInteger(index) || !state.sequence[index]) return;
    if (action === 'remove') state.sequence.splice(index, 1);
    else if (action === 'bars') state.sequence[index].bars = Math.max(1, Math.min(16, state.sequence[index].bars + amount));
    else if (action === 'move') {
      const target = index + amount;
      if (target < 0 || target >= state.sequence.length) return;
      [state.sequence[index], state.sequence[target]] = [state.sequence[target], state.sequence[index]];
    }
    savePrefs();
    renderArrangement();
  }

  function undoArrangement() {
    if (state.playing || !state.sequence.length) return;
    const removed = state.sequence.pop();
    savePrefs();
    renderArrangement();
    setStatus(`Đã xóa ${sectionsById[removed.section].name} ở bước cuối.`);
  }

  function clearArrangement() {
    if (state.playing || !state.sequence.length) return;
    state.sequence = [];
    savePrefs();
    renderArrangement();
    setStatus('Đã xóa trình tự phối khí.');
  }

  function numericArrangementKey(event) {
    const match = String(event.code || '').match(/^(?:Digit|Numpad)([1-8])$/);
    return match?.[1] || null;
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
      if (state.pendingSevenSection && state.pressed.has('7')) el('jam-keyboard-feedback').textContent = 'Giữ 7 rồi thêm nốt gốc để tạo hợp âm bảy; thả riêng 7 để thêm Câu nhạc nối.';
      else if (state.pressed.size) el('jam-keyboard-feedback').textContent = `Đang giữ: ${[...state.pressed].join(' + ')} · chờ nốt gốc.`;
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
    state.pendingSevenSection = false;
    state.gestureHadChord = false;
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
  el('jam-pattern').addEventListener('change', event => {
    if (!accompanimentModes.includes(event.target.value)) return;
    state.accompaniment = event.target.value;
    state.arpeggioIndex = 0;
    savePrefs();
    setStatus(`Đã chọn mẫu đệm: ${event.target.options[event.target.selectedIndex].text}.`);
  });
  el('jam-transition').addEventListener('change', event => {
    if (!transitionModes.includes(event.target.value)) return;
    state.transition = event.target.value;
    savePrefs();
    setStatus(`Kiểu chuyển đoạn: ${event.target.options[event.target.selectedIndex].text}.`);
  });
  el('jam-variation-toggle').addEventListener('click', () => {
    state.variation = !state.variation;
    updateSettingsUI();
    savePrefs();
  });
  el('jam-dynamics').addEventListener('input', event => {
    state.dynamics = Math.max(20, Math.min(100, Number(event.target.value) || 20));
    el('jam-dynamics-value').value = `${state.dynamics}%`;
    el('jam-dynamics-value').textContent = `${state.dynamics}%`;
    savePrefs();
  });
  el('jam-instrument').addEventListener('change', event => {
    state.instrument = event.target.value;
    savePrefs();
  });
  el('jam-tempo').addEventListener('change', event => setTempo(event.target.value || state.bpm));
  el('jam-tempo-down').addEventListener('click', () => setTempo(state.bpm - 5));
  el('jam-tempo-up').addEventListener('click', () => setTempo(state.bpm + 5));
  el('jam-arrangement-keypad').addEventListener('click', event => {
    const button = event.target.closest('[data-arrangement-key]');
    if (button) appendArrangementSection(button.dataset.arrangementKey);
  });
  el('jam-arrangement-sequence').addEventListener('click', event => {
    const button = event.target.closest('button[data-index]');
    if (!button) return;
    const index = Number(button.dataset.index);
    if (button.hasAttribute('data-sequence-bars')) editArrangementItem(index, 'bars', Number(button.dataset.sequenceBars));
    else if (button.hasAttribute('data-sequence-move')) editArrangementItem(index, 'move', Number(button.dataset.sequenceMove));
    else if (button.hasAttribute('data-sequence-remove')) editArrangementItem(index, 'remove');
  });
  el('jam-arrangement-undo').addEventListener('click', undoArrangement);
  el('jam-arrangement-clear').addEventListener('click', clearArrangement);
  el('jam-arrangement-play').addEventListener('click', () => start({ arrangement: true }));

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
    const targetButton = event.target instanceof Element && !!event.target.closest('button');
    const targetArrangementKey = event.target instanceof Element && !!event.target.closest('[data-arrangement-key]');
    if (event.key === 'Enter' && state.sequence.length && !state.playing && !state.pressed.size && (!targetButton || targetArrangementKey)) {
      event.preventDefault();
      if (!event.repeat) start({ arrangement: true });
      return;
    }
    if (event.key === 'Backspace' && state.sequence.length && !state.playing && !state.pressed.size) {
      event.preventDefault();
      if (!event.repeat) undoArrangement();
      return;
    }
    if (event.key === 'Delete' && state.sequence.length && !state.playing && !state.pressed.size) {
      event.preventDefault();
      if (!event.repeat) clearArrangement();
      return;
    }
    const sectionKey = numericArrangementKey(event);
    if (sectionKey && !state.playing && state.pressed.size === 0) {
      event.preventDefault();
      if (!event.repeat && sectionKey === '7') {
        state.pressed.add('7');
        state.gesture.add('7');
        state.pendingSevenSection = true;
        state.gestureHadChord = false;
        syncKeyboardChord();
        return;
      }
      if (!event.repeat) appendArrangementSection(sectionKey);
      return;
    }
    const token = keyboardToken(event);
    if (!token) return;
    event.preventDefault();
    if (event.repeat) return;
    state.pressed.add(token);
    state.gesture.add(token);
    if (Object.hasOwn(rootSemitones, token) || token === 'M') state.gestureHadChord = true;
    syncKeyboardChord();
  });

  document.addEventListener('keyup', event => {
    if (!view.classList.contains('active')) return;
    const token = keyboardToken(event);
    if (!token || !state.pressed.has(token)) return;
    event.preventDefault();
    state.pressed.delete(token);
    state.gesture.delete(token);
    if (!state.pressed.size) {
      const addFillSection = token === '7' && state.pendingSevenSection && !state.gestureHadChord;
      state.pendingSevenSection = false;
      state.gestureHadChord = false;
      if (addFillSection && !isOverlayOpen()) {
        appendArrangementSection('7');
        return;
      }
    }
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
    state.pendingSevenSection = false;
    state.gestureHadChord = false;
    releaseHeldChord();
  });

  updateSettingsUI();
  updateChordDisplay();
  updatePlayButton();
})();
