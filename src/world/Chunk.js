import * as THREE from 'three';
import { BLOCK, isOpaqueId, blockDef, isGlowId } from './blocks.js';
import { hash3 } from '../utils.js';
import { createVoxelMaterial, createGlowMaterial } from '../graphics/VoxelMaterial.js';
import { createWaterMaterial } from '../graphics/WaterMaterial.js';

const DUMMY = new THREE.Object3D();
const COLOR = new THREE.Color();

export const templateGeometry = new THREE.BoxGeometry(1, 1, 1);

export const sharedMaterials = {
  opaque: createVoxelMaterial(),
  water: createWaterMaterial(),
  glow: createGlowMaterial(),
};

function prepareGeometry(blockIds, foams, phases) {
  const geometry = templateGeometry.clone();
  if (blockIds) {
    geometry.setAttribute('aBlockId', new THREE.InstancedBufferAttribute(blockIds, 1));
  }
  if (foams) {
    geometry.setAttribute('aFoam', new THREE.InstancedBufferAttribute(foams, 1));
    geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
  }
  return geometry;
}

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
    this.meshes = [];
    this.instanceCount = 0;
  }

  build(world) {
    this.dispose();

    const { sizeX, sizeZ, height, originX, originZ } = this;
    const maxCells = sizeX * sizeZ * height;

    const opaquePos = new Float32Array(maxCells * 3);
    const opaqueColor = new Float32Array(maxCells * 3);
    const opaqueId = new Float32Array(maxCells);

    const waterPos = new Float32Array(maxCells * 3);
    const waterColor = new Float32Array(maxCells * 3);
    const waterFoam = new Float32Array(maxCells);
    const waterPhase = new Float32Array(maxCells);

    const glowPos = new Float32Array(maxCells * 3);
    const glowColor = new Float32Array(maxCells * 3);

    let opaqueCount = 0;
    let waterCount = 0;
    let glowCount = 0;

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

          const faceUp = !isOpaqueId(up) && !(id === BLOCK.WATER && up === BLOCK.WATER);
          const faceDown = !isOpaqueId(down) && !(id === BLOCK.WATER && down === BLOCK.WATER);
          const faceEast = !isOpaqueId(east) && !(id === BLOCK.WATER && east === BLOCK.WATER);
          const faceWest = !isOpaqueId(west) && !(id === BLOCK.WATER && west === BLOCK.WATER);
          const faceSouth = !isOpaqueId(south) && !(id === BLOCK.WATER && south === BLOCK.WATER);
          const faceNorth = !isOpaqueId(north) && !(id === BLOCK.WATER && north === BLOCK.WATER);

          if (!(faceUp || faceDown || faceEast || faceWest || faceSouth || faceNorth)) continue;

          const def = blockDef(id);
          const isWater = id === BLOCK.WATER;
          const isGlow = isGlowId(id);
          const jitter = 0.9 + hash3(wx, y, wz) * 0.18;
          const shade = isOpaqueId(up) ? 0.84 : 1;
          COLOR.setHex(def.color).multiplyScalar(jitter * shade);

          if (isWater) {
            const i = waterCount * 3;
            waterPos[i] = wx + 0.5;
            waterPos[i + 1] = y + 0.5;
            waterPos[i + 2] = wz + 0.5;
            waterColor[i] = COLOR.r;
            waterColor[i + 1] = COLOR.g;
            waterColor[i + 2] = COLOR.b;

            let contacts = 0;
            if (isOpaqueId(east)) contacts += 1;
            if (isOpaqueId(west)) contacts += 1;
            if (isOpaqueId(south)) contacts += 1;
            if (isOpaqueId(north)) contacts += 1;
            const surface = up === BLOCK.AIR ? 0.55 : 0;
            waterFoam[waterCount] = Math.min(1, contacts * 0.3 + surface);
            waterPhase[waterCount] = hash3(wx, 7, wz) * 6.283;
            waterCount += 1;
          } else if (isGlow) {
            const i = glowCount * 3;
            glowPos[i] = wx + 0.5;
            glowPos[i + 1] = y + 0.5;
            glowPos[i + 2] = wz + 0.5;
            const boost = id === BLOCK.SHOJI ? 1.75 : 1.55;
            glowColor[i] = Math.min(2.4, COLOR.r * boost);
            glowColor[i + 1] = Math.min(2.4, COLOR.g * boost);
            glowColor[i + 2] = Math.min(2.4, COLOR.b * boost);
            glowCount += 1;
          } else {
            const i = opaqueCount * 3;
            opaquePos[i] = wx + 0.5;
            opaquePos[i + 1] = y + 0.5;
            opaquePos[i + 2] = wz + 0.5;
            opaqueColor[i] = COLOR.r;
            opaqueColor[i + 1] = COLOR.g;
            opaqueColor[i + 2] = COLOR.b;
            opaqueId[opaqueCount] = id;
            opaqueCount += 1;
          }
        }
      }
    }

    if (opaqueCount > 0) {
      const geometry = prepareGeometry(opaqueId.subarray(0, opaqueCount), null, null);
      const mesh = new THREE.InstancedMesh(geometry, sharedMaterials.opaque, opaqueCount);
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
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = `chunk-opaque-${this.cx}-${this.cz}`;
      if (typeof mesh.computeBoundingSphere === 'function') mesh.computeBoundingSphere();
      else mesh.frustumCulled = false;
      this.meshes.push(mesh);
    }

    if (waterCount > 0) {
      const geometry = prepareGeometry(
        null,
        waterFoam.subarray(0, waterCount),
        waterPhase.subarray(0, waterCount)
      );
      const mesh = new THREE.InstancedMesh(geometry, sharedMaterials.water, waterCount);
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
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.renderOrder = 10;
      mesh.name = `chunk-water-${this.cx}-${this.cz}`;
      if (typeof mesh.computeBoundingSphere === 'function') mesh.computeBoundingSphere();
      else mesh.frustumCulled = false;
      this.meshes.push(mesh);
    }

    if (glowCount > 0) {
      const mesh = new THREE.InstancedMesh(templateGeometry, sharedMaterials.glow, glowCount);
      for (let i = 0; i < glowCount; i += 1) {
        DUMMY.position.set(glowPos[i * 3], glowPos[i * 3 + 1], glowPos[i * 3 + 2]);
        DUMMY.rotation.set(0, 0, 0);
        DUMMY.scale.set(1, 1, 1);
        DUMMY.updateMatrix();
        mesh.setMatrixAt(i, DUMMY.matrix);
        COLOR.setRGB(glowColor[i * 3], glowColor[i * 3 + 1], glowColor[i * 3 + 2]);
        mesh.setColorAt(i, COLOR);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.renderOrder = 8;
      mesh.name = `chunk-glow-${this.cx}-${this.cz}`;
      if (typeof mesh.computeBoundingSphere === 'function') mesh.computeBoundingSphere();
      else mesh.frustumCulled = false;
      this.meshes.push(mesh);
    }

    this.instanceCount = opaqueCount + waterCount + glowCount;
    this.dirty = false;
    return this.instanceCount;
  }

  attach(scene) {
    for (const mesh of this.meshes) scene.add(mesh);
  }

  dispose() {
    for (const mesh of this.meshes) {
      mesh.removeFromParent();
      if (mesh.geometry !== templateGeometry) mesh.geometry.dispose();
      mesh.dispose();
    }
    this.meshes = [];
    this.instanceCount = 0;
  }
}
