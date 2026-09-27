import * as THREE from 'three';
import { createSurfaceMaterial } from '../graphics/SurfaceMaterial.js';

export class Boulders {
  constructor(scene, rocks) {
    const geometry = new THREE.IcosahedronGeometry(1, 2);
    const pos = geometry.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const rock = new THREE.Color(0x767168);
    const moss = new THREE.Color(0x5c7a44);
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const n =
        Math.sin(x * 2.1) * Math.cos(z * 1.7) * 0.16 + Math.sin(y * 2.6 + x) * 0.12 + Math.random() * 0.08;
      pos.setXYZ(i, x * (1 + n), y * (0.78 + n * 0.6), z * (1 + n));
      const mossMix = Math.max(0, y) * 0.55 + Math.random() * 0.2;
      const c = rock.clone().lerp(moss, Math.min(1, mossMix));
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = createSurfaceMaterial(19, { vertexColors: true });
    const mesh = new THREE.InstancedMesh(geometry, material, rocks.length);
    const dummy = new THREE.Object3D();
    rocks.forEach((r, i) => {
      dummy.position.set(r.x, r.y ?? 0, r.z);
      dummy.rotation.set(Math.random() * 0.35, r.yaw, Math.random() * 0.35);
      dummy.scale.setScalar(r.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = 'boulders';
    if (typeof mesh.computeBoundingSphere === 'function') mesh.computeBoundingSphere();
    scene.add(mesh);
    this.mesh = mesh;
  }
}
