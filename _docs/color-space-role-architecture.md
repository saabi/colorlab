# Color Space Role Architecture

Status: roadmap architecture note.

This document defines the color-space roles that should guide the next pipeline
and persistence changes. It supersedes older wording that treated "export
gamut", "explorer gamut", and "display gamut" as interchangeable.

## Roles

### Active gamut

The active gamut is the working and output-intent gamut.

It should drive:

- the Explorer solid;
- source/picked color in-gamut checks;
- ramp output intent;
- any ramp-side mapping or constraints that keep generated colors valid for the
  chosen working gamut.

The existing `Gamut` selector should be explained, and eventually labelled, as
`Active gamut`.

### World space

World space is the geometric/perceptual coordinate system used to lay colors out
in the Explorer and to support interpolation choices.

Examples:

- RGB cube;
- CIE XYZ;
- CIELAB;
- Oklab;
- luma layout;
- future perceptual spaces.

World space must not be a durable storage format for ramp source colors. It is a
view/interpolation coordinate system.

### Display gamut

The display gamut describes what the current physical display can actually show.

It should drive:

- Explorer display-gamut classification;
- optional active-gamut-to-display-gamut projection/preview;
- calibration workflows;
- colorimetric precision for on-screen visualization.

Display gamut is user/device preference data, not shared document intent. Store
display-gamut profiles in `localStorage`, because users may have multiple
displays and may switch between them without changing the document.

Initial display gamut behavior can remain `sRGB`, but the architecture should
allow:

- built-in profiles such as sRGB, Display P3, Rec.2020;
- manual primary chromaticity + white point entry;
- imported/downloaded profiles from a display database;
- future calibration-derived profiles.

## Ramp Source Storage

Ramp source lists must be stored in an active-gamut-independent colorimetric
space — and **they already are.**

Source anchors are stored as `srgbLin` (linear sRGB). Linear sRGB is a fixed
colorimetric encoding: it is a bijection with `XYZ D65` (the sRGB primaries +
D65 white define the matrix). Storing `srgbLin` is therefore *equivalent* to
storing `XYZ D65` — the two differ only by a fixed 3×3 matrix.

Consequences, verified against the code (`anchorWorld` →
`matrices.toSrgbLin.fromSrgb · srgbLin`, where
`fromSrgb = xyz2rgb_active · srgb2xyz`):

- Switching **Active gamut** does **not** mutate or reinterpret a stored source
  color. The stored `srgbLin` (hence its XYZ) is invariant; only the active-gamut
  RGB coordinates used to place/render it change, and a color may legitimately
  read out-of-gamut in a smaller active gamut.
- Switching **World space** likewise never touches the stored value — world is
  derived for layout/interpolation only.
- `srgbLin` represents wide-gamut picks losslessly as out-of-`[0,1]` linear
  values, so it is not limited to the sRGB cube.

**Decision: keep `srgbLin` as the canonical source format.** The previously
proposed migration to an explicit `XYZ D65` field is **deferred**: it is a
representational relabeling (a fixed matrix away), not a correctness fix, and
does not justify a breaking schema change on its own. The schema-break budget is
better spent on user-visible capability (per-list pipelines). Treat `srgbLin`
**as** the gamut-independent colorimetric anchor. If a future change wants the
canonical field to be literally `XYZ D65` (e.g. for non-RGB-expressible source
colors), batch that schema bump with another breaking change.

Derived values may still be cached at runtime and must never become the
canonical source:

- active-gamut RGB for solid placement and in-gamut checks;
- sRGB/display RGB for preview;
- world coordinates for rendering;
- Oklab/Oklch for interpolation and UI.

## White Point and Chromatic Adaptation

White point must be handled wherever it is needed — for active color spaces and
for the display gamut — in a practical way.

Current state (to be fixed): there is **no chromatic adaptation** in the
pipeline. `gamut2srgbLin = xyz2srgb · rgb2xyz_active` composes pure XYZ matrices
with no white-point bridge. Most built-in gamuts are D65, but `ntsc` uses
Illuminant C and `cie` uses Illuminant E, so colors involving those gamuts are
**not** adapted — they shift incorrectly rather than being mapped between whites.
"`XYZ D65`" as the source reference is therefore only honoured for D65 gamuts
today.

Requirement:

- Adapt between white points using a standard CAT (Bradford is the practical
  default) wherever XYZ is converted between spaces with differing whites:
  - active-gamut conversions when the active white ≠ the source/reference white;
  - active-gamut ↔ **display gamut** conversions (the Display role may have its
    own white, e.g. a calibrated panel);
  - any future custom display / calibration entry that specifies a white point.
- Keep it practical: D65 ↔ D65 (the common case) is identity and must stay a
  no-op; only differing whites incur an adaptation matrix.
- Parity: the CPU pipeline and the GLSL/shader and picking paths must agree, so
  the adaptation matrix belongs in the shared `DerivedMatrices` bundle
  (`uniforms.ts`), not duplicated ad hoc.

This is a prerequisite for trustworthy non-D65 active gamuts and for the Display
role's colorimetric-precision goal.

## UI Placement: Global Color Context vs Pipelines

Active gamut and Display gamut should eventually move out of the Explorer
pipeline into a small global **Color Context** surface.

Rationale:

- **Active gamut** is document-level working/output intent. It drives the
  Explorer solid and the ramp output target, so placing it inside the Explorer
  lane makes it look viewport-only.
- **Display gamut** is user/device preference data. It applies to every on-screen
  preview and should live with local display/profile preferences, not inside a
  document pipeline step.
