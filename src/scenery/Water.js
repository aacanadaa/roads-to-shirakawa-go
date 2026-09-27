import * as THREE from 'three';
import {
  waterVertexPars,
  waterVertex,
  waterFragmentPars,
  waterFragment,
} from '../shaders/water.js';

export function createWaterMaterial() {
  return new THREE.ShaderMaterial({
    name: 'AnimatedWater',
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uWaveHeight: { value: 0.09 },
        uSunDirection: { value: new THREE.Vector3(0.5, 0.8, 0.3) },
        uSunColor: { value: new THREE.Color(0xfff3dd) },
        uSkyColor: { value: new THREE.Color(0x8fc0e8) },
        uHorizonColor: { value: new THREE.Color(0xa9c9dd) },
        uDeepColor: { value: new THREE.Color(0x1d4f70) },
        uShallowColor: { value: new THREE.Color(0x3f86b5) },
        uSunIntensity: { value: 1 },
        uNightFactor: { value: 0 },
      },
    ]),
    vertexShader: `${waterVertexPars}\nvoid main() {\n${waterVertex}\n}`,
    fragmentShader: `${waterFragmentPars}\nvoid main() {\n${waterFragment}\n}`,
  });
}

export class River {
  constructor(scene, terrain) {
    const segments = 280;
    const halfWidth = 5.6;
    const positions = new Float32Array((segments + 1) * 2 * 3);
    const uvs = new Float32Array((segments + 1) * 2 * 2);
    const indices = [];

    for (let i = 0; i <= segments; i += 1) {
      const z = (i / segments) * (terrain.sizeZ - 1);
      const cx = terrain.data.riverX(z);
      const yi = Math.min(Math.max(Math.round(z), 0), terrain.sizeZ - 1);
      const y = terrain.data.riverH[yi] - 2.6;

      for (let s = 0; s < 2; s += 1) {
        const side = s === 0 ? -1 : 1;
        const x = cx + side * halfWidth;
        const idx = (i * 2 + s) * 3;
        positions[idx] = x;
        positions[idx + 1] = y;
        positions[idx + 2] = z;
        const uvIdx = (i * 2 + s) * 2;
        uvs[uvIdx] = s;
        uvs[uvIdx + 1] = i / 14;
      }

      if (i < segments) {
        const a = i * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    this.material = createWaterMaterial();
    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.name = 'river';
    mesh.renderOrder = 10;
    scene.add(mesh);
    this.mesh = mesh;
  }

  sync(time, sky) {
    const u = this.material.uniforms;
    const night = sky.nightFactor;
    u.uTime.value = time;
    u.uSunDirection.value.copy(sky.sunDirection);
    u.uSunColor.value.copy(sky.sunColor);
    u.uSkyColor.value.copy(sky.zenith);
    u.uHorizonColor.value.copy(sky.horizon);
    u.uSunIntensity.value = sky.sun.intensity * 0.85;
    u.uNightFactor.value = night;
    u.uDeepColor.value.setHex(0x1d4f70).lerp(new THREE.Color(0x0a2033), night * 0.85);
    u.uShallowColor.value.setHex(0x3f86b5).lerp(new THREE.Color(0x1c4560), night * 0.85);
  }
}
