# Repository Guidelines for AI Agents

This file provides centralized guidance to AI coding assistants (Claude, Cursor, Gemini, Copilot, Grok) when working with code in this repository.

## Layout

COLOR LAB — Gamut Explorer. The active app is **`fe/`** (SvelteKit 2 + Svelte 5 runes + TypeScript, WebGL2 renderer). `_docs/` holds planning/design notes. All commands below run from `fe/`.

## Commands

```sh
cd fe
npm install
npm run dev          # Vite dev server
npm run build        # production build → fe/build/
npm start            # run built node-adapter server (node build)
npm run check        # svelte-check type check (run after any change)
npm test             # vitest run (one-shot)
npx vitest run src/lib/documents/parse.test.ts   # single test file
```

`PUBLIC_*` env vars are inlined at **build time** (`PUBLIC_SITE_URL`, `PUBLIC_UMAMI_SRC`, `PUBLIC_UMAMI_WEBSITE_ID`). Production runs via PM2: `pm2 start ecosystem.config.cjs` from the repo root (serves `fe/build/index.js` on port 5001).

## Architecture

Data flows one direction: **`ExplorerState` + `Camera` → derived matrices → renderer / picking / theme**. State lives in Svelte 5 runes; everything downstream is pure functions of that state.

- **`lib/color/`** — the math foundation, all pure functions, no app state. `math.ts` (vec/mat3 ops), `pipeline.ts` (gamut definitions, RGB↔XYZ↔LMS↔Lab↔Oklab matrices, the `CUBE_ROT` cube-orientation rotation), `transfer.ts` (OETF/EOTF transfer curves per gamut), `registry.ts` (`SPACES` — how each `SpaceMode` maps world coords → gamut RGB), `cvd.ts` (color-vision-deficiency simulation), `selftest.ts` (round-trip matrix sanity check).

- **`lib/engine/`** — `state.svelte.ts` is the single source of truth (`createAppState` builds `ExplorerState` + `Camera`; uses `$state`). `types.ts` defines `ExplorerState`, `AppState`, and the persistence schema (`CURRENT_STATE_SCHEMA_VERSION`, `PersistedAppState`). `camera.ts` (orbit camera + `camRay` for picking), `plane.ts` (slice plane `n·p = d`), `picking.ts` (analytic ray-vs-solid hit test producing a full `TransformChain` for the inspector), `theme.ts` (Oklab ramp/anchor generation, WCAG contrast, hex), `mobile.ts`.

- **`lib/renderer/`** — `webgl-renderer.ts` (`WebGlRenderer` class: programs, VAOs, `draw(DrawInput)`). `uniforms.ts` (`rebuildMatrices(gamut)` → `DerivedMatrices`, the shared bundle consumed by renderer, picking, and theme). `shaders.ts` imports GLSL from `shaders/*.vert|*.frag` via `vite-plugin-glslify` (typed by `shaders.d.ts`). `Viewport.svelte` owns the render loop: `matrices = $derived(rebuildMatrices(explorer.gamut))`, then `renderer.draw(...)`.

- **`lib/panels/`** — standalone 2D `<canvas>` instruments (transfer curve, cones, CIE xy, spectrum) drawn imperatively via `canvas.ts` helpers.

- **`lib/components/`** — Svelte UI shell. `AppShell` is the top layout; `LeftControls`, `ThemeRamp`, `RightInspector`, `Viewport`, `DocumentBar` are the major regions.

- **`lib/documents/`** — named parameter-set persistence in `localStorage`. **See its strict workflow below.**

The renderer (GLSL) and the picker (TS in `picking.ts`) implement the **same** solid/slice/cylinder field math in two languages — when you change one, change the other or hover/picking will disagree with what's drawn.

## Document persistence (read before touching saved state)

Parameter sets are the app's document. A `ParameterSnapshot` is `PersistedAppState` — the serializable subset of state + camera. **`lib/documents/README.md` and `.cursor/rules/document-persistence.mdc` are authoritative**; follow them. Key rules:

- Load path is strictly `raw JSON → detectSchemaVersion → migrate → coerce → ParameterSnapshot` via `parseSnapshot`. **Never** `Object.assign` / `mergeSnapshot` raw localStorage JSON into live state — unknown keys leak in and old saves miss defaults.
- Adding a persisted field touches four files **together**: `engine/types.ts`, `engine/state.svelte.ts` (factory default), `documents/snapshot.ts` (`toSnapshot` explicit pick), `documents/schema.ts` (coerce + validator). Every line in `toSnapshot` needs a matching coerce line.
- Bump `CURRENT_STATE_SCHEMA_VERSION` and add a migration **only** for breaking renames/format changes — not for additive fields with a factory default. When you bump, add a `parse.test.ts` fixture for the previous version and update the `migrate.ts` changelog.
- Run `npm run check` and `npm test` after any persistence change.

There are two distinct localStorage concepts in `storage.ts`: the **session** (last-open state, `colorlab:session:v1`) and the **document registry** (named saves, `colorlab:documents:v1`). `session.svelte.ts` orchestrates dirty-tracking, save/save-as/rename/delete, and example docs.

## Versioning

App releases use semver; see [RELEASING.md](RELEASING.md). Do not bump `fe/package.json` unless preparing a release or the user asks. Mention major/minor/patch impact in summaries when a change warrants it.

## Key Documentation Reference

For deeper design decisions, research, and workflows, consult the following files:
- [_docs/Roadmap.md](_docs/Roadmap.md) — Canonical backlog; update when shipping features or changing priorities (see **Maintaining this document**).
- [_docs/v1-release-criteria.md](_docs/v1-release-criteria.md) — Beta → RC → 1.0.0 release gates; check off tasks and follow notify+push workflow when completing a gate.
- [README.md](README.md) — Overall project introduction and quick start guide.
- [CONTRIBUTING.md](CONTRIBUTING.md) — Setup guidelines, testing commands, and Pull Request expectations.
- [RELEASING.md](RELEASING.md) — Semantic versioning and release checklist.
- [_docs/design.md](_docs/design.md) — Core architecture, color-pipeline design, and WebGL2 rendering/instancing details.
- [_docs/references.md](_docs/references.md) — Industry standards bibliography (CIE, ISO, IEC, ITU, SMPTE, CSS, DTCG).
- [_docs/svelte-migration.md](_docs/svelte-migration.md) — Historical design notes on the SvelteKit 2 + Svelte 5 migration.
- [_docs/spline-surface-ramp-plan.md](_docs/spline-surface-ramp-plan.md) — Implementation proposal and plan for the 3D surface spline tools.
- [_docs/color-spaces-evaluation.md](_docs/color-spaces-evaluation.md) — Evaluation and math comparing JzAzBz, CAM16-UCS, IPT, and OKLrCH.
- [fe/src/lib/documents/README.md](fe/src/lib/documents/README.md) — Authoritative Svelte local storage schema persistence rules.
- [.cursor/rules/document-persistence.mdc](.cursor/rules/document-persistence.mdc) — Automated agent rules validating local storage document persistence changes.

