import { HOTBAR, blockDef } from '../world/blocks.js';

export class HUD {
  constructor() {
    this.root = document.getElementById('hud');
    this.crosshair = document.getElementById('crosshair');
    this.statsFps = document.getElementById('stat-fps');
    this.statsPos = document.getElementById('stat-pos');
    this.statsTime = document.getElementById('stat-time');
    this.statsCycle = document.getElementById('stat-cycle');
    this.toolbarCycle = document.getElementById('btn-cycle');
    this.toolbarSound = document.getElementById('btn-sound');
    this.toolbarHelp = document.getElementById('btn-help');
    this.hotbarSlots = document.getElementById('hotbar-slots');
    this.hotbarLabel = document.getElementById('hotbar-label');
    this.locationBanner = document.getElementById('location');
    this.toast = document.getElementById('toast');
    this.help = document.getElementById('help');
    this.intro = document.getElementById('intro');
    this.pause = document.getElementById('pause');

    this.toastTimer = 0;
    this.locationTimer = 0;
    this.currentLocation = '';
    this.fpsAccumulator = 0;
    this.fpsFrames = 0;
    this.fpsValue = 0;

    this.buildHotbar();
  }

  setLocation(name) {
    if (name === this.currentLocation) return;
    this.currentLocation = name;
    if (!this.locationBanner) return;
    this.locationBanner.textContent = name;
    this.locationBanner.classList.add('visible');
    this.locationTimer = 3.4;
  }

  buildHotbar() {
    this.hotbarSlots.innerHTML = '';
    HOTBAR.forEach((id, index) => {
      const def = blockDef(id);
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'slot';
      slot.dataset.index = String(index);
      slot.title = `${index + 1}: ${def.name}`;
      slot.innerHTML = `
        <span class="swatch" style="background:#${def.color.toString(16).padStart(6, '0')}"></span>
        <span class="slot-key">${index + 1}</span>
      `;
      this.hotbarSlots.appendChild(slot);
    });
  }

  setSlot(index, def) {
    const slots = this.hotbarSlots.querySelectorAll('.slot');
    slots.forEach((slot, i) => {
      slot.classList.toggle('selected', i === index);
    });
    if (def) {
      this.hotbarLabel.textContent = def.name;
      this.showToast(def.name);
    }
  }

  showToast(text) {
    this.toast.textContent = text;
    this.toast.classList.add('visible');
    this.toastTimer = 1.8;
  }

  setCycleLabel(label) {
    this.toolbarCycle.textContent = `Cycle: ${label}`;
    this.statsCycle.textContent = label.toUpperCase();
  }

  setSoundLabel(muted) {
    this.toolbarSound.textContent = muted ? 'Sound: Off' : 'Sound: On';
    this.toolbarSound.classList.toggle('toggled-off', muted);
  }

  setQualityLabel(name) {
    const btn = document.getElementById('btn-quality');
    if (btn) btn.textContent = `Quality: ${name[0].toUpperCase()}${name.slice(1)}`;
  }

  toggleHelp(force) {
    const show = typeof force === 'boolean' ? force : this.help.classList.contains('hidden');
    this.help.classList.toggle('hidden', !show);
  }

  showIntro(show) {
    this.intro.classList.toggle('hidden', !show);
  }

  showPause(show) {
    this.pause.classList.toggle('hidden', !show);
  }

  update(dt, { fps, x, y, z, timeLabel }) {
    this.fpsAccumulator += dt;
    this.fpsFrames += 1;
    if (this.fpsAccumulator >= 0.35) {
      this.fpsValue = Math.round(this.fpsFrames / this.fpsAccumulator);
      this.fpsAccumulator = 0;
      this.fpsFrames = 0;
      this.statsFps.textContent = String(this.fpsValue);
    }

    this.statsPos.textContent = `${x.toFixed(0)} ${y.toFixed(0)} ${z.toFixed(0)}`;
    this.statsTime.textContent = timeLabel;

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toast.classList.remove('visible');
    }

    if (this.locationTimer > 0) {
      this.locationTimer -= dt;
      if (this.locationTimer <= 0 && this.locationBanner) {
        this.locationBanner.classList.remove('visible');
      }
    }
  }

  get fps() {
    return this.fpsValue;
  }
}
