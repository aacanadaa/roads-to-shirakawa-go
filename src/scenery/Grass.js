import * as THREE from 'three';
import { applyWind, windUniforms } from '../shaders/wind.js';

function bladeGeometry() {
  const geo = new THREE.PlaneGeometry(0.16, 1, 1, 3);
  geo.translate(0, 0.5, 0);
  const pos = geo.attributes.position;
  const flexes = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i += 1) {
    const y = pos.getY(i);
    pos.setZ(i, Math.pow(y, 1.6) * 0.22);
    flexes[i] = y * y;
  }
  geo.setAttribute('aFlex', new THREE.BufferAttribute(flexes, 1));
  return geo;
}

export class GrassField {
  constructor(scene, terrain, config) {
    this.terrain = terrain;
    const geometry = bladeGeometry();
    const material = applyWind(
      new THREE.MeshLambertMaterial({
        color: 0x6f9c46,
        side: THREE.DoubleSide,
        fog: true,
      })
    );
    this.material = material;

    const count = config.count;
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    const sizeX = terrain.sizeX;
    const sizeZ = terrain.sizeZ;
    let placed = 0;
    let attempts = 0;
    while (placed < count && attempts < count * 12) {
      attempts += 1;
      const x = Math.random() * sizeX;
      const z = Math.random() * sizeZ;
      const h = terrain.sampleHeight(x, z);
      if (h < 8 || h > 46) continue;
      if (terrain.slopeAt(x, z) > 0.5) continue;
      if (terrain.isWaterAt(x, z)) continue;
      const dRoad = Math.abs(x - terrain.data.roadX(Math.min(Math.max(z, 0), sizeZ - 1)));
      if (dRoad < 5.5) continue;

      const scale = 0.55 + Math.random() * 0.95;
      dummy.position.set(x, h - 0.04, z);
      dummy.rotation.set(0, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.22);
      dummy.scale.set(scale * (0.8 + Math.random() * 0.5), scale, scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(placed, dummy.matrix);

      const tint = 0.82 + Math.random() * 0.38;
      color.setRGB(0.42 * tint, 0.62 * tint, 0.26 * tint);
      mesh.setColorAt(placed, color);
      placed += 1;
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.name = 'grass';
    if (typeof mesh.computeBoundingSphere === 'function') mesh.computeBoundingSphere();
    scene.add(mesh);
    this.mesh = mesh;
  }

  update(time) {
    windUniforms.uTime.value = time;
  }
}
