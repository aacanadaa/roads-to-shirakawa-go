import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { PROP_PALETTE } from '../scenery/Props.js';

export class BuildTool {
  constructor(scene, camera, terrain, props, player) {
    this.camera = camera;
    this.terrain = terrain;
    this.props = props;
    this.player = player;
    this.slot = 0;
    this.hit = null;
    this.holding = -1;
    this.holdTimer = 0;

    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = CONFIG.player.reach;

    const ringGeo = new THREE.RingGeometry(0.75, 0.95, 32);
    ringGeo.rotateX(-Math.PI / 2);
    this.ring = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color: 0xfff2cf,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    this.ring.visible = false;
    this.ring.renderOrder = 30;
    scene.add(this.ring);

    const boxGeo = new THREE.BoxGeometry(1.22, 1.22, 1.22);
    this.outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(boxGeo),
      new THREE.LineBasicMaterial({ color: 0x0b0f12, transparent: true, opacity: 0.8 })
    );
    this.outline.visible = false;
    this.outline.renderOrder = 31;
    scene.add(this.outline);
  }

  get selected() {
    return PROP_PALETTE[this.slot];
  }

  setSlot(index) {
    this.slot = ((index % PROP_PALETTE.length) + PROP_PALETTE.length) % PROP_PALETTE.length;
    return this.selected;
  }

  cycleSlot(direction) {
    return this.setSlot(this.slot + direction);
  }

  update(dt) {
    const origin = this.camera.position;
    const direction = this.camera.getWorldDirection(new THREE.Vector3());
    this.raycaster.set(origin, direction);

    const targets = [this.terrain.mesh, ...this.props.items];
    const hits = this.raycaster.intersectObjects(targets, false);
    const hit = hits.find((h) => h.distance <= CONFIG.player.reach) || null;
    this.hit = hit;

    if (hit) {
      if (hit.object.userData.prop) {
        this.outline.visible = true;
        this.outline.position.copy(hit.object.position);
        this.ring.visible = false;
      } else {
        this.ring.visible = true;
        this.ring.position.set(hit.point.x, hit.point.y + 0.06, hit.point.z);
        this.outline.visible = false;
      }
    } else {
      this.ring.visible = false;
      this.outline.visible = false;
    }

    if (this.holding >= 0) {
      this.holdTimer -= dt;
      if (this.holdTimer <= 0) {
        this.holdTimer = CONFIG.interaction.repeatDelay;
        if (this.holding === 0) this.breakOrDig();
        else if (this.holding === 2) this.place();
      }
    }
  }

  startHold(button) {
    this.holding = button;
    this.holdTimer = 0.3;
    if (button === 0) this.breakOrDig();
    else if (button === 2) this.place();
  }

  endHold() {
    this.holding = -1;
  }

  breakOrDig() {
    const hit = this.hit;
    if (!hit) return false;
    if (hit.object.userData.prop) {
      return this.props.remove(hit.object);
    }
    return this.terrain.deform(
      hit.point.x,
      hit.point.z,
      CONFIG.interaction.deformRadius,
      -CONFIG.interaction.deformDepth
    );
  }

  place() {
    const hit = this.hit;
    if (!hit) return false;

    let x = hit.point.x;
    let y;
    let z = hit.point.z;

    if (hit.object.userData.prop) {
      x = hit.object.position.x + hit.normal.x * 1.15;
      z = hit.object.position.z + hit.normal.z * 1.15;
      y = hit.object.position.y + Math.max(hit.normal.y, 0) * 1.15 + 0.58;
      if (hit.normal.y < 0.5) y = hit.object.position.y + 0.58;
    } else {
      x = hit.point.x + hit.normal.x * 0.55;
      z = hit.point.z + hit.normal.z * 0.55;
      y = this.terrain.sampleHeight(x, z) + 0.58;
    }

    x = Math.round(x * 2) / 2;
    z = Math.round(z * 2) / 2;

    if (this.player.intersectsPlayer(x, y, z, 0.58)) return false;
    if (y < 2 || y > this.terrain.data.maxHeight) return false;

    this.props.add(x, y, z, this.slot);
    return true;
  }
}
