import * as THREE from 'three';
import { createSurfaceMaterial } from '../graphics/SurfaceMaterial.js';

export const PROP_PALETTE = [
  { id: 'stone', name: 'Mountain Stone', color: 0x8a8f94, detail: 3 },
  { id: 'wood', name: 'Cedar Timber', color: 0x9a6b42, detail: 6 },
  { id: 'thatch', name: 'Thatch Bundle', color: 0xcfa85e, detail: 7 },
  { id: 'moss', name: 'Mossy Boulder', color: 0x6f8566, detail: 19 },
  { id: 'sand', name: 'River Sand', color: 0xcbb68c, detail: 4 },
  { id: 'snow', name: 'Snow Pack', color: 0xe9f0f5, detail: 11 },
];

function blockGeometry() {
  const geo = new THREE.BoxGeometry(1.15, 1.15, 1.15, 3, 3, 3);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    pos.setXYZ(
      i,
      pos.getX(i) * (1 + (Math.random() - 0.5) * 0.05),
      pos.getY(i) * (1 + (Math.random() - 0.5) * 0.05),
      pos.getZ(i) * (1 + (Math.random() - 0.5) * 0.05)
    );
  }
  geo.computeVertexNormals();
  return geo;
}

export class Props {
  constructor(scene, terrain) {
    this.terrain = terrain;
    this.group = new THREE.Group();
    this.group.name = 'props';
    scene.add(this.group);
    this.items = [];
    this.geometry = blockGeometry();
    this.materials = PROP_PALETTE.map((p) => createSurfaceMaterial(p.detail, { color: p.color }));
  }

  add(x, y, z, typeIndex) {
    const type = Math.min(Math.max(typeIndex, 0), PROP_PALETTE.length - 1);
    const mesh = new THREE.Mesh(this.geometry, this.materials[type]);
    mesh.position.set(x, y, z);
    mesh.rotation.y = Math.random() * 0.16 - 0.08;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.prop = { type, half: 0.58 };
    this.group.add(mesh);
    this.items.push(mesh);
    return mesh;
  }

  remove(mesh) {
    const index = this.items.indexOf(mesh);
    if (index >= 0) this.items.splice(index, 1);
    mesh.removeFromParent();
    return index >= 0;
  }

  topAt(x, z, feetY) {
    let top = -Infinity;
    for (const mesh of this.items) {
      const dx = Math.abs(mesh.position.x - x);
      const dz = Math.abs(mesh.position.z - z);
      const half = mesh.userData.prop.half;
      if (dx > half || dz > half) continue;
      const blockTop = mesh.position.y + half;
      if (blockTop <= feetY + 1.25 && blockTop > top) top = blockTop;
    }
    return top;
  }

  blockingAt(x, z, feetY, height) {
    for (const mesh of this.items) {
      const half = mesh.userData.prop.half;
      const dx = Math.abs(mesh.position.x - x);
      const dz = Math.abs(mesh.position.z - z);
      if (dx > half + 0.32 || dz > half + 0.32) continue;
      const blockTop = mesh.position.y + half;
      const blockBottom = mesh.position.y - half;
      if (blockTop > feetY + 1.25 && blockBottom < feetY + height) return mesh;
    }
    return null;
  }
}
