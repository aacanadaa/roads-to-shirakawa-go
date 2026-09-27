export const terrainVertexPars = /* glsl */ `
varying vec3 vTerrainPos;
varying vec3 vTerrainNormal;
`;

export const terrainVertex = /* glsl */ `
{
  vec4 terrainPos = vec4( transformed, 1.0 );
  vec3 terrainNormal = objectNormal;
  #ifdef USE_INSTANCING
    terrainPos = instanceMatrix * terrainPos;
    terrainNormal = mat3( instanceMatrix ) * terrainNormal;
  #endif
  terrainPos = modelMatrix * terrainPos;
  vTerrainPos = terrainPos.xyz;
  vTerrainNormal = normalize( mat3( modelMatrix ) * terrainNormal );
}
`;

export const terrainFragmentPars = /* glsl */ `
varying vec3 vTerrainPos;
varying vec3 vTerrainNormal;

float terrHash( vec3 p ) {
  p = fract( p * 0.1031 );
  p += dot( p, p.zyx + 31.32 );
  return fract( ( p.x + p.y ) * p.z );
}

float terrNoise( vec2 p ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  vec2 u = f * f * ( 3.0 - 2.0 * f );
  float a = terrHash( vec3( i, 1.7 ) );
  float b = terrHash( vec3( i + vec2( 1.0, 0.0 ), 1.7 ) );
  float c = terrHash( vec3( i + vec2( 0.0, 1.0 ), 1.7 ) );
  float d = terrHash( vec3( i + vec2( 1.0, 1.0 ), 1.7 ) );
  return mix( mix( a, b, u.x ), mix( c, d, u.x ), u.y );
}

float terrFbm( vec2 p ) {
  float s = 0.0;
  float a = 0.5;
  for ( int i = 0; i < 4; i ++ ) {
    s += a * terrNoise( p );
    p *= 2.07;
    a *= 0.5;
  }
  return s;
}

vec3 terrDetail( vec3 wp, vec3 n, float scale, float amount ) {
  vec3 w = pow( abs( n ), vec3( 5.0 ) );
  w /= max( w.x + w.y + w.z, 0.0001 );
  float dx = terrFbm( wp.zy * scale );
  float dy = terrFbm( wp.xz * scale );
  float dz = terrFbm( wp.xy * scale );
  float d = w.x * dx + w.y * dy + w.z * dz;
  return vec3( 1.0 - amount * 0.5 + d * amount );
}
`;

export const terrainFragment = /* glsl */ `
vec3 terrNormal = normalize( vTerrainNormal );
float slope = 1.0 - clamp( terrNormal.y, 0.0, 1.0 );
float altitude = vTerrainPos.y;

float macro = terrFbm( vTerrainPos.xz * 0.012 );
float mottle = terrFbm( vTerrainPos.xz * 0.045 + 12.3 );

vec3 grassA = vec3( 0.22, 0.36, 0.12 );
vec3 grassB = vec3( 0.32, 0.45, 0.16 );
vec3 dryGrass = vec3( 0.42, 0.42, 0.18 );
vec3 rockA = vec3( 0.32, 0.31, 0.29 );
vec3 rockB = vec3( 0.45, 0.43, 0.40 );
vec3 dirt = vec3( 0.28, 0.21, 0.13 );
vec3 snow = vec3( 0.86, 0.90, 0.95 );
vec3 sand = vec3( 0.56, 0.48, 0.33 );

vec3 grassCol = mix( grassA, grassB, mottle );
grassCol = mix( grassCol, dryGrass, smoothstep( 0.45, 0.8, macro ) * 0.45 );

float rockMix = smoothstep( 0.32, 0.62, slope + ( mottle - 0.5 ) * 0.22 );
float snowMix = smoothstep( 46.0, 62.0, altitude + macro * 10.0 ) * smoothstep( 0.55, 0.15, slope );
float dirtMix = smoothstep( 0.42, 0.62, terrFbm( vTerrainPos.xz * 0.028 + 51.7 ) ) * ( 1.0 - rockMix ) * 0.5;
float sandMix = smoothstep( 15.5, 12.5, altitude ) * ( 1.0 - rockMix ) * smoothstep( 0.4, 0.05, slope );

vec3 terrainCol = mix( grassCol, dirt, dirtMix );
terrainCol = mix( terrainCol, sand, sandMix );
terrainCol = mix( terrainCol, mix( rockA, rockB, mottle ), rockMix );
terrainCol = mix( terrainCol, snow, snowMix );

terrainCol *= terrDetail( vTerrainPos, terrNormal, 0.85, 0.55 );
terrainCol *= terrDetail( vTerrainPos, terrNormal, 4.2, 0.22 );
terrainCol *= 0.92 + terrFbm( vTerrainPos.xz * 0.004 ) * 0.16;

diffuseColor.rgb *= terrainCol * 2.1;
`;
