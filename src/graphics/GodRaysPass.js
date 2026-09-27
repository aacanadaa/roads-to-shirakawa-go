import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export const GodRaysShader = {
  name: 'GodRaysShader',
  uniforms: {
    tDiffuse: { value: null },
    uSunUv: { value: new THREE.Vector2(0.5, 0.9) },
    uIntensity: { value: 1 },
    uDensity: { value: 0.92 },
    uDecay: { value: 0.955 },
    uWeight: { value: 0.42 },
    uExposure: { value: 0.55 },
    uSamples: { value: 28 },
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
    uniform vec2 uSunUv;
    uniform float uIntensity;
    uniform float uDensity;
    uniform float uDecay;
    uniform float uWeight;
    uniform float uExposure;
    uniform float uSamples;
    varying vec2 vUv;

    void main() {
      vec3 base = texture2D( tDiffuse, vUv ).rgb;
      if ( uIntensity <= 0.001 ) {
        gl_FragColor = vec4( base, 1.0 );
        return;
      }

      vec2 delta = ( vUv - uSunUv ) * ( uDensity / uSamples );
      vec2 coord = vUv;
      float illum = 1.0;
      vec3 acc = vec3( 0.0 );

      for ( int i = 0; i < 32; i ++ ) {
        if ( float( i ) >= uSamples ) break;
        coord -= delta;
        if ( coord.x < 0.0 || coord.x > 1.0 || coord.y < 0.0 || coord.y > 1.0 ) {
          illum *= uDecay;
          continue;
        }
        vec3 sampleColor = texture2D( tDiffuse, coord ).rgb;
        float lum = max( max( sampleColor.r, sampleColor.g ), sampleColor.b );
        float bright = smoothstep( 0.72, 1.35, lum );
        acc += sampleColor * bright * illum;
        illum *= uDecay;
      }

      vec3 rays = acc * uWeight * uExposure * uIntensity;
      gl_FragColor = vec4( base + rays, 1.0 );
    }
  `,
};

export class GodRaysPass extends ShaderPass {
  constructor() {
    super(GodRaysShader);
    this.needsSwap = true;
  }

  setSun(uvX, uvY, visibility) {
    this.uniforms.uSunUv.value.set(uvX, uvY);
    this.uniforms.uIntensity.value = visibility;
  }
}
