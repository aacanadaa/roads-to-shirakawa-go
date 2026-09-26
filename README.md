# Roads to Shirakawa-Go

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](./LICENSE)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?logo=javascript&logoColor=black)
![Three.js](https://img.shields.io/badge/three.js-r186-black?logo=threedotjs&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![WebGL](https://img.shields.io/badge/WebGL-2-990000?logo=webgl&logoColor=white)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)
![Release](https://img.shields.io/badge/release-v1.0.0-orange)

> A 3D voxel journey along the scenic mountain road from **Takayama to Shirakawa-go** —
> procedural rural Japan rendered in your browser. Steer past gassho-zukuri farmhouses,
> autumn maple groves and stone lanterns, cross the mountain stream, and reshape the
> valley one block at a time.

![Valley view along the road to Shirakawa-go](./docs/screenshot-valley.jpg)

---

## Highlights

- **Fully editable voxel world** — break and place blocks in real time (left / right click)
  with an 8-slot palette: rice grass, cedar wood, thatched roof, mountain stone, pine
  foliage, autumn maple, road asphalt and mountain water.
- **Cinematic renderer** — SSAO, ACES tone mapping, UnrealBloom, SMAA and a custom
  film-grade pass over a shader sky, animated water and volumetric mountain mist.
- **Procedural Takayama valley** — a meandering mountain road, a flowing stream with
  cascades, a wooden bridge, snow-capped ridgelines and a 256 × 256 × 64 voxel map.
- **Gassho-zukuri architecture** — steep thatched-roof farmhouses generated block by
  block along the road, complete with cedar walls, doors and stone foundations.
- **Living day / night cycle** — a smooth four-minute solar arc drives sun direction,
  sky and fog colour, ambient light and warm lantern glow (`N` to toggle Auto / Day / Night).
- **Procedural ambience** — Web Audio API wind, mountain stream and distant falls,
  with stream loudness that follows you as you walk the riverbank (`M` to mute).
- **Zero gameplay dependencies** — hand-rolled noise, physics, raycasting and audio.
  The only runtime dependency is [three.js](https://threejs.org/).

| Gassho farmhouse | River crossing | Nightfall |
| --- | --- | --- |
| ![Gassho-zukuri house](./docs/screenshot-gassho.jpg) | ![Wooden bridge over the stream](./docs/screenshot-bridge.jpg) | ![Night over the valley](./docs/screenshot-night.jpg) |

![Golden hour over the Takayama valley](./docs/screenshot-golden.jpg)

---

## Rendering & Atmosphere

v1.1 ships a full cinematic post-processing stack built on `three/examples/jsm`:

| Stage | Pass | Purpose |
| --- | --- | --- |
| 1 | `RenderPass` | Linear HDR scene render (half-float targets) |
| 2 | `SSAOPass` | Screen-space ambient occlusion in voxel crevices |
| 3 | `UnrealBloomPass` | Glow on lanterns, shōji screens, sun and water glints |
| 4 | `OutputPass` | ACES filmic tone mapping + sRGB encode |
| 5 | `SMAAPass` | Subpixel anti-aliasing on block silhouettes |
| 6 | `ColorGradePass` | Vignette, film grain, chromatic aberration, contrast |

- **Triplanar world shading** — procedural wood grain, thatch striations, stone speckle and
  bamboo segmentation blended by world normal, so nothing stretches on voxel sides.
- **Animated water** — vertex-displaced ripples, scrolling normals, fresnel sky reflection,
  sun sparkle and foam where the stream meets banks and bridge posts.
- **Shader sky dome** — gradient sky with sun disc, atmospheric glow and night stars,
  synced to a six-stage elevation-keyed time-of-day palette.
- **Volumetric mountain mist** — `FogExp2` density breathes with the solar arc.
- **Particles** — pollen motes in sunbeams, *hotaru* fireflies around lanterns at night,
  and drifting autumn leaves.
- **2048² directional shadows** with bias tuning and a player-following shadow camera.

---

## Quickstart

Requirements: **Node.js ≥ 20.19** and npm.

```bash
# install dependencies
npm install

# start the Vite dev server (http://localhost:5173)
npm run dev

# production build → dist/
npm run build

# serve the production build locally
npm run preview
```

Click the canvas to capture the mouse and start exploring.

---

## Controls

| Input | Action |
| --- | --- |
| `W` `A` `S` `D` / Arrow keys | Move |
| Mouse | Look around |
| `Space` | Jump / swim up |
| `Shift` | Sprint |
| Left click | Break block |
| Right click | Place block |
| `1`–`8` / Mouse wheel | Select block from the palette |
| `N` | Cycle day / night mode (Auto → Day → Night) |
| `M` | Mute / unmute ambient audio |
| `G` | Cycle graphics quality (High → Medium → Low) |
| `H` | Toggle the controls panel |
| `Esc` | Release the mouse |

---

## Technology & Architecture

| Layer | Choice | Notes |
| --- | --- | --- |
| Engine | **three.js** (r186) | WebGL2 renderer, `InstancedMesh` voxel batches |
| Post-processing | **EffectComposer** | SSAO + UnrealBloom + ACES + SMAA + custom grade |
| Bundler | **Vite** | ES modules, instant HMR, `vite build` production bundle |
| Language | **JavaScript (ES2022)** | Zero build-time transpilation beyond Vite |
| Styling | **CSS3** | Frosted-glass HUD overlay, no CSS framework |
| Audio | **Web Audio API** | Procedural noise beds + `PositionalAudio` world emitters |
| Physics | **Custom AABB** | Axis-separated voxel collision with auto step-up |

```text
roads-to-shirakawa-go/
├── index.html              # canvas host + HUD markup
├── vite.config.js          # bundler configuration
└── src/
    ├── main.js             # entry point
    ├── config.js           # tunable gameplay + graphics constants
    ├── utils.js            # math helpers (clamp, smoothstep, hash)
    ├── core/
    │   └── Game.js         # renderer, input, quality tiers, main loop
    ├── graphics/
    │   ├── Composer.js     # EffectComposer post-processing chain
    │   ├── SkyDome.js      # gradient sky shader mesh
    │   ├── VoxelMaterial.js# triplanar-injected Lambert blocks
    │   ├── WaterMaterial.js# animated water ShaderMaterial
    │   └── Particles.js    # motes, fireflies, falling leaves
    ├── shaders/
    │   ├── triplanar.js    # world-space procedural detail GLSL
    │   ├── water.js        # ripple / foam / fresnel GLSL
    │   ├── skyDome.js      # sky gradient + stars GLSL
    │   ├── particles.js    # point-sprite motion GLSL
    │   └── colorGrade.js   # vignette / grain / aberration GLSL
    ├── world/
    │   ├── blocks.js       # block registry + palette
    │   ├── noise.js        # seeded Perlin / fBm / ridged noise
    │   ├── Chunk.js        # InstancedMesh batching per chunk
    │   ├── World.js        # voxel storage + DDA raycasting
    │   └── Generator.js    # terrain, road, river, houses, trees
    ├── player/
    │   ├── Player.js       # first-person controller + physics
    │   └── BlockInteraction.js  # targeting, break / place
    ├── env/
    │   └── Sky.js          # sun arc, fog, palette, lantern lights
    ├── audio/
    │   ├── AmbientAudio.js # procedural wind / stream / falls
    │   ├── SpatialAudio.js # positional river + lantern fire
    │   └── Footsteps.js    # surface-aware step synthesis
    └── ui/
        ├── HUD.js          # hotbar, stats, banner, quality
        └── hud.css         # frosted-glass overlay styling
```

### Voxel pipeline

The world is a flat `Uint8Array` (256 × 256 × 64) divided into 16 × 16 chunks.
Each chunk builds one opaque and one transparent `InstancedMesh` containing only
**exposed** blocks (any face adjacent to air or water), tinted per instance with a
subtle hash jitter and a cheap vertical occlusion shade. Edits mark neighbouring
chunks dirty; only dirty chunks re-mesh. Block targeting uses an Amanatides & Woo
DDA voxel traversal for exact face normals — no mesh raycasting required.

### World generation

1. fBm + ridged Perlin noise builds the valley floor and the Takayama ridgeline
   (edge-weighted so the horizon is ringed by snow-capped mountains).
2. The road is carved as a smoothed height profile along a meandering spline, with
   asphalt surface and gravel shoulders.
3. The stream is carved as a separate meander, filled with translucent water blocks;
   where it meets the road a cedar bridge with railings and pillars is generated.
4. Gassho farmhouses, pine / maple groves and roadside stone lanterns (*toro*) are
   stamped from seeded randomness away from road and river.

---

## Contributing

Contributions are welcome — please read [CONTRIBUTING.md](./CONTRIBUTING.md) for
the development workflow, code style and pull-request guidelines.

Ideas we would love help with: greedy meshing, chunk streaming, touch controls,
save / load of edited regions, seasonal palettes, and accessibility options.

---

## License

This project is licensed under the **GNU General Public License v3.0** — see
[LICENSE](./LICENSE) for the full text.

```
Roads to Shirakawa-Go — a 3D voxel journey through rural Japan
Copyright (C) 2026 aacanadaa

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
```

---

*Made with three.js, Vite and a fondness for mountain roads.*
