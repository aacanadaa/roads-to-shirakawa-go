import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clamp } from '../utils.js';

const P = CONFIG.player;

export class Player {
  constructor(camera, terrain, props) {
    this.camera = camera;
    this.terrain = terrain;
    this.props = props;
    this.position = new THREE.Vector3(10, 30, 10);
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = -0.05;
    this.onGround = false;
    this.inWater = false;
    this.headInWater = false;
    this.wasInWater = false;
    this.stepDistance = 0;
    this.onStep = null;
    this._euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.input = {
      forward: false,
      back: false,
      left: false,
      right: false,
      jump: false,
      sprint: false,
    };
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

  groundHeight() {
    const terrainY = this.terrain.sampleHeight(this.position.x, this.position.z);
    const propTop = this.props.topAt(this.position.x, this.position.z, this.position.y);
    return Math.max(terrainY, propTop);
  }

  intersectsPlayer(x, y, z, half = 0.58) {
    const dx = Math.abs(x - this.position.x);
    const dz = Math.abs(z - this.position.z);
    const dy = Math.abs(y - (this.position.y + P.height * 0.5));
    return dx < half + P.width * 0.5 && dz < half + P.width * 0.5 && dy < half + P.height * 0.5;
  }

  update(dt) {
    dt = Math.min(dt, 0.05);

    const waterY = this.terrain.waterHeightAt(this.position.x, this.position.z);
    const groundY = this.terrain.sampleHeight(this.position.x, this.position.z);
    this.inWater = waterY > -900 && this.position.y + 0.4 < waterY && groundY < waterY;
    this.headInWater = waterY > -900 && this.position.y + P.eyeHeight < waterY;

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
      this.velocity.y += P.gravity * 0.16 * dt;
      this.velocity.y *= Math.exp(-2.6 * dt);
      if (input.jump) this.velocity.y = P.swimUpVelocity;
      this.velocity.y = clamp(this.velocity.y, -3.5, P.swimUpVelocity);
    } else {
      this.velocity.y -= P.gravity * dt;
      if (input.jump && this.onGround) {
        this.velocity.y = P.jumpVelocity;
        this.onGround = false;
      }
      this.velocity.y = Math.max(this.velocity.y, -48);
    }

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.position.y += this.velocity.y * dt;

    this.position.x = clamp(this.position.x, 2, this.terrain.sizeX - 2);
    this.position.z = clamp(this.position.z, 2, this.terrain.sizeZ - 2);

    const ground = this.groundHeight();
    if (this.position.y <= ground + 0.02 && this.velocity.y <= 0) {
      this.position.y = ground;
      this.velocity.y = 0;
      this.onGround = true;
    } else {
      this.onGround = this.position.y - ground < 0.12 && this.velocity.y <= 0.1;
    }

    const blocker = this.props.blockingAt(this.position.x, this.position.z, this.position.y, P.height);
    if (blocker) {
      const half = blocker.userData.prop.half;
      const dx = this.position.x - blocker.position.x;
      const dz = this.position.z - blocker.position.z;
      const push = half + P.width * 0.5 + 0.02;
      if (Math.abs(dx) > Math.abs(dz)) {
        this.position.x = blocker.position.x + Math.sign(dx || 1) * push;
        this.velocity.x = 0;
      } else {
        this.position.z = blocker.position.z + Math.sign(dz || 1) * push;
        this.velocity.z = 0;
      }
    }

    const movingSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (this.inWater && !this.wasInWater && this.onStep) {
      this.onStep('water', Math.min(1.2, movingSpeed / 4 + 0.5));
      this.stepDistance = 0;
    } else if (this.onGround && movingSpeed > 0.9) {
      this.stepDistance += movingSpeed * dt;
      const stride = input.sprint ? 2.15 : 1.72;
      if (this.stepDistance >= stride) {
        this.stepDistance = 0;
        if (this.onStep) {
          this.onStep(this.surfaceName(), Math.min(1.25, movingSpeed / P.walkSpeed));
        }
      }
    }
    this.wasInWater = this.inWater;

    this.syncCamera();
  }

  surfaceName() {
    return this.terrain.surfaceAt(this.position.x, this.position.z);
  }
}
