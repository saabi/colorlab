# Roadmap

Curated priorities and open work for COLOR LAB. Detailed design lives in linked plan docs under `_docs/`.

For the full feature catalog (including lower-priority ideas), see [`design-review-unimplemented-features.md`](design-review-unimplemented-features.md).

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

- **3D explorer** — color space morphing (400 ms blend), spectral locus chromaticity overlay, cylindrical saturation/chroma cutaway (`cylSlice` / `cylRad`), true cylinder clipping outline, tessellation up to 512 with scaled outlines
- **Theme ramp pipeline** — declarative stage chain, `PlacePolicy` recompute stages, terminal `gamutMap` via `finalizeRamp`, surface constraint Phases 1–4 backend (`boundary-project.ts`, `SurfaceProjectionParams`)
- **Undo/redo v1** — debounced `ParameterSnapshot` history
- **Instruments** — conservative spectrum wavelength marker (suppressed when angular distance to locus > 0.06 rad)
- **Accessibility** — skip link, landmarks, keyboard baseline, text readability preferences (font scale, contrast, line height)
- **Layout & polish** — tablet drawer (≤1024px), full mobile layout (≤820px), floor grid underside, header isotype, app preferences in `localStorage`
- **Open source** — MIT license, CI, CONTRIBUTING / RELEASING docs, dual GitHub/GitLab remotes

---

## Priority summary

Aligned with the **recommended next order** in [`surface-constraint-gamut-projection-plan.md`](surface-constraint-gamut-projection-plan.md) and [`gamut-mapping-unification-plan.md`](gamut-mapping-unification-plan.md). Projection math and target-gamut generalization: surface-constraint plan is canonical; gamut-unification plan covers terminal-stage policy and UI.

### Small scope, high value (projection params track)

1. **Surface Projection UI polish** — alpha preset chips (`0.05` / `0.5` / `5.0`), lightness-preserving ↔ compression status copy, clearer path-vs-export help. Phase 4 backend exists; UI is the remainder.
2. **`gamutMapParams`** — separate persisted object with the same `ProjectionParams` shape as surface projection (not a shared field). Defaults must preserve current output.
3. **Advanced gamut mapping UI** — same alpha presets/status as surface projection; shown only when the selected method uses alpha.
4. **Pipeline node status + help cleanup** — Interpolate and Gamut Map statuses reflect params (e.g. `Oklab projection / α 0.05`); help distinguishes path shape vs exported colors.

### Small scope, polish

5. **Undo transaction labels** — named `scheduleCapture` / `capture` at high-value call sites. See [`undo-redo-state-design.md`](undo-redo-state-design.md).

### Medium scope

6. **Pipeline node UI (Phase 1)** — static read-only navigation rail; canonical node set per [`pipeline-node-ui-proposal.md`](pipeline-node-ui-proposal.md). `All` remains the primary multi-step surface.
7. **Destination-gamut warnings + OOG badges + raw/final preview** — warn when explorer gamut ≠ export target; OOG badges on Interpolate/Gamut Map; before/after stop preview on Gamut Map/Export (near-term items from pipeline UI proposal).
8. **Okhsl/Okhsv picker coordinates** — H/S/L or H/S/V sliders for the selected ramp stop (`okhsv.ts` exists).
9. **Direct xy chromaticity picking** — click/drag in the xy panel; define which Y/L is held constant.
10. **Gamut boundary snap tools** — stop-level UX on top of existing Oklab boundary projection.

### Large / design-first

11. **Surface constraint Phase 5** — generic target-gamut solver (P3/Rec.2020); keep sRGB analytic fast path. Parameterize sRGB first; do not combine with step 2–3 above.
12. **Surface constraint Phase 6** — Explorer display-gamut **classification** (shader); projected display mode only after classification is clear.
13. **Custom Display Gamut** — calibration wizard UX before implementation.
14. **Gradient designer improvements** — editable stops, per-stop OKLCh/Okhsl, CSS gradient preview.
15. **Pipeline node UI (Phases 2–4)** — node-scoped parameter panel, full pipeline-driven layout, mobile optimization.

### Research / deferred

16. Gamut compression (surface plan Phase 7) — terminal ramp/export policy only
17. Projected Explorer display overlay vs geometry replacement (open question)
18. Spectral/chromaticity intensity volume
19. GPU/codegen evaluation (surface plan Phase 8; criteria-gated)
20. WebGPU, HDR, EDID defaults, Color Accumulator, in-scene text — see design review

---

## Open work

### Surface constraint & generalized gamut projection

**Plan:** [`surface-constraint-gamut-projection-plan.md`](surface-constraint-gamut-projection-plan.md)  
**Status:** Phases 1–4 backend/state implemented. Phase 4 UI polish and steps 2–4 above are the immediate next work before Phase 5.

| Phase | Description | Status |
|-------|-------------|--------|
| 4 (UI) | Alpha presets, status copy, Advanced disclosure polish | Backend done; UI pending |
| 5 | Matrix-based boundary solver for P3/Rec.2020 / export gamut | Not started |
| 6 | Explorer display-gamut classification (shader first) | Not started |
| 6+ | Projected Explorer display mode | After classification |
| 7 | Gamut compression — smooth region before boundary | Not started |
| 8 | GPU/codegen evaluation | Criteria-gated |

**Open questions (unresolved):** see plan §Open Questions — includes radial shell vs clips, Oklab projection target gamut, export vs active gamut, display comparison placement (node vs `Display`), reference shell auto-switch, projected solid vs overlay, neutral-axis hue.

### Gamut Map — parameter model

Core unification (`finalizeRamp`, terminal `gamutMap`, `PlacePolicy` stages) is **shipped**. Remaining work follows the amended [`gamut-mapping-unification-plan.md`](gamut-mapping-unification-plan.md): introduce `gamutMapParams` (same `ProjectionParams` shape as surface projection, stored separately), then Advanced UI and pipeline statuses. Target gamut beyond sRGB deferred to surface plan Phase 5.

### Pipeline-driven parameter UI

**Plan:** [`pipeline-node-ui-proposal.md`](pipeline-node-ui-proposal.md)  
**Status:** Design proposal with authoritative review revisions; ready for implementation planning.

Key decisions: control vs informational nodes; canonical node set; `affects` badges (not lane/scope combos); ramp nodes disabled until sources exist; `selectedNode` in session only; destination-gamut warnings; near-term OOG badges and raw/final preview.

First implementation target: read-only navigation rail with 12 initial nodes (Gamut, World, Clip, CVD, Display, Pick, Interpolate, Adjust, Gamut Map, Export, View, Performance).

### Undo/redo — transaction labels

v1 shipped; production still uses generic `'Edit parameters'` for debounced captures. **Plan:** [`undo-redo-state-design.md`](undo-redo-state-design.md).

### Feature backlog

| Feature | Notes |
|---------|-------|
| Custom Display Gamut | Wizard UX design before implementation |
| Gradient designer improvements | Builds on existing ramp model |
| Okhsl/Okhsv picker coordinates | Sliders for selected stop only |
| Direct xy chromaticity picking | Needs luminance hold policy |
| Gamut boundary snap tools | Stop-level UX on top of boundary projection |
| Spectral/chromaticity intensity volume | Optional reference layer |

Full rationale: [`design-review-unimplemented-features.md`](design-review-unimplemented-features.md).

### Accessibility — follow-ups

Baseline shipped. Remaining: manual visual review; `aria-live` for viewport `gestureStatus` toasts. **Handoff:** [`accessibility-controls-handoff.md`](accessibility-controls-handoff.md).

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
