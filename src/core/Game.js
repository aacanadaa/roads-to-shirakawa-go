import * as THREE from 'three';
import { CONFIG, QUALITY_PRESETS } from '../config.js';
import { generateTerrain } from '../world/terrainGen.js';
import { Terrain } from '../world/Terrain.js';
import { Forest } from '../scenery/Trees.js';
import { Village } from '../scenery/Houses.js';
import { Boulders } from '../scenery/Rocks.js';
import { GrassField } from '../scenery/Grass.js';
import { LanternRow } from '../scenery/Lanterns.js';
import { Bridges } from '../scenery/Bridge.js';
import { RoadRibbon } from '../scenery/Road.js';
import { River } from '../scenery/Water.js';
import { Props, PROP_PALETTE } from '../scenery/Props.js';
import { Player } from '../player/Player.js';
import { BuildTool } from '../player/BuildTool.js';
import { Sky } from '../env/Sky.js';
import { SkyDome } from '../graphics/SkyDome.js';
import { ParticleField } from '../graphics/Particles.js';
import { PostPipeline } from '../graphics/Composer.js';
import { windUniforms } from '../shaders/wind.js';
import { AmbientAudio } from '../audio/AmbientAudio.js';
import { SpatialAudio } from '../audio/SpatialAudio.js';
import { Footsteps } from '../audio/Footsteps.js';
import { HUD } from '../ui/HUD.js';
import { clamp } from '../utils.js';

const LOCATIONS = [
  { z: 70, name: 'Hida Takayama · Old Post Road' },
  { z: 140, name: 'Ainokura Woodland Crossing' },
  { z: 210, name: 'Shokawa Stream Valley' },
  { z: 270, name: 'Miyagawa Cedar Grove' },
  { z: 999, name: 'Shirakawa-go Approach' },
];

export class Game {
  constructor(container) {
    this.container = container;
    this.running = false;
    this.pointerLocked = false;
    this.elapsed = 0;
    this.quality = CONFIG.graphics.quality;

    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.render.maxPixelRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = CONFIG.graphics.toneMappingExposure;
    this.renderer.shadowMap.enabled = CONFIG.graphics.shadows.enabled;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.1, 900);

    this.terrainData = generateTerrain();
    this.terrain = new Terrain(this.scene, this.terrainData);

    this.forest = new Forest(this.scene, this.terrainData.trees, this.terrainData.bamboos);
    this.village = new Village(this.scene, this.terrainData.houses);
    this.boulders = new Boulders(
      this.scene,
      this.terrainData.rocks.map((r) => ({
        ...r,
        y: this.terrain.sampleHeight(r.x, r.z) + r.scale * 0.35,
      }))
    );
    this.grass = new GrassField(this.scene, this.terrain, CONFIG.graphics.grass);
    this.lanterns = new LanternRow(this.scene, this.terrainData.lanterns, this.terrain);
    this.bridges = new Bridges(this.scene, this.terrainData.bridges, this.terrain);
    this.road = new RoadRibbon(this.scene, this.terrain);
    this.river = new River(this.scene, this.terrain);
    this.props = new Props(this.scene, this.terrain);

    this.player = new Player(this.camera, this.terrain, this.props);
    this.player.spawn(
      this.terrainData.spawn.x,
      this.terrainData.spawn.y,
      this.terrainData.spawn.z,
      Math.PI * 0.92
    );
    this.buildTool = new BuildTool(this.scene, this.camera, this.terrain, this.props, this.player);

    this.sky = new Sky(this.scene);
    this.skyDome = new SkyDome(this.scene, 780);
    this.sky.focus.copy(this.player.position);

    this.pipeline = new PostPipeline(
      this.renderer,
      this.scene,
      this.camera,
      window.innerWidth,
      window.innerHeight,
      CONFIG.graphics
    );

    const houseLights = this.terrainData.houses.map((h) => ({ x: h.x, y: h.y + 4, z: h.z }));
    this.particles = new ParticleField(this.scene, CONFIG.graphics.particles, [
      ...this.lanterns.lights,
      ...houseLights,
    ]);
    this.particles.setPixelRatio(this.renderer.getPixelRatio());

