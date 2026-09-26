import * as THREE from 'three';
import {
  motesVertex,
  motesFragment,
  firefliesVertex,
  firefliesFragment,
  leavesVertex,
  leavesFragment,
} from '../shaders/particles.js';

function buildMotes(count, volume) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * volume;
    positions[i * 3 + 1] = (Math.random() - 0.5) * volume * 0.55;
    positions[i * 3 + 2] = (Math.random() - 0.5) * volume;
    seeds[i] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

  const material = new THREE.ShaderMaterial({
    name: 'PollenMotes',
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uVolume: { value: volume },
      uPixelRatio: { value: 1 },
      uColor: { value: new THREE.Color(0xffe9b8) },
      uOpacity: { value: 0.5 },
    },
    vertexShader: motesVertex,
    fragmentShader: motesFragment,
  });

  const points = new THREE.Points(geometry, material);
  points.name = 'particles-motes';
  points.frustumCulled = false;
  points.renderOrder = 12;
  return points;
}

function buildFireflies(count, homes) {
  const positions = new Float32Array(count * 3);
  const home = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const anchor = homes.length > 0 ? homes[i % homes.length] : { x: 0, y: 20, z: 0 };
    const x = anchor.x + (Math.random() - 0.5) * 18;
    const y = anchor.y + Math.random() * 4.5 - 0.5;
    const z = anchor.z + (Math.random() - 0.5) * 18;
    home[i * 3] = x;
    home[i * 3 + 1] = y;
    home[i * 3 + 2] = z;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    seeds[i] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aHome', new THREE.BufferAttribute(home, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

  const material = new THREE.ShaderMaterial({
    name: 'HotaruFireflies',
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uColor: { value: new THREE.Color(0xd9ff8a) },
      uOpacity: { value: 0 },
    },
    vertexShader: firefliesVertex,
    fragmentShader: firefliesFragment,
  });

  const points = new THREE.Points(geometry, material);
  points.name = 'particles-fireflies';
  points.frustumCulled = false;
  points.renderOrder = 13;
  return points;
}

function buildLeaves(count, volume) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const palette = [
    new THREE.Color(0xc2552e),
    new THREE.Color(0xd97b32),
    new THREE.Color(0xe0a13c),
    new THREE.Color(0x9c3b22),
  ];
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * volume;
    positions[i * 3 + 1] = (Math.random() - 0.5) * volume * 0.7;
    positions[i * 3 + 2] = (Math.random() - 0.5) * volume;
    seeds[i] = Math.random();
    const c = palette[Math.floor(Math.random() * palette.length)];
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));

  const material = new THREE.ShaderMaterial({
    name: 'AutumnLeaves',
    transparent: true,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uVolume: { value: volume },
      uPixelRatio: { value: 1 },
      uOpacity: { value: 0.9 },
    },
    vertexShader: leavesVertex,
    fragmentShader: leavesFragment,
  });

  const points = new THREE.Points(geometry, material);
  points.name = 'particles-leaves';
  points.frustumCulled = false;
  points.renderOrder = 11;
  return points;
}

export class ParticleField {
  constructor(scene, { motes, fireflies, leaves, volume }, fireflyHomes) {
    this.scene = scene;
    this.volume = volume;
    this.motes = buildMotes(motes, volume);
    this.fireflies = buildFireflies(fireflies, fireflyHomes);
    this.leaves = buildLeaves(leaves, volume);
    scene.add(this.motes, this.fireflies, this.leaves);
  }

  setPixelRatio(ratio) {
    for (const system of [this.motes, this.fireflies, this.leaves]) {
      system.material.uniforms.uPixelRatio.value = ratio;
    }
  }

  update(dt, time, { camera, dayFactor, nightFactor }) {
    this.motes.material.uniforms.uTime.value = time;
    this.leaves.material.uniforms.uTime.value = time;
    this.fireflies.material.uniforms.uTime.value = time;

    this.motes.position.copy(camera.position);
    this.leaves.position.copy(camera.position);
    this.motes.updateMatrix();
    this.leaves.updateMatrix();

    this.motes.material.uniforms.uOpacity.value = 0.16 + dayFactor * 0.5;
    this.leaves.material.uniforms.uOpacity.value = 0.55 + dayFactor * 0.35;
    this.fireflies.material.uniforms.uOpacity.value = Math.pow(nightFactor, 1.35) * 1.25;
    this.fireflies.visible = nightFactor > 0.02;
    void dt;
  }

  setCounts({ motes, fireflies, leaves }) {
    this.rebuild('motes', motes);
    this.rebuild('fireflies', fireflies);
    this.rebuild('leaves', leaves);
  }

  rebuild(kind, count) {
    const current = this[kind];
    if (!current) return;
    const homes = [];
    if (kind === 'fireflies') {
      const homeAttr = current.geometry.getAttribute('aHome');
      for (let i = 0; i < homeAttr.count; i += 1) {
        homes.push({ x: homeAttr.getX(i), y: homeAttr.getY(i), z: homeAttr.getZ(i) });
      }
    }
    this.scene.remove(current);
    current.geometry.dispose();
    current.material.dispose();
    if (kind === 'motes') this.motes = buildMotes(count, this.volume);
    if (kind === 'fireflies') this.fireflies = buildFireflies(count, homes);
    if (kind === 'leaves') this.leaves = buildLeaves(count, this.volume);
    this.scene.add(this[kind]);
  }
}
