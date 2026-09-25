export const BLOCK = Object.freeze({
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  GRAVEL: 4,
  ROAD: 5,
  WOOD: 6,
  THATCH: 7,
  PINE: 8,
  MAPLE: 9,
  WATER: 10,
  SNOW: 11,
  LANTERN: 12,
  SAND: 13,
  TRUNK: 14,
  BEDROCK: 15,
});

export const BLOCK_DEFS = Object.freeze([
  { id: 0, name: 'Air', color: 0x000000, solid: false, liquid: false },
  { id: 1, name: 'Rice Grass', color: 0x5c8a3c, solid: true, liquid: false },
  { id: 2, name: 'Earth', color: 0x6e5138, solid: true, liquid: false },
  { id: 3, name: 'Mountain Stone', color: 0x7d8388, solid: true, liquid: false },
  { id: 4, name: 'River Gravel', color: 0xa29684, solid: true, liquid: false },
  { id: 5, name: 'Road Asphalt', color: 0x41474d, solid: true, liquid: false },
  { id: 6, name: 'Cedar Wood', color: 0x9a6b42, solid: true, liquid: false },
  { id: 7, name: 'Thatched Roof', color: 0xcfa85e, solid: true, liquid: false },
  { id: 8, name: 'Pine Foliage', color: 0x2f6b3f, solid: true, liquid: false },
  { id: 9, name: 'Autumn Maple', color: 0xc2552e, solid: true, liquid: false },
  { id: 10, name: 'Mountain Water', color: 0x3f86b5, solid: false, liquid: true },
  { id: 11, name: 'Snow Cap', color: 0xe9f0f5, solid: true, liquid: false },
  { id: 12, name: 'Stone Lantern', color: 0xd8c9a0, solid: true, liquid: false },
  { id: 13, name: 'River Sand', color: 0xcbb68c, solid: true, liquid: false },
  { id: 14, name: 'Cedar Trunk', color: 0x5d4326, solid: true, liquid: false },
  { id: 15, name: 'Bedrock', color: 0x4a4f54, solid: true, liquid: false },
]);

export const HOTBAR = Object.freeze([
  BLOCK.GRASS,
  BLOCK.WOOD,
  BLOCK.THATCH,
  BLOCK.STONE,
  BLOCK.PINE,
  BLOCK.MAPLE,
  BLOCK.ROAD,
  BLOCK.WATER,
]);

export function blockDef(id) {
  return BLOCK_DEFS[id] ?? BLOCK_DEFS[0];
}

export function isSolidId(id) {
  return id !== BLOCK.AIR && id !== BLOCK.WATER;
}

export function isOpaqueId(id) {
  return id !== BLOCK.AIR && id !== BLOCK.WATER;
}

export function isLiquidId(id) {
  return id === BLOCK.WATER;
}
