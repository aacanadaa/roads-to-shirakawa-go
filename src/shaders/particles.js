export const motesVertex = /* glsl */ `
uniform float uTime;
uniform float uVolume;
uniform float uPixelRatio;
attribute float aSeed;
varying float vAlpha;
void main() {
  vec3 pos = position;
  float t = uTime * 0.14;
  pos.x += sin( t * 1.7 + aSeed * 31.0 ) * 1.9;
  pos.y += sin( t * 1.1 + aSeed * 17.0 ) * 1.2 + mod( t * 0.55 + aSeed * 43.0, 6.0 );
  pos.z += cos( t * 1.35 + aSeed * 23.0 ) * 1.9;

  vec4 mvPosition = modelViewMatrix * vec4( pos, 1.0 );
  gl_Position = projectionMatrix * mvPosition;
  float size = mix( 1.2, 3.0, fract( aSeed * 7.31 ) );
  gl_PointSize = size * uPixelRatio * ( 130.0 / max( -mvPosition.z, 1.0 ) );
  float dist = length( mvPosition.xyz );
  vAlpha = smoothstep( uVolume * 0.55, uVolume * 0.18, dist ) * ( 0.35 + fract( aSeed * 3.77 ) * 0.5 );
}
`;

export const motesFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length( c );
  float glow = smoothstep( 0.5, 0.0, d );
  glow *= glow;
  gl_FragColor = vec4( uColor, glow * vAlpha * uOpacity );
}
`;

export const firefliesVertex = /* glsl */ `
uniform float uTime;
uniform float uPixelRatio;
attribute float aSeed;
attribute vec3 aHome;
varying float vAlpha;
void main() {
  float t = uTime;
  vec3 pos = aHome;
  pos.x += sin( t * ( 0.6 + fract( aSeed * 1.7 ) * 0.5 ) + aSeed * 21.0 ) * 2.6;
  pos.y += sin( t * ( 0.8 + fract( aSeed * 2.3 ) * 0.4 ) + aSeed * 13.0 ) * 1.35;
  pos.z += cos( t * ( 0.5 + fract( aSeed * 3.1 ) * 0.5 ) + aSeed * 27.0 ) * 2.6;

  vec4 mvPosition = modelViewMatrix * vec4( pos, 1.0 );
  gl_Position = projectionMatrix * mvPosition;
  float size = mix( 2.3, 4.6, fract( aSeed * 5.13 ) );
  gl_PointSize = size * uPixelRatio * ( 130.0 / max( -mvPosition.z, 1.0 ) );
  float pulse = 0.45 + 0.55 * pow( 0.5 + 0.5 * sin( t * ( 1.6 + fract( aSeed * 9.7 ) * 1.8 ) + aSeed * 40.0 ), 2.0 );
  float dist = length( mvPosition.xyz );
  vAlpha = pulse * smoothstep( 95.0, 26.0, dist );
}
`;

export const firefliesFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length( c );
  float core = smoothstep( 0.22, 0.0, d );
  float halo = smoothstep( 0.5, 0.0, d );
  float a = ( core * 0.9 + halo * halo * 0.55 ) * vAlpha * uOpacity;
  gl_FragColor = vec4( uColor, a );
}
`;

export const leavesVertex = /* glsl */ `
uniform float uTime;
uniform float uVolume;
uniform float uPixelRatio;
attribute float aSeed;
attribute vec3 aColor;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec3 pos = position;
  float fall = mod( uTime * ( 0.65 + fract( aSeed * 2.1 ) * 0.55 ) + aSeed * 100.0, uVolume );
  pos.y = position.y + ( uVolume * 0.5 ) - fall;
  pos.x += sin( uTime * 0.9 + aSeed * 33.0 + pos.y * 0.35 ) * 3.2;
  pos.z += cos( uTime * 0.72 + aSeed * 19.0 + pos.y * 0.28 ) * 3.2;

  vec4 mvPosition = modelViewMatrix * vec4( pos, 1.0 );
  gl_Position = projectionMatrix * mvPosition;
  float size = mix( 2.1, 4.2, fract( aSeed * 4.9 ) );
  gl_PointSize = size * uPixelRatio * ( 130.0 / max( -mvPosition.z, 1.0 ) );
  float dist = length( mvPosition.xyz );
  vAlpha = smoothstep( uVolume * 0.62, uVolume * 0.2, dist ) * 0.85;
  vColor = aColor;
}
`;

export const leavesFragment = /* glsl */ `
uniform float uOpacity;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float rot = ( gl_PointCoord.x - 0.5 ) * 2.4 + ( gl_PointCoord.y - 0.5 ) * 1.6;
  vec2 r = vec2( c.x * cos( rot ) - c.y * sin( rot ), c.x * sin( rot ) + c.y * cos( rot ) );
  float leaf = smoothstep( 0.5, 0.16, abs( r.x ) * 1.9 + abs( r.y ) * 1.1 );
  gl_FragColor = vec4( vColor, leaf * vAlpha * uOpacity );
}
`;
