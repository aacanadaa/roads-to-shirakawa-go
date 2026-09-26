import * as THREE from 'three';
import {
  triplanarVertexPars,
  triplanarVertex,
  triplanarFragmentPars,
  triplanarFragment,
} from '../shaders/triplanar.js';

export function createVoxelMaterial() {
  const material = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    fog: true,
  });

  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${triplanarVertexPars}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${triplanarVertex}`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${triplanarFragmentPars}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${triplanarFragment}`);
  };

  material.customProgramCacheKey = () => 'voxel-triplanar-v1';
  return material;
}

export function createGlowMaterial() {
  return new THREE.MeshBasicMaterial({
    color: 0xffffff,
    fog: true,
  });
}
