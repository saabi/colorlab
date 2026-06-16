# Changelog

All notable changes to COLOR LAB are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The canonical version string is `fe/package.json` → `"version"`. Update this file when bumping the app version (see [RELEASING.md](RELEASING.md)).

## [Unreleased]

### Added

- Modular registries for observer models and chromaticity diagrams (fully backward compatible).
- Eagerly loaded physiological (Stockman & Sharpe 2°/10°) and standard CMF (CIE 1931/1964) datasets, compiled at `12g` precision for exact assertions.
- Dynamic observer matrix generator that calculates custom `rgb2lms` / `lms2rgb` conversion matrices at runtime for WebGL rendering, CVD simulation, and color inspector picking.
- Dynamic locus range and autofit bounding box calculations in 2D chromaticity panels.
- Oklab a/b and CIELAB a*/b* fixed-lightness opponent-plane views with coordinate unprojection, sampled gamut-boundary cross-sections, and interactive inspection.
- Table-backed MacLeod-Boynton spectral locus coordinates plus calibrated arbitrary LMS projection matching the bundled 2° source table.
- Observer model and chromaticity diagram selections stored in local app preferences and fully validated/persisted in localStorage snapshots.
- Document sharing & ingestion v1 — Save to file, Share (copy link · copy JSON), Import (file · URL · paste · `#s=…` hash); all paths use `parseSnapshot`.
- Per-list ramp pipelines (document schema v13) — each source ramp owns its interpolation, placement, expand, and constraint settings; independent main-curve vs extension constraints. The terminal gamut map stays a single shared step targeting the active colorspace.
- Multi-list ramp management — add (clones the active pipeline), duplicate, "Apply pipeline to all," and a per-chip mode cue with a divergence note.
- Pipeline rail — read-only navigation map + live status dashboard over the Explorer/Ramp steps; click opens and scrolls a step's controls; arrow-key roving.
- Named undo/redo transaction labels — point, ramp/list, gamut, and world-space edits record specific labels (e.g. "Undo Add point") via a one-shot `history.hintLabel`.

- `CHANGELOG.md` and in-app version link (`vX.Y.Z`) next to GitHub in the header and Info panel.
- Adaptive alpha controls for terminal gamut mapping (`gamutMapParams`).
- Focus lightness (`focusL`) for `project-0.5` / `adaptive-0.5` on surface projection and gamut map (document schema v12).
- Surface projection UI polish: alpha preset chips and lightness-preserving ↔ compression status copy.
- `MAX_RAMP_STOPS` (105) for Interpolate / Place step count.

### Changed

- Document schema bumped to v13 — older saves migrate automatically (the former global ramp pipeline fields are lifted into each source list).
- App-wide themed scrollbars (`--scrollbar-*` tokens; Firefox `scrollbar-color` + WebKit `::-webkit-scrollbar`).
- Chromaticity instrument copy now distinguishes true CIE chromaticity diagrams from Oklab/CIELAB opponent-plane views.
- Chromaticity panel and selector labels now reflect the active observer model instead of always implying CIE 1931 coordinates.
- Spectral locus generation now uses the observer dataset wavelength range and avoids out-of-range zero endpoints.
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
