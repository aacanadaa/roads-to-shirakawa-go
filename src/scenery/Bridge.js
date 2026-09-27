import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createSurfaceMaterial } from '../graphics/SurfaceMaterial.js';

function painted(input, hex, variance = 0.14) {
  const geometry = input.index ? input.toNonIndexed() : input;
  const count = geometry.attributes.position.count;
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color(hex);
  for (let i = 0; i < count; i += 1) {
    const j = 1 + (Math.random() - 0.5) * variance;
    colors[i * 3] = color.r * j;
    colors[i * 3 + 1] = color.g * j;
    colors[i * 3 + 2] = color.b * j;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function buildBridge() {
  const parts = [];
  const length = 22;
  const width = 7.5;
  const plankCount = 26;

  for (let i = 0; i < plankCount; i += 1) {
    const z = -length / 2 + (i / (plankCount - 1)) * length;
    const plank = new THREE.BoxGeometry(width, 0.28, 0.62);
    const jitterY = (Math.random() - 0.5) * 0.06;
    const jitterR = (Math.random() - 0.5) * 0.035;
    plank.rotateX(Math.PI / 2);
    plank.rotateY(Math.PI / 2);
    plank.translate(0, jitterY, z);
    const rotated = plank.clone();
    rotated.rotateX(jitterR);
    parts.push(painted(rotated, 0x8a5f3a, 0.2));
  }

  for (const sx of [-1, 1]) {
    const beam = new THREE.BoxGeometry(0.42, 0.34, length);
    beam.translate((sx * width) / 2 - sx * 0.35, -0.28, 0);
    parts.push(painted(beam, 0x6f4a2c, 0.12));
  }

  for (const sx of [-1, 1]) {
    for (let i = 0; i < 7; i += 1) {
      const z = -length / 2 + (i / 6) * length;
      const post = new THREE.BoxGeometry(0.34, 2.1, 0.34);
      post.translate((sx * width) / 2, 1.0, z);
      parts.push(painted(post, 0x6f4a2c, 0.12));
    }

    for (const y of [1.85, 1.15]) {
      const rail = new THREE.BoxGeometry(0.26, 0.22, length);
      rail.translate((sx * width) / 2, y, 0);
      parts.push(painted(rail, 0x7d5533, 0.12));
    }
  }

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const pile = new THREE.CylinderGeometry(0.32, 0.38, 4.2, 7);
      pile.translate((sx * width) / 2 - sx * 0.6, -2.2, sz * (length / 2 - 1.2));
      parts.push(painted(pile, 0x5d4326, 0.12));
    }
  }

  return mergeGeometries(parts, false);
}

export class Bridges {
  constructor(scene, bridges, terrain) {
    const geometry = buildBridge();
    const material = createSurfaceMaterial(6, { vertexColors: true });
    this.meshes = [];

    for (const bridge of bridges) {
      const mesh = new THREE.Mesh(geometry, material);
      const y = terrain.sampleHeight(bridge.x, bridge.z);
      mesh.position.set(bridge.x, Math.max(bridge.y, y + 0.35), bridge.z);
      mesh.rotation.y = bridge.yaw;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = 'bridge';
      scene.add(mesh);
      this.meshes.push(mesh);
    }
  }
}
