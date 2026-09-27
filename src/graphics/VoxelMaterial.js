import * as THREE from 'three';
import {
  triplanarVertexPars,
  triplanarVertex,
  triplanarFragmentPars,
  triplanarFragment,
} from '../shaders/triplanar.js';

export const voxelUniforms = {
  uTime: { value: 0 },
  uWindStrength: { value: 1.0 },
};

export function createVoxelMaterial() {
  const material = new THREE.MeshLambertMaterial({
    color: 0xffffff,
    vertexColors: true,
    fog: true,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = voxelUniforms.uTime;
    shader.uniforms.uWindStrength = voxelUniforms.uWindStrength;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>\n${triplanarVertexPars}\nuniform float uTime;\nuniform float uWindStrength;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\n${triplanarVertex}\n{
          if ( aWind > 0.001 ) {
            vec4 wpos0 = modelMatrix * vec4( transformed, 1.0 );
            float phase = wpos0.x * 0.55 + wpos0.z * 0.75 + wpos0.y * 0.3;
            float sway = sin( uTime * 1.7 + phase ) + 0.5 * sin( uTime * 3.1 + phase * 1.7 );
            float amp = uWindStrength * aWind * 0.075;
            transformed.x += sway * amp;
            transformed.z += cos( uTime * 1.3 + phase ) * amp * 0.7;
            transformed.y -= abs( sway ) * amp * 0.25;
          }
        }`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${triplanarFragmentPars}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>\n${triplanarFragment}`
      );
  };

  material.customProgramCacheKey = () => 'voxel-merged-shaderpack-v2';
  return material;
}

export function createGlowMaterial() {
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    fog: true,
    toneMapped: true,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = voxelUniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec3 vGlowWPos;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvGlowWPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;'
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float uTime;\nvarying vec3 vGlowWPos;'
      )
      .replace(
        '#include <dithering_fragment>',
        `
        // Gentle lantern flicker so night villages feel alive.
        float flick = 0.94 + 0.06 * sin( uTime * 7.0 + vGlowWPos.x * 2.0 + vGlowWPos.y * 3.0 + vGlowWPos.z * 1.7 );
        gl_FragColor.rgb *= flick;
        #include <dithering_fragment>`
      );
  };
  material.customProgramCacheKey = () => 'voxel-glow-v2';
  return material;
}
