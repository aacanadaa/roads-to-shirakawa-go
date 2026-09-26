export const ColorGradeShader = {
  name: 'ColorGradeShader',
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.42 },
    uGrain: { value: 0.045 },
    uChroma: { value: 0.0022 },
    uSaturation: { value: 1.08 },
    uContrast: { value: 1.045 },
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
    varying vec2 vUv;

    float gradeHash( vec2 p ) {
      return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
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

      float vignette = 1.0 - uVignette * smoothstep( 0.28, 1.02, length( center ) * 1.52 );
      color *= vignette;

      float lum = dot( color, vec3( 0.2126, 0.7152, 0.0722 ) );
      color = mix( vec3( lum ), color, uSaturation );
      color = ( color - 0.5 ) * uContrast + 0.5;

      float grain = gradeHash( uv * vec2( 1673.0, 927.0 ) + fract( uTime ) * 61.7 );
      color += ( grain - 0.5 ) * uGrain * ( 0.55 + 0.75 * ( 1.0 - lum ) );

      gl_FragColor = vec4( max( color, 0.0 ), 1.0 );
    }
  `,
};
