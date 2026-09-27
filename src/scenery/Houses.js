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

function box(w, h, d, hex, variance = 0.12) {
  const geo = new THREE.BoxGeometry(w, h, d);
  return painted(geo, hex, variance);
}

function roofGeometry(width, height, depth, thickness) {
  const shape = new THREE.Shape();
  const N = 14;
  const profile = (t) => {
    const x = -width + t * width * 2;
    const y = height * Math.pow(Math.max(0, 1 - Math.abs(x) / width), 1.22);
    return { x, y };
  };

  const first = profile(0);
  shape.moveTo(first.x, first.y);
  for (let i = 1; i <= N; i += 1) {
    const p = profile(i / N);
    shape.lineTo(p.x, p.y);
  }
  for (let i = N; i >= 0; i -= 1) {
    const p = profile(i / N);
    const inward = 1 - thickness * 0.08;
    shape.lineTo(p.x * inward, Math.max(0, p.y - thickness));
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.12,
    bevelSize: 0.12,
    bevelSegments: 1,
    steps: 1,
  });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

function buildHouse(house) {
  const stone = [];
  const wood = [];
  const thatch = [];
  const shoji = [];

  const w = 11 * house.scale;
  const d = 15 * house.scale;
  const wallH = 4.6 * house.scale;
  const t = 0.55;

  stone.push(box(w + 1.2, 1.1, d + 1.2, 0x6f7378, 0.2));
  stone[stone.length - 1].translate(0, -0.55, 0);

  wood.push(box(w, wallH, t, 0x8a5f3c, 0.14));
  wood[wood.length - 1].translate(0, wallH / 2, -d / 2);

  wood.push(box(w, wallH, t, 0x8a5f3c, 0.14));
  wood[wood.length - 1].translate(0, wallH / 2, d / 2);

  wood.push(box(t, wallH, d, 0x8a5f3c, 0.14));
  wood[wood.length - 1].translate(-w / 2, wallH / 2, 0);

  const doorW = 2.6;
  const sideW = (w - doorW) / 2;
  wood.push(box(sideW, wallH, t, 0x8a5f3c, 0.14));
  wood[wood.length - 1].translate(-(doorW / 2 + sideW / 2), wallH / 2, d / 2 - 0.02);
  wood.push(box(sideW, wallH, t, 0x8a5f3c, 0.14));
  wood[wood.length - 1].translate(doorW / 2 + sideW / 2, wallH / 2, d / 2 - 0.02);
  wood.push(box(doorW, wallH - 3.4, t, 0x8a5f3c, 0.14));
  wood[wood.length - 1].translate(0, 3.4 + (wallH - 3.4) / 2, d / 2 - 0.02);

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const post = box(0.62, wallH + 0.5, 0.62, 0x6f4a2c, 0.1);
      post.translate((sx * (w / 2 - 0.2)), (wallH + 0.5) / 2, sz * (d / 2 - 0.2));
      wood.push(post);
    }
  }

  for (const sz of [-1, 1]) {
    const beam = box(w + 0.5, 0.5, 0.5, 0x6f4a2c, 0.1);
    beam.translate(0, wallH - 0.35, sz * (d / 2 - 0.12));
    wood.push(beam);
  }
  for (const sx of [-1, 1]) {
    const beam = box(0.5, 0.5, d + 0.5, 0x6f4a2c, 0.1);
    beam.translate(sx * (w / 2 - 0.12), wallH - 0.35, 0);
    wood.push(beam);
  }

  const deck = box(w * 0.85, 0.42, 3.2, 0x7d5533, 0.12);
  deck.translate(0, 0.2, d / 2 + 1.5);
  wood.push(deck);

  const roofW = w / 2 + 1.4;
  const roofH = 8.6 * house.scale;
  const roof = roofGeometry(roofW, roofH, d + 2.2, 1.05);
  roof.translate(0, wallH - 0.15, 0);
  thatch.push(painted(roof, 0xc09a52, 0.16));

  const ridge = new THREE.CylinderGeometry(0.55, 0.55, d + 2.6, 7);
  ridge.rotateX(Math.PI / 2);
  ridge.translate(0, wallH + roofH - 0.35, 0);
  thatch.push(painted(ridge, 0xa8823f, 0.12));

  const windowGeo = new THREE.PlaneGeometry(2.3, 1.9);
  for (const sz of [-1, 1]) {
    const win = windowGeo.clone();
    win.translate(0, 2.8, sz * (d / 2 + 0.06));
    if (sz < 0) win.rotateY(Math.PI);
    shoji.push(painted(win, 0xffe2b0, 0.05));
  }
  for (const sx of [-1, 1]) {
    const win = windowGeo.clone();
    win.rotateY((sx * Math.PI) / 2);
    win.translate(sx * (w / 2 + 0.06), 2.8, 0);
    shoji.push(painted(win, 0xffe2b0, 0.05));
  }
  const doorPanel = new THREE.PlaneGeometry(doorW * 0.85, 3.1);
  doorPanel.translate(0, 1.75, d / 2 + 0.07);
  shoji.push(painted(doorPanel, 0xffd9a0, 0.05));

  const matrix = new THREE.Matrix4()
    .makeRotationY(house.yaw)
    .setPosition(house.x, house.y, house.z);
  const apply = (geo) => {
    geo.applyMatrix4(matrix);
    return geo;
  };

  return {
    stone: stone.map(apply),
    wood: wood.map(apply),
    thatch: thatch.map(apply),
    shoji: shoji.map(apply),
  };
}

export class Village {
  constructor(scene, houses) {
    const stone = [];
    const wood = [];
    const thatch = [];
    const shoji = [];

    for (const house of houses) {
      const built = buildHouse(house);
      stone.push(...built.stone);
      wood.push(...built.wood);
      thatch.push(...built.thatch);
      shoji.push(...built.shoji);
    }

    this.groups = [];
    const add = (parts, material, name) => {
      if (parts.length === 0) return;
      const geometry = mergeGeometries(parts, false);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = name;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      this.groups.push(mesh);
    };

    add(stone, createSurfaceMaterial(3, { vertexColors: true }), 'village-stone');
    add(wood, createSurfaceMaterial(6, { vertexColors: true }), 'village-wood');
    add(thatch, createSurfaceMaterial(7, { vertexColors: true }), 'village-thatch');

    if (shoji.length > 0) {
      const geometry = mergeGeometries(shoji, false);
      const material = new THREE.MeshBasicMaterial({
        vertexColors: true,
        fog: true,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = 'village-shoji';
      scene.add(mesh);
      this.groups.push(mesh);
    }
  }
}
