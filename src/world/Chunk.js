import * as THREE from 'three';
import { BLOCK, blockDef, isOpaqueId, isGlowId, isFoliageId, isDetailSpriteId } from './blocks.js';
import { hash3 } from '../utils.js';
import { createVoxelMaterial, createGlowMaterial } from '../graphics/VoxelMaterial.js';
import { createWaterMaterial } from '../graphics/WaterMaterial.js';

const COLOR = new THREE.Color();

export const sharedMaterials = {
  opaque: createVoxelMaterial(),
  water: createWaterMaterial(),
  glow: createGlowMaterial(),
};

// Face table: dir + 4 corners (CCW from outside) + base shade.
// Corners are in block-local [0,1] coords.
const FACES = [
  { dir: [-1, 0, 0], shade: 0.62, corners: [[0, 1, 0], [0, 0, 0], [0, 1, 1], [0, 0, 1]] },
  { dir: [1, 0, 0], shade: 0.8, corners: [[1, 1, 1], [1, 0, 1], [1, 1, 0], [1, 0, 0]] },
  { dir: [0, -1, 0], shade: 0.5, corners: [[1, 0, 1], [0, 0, 1], [1, 0, 0], [0, 0, 0]] },
  { dir: [0, 1, 0], shade: 1.0, corners: [[0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 0]] },
  { dir: [0, 0, -1], shade: 0.58, corners: [[1, 0, 0], [0, 0, 0], [1, 1, 0], [0, 1, 0]] },
  { dir: [0, 0, 1], shade: 0.72, corners: [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]] },
];

const AO_CURVE = [0.38, 0.6, 0.78, 1.0];

class GeomBuilder {
  constructor() {
    this.positions = [];
    this.normals = [];
    this.colors = [];
    this.blockIds = [];
    this.wind = [];
    this.foam = [];
    this.indices = [];
  }

  get vertexCount() {
    return this.positions.length / 3;
  }

  pushVertex(px, py, pz, nx, ny, nz, r, g, b, blockId, wind, foam) {
    this.positions.push(px, py, pz);
    this.normals.push(nx, ny, nz);
    this.colors.push(r, g, b);
    this.blockIds.push(blockId);
    this.wind.push(wind);
    this.foam.push(foam);
    return this.vertexCount - 1;
  }

  pushQuad(a, b, c, d) {
    this.indices.push(a, b, c, c, b, d);
  }

