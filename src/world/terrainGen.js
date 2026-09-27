import { Noise, mulberry32 } from './noise.js';
import { clamp, lerp, smoothstep } from '../utils.js';

function boxBlur1D(arr, radius, passes = 2) {
  const n = arr.length;
  const tmp = new Float32Array(n);
  for (let p = 0; p < passes; p += 1) {
    for (let i = 0; i < n; i += 1) {
      let sum = 0;
      let count = 0;
      for (let k = -radius; k <= radius; k += 1) {
        const j = i + k;
        if (j < 0 || j >= n) continue;
        sum += arr[j];
        count += 1;
      }
      tmp[i] = sum / count;
    }
    arr.set(tmp);
  }
  return arr;
}

export function generateTerrain() {
  const sizeX = 320;
  const sizeZ = 320;
  const maxHeight = 92;
  const seed = 20260924;
  const noise = new Noise(seed);
  const noise2 = new Noise(seed + 917);
  const rand = mulberry32(seed ^ 0x5f3759df);

  const centerX = sizeX / 2;
  const centerZ = sizeZ / 2;

  const roadX = (z) =>
    centerX + 40 * Math.sin(z * 0.0138 + 0.4) + 12 * Math.sin(z * 0.0062 + 2.1);
  const riverX = (z) =>
    centerX + 72 * Math.sin(z * 0.0092 + 2.4) + 16 * Math.sin(z * 0.021 + 0.9);

  // ---- 1. base heightfield ----------------------------------------------
  const heights = new Float32Array(sizeX * sizeZ);
  for (let z = 0; z < sizeZ; z += 1) {
    for (let x = 0; x < sizeX; x += 1) {
      const base = noise.fbm2(x * 0.0104, z * 0.0104, 5);
      const ridge = noise2.ridge2(x * 0.0072, z * 0.0072, 5);
      const detail = noise.fbm2(x * 0.05, z * 0.05, 2) * 1.6;
      const nx = (x - centerX) / (centerX * 0.7);
      const nz = (z - centerZ) / (centerZ * 0.7);
      const edge = smoothstep(0.5, 1.18, Math.sqrt(nx * nx + nz * nz));
      let h = 13 + base * 9 + ridge * 38 * edge + edge * 16 + detail;
      heights[z * sizeX + x] = clamp(h, 5, maxHeight - 4);
    }
  }

  // ---- 2. road / river profiles -----------------------------------------
  const roadH = new Float32Array(sizeZ);
  const riverH = new Float32Array(sizeZ);
  for (let z = 0; z < sizeZ; z += 1) {
    const rx = clamp(Math.round(roadX(z)), 0, sizeX - 1);
    const vx = clamp(Math.round(riverX(z)), 0, sizeX - 1);
    roadH[z] = heights[z * sizeX + rx];
    riverH[z] = heights[z * sizeX + vx];
  }
  boxBlur1D(roadH, 12, 3);
  boxBlur1D(riverH, 8, 2);

  // ---- 3. bridge crossings ----------------------------------------------
  const crossings = [];
  for (let z = 8; z < sizeZ - 8; z += 1) {
    const f0 = roadX(z - 1) - riverX(z - 1);
    const f1 = roadX(z) - riverX(z);
    if ((f0 <= 0 && f1 > 0) || (f0 >= 0 && f1 < 0)) {
      if (crossings.length === 0 || Math.abs(z - crossings[crossings.length - 1]) > 60) {
        crossings.push(z);
      }
    }
  }
  if (crossings.length === 0) crossings.push(Math.floor(sizeZ * 0.5));

  // ---- 4. farmhouse pads -------------------------------------------------
  const houses = [];
  const houseZs = [42, 72, 104, 138, 172, 206, 240, 272];
  for (let i = 0; i < houseZs.length; i += 1) {
    const z = Math.round(houseZs[i] + (rand() - 0.5) * 8);
    const side = i % 2 === 0 ? 1 : -1;
    const offset = 17 + rand() * 8;
    const cx = Math.round(roadX(z) + side * offset);
    const cz = z;
    if (cx < 22 || cx > sizeX - 22 || cz < 22 || cz > sizeZ - 22) continue;
    let tooClose = false;
    for (const other of houses) {
      if (Math.hypot(other.x - cx, other.z - cz) < 34) tooClose = true;
    }
    if (tooClose) continue;
    if (Math.abs(cx - riverX(cz)) < 18) continue;

    const padY = Math.round(roadH[clamp(cz, 0, sizeZ - 1)] + 1);
    houses.push({
      x: cx,
      z: cz,
      y: padY,
      side,
      yaw: side > 0 ? -Math.PI * 0.5 : Math.PI * 0.5,
      scale: 0.95 + rand() * 0.25,
    });
  }

  // ---- 5. carve roads + rivers + pads into the heightfield ---------------
  const waterY = new Float32Array(sizeX * sizeZ).fill(-1000);

  for (let z = 0; z < sizeZ; z += 1) {
    const rX = roadX(z);
    const vX = riverX(z);
    const bankY = riverH[z];
    const surfaceWaterY = bankY - 2.6;

    for (let x = 0; x < sizeX; x += 1) {
      let h = heights[z * sizeX + x];

      const dRoad = Math.abs(x - rX);
      if (dRoad < 5.5) h = roadH[z];
      else if (dRoad < 12) h = lerp(roadH[z], h, smoothstep(5.5, 12, dRoad));

      const dRiver = Math.abs(x - vX);
      if (dRiver < 5.2) {
        const t = smoothstep(0, 5.2, dRiver);
        h = Math.min(h, lerp(surfaceWaterY - 2.4, surfaceWaterY + 0.7, t * t));
      } else if (dRiver < 11) {
        const t = smoothstep(5.2, 11, dRiver);
        h = Math.min(h, lerp(surfaceWaterY + 0.7, h, t));
      }

      for (const house of houses) {
        const dx = Math.abs(x - house.x);
        const dz = Math.abs(z - house.z);
        const r = 15;
        if (dx < r && dz < r) {
          const t = smoothstep(r - 6, r, Math.max(dx, dz));
          h = lerp(house.y, h, t);
        }
      }

      heights[z * sizeX + x] = h;

      if (dRiver < 6.5 && h < surfaceWaterY) {
        waterY[z * sizeX + x] = surfaceWaterY;
      } else {
        waterY[z * sizeX + x] = -1000;
      }
    }
  }

  // ---- 6. scenery placement ---------------------------------------------
  const trees = [];
  const rocks = [];
  const bamboos = [];
  const lanterns = [];

  const treeDensity = (x, z) => {
    const grove = noise.fbm2(x * 0.017 + 31.7, z * 0.017 + 11.3, 3);
    const mapleBand = noise2.fbm2(x * 0.0095 + 90, z * 0.0095 + 45, 2);
    const birchBand = noise.fbm2(x * 0.013 + 210, z * 0.013 + 88, 2);
    return { grove, mapleBand, birchBand };
  };

  for (let z = 6; z < sizeZ - 6; z += 2) {
    const rX = roadX(z);
    const vX = riverX(z);
    for (let x = 6; x < sizeX - 6; x += 2) {
      const dRoad = Math.abs(x - rX);
      const dRiver = Math.abs(x - vX);
      const h = heights[z * sizeX + x];
      const dHouse = houses.reduce(
        (min, house) => Math.min(min, Math.hypot(house.x - x, house.z - z)),
        Infinity
      );
      const { grove, mapleBand, birchBand } = treeDensity(x, z);
      const slope = Math.abs(heights[z * sizeX + clamp(x + 2, 0, sizeX - 1)] - h) +
        Math.abs(heights[clamp(z + 2, 0, sizeZ - 1) * sizeX + x] - h);

      if (dRoad < 9 || dRiver < 8 || dHouse < 17) continue;
      if (h < 7 || h > 52 || slope > 3.2) continue;
      if (rand() > 0.075 + grove * 0.115) continue;

      const jitterX = x + (rand() - 0.5) * 3.4;
      const jitterZ = z + (rand() - 0.5) * 3.4;
      const jx = clamp(Math.round(jitterX), 0, sizeX - 1);
      const jz = clamp(Math.round(jitterZ), 0, sizeZ - 1);
      const jh = heights[jz * sizeX + jx];

      let type = 'pine';
      if (mapleBand > 0.05) type = 'maple';
      else if (birchBand > 0.22) type = 'birch';

      trees.push({
        x: jitterX,
        y: jh,
        z: jitterZ,
        type,
        scale: 0.8 + rand() * 0.55,
        yaw: rand() * Math.PI * 2,
        tint: rand(),
      });

      if (rand() < 0.12) {
        const count = 1 + Math.floor(rand() * 3);
        for (let r = 0; r < count; r += 1) {
          rocks.push({
            x: jitterX + (rand() - 0.5) * 7,
            z: jitterZ + (rand() - 0.5) * 7,
            scale: 0.8 + rand() * 2.1,
            yaw: rand() * Math.PI * 2,
            mossy: rand() > 0.35,
          });
        }
      }
    }
  }

  for (let z = 10; z < sizeZ - 10; z += 3) {
    const rX = roadX(z);
    for (let x = 10; x < sizeX - 10; x += 3) {
      const dRoad = Math.abs(x - rX);
      const h = heights[z * sizeX + x];
      const patch = noise2.fbm2(x * 0.045 + 55, z * 0.045 + 77, 2);
      if (dRoad > 18 && dRoad < 78 && patch > 0.3 && h > 9 && h < 36 && rand() < 0.34) {
        const stalks = 2 + Math.floor(rand() * 3);
        for (let s = 0; s < stalks; s += 1) {
          bamboos.push({
            x: x + (rand() - 0.5) * 5,
            z: z + (rand() - 0.5) * 5,
            height: 7 + rand() * 6,
            yaw: rand() * Math.PI * 2,
            lean: (rand() - 0.5) * 0.16,
          });
        }
      }
    }
  }

  for (let z = 18; z < sizeZ - 18; z += 26) {
    const lz = clamp(z + Math.round((rand() - 0.5) * 10), 10, sizeZ - 10);
    const side = rand() > 0.5 ? 1 : -1;
    const lx = clamp(roadX(lz) + side * 7.2, 4, sizeX - 4);
    const lh = heights[clamp(Math.round(lz), 0, sizeZ - 1) * sizeX + clamp(Math.round(lx), 0, sizeX - 1)];
    lanterns.push({ x: lx, y: lh, z: lz, yaw: rand() * Math.PI * 2 });
  }

  const bridges = crossings.map((z0) => {
    const vx = riverX(z0);
    const deckY = roadH[clamp(z0, 0, sizeZ - 1)] + 0.25;
    return {
      x: vx,
      z: z0,
      y: deckY,
      yaw: Math.atan2(riverX(z0 + 4) - riverX(z0 - 4), 8) + Math.PI * 0.5,
      length: 22,
      width: 7.5,
    };
  });

  const spawnZ = 30;
  const spawnX = roadX(spawnZ);
  const spawnY = roadH[clamp(Math.round(spawnZ), 0, sizeZ - 1)];

  return {
    seed,
    sizeX,
    sizeZ,
    maxHeight,
    heights,
    waterY,
    roadX,
    riverX,
    roadH,
    riverH,
    crossings,
    bridges,
    houses,
    trees,
    rocks,
    bamboos,
    lanterns,
    spawn: { x: spawnX, y: spawnY + 1.2, z: spawnZ },
  };
}
