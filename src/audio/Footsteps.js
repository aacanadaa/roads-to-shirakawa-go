import { BLOCK } from '../world/blocks.js';
import { clamp } from '../utils.js';

const SURFACES = {
  grass: { type: 'bandpass', freq: 780, q: 0.9, gain: 0.16, decay: 0.1, rate: 1.0 },
  gravel: { type: 'highpass', freq: 1500, q: 0.7, gain: 0.2, decay: 0.13, rate: 1.12 },
  stone: { type: 'bandpass', freq: 1150, q: 1.4, gain: 0.15, decay: 0.08, rate: 0.94 },
  wood: { type: 'bandpass', freq: 420, q: 1.8, gain: 0.19, decay: 0.11, rate: 0.82 },
  road: { type: 'lowpass', freq: 620, q: 0.6, gain: 0.15, decay: 0.09, rate: 0.9 },
  snow: { type: 'highpass', freq: 2400, q: 0.5, gain: 0.13, decay: 0.14, rate: 1.25 },
  water: { type: 'bandpass', freq: 950, q: 0.8, gain: 0.26, decay: 0.22, rate: 1.2 },
  dirt: { type: 'lowpass', freq: 520, q: 0.8, gain: 0.16, decay: 0.1, rate: 0.95 },
};

const BLOCK_SURFACE = {
  [BLOCK.GRASS]: 'grass',
  [BLOCK.DIRT]: 'dirt',
  [BLOCK.STONE]: 'stone',
  [BLOCK.GRAVEL]: 'gravel',
  [BLOCK.ROAD]: 'road',
  [BLOCK.WOOD]: 'wood',
  [BLOCK.THATCH]: 'wood',
  [BLOCK.PINE]: 'grass',
  [BLOCK.MAPLE]: 'grass',
  [BLOCK.WATER]: 'water',
  [BLOCK.SNOW]: 'snow',
  [BLOCK.LANTERN]: 'stone',
  [BLOCK.SAND]: 'gravel',
  [BLOCK.TRUNK]: 'wood',
  [BLOCK.BEDROCK]: 'stone',
  [BLOCK.BAMBOO]: 'grass',
  [BLOCK.BIRCH]: 'wood',
  [BLOCK.BIRCH_LEAF]: 'grass',
  [BLOCK.MOSSY_STONE]: 'stone',
  [BLOCK.COBBLE]: 'gravel',
  [BLOCK.SHOJI]: 'wood',
};

export class Footsteps {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.enabled = true;
  }

  start(sharedCtx) {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    try {
      this.ctx = sharedCtx || (AudioContextClass ? new AudioContextClass() : null);
      if (!this.ctx) return;
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
      this.noiseBuffer = this.createNoise(this.ctx, 1);
    } catch (err) {
      this.ctx = null;
    }
  }

  createNoise(ctx, seconds) {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  surfaceForBlock(blockId) {
    return BLOCK_SURFACE[blockId] ?? 'dirt';
  }

  play(surfaceName, intensity = 1) {
    if (!this.ctx || !this.noiseBuffer || !this.enabled) return;
    const preset = SURFACES[surfaceName] ?? SURFACES.dirt;
    const t = this.ctx.currentTime;

    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.playbackRate.value = preset.rate * (0.92 + Math.random() * 0.16);

    const filter = this.ctx.createBiquadFilter();
    filter.type = preset.type;
    filter.frequency.value = preset.freq * (0.9 + Math.random() * 0.2);
    filter.Q.value = preset.q;

    const gain = this.ctx.createGain();
    const peak = preset.gain * clamp(intensity, 0.35, 1.4);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.001), t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + preset.decay);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(t);
    source.stop(t + preset.decay + 0.05);
  }
}
