export const ColorGradeShader = {
  name: 'ColorGradeShader',
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.24 },
    uGrain: { value: 0.022 },
    uChroma: { value: 0.0014 },
    uSaturation: { value: 1.16 },
    uContrast: { value: 1.05 },
    uWarmth: { value: 0.1 },
    uSunUv: { value: [0.5, 0.9] },
    uSunVis: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uChroma;
    uniform float uSaturation;
    uniform float uContrast;
    uniform float uWarmth;
    uniform vec2 uSunUv;
    uniform float uSunVis;
    varying vec2 vUv;

    float gradeHash( vec2 p ) {
      return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
    }

    float ghost( vec2 uv, vec2 center, float size ) {
      float d = length( uv - center );
      return smoothstep( size, 0.0, d );
    }

    void main() {
      vec2 uv = vUv;
      vec2 center = uv - 0.5;
      float r2 = dot( center, center );
      float aberration = uChroma * ( 0.35 + r2 * 2.4 );

      vec3 color;
      color.r = texture2D( tDiffuse, uv + center * aberration ).r;
      color.g = texture2D( tDiffuse, uv ).g;
      color.b = texture2D( tDiffuse, uv - center * aberration ).b;

      if ( uSunVis > 0.001 ) {
        vec2 axis = ( vec2( 0.5 ) - uSunUv );
        float flare = 0.0;
        flare += ghost( uv, uSunUv + axis * 0.42, 0.055 ) * 0.5;
        flare += ghost( uv, uSunUv + axis * 0.72, 0.038 ) * 0.32;
        flare += ghost( uv, uSunUv + axis * 1.05, 0.062 ) * 0.28;
        flare += ghost( uv, uSunUv + axis * 1.38, 0.026 ) * 0.22;
        float halo = smoothstep( 0.32, 0.14, abs( length( uv - uSunUv ) - 0.22 ) ) * 0.16;
        vec3 flareTint = mix( vec3( 1.0, 0.72, 0.42 ), vec3( 0.55, 0.85, 1.0 ), 0.35 );
        color += flareTint * ( flare + halo ) * uSunVis * 0.26;
      }

      float lum = dot( color, vec3( 0.2126, 0.7152, 0.0722 ) );
      color += vec3( uWarmth * 0.12, uWarmth * 0.05, -uWarmth * 0.06 ) * ( 1.0 - lum * 0.6 );

      float vignette = 1.0 - uVignette * smoothstep( 0.28, 1.02, length( center ) * 1.52 );
      color *= vignette;

      lum = dot( color, vec3( 0.2126, 0.7152, 0.0722 ) );
      color = mix( vec3( lum ), color, uSaturation );
      color = ( color - 0.5 ) * uContrast + 0.5;

      float grain = gradeHash( uv * vec2( 1673.0, 927.0 ) + fract( uTime ) * 61.7 );
      color += ( grain - 0.5 ) * uGrain * ( 0.55 + 0.75 * ( 1.0 - lum ) );

      gl_FragColor = vec4( max( color, 0.0 ), 1.0 );
    }
  `,
};
