import * as THREE from 'three';
import { createSurfaceMaterial } from '../graphics/SurfaceMaterial.js';

export class RoadRibbon {
  constructor(scene, terrain) {
    const segments = 300;
    const halfWidth = 4.4;
    const positions = new Float32Array((segments + 1) * 2 * 3);
    const uvs = new Float32Array((segments + 1) * 2 * 2);
    const colors = new Float32Array((segments + 1) * 2 * 3);
    const indices = [];

    for (let i = 0; i <= segments; i += 1) {
      const z = (i / segments) * (terrain.sizeZ - 1);
      const cx = terrain.data.roadX(z);
      const y = terrain.data.roadH[Math.min(Math.max(Math.round(z), 0), terrain.sizeZ - 1)] + 0.16;

      for (let s = 0; s < 2; s += 1) {
        const side = s === 0 ? -1 : 1;
        const x = cx + side * halfWidth;
        const idx = (i * 2 + s) * 3;
        positions[idx] = x;
        positions[idx + 1] = y + (s === 0 || s === 1 ? 0 : 0);
        positions[idx + 2] = z;
        const uvIdx = (i * 2 + s) * 2;
        uvs[uvIdx] = s;
        uvs[uvIdx + 1] = i / 12;
        const shade = 0.9 + (s === 0 ? 0.05 : 0) + Math.random() * 0.08;
        colors[idx] = shade;
        colors[idx + 1] = shade;
        colors[idx + 2] = shade;
      }

      if (i < segments) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const material = createSurfaceMaterial(5, {
      vertexColors: true,
      color: 0x55504b,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'road';
    mesh.receiveShadow = true;
    scene.add(mesh);
    this.mesh = mesh;
  }
}
