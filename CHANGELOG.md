# Changelog

All notable changes to COLOR LAB are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The canonical version string is `fe/package.json` → `"version"`. Update this file when bumping the app version (see [RELEASING.md](RELEASING.md)).

## [Unreleased]

### Added

- Tutorial coverage for beta.1 features — a "pipeline rail" prelude step (all tracks), an "Observer model" step in the Explorer pipeline track, and Share/Import/Save-to-file guidance folded into the Quick Ramp save step; `pipelineGamut` help now also documents the Observer model's reach.

### Changed

- Dark/light theme switch moved out of the "Text" (Readability) panel into a dedicated sun/moon toggle in the header (desktop); on mobile it is a normal overflow-menu row.
- Header GitHub link now shows the GitHub mark (logo) instead of the word "GitHub"; the in-panel Info links stay as text.
- Header **Privacy** button renamed to **About** — the panel covers authorship, open source, changelog, beta limitations, and privacy.

### Fixed

- Light theme — header and floating-surface backgrounds (app header, sidebar footer, viewport toolbar, help/tutorial/lane-picker popovers, pipeline tooltip, ramp substep cards) no longer reuse dark-theme fills with dark text; surfaces use theme-aware tokens (`--header-bg`, `--popover-bg`, `--surface-toolbar`, etc.) with lighter values under `data-theme='light'`.
- Aliased `--border`, `--muted`, and `--text` to the canonical palette tokens so component-scoped styles resolve consistently in both themes.
- Tutorial and help copy corrected for beta.1 behavior — the multi-list tutorial no longer claims lists "share interpolation settings" (each list owns its pipeline since schema v13); gamut-map/export/palette copy says "active colorspace (sRGB by default)" instead of "sRGB"; `pipelineExpand` help describes the two-axis Spread (rows = related ramps, columns = per-stop variants); `pipelineGamut` help documents the Bradford CAT for non-D65 gamuts.
- Mobile overflow menu — Readability, theme, and About are normal menu rows (icon + label) instead of embedded header widgets with mismatched pill styles.
- Desktop header — author line, GitHub mark, version link, About, Text/theme controls, document buttons, and WebGL2 badge share a common control height and `app-header-trail` flex alignment so the right-side cluster no longer sits on mixed baselines.

## [1.0.0-beta.1] - 2026-06-16

First public beta of the v1 release track. Feature-complete enough for real use;
saved documents may still change with migrations before `1.0.0`. Known limitations
are documented in the README and the in-app Info panel.

### Added

- Modular registries for observer models and chromaticity diagrams (fully backward compatible).
- Eagerly loaded physiological (Stockman & Sharpe 2°/10°) and standard CMF (CIE 1931/1964) datasets, compiled at `12g` precision for exact assertions.
- Dynamic observer matrix generator that calculates custom `rgb2lms` / `lms2rgb` conversion matrices at runtime for WebGL rendering, CVD simulation, and color inspector picking.
- Dynamic locus range and autofit bounding box calculations in 2D chromaticity panels.
- Oklab a/b and CIELAB a*/b* fixed-lightness opponent-plane views with coordinate unprojection, sampled gamut-boundary cross-sections, and interactive inspection.
- Table-backed MacLeod-Boynton spectral locus coordinates plus calibrated source-basis projection matching the bundled 2° source table, independent of the active observer selection.
- Restored MacLeod-Boynton diagram fill using a calibrated inverse from `(l, s)` back to its fixed 2° source XYZ direction.
- Ramp substep enable toggles in Ramp Builder sidebar headers (Interpolate, Place, Expand, Gamut map).
- Observer model and chromaticity diagram selections stored in local app preferences and fully validated/persisted in localStorage snapshots.
- Document sharing & ingestion v1 — Save to file, Share (copy link · copy JSON), Import (file · URL · paste · `#s=…` hash); all paths use `parseSnapshot`.
- Per-list ramp pipelines (document schema v13) — each source ramp owns its interpolation, placement, expand, and constraint settings; independent main-curve vs extension constraints. The terminal gamut map stays a single shared step targeting the active colorspace.
- Multi-list ramp management — add (clones the active pipeline), duplicate, "Apply pipeline to all," and a per-chip mode cue with a divergence note.
- Pipeline rail — read-only navigation map + live status dashboard over the Explorer/Ramp steps; click opens and scrolls a step's controls; arrow-key roving.
- Named undo/redo transaction labels — point, ramp/list, gamut, and world-space edits record specific labels (e.g. "Undo Add point") via a one-shot `history.hintLabel`.
- Light UI theme — dark/light appearance toggle in the Accessibility panel, persisted in `colorlab:preferences`, with flash-free `data-theme` bootstrap in `app.html`.
- Neutral explorer backdrop — Oklab L = 0.5 viewport surround toggle in Viewport preferences; updates WebGL clear color, floor-grid underside, and viewport letterbox; persisted in `colorlab:preferences`.
- Beta limitations — documented in README and the in-app Info panel (WebGL2, gamut-map scope, non-D65 CAT, display assumption).

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
- MacLeod-Boynton diagram selector and panel footnote state the fixed CIE 2° table / SS 2° LMS basis, independent of the Observer model selector.
- LMS fundamentals panel header names the active observer dataset (compact label).
- Spectral locus generation now uses the observer dataset wavelength range and avoids out-of-range zero endpoints.
- Ramp Builder status hierarchy — parent step shows selected list context; Source colors substep shows active-list point count.
- Pipeline and help copy clarifying path-shape surface projection vs terminal export gamut mapping.
- Gamut Map help, pipeline node copy, and popover note — terminal map targets the **active colorspace** (sRGB by default; analytic mapper sRGB-only today).
- Canonical backlog in `_docs/Roadmap.md` with maintenance rules.
- v1 release track in `_docs/v1-release-criteria.md` — Beta → RC → 1.0.0 gates, task checklist, and notify+push workflow.
- Light-theme secondary contrast (Normal / High / Maximum) darkens `--dim` and `--faint` instead of reusing dark-mode lightening rules.
- Sidebar Viewport preferences footer — View aids and Performance in side-by-side columns; View aids in a 2×2 grid (floor grid, hide aids, auto-rotate, neutral backdrop); Performance stacked vertically (auto-reduce, min FPS).

### Fixed

- Bradford chromatic adaptation for non-D65 gamuts — NTSC (Illuminant C) and CIE 1931 RGB (Illuminant E) were rendered against the D65-referenced sRGB/Lab/Oklab math without adaptation, so their white appeared tinted and perceptual geometry was skewed. `rebuildMatrices` now adapts each gamut's XYZ to the D65 interchange white (D65 gamuts unchanged); CPU, WebGL, and picking share the corrected matrices.

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