  build(name) {
    if (this.indices.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geo.setAttribute('aBlockId', new THREE.Float32BufferAttribute(this.blockIds, 1));
    geo.setAttribute('aWind', new THREE.Float32BufferAttribute(this.wind, 1));
    geo.setAttribute('aFoam', new THREE.Float32BufferAttribute(this.foam, 1));
    geo.setIndex(this.indices);
    geo.computeBoundingSphere();
    return geo;
  }
}

function faceVisible(world, x, y, z, id, dir) {
  const nid = world.getBlock(x + dir[0], y + dir[1], z + dir[2]);
  if (id === BLOCK.WATER) {
    // Water renders against air and against non-water see-through blocks.
    if (nid === BLOCK.WATER) return false;
    return !isOpaqueId(nid);
  }
  if (isDetailSpriteId(id)) return nid !== id && !isOpaqueId(nid);
  return !isOpaqueId(nid);
}

// Classic voxel AO: sample the 3 neighbours around each face vertex.
function vertexAO(world, x, y, z, face, corner) {
  const axis = face.dir[0] !== 0 ? 0 : face.dir[1] !== 0 ? 1 : 2;
  const t1 = (axis + 1) % 3;
  const t2 = (axis + 2) % 3;
  const base = [x + face.dir[0], y + face.dir[1], z + face.dir[2]];
  const o1 = corner[t1] ? 1 : -1;
  const o2 = corner[t2] ? 1 : -1;

  const p1 = [base[0], base[1], base[2]];
  p1[t1] += o1;
  const p2 = [base[0], base[1], base[2]];
  p2[t2] += o2;
  const pc = [base[0], base[1], base[2]];
  pc[t1] += o1;
  pc[t2] += o2;

  const s1 = isOpaqueId(world.getBlock(p1[0], p1[1], p1[2])) ? 1 : 0;
  const s2 = isOpaqueId(world.getBlock(p2[0], p2[1], p2[2])) ? 1 : 0;
  const cc = isOpaqueId(world.getBlock(pc[0], pc[1], pc[2])) ? 1 : 0;
  if (s1 && s2) return 0;
  return 3 - (s1 + s2 + cc);
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
    const opaque = new GeomBuilder();
    const water = new GeomBuilder();
    const glow = new GeomBuilder();

    for (let y = 0; y < height; y += 1) {
      for (let lz = 0; lz < sizeZ; lz += 1) {
        for (let lx = 0; lx < sizeX; lx += 1) {
          const wx = originX + lx;
          const wz = originZ + lz;
          const id = world.getBlock(wx, y, wz);
          if (id === BLOCK.AIR) continue;

          const isWater = id === BLOCK.WATER;
          const isGlow = isGlowId(id);
          const isSprite = isDetailSpriteId(id);
          const foliage = isFoliageId(id);
          const target = isWater ? water : isGlow ? glow : opaque;

          const def = blockDef(id);
          COLOR.setHex(def.color);

          // Per-block tonal variation: hash jitter + subtle vertical banding.
          const jitter = 0.9 + hash3(wx, y, wz) * 0.2;
          const band = 0.97 + hash3(wx * 3 + 11, y * 5 + 3, wz * 3 + 7) * 0.06;

          // Water foam factor (banks + surface).
          let foam = 0;
          if (isWater) {
            let contacts = 0;
            if (isOpaqueId(world.getBlock(wx + 1, y, wz))) contacts += 1;
            if (isOpaqueId(world.getBlock(wx - 1, y, wz))) contacts += 1;
            if (isOpaqueId(world.getBlock(wx, y, wz + 1))) contacts += 1;
            if (isOpaqueId(world.getBlock(wx, y, wz - 1))) contacts += 1;
            const surface = world.getBlock(wx, y + 1, wz) === BLOCK.AIR ? 0.55 : 0;
            foam = Math.min(1, contacts * 0.32 + surface);
          }

          for (let f = 0; f < 6; f += 1) {
            const face = FACES[f];
            if (isSprite && f === 2) continue; // sprites skip bottom face
            if (!faceVisible(world, wx, y, wz, id, face.dir)) continue;

            const ids = [];
            const aos = [];
            for (let v = 0; v < 4; v += 1) {
              const c = face.corners[v];
              let px = wx + c[0];
              let py = y + c[1];
              let pz = wz + c[2];

              if (isWater && c[1] === 1) py -= 0.14; // lowered waterline
              if (isSprite) {
                // Shrink to a bottom-anchored tuft so meadows look delicate.
                px = wx + 0.5 + (c[0] - 0.5) * 0.5;
                pz = wz + 0.5 + (c[2] - 0.5) * 0.5;
                if (c[1] === 1) py = y + 0.62;
              }

              const ao = isWater || isGlow || isSprite ? 3 : vertexAO(world, wx, y, wz, face, c);
              aos.push(ao);
              const aoLight = AO_CURVE[ao];

              let shade = face.shade;
              if (isWater) shade = face.dir[1] === 1 ? 1.0 : 0.86;
              if (isSprite) shade = face.dir[1] === 1 ? 1.0 : 0.82;

              // Grass tops get a lively sunlit tint; sides stay earthy.
              let r = COLOR.r;
              let g = COLOR.g;
              let b = COLOR.b;
              if (id === BLOCK.GRASS && face.dir[1] === 1) {
                g *= 1.06;
                r *= 0.98;
              }

              let mult = shade * jitter * band * aoLight;
              if (isGlow) {
                const boost = id === BLOCK.SHOJI ? 1.8 : 1.6;
                r = Math.min(2.6, r * boost + 0.25);
                g = Math.min(2.6, g * boost + 0.18);
                b = Math.min(2.6, b * boost + 0.08);
                mult = 1;
              }

              const wind = foliage && c[1] === 1 ? 1 : foliage ? 0.45 : 0;
              ids.push(
                target.pushVertex(px, py, pz, face.dir[0], face.dir[1], face.dir[2],
                  r * mult, g * mult, b * mult, id, wind, foam)
              );
            }

            // Flip triangulation when it interpolates AO better.
            if (aos[0] + aos[3] > aos[1] + aos[2]) {
              target.pushQuad(ids[0], ids[1], ids[2], ids[3]);
            } else {
              target.indices.push(ids[1], ids[3], ids[0], ids[0], ids[3], ids[2]);
            }
          }
        }
      }
    }

    let faces = 0;
    const oGeo = opaque.build('opaque');
    if (oGeo) {
      const mesh = new THREE.Mesh(oGeo, sharedMaterials.opaque);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = `chunk-opaque-${this.cx}-${this.cz}`;
      mesh.matrixAutoUpdate = false;
      this.meshes.push(mesh);
      faces += oGeo.index.count / 3;
    }

    const wGeo = water.build('water');
    if (wGeo) {
      const mesh = new THREE.Mesh(wGeo, sharedMaterials.water);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.renderOrder = 10;
      mesh.name = `chunk-water-${this.cx}-${this.cz}`;
      mesh.matrixAutoUpdate = false;
      mesh.frustumCulled = true;
      this.meshes.push(mesh);
      faces += wGeo.index.count / 3;
    }

    const gGeo = glow.build('glow');
    if (gGeo) {
      const mesh = new THREE.Mesh(gGeo, sharedMaterials.glow);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.renderOrder = 8;
      mesh.name = `chunk-glow-${this.cx}-${this.cz}`;
      mesh.matrixAutoUpdate = false;
      this.meshes.push(mesh);
      faces += gGeo.index.count / 3;
    }

    this.instanceCount = faces;
    this.dirty = false;
    return this.instanceCount;
  }

  attach(scene) {
    for (const mesh of this.meshes) scene.add(mesh);
  }

  dispose() {
    for (const mesh of this.meshes) {
      mesh.removeFromParent();
      if (mesh.geometry) mesh.geometry.dispose();
    }
    this.meshes = [];
    this.instanceCount = 0;
  }
}
