# Roadmap

Curated priorities and open work for COLOR LAB. Detailed design lives in linked plan docs under `_docs/`.

For the full feature catalog (including lower-priority ideas), see [`design-review-unimplemented-features.md`](design-review-unimplemented-features.md).

For the current color-space role model, see [`color-space-role-architecture.md`](color-space-role-architecture.md). It defines **Active gamut**, **World space**, **Display gamut**, gamut-independent source storage, and per-list pipeline direction.

**Release track:** [`v1-release-criteria.md`](v1-release-criteria.md) — Beta → RC → **1.0.0** gates and task checklist (notify + push after each gate).

## Maintaining this document

**This file is the canonical backlog.** Keep it current so contributors and agents do not rely on stale lists elsewhere.

Update `_docs/Roadmap.md` when you:

- **Ship** a user-visible feature or close a planned item — move it to **Recently shipped** and remove it from **Open work**.
- **Promote** an item to active priority or **defer** something — adjust **Priority summary** and the relevant section.
- **Open** a new multi-step effort — add a short entry here and link to a plan doc in `_docs/` if the design is non-trivial.
- **Revise** a plan doc in ways that change scope, order, or open questions — sync this file in the same PR.

**When to update:** in the same PR (or immediately after) as the code or plan change, or as part of the release checklist before tagging (see [RELEASING.md](../RELEASING.md)).

**What not to duplicate here:** implementation detail, API sketches, and phase breakdowns belong in plan docs. This file stays a scannable summary (~2 screens).

**Ephemeral snapshots** (e.g. `tmp/pending-tasks-*.md`) are optional working notes; they are not the source of truth.

---

## Recently shipped

