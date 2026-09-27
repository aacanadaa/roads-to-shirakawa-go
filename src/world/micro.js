import * as THREE from 'three';
import { BLOCK, blockDef, isOpaqueId, isGlowId, isFoliageId } from './blocks.js';
import { hash3 } from '../utils.js';
import { sharedMaterials } from './Chunk.js';

// ---------------------------------------------------------------------------
// Micro-voxel decorator: builds high-fidelity structures (houses, stone
// lanterns, bridges, props, tree detail) out of 0.25 m mini-cubes that reuse
// the same shader-pack voxel materials (triplanar detail, wind, AO shading).
// The 1 m block grid stays authoritative for collision and editing; micro
// meshes are a static decor overlay merged into two draw calls (opaque+glow).
// ---------------------------------------------------------------------------

export const MICRO_U = 0.25;
const PER_BLOCK = 4;

const COLOR = new THREE.Color();

// Per-face base shade, same language as the chunk mesher.
const FACES = [
  { dir: [-1, 0, 0], shade: 0.62, corners: [[0, 1, 0], [0, 0, 0], [0, 1, 1], [0, 0, 1]] },
  { dir: [1, 0, 0], shade: 0.8, corners: [[1, 1, 1], [1, 0, 1], [1, 1, 0], [1, 0, 0]] },
  { dir: [0, -1, 0], shade: 0.5, corners: [[1, 0, 1], [0, 0, 1], [1, 0, 0], [0, 0, 0]] },
  { dir: [0, 1, 0], shade: 1.0, corners: [[0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 0]] },
  { dir: [0, 0, -1], shade: 0.58, corners: [[1, 0, 0], [0, 0, 0], [1, 1, 0], [0, 1, 0]] },
  { dir: [0, 0, 1], shade: 0.72, corners: [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]] },
];

function gridKey(gx, gy, gz) {
  return gx + ',' + gy + ',' + gz;
}

class MicroBuilder {
  constructor(world) {
    this.world = world;
    this.cells = new Map(); // opaque / foliage minis
    this.glowCells = new Map(); // emissive minis (bloom picks these up)
  }

  get size() {
    return this.cells.size + this.glowCells.size;
  }

  has(gx, gy, gz) {
    const k = gridKey(gx, gy, gz);
    return this.cells.has(k) || this.glowCells.has(k);
  }

  // Place one mini-cube by grid coords. Skips minis embedded inside solid
  // 1 m blocks so decor never wastes hidden geometry (unless forced).
  set(gx, gy, gz, id, force = false) {
    gx = Math.round(gx);
    gy = Math.round(gy);
    gz = Math.round(gz);
    if (!force) {
      const cx = (gx + 0.5) * MICRO_U;
      const cy = (gy + 0.5) * MICRO_U;
      const cz = (gz + 0.5) * MICRO_U;
      const bid = this.world.getBlock(Math.floor(cx), Math.floor(cy), Math.floor(cz));
      if (isOpaqueId(bid)) return false;
    }
    const target = isGlowId(id) ? this.glowCells : this.cells;
    target.set(gridKey(gx, gy, gz), id);
    return true;
  }

  // Filled mini-box, inclusive grid ranges. skipChance dithers edges.
  box(gx0, gy0, gz0, gx1, gy1, gz1, id, skipChance = 0, salt = 0) {
    const lox = Math.min(gx0, gx1);
    const hix = Math.max(gx0, gx1);
    const loy = Math.min(gy0, gy1);
    const hiy = Math.max(gy0, gy1);
    const loz = Math.min(gz0, gz1);
    const hiz = Math.max(gz0, gz1);
    for (let gy = loy; gy <= hiy; gy += 1) {
      for (let gz = loz; gz <= hiz; gz += 1) {
        for (let gx = lox; gx <= hix; gx += 1) {
          if (skipChance > 0 && hash3(gx + salt, gy * 2 + salt, gz - salt) < skipChance) continue;
          this.set(gx, gy, gz, id);
        }
      }
    }
  }

