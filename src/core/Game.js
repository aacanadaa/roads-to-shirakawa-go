import * as THREE from 'three';
import { CONFIG, QUALITY_PRESETS } from '../config.js';
import { World } from '../world/World.js';
import { generateWorld } from '../world/Generator.js';
import { sharedMaterials, Chunk } from '../world/Chunk.js';
import { decorateMicroWorld } from '../world/micro.js';
import { BLOCK } from '../world/blocks.js';
import { voxelUniforms } from '../graphics/VoxelMaterial.js';
import { Player } from '../player/Player.js';
import { BlockInteraction } from '../player/BlockInteraction.js';
import { Sky } from '../env/Sky.js';
import { AmbientAudio } from '../audio/AmbientAudio.js';
import { SpatialAudio } from '../audio/SpatialAudio.js';
import { Footsteps } from '../audio/Footsteps.js';
import { SkyDome } from '../graphics/SkyDome.js';
import { ParticleField } from '../graphics/Particles.js';
import { PostPipeline } from '../graphics/Composer.js';
import { HUD } from '../ui/HUD.js';
import { clamp } from '../utils.js';

void Chunk;

const LOCATIONS = [
  { z: 55, name: 'Hida Takayama · Old Post Road' },
  { z: 110, name: 'Ainokura Woodland Crossing' },
  { z: 165, name: 'Shokawa Stream Valley' },
  { z: 215, name: 'Miyagawa Cedar Grove' },
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
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.1, 900);

    // Voxel world: merged-face chunks with baked AO + shader-pack materials.
    this.world = new World(this.scene, CONFIG.world);
    this.meta = generateWorld(this.world);
    this.world.meta = this.meta;
    this.world.buildAll();
    // High-fidelity mini-cube structures (static decor overlay, 2 draw calls).
    this.microStats = decorateMicroWorld(this.world, this.meta, this.scene);

    this.player = new Player(this.camera, this.world);
    this.player.spawn(this.meta.spawn.x, this.meta.spawn.y, this.meta.spawn.z, Math.PI * 0.92);

    this.interaction = new BlockInteraction(this.world, this.player, this.scene);
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

    const fireflyHomes = [
      ...(this.meta.lanterns || []).map((l) => ({ x: l.x, y: l.y - 0.5, z: l.z })),
      ...(this.meta.houseLights || []).map((l) => ({ x: l.x, y: l.y, z: l.z })),
    ];
    this.particles = new ParticleField(this.scene, CONFIG.graphics.particles, fireflyHomes);
    this.particles.setPixelRatio(this.renderer.getPixelRatio());

    this.audio = new AmbientAudio();
    this.spatial = new SpatialAudio(this.camera);
    this.footsteps = new Footsteps();
    this.player.onStep = (blockId, intensity) => {
      this.footsteps.play(this.footsteps.surfaceForBlock(blockId), intensity);
    };

    this.sky.addLanternLights(this.pickNear(this.meta.lanterns || [], 8));
    this.sky.addHouseLights(this.pickNear(this.meta.houseLights || [], 6));

    this.clock = { last: 0 };
    this.keys = new Set();
    this._sunUv = new THREE.Vector3();

    this.hud = new HUD();
    this.bindEvents();
    this.hud.setSlot(this.interaction.slot, this.interaction.setSlot(this.interaction.slot));
    this.hud.setCycleLabel('Auto');
    this.hud.setSoundLabel(false);
    this.hud.setQualityLabel(this.quality);
    this.hud.showIntro(true);
  }

  pickNear(list, count) {
    return list
      .map((p) => ({
        ...p,
        d: Math.hypot(p.x - this.meta.spawn.x, p.z - this.meta.spawn.z),
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
    for (let z = Math.round(this.meta.spawn.z); z < this.meta.spawn.z + 120; z += 26) {
      const zc = clamp(Math.round(z), 0, this.world.sizeZ - 1);
      const x = Math.round(this.meta.riverX(zc));
      let y = null;
      for (let yScan = this.world.height - 1; yScan > 2; yScan -= 1) {
        if (this.world.getBlock(x, yScan, zc) === BLOCK.WATER) {
          y = yScan;
          break;
        }
      }
      if (y !== null) riverPoints.push({ x: x + 0.5, y: y + 1, z: zc + 0.5 });
    }
    this.spatial.placeRiverEmitters(riverPoints.slice(0, 4));
    this.spatial.placeFireEmitters(this.pickNear(this.meta.lanterns || [], 4));
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
        if (n >= 1 && n <= 8) {
          const def = this.interaction.setSlot(n - 1);
          this.hud.setSlot(this.interaction.slot, def);
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
        this.interaction.startHold(event.button);
      }
    });

    window.addEventListener('mouseup', () => {
      this.interaction.endHold();
    });

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
        const def = this.interaction.cycleSlot(event.deltaY > 0 ? 1 : -1);
        this.hud.setSlot(this.interaction.slot, def);
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

    document.addEventListener('pointerlockerror', () => {
      this.hud.showToast('Mouse lock unavailable');
    });

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
      const def = this.interaction.setSlot(Number(slot.dataset.index));
      this.hud.setSlot(this.interaction.slot, def);
    });
  }

  cycleQuality() {
    const order = ['high', 'medium', 'low'];
    const next = order[(order.indexOf(this.quality) + 1) % order.length];
    this.applyQuality(next);
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
    if (canvas.requestPointerLock) {
      canvas.requestPointerLock();
    }
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
    const onScreen = uvX > -0.25 && uvX < 1.25 && uvY > -0.25 && uvY < 1.25 ? 1 : 0;
    const facing = Math.pow(clamp(forward.dot(sunDir), 0, 1), 0.65);
    const above = clamp((this.sky.elevation + 0.12) / 0.35, 0, 1);
    const visibility = inFront * onScreen * facing * above;
    this.pipeline.setSun(uvX, uvY, visibility);
  }

  syncAtmosphere() {
    const water = sharedMaterials.water.uniforms;
    const night = this.sky.nightFactor;
    water.uTime.value = this.elapsed;
    water.uWaveHeight.value = CONFIG.graphics.water.waveHeight;
    water.uSunDirection.value.copy(this.sky.sunDirection);
    water.uSunColor.value.copy(this.sky.sunColor);
    water.uSkyColor.value.copy(this.sky.zenith);
    water.uHorizonColor.value.copy(this.sky.horizon);
    water.uSunIntensity.value = this.sky.sun.intensity * 0.8;
    water.uNightFactor.value = night;
    water.uDeepColor.value.setHex(0x174a6e).lerp(new THREE.Color(0x0a2033), night * 0.85);
    water.uShallowColor.value.setHex(0x46a3cf).lerp(new THREE.Color(0x1c4560), night * 0.85);
    if (water.fogColor) water.fogColor.value.copy(this.sky.fog.color);
    if (water.fogNear !== undefined && water.fogDensity !== undefined) {
      water.fogDensity.value = this.sky.fog.density;
    }

    voxelUniforms.uTime.value = this.elapsed;
    voxelUniforms.uWindStrength.value =
      CONFIG.graphics.wind.strength * (0.75 + (1 - night) * 0.5);

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
  }

  updateAudioProximity() {
    const px = this.player.position.x;
    const pz = this.player.position.z;
    const zClamped = clamp(Math.round(pz), 0, this.world.sizeZ - 1);
    const riverX = this.meta.riverX(zClamped);
    const dist = Math.abs(px - riverX);
    const stream = 1 - clamp((dist - 5) / 42, 0, 1);
    this.audio.setStreamProximity(this.player.headInWater ? 1 : stream);
    this.audio.setWindLevel(
      0.35 + this.sky.nightFactor * 0.15 + clamp(this.player.position.y / 48, 0, 1) * 0.35
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
    const zClamped = clamp(Math.round(z), 0, this.world.sizeZ - 1);
    const nearRiver = Math.abs(this.player.position.x - this.meta.riverX(zClamped)) < 16;
    if (nearRiver) name += ' · Riverside';
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
    this.interaction.update(dt);
    this.world.rebuildDirty();
    const skyState = this.sky.update(dt);
    this.sky.focus.copy(this.player.position);

    this.syncAtmosphere();
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
