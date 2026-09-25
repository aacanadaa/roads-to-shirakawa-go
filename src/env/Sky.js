import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clamp, smoothstep, damp, shortestAngleLerp } from '../utils.js';

const PALETTE = {
  night: {
    sky: new THREE.Color(0x0a1420),
    fog: new THREE.Color(0x0c1826),
    sun: new THREE.Color(0x8fa6d8),
    ground: new THREE.Color(0x1a2230),
  },
  dusk: {
    sky: new THREE.Color(0xd98a5c),
    fog: new THREE.Color(0xd2a184),
    sun: new THREE.Color(0xff9a4d),
    ground: new THREE.Color(0x4a3a30),
  },
  day: {
    sky: new THREE.Color(0x8fc0e8),
    fog: new THREE.Color(0xa9c9dd),
    sun: new THREE.Color(0xfff3dd),
    ground: new THREE.Color(0x4c5a48),
  },
};

export class Sky {
  constructor(scene, worldCenter) {
    this.scene = scene;
    this.time = 0.34;
    this.mode = 'auto';
    this.speed = 1 / CONFIG.sky.dayLengthSeconds;

    this.sun = new THREE.DirectionalLight(0xffffff, 1.1);
    this.sun.position.set(120, 160, 60);
    this.sun.target.position.copy(worldCenter);
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xa9c9dd, 0x3d4a38, 0.55);
    scene.add(this.hemi);

    this.ambient = new THREE.AmbientLight(0x3d4c5c, 0.32);
    scene.add(this.ambient);

    this.fog = new THREE.Fog(0xa9c9dd, CONFIG.render.fogDay.near, CONFIG.render.fogDay.far);
    scene.fog = this.fog;
    scene.background = new THREE.Color(0xa9c9dd);

    this.lanternLights = [];
    this.skyColor = new THREE.Color();
    this.fogColor = new THREE.Color();
    this.sunColor = new THREE.Color();
    this.nightFactor = 0;
  }

  addLanternLights(positions) {
    for (const pos of positions) {
      const light = new THREE.PointLight(0xffc078, 0, 18, 1.8);
      light.position.set(pos.x, pos.y, pos.z);
      this.scene.add(light);
      this.lanternLights.push(light);
    }
  }

  setMode(mode) {
    this.mode = mode;
    return this.mode;
  }

  cycleMode() {
    if (this.mode === 'auto') return this.setMode('day');
    if (this.mode === 'day') return this.setMode('night');
    return this.setMode('auto');
  }

  update(dt) {
    if (this.mode === 'auto') {
      this.time = (this.time + this.speed * dt) % 1;
    } else if (this.mode === 'day') {
      this.time = shortestAngleLerp(this.time, 0.5, 1.6, dt);
    } else {
      this.time = shortestAngleLerp(this.time, 0.0, 1.6, dt);
    }

    const angle = (this.time - 0.25) * Math.PI * 2;
    const elev = Math.sin(angle);
    const dayFactor = smoothstep(-0.18, 0.25, elev);
    const sunsetFactor = clamp(1 - Math.abs(elev) / 0.42, 0, 1);
    this.nightFactor = 1 - dayFactor;

    const dirX = Math.cos(angle) * 0.82;
    const dirY = Math.sin(angle);
    const dirZ = 0.42;
    this.sun.position.set(
      this.sun.target.position.x + dirX * 180,
      this.sun.target.position.y + dirY * 180,
      this.sun.target.position.z + dirZ * 180
    );

    this.skyColor.copy(PALETTE.night.sky).lerp(PALETTE.day.sky, dayFactor);
    this.skyColor.lerp(PALETTE.dusk.sky, sunsetFactor * 0.8);
    this.fogColor.copy(PALETTE.night.fog).lerp(PALETTE.day.fog, dayFactor);
    this.fogColor.lerp(PALETTE.dusk.fog, sunsetFactor * 0.7);

    this.sunColor.copy(PALETTE.night.sun).lerp(PALETTE.day.sun, dayFactor);
    this.sunColor.lerp(PALETTE.dusk.sun, sunsetFactor * 0.85);

    this.scene.background.copy(this.skyColor);
    this.fog.color.copy(this.fogColor);

    const sunIntensity =
      elev > 0
        ? lerpSafe(0.38, 1.25, smoothstep(0, 0.45, elev))
        : lerpSafe(0.22, 0.38, smoothstep(-0.35, 0, elev));
    this.sun.intensity = sunIntensity * (1 - sunsetFactor * 0.12) + sunsetFactor * 0.18;
    this.sun.color.copy(this.sunColor);

    this.hemi.intensity = lerpSafe(0.34, 0.72, dayFactor);
    this.hemi.color.copy(this.fogColor);
    this.ambient.intensity = lerpSafe(0.5, 0.52, dayFactor);

    this.fog.near = lerpSafe(CONFIG.render.fogNight.near, CONFIG.render.fogDay.near, dayFactor);
    this.fog.far = lerpSafe(CONFIG.render.fogNight.far, CONFIG.render.fogDay.far, dayFactor);

    const lanternLevel = smoothstep(0.35, 0.85, this.nightFactor);
    for (const light of this.lanternLights) {
      light.intensity = lanternLevel * 2.1;
    }

    return {
      time: this.time,
      nightFactor: this.nightFactor,
      dayFactor,
    };
  }

  get timeLabel() {
    const totalMinutes = Math.floor(this.time * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
}

function lerpSafe(a, b, t) {
  return a + (b - a) * clamp(t, 0, 1);
}
