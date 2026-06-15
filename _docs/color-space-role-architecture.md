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
