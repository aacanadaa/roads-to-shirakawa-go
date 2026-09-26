export const triplanarVertexPars = /* glsl */ `
attribute float aBlockId;
varying vec3 vTriPos;
varying vec3 vTriNormal;
varying float vBlockId;
`;

export const triplanarVertex = /* glsl */ `
{
  vec4 triPos = vec4( transformed, 1.0 );
  vec3 triNormal = objectNormal;
  #ifdef USE_INSTANCING
    triPos = instanceMatrix * triPos;
    triNormal = mat3( instanceMatrix ) * triNormal;
  #endif
  triPos = modelMatrix * triPos;
  vTriPos = triPos.xyz;
  vTriNormal = mat3( modelMatrix ) * triNormal;
  vBlockId = aBlockId;
}
`;

export const triplanarFragmentPars = /* glsl */ `
varying vec3 vTriPos;
varying vec3 vTriNormal;
varying float vBlockId;

float triHash13( vec3 p ) {
  p = fract( p * 0.1031 );
  p += dot( p, p.zyx + 31.32 );
  return fract( ( p.x + p.y ) * p.z );
}

float triNoise2( vec2 p ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  vec2 u = f * f * ( 3.0 - 2.0 * f );
  float a = triHash13( vec3( i, 1.7 ) );
  float b = triHash13( vec3( i + vec2( 1.0, 0.0 ), 1.7 ) );
  float c = triHash13( vec3( i + vec2( 0.0, 1.0 ), 1.7 ) );
  float d = triHash13( vec3( i + vec2( 1.0, 1.0 ), 1.7 ) );
  return mix( mix( a, b, u.x ), mix( c, d, u.x ), u.y );
}

float triFbm2( vec2 p ) {
  float s = 0.0;
  float a = 0.5;
  for ( int i = 0; i < 3; i ++ ) {
    s += a * triNoise2( p );
    p *= 2.03;
    a *= 0.5;
  }
  return s;
}

float triPattern( float id, vec2 uv ) {
  if ( id < 5.5 ) {
    if ( id > 4.5 ) return triFbm2( uv * 2.6 ) * 0.7 + 0.3 * triNoise2( uv * 9.0 );
    if ( id > 3.5 ) return triFbm2( uv * 1.4 ) * 0.35 + 0.65;
    if ( id > 2.5 ) return triFbm2( uv * 3.2 ) * 0.8 + 0.15 * triNoise2( uv * 14.0 );
    return triFbm2( uv * 2.2 ) * 0.55 + 0.35;
  }
  if ( id < 11.5 ) {
    if ( id > 9.5 ) return 0.85;
    if ( id > 8.5 ) return triFbm2( uv * 2.4 ) * 0.8 + 0.12;
    if ( id > 7.5 ) {
      float streak = sin( uv.x * 14.0 + triFbm2( uv * 1.6 ) * 6.0 ) * 0.5 + 0.5;
      return 0.35 + streak * 0.5;
    }
    float grain = sin( uv.y * 11.0 + triFbm2( uv * vec2( 0.8, 2.4 ) ) * 5.0 ) * 0.5 + 0.5;
    return 0.38 + grain * 0.46;
  }
  if ( id > 20.5 ) return 0.9;
  if ( id > 19.5 ) return triFbm2( uv * 4.2 ) * 0.65 + 0.3;
  if ( id > 18.5 ) return triFbm2( uv * 3.4 ) * 0.7 + 0.2;
  if ( id > 17.5 ) return 0.88;
  if ( id > 16.5 ) {
    float seg = step( 0.35, fract( uv.y * 1.35 + 0.2 ) ) * 0.22;
    return 0.72 + seg + triNoise2( uv * 6.0 ) * 0.12;
  }
  if ( id > 14.5 ) {
    float grain = sin( uv.y * 16.0 + triFbm2( uv * vec2( 1.2, 2.0 ) ) * 4.0 ) * 0.5 + 0.5;
    return 0.34 + grain * 0.5;
  }
  return triFbm2( uv * 2.8 ) * 0.5 + 0.42;
}

vec3 triplanarDetail( float id, vec3 wp, vec3 n ) {
  vec3 w = pow( abs( n ), vec3( 5.0 ) );
  w /= max( w.x + w.y + w.z, 0.0001 );
  float dx = triPattern( id, wp.zy );
  float dy = triPattern( id, wp.xz );
  float dz = triPattern( id, wp.xy );
  float d = w.x * dx + w.y * dy + w.z * dz;
  return vec3( mix( 0.8, 1.2, d ) );
}
`;

export const triplanarFragment = /* glsl */ `
diffuseColor.rgb *= triplanarDetail( vBlockId, vTriPos, normalize( vTriNormal ) );
`;
