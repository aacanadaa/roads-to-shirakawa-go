# Contributing to Roads to Shirakawa-Go

Thanks for your interest in contributing! This document explains the workflow,
code style and review expectations for the project.

## Getting started

```bash
git clone https://github.com/aacanadaa/roads-to-shirakawa-go.git
cd roads-to-shirakawa-go
npm install
npm run dev
```

The dev server runs at `http://localhost:5173` with hot module replacement.

## Development workflow

1. **Open an issue first** for large features or behavioural changes so the
   approach can be discussed before implementation.
2. **Fork the repository** and create a topic branch from `main`:
   `git checkout -b feature/my-improvement`
3. **Make focused commits** with clear messages (see below).
4. **Verify your work** before opening a PR:
   - `npm run build` completes without errors.
   - The game loads without console errors (`npm run preview` + browser check).
   - New gameplay is reachable from the default spawn.
5. **Open a pull request** against `main` describing the change, the motivation
   and how it was tested.

## Commit messages

Use Conventional Commits style:

- `feat: add seasonal maple palette`
- `fix: prevent placement inside the player AABB`
- `perf: skip interior blocks during chunk meshing`
- `docs: clarify controls table`
- `refactor: extract river carving into its own pass`

## Code style

- Plain modern JavaScript (ES2022 modules), no transpile-only syntax.
- 2-space indentation, single quotes, semicolons.
- Prefer small, single-purpose modules under `src/world`, `src/player`,
  `src/env`, `src/audio` and `src/ui`.
- Keep gameplay constants in `src/config.js` rather than magic numbers.
- No new runtime dependencies without prior discussion — the project aims to stay
  at exactly one (`three`). Dev-tooling additions are fine when justified.
- Comments should explain *why*, not *what*.

## Project layout

| Path | Responsibility |
| --- | --- |
| `src/core/Game.js` | Orchestration: renderer, input, main loop |
| `src/world/` | Voxel storage, meshing, noise, generation |
| `src/player/` | Movement physics and block interaction |
| `src/env/Sky.js` | Day/night lighting and fog |
| `src/audio/` | Procedural ambience |
| `src/ui/` | HUD DOM and styling |

## Reporting bugs

Please include: browser and OS, steps to reproduce, expected vs actual behaviour,
console output and, if possible, a screenshot. World-generation bugs should note
the seed from `src/config.js`.

## Licence

By contributing you agree that your contributions are licensed under the
**GNU General Public License v3.0** (see [LICENSE](./LICENSE)), the same licence
as the rest of the project.
