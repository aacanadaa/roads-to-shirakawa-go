# Changelog

All notable changes to **Roads to Shirakawa-Go** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] — 2026-09-25

High Fidelity Graphic Overhaul — cinematic rendering, dynamic shaders and a living atmosphere.

### Added

#### Post-processing pipeline (`src/graphics/Composer.js`, `src/shaders/colorGrade.js`)
- `EffectComposer` HDR pipeline (half-float linear render targets) with:
  - `SSAOPass` — screen-space ambient occlusion for contact shadows and voxel-crevice depth
    (tunable kernel radius / distance falloff, quality-tiered).
  - `UnrealBloomPass` — soft glow on paper lanterns, shoji screens, sun disc and water speculars.
  - `OutputPass` — ACES filmic tone mapping + sRGB conversion extracted from renderer settings.
  - `SMAAPass` — subpixel morphological anti-aliasing for clean voxel silhouettes.
  - Custom `ColorGradeShader` — cinematic vignette, animated film grain and radial chromatic
    aberration with saturation/contrast finishing.

#### Advanced lighting & atmosphere
- `THREE.FogExp2` exponential mountain mist with density and colour keyed to the solar arc
  (densest at golden dawn/dusk, thinnest at noon, misty blue at night).
- High-resolution 2048² directional shadow mapping (`PCFShadowMap` with tuned `bias` /
  `normalBias` to eliminate acne on block faces; shadow camera follows the player on a
  snapped grid to prevent shimmering).
- Extended dynamic time-of-day: six elevation-keyed palette stages (night → misty twilight →
  golden sunrise → morning → noon → high noon) driving sun direction/intensity, hemisphere
  and ambient fill, sky dome, fog and water colours, with eased Auto/Day/Night switching.

#### High-fidelity shaders (`src/shaders/`)
- **Triplanar detail shading** — `VoxelMaterial` injects world-space triplanar procedural
  detail (wood grain, thatch striations, stone speckle, moss, bamboo segments) into the
  Lambert pipeline via `onBeforeCompile`, preserving shadows and fog with zero stretching.
- **Animated water shader** (`WaterMaterial`) — vertex-displaced surface ripples, scrolling
  procedural normals, fresnel sky reflection, sun glints/sparkle, and bank/bridge-post foam
  driven by per-instance contact attributes.
- **Sky dome shader** — gradient zenith/horizon dome with sun disc, atmospheric glow and
  hash-twinkling stars at night.

#### Particle systems (`src/graphics/Particles.js`)
- Pollen and dust motes drifting in sunbeams (camera-following additive point field).
- Fireflies (*hotaru*) hovering around stone lanterns and farmhouses, pulsing only after dusk.
- Falling autumn leaves with per-particle colour, rotation and wind sway.

#### Environment polish
- Bamboo groves with segmented stalks and leaf tufts.
- Birch trees with pale bark and light canopies alongside cedar pines and autumn maples.
- Mossy boulders scattered through the forest floor.
- Cobblestone paths connecting every gassho farmhouse to the mountain road.
- Farmhouse upgrades: glowing *shōji* paper-screen windows, hanging interior lamps and warm
  point-light interior glow after dark.

#### Procedural & spatial audio (`src/audio/`)
- `THREE.PositionalAudio` emitters: rushing stream noise along the riverbed and crackling
  fires at roadside stone lanterns, with distance rolloff and filters.
- Surface-aware footstep synthesis — distinct procedural steps on grass, gravel, stone,
  cedar, asphalt, snow and water, driven by player movement and terrain contact.

#### Interface
- Refined frosted-glass HUD with saturated blur panels.
- Location banner announcing the region of the valley as you travel (with riverside tag).
- Hotbar hover lift/scale animations and improved selection feedback.
- Graphics quality tier button (`G`) cycling High → Medium → Low (SSAO, shadows, particle
  counts and pixel ratio scale per tier).

### Engine specifications

