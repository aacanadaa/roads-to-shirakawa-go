export const windUniforms = {
  uTime: { value: 0 },
  uWindStrength: { value: 1 },
  uWindGust: { value: 0.4 },
};

export const windVertexPars = /* glsl */ `
uniform float uTime;
uniform float uWindStrength;
uniform float uWindGust;
attribute float aFlex;
`;

export const windVertex = /* glsl */ `
{
  vec4 windRef = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    windRef = instanceMatrix * windRef;
  #endif
  windRef = modelMatrix * windRef;

  float sway = sin( uTime * 1.35 + windRef.x * 0.11 + windRef.z * 0.13 )
    + 0.55 * sin( uTime * 2.15 + windRef.x * 0.29 + windRef.z * 0.05 )
    + 0.3 * sin( uTime * 3.6 + windRef.z * 0.42 );
  float gust = 0.65 + uWindGust * sin( uTime * 0.23 + windRef.x * 0.012 );
  float bend = sway * gust * aFlex * uWindStrength;

  transformed.x += bend * 0.28;
  transformed.z += bend * 0.19;
  transformed.y -= abs( bend ) * 0.045;
}
`;

export function applyWind(material, uniforms = windUniforms) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWindStrength = uniforms.uWindStrength;
    shader.uniforms.uWindGust = uniforms.uWindGust;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${windVertexPars}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${windVertex}`);
  };
  material.customProgramCacheKey = () => 'wind-sway-v1';
  return material;
}