- **`1.0.0-beta.2`** (2026-06-16) — dedicated theme toggle, light-theme surface contrast fixes, header declutter (GitHub mark, About panel, Aa readability icon), mobile More-menu layout, and tutorial/help corrections for beta.1 behavior.
- **Observer, XYZ, locus & chromaticity registries** — catalog of 32 observer datasets with lazy-loaders and linear interpolation. Dynamic observer conversion matrix generation at runtime for WebGL shaders, CVD simulation, and inspector picking. Dynamic locus range, autofit bounding boxes, CIE xy/uv/u′v′ diagrams with observer-aware labels, Oklab/CIELAB fixed-lightness opponent-plane views, and calibrated MacLeod-Boynton 2° (table-backed locus + fixed source-basis projection/fill). LMS panel names the active observer. **Plans:** [`lms-fundamentals-chromaticity-plan.md`](lms-fundamentals-chromaticity-plan.md), **audit:** [`cone-fundamentals-chromaticity-math-audit.md`](cone-fundamentals-chromaticity-math-audit.md).
- **3D explorer** — color space morphing (400 ms blend), spectral locus chromaticity overlay, cylindrical saturation/chroma cutaway (`cylSlice` / `cylRad`), true cylinder clipping outline, tessellation up to 512 with scaled outlines
- **Theme ramp pipeline** — declarative stage chain, `PlacePolicy` recompute stages, terminal `gamutMap` via `finalizeRamp`, surface constraint Phases 1–4 backend (`boundary-project.ts`, `SurfaceProjectionParams`)
- **Undo/redo v1** — debounced `ParameterSnapshot` history
- **Instruments** — conservative spectrum wavelength marker (suppressed when angular distance to locus > 0.06 rad)
- **Accessibility** — skip link, landmarks, keyboard baseline, text readability preferences (font scale, contrast, line height)
- **Layout & polish** — tablet drawer (≤1024px), full mobile layout (≤820px), floor grid underside, header isotype, app preferences in `localStorage` *(breakpoints are pixel-based today; glyph-width responsive infrastructure planned — see #14)*
- **Open source** — MIT license, CI, CONTRIBUTING / RELEASING docs, dual GitHub/GitLab remotes
- **Document sharing & ingestion v1** — Save to file, Share (copy link · copy JSON), Import (file · URL · paste · `#s=…` hash); client-side only via `parseSnapshot`
- **Themed scrollbars** — app-wide dark-UI scrollbar tokens (`scrollbar-color` + `::-webkit-scrollbar`) in `app.css`
- **Per-list ramp pipelines** (schema v13) — each source list owns its interpolation / placement / expand / constraint settings; independent **main-curve and extension constraints** (#3 + #4); shared terminal `gamutMap` targets the active colorspace. Multi-list UX: add-clones-active, duplicate, "apply to all," divergence cue. **Plan:** [`per-list-pipeline-plan.md`](per-list-pipeline-plan.md)
- **Pipeline rail (node UI Phase 1)** — read-only `PipelineRail` map + status dashboard over the `PIPELINE_NODES` registry; click a step to open + scroll its sidebar controls; arrow-key roving. **Plan:** [`pipeline-node-ui-proposal.md`](pipeline-node-ui-proposal.md)
- **Named undo/redo transaction labels** — one-shot `history.hintLabel` so point/list/ramp edits and gamut/world-space changes show specific labels (e.g. "Undo Add point"). **Design:** [`undo-redo-state-design.md`](undo-redo-state-design.md)
- **Color picker per-channel sliders** — direct H/S/L · H/S/V (and any space) sliders for the selected ramp stop in `ColorPicker.svelte`, alongside the existing plane/bar.
- **Ramp Builder polish** — status hierarchy (parent = list context, Sources = active-list points), per-substep enable toggles in sidebar headers. **Plan:** [`ramp-builder-status-hierarchy-plan.md`](ramp-builder-status-hierarchy-plan.md)
- **Light UI theme** — dark/light appearance toggle in Accessibility panel; `:root[data-theme='light']` token set in `app.css`; persisted in `colorlab:preferences`; light-theme secondary contrast overrides in `a11y.css`. WebGL viewport backdrop is independent (see neutral backdrop).
- **Neutral explorer backdrop** — Oklab L = 0.5 surround toggle in Viewport preferences; WebGL clear color + viewport letterbox; persisted in `colorlab:preferences`.
- **Sidebar Viewport preferences footer** — View aids (2×2) and Performance (stacked) in a horizontal two-column layout. **Plan:** [`sidebar-footer-layout-proposal.md`](sidebar-footer-layout-proposal.md).

---

## Priority summary

**v1 release track (active):** Phase A pre-beta work is prioritized over new feature backlog. Task IDs and gates: [`v1-release-criteria.md`](v1-release-criteria.md). Next engineering focus: **A1 Bradford CAT** (or A1-alt guard), **A2** copy, **A3** OOG preview → **`1.0.0-beta.1`**.

Aligned with the **recommended next order** in [`surface-constraint-gamut-projection-plan.md`](surface-constraint-gamut-projection-plan.md) and [`gamut-mapping-unification-plan.md`](gamut-mapping-unification-plan.md). Projection math and target-gamut generalization: surface-constraint plan is canonical; gamut-unification plan covers terminal-stage policy and UI.

### Architecture alignment

1. **Color-space role cleanup** — reflect the three-role model in UI/docs: Active gamut = working/export intent, World space = layout/interpolation coordinate system, Display gamut = physical display capability. Includes a planned **global Color Context** surface: move Active gamut and Display gamut/profile selection out of the Explorer pipeline when chromatic adaptation / display-gamut work gives that surface real behavior. The Explorer lane keeps reference shell and future Explorer display-gamut clipping/mapping controls. Also documents that `srgbLin` already **is** the gamut-independent colorimetric anchor (linear sRGB ↔ XYZ D65 is a fixed bijection); the proposed XYZ-D65 source-storage migration is **deferred** (representational relabeling, not a correctness fix — not worth a schema break). See [`color-space-role-architecture.md`](color-space-role-architecture.md).
2. 🟡 **White point & chromatic adaptation** — **active-gamut adaptation shipped** (A1): Bradford CAT in `color/adapt.ts`; `rebuildMatrices` adapts each gamut's XYZ to the D65 interchange white (D65 gamuts identity), fixing NTSC (Illuminant C) and CIE (E); CPU/GPU/picking share the corrected `DerivedMatrices`. **Remaining:** display-gamut white adaptation when a calibrated/custom Display gamut exists (rolls in with #6).
3. ✅ **Observer, XYZ, locus & chromaticity dataset registry** — **shipped**. Registry of 32 observer datasets with dynamic matrix generation for WebGL rendering, CVD simulation, and picking. Dynamic locus range, autofit bounding boxes, observer-aware CIE xy/uv/u′v′ labels, Oklab/CIELAB opponent-plane views, and calibrated MacLeod-Boynton 2°. Plans: [`lms-fundamentals-chromaticity-plan.md`](lms-fundamentals-chromaticity-plan.md), audit: [`cone-fundamentals-chromaticity-math-audit.md`](cone-fundamentals-chromaticity-math-audit.md).
4. ✅ **Per-list ramp pipeline instances** — **shipped** (schema v13). Each source list owns its interpolation / placement / expand / constraint settings; shared terminal `gamutMap`. **Plan:** [`per-list-pipeline-plan.md`](per-list-pipeline-plan.md).
5. ✅ **Separate main-curve and extension constraints** — **shipped** with #4: `pipeline.main` and `pipeline.extension` are independent (engine + UI).
6. **Display gamut preferences + Color Context UI** — store display profiles/calibration in `localStorage`; users may have multiple displays. Initial default remains sRGB. Depends on #2 for correct white handling and should share the global Color Context surface with future observer/fundamentals settings from #3. This is the preferred moment to move Display gamut out of the Explorer pipeline.

### Small scope, high value (projection params track)

7. **Target model copy cleanup** — recent UI names sRGB as the fixed Gamut Map target, but roadmap direction is Active gamut for ramp output and Display gamut for Explorer display mapping. Update UI copy as the implementation catches up.
8. **Explorer display-gamut classification** — classify Active gamut against Display gamut (shader first) before projected display preview. Whether to clip/map the Explorer view to Display gamut belongs in the Explorer pipeline; selecting Active/Display gamuts does not.
9. **PNG ramp strip export** — export each generated ramp as a **horizontal 1×N sRGB PNG** (one pixel per final stop, post gamut-map — same colors as CSS/DTCG export and `PaletteStrip`). **Multi-list:** one strip per source list when Expand is off (`theme.stops` / per-list rows); with Expand on, one strip per row of `theme.grid`. **Target apps:** DaVinci Resolve, TouchDesigner, Resolume, Fusion (Text+ glyph fill texture — load the PNG directly as a fill map). Workflow: design in Color Lab → download strip(s) → drop into the compositor. Optional: hi-res strip from the interpolate curve (not just placed stops); zip when multiple lists/rows. Natural home: Export step beside CSS/DTCG (`theme.ts` + canvas/`OffscreenCanvas`); later movable to the modular engine (#30).

### Small scope, polish

10. ✅ **Undo transaction labels** — **shipped**: one-shot `history.hintLabel(label)` that the debounced observer prefers; labeled point/list/ramp edits (ThemeRamp + Viewport) and gamut/world-space changes. See [`undo-redo-state-design.md`](undo-redo-state-design.md).

### Medium scope

11. ✅ **Light UI color scheme** — **shipped**: dark/light toggle in Accessibility panel; `:root[data-theme='light']` tokens in `app.css`; persisted in `colorlab:preferences` with flash-free bootstrap in `app.html`; light-theme secondary contrast overrides in `a11y.css`. WebGL viewport backdrop is independent (see #12).
12. ✅ **Neutral explorer backdrop** — **shipped**: Oklab L = 0.5 surround toggle in sidebar footer Viewport preferences; WebGL clear color, floor-grid underside, and viewport letterbox; persisted in `colorlab:preferences` (not documents). Does not change the color solid.
13. ✅ **Pipeline node UI (Phase 1)** — **shipped**: `PipelineRail.svelte` (read-only map + status dashboard) over the `PIPELINE_NODES` registry; clicking a step opens + scrolls its sidebar controls; arrow-key roving on the rail. Sidebar already renders node-ordered sections with status/affects/enablement. See [`pipeline-node-ui-proposal.md`](pipeline-node-ui-proposal.md).
14. **Glyph-width responsive breakpoints** — replace pixel `max-width` layout gates (1024 / 820 / 520 px in `app.css`; `mobile.ts` `matchMedia`) with infrastructure that classifies the viewport from **glyph (ch) width**, not raw pixels. Layout mode then tracks typographic measure — more predictable on real devices and stable when the Readability panel changes font scale. Prior art: [`ScreenSensor`](https://github.com/nestauk/dsp_waifinder/blob/dbedf0b5e879838ea15f08fa208493b1ba5ed7dc/fe/src/routes/%2Blayout.svelte#L127) in dsp_waifinder (same author; `@svizzle/ui` applies screen classes from measured glyph width). Color Lab will likely use a small in-app sensor + CSS class hooks rather than a new dependency.
15. **OOG badges + raw/final preview** — OOG count badges on Interpolate/Gamut Map pipeline nodes **shipped**; before/after stop swatch diff preview on Gamut Map/Export remains open.
16. ✅ **Okhsl/Okhsv picker coordinates** — **shipped**: the picker already supported Okhsl/Okhsv via plane+bar; added direct per-channel sliders (H/S/L · H/S/V, and every space) for the selected stop in `ColorPicker.svelte`.
17. **Direct xy chromaticity picking** — click/drag in the xy panel; define which Y/L is held constant and which chromaticity diagram/observer is active. Depends on the diagram registry in #3.
18. **Gamut boundary snap tools** — stop-level UX on top of existing Oklab boundary projection.

### Large / design-first

19. **Generic active/display gamut solver** — matrix-based boundary solver for Active gamut and Display gamut relationships; keep sRGB analytic fast path where useful.
20. **Custom Display Gamut** — calibration wizard UX before implementation.
21. **Gradient designer improvements** — editable stops, per-stop OKLCh/Okhsl, CSS gradient preview.
22. **Pipeline node UI (Phases 2–4)** — node-scoped parameter panel, full pipeline-driven layout, mobile optimization (pairs with #14 glyph-width breakpoints). **Note:** the Gamut/Color-Context split is blocked on the colorimetry work and documented in [`gamut-step-organization-observations.md`](gamut-step-organization-observations.md) — extract World/Clip/Vision/Display panels first; leave Gamut/Color Context for last.

### Research / deferred

23. Gamut compression — display/ramp policy after Active/Display gamut model stabilizes
24. Projected Explorer display overlay vs geometry replacement (open question)
25. Spectral/chromaticity intensity volume — depends on the observer/fundamentals registry (**registry shipped**; volume overlay still open)
26. GPU/codegen evaluation (surface plan Phase 8; criteria-gated)
27. WebGPU, HDR, EDID defaults, Color Accumulator, in-scene text — see design review
28. **Additional MacLeod-Boynton / LMS-ratio diagram modes** — only with source-backed tables or explicit normalization policy per fundamentals dataset; an active-observer LMS ratio view would be a separate, honestly labeled mode (not “MacLeod-Boynton”). **Audit:** [`cone-fundamentals-chromaticity-math-audit.md`](cone-fundamentals-chromaticity-math-audit.md) §Future Work.
29. **Compact ramp interchange format (+ optional npm package)** — a small JSON schema for **anchors + per-list pipeline + terminal gamut-map policy** (and optionally baked final stops), distinct from the full `ParameterSnapshot` (explorer/camera/view). Goal: other apps can import/export ramps without pulling the whole document model. **Existing ecosystem:** [DTCG](https://www.designtokens.org/) parsers ([@styleframe/dtcg](https://www.styleframe.dev/docs/getting-started/integrations/dtcg), [@trufflehq/design-tokens-format-module](https://www.npmjs.com/package/@trufflehq/design-tokens-format-module)) handle token trees, not interpolation recipes; [colors-on-the-curve](https://www.npmjs.com/package/colors-on-the-curve) and [Huescale](https://github.com/ryannono/Huescale) generate/export palettes (HSL or OKLCH) with `$extensions` metadata but not Color Lab's Oklab pipeline model. **Options:** (a) homebrew schema + in-repo parse/encode only — zero consumer deps; (b) thin first-party npm module under our control (`@saabi/colorlab-ramp` or similar) centralizing compact encode/decode/migrate, consumed by `fe/` and third parties — one optional dependency. Today's exports: final stops only (`exportTokens` / `exportDTCG` in `theme.ts`); share links carry gzip'd full snapshots (`documents/share.ts`). A ramp bundle would sit between those — recipe + optional resolved output.
30. **Modular color engine (npm-installable, UI-free)** — extract the computation layer so integrators can `npm install` the ramp/color pipeline without SvelteKit or WebGL. **Natural core today:** `lib/color/` (math, gamuts, Bradford CAT, interp spaces, gamut map, boundary projection) is already pure TS with no app state. **Ramp pipeline** (`buildRamp` / `finalizeRamp` in `engine/theme.ts`) is the integration surface but is coupled to `ExplorerState`, `DerivedMatrices`, and 3D `world` coords on `ThemeStop`. **Target API:** accept anchors + per-list `ListPipeline` + active gamut (+ optional display gamut) → return linear-sRGB / OKLch stops, hi-res curves, and expand grids; integrators choose **live evaluation** on demand or **runtime bake** into lookup tables for indexed access. **Packaging options:** (a) monorepo package consumed by `fe/` via workspace (`packages/engine`); (b) publish `@saabi/colorlab-engine` (or similar) — pairs with #29 interchange format; UI app becomes a thin shell over the same module. **Out of scope for the package:** WebGL renderer, picking, camera, document UI — those stay in `fe/`. PNG strip encoding (#9) is a natural export helper on the same module.

---

## Open work

### Surface constraint & generalized gamut projection

**Plan:** [`surface-constraint-gamut-projection-plan.md`](surface-constraint-gamut-projection-plan.md)
**Status:** Phases 1–4C implemented or documented. The next work is architectural realignment around Active gamut / Display gamut, not more sRGB-export-target UI.

| Phase | Description | Status |
|-------|-------------|--------|
| 4 (UI) | Adaptive-alpha + focus-L controls; status copy / preset polish | Controls shipped (`047bebc`, `d17c845`, `92902c8`); minor copy/preset polish remaining |
| 5 | Matrix-based boundary solver for Active gamut / Display gamut relationships | Not started |
| 6 | Explorer Display-gamut classification (shader first) | Not started |
| 6+ | Projected Explorer display mode | After classification |
| 7 | Gamut compression — smooth region before boundary | Not started |
| 8 | GPU/codegen evaluation | Criteria-gated |

**Open questions (unresolved):** see plan §Open Questions — includes radial shell vs clips, display comparison placement (node vs `Display`), reference shell auto-switch, projected solid vs overlay, neutral-axis hue.

Resolved roadmap direction: Active gamut is the working/export intent; Display gamut is the physical display target and belongs to local preferences / calibration.

### Gamut Map — parameter model

Core unification (`finalizeRamp`, terminal `gamutMap`, `PlacePolicy` stages) is **shipped**, including `gamutMapParams`. **Decision: keep it as a single shared terminal step** (not per-list). Output is always to the **active colorspace**, with **one** OOG method choice for all ramps/colors. The analytic mapper is sRGB-specific, so non-sRGB active targets await the generic target-gamut solver (surface-constraint Phase 5); when Active gamut = sRGB (default) this is today's behavior. It must never target the **Display** gamut (that is the Explorer display-mapping role).

### Color-space roles and source storage

**Plan:** [`color-space-role-architecture.md`](color-space-role-architecture.md)
**Status:** Direction documented and validated against the code. Implementation not started.

Key points:

- source lists stay in `srgbLin`, documented as the canonical gamut-independent colorimetric anchor (≡ XYZ D65); the XYZ-D65 migration is **deferred** (representational only);
- add chromatic adaptation (Bradford) for non-D65 active/display whites — currently absent;
- catalog known/sourceable observer datasets, XYZ-like spaces, locus curves/surfaces, and chromaticity diagrams; audit/correct the current LMS/spectral evaluator against them; then add registries before relying on advanced spectral/chromaticity diagnostics — **registries shipped**; see [`lms-fundamentals-chromaticity-plan.md`](lms-fundamentals-chromaticity-plan.md) and [`cone-fundamentals-chromaticity-math-audit.md`](cone-fundamentals-chromaticity-math-audit.md);
- Display gamut profiles live in `localStorage`, not shared document state;
- Active gamut and Display gamut should become global Color Context controls, not Explorer pipeline controls; Explorer keeps reference shell and display-mapping/clipping controls;
- each source list owns independent pipeline settings (per-list pipelines) — **shipped** in schema v13 (see [`per-list-pipeline-plan.md`](per-list-pipeline-plan.md));
- main curve and extension constraints are independent — **shipped**.

### Pipeline-driven parameter UI

**Plan:** [`pipeline-node-ui-proposal.md`](pipeline-node-ui-proposal.md)  
**Status:** Phase 1 (read-only rail + node-ordered sidebar sections with status/affects/enablement) **shipped**; OOG count badges on Interpolate/Gamut Map **shipped**. Phases 2–4 (node-scoped panels, full pipeline-driven layout, mobile) and raw/final swatch preview remain.

Key decisions: control vs informational nodes; canonical node set; `affects` badges (not lane/scope combos); ramp nodes disabled until sources exist; `selectedNode` in session only; destination-gamut warnings.

Phase 2 note: the Gamut/Color-Context panel split is blocked on the colorimetry work and documented in [`gamut-step-organization-observations.md`](gamut-step-organization-observations.md) — extract World/Clip/Vision/Display panels first; leave Gamut/Color Context for last.

### Undo/redo — transaction labels ✅ shipped

v1 plus transaction labels are done: a one-shot `history.hintLabel` lets discrete actions (point/list/ramp edits, gamut and world-space changes) record specific labels, which the debounced observer prefers over its generic `'Edit parameters'`. **Design:** [`undo-redo-state-design.md`](undo-redo-state-design.md).

### Document sharing & ingestion

**Plan:** [`state-sharing-ingestion-plan.md`](state-sharing-ingestion-plan.md)  
**Status:** v1 shipped — Save to file, Share (link + JSON), Import (file · URL · paste · `#s=…` hash). Deferred: `?src=` deep-link, shared toast system, File System Access API.

**Ramp interchange (research):** v1 shares the full `ParameterSnapshot` (explorer + camera + theme). Export emits **final stops** as CSS or DTCG JSON (`theme.ts`); DTCG uses `$extensions['gamut.explorer']` for oklch/OOG metadata. A slimmer **ramp bundle** — compact JSON with anchors, per-list `ListPipeline`, and shared `gamutMap` — could be easier for other apps to ingest than a document or than DTCG alone (which has no interpolation model). See priority **#29**; no close npm equivalent found (DTCG parsers ≠ ramp recipes). Delivery options: in-repo schema only, or a first-party npm package for shared parse/format logic.

**Modular engine (research):** The same ramp bundle could feed an **npm-installable engine** (#30) — `lib/color/` plus a UI-free `buildRamp` — so integrators generate interpolated colors live or bake lookup tables at runtime without pulling Svelte/WebGL. `fe/` would depend on the published/workspace package; one implementation, two consumers (app + third parties).

### Ramp export (video / compositor workflow)

**Status:** CSS oklch + DTCG JSON shipped (`ThemeRamp` Export step). **Planned (#9):** **PNG ramp strips** — each row of final colors as a 1×N horizontal sRGB image (one pixel per stop, post gamut-map). One file per source list (Expand off) or per expanded row (`theme.grid`). Primary use: load as a **1D gradient texture** in DaVinci Resolve, TouchDesigner, Resolume, and Fusion (e.g. Text+ glyph fill). Multi-list documents → multiple strips or a zip download. Same color path as `PaletteStrip` / `exportTokens`; implementation via canvas or `OffscreenCanvas` in `theme.ts`.

### UI & appearance

**Status:** Dark (default) and light UI schemes (`:root` / `:root[data-theme='light']` tokens in `app.css`; toggle in Accessibility panel, persisted in `colorlab:preferences`). Viewport surround defaults to dark UI clear color; optional **neutral backdrop** (Oklab L = 0.5) in Viewport preferences. Scrollbars themed via `--scrollbar-*` tokens.

| Item | Notes |
|------|-------|
| ✅ Light color scheme | **Shipped** — second token set + `colorlab:preferences` persistence; light secondary-contrast overrides |
| ✅ Neutral explorer backdrop | **Shipped** — Oklab L = 0.5 WebGL clear + viewport letterbox; Viewport preferences toggle |
| **Glyph-width responsive breakpoints** | **Planned** — classify layout from measured glyph (`ch`) width instead of pixel `max-width` gates (`1024` / `820` / `520` in `app.css`; `NARROW_LAYOUT_MAX_WIDTH` / `MOBILE_LAYOUT_MAX_WIDTH` in `mobile.ts`). Keeps narrow/tablet/mobile modes predictable on real hardware and coherent when Readability font scale changes. Prior art: [`ScreenSensor` in dsp_waifinder](https://github.com/nestauk/dsp_waifinder/blob/dbedf0b5e879838ea15f08fa208493b1ba5ed7dc/fe/src/routes/%2Blayout.svelte#L127) (`$_screen?.classes` from glyph-width sensor). Likely a small in-app width sensor + root/body class hooks; update `isNarrowLayout` / `isMobileLayout` to read the same classification. Pairs with pipeline node UI mobile work (#22). |

### Feature backlog

| Feature | Notes |
|---------|-------|
| ✅ Light UI theme | **Shipped** — dark/light toggle; muted gray light scheme; secondary contrast overrides |
| ✅ Neutral explorer backdrop | **Shipped** — Oklab L = 0.5 viewport surround toggle in Viewport preferences |
| Custom Display Gamut | Wizard UX design before implementation |
| Gradient designer improvements | Builds on existing ramp model |
| ✅ Okhsl/Okhsv picker coordinates | **Shipped** — per-channel H/S/L · H/S/V sliders for the selected stop in `ColorPicker.svelte`. |
| ✅ Observer fundamentals + chromaticity diagrams | **Shipped**. Registries, dataset catalog, reference-validated evaluation, observer-aware CIE xy/uv/u′v′, Oklab/CIELAB opponent-plane views, MacLeod-Boynton 2°, dynamic WebGL shaders/picking support. Audit: [`cone-fundamentals-chromaticity-math-audit.md`](cone-fundamentals-chromaticity-math-audit.md). |
| Glyph-width responsive breakpoints | Replace pixel layout gates with ch-width classification; composes with Readability font scale. See priority #14 and UI & appearance table. |
| PNG ramp strip export | 1×N horizontal sRGB PNG per list/row for Resolve, TouchDesigner, Resolume, Fusion Text+. See #9. |
| Compact ramp interchange / npm package | Anchors + pipeline recipe JSON for third-party apps; optional `@saabi/colorlab-ramp`. See #29. |
| Modular color engine (npm) | UI-free `lib/color` + ramp pipeline; live eval or runtime bake. See #30. |
| Direct xy chromaticity picking | Needs luminance hold policy and active diagram/observer semantics |
| Gamut boundary snap tools | Stop-level UX on top of boundary projection |
| Spectral/chromaticity intensity volume | Optional reference layer; depends on reference-validated observer/fundamentals registry |

Full rationale: [`design-review-unimplemented-features.md`](design-review-unimplemented-features.md).

### Accessibility — follow-ups

Baseline shipped. Remaining: manual visual review; a shared app-level toast/notice (generalize the component-local `gestureStatus` with `aria-live`, reusable by the document/ingest paths — see [`state-sharing-ingestion-plan.md`](state-sharing-ingestion-plan.md) Related separate tasks). **Handoff:** [`accessibility-controls-handoff.md`](accessibility-controls-handoff.md).

---

## Completed plans (reference)

| Plan | Notes |
|------|-------|
| [`3d-space-morphing-plan.md`](3d-space-morphing-plan.md) | Color space morphing |
| [`color-space-shells-review.md`](color-space-shells-review.md) | Chromaticity overlay |
| [`ramp-pipeline-v2-plan.md`](ramp-pipeline-v2-plan.md) | Pipeline stages, `finalizeRamp`, `PlacePolicy` |
| [`picker-and-multilist-plan.md`](picker-and-multilist-plan.md) | Lane picker, multi-list |
| [`saved-state-consolidation-plan.md`](saved-state-consolidation-plan.md) | Document persistence |
| [`sources-panel-layout-plan.md`](sources-panel-layout-plan.md) | Sources panel |
| [`tutorial-consistency-audit-handoff.md`](tutorial-consistency-audit-handoff.md) | Tutorial copy |
| [`gamut-mapping-unification-plan.md`](gamut-mapping-unification-plan.md) | Core terminal-stage unification shipped; plan amended for `ProjectionParams` / `gamutMapParams` follow-up |
| [`3d-space-morphing-plan.md`](3d-space-morphing-plan.md) | Color space morphing (400 ms blend) |
| [`ramp-builder-status-hierarchy-plan.md`](ramp-builder-status-hierarchy-plan.md) | Ramp Builder status hierarchy + substep toggles |
| [`saved-state-consolidation-plan.md`](saved-state-consolidation-plan.md) | Document persistence (`ParameterSnapshot`, registry) |
| [`agent-instructions-centralization-plan.md`](agent-instructions-centralization-plan.md) | Centralized `AGENTS.md` |
| [`state-sharing-ingestion-plan.md`](state-sharing-ingestion-plan.md) | Document Save / Share / Import v1 |
| [`cone-fundamentals-chromaticity-math-audit.md`](cone-fundamentals-chromaticity-math-audit.md) | Diagram math verification (MacLeod-Boynton, opponent-plane views, observer labels) |
| [`lms-fundamentals-chromaticity-plan.md`](lms-fundamentals-chromaticity-plan.md) | Observer/diagram registries (Phases 1–4 shipped) |
