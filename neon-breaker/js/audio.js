/* NEON BREAKER — audio.js
 * Kompletter Sound per WebAudio: Sound-Effekte + Musik-Sequencer,
 * alles synthetisiert, keine Audiodateien nötig.
 */
'use strict';
window.NB = window.NB || {};

NB.audio = (() => {
  let ctx = null;
  let master = null, sfxBus = null, musicBus = null, delaySend = null;
  let noiseBuf = null;

  let sfxOn = true, musicOn = true;
  try {
    sfxOn = localStorage.getItem('nb_sfx') !== '0';
    musicOn = localStorage.getItem('nb_music') !== '0';
  } catch (e) { /* Speicher gesperrt: Standardwerte behalten */ }

  const midi2freq = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function ensureCtx() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();

    master = ctx.createGain();
    master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 20;
    comp.ratio.value = 8;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    master.connect(comp);
    comp.connect(ctx.destination);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = sfxOn ? 1 : 0;
    sfxBus.connect(master);

    musicBus = ctx.createGain();
    musicBus.gain.value = musicOn ? 1 : 0;
    musicBus.connect(master);

    // Echo-Effekt für Musik-Lead und Fanfaren
    delaySend = ctx.createGain();
    delaySend.gain.value = 1;
    const delay = ctx.createDelay(1.0);
    delay.delayTime.value = 0.34;
    const fb = ctx.createGain();
    fb.gain.value = 0.38;
    const wet = ctx.createGain();
    wet.gain.value = 0.3;
    delaySend.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(wet);
    wet.connect(musicBus);

    // 1 Sekunde weißes Rauschen, wiederverwendet für alle Noise-Sounds
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return true;
  }

  // Bei der ersten Nutzergeste aufrufen (Browser-Autoplay-Sperre)
  function unlock() {
    if (!ensureCtx()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (musicOn && !seq.running) seq.start();
  }

  // ---- SFX-Bausteine -------------------------------------------------

  function tone({ freq = 440, freqEnd = null, type = 'sine', dur = 0.15,
                  gain = 0.2, attack = 0.002, when = 0, bus = null,
                  filterFreq = null, filterType = 'lowpass' }) {
    if (!ctx || (!sfxOn && (bus || sfxBus) === sfxBus)) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = osc;
    if (filterFreq) {
      const f = ctx.createBiquadFilter();
      f.type = filterType;
      f.frequency.value = filterFreq;
      osc.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(bus || sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise({ dur = 0.2, gain = 0.2, when = 0, filterFreq = 1000,
                   filterType = 'lowpass', filterEnd = null, q = 0.8, bus = null }) {
    if (!ctx || (!sfxOn && (bus || sfxBus) === sfxBus)) return;
    const t0 = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    src.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.setValueAtTime(filterFreq, t0);
    if (filterEnd != null) f.frequency.exponentialRampToValueAtTime(Math.max(20, filterEnd), t0 + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(bus || sfxBus);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  // ---- Konkrete Sound-Effekte ---------------------------------------

  const sfx = {
    click() {
      tone({ freq: 700, freqEnd: 900, type: 'square', dur: 0.05, gain: 0.08, filterFreq: 2200 });
    },
    hover() {
      tone({ freq: 500, type: 'sine', dur: 0.04, gain: 0.04 });
    },
    paddle(offset) {
      // offset -1..1: Tonhöhe je nach Trefferpunkt auf dem Paddle
      const f = 200 + Math.abs(offset) * 90;
      tone({ freq: f, type: 'sine', dur: 0.09, gain: 0.22 });
      tone({ freq: 90, type: 'sine', dur: 0.08, gain: 0.18 });
    },
    wall() {
      tone({ freq: 170 + Math.random() * 30, type: 'triangle', dur: 0.06, gain: 0.1 });
    },
    brick(combo) {
      const step = Math.min(combo, 14);
      const f = 420 * Math.pow(2, step / 14);
      tone({ freq: f, type: 'square', dur: 0.1, gain: 0.13, filterFreq: 3200 });
      tone({ freq: f * 1.5, type: 'sine', dur: 0.14, gain: 0.08 });
      noise({ dur: 0.08, gain: 0.1, filterFreq: 3000, filterType: 'highpass' });
    },
    tough() {
      tone({ freq: 300, freqEnd: 240, type: 'square', dur: 0.07, gain: 0.11, filterFreq: 1500 });
      noise({ dur: 0.05, gain: 0.07, filterFreq: 1800, filterType: 'bandpass', q: 2 });
    },
    steel() {
      tone({ freq: 1250 + Math.random() * 200, type: 'sine', dur: 0.05, gain: 0.1 });
      noise({ dur: 0.04, gain: 0.06, filterFreq: 6000, filterType: 'highpass' });
    },
    explosion() {
      noise({ dur: 0.55, gain: 0.4, filterFreq: 900, filterEnd: 60, q: 0.5 });
      tone({ freq: 160, freqEnd: 36, type: 'sine', dur: 0.5, gain: 0.35 });
      tone({ freq: 90, freqEnd: 30, type: 'triangle', dur: 0.4, gain: 0.2, when: 0.02 });
    },
    powerup() {
      [523, 659, 784, 1047].forEach((f, i) =>
        tone({ freq: f, type: 'triangle', dur: 0.12, gain: 0.12, when: i * 0.055 }));
    },
    laser() {
      tone({ freq: 950, freqEnd: 240, type: 'square', dur: 0.12, gain: 0.07, filterFreq: 2600 });
    },
    launch() {
      tone({ freq: 240, freqEnd: 520, type: 'sine', dur: 0.14, gain: 0.14 });
      noise({ dur: 0.12, gain: 0.05, filterFreq: 800, filterEnd: 3200, filterType: 'bandpass', q: 1.5 });
    },
    sticky() {
      tone({ freq: 340, freqEnd: 260, type: 'sine', dur: 0.1, gain: 0.14 });
    },
    shield() {
      tone({ freq: 70, freqEnd: 140, type: 'sine', dur: 0.3, gain: 0.3 });
      noise({ dur: 0.2, gain: 0.1, filterFreq: 500, filterType: 'lowpass' });
    },
    lifeLost() {
      tone({ freq: 420, freqEnd: 70, type: 'sawtooth', dur: 0.7, gain: 0.18, filterFreq: 1200 });
      noise({ dur: 0.4, gain: 0.12, filterFreq: 600, filterEnd: 80 });
    },
    levelClear() {
      const notes = [523, 659, 784, 1047, 1319];
      notes.forEach((f, i) =>
        tone({ freq: f, type: 'triangle', dur: 0.24, gain: 0.14, when: i * 0.09, bus: delaySend }));
    },
    gameOver() {
      const notes = [330, 262, 220, 165];
      notes.forEach((f, i) =>
        tone({ freq: f, type: 'triangle', dur: 0.5, gain: 0.15, when: i * 0.28 }));
    },
    win() {
      const notes = [523, 659, 784, 1047, 784, 1047, 1319, 1568];
      notes.forEach((f, i) =>
        tone({ freq: f, type: 'triangle', dur: 0.3, gain: 0.14, when: i * 0.12, bus: delaySend }));
      noise({ dur: 1.2, gain: 0.06, filterFreq: 6000, filterType: 'highpass', when: 0.1 });
    },
  };

  // ---- Musik-Sequencer ----------------------------------------------
  // Akkordfolge Am – F – C – G, Achtel-Arpeggio mit Echo, Bass und Hi-Hat.
  // Intensität (0..1) öffnet den Filter und macht die Hats lauter.

  const seq = {
    running: false,
    step: 0,
    nextTime: 0,
    timer: null,
    intensity: 0,
    targetIntensity: 0,
    bpm: 112,
    chords: [
      { root: 57, iv: [0, 3, 7, 12] },   // Am
      { root: 53, iv: [0, 4, 7, 12] },   // F
      { root: 60, iv: [0, 4, 7, 12] },   // C
      { root: 55, iv: [0, 4, 7, 12] },   // G
    ],
    pattern: [0, 2, 3, 2, 1, 2, 3, 2],

    start() {
      if (!ensureCtx() || this.running) return;
      this.running = true;
      this.step = 0;
      this.nextTime = ctx.currentTime + 0.06;
      this.timer = setInterval(() => this.tick(), 30);
    },
    stop() {
      this.running = false;
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
    },
    setIntensity(v) { this.targetIntensity = Math.max(0, Math.min(1, v)); },

    tick() {
      if (!ctx || !this.running) return;
      const eighth = 60 / this.bpm / 2;
      while (this.nextTime < ctx.currentTime + 0.14) {
        this.playStep(this.step, this.nextTime);
        this.nextTime += eighth;
        this.step = (this.step + 1) % 32;   // 4 Takte à 8 Achtel
      }
    },

    playStep(step, t) {
      if (!musicOn) return;
      this.intensity += (this.targetIntensity - this.intensity) * 0.12;
      const inten = this.intensity;
      const chord = this.chords[(step >> 3) & 3];
      const s8 = step & 7;

      // Arpeggio-Lead
      const iv = chord.iv[this.pattern[s8]];
      const freq = midi2freq(chord.root + iv + 12);
      const cutoff = 500 + inten * 2800;
      const when = t - ctx.currentTime;
      tone({
        freq, type: 'triangle', dur: 0.22, gain: 0.055 + inten * 0.03,
        when, bus: delaySend, filterFreq: cutoff,
      });

      // Bass auf Schlag 1 und 3
      if (s8 === 0 || s8 === 4) {
        tone({
          freq: midi2freq(chord.root - 12), type: 'sine', dur: 0.42,
          gain: 0.16, when, bus: musicBus,
        });
      }
      // Offbeat-Hats, bei hoher Intensität auf jedem Step
      if (s8 === 2 || s8 === 6 || inten > 0.55) {
        noise({
          dur: 0.03, gain: 0.015 + inten * 0.03, when,
          filterFreq: 7000, filterType: 'highpass', bus: musicBus,
        });
      }
      // Sanfter Kick bei Intensität
      if ((s8 === 0 || s8 === 4) && inten > 0.35) {
        tone({ freq: 110, freqEnd: 45, type: 'sine', dur: 0.12, gain: 0.1 * inten, when, bus: musicBus });
      }
    },
  };

  // ---- Öffentliche API ----------------------------------------------

  function setSfxOn(b) {
    sfxOn = b;
    try { localStorage.setItem('nb_sfx', b ? '1' : '0'); } catch (e) { /* egal */ }
    if (sfxBus) sfxBus.gain.value = b ? 1 : 0;
  }
  function setMusicOn(b) {
    musicOn = b;
    try { localStorage.setItem('nb_music', b ? '1' : '0'); } catch (e) { /* egal */ }
    if (musicBus) musicBus.gain.value = b ? 1 : 0;
    if (b) { if (ctx) seq.start(); } else seq.stop();
  }

  return {
    unlock, sfx,
    music: seq,
    setSfxOn, setMusicOn,
    get sfxOn() { return sfxOn; },
    get musicOn() { return musicOn; },
  };
})();
