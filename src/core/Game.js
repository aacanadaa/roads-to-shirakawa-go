import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { World } from '../world/World.js';
import { generateWorld } from '../world/Generator.js';
import { Player } from '../player/Player.js';
import { BlockInteraction } from '../player/BlockInteraction.js';
import { Sky } from '../env/Sky.js';
import { AmbientAudio } from '../audio/AmbientAudio.js';
import { HUD } from '../ui/HUD.js';
import { clamp } from '../utils.js';

export class Game {
  constructor(container) {
    this.container = container;
    this.running = false;
    this.pointerLocked = false;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.render.maxPixelRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      72,
      window.innerWidth / window.innerHeight,
      0.1,
      520
    );

    this.world = new World(this.scene, CONFIG.world);
    this.meta = generateWorld(this.world);
    this.world.meta = this.meta;
    this.world.buildAll();

    this.player = new Player(this.camera, this.world);
    this.player.spawn(this.meta.spawn.x, this.meta.spawn.y, this.meta.spawn.z, Math.PI * 0.92);

    this.interaction = new BlockInteraction(this.world, this.player, this.scene);
    this.sky = new Sky(this.scene, new THREE.Vector3(128, 20, 128));

    const lanternPositions = (this.meta.lanterns || [])
      .map((l) => ({ x: l.x + 0.5, y: l.y + 0.5, z: l.z + 0.5, d: Math.hypot(l.x - this.meta.spawn.x, l.z - this.meta.spawn.z) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 7);
    this.sky.addLanternLights(lanternPositions);

    this.audio = new AmbientAudio();
    this.hud = new HUD();

    this.clock = new THREE.Clock();
    this.keys = new Set();

    this.bindEvents();
    this.hud.setSlot(this.interaction.slot, this.interaction.setSlot(this.interaction.slot));
    this.hud.setCycleLabel('Auto');
    this.hud.setSoundLabel(false);
    this.hud.showIntro(true);
  }

  bindEvents() {
    window.addEventListener('resize', () => this.onResize());

    document.addEventListener('keydown', (event) => {
      if (event.repeat && event.code !== 'KeyW' && event.code !== 'KeyA' && event.code !== 'KeyS' && event.code !== 'KeyD') {
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
          this.hud.setSoundLabel(muted);
          this.hud.showToast(muted ? 'Sound muted' : 'Sound on');
          break;
        }
        case 'KeyH': {
          this.hud.toggleHelp();
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
        const muted = this.audio.toggleMute();
        this.hud.setSoundLabel(muted);
      });
    }

    if (helpBtn) {
      helpBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        this.hud.toggleHelp();
      });
    }

    this.hud.hotbarSlots.addEventListener('click', (event) => {
      const slot = event.target.closest('.slot');
      if (!slot) return;
      const def = this.interaction.setSlot(Number(slot.dataset.index));
      this.hud.setSlot(this.interaction.slot, def);
    });
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.render.maxPixelRatio));
    this.renderer.setSize(w, h);
  }

  updateAudioProximity() {
    const px = this.player.position.x;
    const pz = this.player.position.z;
    const zClamped = clamp(Math.round(pz), 0, this.world.sizeZ - 1);
    const riverX = this.meta.riverX(zClamped);
    const dist = Math.abs(px - riverX);
    const stream = 1 - clamp((dist - 5) / 42, 0, 1);
    this.audio.setStreamProximity(this.player.headInWater ? 1 : stream);
    this.audio.setWindLevel(0.35 + this.sky.nightFactor * 0.15 + clamp(this.player.position.y / 48, 0, 1) * 0.35);
  }

  start() {
    this.running = true;
    this.clock.start();
    this.loop();
  }

  loop() {
    if (!this.running) return;
    requestAnimationFrame(() => this.loop());

    const dt = Math.min(this.clock.getDelta(), 0.05);

    this.player.update(dt);
    this.interaction.update(dt);
    this.sky.update(dt);
    this.updateAudioProximity();
    this.audio.update(dt);

    this.hud.update(dt, {
      fps: this.hud.fps,
      x: this.player.position.x,
      y: this.player.position.y,
      z: this.player.position.z,
      timeLabel: this.sky.timeLabel,
    });

    this.renderer.render(this.scene, this.camera);
  }
}