  // Hollow shell box (walls only, no top/bottom unless capped).
  shell(gx0, gy0, gz0, gx1, gy1, gz1, id, holes = null) {
    for (let gy = gy0; gy <= gy1; gy += 1) {
      for (let gz = gz0; gz <= gz1; gz += 1) {
        for (let gx = gx0; gx <= gx1; gx += 1) {
          const onShell =
            gx === gx0 || gx === gx1 || gz === gz0 || gz === gz1;
          if (!onShell) continue;
          if (holes && holes.has(gridKey(gx, gy, gz))) continue;
          this.set(gx, gy, gz, id);
        }
      }
    }
  }
}

// Find the first open air cell scanning down (for ground-following props).
function findGround(world, x, z, yStart) {
  for (let y = Math.min(yStart, world.height - 1); y > 1; y -= 1) {
    if (isOpaqueId(world.getBlock(x, y, z))) return y + 1;
  }
  return 1;
}

// ---------------------------------------------------------------------------
// Gassho-zukuri farmhouse in mini-cubes: stone foundation skirt, timber frame
// (corner posts, beams, studs), shoji lattice windows, grand entry with
// hanging lantern, steep stepped thatch roof with gables + ridge, wood pile.
// ---------------------------------------------------------------------------
function buildHouseMicro(mb, house) {
  const { x: hx, z: hz, y: hy } = house;
  const w = house.w;
  const d = house.d;
  const x0 = hx - Math.floor(w / 2);
  const x1 = x0 + w - 1;
  const z0 = hz - Math.floor(d / 2);
  const z1 = z0 + d - 1;
  const wallTop = hy + 5;
  const gyBase = hy * PER_BLOCK;
  const gyTop = (wallTop + 1) * PER_BLOCK; // top surface of wall-top blocks

  const wx0 = x0 * PER_BLOCK; // west outer face plane
  const wx1 = (x1 + 1) * PER_BLOCK; // east outer face plane
  const wz0 = z0 * PER_BLOCK;
  const wz1 = (z1 + 1) * PER_BLOCK;

  // -- stone foundation skirt (proud of the walls, jittered) --
  const skirt = (gx, gz, dx, dz) => {
    for (let k = 0; k < 3; k += 1) {
      if (hash3(gx + dz * 91, k * 7, gz + dx * 57) < 0.22) continue;
      mb.set(gx + dx, gyBase + k, gz + dz, BLOCK.STONE_BRICK);
    }
  };
  for (let bx = x0; bx <= x1; bx += 1) {
    for (let q = 0; q < PER_BLOCK; q += 1) {
      skirt(bx * PER_BLOCK + q, wz0 - 1, 0, 0);
      skirt(bx * PER_BLOCK + q, wz1, 0, 0);
    }
  }
  for (let bz = z0; bz <= z1; bz += 1) {
    for (let q = 0; q < PER_BLOCK; q += 1) {
      skirt(wx0 - 1, bz * PER_BLOCK + q, 0, 0);
      skirt(wx1, bz * PER_BLOCK + q, 0, 0);
    }
  }

  // -- corner posts: stout timber columns capping each corner --
  const corners = [
    [wx0 - 1, wz0 - 1],
    [wx1, wz0 - 1],
    [wx0 - 1, wz1],
    [wx1, wz1],
  ];
  for (const [px, pz] of corners) {
    mb.box(px, gyBase, pz, px, gyTop - 1, pz, BLOCK.TRUNK);
    mb.box(px, gyTop, pz, px, gyTop + 1, pz, BLOCK.WOOD); // post cap
  }

  // -- horizontal beams: top + mid rails wrapping all four walls --
  const beamRun = (gx0, gz0, gx1, gz1, gy) => {
    mb.box(gx0, gy, gz0, gx1, gy + 1, gz1, BLOCK.WOOD);
  };
  const gyBeamTop = gyTop - 2;
  const gyBeamMid = (hy + 3) * PER_BLOCK - 1;
  beamRun(wx0 - 1, wz0 - 1, wx1, wz0 - 1, gyBeamTop);
  beamRun(wx0 - 1, wz1, wx1, wz1, gyBeamTop);
  beamRun(wx0 - 1, wz0 - 1, wx0 - 1, wz1, gyBeamTop);
  beamRun(wx1, wz0 - 1, wx1, wz1, gyBeamTop);
  beamRun(wx0 - 1, wz0 - 1, wx1, wz0 - 1, gyBeamMid);
  beamRun(wx0 - 1, wz1, wx1, wz1, gyBeamMid);
  beamRun(wx0 - 1, wz0 - 1, wx0 - 1, wz1, gyBeamMid);
  beamRun(wx1, wz0 - 1, wx1, wz1, gyBeamMid);

  // -- wall studs every ~2 blocks --
  for (let gz = wz0 + 7; gz < wz1 - 4; gz += 8) {
    mb.box(wx0 - 1, gyBase + 3, gz, wx0 - 1, gyBeamTop - 1, gz, BLOCK.TRUNK);
    mb.box(wx1, gyBase + 3, gz, wx1, gyBeamTop - 1, gz, BLOCK.TRUNK);
  }
  for (let gx = wx0 + 7; gx < wx1 - 4; gx += 8) {
    mb.box(gx, gyBase + 3, wz0 - 1, gx, gyBeamTop - 1, wz0 - 1, BLOCK.TRUNK);
    mb.box(gx, gyBase + 3, wz1, gx, gyBeamTop - 1, wz1, BLOCK.TRUNK);
  }

  // -- shoji lattice over the glowing window blocks (both x walls) --
  for (const wz of [z0 + 3, z1 - 3]) {
    for (const [wallGx, out] of [[wx0 - 1, -1], [wx1, 1]]) {
      const gzA = wz * PER_BLOCK;
      const gzB = gzA + PER_BLOCK - 1;
      const gyA = (hy + 2) * PER_BLOCK;
      const gyB = (hy + 4) * PER_BLOCK - 1;
      const fx = out > 0 ? wallGx + 1 : wallGx - 1;
      // frame border
      for (let gz = gzA - 1; gz <= gzB + 1; gz += 1) {
        mb.set(fx, gyA - 1, gz, BLOCK.TRUNK);
        mb.set(fx, gyB + 1, gz, BLOCK.TRUNK);
      }
      for (let gy = gyA - 1; gy <= gyB + 1; gy += 1) {
        mb.set(fx, gy, gzA - 1, BLOCK.TRUNK);
        mb.set(fx, gy, gzB + 1, BLOCK.TRUNK);
      }
      // lattice cross bars
      for (let gy = gyA; gy <= gyB; gy += 1) mb.set(fx, gy, (gzA + gzB) >> 1, BLOCK.WOOD);
      for (let gz = gzA; gz <= gzB; gz += 1) {
        mb.set(fx, gyA + 2, gz, BLOCK.WOOD);
        mb.set(fx, gyB - 2, gz, BLOCK.WOOD);
      }
    }
  }

  // -- grand entry: posts, lintel, stone step, hanging lantern --
  const doorX = house.side > 0 ? x0 : x1;
  const doorZ = Math.floor((z0 + z1) / 2);
  const outDx = house.side > 0 ? -1 : 1;
  const doorGx = outDx > 0 ? wx1 : wx0 - 1;
  const gzC0 = (doorZ - 1) * PER_BLOCK - 1;
  const gzC1 = (doorZ + 2) * PER_BLOCK;
  const gyLintel = (hy + 4) * PER_BLOCK;
  mb.box(doorGx, gyBase, gzC0, doorGx, gyLintel + 1, gzC0, BLOCK.TRUNK);
  mb.box(doorGx, gyBase, gzC1, doorGx, gyLintel + 1, gzC1, BLOCK.TRUNK);
  mb.box(doorGx - (outDx > 0 ? 0 : 1), gyLintel, gzC0, doorGx + (outDx > 0 ? 1 : 0), gyLintel + 2, gzC1, BLOCK.PLANKS);
  // stone step
  const stepGx = doorGx + outDx;
  mb.box(
    Math.min(stepGx, stepGx + outDx * 2), gyBase - 2,
    (doorZ - 1) * PER_BLOCK, Math.max(stepGx, stepGx + outDx * 2), gyBase - 1,
    (doorZ + 2) * PER_BLOCK - 1, BLOCK.STONE_BRICK
  );
  // hanging lantern under the lintel
  const lampGx = doorGx + outDx;
  const lampGz = ((gzC0 + gzC1) / 2) | 0;
  mb.set(lampGx, gyLintel - 1, lampGz, BLOCK.TRUNK);
  mb.box(lampGx, gyLintel - 4, lampGz, lampGx, gyLintel - 2, lampGz, BLOCK.LANTERN);

  // -- steep stepped thatch roof (45°, ridge along z) + gables + ridge cap --
  const e = house.eave;
  const ex0 = e.rx0 * PER_BLOCK - 2;
  const ex1 = (e.rx1 + 1) * PER_BLOCK + 1;
  const ez0 = e.rz0 * PER_BLOCK - 2;
  const ez1 = (e.rz1 + 1) * PER_BLOCK + 1;
  const y0 = (e.wallTop + 1) * PER_BLOCK;
  const halfW = Math.floor((ex1 - ex0 + 1) / 2);
  const cx = Math.floor((ex0 + ex1) / 2);
  const levels = Math.floor(halfW / 2);
  // dark plank liner under the first eave course (seen from below)
  for (let gx = ex0; gx <= ex1; gx += 1) {
    mb.set(gx, y0 - 1, ez0, BLOCK.PLANKS);
    mb.set(gx, y0 - 1, ez1, BLOCK.PLANKS);
  }
  for (let gz = ez0; gz <= ez1; gz += 1) {
    mb.set(ex0, y0 - 1, gz, BLOCK.PLANKS);
    mb.set(ex1, y0 - 1, gz, BLOCK.PLANKS);
  }
  for (let L = 0; L < levels; L += 1) {
    const ax = ex0 + L * 2;
    const bx = ex1 - L * 2;
    if (ax > bx) break;
    const yy = y0 + L * 2;
    for (let gx = ax; gx <= bx; gx += 1) {
      mb.set(gx, yy, ez0, BLOCK.THATCH, hash3(gx, L, 7) < 0.08);
      mb.set(gx, yy, ez1, BLOCK.THATCH, hash3(gx, L, 13) < 0.08);
      if (hash3(gx * 3, L, 29) >= 0.06) {
        mb.set(gx, yy, ez0 + 1, BLOCK.THATCH);
        mb.set(gx, yy, ez1 - 1, BLOCK.THATCH);
      }
    }
    for (let gz = ez0; gz <= ez1; gz += 1) {
      mb.set(ax, yy, gz, BLOCK.THATCH, hash3(L, gz, 3) < 0.08);
      mb.set(bx, yy, gz, BLOCK.THATCH, hash3(L, gz, 5) < 0.08);
    }
  }
  const yTop = y0 + (levels - 1) * 2;
  // ridge cap along z
  for (let gz = ez0; gz <= ez1; gz += 1) {
    mb.set(cx - 1, yTop, gz, BLOCK.THATCH);
    mb.set(cx, yTop, gz, BLOCK.THATCH);
    mb.set(cx - 1, yTop + 1, gz, BLOCK.THATCH);
    mb.set(cx, yTop + 1, gz, BLOCK.THATCH);
    if ((gz & 1) === 0) {
      mb.set(cx - 1, yTop + 2, gz, BLOCK.THATCH);
      mb.set(cx, yTop + 2, gz, BLOCK.THATCH);
    }
  }
  // gable triangles at both z ends
  for (const gzWall of [ez0 + 1, ez1 - 1]) {
    for (let gx = ex0; gx <= ex1; gx += 1) {
      const surf = y0 + (halfW - Math.abs(gx - cx));
      for (let gy = y0; gy < surf; gy += 1) {
        if (hash3(gx, gy, gzWall) < 0.04) continue;
        mb.set(gx, gy, gzWall, BLOCK.THATCH);
      }
    }
  }

  // -- firewood stack beside the house --
  const pileX = (x1 + 3) * PER_BLOCK;
  const pileZ = (z1 - 1) * PER_BLOCK;
  const pileG = findGround(mb.world, x1 + 3, z1 - 1, hy + 2) * PER_BLOCK;
  mb.box(pileX, pileG, pileZ, pileX + 9, pileG + 1, pileZ + 2, BLOCK.TRUNK);
  mb.box(pileX + 1, pileG + 2, pileZ, pileX + 8, pileG + 3, pileZ + 2, BLOCK.TRUNK);
  mb.box(pileX + 2, pileG + 4, pileZ, pileX + 7, pileG + 4, pileZ + 2, BLOCK.TRUNK);
  mb.box(pileX - 1, pileG + 5, pileZ - 1, pileX + 10, pileG + 5, pileZ + 3, BLOCK.PLANKS, 0.15);
}

