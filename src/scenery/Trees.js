import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { applyWind } from '../shaders/wind.js';

const _color = new THREE.Color();

function ensureAttributes(input, flex = 0) {
  const geometry = input.index ? input.toNonIndexed() : input;
  const count = geometry.attributes.position.count;
  if (!geometry.attributes.uv) {
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  if (!geometry.attributes.color) {
    const colors = new Float32Array(count * 3).fill(1);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  const flexes = new Float32Array(count).fill(flex);
  geometry.setAttribute('aFlex', new THREE.BufferAttribute(flexes, 1));
  return geometry;
}

function paint(geometry, hex, variance = 0) {
  const count = geometry.attributes.position.count;
  const colors = new Float32Array(count * 3);
  _color.setHex(hex);
  for (let i = 0; i < count; i += 1) {
    const jitter = 1 + (Math.random() - 0.5) * variance;
    colors[i * 3] = _color.r * jitter;
    colors[i * 3 + 1] = _color.g * jitter;
    colors[i * 3 + 2] = _color.b * jitter;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function jitter(geometry, amount) {
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    pos.setXYZ(
      i,
      pos.getX(i) + (Math.random() - 0.5) * amount,
      pos.getY(i) + (Math.random() - 0.5) * amount,
      pos.getZ(i) + (Math.random() - 0.5) * amount
    );
  }
  geometry.computeVertexNormals();
  return geometry;
}

function branch(len, r0, r1, flexTop) {
  const geo = new THREE.CylinderGeometry(r1, r0, len, 6, 2);
  geo.translate(0, len / 2, 0);
  const count = geo.attributes.position.count;
  const flexes = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    flexes[i] = (geo.attributes.position.getY(i) / len) * flexTop;
  }
  geo.setAttribute('aFlex', new THREE.BufferAttribute(flexes, 1));
  return geo;
}

function canopyBlob(radius, seed, flex = 1) {
  const geo = new THREE.IcosahedronGeometry(radius, 2);
  const pos = geo.attributes.position;
  const flexes = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const n =
      Math.sin(x * 1.7 + seed) * Math.cos(z * 1.9 - seed * 0.7) * 0.5 +
      Math.sin(y * 2.3 + seed * 1.3) * 0.35;
    const scale = 1 + n * 0.28;
    pos.setXYZ(i, x * scale, y * scale * 0.82, z * scale);
    flexes[i] = flex * (0.55 + 0.45 * (y / radius + 1) * 0.5);
  }
  geo.setAttribute('aFlex', new THREE.BufferAttribute(flexes, 1));
  return geo;
}

function buildPine(seed = 1) {
  const parts = [];
  const trunkH = 8.4;
  const trunk = new THREE.CylinderGeometry(0.22, 0.52, trunkH, 9, 4);
  trunk.translate(0, trunkH / 2, 0);
  parts.push(paint(ensureAttributes(trunk, 0.08), 0x5a4230, 0.18));

  const levels = 7;
  for (let l = 0; l < levels; l += 1) {
    const t = l / (levels - 1);
    const y = 2.2 + t * (trunkH - 1.6);
    const len = 3.6 * (1 - t * 0.78) + 0.55;
    const count = 5;
    for (let b = 0; b < count; b += 1) {
      const yaw = (b / count) * Math.PI * 2 + l * 1.1 + seed;
      const droop = -0.38 - t * 0.32;
      const geo = branch(len, 0.12, 0.035, 0.55);
      geo.rotateZ(Math.PI / 2 + droop);
      geo.rotateY(yaw);
      geo.translate(0, y, 0);
      parts.push(paint(ensureAttributes(geo, 0.5), 0x4a3826, 0.15));

      const clump = canopyBlob(0.95 + (1 - t) * 0.85, seed + l * 3 + b, 1);
      const tip = new THREE.Vector3(0, 0, 0);
      tip.x = Math.cos(yaw) * len * 0.72;
      tip.z = Math.sin(yaw) * len * 0.72;
      tip.y = y + len * 0.16;
      clump.translate(tip.x, tip.y, tip.z);
      parts.push(paint(ensureAttributes(clump, 1), 0x2c5c34, 0.22));
    }
  }

  const top = canopyBlob(1.5, seed * 2.1, 1);
  top.translate(0, trunkH - 0.4, 0);
  parts.push(paint(ensureAttributes(top, 1), 0x33663a, 0.2));
  return mergeGeometries(parts, false);
}

function buildMaple(seed = 2) {
  const parts = [];
  const trunkH = 5.6;
  const trunk = new THREE.CylinderGeometry(0.26, 0.55, trunkH, 9, 3);
  trunk.translate(0, trunkH / 2, 0);
  parts.push(paint(ensureAttributes(trunk, 0.1), 0x4f3a28, 0.16));

  for (let b = 0; b < 5; b += 1) {
    const yaw = (b / 5) * Math.PI * 2 + seed;
    const geo = branch(3.4, 0.17, 0.05, 0.7);
    geo.rotateZ(-0.72);
    geo.rotateY(yaw);
    geo.translate(0, trunkH * 0.82, 0);
    parts.push(paint(ensureAttributes(geo, 0.45), 0x4f3a28, 0.14));
  }

  const blobs = [
    [0, trunkH + 2.6, 0, 2.9],
    [1.9, trunkH + 1.6, 1.2, 2.1],
    [-1.8, trunkH + 1.8, -1.1, 2.2],
    [1.1, trunkH + 1.2, -1.9, 1.9],
    [-1.3, trunkH + 1.4, 1.8, 1.9],
  ];
  const palette = [0xc2552e, 0xd97b32, 0xb0431f, 0xe0a13c];
  blobs.forEach(([x, y, z, r], i) => {
    const blob = canopyBlob(r, seed + i * 2.7, 1);
    blob.translate(x, y, z);
    parts.push(paint(ensureAttributes(blob, 1), palette[i % palette.length], 0.24));
  });
  return mergeGeometries(parts, false);
}

function buildBirch(seed = 3) {
  const parts = [];
  const trunkH = 7.2;
  const trunk = new THREE.CylinderGeometry(0.18, 0.34, trunkH, 8, 4);
  trunk.translate(0, trunkH / 2, 0);
  parts.push(paint(ensureAttributes(trunk, 0.12), 0xd8d3c4, 0.1));

  for (let b = 0; b < 4; b += 1) {
    const yaw = (b / 4) * Math.PI * 2 + seed;
    const geo = branch(2.6, 0.1, 0.035, 0.75);
    geo.rotateZ(-0.62);
    geo.rotateY(yaw);
    geo.translate(0, trunkH * 0.72, 0);
    parts.push(paint(ensureAttributes(geo, 0.5), 0xc9c2b2, 0.1));
  }

  const blobs = [
    [0, trunkH + 1.4, 0, 2.2],
    [1.3, trunkH + 0.4, 0.8, 1.6],
    [-1.2, trunkH + 0.6, -0.9, 1.7],
    [0.4, trunkH + 2.2, -1.1, 1.5],
  ];
  blobs.forEach(([x, y, z, r], i) => {
    const blob = canopyBlob(r, seed + i * 1.9, 1);
    blob.translate(x, y, z);
    parts.push(paint(ensureAttributes(blob, 1), 0x7fae5c, 0.2));
  });
  return mergeGeometries(parts, false);
}

function buildBambooStalk(seed = 5) {
  const parts = [];
  const h = 11;
  const stalk = new THREE.CylinderGeometry(0.12, 0.16, h, 7, 6);
  stalk.translate(0, h / 2, 0);
  parts.push(paint(ensureAttributes(stalk, 0.25), 0x7fae5c, 0.12));

  for (let ring = 1; ring <= 6; ring += 1) {
    const node = new THREE.TorusGeometry(0.165, 0.035, 5, 10);
    node.rotateX(Math.PI / 2);
    node.translate(0, (h * ring) / 7, 0);
    parts.push(paint(ensureAttributes(node, 0.3), 0x6b9450, 0.1));
  }

  for (let l = 0; l < 8; l += 1) {
    const y = h * 0.55 + Math.random() * h * 0.42;
    const yaw = Math.random() * Math.PI * 2;
    const leaf = canopyBlob(0.55, seed + l, 1);
    leaf.scale(1.8, 0.32, 0.7);
    leaf.rotateY(yaw);
    leaf.translate(Math.cos(yaw) * 0.9, y, Math.sin(yaw) * 0.9);
    parts.push(paint(ensureAttributes(leaf, 1), 0x8fbf66, 0.18));
  }
  return mergeGeometries(parts, false);
}

export class Forest {
  constructor(scene, trees, bamboos) {
    this.groups = [];
    this.material = applyWind(
      new THREE.MeshLambertMaterial({
        vertexColors: true,
        fog: true,
        side: THREE.DoubleSide,
      })
    );

    const variants = {
      pine: [buildPine(1), buildPine(4.2), buildPine(7.7)],
      maple: [buildMaple(2), buildMaple(5.5)],
      birch: [buildBirch(3), buildBirch(6.1)],
      bamboo: [buildBambooStalk(5), buildBambooStalk(8.3)],
    };

    this.instanceGroups(scene, trees, variants, 0);
    this.instanceGroups(scene, bamboos, variants, 1);
  }

  instanceGroups(scene, placements, variants, bambooMode) {
    const buckets = new Map();
    placements.forEach((p, index) => {
      const type = bambooMode ? 'bamboo' : p.type;
      const list = variants[type] || variants.pine;
      const variantIndex = index % list.length;
      const key = `${type}:${variantIndex}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(p);
    });

    const dummy = new THREE.Object3D();
    for (const [key, items] of buckets) {
      const [type, variantIndex] = key.split(':');
      const geometry = variants[type][Number(variantIndex)];
      const mesh = new THREE.InstancedMesh(geometry, this.material, items.length);
      items.forEach((p, i) => {
        const scale = bambooMode ? 0.85 + (p.height || 10) / 12 : p.scale;
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(bambooMode ? p.lean || 0 : 0, p.yaw || 0, bambooMode ? (p.lean || 0) * 0.7 : 0);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = `forest-${key}`;
      if (typeof mesh.computeBoundingSphere === 'function') mesh.computeBoundingSphere();
      scene.add(mesh);
      this.groups.push(mesh);
    }
  }
}