    this.audio = new AmbientAudio();
    this.spatial = new SpatialAudio(this.camera);
    this.footsteps = new Footsteps();
    this.player.onStep = (surface, intensity) => {
      this.footsteps.play(surface, intensity);
    };

    this.sky.addLanternLights(this.pickNear(this.lanterns.lights, 8));
    this.sky.addHouseLights(this.pickNear(houseLights, 6));

    this.clock = { last: 0 };
    this.keys = new Set();
    this._sunUv = new THREE.Vector3();

    this.hud = new HUD();
    this.bindEvents();
    this.hud.setSlot(this.buildTool.slot, this.buildTool.setSlot(this.buildTool.slot));
    this.hud.setCycleLabel('Auto');
    this.hud.setSoundLabel(false);
    this.hud.setQualityLabel(this.quality);
    this.hud.showIntro(true);
  }

  pickNear(list, count) {
    return list
      .map((p) => ({
        ...p,
        d: Math.hypot(p.x - this.player.position.x, p.z - this.player.position.z),
      }))
      .sort((a, b) => a.d - b.d)
      .slice(0, count);
  }

  startAudioWorld() {
    if (this._audioWorldStarted) return;
    this._audioWorldStarted = true;
    this.spatial.start();
    this.footsteps.start(this.spatial.listener.context);

    const riverPoints = [];
    for (let z = Math.round(this.player.position.z); z < this.player.position.z + 150; z += 30) {
      const zc = clamp(Math.round(z), 0, this.terrain.sizeZ - 1);
      const x = this.terrainData.riverX(zc);
      const y = this.terrainData.riverH[zc] - 1.4;
      riverPoints.push({ x, y, z: zc });
    }
    this.spatial.placeRiverEmitters(riverPoints.slice(0, 4));
    this.spatial.placeFireEmitters(this.pickNear(this.lanterns.lights, 4));
  }

  bindEvents() {
    window.addEventListener('resize', () => this.onResize());

    document.addEventListener('keydown', (event) => {
      if (
        event.repeat &&
        event.code !== 'KeyW' &&
        event.code !== 'KeyA' &&
        event.code !== 'KeyS' &&
        event.code !== 'KeyD'
      ) {
        return;
      }
      this.keys.add(event.code);
      this.syncInput();

      if (event.code.startsWith('Digit')) {
        const n = Number(event.code.slice(5));
        if (n >= 1 && n <= PROP_PALETTE.length) {
          const def = this.buildTool.setSlot(n - 1);
          this.hud.setSlot(this.buildTool.slot, def);
        }
      }

      switch (event.code) {
        case 'KeyN': {
          const mode = this.sky.cycleMode();
          this.hud.setCycleLabel(mode[0].toUpperCase() + mode.slice(1));
          this.hud.showToast(`Cycle: ${mode}`);
          break;
        }
        case 'KeyM': {
          const muted = this.audio.toggleMute();
          this.spatial.setMuted(muted);
          this.footsteps.enabled = !muted;
          this.hud.setSoundLabel(muted);
          this.hud.showToast(muted ? 'Sound muted' : 'Sound on');
          break;
        }
        case 'KeyH': {
          this.hud.toggleHelp();
          break;
        }
        case 'KeyG': {
          this.cycleQuality();
          break;
        }
        default:
          break;
      }

      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
        event.preventDefault();
      }
    });

    document.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
      this.syncInput();
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.syncInput();
    });

    const canvas = this.renderer.domElement;

    canvas.addEventListener('mousedown', (event) => {
      if (!this.pointerLocked) {
        this.requestLock();
        return;
      }
      event.preventDefault();
      this.audio.start();
      this.audio.resume();
      this.startAudioWorld();
      if (event.button === 0 || event.button === 2) {
        this.buildTool.startHold(event.button);
      }
    });

    window.addEventListener('mouseup', () => this.buildTool.endHold());
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());

    document.addEventListener('mousemove', (event) => {
      if (!this.pointerLocked) return;
      this.player.look(event.movementX, event.movementY);
    });

    canvas.addEventListener(
      'wheel',
      (event) => {
        if (!this.pointerLocked) return;
        event.preventDefault();
        const def = this.buildTool.cycleSlot(event.deltaY > 0 ? 1 : -1);
        this.hud.setSlot(this.buildTool.slot, def);
      },
      { passive: false }
    );

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === canvas;
      if (this.pointerLocked) {
        this.hud.showIntro(false);
        this.hud.showPause(false);
        this.audio.start();
        this.audio.resume();
        this.startAudioWorld();
      } else if (this.running) {
        this.hud.showPause(true);
      }
    });

    document.addEventListener('pointerlockerror', () => this.hud.showToast('Mouse lock unavailable'));

    const playBtn = document.getElementById('btn-play');
    const resumeBtn = document.getElementById('btn-resume');
    const cycleBtn = document.getElementById('btn-cycle');
    const soundBtn = document.getElementById('btn-sound');
    const helpBtn = document.getElementById('btn-help');
    const qualityBtn = document.getElementById('btn-quality');

    if (playBtn) playBtn.addEventListener('click', () => this.requestLock());
    if (resumeBtn) resumeBtn.addEventListener('click', () => this.requestLock());

    if (cycleBtn) {
      cycleBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        const mode = this.sky.cycleMode();
        this.hud.setCycleLabel(mode[0].toUpperCase() + mode.slice(1));
        this.hud.showToast(`Cycle: ${mode}`);
      });
    }

    if (soundBtn) {
      soundBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        this.audio.start();
        this.startAudioWorld();
        const muted = this.audio.toggleMute();
        this.spatial.setMuted(muted);
        this.footsteps.enabled = !muted;
        this.hud.setSoundLabel(muted);
      });
    }

    if (helpBtn) {
      helpBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        this.hud.toggleHelp();
      });
    }

    if (qualityBtn) {
      qualityBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        this.cycleQuality();
      });
    }

    this.hud.hotbarSlots.addEventListener('click', (event) => {
      const slot = event.target.closest('.slot');
      if (!slot) return;
      const def = this.buildTool.setSlot(Number(slot.dataset.index));
      this.hud.setSlot(this.buildTool.slot, def);
    });
  }

  cycleQuality() {
    const order = ['high', 'medium', 'low'];
    this.applyQuality(order[(order.indexOf(this.quality) + 1) % order.length]);
  }

  applyQuality(name) {
    const preset = QUALITY_PRESETS[name];
    if (!preset) return;
    this.quality = name;
    CONFIG.graphics.quality = name;

    const shadows = CONFIG.graphics.shadows;
    shadows.enabled = preset.shadows.enabled;
    shadows.mapSize = preset.shadows.mapSize;
    this.sky.sun.shadow.mapSize.set(shadows.mapSize, shadows.mapSize);
    if (this.sky.sun.shadow.map) {
      this.sky.sun.shadow.map.dispose();
      this.sky.sun.shadow.map = null;
    }
    this.sky.setShadowEnabled(preset.shadows.enabled);
    this.renderer.shadowMap.enabled = preset.shadows.enabled;

    this.pipeline.setQuality(name, preset);

    CONFIG.graphics.particles.motes = preset.particles.motes;
    CONFIG.graphics.particles.fireflies = preset.particles.fireflies;
    CONFIG.graphics.particles.leaves = preset.particles.leaves;
    this.particles.setCounts(preset.particles);
    this.particles.setPixelRatio(this.renderer.getPixelRatio());

    CONFIG.render.maxPixelRatio = preset.maxPixelRatio;
    this.onResize();
    this.hud.setQualityLabel(name);
    this.hud.showToast(`Quality: ${name}`);
  }

  syncInput() {
    const input = this.player.input;
    const k = this.keys;
    input.forward = k.has('KeyW') || k.has('ArrowUp');
    input.back = k.has('KeyS') || k.has('ArrowDown');
    input.left = k.has('KeyA') || k.has('ArrowLeft');
    input.right = k.has('KeyD') || k.has('ArrowRight');
    input.jump = k.has('Space');
    input.sprint = k.has('ShiftLeft') || k.has('ShiftRight');
  }

  requestLock() {
    const canvas = this.renderer.domElement;
    this.audio.start();
    this.audio.resume();
    this.startAudioWorld();
    if (canvas.requestPointerLock) canvas.requestPointerLock();
    this.hud.showIntro(false);
    this.hud.showPause(false);
  }

  onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const ratio = Math.min(window.devicePixelRatio, CONFIG.render.maxPixelRatio);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h);
    this.pipeline.setSize(w, h, ratio);
    this.particles.setPixelRatio(ratio);
  }

  updateSunFx() {
    const forward = this.camera.getWorldDirection(new THREE.Vector3());
    const sunDir = this.sky.sunDirection;
    this._sunUv
      .copy(this.camera.position)
      .addScaledVector(sunDir, 420)
      .project(this.camera);

    const uvX = this._sunUv.x * 0.5 + 0.5;
    const uvY = this._sunUv.y * 0.5 + 0.5;
    const inFront = this._sunUv.z < 1 ? 1 : 0;
    const onScreen =
      uvX > -0.25 && uvX < 1.25 && uvY > -0.25 && uvY < 1.25 ? 1 : 0;
    const facing = Math.pow(clamp(forward.dot(sunDir), 0, 1), 0.65);
    const above = clamp(skyElevFactor(this.sky.elevation), 0, 1);
    const visibility = inFront * onScreen * facing * above;
    this.pipeline.setSun(uvX, uvY, visibility);
  }

  updateAudioProximity() {
    const z = clamp(Math.round(this.player.position.z), 0, this.terrain.sizeZ - 1);
    const riverX = this.terrainData.riverX(z);
    const dist = Math.abs(this.player.position.x - riverX);
    const stream = 1 - clamp((dist - 6) / 50, 0, 1);
    this.audio.setStreamProximity(this.player.headInWater ? 1 : stream);
    this.audio.setWindLevel(
      0.3 + this.sky.nightFactor * 0.12 + clamp(this.player.position.y / 55, 0, 1) * 0.4
    );
  }

  updateLocationBanner() {
    const z = this.player.position.z;
    let name = LOCATIONS[LOCATIONS.length - 1].name;
    for (const entry of LOCATIONS) {
      if (z < entry.z) {
        name = entry.name;
        break;
      }
    }
    const zc = clamp(Math.round(z), 0, this.terrain.sizeZ - 1);
    if (Math.abs(this.player.position.x - this.terrainData.riverX(zc)) < 18) {
      name += ' · Riverside';
    }
    this.hud.setLocation(name);
  }

  start() {
    this.running = true;
    this.clock.last = performance.now();
    this.loop();
  }

  loop() {
    if (!this.running) return;
    requestAnimationFrame(() => this.loop());

    const now = performance.now();
    const dt = Math.min((now - this.clock.last) / 1000, 0.05);
    this.clock.last = now;
    this.elapsed += dt;

    this.player.update(dt);
    this.buildTool.update(dt);
    const skyState = this.sky.update(dt);
    this.sky.focus.copy(this.player.position);

    windUniforms.uTime.value = this.elapsed;
    windUniforms.uWindStrength.value = CONFIG.graphics.wind.strength * (0.75 + skyState.dayFactor * 0.5);
    windUniforms.uWindGust.value = CONFIG.graphics.wind.gust;

    this.river.sync(this.elapsed, this.sky);

    this.skyDome.follow(this.camera);
    this.skyDome.sync({
      zenith: this.sky.zenith,
      horizon: this.sky.horizon,
      sunColor: this.sky.sunColor,
      sunDirection: this.sky.sunDirection,
      nightFactor: this.sky.nightFactor,
      elevation: this.sky.elevation,
      time: this.elapsed,
    });

    this.updateSunFx();
    this.particles.update(dt, this.elapsed, {
      camera: this.camera,
      dayFactor: skyState.dayFactor,
      nightFactor: skyState.nightFactor,
    });

    this.updateAudioProximity();
    this.audio.update(dt);
    this.updateLocationBanner();

    this.pipeline.setTime(this.elapsed);
    this.hud.update(dt, {
      fps: this.hud.fps,
      x: this.player.position.x,
      y: this.player.position.y,
      z: this.player.position.z,
      timeLabel: this.sky.timeLabel,
    });

    this.pipeline.render();
  }
}

function skyElevFactor(elev) {
  return clamp((elev + 0.12) / 0.35, 0, 1);
}
