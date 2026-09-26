import * as THREE from 'three';
import {
  waterVertexPars,
  waterVertex,
  waterFragmentPars,
  waterFragment,
} from '../shaders/water.js';

export function createWaterMaterial() {
  const material = new THREE.ShaderMaterial({
    name: 'AnimatedWater',
    transparent: true,
    depthWrite: false,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uWaveHeight: { value: 0.07 },
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

  material.extensions = { derivatives: true };
  return material;
}
