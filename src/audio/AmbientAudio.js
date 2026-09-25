import { CONFIG } from '../config.js';
import { clamp } from '../utils.js';

export class AmbientAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.windGain = null;
    this.streamGain = null;
    this.started = false;
    this.muted = false;
    this.streamLevel = 0.35;
    this.targetStreamLevel = 0.35;
    this.targetWindLevel = 0.5;
    this.windLevel = 0.5;
  }

  start() {
    if (this.started) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    try {
      const ctx = new AudioContextClass();
      this.ctx = ctx;

      this.master = ctx.createGain();
      this.master.gain.value = CONFIG.audio.masterVolume;
      this.master.connect(ctx.destination);

      const noiseBuffer = this.createNoiseBuffer(ctx, 4);

      // --- wind: slow filtered noise ------------------------------------
      const windSource = ctx.createBufferSource();
      windSource.buffer = noiseBuffer;
      windSource.loop = true;

      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.value = 420;
      windFilter.Q.value = 0.6;

      this.windGain = ctx.createGain();
      this.windGain.gain.value = 0.0;

      const windLfo = ctx.createOscillator();
      windLfo.type = 'sine';
      windLfo.frequency.value = 0.045;
      const windLfoGain = ctx.createGain();
      windLfoGain.gain.value = 190;
      windLfo.connect(windLfoGain);
      windLfoGain.connect(windFilter.frequency);
      windLfo.start();

      const windTremolo = ctx.createOscillator();
      windTremolo.type = 'sine';
      windTremolo.frequency.value = 0.03;
      const windTremoloGain = ctx.createGain();
      windTremoloGain.gain.value = 0.16;
      windTremolo.connect(windTremoloGain);
      windTremoloGain.connect(this.windGain.gain);
      windTremolo.start();

      windSource.connect(windFilter);
      windFilter.connect(this.windGain);
      this.windGain.connect(this.master);
      windSource.start();

      // --- stream: bright bandpassed noise with shimmer -----------------
      const streamSource = ctx.createBufferSource();
      streamSource.buffer = noiseBuffer;
      streamSource.loop = true;
      streamSource.playbackRate.value = 1.17;

      const streamFilter = ctx.createBiquadFilter();
      streamFilter.type = 'bandpass';
      streamFilter.frequency.value = 1250;
      streamFilter.Q.value = 0.85;

      const streamFilter2 = ctx.createBiquadFilter();
      streamFilter2.type = 'highshelf';
      streamFilter2.frequency.value = 2400;
      streamFilter2.gain.value = 5;

      this.streamGain = ctx.createGain();
      this.streamGain.gain.value = 0.0;

      const streamLfo = ctx.createOscillator();
      streamLfo.type = 'sine';
      streamLfo.frequency.value = 0.19;
      const streamLfoGain = ctx.createGain();
      streamLfoGain.gain.value = 320;
      streamLfo.connect(streamLfoGain);
      streamLfoGain.connect(streamFilter.frequency);
      streamLfo.start();

      streamSource.connect(streamFilter);
      streamFilter.connect(streamFilter2);
      streamFilter2.connect(this.streamGain);
      this.streamGain.connect(this.master);
      streamSource.start();

      // --- distant waterfall bed ----------------------------------------
      const fallsSource = ctx.createBufferSource();
      fallsSource.buffer = noiseBuffer;
      fallsSource.loop = true;
      fallsSource.playbackRate.value = 0.42;
      const fallsFilter = ctx.createBiquadFilter();
      fallsFilter.type = 'lowpass';
      fallsFilter.frequency.value = 220;
      const fallsGain = ctx.createGain();
      fallsGain.gain.value = 0.16;
      fallsSource.connect(fallsFilter);
      fallsFilter.connect(fallsGain);
      fallsGain.connect(this.master);
      fallsSource.start();

      this.started = true;
      if (ctx.state === 'suspended') ctx.resume();
    } catch (err) {
      this.ctx = null;
      this.started = false;
    }
  }

  createNoiseBuffer(ctx, seconds) {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = buffer.getChannelData(channel);
      let last = 0;
      for (let i = 0; i < length; i += 1) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = white * 0.55 + last * 2.4;
      }
    }
    return buffer;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setStreamProximity(level) {
    this.targetStreamLevel = clamp(level, 0, 1);
  }

  setWindLevel(level) {
    this.targetWindLevel = clamp(level, 0, 1);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(
        this.muted ? 0 : CONFIG.audio.masterVolume,
        this.ctx.currentTime,
        0.08
      );
    }
    return this.muted;
  }

  update(dt) {
    if (!this.started || this.muted) return;
    this.streamLevel += (this.targetStreamLevel - this.streamLevel) * Math.min(1, dt * 1.5);
    this.windLevel += (this.targetWindLevel - this.windLevel) * Math.min(1, dt * 1.5);
    const t = this.ctx.currentTime;
    this.streamGain.gain.setTargetAtTime(0.03 + this.streamLevel * 0.16, t, 0.25);
    this.windGain.gain.setTargetAtTime(0.02 + this.windLevel * 0.07, t, 0.35);
  }
}
