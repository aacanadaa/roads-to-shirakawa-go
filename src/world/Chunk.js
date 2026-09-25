import * as THREE from 'three';
import { BLOCK, isOpaqueId, blockDef } from './blocks.js';
import { hash3 } from '../utils.js';

const DUMMY = new THREE.Object3D();
const COLOR = new THREE.Color();

function createBoxGeometry() {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.computeBoundingSphere();
  return geo;
}

export const sharedGeometry = createBoxGeometry();

function createOpaqueMaterial() {
  return new THREE.MeshLambertMaterial({
    color: 0xffffff,
  });
}

function createWaterMaterial() {
  return new THREE.MeshLambertMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });
}

export const sharedMaterials = {
  opaque: createOpaqueMaterial(),
  water: createWaterMaterial(),
};

export class Chunk {
  constructor(cx, cz, sizeX, sizeZ, height, originX, originZ) {
    this.cx = cx;
    this.cz = cz;
    this.sizeX = sizeX;
    this.sizeZ = sizeZ;
    this.height = height;
    this.originX = originX;
    this.originZ = originZ;
    this.dirty = true;
    this.opaqueMesh = null;
    this.waterMesh = null;
    this.instanceCount = 0;
  }

  build(world) {
    this.dispose();

    const { sizeX, sizeZ, height, originX, originZ } = this;
    const maxCells = sizeX * sizeZ * height;

    const opaquePos = new Float32Array(maxCells * 3);
    const opaqueColor = new Float32Array(maxCells * 3);
    const waterPos = new Float32Array(maxCells * 3);
    const waterColor = new Float32Array(maxCells * 3);
    let opaqueCount = 0;
    let waterCount = 0;

    for (let y = 0; y < height; y += 1) {
      for (let lz = 0; lz < sizeZ; lz += 1) {
        for (let lx = 0; lx < sizeX; lx += 1) {
          const wx = originX + lx;
          const wz = originZ + lz;
          const id = world.getBlock(wx, y, wz);
          if (id === BLOCK.AIR) continue;

          const up = world.getBlock(wx, y + 1, wz);
          const down = world.getBlock(wx, y - 1, wz);
          const east = world.getBlock(wx + 1, y, wz);
          const west = world.getBlock(wx - 1, y, wz);
          const south = world.getBlock(wx, y, wz + 1);
          const north = world.getBlock(wx, y, wz - 1);

          const visible =
            (!isOpaqueId(up) && !(id === BLOCK.WATER && up === BLOCK.WATER)) ||
            (!isOpaqueId(down) && !(id === BLOCK.WATER && down === BLOCK.WATER)) ||
            (!isOpaqueId(east) && !(id === BLOCK.WATER && east === BLOCK.WATER)) ||
            (!isOpaqueId(west) && !(id === BLOCK.WATER && west === BLOCK.WATER)) ||
            (!isOpaqueId(south) && !(id === BLOCK.WATER && south === BLOCK.WATER)) ||
            (!isOpaqueId(north) && !(id === BLOCK.WATER && north === BLOCK.WATER));

          if (!visible) continue;

          const def = blockDef(id);
          const jitter = 0.9 + hash3(wx, y, wz) * 0.18;
          const shade = isOpaqueId(up) ? 0.82 : 1;
          COLOR.setHex(def.color).multiplyScalar(jitter * shade);

          const isWater = id === BLOCK.WATER;
          const posArr = isWater ? waterPos : opaquePos;
          const colArr = isWater ? waterColor : opaqueColor;
          const i = (isWater ? waterCount : opaqueCount) * 3;

          posArr[i] = wx + 0.5;
          posArr[i + 1] = y + 0.5;
          posArr[i + 2] = wz + 0.5;
          colArr[i] = COLOR.r;
          colArr[i + 1] = COLOR.g;
          colArr[i + 2] = COLOR.b;

          if (isWater) waterCount += 1;
          else opaqueCount += 1;
        }
      }
    }

    if (opaqueCount > 0) {
      const mesh = new THREE.InstancedMesh(sharedGeometry, sharedMaterials.opaque, opaqueCount);
      for (let i = 0; i < opaqueCount; i += 1) {
        DUMMY.position.set(opaquePos[i * 3], opaquePos[i * 3 + 1], opaquePos[i * 3 + 2]);
        DUMMY.rotation.set(0, 0, 0);
        DUMMY.scale.set(1, 1, 1);
        DUMMY.updateMatrix();
        mesh.setMatrixAt(i, DUMMY.matrix);
        COLOR.setRGB(opaqueColor[i * 3], opaqueColor[i * 3 + 1], opaqueColor[i * 3 + 2]);
        mesh.setColorAt(i, COLOR);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.name = `chunk-opaque-${this.cx}-${this.cz}`;
      if (typeof mesh.computeBoundingSphere === 'function') mesh.computeBoundingSphere();
      else mesh.frustumCulled = false;
      this.opaqueMesh = mesh;
    }

    if (waterCount > 0) {
      const mesh = new THREE.InstancedMesh(sharedGeometry, sharedMaterials.water, waterCount);
      for (let i = 0; i < waterCount; i += 1) {
        DUMMY.position.set(waterPos[i * 3], waterPos[i * 3 + 1], waterPos[i * 3 + 2]);
        DUMMY.rotation.set(0, 0, 0);
        DUMMY.scale.set(1, 1, 1);
        DUMMY.updateMatrix();
        mesh.setMatrixAt(i, DUMMY.matrix);
        COLOR.setRGB(waterColor[i * 3], waterColor[i * 3 + 1], waterColor[i * 3 + 2]);
        mesh.setColorAt(i, COLOR);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.renderOrder = 10;
      mesh.name = `chunk-water-${this.cx}-${this.cz}`;
      if (typeof mesh.computeBoundingSphere === 'function') mesh.computeBoundingSphere();
      else mesh.frustumCulled = false;
      this.waterMesh = mesh;
    }

    this.instanceCount = opaqueCount + waterCount;
    this.dirty = false;
    return this.instanceCount;
  }

  attach(scene) {
    if (this.opaqueMesh) scene.add(this.opaqueMesh);
    if (this.waterMesh) scene.add(this.waterMesh);
  }

  dispose() {
    if (this.opaqueMesh) {
      this.opaqueMesh.removeFromParent();
      this.opaqueMesh.dispose();
      this.opaqueMesh = null;
    }
    if (this.waterMesh) {
      this.waterMesh.removeFromParent();
      this.waterMesh.dispose();
      this.waterMesh = null;
    }
    this.instanceCount = 0;
  }
}