// ---------------------------------------------------------------------------
// Stone toro lantern in mini-cubes: platform, pedestal, firebox with glowing
// window openings, stepped pyramid roof, jewel tip.
// ---------------------------------------------------------------------------
function buildLanternMicro(mb, lantern) {
  const bx = Math.floor(lantern.x);
  const bz = Math.floor(lantern.z);
  const ground = findGround(mb.world, bx, bz, lantern.y + 2);
  const y0 = ground * PER_BLOCK;
  const cx = bx * PER_BLOCK + 1; // centre-ish (2-wide centre)
  const cz = bz * PER_BLOCK + 1;

  mb.box(cx - 3, y0, cz - 3, cx + 4, y0, cz + 4, BLOCK.STONE_BRICK, 0.08); // platform
  mb.box(cx - 1, y0 + 1, cz - 1, cx + 2, y0 + 5, cz + 2, BLOCK.STONE_BRICK); // pedestal
  mb.box(cx - 2, y0 + 5, cz - 2, cx + 3, y0 + 5, cz + 3, BLOCK.STONE_BRICK); // firebox floor
  // firebox shell with a 2x2 window hole on each face + glow core
  const holes = new Set();
  // window holes: middle 2 rows of the 4-tall firebox walls
  for (let k = 0; k < 2; k += 1) {
    holes.add(gridKey(cx, y0 + 7 + k, cz - 2));
    holes.add(gridKey(cx + 1, y0 + 7 + k, cz - 2));
    holes.add(gridKey(cx, y0 + 7 + k, cz + 3));
    holes.add(gridKey(cx + 1, y0 + 7 + k, cz + 3));
    holes.add(gridKey(cx - 2, y0 + 7 + k, cz));
    holes.add(gridKey(cx - 2, y0 + 7 + k, cz + 1));
    holes.add(gridKey(cx + 3, y0 + 7 + k, cz));
    holes.add(gridKey(cx + 3, y0 + 7 + k, cz + 1));
  }
  mb.shell(cx - 2, y0 + 6, cz - 2, cx + 3, y0 + 9, cz + 3, BLOCK.STONE_BRICK, holes);
  mb.box(cx, y0 + 6, cz, cx + 1, y0 + 8, cz + 1, BLOCK.LANTERN); // glow core
  // stepped pyramid roof + jewel
  mb.box(cx - 3, y0 + 10, cz - 3, cx + 4, y0 + 10, cz + 4, BLOCK.STONE_BRICK);
  mb.box(cx - 2, y0 + 11, cz - 2, cx + 3, y0 + 11, cz + 3, BLOCK.STONE_BRICK);
  mb.box(cx - 1, y0 + 12, cz - 1, cx + 2, y0 + 12, cz + 2, BLOCK.STONE_BRICK);
  mb.box(cx, y0 + 13, cz, cx + 1, y0 + 13, cz + 1, BLOCK.STONE_BRICK);
}

