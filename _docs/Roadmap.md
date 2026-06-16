# Roadmap

Curated priorities and open work for COLOR LAB. Detailed design lives in linked plan docs under `_docs/`.

For the full feature catalog (including lower-priority ideas), see [`design-review-unimplemented-features.md`](design-review-unimplemented-features.md).

For the current color-space role model, see [`color-space-role-architecture.md`](color-space-role-architecture.md). It defines **Active gamut**, **World space**, **Display gamut**, gamut-independent source storage, and per-list pipeline direction.

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

- **Observer, XYZ, locus & chromaticity registries** — catalog of 32 observer datasets with lazy-loaders and linear interpolation. Dynamic observer conversion matrix generation at runtime for WebGL shaders, CVD simulation, and inspector picking. Dynamic locus range, autofit bounding boxes, CIE xy/uv/u′v′ diagrams with observer-aware labels, Oklab/CIELAB fixed-lightness opponent-plane views, and calibrated MacLeod-Boynton 2° (table-backed locus + fixed source-basis projection/fill). LMS panel names the active observer. **Plans:** [`lms-fundamentals-chromaticity-plan.md`](lms-fundamentals-chromaticity-plan.md), **audit:** [`cone-fundamentals-chromaticity-math-audit.md`](cone-fundamentals-chromaticity-math-audit.md).
- **3D explorer** — color space morphing (400 ms blend), spectral locus chromaticity overlay, cylindrical saturation/chroma cutaway (`cylSlice` / `cylRad`), true cylinder clipping outline, tessellation up to 512 with scaled outlines
- **Theme ramp pipeline** — declarative stage chain, `PlacePolicy` recompute stages, terminal `gamutMap` via `finalizeRamp`, surface constraint Phases 1–4 backend (`boundary-project.ts`, `SurfaceProjectionParams`)
- **Undo/redo v1** — debounced `ParameterSnapshot` history
- **Instruments** — conservative spectrum wavelength marker (suppressed when angular distance to locus > 0.06 rad)
- **Accessibility** — skip link, landmarks, keyboard baseline, text readability preferences (font scale, contrast, line height)
- **Layout & polish** — tablet drawer (≤1024px), full mobile layout (≤820px), floor grid underside, header isotype, app preferences in `localStorage`
- **Open source** — MIT license, CI, CONTRIBUTING / RELEASING docs, dual GitHub/GitLab remotes
- **Document sharing & ingestion v1** — Save to file, Share (copy link · copy JSON), Import (file · URL · paste · `#s=…` hash); client-side only via `parseSnapshot`
- **Themed scrollbars** — app-wide dark-UI scrollbar tokens (`scrollbar-color` + `::-webkit-scrollbar`) in `app.css`
- **Per-list ramp pipelines** (schema v13) — each source list owns its interpolation / placement / expand / constraint settings; independent **main-curve and extension constraints** (#3 + #4); shared terminal `gamutMap` targets the active colorspace. Multi-list UX: add-clones-active, duplicate, "apply to all," divergence cue. **Plan:** [`per-list-pipeline-plan.md`](per-list-pipeline-plan.md)
- **Pipeline rail (node UI Phase 1)** — read-only `PipelineRail` map + status dashboard over the `PIPELINE_NODES` registry; click a step to open + scroll its sidebar controls; arrow-key roving. **Plan:** [`pipeline-node-ui-proposal.md`](pipeline-node-ui-proposal.md)
- **Named undo/redo transaction labels** — one-shot `history.hintLabel` so point/list/ramp edits and gamut/world-space changes show specific labels (e.g. "Undo Add point"). **Design:** [`undo-redo-state-design.md`](undo-redo-state-design.md)
- **Ramp Builder polish** — status hierarchy (parent = list context, Sources = active-list points), per-substep enable toggles in sidebar headers. **Plan:** [`ramp-builder-status-hierarchy-plan.md`](ramp-builder-status-hierarchy-plan.md)

---

## Priority summary

Aligned with the **recommended next order** in [`surface-constraint-gamut-projection-plan.md`](surface-constraint-gamut-projection-plan.md) and [`gamut-mapping-unification-plan.md`](gamut-mapping-unification-plan.md). Projection math and target-gamut generalization: surface-constraint plan is canonical; gamut-unification plan covers terminal-stage policy and UI.

### Architecture alignment

1. **Color-space role cleanup** — reflect the three-role model in UI/docs: Active gamut = working/export intent, World space = layout/interpolation coordinate system, Display gamut = physical display capability. Includes a planned **global Color Context** surface: move Active gamut and Display gamut/profile selection out of the Explorer pipeline when chromatic adaptation / display-gamut work gives that surface real behavior. The Explorer lane keeps reference shell and future Explorer display-gamut clipping/mapping controls. Also documents that `srgbLin` already **is** the gamut-independent colorimetric anchor (linear sRGB ↔ XYZ D65 is a fixed bijection); the proposed XYZ-D65 source-storage migration is **deferred** (representational relabeling, not a correctness fix — not worth a schema break). See [`color-space-role-architecture.md`](color-space-role-architecture.md).
2. **White point & chromatic adaptation** — add a standard CAT (Bradford) wherever whites differ, for active color spaces and the display gamut; D65↔D65 stays a no-op. Today there is **no** adaptation, so non-D65 gamuts (NTSC = Illuminant C, CIE = Illuminant E) and any calibrated display white render wrong. Put the adaptation matrix in the shared `DerivedMatrices` bundle for CPU/GPU/picking parity.
3. ✅ **Observer, XYZ, locus & chromaticity dataset registry** — **shipped**. Registry of 32 observer datasets with dynamic matrix generation for WebGL rendering, CVD simulation, and picking. Dynamic locus range, autofit bounding boxes, observer-aware CIE xy/uv/u′v′ labels, Oklab/CIELAB opponent-plane views, and calibrated MacLeod-Boynton 2°. Plans: [`lms-fundamentals-chromaticity-plan.md`](lms-fundamentals-chromaticity-plan.md), audit: [`cone-fundamentals-chromaticity-math-audit.md`](cone-fundamentals-chromaticity-math-audit.md).
4. ✅ **Per-list ramp pipeline instances** — **shipped** (schema v13). Each source list owns its interpolation / placement / expand / constraint settings; shared terminal `gamutMap`. **Plan:** [`per-list-pipeline-plan.md`](per-list-pipeline-plan.md).
5. ✅ **Separate main-curve and extension constraints** — **shipped** with #4: `pipeline.main` and `pipeline.extension` are independent (engine + UI).
6. **Display gamut preferences + Color Context UI** — store display profiles/calibration in `localStorage`; users may have multiple displays. Initial default remains sRGB. Depends on #2 for correct white handling and should share the global Color Context surface with future observer/fundamentals settings from #3. This is the preferred moment to move Display gamut out of the Explorer pipeline.

### Small scope, high value (projection params track)

7. **Target model copy cleanup** — recent UI names sRGB as the fixed Gamut Map target, but roadmap direction is Active gamut for ramp output and Display gamut for Explorer display mapping. Update UI copy as the implementation catches up.
8. **Explorer display-gamut classification** — classify Active gamut against Display gamut (shader first) before projected display preview. Whether to clip/map the Explorer view to Display gamut belongs in the Explorer pipeline; selecting Active/Display gamuts does not.

### Small scope, polish

9. ✅ **Undo transaction labels** — **shipped**: one-shot `history.hintLabel(label)` that the debounced observer prefers; labeled point/list/ramp edits (ThemeRamp + Viewport) and gamut/world-space changes. See [`undo-redo-state-design.md`](undo-redo-state-design.md).

### Medium scope

10. **Light UI color scheme** — add a **light** theme alongside today's dark (`:root` CSS variables in `app.css`). Persist in `colorlab:preferences` (same pattern as auto-rotate / auto-reduce). Panels, chrome, and instruments should stay readable; WebGL viewport may keep a separate backdrop policy (see #11).
11. **Neutral explorer backdrop** — colorimetrically neutral surround for the 3D viewport: **Oklab L = 0.5** (a\* = b\* = 0) for WebGL clear color and/or the letterbox around the canvas, so the solid is judged without UI chroma bias. **Placement:** either a third UI scheme or — leaner — a toggle in the sidebar footer **Viewport preferences** panel (`LeftControls`, beside View aids / Performance), persisted in app preferences (not the document). Does not change the color solid itself.
12. ✅ **Pipeline node UI (Phase 1)** — **shipped**: `PipelineRail.svelte` (read-only map + status dashboard) over the `PIPELINE_NODES` registry; clicking a step opens + scrolls its sidebar controls; arrow-key roving on the rail. Sidebar already renders node-ordered sections with status/affects/enablement. See [`pipeline-node-ui-proposal.md`](pipeline-node-ui-proposal.md).
13. **OOG badges + raw/final preview** — OOG count badges on Interpolate/Gamut Map pipeline nodes **shipped**; before/after stop swatch diff preview on Gamut Map/Export remains open.
14. **Okhsl/Okhsv picker coordinates** — H/S/L or H/S/V sliders for the selected ramp stop (`okhsv.ts` exists).
15. **Direct xy chromaticity picking** — click/drag in the xy panel; define which Y/L is held constant and which chromaticity diagram/observer is active. Depends on the diagram registry in #3.
16. **Gamut boundary snap tools** — stop-level UX on top of existing Oklab boundary projection.

### Large / design-first

17. **Generic active/display gamut solver** — matrix-based boundary solver for Active gamut and Display gamut relationships; keep sRGB analytic fast path where useful.
18. **Custom Display Gamut** — calibration wizard UX before implementation.
19. **Gradient designer improvements** — editable stops, per-stop OKLCh/Okhsl, CSS gradient preview.
20. **Pipeline node UI (Phases 2–4)** — node-scoped parameter panel, full pipeline-driven layout, mobile optimization. **Note:** the Gamut/Color-Context split is blocked on the colorimetry work and documented in [`gamut-step-organization-observations.md`](gamut-step-organization-observations.md) — extract World/Clip/Vision/Display panels first; leave Gamut/Color Context for last.

### Research / deferred

21. Gamut compression — display/ramp policy after Active/Display gamut model stabilizes
22. Projected Explorer display overlay vs geometry replacement (open question)
23. Spectral/chromaticity intensity volume — depends on the observer/fundamentals registry (**registry shipped**; volume overlay still open)
24. GPU/codegen evaluation (surface plan Phase 8; criteria-gated)
25. WebGPU, HDR, EDID defaults, Color Accumulator, in-scene text — see design review
26. **Additional MacLeod-Boynton / LMS-ratio diagram modes** — only with source-backed tables or explicit normalization policy per fundamentals dataset; an active-observer LMS ratio view would be a separate, honestly labeled mode (not “MacLeod-Boynton”). **Audit:** [`cone-fundamentals-chromaticity-math-audit.md`](cone-fundamentals-chromaticity-math-audit.md) §Future Work.

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

### UI & appearance

**Status:** Dark UI only (`app.css` `:root` tokens; WebGL `clearColor` ≈ `#0a0a0b`). Scrollbars themed via `--scrollbar-*` tokens. No light theme switcher yet.

| Item | Notes |
|------|-------|
| Light color scheme | Second token set + `colorlab:preferences` persistence |
| Neutral explorer backdrop | Oklab L 0.5 surround; prefer sidebar-footer **Viewport preferences** toggle over a full third scheme unless light/dark both need it |

Open question: should neutral backdrop apply only inside the WebGL canvas letterbox, or also replace the dark UI chrome when enabled?

### Feature backlog

| Feature | Notes |
|---------|-------|
| Light UI theme | Alongside existing dark |
| Neutral explorer backdrop | Oklab L 0.5 viewport surround; policies-panel option |
| Custom Display Gamut | Wizard UX design before implementation |
| Gradient designer improvements | Builds on existing ramp model |
| Okhsl/Okhsv picker coordinates | Sliders for selected stop only |
| ✅ Observer fundamentals + chromaticity diagrams | **Shipped**. Registries, dataset catalog, reference-validated evaluation, observer-aware CIE xy/uv/u′v′, Oklab/CIELAB opponent-plane views, MacLeod-Boynton 2°, dynamic WebGL shaders/picking support. Audit: [`cone-fundamentals-chromaticity-math-audit.md`](cone-fundamentals-chromaticity-math-audit.md). |
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
