import * as THREE from 'three';
import { BLOCK, HOTBAR, blockDef, isLiquidId } from '../world/blocks.js';
import { CONFIG } from '../config.js';

export class BlockInteraction {
  constructor(world, player, scene) {
    this.world = world;
    this.player = player;
    this.scene = scene;
    this.slot = 1;
    this.hit = null;
    this.holding = -1;
    this.holdTimer = 0;

    const geo = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    const edges = new THREE.EdgesGeometry(geo);
    this.highlight = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x0b0f12, transparent: true, opacity: 0.85 })
    );
    this.highlight.visible = false;
    this.highlight.renderOrder = 20;
    scene.add(this.highlight);

    this.ghost = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      })
    );
    this.ghost.visible = false;
    this.ghost.renderOrder = 15;
    scene.add(this.ghost);
  }

  get selectedBlock() {
    return HOTBAR[this.slot];
  }

  setSlot(index) {
    this.slot = ((index % HOTBAR.length) + HOTBAR.length) % HOTBAR.length;
    return blockDef(this.selectedBlock);
  }

  cycleSlot(direction) {
    return this.setSlot(this.slot + direction);
  }

  update(dt) {
    const origin = this.player.camera.position;
    const dir = this.player.getCameraDirection();
    const hit = this.world.raycast(origin, dir, CONFIG.player.reach);
    this.hit = hit;

    if (hit) {
      this.highlight.visible = true;
      this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    } else {
      this.highlight.visible = false;
      this.ghost.visible = false;
    }

    if (this.holding >= 0) {
      this.holdTimer -= dt;
      if (this.holdTimer <= 0) {
        this.holdTimer = CONFIG.interaction.repeatDelay;
        if (this.holding === 0) this.breakBlock();
        else if (this.holding === 2) this.placeBlock();
      }
    }
  }

  startHold(button) {
    this.holding = button;
    this.holdTimer = 0.28;
    if (button === 0) this.breakBlock();
    else if (button === 2) this.placeBlock();
  }

  endHold() {
    this.holding = -1;
    this.ghost.visible = false;
  }

  breakBlock() {
    const hit = this.hit;
    if (!hit) return false;
    if (hit.y <= 0) return false;
    const id = this.world.getBlock(hit.x, hit.y, hit.z);
    if (id === BLOCK.AIR || id === BLOCK.BEDROCK) return false;
    this.world.setBlock(hit.x, hit.y, hit.z, BLOCK.AIR);
    return true;
  }

  placeBlock() {
    const hit = this.hit;
    if (!hit) return false;
    const n = hit.normal;
    if (n.x === 0 && n.y === 0 && n.z === 0) return false;

    const x = hit.x + n.x;
    const y = hit.y + n.y;
    const z = hit.z + n.z;

    if (y < 1 || y >= this.world.height) return false;

    const existing = this.world.getBlock(x, y, z);
    if (existing !== BLOCK.AIR && !isLiquidId(existing)) return false;

    const id = this.selectedBlock;
    if (isLiquidId(id) && this.player.intersectsBlock(x, y, z)) return false;
    if (this.player.intersectsBlock(x, y, z)) return false;

    this.world.setBlock(x, y, z, id);
    return true;
  }
}