// ---------------------------------------------------------------------------
// Bridge dressing: rail posts + double rails, support pile clusters below.
// (Block railings were removed from the generator; micro owns the rails.)
// ---------------------------------------------------------------------------
function buildBridgeMicro(mb, bridge, meta) {
  const vx = bridge.x;
  const z0 = bridge.z;
  const deckTop = (bridge.y + 1) * PER_BLOCK;
  for (let dz = -7; dz <= 7; dz += 2) {
    for (const side of [-5, 5]) {
      const px = Math.round((vx + side) * PER_BLOCK);
      const pz = (z0 + dz) * PER_BLOCK;
      const gy = findGround(mb.world, Math.round(vx + side), z0 + dz, bridge.y + 3) * PER_BLOCK;
      const top = Math.max(deckTop, gy);
      mb.box(px, top, pz, px, top + 4, pz, BLOCK.TRUNK); // post
      if (dz === -7 || dz === 7) mb.set(px, top + 5, pz, BLOCK.LANTERN); // post lanterns
    }
  }
  // double rails spanning the crossing
  for (const side of [-5, 5]) {
    const px = Math.round((vx + side) * PER_BLOCK);
    for (let dz = -7; dz <= 7; dz += 1) {
      const pz = (z0 + dz) * PER_BLOCK;
      for (let q = 0; q < PER_BLOCK; q += 1) {
        mb.set(px, deckTop + 4, pz + q, BLOCK.WOOD);
        mb.set(px, deckTop + 2, pz + q, BLOCK.WOOD);
      }
    }
  }
  // support piles under the deck
  for (const [ox, oz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) {
    const px = Math.round((vx + ox) * PER_BLOCK);
    const pz = (z0 + oz) * PER_BLOCK;
    for (let k = 0; k < 10; k += 1) {
      mb.set(px, deckTop - 8 - k, pz, BLOCK.TRUNK);
      mb.set(px + 1, deckTop - 8 - k, pz, BLOCK.TRUNK);
    }
  }
  void meta;
}

// ---------------------------------------------------------------------------
// Roadside props: paddy fences, crates + barrels by the door, spawn signpost.
// ---------------------------------------------------------------------------
function buildPropsMicro(mb, meta) {
  for (const house of meta.houses) {
    // paddock fence around the rice paddy
    const xA = house.x - house.w;
    const xB = house.x + house.w;
    const zA = house.z + house.d + 2;
    const zB = zA + 5;
    const fenceLine = (ax, az, bx, bz) => {
      const steps = Math.max(Math.abs(bx - ax), Math.abs(bz - az));
      const dx = steps === 0 ? 0 : (bx - ax) / steps;
      const dz = steps === 0 ? 0 : (bz - az) / steps;
      const alongX = Math.abs(bx - ax) >= Math.abs(bz - az);
      let prevRail = null;
      for (let s = 0; s <= steps; s += 1) {
        const fx = Math.round(ax + dx * s);
        const fz = Math.round(az + dz * s);
        const gy = findGround(mb.world, fx, fz, house.y + 3) * PER_BLOCK;
        const px = fx * PER_BLOCK;
        const pz = fz * PER_BLOCK;
        if (s % 2 === 0) mb.box(px, gy, pz, px, gy + 4, pz, BLOCK.TRUNK);
        // continuous stepped rails: span this block's 4 minis, stitch to prev
        for (let q = 0; q < PER_BLOCK; q += 1) {
          const qx = alongX ? px + (dx >= 0 ? q : -q) : px;
          const qz = alongX ? pz : pz + (dz >= 0 ? q : -q);
          mb.set(qx, gy + 4, qz, BLOCK.WOOD);
          mb.set(qx, gy + 2, qz, BLOCK.WOOD);
        }
        if (prevRail && Math.abs(gy - prevRail) <= 2) {
          // stitch height steps between segments
          const yA = Math.min(gy, prevRail);
          const yB = Math.max(gy, prevRail);
          for (let yy = yA + 2; yy <= yB + 4; yy += 1) {
            mb.set(px, yy, pz, BLOCK.WOOD);
          }
        }
        prevRail = gy;
      }
    };
    fenceLine(xA, zA, xB, zA);
    fenceLine(xA, zB, xB, zB);
    fenceLine(xA, zA, xA, zB);
    fenceLine(xB, zA, xB, zB);

    // crates + barrel by the entry
    const doorX = house.side > 0 ? house.x - Math.floor(house.w / 2) - 2 : house.x + Math.floor(house.w / 2) + 1;
    const doorZ = house.z;
    const gy = findGround(mb.world, doorX, doorZ + 2, house.y + 3) * PER_BLOCK;
    const cgx = doorX * PER_BLOCK;
    const cgz = (doorZ + 2) * PER_BLOCK;
    mb.box(cgx, gy, cgz, cgx + 3, gy + 3, cgz + 3, BLOCK.PLANKS); // crate
    mb.box(cgx, gy + 4, cgz, cgx + 2, gy + 6, cgz + 2, BLOCK.PLANKS, 0.1); // small crate on top
    for (const [ox, oz] of [[0, 0], [3, 0], [0, 3], [3, 3]]) {
      mb.set(cgx + ox, gy + 1, cgz + oz, BLOCK.TRUNK, true);
      mb.set(cgx + ox, gy + 2, cgz + oz, BLOCK.TRUNK, true);
    }
    // barrel: stacked rings with dark bands
    const bgx = cgx + 6;
    for (let k = 0; k < 5; k += 1) {
      const r = k === 0 || k === 4 ? 2 : 3;
      const id = k === 1 || k === 3 ? BLOCK.TRUNK : BLOCK.WOOD;
      mb.box(bgx - r + 1, gy + k, cgz - r + 1, bgx + r - 2, gy + k, cgz + r - 2, id);
    }
    mb.box(bgx - 2, gy + 5, cgz - 2, bgx + 1, gy + 5, cgz + 1, BLOCK.PLANKS);
  }

  // spawn signpost: Way of the White Heron
  const sx = Math.floor(meta.spawn.x);
  const sz = Math.floor(meta.spawn.z);
  const sy = findGround(mb.world, sx + 2, sz + 1, Math.floor(meta.spawn.y) + 3) * PER_BLOCK;
  const px = (sx + 2) * PER_BLOCK;
  const pz = (sz + 1) * PER_BLOCK;
  mb.box(px, sy, pz, px, sy + 9, pz, BLOCK.TRUNK);
  mb.box(px - 4, sy + 6, pz, px + 3, sy + 9, pz, BLOCK.PLANKS);
  mb.box(px - 4, sy + 5, pz, px + 3, sy + 5, pz, BLOCK.TRUNK);
  mb.box(px - 5, sy + 10, pz - 1, px + 4, sy + 10, pz + 1, BLOCK.THATCH);
}

// ---------------------------------------------------------------------------
// Tree dressing: branch limbs from upper trunks + dithered leaf fringe on
// canopy surfaces, so canopies read as dense clusters instead of solid blobs.
// ---------------------------------------------------------------------------
function buildTreeMicro(mb, world, budget = 16000) {
  const { sizeX, sizeZ, height } = world;
  const leafFor = (id) => id;
  let placed = 0;
  const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]];

  for (let z = 2; z < sizeZ - 2 && placed < budget; z += 1) {
    for (let x = 2; x < sizeX - 2 && placed < budget; x += 1) {
      for (let y = 3; y < height - 1; y += 1) {
        const id = world.data[world.index(x, y, z)];
        const isLeaf = id === BLOCK.PINE || id === BLOCK.MAPLE || id === BLOCK.BIRCH_LEAF;
        const isTrunk = id === BLOCK.TRUNK || id === BLOCK.BIRCH || id === BLOCK.BAMBOO;
        if (!isLeaf && !isTrunk) continue;

        if (isLeaf) {
          // dithered fringe: sprout a mini leaf into a neighbouring air cell
          for (const [dx, dy, dz] of DIRS) {
            if (placed >= budget) break;
            const nid = world.getBlock(x + dx, y + dy, z + dz);
            if (nid !== BLOCK.AIR) continue;
            const r = hash3(x * 5 + dx * 13, y * 3 + 7, z * 5 + dz * 11);
            if (r > 0.3) continue;
            const gx = Math.round(((x + 0.5) + dx * 0.75) / MICRO_U);
            const gy = Math.round(((y + 0.5) + dy * 0.75) / MICRO_U);
            const gz = Math.round(((z + 0.5) + dz * 0.75) / MICRO_U);
            if (mb.set(gx, gy, gz, leafFor(id))) placed += 1;
          }
        } else if (id !== BLOCK.BAMBOO && y > 6) {
          // branch limb from upper trunks
          const r = hash3(x * 11 + 5, y * 7, z * 11 + 3);
          if (r > 0.1) continue;
          const dx = hash3(x, y, z) > 0.5 ? 1 : -1;
          const dz = hash3(z, x, y + 40) > 0.5 ? 1 : -1;
          const tx = x * PER_BLOCK + (dx > 0 ? PER_BLOCK : -1);
          const ty = y * PER_BLOCK + 1;
          const tz = z * PER_BLOCK + (dz > 0 ? PER_BLOCK : -1);
          let ok = true;
          for (let k = 0; k < 3; k += 1) {
            if (!mb.set(tx + dx * k * 2, ty + k, tz + dz * k * 2, id)) {
              ok = false;
              break;
            }
            placed += 1;
          }
          if (!ok || placed >= budget) continue;
          // leaf tuft at the limb tip: borrow a nearby canopy block type
          let tipId = BLOCK.PINE;
          outer: for (let oy = -2; oy <= 2; oy += 1) {
            for (let ox = -2; ox <= 2; ox += 1) {
              for (let oz = -2; oz <= 2; oz += 1) {
                const lid = world.getBlock(x + dx * 2 + ox, y + 2 + oy, z + dz * 2 + oz);
                if (lid === BLOCK.PINE || lid === BLOCK.MAPLE || lid === BLOCK.BIRCH_LEAF) {
                  tipId = lid;
                  break outer;
                }
              }
            }
          }
          const ex = tx + dx * 6;
          const ey = ty + 3;
          const ez = tz + dz * 6;
          for (let k = 0; k < 4 && placed < budget; k += 1) {
            if (mb.set(ex + (k % 2), ey + ((k / 2) | 0), ez + (k === 3 ? 1 : 0), tipId)) placed += 1;
          }
        }
      }
    }
  }
  return placed;
}

