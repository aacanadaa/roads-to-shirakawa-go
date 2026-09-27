export const waterVertexPars = /* glsl */ `
uniform float uTime;
uniform float uWaveHeight;
attribute float aFoam;
attribute float aPhase;
varying vec3 vWorldPos;
varying vec3 vWaterNormal;
varying float vFoam;
varying float vPhase;
#include <fog_pars_vertex>
`;

export const waterVertex = /* glsl */ `
vec3 waterPos = position;
vec4 waterWorld = vec4( waterPos, 1.0 );
#ifdef USE_INSTANCING
  waterWorld = instanceMatrix * waterWorld;
#endif
waterWorld = modelMatrix * waterWorld;

if ( normal.y > 0.5 ) {
  float wave =
    sin( waterWorld.x * 1.7 + uTime * 1.55 + aPhase ) * 0.55 +
    cos( waterWorld.z * 2.15 - uTime * 1.15 + aPhase * 1.7 ) * 0.45;
  waterWorld.y += wave * uWaveHeight;
}

vec3 waterNormal = normal;
#ifdef USE_INSTANCING
  waterNormal = mat3( instanceMatrix ) * waterNormal;
#endif
vWaterNormal = normalize( mat3( modelMatrix ) * waterNormal );
vWorldPos = waterWorld.xyz;
vFoam = aFoam;
vPhase = aPhase;

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
varying vec3 vWaterNormal;
varying float vFoam;
varying float vPhase;
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
vec3 baseNormal = normalize( vWaterNormal );

float ripA = sin( vWorldPos.x * 2.3 + uTime * 1.35 + vPhase ) * cos( vWorldPos.z * 1.85 - uTime * 0.95 );
float ripB = sin( vWorldPos.x * 5.2 - uTime * 2.1 + vPhase * 2.0 ) * cos( vWorldPos.z * 4.6 + uTime * 1.65 );
vec3 ripple = vec3( ripA * 0.55 + ripB * 0.35, 0.0, ripB * 0.55 - ripA * 0.35 );
vec3 surfNormal = normalize( baseNormal + ripple * 0.22 );

vec3 viewDir = normalize( cameraPosition - vWorldPos );
float fresnel = pow( 1.0 - max( dot( surfNormal, viewDir ), 0.0 ), 3.2 );

float flow = waterFbm( vWorldPos.xz * 0.85 + vec2( uTime * 0.16, uTime * 0.11 ) + vPhase );
vec3 body = mix( uDeepColor, uShallowColor, clamp( 0.35 + flow * 0.75, 0.0, 1.0 ) );
vec3 skyRefl = mix( uHorizonColor, uSkyColor, clamp( surfNormal.y, 0.0, 1.0 ) );
vec3 color = mix( body, skyRefl, clamp( fresnel * 0.85, 0.0, 1.0 ) );

vec3 halfDir = normalize( uSunDirection + viewDir );
float spec = pow( max( dot( surfNormal, halfDir ), 0.0 ), 120.0 );
float sparkle = pow( max( dot( surfNormal, halfDir ), 0.0 ), 28.0 );
color += uSunColor * ( spec * 1.6 + sparkle * 0.22 ) * uSunIntensity;

float foamTex = waterFbm( vWorldPos.xz * 2.6 + vec2( uTime * 0.32, -uTime * 0.21 ) + vPhase * 3.1 );
float foam = smoothstep( 0.3, 0.85, vFoam * ( 0.55 + foamTex * 0.85 ) );
float crest = smoothstep( 0.45, 0.95, vFoam ) * smoothstep( 0.55, 0.95, foamTex ) * 0.35;
foam = clamp( foam + crest, 0.0, 1.0 );
color = mix( color, vec3( 0.93, 0.96, 0.98 ), foam * 0.85 );

color *= mix( 1.0, 0.55, uNightFactor );
gl_FragColor = vec4( color, 0.8 + foam * 0.18 );
#include <fog_fragment>
`;
