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

- **3D explorer** — color space morphing (400 ms blend), spectral locus chromaticity overlay, cylindrical saturation/chroma cutaway (`cylSlice` / `cylRad`), true cylinder clipping outline, tessellation up to 512 with scaled outlines
- **Theme ramp pipeline** — declarative stage chain, `PlacePolicy` recompute stages, terminal `gamutMap` via `finalizeRamp`, surface constraint Phases 1–4 backend (`boundary-project.ts`, `SurfaceProjectionParams`)
- **Undo/redo v1** — debounced `ParameterSnapshot` history
- **Instruments** — conservative spectrum wavelength marker (suppressed when angular distance to locus > 0.06 rad)
- **Accessibility** — skip link, landmarks, keyboard baseline, text readability preferences (font scale, contrast, line height)
- **Layout & polish** — tablet drawer (≤1024px), full mobile layout (≤820px), floor grid underside, header isotype, app preferences in `localStorage`
- **Open source** — MIT license, CI, CONTRIBUTING / RELEASING docs, dual GitHub/GitLab remotes
- **Document sharing & ingestion v1** — Save to file, Share (copy link · copy JSON), Import (file · URL · paste · `#s=…` hash); client-side only via `parseSnapshot`
- **Themed scrollbars** — app-wide dark-UI scrollbar tokens (`scrollbar-color` + `::-webkit-scrollbar`) in `app.css`

---

## Priority summary

Aligned with the **recommended next order** in [`surface-constraint-gamut-projection-plan.md`](surface-constraint-gamut-projection-plan.md) and [`gamut-mapping-unification-plan.md`](gamut-mapping-unification-plan.md). Projection math and target-gamut generalization: surface-constraint plan is canonical; gamut-unification plan covers terminal-stage policy and UI.

### Architecture alignment

1. **Color-space role cleanup** — reflect the three-role model in UI/docs: Active gamut = working/export intent, World space = layout/interpolation coordinate system, Display gamut = physical display capability. Includes documenting that `srgbLin` already **is** the gamut-independent colorimetric anchor (linear sRGB ↔ XYZ D65 is a fixed bijection); the proposed XYZ-D65 source-storage migration is **deferred** (representational relabeling, not a correctness fix — not worth a schema break). See [`color-space-role-architecture.md`](color-space-role-architecture.md).
2. **White point & chromatic adaptation** — add a standard CAT (Bradford) wherever whites differ, for active color spaces and the display gamut; D65↔D65 stays a no-op. Today there is **no** adaptation, so non-D65 gamuts (NTSC = Illuminant C, CIE = Illuminant E) and any calibrated display white render wrong. Put the adaptation matrix in the shared `DerivedMatrices` bundle for CPU/GPU/picking parity.
3. **Per-list ramp pipeline instances** — each source list owns its own interpolation, placement, extension, and constraint settings (the engine already computes per-list rows; the settings are still global). The architecture payoff; needs a schema bump (v12 → v13). **Plan:** [`per-list-pipeline-plan.md`](per-list-pipeline-plan.md).
4. **Separate main-curve and extension constraints** — Interpolate constraints and Extend/Expand constraints independently configurable, per source list. Batched into #3's schema bump (see plan); wiring lands in a later phase.
5. **Display gamut preferences** — store display profiles/calibration in `localStorage`; users may have multiple displays. Initial default remains sRGB. Depends on #2 for correct white handling.

### Small scope, high value (projection params track)

6. **Target model copy cleanup** — recent UI names sRGB as the fixed Gamut Map target, but roadmap direction is Active gamut for ramp output and Display gamut for Explorer display mapping. Update UI copy as the implementation catches up.
7. **Explorer display-gamut classification** — classify Active gamut against Display gamut (shader first) before projected display preview.

### Small scope, polish

8. **Undo transaction labels** — named `scheduleCapture` / `capture` at high-value call sites. See [`undo-redo-state-design.md`](undo-redo-state-design.md).

### Medium scope

9. **Light UI color scheme** — add a **light** theme alongside today's dark (`:root` CSS variables in `app.css`). Persist in `colorlab:preferences` (same pattern as auto-rotate / auto-reduce). Panels, chrome, and instruments should stay readable; WebGL viewport may keep a separate backdrop policy (see #10).
10. **Neutral explorer backdrop** — colorimetrically neutral surround for the 3D viewport: **Oklab L = 0.5** (a\* = b\* = 0) for WebGL clear color and/or the letterbox around the canvas, so the solid is judged without UI chroma bias. **Placement:** either a third UI scheme or — leaner — a toggle in the sidebar footer **Viewport preferences** panel (`LeftControls`, beside View aids / Performance), persisted in app preferences (not the document). Does not change the color solid itself.
11. **Okhsl/Okhsv picker coordinates** — H/S/L or H/S/V sliders for the selected ramp stop (`okhsv.ts` exists).
12. **Direct xy chromaticity picking** — click/drag in the xy panel; define which Y/L is held constant.
13. **Gamut boundary snap tools** — stop-level UX on top of existing Oklab boundary projection.

### Large / design-first

14. **Generic active/display gamut solver** — matrix-based boundary solver for Active gamut and Display gamut relationships; keep sRGB analytic fast path where useful.
15. **Custom Display Gamut** — calibration wizard UX before implementation.
16. **Gradient designer improvements** — editable stops, per-stop OKLCh/Okhsl, CSS gradient preview.
17. **Pipeline node UI (Phases 2–4)** — node-scoped parameter panel, full pipeline-driven layout, mobile optimization.

### Research / deferred

18. Gamut compression — display/ramp policy after Active/Display gamut model stabilizes
19. Projected Explorer display overlay vs geometry replacement (open question)
20. Spectral/chromaticity intensity volume
21. GPU/codegen evaluation (surface plan Phase 8; criteria-gated)
22. WebGPU, HDR, EDID defaults, Color Accumulator, in-scene text — see design review

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
- Display gamut profiles live in `localStorage`, not shared document state;
- each source list owns independent pipeline settings (per-list pipelines) — the next architecture build, behind a schema bump (see [`per-list-pipeline-plan.md`](per-list-pipeline-plan.md));
- main curve and extension constraints are independent.

### Pipeline-driven parameter UI

**Plan:** [`pipeline-node-ui-proposal.md`](pipeline-node-ui-proposal.md)  
**Status:** Design proposal with authoritative review revisions; ready for implementation planning.

Key decisions: control vs informational nodes; canonical node set; `affects` badges (not lane/scope combos); ramp nodes disabled until sources exist; `selectedNode` in session only; destination-gamut warnings; near-term OOG badges and raw/final preview.

First implementation target: read-only navigation rail with 12 initial nodes (Gamut, World, Clip, CVD, Display, Pick, Interpolate, Adjust, Gamut Map, Export, View, Performance).

### Undo/redo — transaction labels

v1 shipped; production still uses generic `'Edit parameters'` for debounced captures. **Plan:** [`undo-redo-state-design.md`](undo-redo-state-design.md).

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
| Direct xy chromaticity picking | Needs luminance hold policy |
| Gamut boundary snap tools | Stop-level UX on top of boundary projection |
| Spectral/chromaticity intensity volume | Optional reference layer |

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
| [`state-sharing-ingestion-plan.md`](state-sharing-ingestion-plan.md) | Document Save / Share / Import v1 |
