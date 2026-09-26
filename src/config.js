export const CONFIG = {
  world: {
    sizeX: 256,
    sizeZ: 256,
    height: 64,
    chunkSize: 16,
    seed: 20260924,
  },
  render: {
    maxPixelRatio: 1.5,
  },
  graphics: {
    quality: 'high',
    toneMappingExposure: 1.08,
    shadows: {
      enabled: true,
      mapSize: 2048,
      extent: 55,
      bias: -0.00025,
      normalBias: 0.065,
    },
    ssao: {
      enabled: true,
      kernelSize: 16,
      kernelRadius: 9,
      minDistance: 0.0022,
      maxDistance: 0.075,
    },
    bloom: {
      strength: 0.48,
      radius: 0.72,
      threshold: 0.68,
    },
    colorGrade: {
      vignette: 0.28,
      grain: 0.028,
      chromatic: 0.0016,
      saturation: 1.06,
      contrast: 1.03,
    },
    particles: {
      motes: 650,
      fireflies: 150,
      leaves: 300,
      volume: 72,
    },
    water: {
      waveHeight: 0.07,
    },
  },
  player: {
    width: 0.6,
    height: 1.8,
    eyeHeight: 1.62,
    walkSpeed: 5.2,
    sprintSpeed: 8.4,
    swimSpeed: 3.2,
    acceleration: 42,
    friction: 16,
    airControl: 0.35,
    gravity: 25,
    jumpVelocity: 8.6,
    swimUpVelocity: 4.2,
    stepHeight: 1.05,
    reach: 6,
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
    bloom: { strength: 0.48 },
    particles: { motes: 650, fireflies: 150, leaves: 300 },
    maxPixelRatio: 1.5,
  },
  medium: {
    shadows: { enabled: true, mapSize: 1024 },
    ssao: { enabled: false },
    bloom: { strength: 0.42 },
    particles: { motes: 320, fireflies: 90, leaves: 160 },
    maxPixelRatio: 1.25,
  },
  low: {
    shadows: { enabled: false, mapSize: 512 },
    ssao: { enabled: false },
    bloom: { strength: 0.32 },
    particles: { motes: 120, fireflies: 40, leaves: 70 },
    maxPixelRatio: 1,
  },
};
