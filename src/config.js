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
    fogDay: { near: 55, far: 265 },
    fogNight: { near: 34, far: 200 },
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
  },
  interaction: {
    repeatDelay: 0.22,
  },
};