| Spec | Value |
| --- | --- |
| Post chain | Render → SSAO → UnrealBloom → Output(ACES) → SMAA → ColorGrade |
| Shadows | 2048² PCF, player-following ortho camera, bias-tuned |
| Atmosphere | FogExp2 + shader sky dome + 3 particle fields |
| Water | Custom ShaderMaterial (displacement, foam, fresnel, glints) |
| Tone mapping | ACES Filmic, exposure 1.08 |
| Runtime dependencies | `three` only |

### Installation

```bash
npm install
npm run dev      # develop on http://localhost:5173
npm run build    # production bundle in dist/
npm run preview  # serve the production bundle
```

## [1.0.0] — 2026-09-24

Initial playable release — the road from Takayama to Shirakawa-go is open.

### Added

#### 3D voxel engine
- Chunk-based voxel world: 256 × 256 × 64 blocks stored in a flat `Uint8Array`,
  split into 16 × 16 chunks meshed with `three.js` `InstancedMesh` (opaque + water batches).
- Hidden-face culling — only exposed blocks are instanced — with per-instance colour
  jitter and a cheap vertical occlusion shade for voxel depth.
- Incremental re-meshing: edits dirty the owning chunk and its neighbours only.
- Amanatides & Woo DDA voxel raycasting for exact block targeting and placement normals,
  with a wireframe selection highlight and translucent placement ghost.

#### Procedural world of the Takayama route
- Seeded Perlin / fBm / ridged noise terrain with an edge-weighted Takayama range
  forming a snow-capped horizon around the valley.
- Winding mountain road carved from a smoothed height profile, with asphalt surface
  and gravel shoulders.
- Flowing mountain stream with cascades, translucent water and sand banks.
- Wooden bridge with cedar deck, railings and pillars where the road crosses the stream.
- Gassho-zukuri farmhouses generated block by block: stone foundations, cedar walls,
  door and window openings, and steep stepped thatched roofs.
- Pine and autumn maple groves placed from seeded density noise, avoiding road and river.
- Roadside stone lanterns (toro) with warm point-light glow after dusk.

#### Gameplay
- First-person controller: WASD / arrow-key movement, mouse look via Pointer Lock,
  jump, sprint, swimming and automatic 1-block step-up.
- Real-time block breaking (left click) and placement (right click), including
  hold-to-repeat editing.
- 8-slot block palette hotbar: Rice Grass, Cedar Wood, Thatched Roof, Mountain Stone,
  Pine Foliage, Autumn Maple, Road Asphalt, Mountain Water — selectable via
  `1`–`8`, mouse wheel or click.
- Day / night cycle: a smooth four-minute solar arc driving sun direction and colour,
  sky and fog palette, ambient levels and lantern light. `N` cycles Auto → Day → Night
  with eased transitions.
- Procedural Web Audio ambience: filtered noise wind, band-passed mountain stream
  (loudness follows your distance to the water), and a distant falls bed. `M` mutes.
- HUD overlay: crosshair, block hotbar with labels, FPS / position / in-world clock,
  cycle and sound toggles, toast notifications and a collapsible controls panel.
- Responsive canvas sizing with clamped device-pixel ratio for stable frame times.

#### Project infrastructure
- Vite 8 + three.js 186 toolchain (`npm run dev` / `build` / `preview`).
- GPLv3 licensing, contribution guidelines, and this changelog.

### Engine specifications

| Spec | Value |
| --- | --- |
| Renderer | three.js `WebGLRenderer`, sRGB output |
| World size | 256 × 64 × 256 blocks (≈ 137 k visible instances) |
| Chunk size | 16 × 16 × 64 |
| Day length | 240 seconds (Auto mode) |
| Runtime dependencies | `three` only |
| Browser support | Modern evergreen browsers with WebGL2 |

### Installation

```bash
npm install
npm run dev      # develop on http://localhost:5173
npm run build    # production bundle in dist/
npm run preview  # serve the production bundle
```

[1.1.0]: https://github.com/aacanadaa/roads-to-shirakawa-go/releases/tag/v1.1.0
[1.0.0]: https://github.com/aacanadaa/roads-to-shirakawa-go/releases/tag/v1.0.0
