import * as THREE from 'three';
import {
  surfaceVertexPars,
  surfaceVertex,
  surfaceFragmentPars,
  surfaceFragment,
} from '../shaders/surface.js';

export function createSurfaceMaterial(detailId, options = {}) {
  const material = new THREE.MeshLambertMaterial({
    color: options.color ?? 0xffffff,
    fog: true,
    vertexColors: options.vertexColors ?? false,
    side: options.side ?? THREE.FrontSide,
  });

  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${surfaceVertexPars}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${surfaceVertex}`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${surfaceFragmentPars}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${surfaceFragment(detailId)}`);
  };

  material.customProgramCacheKey = () => `surface-${detailId}`;
  return material;
}
