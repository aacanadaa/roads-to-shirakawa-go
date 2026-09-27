export const surfaceVertexPars = /* glsl */ `
varying vec3 vSurfPos;
varying vec3 vSurfNormal;
`;

export const surfaceVertex = /* glsl */ `
{
  vec4 surfPos = vec4( transformed, 1.0 );
  vec3 surfNormal = objectNormal;
  #ifdef USE_INSTANCING
    surfPos = instanceMatrix * surfPos;
    surfNormal = mat3( instanceMatrix ) * surfNormal;
  #endif
  surfPos = modelMatrix * surfPos;
  vSurfPos = surfPos.xyz;
  vSurfNormal = normalize( mat3( modelMatrix ) * surfNormal );
}
`;

export const surfaceFragmentPars = /* glsl */ `
varying vec3 vSurfPos;
varying vec3 vSurfNormal;

float surfHash( vec3 p ) {
  p = fract( p * 0.1031 );
  p += dot( p, p.zyx + 31.32 );
  return fract( ( p.x + p.y ) * p.z );
}

float surfNoise( vec2 p ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  vec2 u = f * f * ( 3.0 - 2.0 * f );
  float a = surfHash( vec3( i, 1.7 ) );
  float b = surfHash( vec3( i + vec2( 1.0, 0.0 ), 1.7 ) );
  float c = surfHash( vec3( i + vec2( 0.0, 1.0 ), 1.7 ) );
  float d = surfHash( vec3( i + vec2( 1.0, 1.0 ), 1.7 ) );
  return mix( mix( a, b, u.x ), mix( c, d, u.x ), u.y );
}

float surfFbm( vec2 p ) {
  float s = 0.0;
  float a = 0.5;
  for ( int i = 0; i < 3; i ++ ) {
    s += a * surfNoise( p );
    p *= 2.09;
    a *= 0.5;
  }
  return s;
}

float surfPattern( float id, vec2 uv ) {
  if ( id > 6.5 && id < 7.5 ) {
    float streak = sin( uv.x * 9.0 + surfFbm( uv * vec2( 1.4, 0.5 ) ) * 7.0 ) * 0.5 + 0.5;
    float fiber = surfFbm( uv * vec2( 3.0, 22.0 ) );
    return 0.3 + streak * 0.36 + fiber * 0.34;
  }
  if ( id > 5.5 && id < 6.5 ) {
    float grain = sin( uv.x * 22.0 + surfFbm( uv * vec2( 1.2, 0.35 ) ) * 8.0 ) * 0.5 + 0.5;
    return 0.32 + grain * 0.42 + surfFbm( uv * 8.0 ) * 0.26;
  }
  if ( id > 18.5 ) {
    return surfFbm( uv * 3.1 ) * 0.72 + 0.22;
  }
  return surfFbm( uv * 2.6 ) * 0.55 + 0.38;
}

vec3 surfDetail( float id, vec3 wp, vec3 n ) {
  vec3 w = pow( abs( n ), vec3( 5.0 ) );
  w /= max( w.x + w.y + w.z, 0.0001 );
  float dx = surfPattern( id, wp.zy );
  float dy = surfPattern( id, wp.xz );
  float dz = surfPattern( id, wp.xy );
  float d = w.x * dx + w.y * dy + w.z * dz;
  return vec3( mix( 0.78, 1.22, d ) );
}
`;

export function surfaceFragment(id) {
  return `diffuseColor.rgb *= surfDetail( ${id.toFixed(1)}, vSurfPos, normalize( vSurfNormal ) );`;
}