- **World space** remains an Explorer pipeline step because it is the geometric
  coordinate system used to lay out the active gamut in the 3D view.

Recommended UI shape:

1. Add a global Color Context strip/panel above the Explorer and Ramp lanes:
   Active gamut, Display gamut/profile summary, and warnings when the active
   gamut exceeds the display gamut.
2. Rename/split the current Explorer `Gamut` step after the global move. It
   should keep controls that truly affect the Explorer pipeline:
   - reference shell gamut;
   - chromaticity/spectral overlays;
   - solid opacity and related explorer-only display of the active solid;
   - future "clip/map Explorer view to Display gamut" toggle.
3. Keep **Explorer display-gamut clipping/mapping** inside the Explorer lane.
   That control answers how the active solid is presented through the display
   gamut. It is not the same as selecting the Active gamut or Display profile.

Implementation timing:

- Do **not** move these controls before the role model is ready in copy and
  status badges; otherwise the UI loses the only visible gamut selector.
- Best timing: after chromatic adaptation is implemented (#2 in the roadmap) or
  together with Display gamut preferences/classification. That gives the global
  Color Context enough substance to stand on its own.
- Until then, label/copy can progressively call the current selector "Active
  gamut" while it remains in its existing position.

## Observer and Chromaticity Context

The LMS fundamentals / chromaticity work is related to Color Context, but it is
not another gamut role.

Definitions:

- **Observer model / fundamentals** defines the spectral-to-LMS/XYZ reference:
  which cone fundamentals or CMFs turn wavelengths into tristimulus values.
- **Chromaticity diagram** defines the 2D projection used to visualize
  tristimulus data (`xy`, `u'v'`, future physiological diagrams, etc.).

These settings should not be stored under `theme`, and they should not be owned
by the ramp pipeline. They affect instruments, spectral locus geometry, CVD
math, and future chromaticity picking/reference layers.

Recommended sequencing:

1. First, audit the current default analytical fundamentals evaluator against
   authoritative reference data, keeping accurate analytical segments and
   replacing only the regions/methods that fail error or tail-behavior criteria.
   This does not require document schema changes or new user settings.
2. Next, add `fundamentals.ts` / `diagrams.ts` registries behind the corrected
   default behavior.
3. Expose a chromaticity diagram selector in Explorer Reference / instrument UI
   if it only changes the panel projection.
4. Expose observer-model selection only after CVD matrices, spectrum/LMS panels,
   chromaticity overlays, and picking all agree.

Persistence policy:

- If `observerModel` changes document-level scientific interpretation or CVD
  output, persist it in the document under global color/observer context.
- If `chromaticityDiagram` only changes an instrument view, keep it as local app
  preference or session UI state.
- Do not spend a document schema bump on a visual-only diagram preference.

This work should align with white-point adaptation and display-gamut
classification. The same `DerivedMatrices`/shared-math path should keep CPU,
GPU, picker, and panel behavior in sync.

## Source Lists as Pipeline Instances

Different source lists should eventually own independent ramp pipeline settings.

Each source list should be treated as a pipeline instance with its own:

- interpolation mode and space;
- main curve constraint and projection params;
- placement policy;
- Extend/Expand settings;
- extension constraint and projection params;
- visibility/export metadata.

Global controls can remain as defaults or batch operations:

- new lists inherit the current/default pipeline settings;
- duplicated lists copy both source colors and pipeline settings;
- "apply current settings to all lists" can be an explicit command;
- the active list's controls remain the compact default UI.

This avoids the current restriction where all source lists share one set of
ramp settings.

## Constraint Domains

Main curve constraints and extension constraints should be independent.

- Main curve constraint shapes the path through source anchors.
- Extension constraint shapes generated variants after placement.

Examples:

- main curve follows the active clipped surface, extensions remain constant hue;
- main curve stays free, extensions clamp/project to the active gamut boundary;
- each source list chooses a different pair of constraints.

## Ramp Gamut Mapping

**Decision: keep the terminal ramp `Gamut Map` stage** (shipped: `finalizeRamp`,
`gamutMap`, `gamutMapParams`). It is not being removed.

- **It is a single shared step, not per-list.** Output is always to the **active
  colorspace** (Active gamut), and out-of-gamut colors are reconciled with **one**
  method choice applied to **all** ramps/colors. There is no per-list or
  per-color gamut-map choice.
- Implementation status: the analytic mapper is sRGB-specific, so the active
  target is fully supported only when Active gamut = sRGB (the default). Non-sRGB
  active targets (P3, Rec.2020, …) await the generic target-gamut solver
  (surface-constraint plan Phase 5).
- Main curve / extension constraints (per-list) shape colors earlier; the shared
  terminal step is the final reconciliation into the active gamut.
- It must never target the **Display** gamut — display reconciliation is the
  Explorer display-mapping role, separate from ramp output/export. Export
  *encoding* for wide-gamut output is a downstream concern, not this step.

## Explorer Display Mapping

Explorer display mapping is independent from ramp output mapping.

Purpose:

- show how the Active gamut relates to the user's Display gamut;
- classify colors that cannot be shown colorimetrically on the current display;
- optionally preview active-gamut-to-display-gamut clipping/projection.

Recommended order:

1. display-gamut profile storage in `localStorage`;
2. shader classification of Active gamut against Display gamut;
3. intersection/outlier visualization;
4. optional projected display preview.

This is a display-accuracy feature, not an export-gamut feature.
