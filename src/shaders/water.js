export const waterVertexPars = /* glsl */ `
uniform float uTime;
uniform float uWaveHeight;
varying vec3 vWorldPos;
varying vec2 vFlowUv;
#include <fog_pars_vertex>
`;

export const waterVertex = /* glsl */ `
vec3 waterPos = position;
vec4 waterWorld = modelMatrix * vec4( waterPos, 1.0 );

float wave =
  sin( waterWorld.x * 1.35 + uTime * 1.5 + uv.y * 0.35 ) * 0.55 +
  cos( waterWorld.z * 1.8 - uTime * 1.12 + uv.y * 0.22 ) * 0.45 +
  sin( ( waterWorld.x + waterWorld.z ) * 0.75 - uTime * 0.75 ) * 0.35;
waterWorld.y += wave * uWaveHeight;

vWorldPos = waterWorld.xyz;
vFlowUv = uv;

vec4 mvPosition = viewMatrix * waterWorld;
gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
`;

export const waterFragmentPars = /* glsl */ `
uniform float uTime;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform vec3 uHorizonColor;
uniform vec3 uDeepColor;
uniform vec3 uShallowColor;
uniform float uSunIntensity;
uniform float uNightFactor;
varying vec3 vWorldPos;
varying vec2 vFlowUv;
#include <fog_pars_fragment>

float waterHash( vec2 p ) {
  p = fract( p * vec2( 233.34, 851.73 ) );
  p += dot( p, p + 23.45 );
  return fract( p.x * p.y );
}

float waterNoise( vec2 p ) {
  vec2 i = floor( p );
  vec2 f = fract( p );
  vec2 u = f * f * ( 3.0 - 2.0 * f );
  return mix(
    mix( waterHash( i ), waterHash( i + vec2( 1.0, 0.0 ) ), u.x ),
    mix( waterHash( i + vec2( 0.0, 1.0 ) ), waterHash( i + vec2( 1.0, 1.0 ) ), u.x ),
    u.y
  );
}

float waterFbm( vec2 p ) {
  float s = 0.0;
  float a = 0.5;
  for ( int i = 0; i < 3; i ++ ) {
    s += a * waterNoise( p );
    p *= 2.11;
    a *= 0.5;
  }
  return s;
}
`;

export const waterFragment = /* glsl */ `
vec2 flow = vec2( uTime * 0.14, uTime * 0.32 );
float n1 = waterFbm( vWorldPos.xz * 0.85 + flow );
float n2 = waterFbm( vWorldPos.xz * 2.3 - flow * 1.6 );
float ripX = sin( vWorldPos.x * 2.1 + uTime * 1.4 ) * 0.5 + ( n1 - 0.5 ) * 1.3;
float ripZ = cos( vWorldPos.z * 2.5 - uTime * 1.15 ) * 0.5 + ( n2 - 0.5 ) * 1.3;

vec3 surfNormal = normalize( vec3( ripX * 0.16, 1.0, ripZ * 0.16 ) );
vec3 viewDir = normalize( cameraPosition - vWorldPos );
float fresnel = pow( 1.0 - max( dot( surfNormal, viewDir ), 0.0 ), 2.6 );

vec3 body = mix( uDeepColor, uShallowColor, clamp( 0.3 + n1 * 0.9, 0.0, 1.0 ) );
vec3 skyRefl = mix( uHorizonColor, uSkyColor, clamp( surfNormal.y, 0.0, 1.0 ) );
vec3 color = mix( body, skyRefl, clamp( fresnel * 0.62, 0.0, 1.0 ) );

vec3 halfDir = normalize( uSunDirection + viewDir );
float spec = pow( max( dot( surfNormal, halfDir ), 0.0 ), 160.0 );
float glint = pow( max( dot( surfNormal, halfDir ), 0.0 ), 22.0 );
color += uSunColor * ( spec * 2.4 + glint * 0.35 ) * uSunIntensity;

float edgeLeft = 1.0 - clamp( vFlowUv.x / 0.1, 0.0, 1.0 );
float edgeRight = clamp( ( vFlowUv.x - 0.9 ) / 0.1, 0.0, 1.0 );
float edge = clamp( edgeLeft + edgeRight, 0.0, 1.0 );
float foamTex = waterFbm( vWorldPos.xz * 3.1 + vec2( uTime * 0.45, -uTime * 0.3 ) );
float foam = clamp( edge * ( 0.35 + foamTex * 0.5 ) + smoothstep( 0.78, 0.98, foamTex ) * 0.1, 0.0, 1.0 );
color = mix( color, vec3( 0.92, 0.95, 0.97 ), foam * 0.55 );

color *= mix( 1.0, 0.45, uNightFactor );
gl_FragColor = vec4( color, 0.82 + foam * 0.16 );
#include <fog_fragment>
`;