// ---------------------------------------------------------------------------
// Emit merged geometry from the mini grids into the shared voxel materials.
// ---------------------------------------------------------------------------
function emitMesh(cellsMap, material, opts) {
  const positions = [];
  const normals = [];
  const colors = [];
  const blockIds = [];
  const wind = [];
  const foam = [];
  const indices = [];
  const lookup = (gx, gy, gz) => cellsMap.has(gridKey(gx, gy, gz));

  for (const [key, id] of cellsMap) {
    const [gx, gy, gz] = key.split(',').map(Number);
    const def = blockDef(id);
    COLOR.setHex(def.color);
    const jitter = 0.88 + hash3(gx, gy * 3, gz) * 0.24;
    const foliage = isFoliageId(id);

    for (let f = 0; f < 6; f += 1) {
      const face = FACES[f];
      if (lookup(gx + face.dir[0], gy + face.dir[1], gz + face.dir[2])) continue;
      const base = positions.length / 3;
      for (let v = 0; v < 4; v += 1) {
        const c = face.corners[v];
        positions.push((gx + c[0]) * MICRO_U, (gy + c[1]) * MICRO_U, (gz + c[2]) * MICRO_U);
        normals.push(face.dir[0], face.dir[1], face.dir[2]);
        const m = face.shade * jitter;
        colors.push(COLOR.r * m, COLOR.g * m, COLOR.b * m);
        blockIds.push(id);
        wind.push(foliage ? 1 : 0);
        foam.push(0);
      }
      indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    }
  }

  if (indices.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute('aBlockId', new THREE.Float32BufferAttribute(blockIds, 1));
  geo.setAttribute('aWind', new THREE.Float32BufferAttribute(wind, 1));
  geo.setAttribute('aFoam', new THREE.Float32BufferAttribute(foam, 1));
  geo.setIndex(indices);
  geo.computeBoundingSphere();

  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = opts.castShadow;
  mesh.receiveShadow = true;
  mesh.matrixAutoUpdate = false;
  mesh.name = opts.name;
  return mesh;
}

export function decorateMicroWorld(world, meta, scene) {
  const mb = new MicroBuilder(world);

  for (const house of meta.houses) buildHouseMicro(mb, house);
  for (const lantern of meta.lanterns || []) buildLanternMicro(mb, lantern);
  for (const bridge of meta.bridges || []) buildBridgeMicro(mb, bridge, meta);
  buildPropsMicro(mb, meta);
  const fringe = buildTreeMicro(mb, world);

  const opaqueMesh = emitMesh(mb.cells, sharedMaterials.opaque, {
    castShadow: true,
    name: 'micro-opaque',
  });
  const glowMesh = emitMesh(mb.glowCells, sharedMaterials.glow, {
    castShadow: false,
    name: 'micro-glow',
  });

  let faces = 0;
  if (opaqueMesh) {
    scene.add(opaqueMesh);
    faces += opaqueMesh.geometry.index.count / 3;
  }
  if (glowMesh) {
    glowMesh.renderOrder = 8;
    scene.add(glowMesh);
    faces += glowMesh.geometry.index.count / 3;
  }

  return { minis: mb.size, fringe, faces };
}
