// Procedural Web Audio API Sound Engine (Zero External Audio Assets)
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.masterGain = null;
    this.oceanGain = null;
    this.rainGain = null;
    this.noiseBuffer = null;
    this.seagullTimer = 4;
    this.crackleTimer = 0.5;
  }

  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.0;
    this.masterGain.connect(this.ctx.destination);

    // Reusable 3-second noise buffer
    const sr = this.ctx.sampleRate;
    const length = sr * 3;
    this.noiseBuffer = this.ctx.createBuffer(1, length, sr);
    const data = this.noiseBuffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      // Soft pink-ish brownian blend for warm ocean surf
      last = (last + 0.04 * white) / 1.04;
      data[i] = last * 3.2;
    }

    // 1. Continuous gentle ocean waves loop
    const oceanSrc = this.ctx.createBufferSource();
    oceanSrc.buffer = this.noiseBuffer;
    oceanSrc.loop = true;

    const oceanFilter = this.ctx.createBiquadFilter();
    oceanFilter.type = 'lowpass';
    oceanFilter.frequency.value = 380;

    this.oceanGain = this.ctx.createGain();
    this.oceanGain.gain.value = 0.16;

    // Tidal swell LFO
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 170;
    lfo.connect(lfoGain);
    lfoGain.connect(oceanFilter.frequency);
    lfo.start();

    oceanSrc.connect(oceanFilter);
    oceanFilter.connect(this.oceanGain);
    this.oceanGain.connect(this.masterGain);
    oceanSrc.start();

    // 2. Rain hiss layer (silent unless weather is rain/storm)
    const rainBuf = this.ctx.createBuffer(1, sr * 2, sr);
    const rData = rainBuf.getChannelData(0);
    for (let i = 0; i < rData.length; i++) rData[i] = Math.random() * 2 - 1;

    const rainSrc = this.ctx.createBufferSource();
    rainSrc.buffer = rainBuf;
    rainSrc.loop = true;

    const rainFilter = this.ctx.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.value = 1900;
    rainFilter.Q.value = 0.6;

    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.value = 0.0;

    rainSrc.connect(rainFilter);
    rainFilter.connect(this.rainGain);
    this.rainGain.connect(this.masterGain);
    rainSrc.start();
  }

  toggle() {
    this.init();
    if (!this.ctx) return false;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.enabled = !this.enabled;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.linearRampToValueAtTime(this.enabled ? 0.55 : 0.0, now + 0.35);
    if (this.enabled) this.playBrickSnap();
    return this.enabled;
  }

  updateAmbient(dt, weather, nightFactor) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Rain volume tracks weather
    const targetRain = weather === 'storm' ? 0.14 : weather === 'rain' ? 0.08 : 0.0;
    this.rainGain.gain.setTargetAtTime(targetRain, now, 0.4);

    // Occasional daytime seagull cry
    if (nightFactor < 0.45 && weather === 'clear') {
      this.seagullTimer -= dt;
      if (this.seagullTimer <= 0) {
        this.seagullTimer = 7 + Math.random() * 10;
        this.playSeagull();
      }
    }

    // Nighttime subtle campfire crackle
    if (nightFactor > 0.3) {
      this.crackleTimer -= dt;
      if (this.crackleTimer <= 0) {
        this.crackleTimer = 0.25 + Math.random() * 0.65;
        this.playCampfirePop();
      }
    }
  }

  playSeagull() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    const base = 1350 + Math.random() * 280;
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.25, now + 0.11);
    osc.frequency.exponentialRampToValueAtTime(base * 0.72, now + 0.38);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.032, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.45);
  }

  playCampfirePop() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(180 + Math.random() * 420, now);
    gain.gain.setValueAtTime(0.015, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  // Crisp plastic LEGO brick "CLICK"
  playBrickSnap() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(920, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.045);

    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  playBrickRemove() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.07);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.085);
  }

  playFireworkBoom() {
    if (!this.enabled || !this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(950, now);
    filter.frequency.exponentialRampToValueAtTime(120, now + 0.55);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.62);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.65);
  }

  playThunder() {
    if (!this.enabled || !this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220, now);
    filter.frequency.linearRampToValueAtTime(65, now + 1.9);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.42, now + 0.14);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(now);
    src.stop(now + 2.3);
  }

  playTreasureFanfare() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.095;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  playBoatHorn() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    [146.8, 220.0].forEach((freq) => {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      filter.type = 'lowpass';
      filter.frequency.value = 520;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.14, now + 0.08);
      gain.gain.setValueAtTime(0.14, now + 0.48);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.72);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.75);
    });
  }
}
