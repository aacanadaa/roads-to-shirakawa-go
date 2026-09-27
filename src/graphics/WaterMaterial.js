import * as THREE from 'three';

export function createWaterMaterial() {
  const material = new THREE.ShaderMaterial({
    name: 'VoxelWaterShaderPack',
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uWaveHeight: { value: 0.08 },
        uSunDirection: { value: new THREE.Vector3(0.5, 0.8, 0.3) },
        uSunColor: { value: new THREE.Color(0xfff3dd) },
        uSkyColor: { value: new THREE.Color(0x8fc0e8) },
        uHorizonColor: { value: new THREE.Color(0xa9c9dd) },
        uDeepColor: { value: new THREE.Color(0x174a6e) },
        uShallowColor: { value: new THREE.Color(0x46a3cf) },
        uSunIntensity: { value: 1 },
        uNightFactor: { value: 0 },
      },
    ]),
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uWaveHeight;
      attribute float aFoam;
      varying vec3 vWorldPos;
      varying vec3 vWaterNormal;
      varying float vFoam;
      varying vec3 vTint;
      #include <fog_pars_vertex>
      void main() {
        vec3 p = position;
        vec4 wp = modelMatrix * vec4( p, 1.0 );
        if ( normal.y > 0.5 ) {
          float wave =
            sin( wp.x * 1.9 + uTime * 1.6 ) * 0.5 +
            cos( wp.z * 2.3 - uTime * 1.2 ) * 0.35 +
            sin( ( wp.x + wp.z ) * 0.9 - uTime * 0.8 ) * 0.3;
          wp.y += wave * uWaveHeight;
        }
        vWorldPos = wp.xyz;
        vWaterNormal = normalize( mat3( modelMatrix ) * normal );
        vFoam = aFoam;
        vTint = color;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
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
      varying vec3 vTint;
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
      void main() {
        float ripA = sin( vWorldPos.x * 2.4 + uTime * 1.4 ) * cos( vWorldPos.z * 2.0 - uTime * 1.0 );
        float ripB = sin( vWorldPos.x * 5.4 - uTime * 2.2 ) * cos( vWorldPos.z * 4.8 + uTime * 1.7 );
        vec3 ripple = vec3( ripA * 0.5 + ripB * 0.3, 0.0, ripB * 0.5 - ripA * 0.35 );
        vec3 surfNormal = normalize( normalize( vWaterNormal ) + ripple * 0.24 );

        vec3 viewDir = normalize( cameraPosition - vWorldPos );
        float fresnel = pow( 1.0 - max( dot( surfNormal, viewDir ), 0.0 ), 2.8 );

        float flow = waterFbm( vWorldPos.xz * 0.8 + vec2( uTime * 0.15, uTime * 0.1 ) );
        vec3 tinted = uShallowColor * ( 0.55 + vTint.b * 1.1 );
        vec3 body = mix( uDeepColor, tinted, clamp( 0.3 + flow * 0.85, 0.0, 1.0 ) );
        vec3 skyRefl = mix( uHorizonColor, uSkyColor, clamp( surfNormal.y, 0.0, 1.0 ) );
        vec3 color = mix( body, skyRefl, clamp( fresnel * 0.7, 0.0, 1.0 ) );

        vec3 halfDir = normalize( uSunDirection + viewDir );
        float spec = pow( max( dot( surfNormal, halfDir ), 0.0 ), 180.0 );
        float glint = pow( max( dot( surfNormal, halfDir ), 0.0 ), 24.0 );
        color += uSunColor * ( spec * 2.6 + glint * 0.4 ) * uSunIntensity;

        float foamTex = waterFbm( vWorldPos.xz * 2.7 + vec2( uTime * 0.35, -uTime * 0.22 ) );
        float foam = smoothstep( 0.28, 0.85, vFoam * ( 0.5 + foamTex * 0.9 ) );
        float crest = smoothstep( 0.5, 0.95, vFoam ) * smoothstep( 0.6, 0.95, foamTex ) * 0.4;
        foam = clamp( foam + crest, 0.0, 1.0 );
        color = mix( color, vec3( 0.93, 0.96, 0.98 ), foam * 0.85 );

        color *= mix( 1.0, 0.5, uNightFactor );
        gl_FragColor = vec4( color, 0.8 + foam * 0.18 );
        #include <fog_fragment>
      }
    `,
    vertexColors: true,
  });

  return material;
}
