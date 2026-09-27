export const CONFIG = {
  world: {
    sizeX: 288,
    sizeZ: 288,
    height: 80,
    chunkSize: 24,
    seed: 20260924,
  },
  render: {
    maxPixelRatio: 1.5,
  },
  graphics: {
    quality: 'high',
    toneMappingExposure: 1.02,
    shadows: {
      enabled: true,
      mapSize: 2048,
      extent: 70,
      bias: -0.0002,
      normalBias: 0.05,
    },
    ssao: {
      enabled: true,
      kernelSize: 16,
      kernelRadius: 8,
      minDistance: 0.0022,
      maxDistance: 0.075,
    },
    bloom: {
      strength: 0.5,
      radius: 0.72,
      threshold: 0.7,
    },
    godRays: {
      enabled: true,
      density: 0.88,
      decay: 0.95,
      weight: 0.3,
      exposure: 0.26,
      samples: 28,
    },
    colorGrade: {
      vignette: 0.24,
      grain: 0.022,
      chromatic: 0.0014,
      saturation: 1.14,
      contrast: 1.05,
      warmth: 0.1,
    },
    particles: {
      motes: 600,
      fireflies: 160,
      leaves: 340,
      volume: 76,
    },
    water: {
      waveHeight: 0.08,
    },
    wind: {
      strength: 1,
      gust: 0.4,
    },
  },
  player: {
    width: 0.6,
    height: 1.8,
    eyeHeight: 1.62,
    walkSpeed: 5.6,
    sprintSpeed: 9.0,
    swimSpeed: 3.4,
    acceleration: 44,
    friction: 15,
    airControl: 0.38,
    gravity: 25,
    jumpVelocity: 8.6,
    swimUpVelocity: 4.2,
    stepHeight: 1.05,
    reach: 7,
  },
  sky: {
    dayLengthSeconds: 240,
  },
  audio: {
    masterVolume: 0.55,
    footsteps: true,
    spatial: true,
  },
  interaction: {
    repeatDelay: 0.22,
  },
};

export const QUALITY_PRESETS = {
  high: {
    shadows: { enabled: true, mapSize: 2048 },
    ssao: { enabled: true },
    bloom: { strength: 0.5 },
    godRays: { enabled: true },
    particles: { motes: 600, fireflies: 160, leaves: 340 },
    maxPixelRatio: 1.5,
  },
  medium: {
    shadows: { enabled: true, mapSize: 1024 },
    ssao: { enabled: false },
    bloom: { strength: 0.44 },
    godRays: { enabled: true },
    particles: { motes: 300, fireflies: 90, leaves: 170 },
    maxPixelRatio: 1.25,
  },
  low: {
    shadows: { enabled: false, mapSize: 512 },
    ssao: { enabled: false },
    bloom: { strength: 0.34 },
    godRays: { enabled: false },
    particles: { motes: 120, fireflies: 40, leaves: 80 },
    maxPixelRatio: 1,
  },
};
