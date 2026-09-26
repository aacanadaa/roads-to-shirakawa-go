import * as THREE from 'three';
import { skyDomeVertex, skyDomeFragment } from '../shaders/skyDome.js';

export class SkyDome {
  constructor(scene, radius = 460) {
    this.material = new THREE.ShaderMaterial({
      name: 'SkyDome',
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uZenith: { value: new THREE.Color(0x4d87c4) },
        uHorizon: { value: new THREE.Color(0x9dc4e0) },
        uSunColor: { value: new THREE.Color(0xfff3dd) },
        uSunDirection: { value: new THREE.Vector3(0.5, 0.8, 0.3) },
        uNightFactor: { value: 0 },
        uSunElevation: { value: 1 },
        uTime: { value: 0 },
      },
      vertexShader: skyDomeVertex,
      fragmentShader: skyDomeFragment,
    });

    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 20), this.material);
    this.mesh.name = 'sky-dome';
    this.mesh.renderOrder = -100;
    this.mesh.frustumCulled = false;
    this.mesh.matrixAutoUpdate = false;
    scene.add(this.mesh);
  }

  follow(camera) {
    this.mesh.position.copy(camera.position);
    this.mesh.updateMatrix();
  }

  sync({ zenith, horizon, sunColor, sunDirection, nightFactor, elevation, time }) {
    const u = this.material.uniforms;
    u.uZenith.value.copy(zenith);
    u.uHorizon.value.copy(horizon);
    u.uSunColor.value.copy(sunColor);
    u.uSunDirection.value.copy(sunDirection);
    u.uNightFactor.value = nightFactor;
    u.uSunElevation.value = elevation;
    u.uTime.value = time;
  }
}
