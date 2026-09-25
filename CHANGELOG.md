# Changelog

All notable changes to **Roads to Shirakawa-Go** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.0]: https://github.com/aacanadaa/roads-to-shirakawa-go/releases/tag/v1.0.0
