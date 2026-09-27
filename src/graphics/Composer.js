import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/examples/jsm/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { ColorGradeShader } from '../shaders/colorGrade.js';
import { GodRaysPass } from './GodRaysPass.js';

export class PostPipeline {
  constructor(renderer, scene, camera, width, height, graphics) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.graphics = graphics;

    const target = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      colorSpace: THREE.LinearSRGBColorSpace,
      depthBuffer: true,
    });

    this.composer = new EffectComposer(renderer, target);
    this.composer.setPixelRatio(renderer.getPixelRatio());

    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    this.ssaoPass = new SSAOPass(scene, camera, width, height, graphics.ssao.kernelSize);
    this.ssaoPass.kernelRadius = graphics.ssao.kernelRadius;
    this.ssaoPass.minDistance = graphics.ssao.minDistance;
    this.ssaoPass.maxDistance = graphics.ssao.maxDistance;
    this.ssaoPass.enabled = graphics.ssao.enabled;
    this.composer.addPass(this.ssaoPass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      graphics.bloom.strength,
      graphics.bloom.radius,
      graphics.bloom.threshold
    );
    this.composer.addPass(this.bloomPass);

    this.godRaysPass = new GodRaysPass();
    this.godRaysPass.uniforms.uDensity.value = graphics.godRays.density;
    this.godRaysPass.uniforms.uDecay.value = graphics.godRays.decay;
    this.godRaysPass.uniforms.uWeight.value = graphics.godRays.weight;
    this.godRaysPass.uniforms.uExposure.value = graphics.godRays.exposure;
    this.godRaysPass.uniforms.uSamples.value = graphics.godRays.samples;
    this.godRaysPass.enabled = graphics.godRays.enabled;
    this.composer.addPass(this.godRaysPass);

    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);

    this.smaaPass = new SMAAPass();
    this.composer.addPass(this.smaaPass);

    this.gradePass = new ShaderPass(ColorGradeShader);
    const grade = this.gradePass.uniforms;
    grade.uVignette.value = graphics.colorGrade.vignette;
    grade.uGrain.value = graphics.colorGrade.grain;
    grade.uChroma.value = graphics.colorGrade.chromatic;
    grade.uSaturation.value = graphics.colorGrade.saturation;
    grade.uContrast.value = graphics.colorGrade.contrast;
    grade.uWarmth.value = graphics.colorGrade.warmth;
    this.composer.addPass(this.gradePass);
  }

  setSize(width, height, pixelRatio) {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
    this.ssaoPass.setSize(width, height);
    this.bloomPass.setSize(width, height);
    this.smaaPass.setSize(width, height);
  }

  setTime(time) {
    this.gradePass.uniforms.uTime.value = time;
  }

  setSun(uvX, uvY, visibility) {
    this.godRaysPass.setSun(uvX, uvY, visibility);
    this.gradePass.uniforms.uSunUv.value = [uvX, uvY];
    this.gradePass.uniforms.uSunVis.value = visibility;
  }

  setQuality(name, preset) {
    this.ssaoPass.enabled = preset.ssao.enabled && this.graphics.ssao.enabled;
    this.bloomPass.strength = preset.bloom.strength;
    this.godRaysPass.enabled = preset.godRays.enabled && this.graphics.godRays.enabled;
    void name;
  }

  render() {
    this.composer.render();
  }
}
