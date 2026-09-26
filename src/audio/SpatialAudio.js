import * as THREE from 'three';
import { CONFIG } from '../config.js';

function makeNoiseBuffer(ctx, seconds, pink = true) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      if (pink) {
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965164;
        b2 = 0.57555 * b2 + white * 1.0526913;
        data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.16;
      } else {
        data[i] = white * 0.5;
      }
    }
  }
  return buffer;
}

function makeCrackleBuffer(ctx, seconds) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    let envelope = 0;
    for (let i = 0; i < length; i += 1) {
      if (Math.random() < 0.0016) envelope = 0.55 + Math.random() * 0.45;
      envelope *= 0.9992;
      const hiss = (Math.random() * 2 - 1) * 0.08;
      const pop = (Math.random() * 2 - 1) * envelope;
      data[i] = pop * 0.5 + hiss * envelope;
    }
  }
  return buffer;
}

export class SpatialAudio {
  constructor(camera) {
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);
    this.started = false;
    this.emitters = [];
  }

  start() {
    if (this.started) return;
    const ctx = this.listener.context;
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    this.noiseBuffer = makeNoiseBuffer(ctx, 5, true);
    this.crackleBuffer = makeCrackleBuffer(ctx, 4);
    this.started = true;
  }

  resume() {
    if (this.listener.context && this.listener.context.state === 'suspended') {
      this.listener.context.resume();
    }
  }

  placeRiverEmitters(positions) {
    if (!this.started) this.start();
    if (!this.started || !CONFIG.audio.spatial) return;
    for (const pos of positions) {
      const audio = new THREE.PositionalAudio(this.listener);
      audio.setBuffer(this.noiseBuffer);
      audio.setLoop(true);
      audio.setRefDistance(10);
      audio.setMaxDistance(90);
      audio.setRolloffFactor(1.6);
      audio.setDistanceModel('exponential');
      audio.setVolume(0.55);

      const filter = this.listener.context.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1150;
      filter.Q.value = 0.55;
      audio.setFilters([filter]);

      audio.position.set(pos.x, pos.y, pos.z);
      this.emitters.push({ kind: 'river', audio });
      try {
        audio.play();
      } catch (err) {
        /* autoplay guard */
      }
    }
  }

  placeFireEmitters(positions) {
    if (!this.started) this.start();
    if (!this.started || !CONFIG.audio.spatial) return;
    for (const pos of positions) {
      const audio = new THREE.PositionalAudio(this.listener);
      audio.setBuffer(this.crackleBuffer);
      audio.setLoop(true);
      audio.setRefDistance(6);
      audio.setMaxDistance(34);
      audio.setRolloffFactor(1.9);
      audio.setDistanceModel('exponential');
      audio.setVolume(0.5);

      const filter = this.listener.context.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 620;
      audio.setFilters([filter]);

      audio.position.set(pos.x, pos.y, pos.z);
      this.emitters.push({ kind: 'fire', audio });
      try {
        audio.play();
      } catch (err) {
        /* autoplay guard */
      }
    }
  }

  setMuted(muted) {
    for (const emitter of this.emitters) {
      const base = emitter.kind === 'fire' ? 0.5 : 0.55;
      emitter.audio.setVolume(muted ? 0 : base);
    }
  }

  stop() {
    for (const { audio } of this.emitters) {
      if (audio.isPlaying) audio.stop();
    }
    this.emitters = [];
  }
}
