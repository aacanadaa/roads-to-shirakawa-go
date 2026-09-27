import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createSurfaceMaterial } from '../graphics/SurfaceMaterial.js';

function painted(input, hex, variance = 0.12) {
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

function buildLantern() {
  const stone = [];
  const glow = [];

  const base = new THREE.CylinderGeometry(0.75, 0.95, 0.5, 8);
  base.translate(0, 0.25, 0);
  stone.push(painted(base, 0x8c8880));

  const pillar = new THREE.CylinderGeometry(0.32, 0.42, 1.5, 8);
  pillar.translate(0, 1.25, 0);
  stone.push(painted(pillar, 0x938f86));

  const platform = new THREE.CylinderGeometry(0.85, 0.7, 0.34, 8);
  platform.translate(0, 2.15, 0);
  stone.push(painted(platform, 0x8c8880));

  const chamber = new THREE.BoxGeometry(1.05, 0.95, 1.05);
  chamber.translate(0, 2.78, 0);
  glow.push(painted(chamber, 0xffd9a0, 0.04));

  const cap = new THREE.CylinderGeometry(0.15, 1.05, 0.72, 8);
  cap.translate(0, 3.6, 0);
  stone.push(painted(cap, 0x7f7b73));

  const finial = new THREE.SphereGeometry(0.22, 8, 6);
  finial.translate(0, 4.05, 0);
  stone.push(painted(finial, 0x8c8880));

  return {
    stone: mergeGeometries(stone, false),
    glow: mergeGeometries(glow, false),
  };
}

export class LanternRow {
  constructor(scene, lanterns, terrain) {
    const model = buildLantern();
    const dummy = new THREE.Object3D();

    const stoneMesh = new THREE.InstancedMesh(
      model.stone,
      createSurfaceMaterial(3, { vertexColors: true }),
      lanterns.length
    );
    const glowMesh = new THREE.InstancedMesh(
      model.glow,
      new THREE.MeshBasicMaterial({ vertexColors: true, fog: true }),
      lanterns.length
    );

    lanterns.forEach((l, i) => {
      const y = terrain.sampleHeight(l.x, l.z) - 0.08;
      dummy.position.set(l.x, y, l.z);
      dummy.rotation.set(0, l.yaw, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      stoneMesh.setMatrixAt(i, dummy.matrix);
      glowMesh.setMatrixAt(i, dummy.matrix);
    });

    for (const mesh of [stoneMesh, glowMesh]) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (typeof mesh.computeBoundingSphere === 'function') mesh.computeBoundingSphere();
      scene.add(mesh);
    }
    glowMesh.name = 'lanterns-glow';
    stoneMesh.name = 'lanterns-stone';
    this.stone = stoneMesh;
    this.glow = glowMesh;
    this.lights = lanterns.map((l) => ({
      x: l.x,
      y: terrain.sampleHeight(l.x, l.z) + 2.8,
      z: l.z,
    }));
  }
}
