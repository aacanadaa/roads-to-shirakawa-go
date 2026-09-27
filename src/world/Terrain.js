import * as THREE from 'three';
import {
  terrainVertexPars,
  terrainVertex,
  terrainFragmentPars,
  terrainFragment,
} from '../shaders/terrain.js';

export function createTerrainMaterial() {
  const material = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    fog: true,
  });

  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${terrainVertexPars}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${terrainVertex}`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${terrainFragmentPars}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${terrainFragment}`);
  };

  material.customProgramCacheKey = () => 'terrain-splat-v1';
  return material;
}

export class Terrain {
  constructor(scene, data) {
    this.scene = scene;
    this.data = data;
    this.sizeX = data.sizeX;
    this.sizeZ = data.sizeZ;
    this.heights = data.heights;
    this.waterY = data.waterY;
    this.segments = Math.min(320, this.sizeX);

    const geometry = new THREE.PlaneGeometry(this.sizeX, this.sizeZ, this.segments, this.segments);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(this.sizeX / 2, 0, this.sizeZ / 2);

    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, this.sampleHeight(x, z));
    }
    pos.needsUpdate = true;
    geometry.computeVertexNormals();
    this.geometry = geometry;

    this.material = createTerrainMaterial();
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.name = 'terrain';
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;
    scene.add(this.mesh);
  }

  sampleHeight(x, z) {
    const maxX = this.sizeX - 1;
    const maxZ = this.sizeZ - 1;
    const cx = Math.min(Math.max(x, 0), maxX);
    const cz = Math.min(Math.max(z, 0), maxZ);
    const x0 = Math.floor(cx);
    const z0 = Math.floor(cz);
    const x1 = Math.min(x0 + 1, maxX);
    const z1 = Math.min(z0 + 1, maxZ);
    const fx = cx - x0;
    const fz = cz - z0;
    const h00 = this.heights[z0 * this.sizeX + x0];
    const h10 = this.heights[z0 * this.sizeX + x1];
    const h01 = this.heights[z1 * this.sizeX + x0];
    const h11 = this.heights[z1 * this.sizeX + x1];
    return (
      h00 * (1 - fx) * (1 - fz) +
      h10 * fx * (1 - fz) +
      h01 * (1 - fx) * fz +
      h11 * fx * fz
    );
  }

  waterHeightAt(x, z) {
    const xi = Math.min(Math.max(Math.round(x), 0), this.sizeX - 1);
    const zi = Math.min(Math.max(Math.round(z), 0), this.sizeZ - 1);
    return this.waterY[zi * this.sizeX + xi];
  }

  isWaterAt(x, z) {
    const h = this.sampleHeight(x, z);
    const w = this.waterHeightAt(x, z);
    return w > -900 && h < w - 0.15;
  }

  slopeAt(x, z) {
    const d = 1.5;
    const hx = this.sampleHeight(x + d, z) - this.sampleHeight(x - d, z);
    const hz = this.sampleHeight(x, z + d) - this.sampleHeight(x, z - d);
    return Math.hypot(hx, hz) / (2 * d);
  }

  surfaceAt(x, z) {
    if (this.isWaterAt(x, z)) return 'water';
    const h = this.sampleHeight(x, z);
    const w = this.waterHeightAt(x, z);
    const slope = this.slopeAt(x, z);
    if (h > 52) return 'snow';
    if (slope > 0.62) return 'stone';
    if (w > -900 && h < w + 1.2) return 'gravel';
    const dRoad = Math.abs(x - this.data.roadX(Math.min(Math.max(z, 0), this.sizeZ - 1)));
    if (dRoad < 6.5) return 'gravel';
    return 'grass';
  }

  deform(x, z, radius, delta) {
    const pos = this.geometry.attributes.position;
    const r2 = radius * radius;
    let changed = false;
    for (let i = 0; i < pos.count; i += 1) {
      const dx = pos.getX(i) - x;
      const dz = pos.getZ(i) - z;
      const d2 = dx * dx + dz * dz;
      if (d2 > r2) continue;
      const fall = 1 - Math.sqrt(d2) / radius;
      const strength = fall * fall * (3 - 2 * fall);
      const yi = Math.min(Math.max(Math.round(pos.getZ(i)), 0), this.sizeZ - 1);
      const xi = Math.min(Math.max(Math.round(pos.getX(i)), 0), this.sizeX - 1);
      const idx = yi * this.sizeX + xi;
      const next = Math.max(2, this.heights[idx] + delta * strength);
      this.heights[idx] = next;
      pos.setY(i, this.sampleHeight(pos.getX(i), pos.getZ(i)));
      changed = true;
    }
    if (changed) {
      pos.needsUpdate = true;
      this.geometry.computeVertexNormals();
    }
    return changed;
  }
}
