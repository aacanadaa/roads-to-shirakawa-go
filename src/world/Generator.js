import { BLOCK } from './blocks.js';
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

export function generateWorld(world) {
  const { sizeX, sizeZ, height } = world;
  const seed = 20260924;
  const noise = new Noise(seed);
  const noise2 = new Noise(seed + 917);
  const rand = mulberry32(seed ^ 0x5f3759df);

  const centerX = sizeX / 2;
  const centerZ = sizeZ / 2;

  const roadX = (z) =>
    centerX + 34 * Math.sin(z * 0.0165 + 0.4) + 10 * Math.sin(z * 0.007 + 2.1);
  const riverX = (z) =>
    centerX + 64 * Math.sin(z * 0.0105 + 2.4) + 14 * Math.sin(z * 0.023 + 0.9);

  // ---- 1. base terrain heights -------------------------------------------
  const heights = new Float32Array(sizeX * sizeZ);
  for (let z = 0; z < sizeZ; z += 1) {
    for (let x = 0; x < sizeX; x += 1) {
      const base = noise.fbm2(x * 0.0125, z * 0.0125, 4);
      const ridge = noise2.ridge2(x * 0.0085, z * 0.0085, 4);
      const detail = noise.noise2(x * 0.06, z * 0.06) * 1.4;
      const nx = (x - centerX) / (centerX * 0.72);
      const nz = (z - centerZ) / (centerZ * 0.72);
      const edge = smoothstep(0.55, 1.15, Math.sqrt(nx * nx + nz * nz));
      let h = 11 + base * 8 + ridge * 30 * edge + edge * 14 + detail;
      heights[z * sizeX + x] = clamp(h, 5, height - 8);
    }
  }

  // ---- 2. road / river height profiles -----------------------------------
  const roadH = new Float32Array(sizeZ);
  const riverH = new Float32Array(sizeZ);
  for (let z = 0; z < sizeZ; z += 1) {
    const rx = clamp(Math.round(roadX(z)), 0, sizeX - 1);
    const vx = clamp(Math.round(riverX(z)), 0, sizeX - 1);
    roadH[z] = heights[z * sizeX + rx];
    riverH[z] = heights[z * sizeX + vx];
  }
  boxBlur1D(roadH, 10, 3);
  boxBlur1D(riverH, 7, 2);

  // ---- 3. bridge crossings -----------------------------------------------
  const crossings = [];
  for (let z = 6; z < sizeZ - 6; z += 1) {
    const f0 = roadX(z - 1) - riverX(z - 1);
    const f1 = roadX(z) - riverX(z);
    if ((f0 <= 0 && f1 > 0) || (f0 >= 0 && f1 < 0)) {
      if (crossings.length === 0 || Math.abs(z - crossings[crossings.length - 1]) > 40) {
        crossings.push(z);
      }
    }
  }
  if (crossings.length === 0) crossings.push(Math.floor(sizeZ * 0.5));

  // ---- 4. gassho house sites ---------------------------------------------
  const houses = [];
  const houseZs = [36, 58, 84, 112, 140, 168, 196, 222];
  for (let i = 0; i < houseZs.length; i += 1) {
    const z = Math.round(houseZs[i] + (rand() - 0.5) * 6);
    const side = i % 2 === 0 ? 1 : -1;
    const offset = 15 + rand() * 7;
    const cx = Math.round(roadX(z) + side * offset);
    const cz = z;
    if (cx < 14 || cx > sizeX - 14 || cz < 14 || cz > sizeZ - 14) continue;

    let tooClose = false;
    for (const other of houses) {
      if (Math.hypot(other.x - cx, other.z - cz) < 26) tooClose = true;
    }
    if (tooClose) continue;
    if (Math.abs(cx - riverX(cz)) < 14) continue;

    houses.push({
      x: cx,
      z: cz,
      side,
      y: Math.round(roadH[clamp(cz, 0, sizeZ - 1)] + 1),
      w: 9,
      d: 13 + (i % 2) * 2,
    });
  }

  // ---- 5. column fill ----------------------------------------------------
  const surfaceY = new Int16Array(sizeX * sizeZ);
  const waterYMap = new Int16Array(sizeX * sizeZ).fill(-1);

  for (let z = 0; z < sizeZ; z += 1) {
    const rX = roadX(z);
    const vX = riverX(z);
    const bankY = clamp(Math.round(riverH[z]), 6, height - 12);
    const surfaceWaterY = bankY - 3;

    for (let x = 0; x < sizeX; x += 1) {
      let h = heights[z * sizeX + x];

      const dRoad = Math.abs(x - rX);
      if (dRoad < 4) h = roadH[z];
      else if (dRoad < 9) h = lerp(roadH[z], h, smoothstep(4, 9, dRoad));

      const dRiver = Math.abs(x - vX);
      const inChannel = dRiver < 4.2;
      const inBanks = dRiver < 7.5;

      if (inBanks) {
        const target = inChannel ? surfaceWaterY - 2 : surfaceWaterY;
        h = Math.min(h, lerp(target, h, smoothstep(4.2, 7.5, dRiver)));
      }

      let inHousePad = false;
      for (const house of houses) {
        if (Math.abs(x - house.x) <= house.w && Math.abs(z - house.z) <= house.d) {
          h = house.y;
          inHousePad = true;
          break;
        }
      }

      h = Math.round(clamp(h, 3, height - 4));
      surfaceY[z * sizeX + x] = h;

      let surface = BLOCK.GRASS;
      if (inHousePad) surface = BLOCK.GRASS;
      else if (dRoad < 4) surface = BLOCK.ROAD;
      else if (dRoad < 6.5) surface = BLOCK.GRAVEL;
      else if (inBanks && h <= surfaceWaterY) surface = BLOCK.SAND;
      else if (h > 43) surface = BLOCK.SNOW;
      else if (h > 38 && noise2.noise2(x * 0.09, z * 0.09) > 0.18) surface = BLOCK.SNOW;
      else if (noise.noise2(x * 0.05 + 40, z * 0.05 + 12) > 0.52) surface = BLOCK.GRAVEL;

      for (let y = 0; y <= h; y += 1) {
        let id;
        if (y === 0) id = BLOCK.BEDROCK;
        else if (y === h) id = surface;
        else if (y > h - 3) id = surface === BLOCK.SAND ? BLOCK.SAND : BLOCK.DIRT;
        else id = BLOCK.STONE;
        world.data[world.index(x, y, z)] = id;
      }

      if (inBanks && h < surfaceWaterY) {
        for (let y = h + 1; y <= surfaceWaterY; y += 1) {
          world.data[world.index(x, y, z)] = BLOCK.WATER;
        }
        waterYMap[z * sizeX + x] = surfaceWaterY;
      }
    }
  }

  // ---- 6. bridges --------------------------------------------------------
  const bridges = [];
  for (const z0 of crossings) {
    const vx = Math.round(riverX(z0));
    const deckY = Math.round(clamp(roadH[clamp(z0, 0, sizeZ - 1)], 8, height - 12));
    bridges.push({ z: z0, x: vx, y: deckY });

    const halfSpan = 7;
    const halfWidth = 6;

    for (let dz = -halfSpan; dz <= halfSpan; dz += 1) {
      const z = z0 + dz;
      if (z < 0 || z >= sizeZ) continue;
      for (let dx = -halfWidth; dx <= halfWidth; dx += 1) {
        const x = vx + dx;
        if (x < 0 || x >= sizeX) continue;
        if (Math.abs(x - riverX(z)) > 6.4) continue;

        for (let y = deckY; y > deckY - 2 && y > 0; y -= 1) {
          world.data[world.index(x, y, z)] = BLOCK.WOOD;
        }
        for (let y = deckY + 1; y <= height - 1; y += 1) {
          const id = world.data[world.index(x, y, z)];
          if (id === BLOCK.AIR) break;
          world.data[world.index(x, y, z)] = BLOCK.AIR;
        }

        const edge = Math.abs(x - riverX(z)) > 5.2;
        if (edge && Math.abs(dz) <= halfSpan) {
          for (let y = deckY + 1; y <= deckY + 2; y += 1) {
            if (dz % 2 === 0 || y === deckY + 2) {
              world.data[world.index(x, y, z)] = BLOCK.WOOD;
            }
          }
        }
      }
    }

    for (const sx of [-5, 5]) {
      for (const sz of [-5, 5]) {
        const px = vx + sx;
        const pz = z0 + sz;
        if (px < 0 || px >= sizeX || pz < 0 || pz >= sizeZ) continue;
        for (let y = deckY - 2; y < deckY; y += 1) {
          if (y > 0 && world.data[world.index(px, y, pz)] === BLOCK.AIR) {
            world.data[world.index(px, y, pz)] = BLOCK.WOOD;
          }
        }
      }
    }
  }

  // ---- 7. trees ----------------------------------------------------------
  for (let z = 3; z < sizeZ - 3; z += 1) {
    const rX = roadX(z);
    const vX = riverX(z);
    for (let x = 3; x < sizeX - 3; x += 1) {
      const dRoad = Math.abs(x - rX);
      const dRiver = Math.abs(x - vX);
      if (dRoad < 10 || dRiver < 9) continue;

      const h = surfaceY[z * sizeX + x];
      if (h <= 1 || h >= 38) continue;
      if (world.data[world.index(x, h, z)] !== BLOCK.GRASS) continue;

      const density = noise.fbm2(x * 0.045 + 31.7, z * 0.045 + 11.3, 2);
      if (rand() > 0.026 + density * 0.022) continue;

      const mapleGroves = noise2.fbm2(x * 0.018 + 90, z * 0.018 + 45, 2);
      const isMaple = mapleGroves > 0.02;
      const birchBand = noise.fbm2(x * 0.03 + 210, z * 0.03 + 88, 2);
      const isBirch = !isMaple && birchBand > 0.18;

      const groundY = h + 1;
      if (isMaple) {
        const trunkH = 3 + Math.floor(rand() * 2);
        for (let y = 0; y < trunkH; y += 1) {
          world.data[world.index(x, groundY + y, z)] = BLOCK.TRUNK;
        }
        const canopyY = groundY + trunkH - 1;
        const r = 2.3 + rand() * 0.9;
        for (let dy = -1; dy <= 2; dy += 1) {
          for (let dx = -3; dx <= 3; dx += 1) {
            for (let dz = -3; dz <= 3; dz += 1) {
              const dist = Math.sqrt(dx * dx + dz * dz + dy * dy * 1.6);
              if (dist > r) continue;
              const bx = x + dx;
              const by = canopyY + dy;
              const bz = z + dz;
              if (bx < 0 || bx >= sizeX || bz < 0 || bz >= sizeZ || by >= height) continue;
              const idx = world.index(bx, by, bz);
              if (world.data[idx] === BLOCK.AIR) world.data[idx] = BLOCK.MAPLE;
            }
          }
        }
      } else {
        const trunkType = isBirch ? BLOCK.BIRCH : BLOCK.TRUNK;
        const leafType = isBirch ? BLOCK.BIRCH_LEAF : BLOCK.PINE;
        const trunkH = isBirch ? 5 + Math.floor(rand() * 2) : 4 + Math.floor(rand() * 3);
        for (let y = 0; y < trunkH; y += 1) {
          world.data[world.index(x, groundY + y, z)] = trunkType;
        }
        const canopyBase = groundY + trunkH - 2;
        const layers = isBirch
          ? [
              { dy: 0, r: 2.3 },
              { dy: 1, r: 1.9 },
              { dy: 2, r: 1.2 },
            ]
          : [
              { dy: 0, r: 2.6 },
              { dy: 1, r: 2.1 },
              { dy: 2, r: 1.4 },
              { dy: 3, r: 0.7 },
            ];
        for (const layer of layers) {
          const r2 = layer.r * layer.r;
          for (let dx = -3; dx <= 3; dx += 1) {
            for (let dz = -3; dz <= 3; dz += 1) {
              if (dx * dx + dz * dz > r2 + 0.4) continue;
              const bx = x + dx;
              const by = canopyBase + layer.dy;
              const bz = z + dz;
              if (bx < 0 || bx >= sizeX || bz < 0 || bz >= sizeZ || by >= height) continue;
              const idx = world.index(bx, by, bz);
              if (world.data[idx] === BLOCK.AIR) world.data[idx] = leafType;
            }
          }
        }
        const tipY = canopyBase + (isBirch ? 3 : 4);
        if (tipY < height) world.data[world.index(x, tipY, z)] = leafType;
      }
    }
  }

  // ---- 7b. bamboo groves and mossy boulders -----------------------------
  for (let z = 4; z < sizeZ - 4; z += 1) {
    const rX = roadX(z);
    const vX = riverX(z);
    for (let x = 4; x < sizeX - 4; x += 1) {
      const dRoad = Math.abs(x - rX);
      const dRiver = Math.abs(x - vX);
      if (dRoad < 11 || dRiver < 10) continue;

      const h = surfaceY[z * sizeX + x];
      if (h <= 1 || h >= 33) continue;
      const surface = world.data[world.index(x, h, z)];

      const bambooPatch = noise2.fbm2(x * 0.055 + 55, z * 0.055 + 77, 2);
      if (surface === BLOCK.GRASS && bambooPatch > 0.3 && rand() < 0.075) {
        const stalks = 2 + Math.floor(rand() * 3);
        for (let s = 0; s < stalks; s += 1) {
          const bx = x + Math.round((rand() - 0.5) * 3);
          const bz = z + Math.round((rand() - 0.5) * 3);
          if (bx < 1 || bx >= sizeX - 1 || bz < 1 || bz >= sizeZ - 1) continue;
          const bh = surfaceY[bz * sizeX + bx];
          if (world.data[world.index(bx, bh, bz)] !== BLOCK.GRASS) continue;
          const stalkH = 5 + Math.floor(rand() * 5);
          for (let y = 1; y <= stalkH; y += 1) {
            const by = bh + y;
            if (by >= height) break;
            world.data[world.index(bx, by, bz)] = BLOCK.BAMBOO;
          }
          const top = Math.min(bh + stalkH + 1, height - 1);
          const leaves = [
            [0, 0, 0],
            [1, 0, -1],
            [-1, 0, -1],
            [0, 1, -1],
            [0, -1, -1],
          ];
          for (const [ox, oy, oz] of leaves) {
            const lx = bx + ox;
            const ly = top + oy;
            const lz = bz + oz;
            if (lx < 0 || lx >= sizeX || lz < 0 || lz >= sizeZ) continue;
            if (ly < 1 || ly >= height) continue;
            if (world.data[world.index(lx, ly, lz)] === BLOCK.AIR) {
              world.data[world.index(lx, ly, lz)] = BLOCK.BIRCH_LEAF;
            }
          }
        }
        continue;
      }

      if ((surface === BLOCK.GRASS || surface === BLOCK.GRAVEL) && rand() < 0.006) {
        const blob = 1 + Math.floor(rand() * 2);
        for (let dy = 0; dy <= blob; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            for (let dz = -1; dz <= 1; dz += 1) {
              if (Math.abs(dx) + Math.abs(dz) + dy > blob + 1) continue;
              const bx = x + dx;
              const by = h + 1 + dy;
              const bz = z + dz;
              if (bx < 0 || bx >= sizeX || bz < 0 || bz >= sizeZ || by >= height) continue;
              if (world.data[world.index(bx, by, bz)] === BLOCK.AIR) {
                world.data[world.index(bx, by, bz)] = BLOCK.MOSSY_STONE;
              }
            }
          }
        }
      }
    }
  }

  // ---- 8. gassho-zukuri houses ------------------------------------------
  const houseLights = [];
  for (const house of houses) {
    const { x: hx, z: hz, y: hy, w, d, side } = house;
    const x0 = hx - Math.floor(w / 2);
    const z0 = hz - Math.floor(d / 2);
    const x1 = x0 + w - 1;
    const z1 = z0 + d - 1;
    const wallTop = hy + 5;

    for (let z = z0; z <= z1; z += 1) {
      for (let x = x0; x <= x1; x += 1) {
        if (x < 0 || x >= sizeX || z < 0 || z >= sizeZ) continue;
        world.data[world.index(x, hy, z)] = BLOCK.STONE;
      }
    }

    for (let y = hy + 1; y <= wallTop; y += 1) {
      for (let z = z0; z <= z1; z += 1) {
        for (let x = x0; x <= x1; x += 1) {
          const perimeter = x === x0 || x === x1 || z === z0 || z === z1;
          if (!perimeter) {
            world.data[world.index(x, y, z)] = BLOCK.AIR;
            continue;
          }
          world.data[world.index(x, y, z)] = BLOCK.WOOD;
        }
      }
    }

    const doorX = side > 0 ? x0 : x1;
    const doorZ = Math.floor((z0 + z1) / 2);
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let y = hy + 1; y <= hy + 3; y += 1) {
        const z = doorZ + dz;
        if (z < 0 || z >= sizeZ) continue;
        world.data[world.index(doorX, y, z)] = BLOCK.AIR;
      }
    }

    for (const wz of [z0 + 3, z1 - 3]) {
      for (const wy of [hy + 2, hy + 3]) {
        if (world.data[world.index(x0, wy, wz)] === BLOCK.WOOD) {
          world.data[world.index(x0, wy, wz)] = BLOCK.SHOJI;
        }
        if (world.data[world.index(x1, wy, wz)] === BLOCK.WOOD) {
          world.data[world.index(x1, wy, wz)] = BLOCK.SHOJI;
        }
      }
    }

    const lampX = Math.floor((x0 + x1) / 2);
    const lampZ = Math.floor((z0 + z1) / 2);
    if (wallTop - 1 > hy + 1 && lampX > 0 && lampX < sizeX && lampZ > 0 && lampZ < sizeZ) {
      world.data[world.index(lampX, wallTop - 1, lampZ)] = BLOCK.SHOJI;
    }
    houseLights.push({ x: lampX + 0.5, y: hy + 3.4, z: lampZ + 0.5 });

    const rx0 = x0 - 1;
    const rx1 = x1 + 1;
    const rz0 = z0 - 1;
    const rz1 = z1 + 1;
    const roofLayers = Math.floor((rx1 - rx0 + 1) / 2) + 1;
    for (let ly = 0; ly < roofLayers; ly += 1) {
      const a = rx0 + ly;
      const b = rx1 - ly;
      if (a > b) break;
      const y = wallTop + 1 + ly;
      if (y >= height) break;
      for (let z = rz0; z <= rz1; z += 1) {
        for (let x = a; x <= b; x += 1) {
          if (x < 0 || x >= sizeX || z < 0 || z >= sizeZ) continue;
          world.data[world.index(x, y, z)] = BLOCK.THATCH;
        }
      }
    }

    for (let z = rz0; z <= rz1; z += 1) {
      for (let x = rx0; x <= rx1; x += 1) {
        if (x < 0 || x >= sizeX || z < 0 || z >= sizeZ) continue;
        const y = wallTop;
        if (world.data[world.index(x, y, z)] === BLOCK.AIR) {
          world.data[world.index(x, y, z)] = BLOCK.THATCH;
        }
      }
    }
  }

  // ---- 8b. cobblestone paths from farmhouses to the road ---------------
  for (const house of houses) {
    const targetX = roadX(house.z);
    const startX = house.x + (house.side > 0 ? -Math.floor(house.w / 2) : Math.floor(house.w / 2));
    const steps = Math.ceil(Math.abs(targetX - startX)) + 1;
    for (let s = 0; s <= steps; s += 1) {
      const t = s / steps;
      const px = Math.round(startX + (targetX - startX) * t);
      const pz = house.z + Math.round(Math.sin(t * Math.PI) * 1.5 * (house.side > 0 ? -1 : 1));
      if (px < 0 || px >= sizeX || pz < 0 || pz >= sizeZ) continue;
      const h = surfaceY[pz * sizeX + px];
      if (h <= 1 || h >= height - 2) continue;
      const id = world.data[world.index(px, h, pz)];
      if (id === BLOCK.GRASS || id === BLOCK.GRAVEL) {
        world.data[world.index(px, h, pz)] = BLOCK.COBBLE;
      }
    }
  }

  // ---- 9. stone lanterns (toro) -----------------------------------------
  const lanterns = [];
  for (let z = 16; z < sizeZ - 16; z += 22) {
    const jitter = Math.round((rand() - 0.5) * 8);
    const lz = clamp(z + jitter, 8, sizeZ - 8);
    const side = rand() > 0.5 ? 1 : -1;
    const lx = clamp(Math.round(roadX(lz) + side * 5.5), 2, sizeX - 2);
    const h = surfaceY[lz * sizeX + clamp(lx, 0, sizeX - 1)];
    if (h <= 1 || h >= 40) continue;

    world.data[world.index(lx, h + 1, lz)] = BLOCK.STONE;
    world.data[world.index(lx, h + 2, lz)] = BLOCK.LANTERN;
    if (h + 3 < height) world.data[world.index(lx, h + 3, lz)] = BLOCK.THATCH;
    lanterns.push({ x: lx, y: h + 3, z: lz });
  }

  const spawnZ = 26;
  const spawnX = Math.round(roadX(spawnZ));
  const spawnY = Math.round(roadH[clamp(spawnZ, 0, sizeZ - 1)]) + 2;

  return {
    seed,
    roadX,
    riverX,
    roadH,
    crossings,
    bridges,
    houses,
    lanterns,
    houseLights,
    spawn: { x: spawnX + 0.5, y: spawnY, z: spawnZ + 0.5 },
  };
}
