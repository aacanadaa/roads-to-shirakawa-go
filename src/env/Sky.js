import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clamp, smoothstep, shortestAngleLerp } from '../utils.js';

const SKY_KEYS = [
  {
    e: -1.0,
    zenith: 0x0e2036, horizon: 0x22344c, sun: 0xa8bcec,
    fog: 0x1e2e44, fogDensity: 0.0036, sunI: 0.55, hemiI: 0.66, ambI: 0.82,
  },
  {
    e: -0.32,
    zenith: 0x1a2c46, horizon: 0x3c506c, sun: 0xb0c0e6,
    fog: 0x324258, fogDensity: 0.0046, sunI: 0.62, hemiI: 0.62, ambI: 0.74,
  },
  {
    e: -0.045,
    zenith: 0x3a5280, horizon: 0xe09a6c, sun: 0xffb070,
    fog: 0xb98a70, fogDensity: 0.0058, sunI: 0.98, hemiI: 0.55, ambI: 0.58,
  },
  {
    e: 0.135,
    zenith: 0x6092c4, horizon: 0xecd0a8, sun: 0xffd9a8,
    fog: 0xc9b098, fogDensity: 0.0038, sunI: 1.15, hemiI: 0.62, ambI: 0.55,
  },
  {
    e: 0.5,
    zenith: 0x69a6d9, horizon: 0xa9c9dd, sun: 0xfff3dd,
    fog: 0xa9c9dd, fogDensity: 0.0032, sunI: 1.3, hemiI: 0.72, ambI: 0.5,
  },
  {
    e: 1.0,
    zenith: 0x4a86c6, horizon: 0x9fc6e2, sun: 0xfff8ee,
    fog: 0xa9c9dd, fogDensity: 0.0028, sunI: 1.36, hemiI: 0.76, ambI: 0.48,
  },
];

const _cA = new THREE.Color();
const _cB = new THREE.Color();

function sampleKeys(elev) {
  let lo = SKY_KEYS[0];
  let hi = SKY_KEYS[SKY_KEYS.length - 1];
  for (let i = 0; i < SKY_KEYS.length - 1; i += 1) {
    if (elev >= SKY_KEYS[i].e && elev <= SKY_KEYS[i + 1].e) {
      lo = SKY_KEYS[i];
      hi = SKY_KEYS[i + 1];
      break;
    }
  }
  const span = Math.max(hi.e - lo.e, 1e-5);
  const t = clamp((elev - lo.e) / span, 0, 1);
  return { lo, hi, t };
}

function mixColor(out, hexA, hexB, t) {
  _cA.setHex(hexA);
  _cB.setHex(hexB);
  out.copy(_cA).lerp(_cB, t);
  return out;
}

function mixScalar(a, b, t) {
  return a + (b - a) * t;
}

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.time = 0.34;
    this.mode = 'auto';
    this.speed = 1 / CONFIG.sky.dayLengthSeconds;
    this.focus = new THREE.Vector3(128, 20, 128);

    const shadows = CONFIG.graphics.shadows;
    this.sun = new THREE.DirectionalLight(0xffffff, 1.2);
    this.sun.position.set(160, 180, 120);
    this.sun.target.position.copy(this.focus);
    this.sun.castShadow = shadows.enabled;
    this.sun.shadow.mapSize.set(shadows.mapSize, shadows.mapSize);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 460;
    this.sun.shadow.bias = shadows.bias;
    this.sun.shadow.normalBias = shadows.normalBias;
    this.setShadowExtent(shadows.extent);
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xa9c9dd, 0x4c5a48, 0.7);
    scene.add(this.hemi);

    this.ambient = new THREE.AmbientLight(0x6d8296, 0.5);
    scene.add(this.ambient);

    this.fog = new THREE.FogExp2(0xa9c9dd, 0.0052);
    scene.fog = this.fog;

    this.lanternLights = [];
    this.houseLights = [];

    this.sunDirection = new THREE.Vector3(0.5, 0.8, 0.3).normalize();
    this.zenith = new THREE.Color(0x69a6d9);
    this.horizon = new THREE.Color(0xa9c9dd);
    this.sunColor = new THREE.Color(0xfff3dd);
    this.dayFactor = 1;
    this.nightFactor = 0;
    this.elevation = 1;
  }

  setShadowExtent(extent) {
    const cam = this.sun.shadow.camera;
    cam.left = -extent;
    cam.right = extent;
    cam.top = extent;
    cam.bottom = -extent;
    cam.updateProjectionMatrix();
  }

  setShadowEnabled(enabled) {
    this.sun.castShadow = enabled;
    if (this.sun.shadow.map && !enabled) {
      this.sun.shadow.map.dispose();
      this.sun.shadow.map = null;
    }
  }

  addLanternLights(positions) {
    for (const pos of positions) {
      const light = new THREE.PointLight(0xffc078, 0, 18, 1.8);
      light.position.set(pos.x, pos.y, pos.z);
      this.scene.add(light);
      this.lanternLights.push(light);
    }
  }

  addHouseLights(positions) {
    for (const pos of positions) {
      const light = new THREE.PointLight(0xffb46a, 0, 15, 1.85);
      light.position.set(pos.x, pos.y, pos.z);
      this.scene.add(light);
      this.houseLights.push(light);
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
    const { lo, hi, t } = sampleKeys(elev);

    this.elevation = elev;
    this.dayFactor = smoothstep(-0.12, 0.22, elev);
    this.nightFactor = 1 - this.dayFactor;

    this.sunDirection
      .set(Math.cos(angle) * 0.82, Math.sin(angle), 0.42)
      .normalize();

    const focus = this.focus;
    const snap = 2;
    this.sun.target.position.set(
      Math.round(focus.x / snap) * snap,
      Math.round(focus.y / snap) * snap,
      Math.round(focus.z / snap) * snap
    );
    this.sun.position.set(
      this.sun.target.position.x + this.sunDirection.x * 230,
      this.sun.target.position.y + this.sunDirection.y * 230,
      this.sun.target.position.z + this.sunDirection.z * 230
    );

    mixColor(this.zenith, lo.zenith, hi.zenith, t);
    mixColor(this.horizon, lo.horizon, hi.horizon, t);
    mixColor(this.sunColor, lo.sun, hi.sun, t);
    mixColor(this.fog.color, lo.fog, hi.fog, t);
    this.fog.density = mixScalar(lo.fogDensity, hi.fogDensity, t);

    const lowSun = clamp(1 - Math.abs(elev) / 0.38, 0, 1);
    this.fog.color.lerp(this.sunColor, lowSun * 0.15);

    this.sun.color.copy(this.sunColor);
    this.sun.intensity = mixScalar(lo.sunI, hi.sunI, t);
    this.hemi.color.copy(this.horizon);
    this.hemi.groundColor.setHex(0x4c5a48).lerp(_cB.setHex(0x2c3542), this.nightFactor);
    this.hemi.intensity = mixScalar(lo.hemiI, hi.hemiI, t);
    this.ambient.intensity = mixScalar(lo.ambI, hi.ambI, t);

    const lanternLevel = smoothstep(0.3, 0.85, this.nightFactor);
    for (const light of this.lanternLights) {
      light.intensity = lanternLevel * 2.2;
    }
    for (const light of this.houseLights) {
      light.intensity = lanternLevel * 1.7;
    }

    return {
      time: this.time,
      dayFactor: this.dayFactor,
      nightFactor: this.nightFactor,
      elevation: elev,
    };
  }

  get timeLabel() {
    const totalMinutes = Math.floor(this.time * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
}
