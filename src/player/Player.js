import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clamp } from '../utils.js';
import { BLOCK, isSolidId, isLiquidId } from '../world/blocks.js';

const P = CONFIG.player;

export class Player {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.position = new THREE.Vector3(8, 40, 8);
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = -0.05;
    this.onGround = false;
    this.inWater = false;
    this.headInWater = false;
    this.input = {
      forward: false,
      back: false,
      left: false,
      right: false,
      jump: false,
      sprint: false,
    };
    this._euler = new THREE.Euler(0, 0, 0, 'YXZ');
  }

  spawn(x, y, z, yaw = Math.PI) {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = -0.06;
    this.syncCamera();
  }

  look(dx, dy, sensitivity = 0.0022) {
    this.yaw -= dx * sensitivity;
    this.pitch -= dy * sensitivity;
    this.pitch = clamp(this.pitch, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
    this.syncCamera();
  }

  syncCamera() {
    this._euler.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(this._euler);
    this.camera.position.set(
      this.position.x,
      this.position.y + P.eyeHeight,
      this.position.z
    );
  }

  blockAtFeet() {
    const x = Math.floor(this.position.x);
    const z = Math.floor(this.position.z);
    return this.world.getBlock(x, Math.floor(this.position.y + 0.1), z);
  }

  intersectsSolid(px, py, pz) {
    const half = P.width / 2;
    const minX = px - half;
    const maxX = px + half;
    const minY = py;
    const maxY = py + P.height;
    const minZ = pz - half;
    const maxZ = pz + half;

    for (let x = Math.floor(minX); x <= Math.floor(maxX); x += 1) {
      for (let y = Math.floor(minY); y <= Math.floor(maxY); y += 1) {
        for (let z = Math.floor(minZ); z <= Math.floor(maxZ); z += 1) {
          if (!this.world.isSolidAt(x, y, z)) continue;
          const overlap =
            minX < x + 1 && maxX > x && minY < y + 1 && maxY > y && minZ < z + 1 && maxZ > z;
          if (overlap) return true;
        }
      }
    }
    return false;
  }

  intersectsBlock(bx, by, bz) {
    const half = P.width / 2;
    const minX = this.position.x - half;
    const maxX = this.position.x + half;
    const minY = this.position.y;
    const maxY = this.position.y + P.height;
    const minZ = this.position.z - half;
    const maxZ = this.position.z + half;
    return (
      minX < bx + 1 && maxX > bx && minY < by + 1 && maxY > by && minZ < bz + 1 && maxZ > bz
    );
  }

  moveAxis(axis, amount) {
    if (amount === 0) return;
    const prev = this.position[axis];
    this.position[axis] += amount;

    if (!this.intersectsSolid(this.position.x, this.position.y, this.position.z)) return;

    if (axis !== 'y' && this.onGround) {
      const prevY = this.position.y;
      this.position.y = prevY + P.stepHeight;
      if (!this.intersectsSolid(this.position.x, this.position.y, this.position.z)) {
        return;
      }
      this.position.y = prevY;
    }

    this.position[axis] = prev;
    if (axis === 'y') {
      if (amount < 0) this.onGround = true;
      this.velocity.y = 0;
    } else {
      this.velocity[axis] = 0;
    }
  }

  update(dt) {
    dt = Math.min(dt, 0.05);

    const footBlock = this.world.getBlock(
      Math.floor(this.position.x),
      Math.floor(this.position.y + 0.2),
      Math.floor(this.position.z)
    );
    const headBlock = this.world.getBlock(
      Math.floor(this.position.x),
      Math.floor(this.position.y + P.eyeHeight),
      Math.floor(this.position.z)
    );
    this.inWater = isLiquidId(footBlock) || isLiquidId(this.world.getBlock(
      Math.floor(this.position.x),
      Math.floor(this.position.y + 0.9),
      Math.floor(this.position.z)
    ));
    this.headInWater = isLiquidId(headBlock);

    const input = this.input;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);

    let wishX = 0;
    let wishZ = 0;
    if (input.forward) {
      wishX -= sin;
      wishZ -= cos;
    }
    if (input.back) {
      wishX += sin;
      wishZ += cos;
    }
    if (input.left) {
      wishX -= cos;
      wishZ += sin;
    }
    if (input.right) {
      wishX += cos;
      wishZ -= sin;
    }

    const len = Math.hypot(wishX, wishZ);
    if (len > 0) {
      wishX /= len;
      wishZ /= len;
    }

    let speed = input.sprint ? P.sprintSpeed : P.walkSpeed;
    if (this.inWater) speed = P.swimSpeed;

    const accel = this.onGround ? P.acceleration : P.acceleration * P.airControl;
    this.velocity.x += wishX * accel * dt;
    this.velocity.z += wishZ * accel * dt;

    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (horizontalSpeed > speed) {
      const scale = speed / horizontalSpeed;
      this.velocity.x *= scale;
      this.velocity.z *= scale;
    }

    if (len === 0 && this.onGround) {
      const friction = Math.exp(-P.friction * dt);
      this.velocity.x *= friction;
      this.velocity.z *= friction;
    }

    if (this.inWater) {
      this.velocity.y += P.gravity * 0.18 * dt;
      this.velocity.y *= Math.exp(-2.4 * dt);
      if (input.jump) this.velocity.y = P.swimUpVelocity;
      this.velocity.y = clamp(this.velocity.y, -4, P.swimUpVelocity);
    } else {
      this.velocity.y -= P.gravity * dt;
      if (input.jump && this.onGround) {
        this.velocity.y = P.jumpVelocity;
        this.onGround = false;
      }
      this.velocity.y = Math.max(this.velocity.y, -42);
    }

    this.onGround = false;
    this.moveAxis('y', this.velocity.y * dt);
    this.moveAxis('x', this.velocity.x * dt);
    this.moveAxis('z', this.velocity.z * dt);

    this.position.x = clamp(this.position.x, 1.5, this.world.sizeX - 1.5);
    this.position.z = clamp(this.position.z, 1.5, this.world.sizeZ - 1.5);
    if (this.position.y < -20) {
      this.position.y = this.world.height - 10;
      this.velocity.set(0, 0, 0);
    }

    this.syncCamera();
  }

  getCameraDirection() {
    return this.camera.getWorldDirection(new THREE.Vector3());
  }

  isSolidTarget(x, y, z) {
    return isSolidId(this.world.getBlock(x, y, z));
  }
}
