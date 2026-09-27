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
  BAMBOO: 16,
  BIRCH: 17,
  BIRCH_LEAF: 18,
  MOSSY_STONE: 19,
  COBBLE: 20,
  SHOJI: 21,
  PLANKS: 22,
  FLOWER_RED: 23,
  FLOWER_YELLOW: 24,
  FLOWER_WHITE: 25,
  GRASS_TUFT: 26,
  RICE: 27,
  STONE_BRICK: 28,
  MOSS: 29,
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
  { id: 12, name: 'Stone Lantern', color: 0xffd9a0, solid: true, liquid: false },
  { id: 13, name: 'River Sand', color: 0xcbb68c, solid: true, liquid: false },
  { id: 14, name: 'Cedar Trunk', color: 0x5d4326, solid: true, liquid: false },
  { id: 15, name: 'Bedrock', color: 0x4a4f54, solid: true, liquid: false },
  { id: 16, name: 'Bamboo Stalk', color: 0x7fae5c, solid: true, liquid: false },
  { id: 17, name: 'Birch Trunk', color: 0xd8d3c4, solid: true, liquid: false },
  { id: 18, name: 'Birch Canopy', color: 0x7fae5c, solid: true, liquid: false },
  { id: 19, name: 'Mossy Rock', color: 0x6f8566, solid: true, liquid: false },
  { id: 20, name: 'Cobble Path', color: 0x8d8f88, solid: true, liquid: false },
  { id: 21, name: 'Shoji Screen', color: 0xffe9c4, solid: true, liquid: false },
  { id: 22, name: 'Cedar Planks', color: 0x8a5f36, solid: true, liquid: false },
  { id: 23, name: 'Red Spider Lily', color: 0xd63a2f, solid: false, liquid: false },
  { id: 24, name: 'Wild Chrysanthemum', color: 0xf2c230, solid: false, liquid: false },
  { id: 25, name: 'White Clover', color: 0xf2ede0, solid: false, liquid: false },
  { id: 26, name: 'Grass Tuft', color: 0x6da34a, solid: false, liquid: false },
  { id: 27, name: 'Rice Sprout', color: 0x86c05c, solid: false, liquid: false },
  { id: 28, name: 'Stone Brick', color: 0x8b9094, solid: true, liquid: false },
  { id: 29, name: 'Moss Carpet', color: 0x4e7a3f, solid: false, liquid: false },
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

export const GLOW_IDS = Object.freeze([BLOCK.LANTERN, BLOCK.SHOJI]);

export function blockDef(id) {
  return BLOCK_DEFS[id] ?? BLOCK_DEFS[0];
}

export function isGlowId(id) {
  return id === BLOCK.LANTERN || id === BLOCK.SHOJI;
}

export function isSolidId(id) {
  if (id === BLOCK.AIR || id === BLOCK.WATER) return false;
  const def = BLOCK_DEFS[id];
  if (!def) return false;
  return def.solid === true;
}

// Opaque = fully hides neighbouring faces. Detail flora is see-through.
export function isOpaqueId(id) {
  if (id === BLOCK.AIR || id === BLOCK.WATER) return false;
  switch (id) {
    case BLOCK.FLOWER_RED:
    case BLOCK.FLOWER_YELLOW:
    case BLOCK.FLOWER_WHITE:
    case BLOCK.GRASS_TUFT:
    case BLOCK.RICE:
    case BLOCK.MOSS:
      return false;
    default:
      return true;
  }
}

// Foliage sways in the wind shader (leaves, bamboo crowns, tufts, crops).
export function isFoliageId(id) {
  return (
    id === BLOCK.PINE ||
    id === BLOCK.MAPLE ||
    id === BLOCK.BIRCH_LEAF ||
    id === BLOCK.BAMBOO ||
    id === BLOCK.GRASS_TUFT ||
    id === BLOCK.RICE ||
    id === BLOCK.MOSS ||
    id === BLOCK.FLOWER_RED ||
    id === BLOCK.FLOWER_YELLOW ||
    id === BLOCK.FLOWER_WHITE
  );
}

// Small detail sprites render at reduced scale so meadows look delicate.
export function isDetailSpriteId(id) {
  return (
    id === BLOCK.FLOWER_RED ||
    id === BLOCK.FLOWER_YELLOW ||
    id === BLOCK.FLOWER_WHITE ||
    id === BLOCK.GRASS_TUFT ||
    id === BLOCK.RICE ||
    id === BLOCK.MOSS
  );
}

export function isLiquidId(id) {
  return id === BLOCK.WATER;
}
