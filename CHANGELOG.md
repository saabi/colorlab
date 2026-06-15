# Changelog

All notable changes to COLOR LAB are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The canonical version string is `fe/package.json` → `"version"`. Update this file when bumping the app version (see [RELEASING.md](RELEASING.md)).

## [Unreleased]

### Added

- Document sharing & ingestion v1 — Save to file, Share (copy link · copy JSON), Import (file · URL · paste · `#s=…` hash); all paths use `parseSnapshot`.

- `CHANGELOG.md` and in-app version link (`vX.Y.Z`) next to GitHub in the header and Info panel.
- Adaptive alpha controls for terminal gamut mapping (`gamutMapParams`).
- Focus lightness (`focusL`) for `project-0.5` / `adaptive-0.5` on surface projection and gamut map (document schema v12).
- Surface projection UI polish: alpha preset chips and lightness-preserving ↔ compression status copy.
- `MAX_RAMP_STOPS` (105) for Interpolate / Place step count.

### Changed

- App-wide themed scrollbars (`--scrollbar-*` tokens; Firefox `scrollbar-color` + WebKit `::-webkit-scrollbar`).
- Pipeline and help copy clarifying path-shape surface projection vs terminal export gamut mapping.
- Gamut Map UI, help, and tutorial copy now explicitly identify the current output target as sRGB.
- Canonical backlog in `_docs/Roadmap.md` with maintenance rules.

## [0.0.1] - 2026-06-09

First public open-source release of the SvelteKit / WebGL2 gamut explorer.

### Added

- Interactive 3D RGB gamut solids (sRGB, P3, Rec.2020, and more) with slice, cylinder cutaway, and reference shells.
- Color-space morphing, spectral locus chromaticity overlay, and instrument panels (transfer, cones, xy, spectrum).
- Theme ramp pipeline: interpolate, place, expand, terminal gamut map, CSS / DTCG export.
- Surface constraint projection (Oklab chroma, Ottosson projection) for spline curves.
- Undo/redo for parameter snapshots; named document persistence in `localStorage`.
- Accessibility baseline: skip link, keyboard navigation, text readability preferences.
- Responsive layout: tablet drawer (≤1024px), mobile layout (≤820px).
- MIT license, CI, and contributor documentation.
