export const skyDomeVertex = /* glsl */ `
varying vec3 vSkyDir;
void main() {
  vSkyDir = normalize( position );
  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const skyDomeFragment = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunColor;
uniform vec3 uSunDirection;
uniform float uNightFactor;
uniform float uSunElevation;
uniform float uTime;
varying vec3 vSkyDir;

float skyHash21( vec2 p ) {
  p = fract( p * vec2( 234.34, 435.345 ) );
  p += dot( p, p + 34.23 );
  return fract( p.x * p.y );
}

float skyNoise( vec2 p ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  vec2 u = f * f * ( 3.0 - 2.0 * f );
  return mix(
    mix( skyHash21( i ), skyHash21( i + vec2( 1.0, 0.0 ) ), u.x ),
    mix( skyHash21( i + vec2( 0.0, 1.0 ) ), skyHash21( i + vec2( 1.0, 1.0 ) ), u.x ),
    u.y
  );
}

float skyFbm( vec2 p ) {
  float s = 0.0;
  float a = 0.5;
  for ( int i = 0; i < 4; i ++ ) {
    s += a * skyNoise( p );
    p *= 2.11;
    a *= 0.5;
  }
  return s;
}

void main() {
  vec3 dir = normalize( vSkyDir );
  float horizonBlend = pow( clamp( dir.y * 0.5 + 0.5, 0.0, 1.0 ), 0.55 );
  vec3 sky = mix( uHorizon, uZenith, smoothstep( 0.42, 1.0, horizonBlend ) );

  float sunDot = max( dot( dir, normalize( uSunDirection ) ), 0.0 );
  float disc = pow( sunDot, 900.0 );
  float glow = pow( sunDot, 12.0 );
  float haze = pow( sunDot, 3.0 );

  if ( dir.y > 0.015 ) {
    vec2 cuv = dir.xz / max( dir.y, 0.06 ) * 0.32;
    cuv += vec2( uTime * 0.0045, uTime * 0.0022 );
    float cover = skyFbm( cuv * 1.35 ) * 0.75 + skyFbm( cuv * 3.4 ) * 0.25;
    float clouds = smoothstep( 0.48, 0.78, cover ) * smoothstep( 0.0, 0.16, dir.y );
    vec3 cloudLit = mix( uHorizon * 1.05, uSunColor * 1.12, haze * 0.85 + 0.18 );
    vec3 cloudShadow = mix( uZenith, uHorizon, 0.45 ) * 0.82;
    vec3 cloudCol = mix( cloudShadow, cloudLit, smoothstep( 0.4, 0.95, cover ) );
    cloudCol = mix( cloudCol, cloudCol * 0.28, uNightFactor * 0.85 );
    sky = mix( sky, cloudCol, clouds * 0.92 );
  }

  sky += uSunColor * ( disc * 1.9 + glow * 0.28 + haze * 0.1 );
  sky = mix( sky, uSunColor * 0.85, haze * 0.14 * clamp( 1.0 - uSunElevation, 0.0, 1.0 ) );

  if ( uNightFactor > 0.004 ) {
    vec2 grid = vec2( atan( dir.z, dir.x ) * 22.0, asin( clamp( dir.y, -1.0, 1.0 ) ) * 22.0 );
    vec2 cell = floor( grid );
    vec2 f = fract( grid ) - 0.5;
    float rnd = skyHash21( cell );
    float presence = step( 0.92, rnd );
    float star = presence * smoothstep( 0.16, 0.0, length( f ) );
    float twinkle = 0.65 + 0.35 * sin( uTime * ( 1.2 + rnd * 4.5 ) + rnd * 55.0 );
    sky += vec3( 0.85, 0.92, 1.0 ) * star * twinkle * uNightFactor * smoothstep( -0.02, 0.3, dir.y );
  }

  gl_FragColor = vec4( sky, 1.0 );
}
`;
