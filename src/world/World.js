import * as THREE from 'three';
import { BLOCK, isSolidId } from './blocks.js';
import { Chunk } from './Chunk.js';

export class World {
  constructor(scene, { sizeX, sizeZ, height, chunkSize }) {
    this.scene = scene;
    this.sizeX = sizeX;
    this.sizeZ = sizeZ;
    this.height = height;
    this.chunkSize = chunkSize;
    this.chunksX = Math.ceil(sizeX / chunkSize);
    this.chunksZ = Math.ceil(sizeZ / chunkSize);
    this.data = new Uint8Array(sizeX * sizeZ * height);
    this.chunks = new Array(this.chunksX * this.chunksZ);
    this.meta = null;

    for (let cz = 0; cz < this.chunksZ; cz += 1) {
      for (let cx = 0; cx < this.chunksX; cx += 1) {
        const size = Math.min(chunkSize, sizeX - cx * chunkSize);
        const depth = Math.min(chunkSize, sizeZ - cz * chunkSize);
        this.chunks[cz * this.chunksX + cx] = new Chunk(
          cx,
          cz,
          size,
          depth,
          height,
          cx * chunkSize,
          cz * chunkSize
        );
      }
    }
  }

  index(x, y, z) {
    return (y * this.sizeZ + z) * this.sizeX + x;
  }

  inBounds(x, y, z) {
    return x >= 0 && x < this.sizeX && y >= 0 && y < this.height && z >= 0 && z < this.sizeZ;
  }

  getBlock(x, y, z) {
    if (y < 0) return BLOCK.BEDROCK;
    if (y >= this.height) return BLOCK.AIR;
    if (x < 0 || x >= this.sizeX || z < 0 || z >= this.sizeZ) return BLOCK.AIR;
    return this.data[this.index(x, y, z)];
  }

  setBlock(x, y, z, id) {
    if (!this.inBounds(x, y, z)) return false;
    this.data[this.index(x, y, z)] = id;
    this.markDirty(x, z);
    return true;
  }

  isSolid(x, y, z) {
    return isSolidId(this.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)));
  }

  isSolidAt(x, y, z) {
    return isSolidId(this.getBlock(x, y, z));
  }

  markDirty(x, z) {
    const cx = Math.floor(x / this.chunkSize);
    const cz = Math.floor(z / this.chunkSize);
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (nx < 0 || nx >= this.chunksX || nz < 0 || nz >= this.chunksZ) continue;
        this.chunks[nz * this.chunksX + nx].dirty = true;
      }
    }
  }

  markAllDirty() {
    for (const chunk of this.chunks) chunk.dirty = true;
  }

  rebuildDirty() {
    let rebuilt = 0;
    for (const chunk of this.chunks) {
      if (!chunk.dirty) continue;
      const count = chunk.build(this);
      chunk.attach(this.scene);
      rebuilt += 1;
      if (count === 0) chunk.dispose();
    }
    return rebuilt;
  }

  buildAll() {
    for (const chunk of this.chunks) {
      chunk.build(this);
      chunk.attach(this.scene);
    }
  }

  raycast(origin, direction, maxDistance = 6) {
    const dir = direction.clone().normalize();

    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const stepX = dir.x > 0 ? 1 : dir.x < 0 ? -1 : 0;
    const stepY = dir.y > 0 ? 1 : dir.y < 0 ? -1 : 0;
    const stepZ = dir.z > 0 ? 1 : dir.z < 0 ? -1 : 0;

    const tDeltaX = stepX !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const tDeltaY = stepY !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dir.z) : Infinity;

    const fracX = origin.x - Math.floor(origin.x);
    const fracY = origin.y - Math.floor(origin.y);
    const fracZ = origin.z - Math.floor(origin.z);

    let tMaxX = stepX > 0 ? (1 - fracX) * tDeltaX : stepX < 0 ? fracX * tDeltaX : Infinity;
    let tMaxY = stepY > 0 ? (1 - fracY) * tDeltaY : stepY < 0 ? fracY * tDeltaY : Infinity;
    let tMaxZ = stepZ > 0 ? (1 - fracZ) * tDeltaZ : stepZ < 0 ? fracZ * tDeltaZ : Infinity;

    if (stepX < 0 && fracX === 0) tMaxX = 0;
    if (stepY < 0 && fracY === 0) tMaxY = 0;
    if (stepZ < 0 && fracZ === 0) tMaxZ = 0;

    let t = 0;
    let nx = 0;
    let ny = 0;
    let nz = 0;

    for (let i = 0; i < 512; i += 1) {
      const id = this.getBlock(x, y, z);
      if (isSolidId(id)) {
        return {
          x,
          y,
          z,
          id,
          normal: { x: nx, y: ny, z: nz },
          distance: t,
        };
      }

      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX;
        t = tMaxX;
        tMaxX += tDeltaX;
        nx = -stepX; ny = 0; nz = 0;
      } else if (tMaxY < tMaxZ) {
        y += stepY;
        t = tMaxY;
        tMaxY += tDeltaY;
        nx = 0; ny = -stepY; nz = 0;
      } else {
        z += stepZ;
        t = tMaxZ;
        tMaxZ += tDeltaZ;
        nx = 0; ny = 0; nz = -stepZ;
      }

      if (t > maxDistance) return null;
    }
    return null;
  }

  dispose() {
    for (const chunk of this.chunks) chunk.dispose();
  }
}
