# Pipeline Popup Content Plan

Status: implementation plan.

## Design Review Revisions (authoritative)

- **Don't restate "affects/does-not-affect" as free prose in every entry — it rots.** Derive a single `affects` badge per node from `pipeline-nodes.ts` metadata, and keep only a short, stage-specific "does not affect" caveat where it genuinely prevents a misconception (e.g., gamut map vs the 3D solid). When a feature later changes stages (e.g., gamut map targeting the active gamut), the badge updates in one place instead of across many popups.
- **Make removal of legacy help a definite step, grep-gated.** `SidebarGroupId` / `SIDEBAR_HELP` (`colorModel`, `clipping`, `theme`, `display`, `performance`) are now unreferenced by node-scoped panels; delete them once `grep -r` confirms no consumer, rather than keeping them "temporarily."
- **`pipelineWorld` copy fix (below):** world space changes where colors are *displayed*, not stored anchor values — do not say it affects "ramp anchor placement."
- **Destination-gamut note:** `pipelineGamutMap` and `pipelineExport` should state the destination gamut and that it may differ from the explorer gamut.

## Problem

The pipeline-node UI now separates parameters by process step, but the help popup content still mostly uses the old broad sidebar IDs:

- `colorModel`
- `clipping`
- `display`
- `theme`
- `performance`

That means distinct panels such as `Pick`, `Interpolate`, `Adjust`, `Gamut map`, and `Export` can show the same generic `Theme` explanation. The popups no longer duplicate visually, but the content still does not teach the process step the user clicked.

## Goal

Each `?` popup should explain the selected panel's exact pipeline role:

1. What enters this stage.
2. What this stage changes.
3. What exits this stage.
4. Which controls affect this stage.
5. What this stage does not affect.
6. Where it sits relative to upstream and downstream nodes.

The text should be concise enough to read inside a popup. Longer conceptual material should remain in docs or reference links.

## Help ID Model

Replace broad sidebar-only help IDs with node-specific IDs.

Recommended type split:

```ts
export type InspectorPanelId = 'transfer' | 'cones' | 'xy' | 'values';

export type PipelineHelpId =
  | 'pipelineGamut'
  | 'pipelineWorld'
  | 'pipelineClip'
  | 'pipelineVision'
  | 'pipelineDisplay'
  | 'pipelinePick'
  | 'pipelinePoints'
  | 'pipelineInterpolate'
  | 'pipelineAdjust'
  | 'pipelineGamutMap'
  | 'pipelineExport'
  | 'pipelineView'
  | 'pipelinePerformance';

export type HelpId = InspectorPanelId | PipelineHelpId;
```

The old IDs can stay temporarily as aliases during migration, but `LeftControls.svelte` should stop assigning them to node-scoped panels.

## Content Template

Each help entry should use this structure:

```ts
{
  title: 'Short panel name',
  summary: 'One direct sentence describing the stage.',
  details: [
    'Input: ...',
    'Changes: ...',
    'Output: ...',
    'Does not affect: ...'
  ],
  sources: [...]
}
```

Use `Input`, `Changes`, `Output`, and `Does not affect` labels inside the paragraph text instead of adding new UI affordances. That keeps the current `PanelHelp.svelte` component usable.

## Proposed Popup Content

### `pipelineGamut`

Title: `Gamut / encoding`

Summary:
Selects the RGB primary set and transfer assumptions used to decode the cube's encoded RGB values into linear-light RGB.

Details:

- Input: encoded RGB cube coordinates.
- Changes: RGB primaries, RGB-to-XYZ matrices, and the transfer curve summary used by the explorer pipeline.
- Output: linear RGB and XYZ basis for downstream world-space conversion.
- Does not affect: ramp-only gamut mapping, CVD preview severity, camera, or display-aid visibility.

Sources:

- `pipeline.ts` gamut registry.
- `transfer.ts`.
- `_docs/design.md` single-source pipeline.

### `pipelineWorld`

Title: `World space`

Summary:
Chooses how colorimetric data is placed in the 3D viewport.

Details:

- Input: linear RGB converted through the active gamut matrices.
- Changes: geometric position of colors in RGB, XYZ, CIELAB, Oklab, or luminance layout.
- Output: world coordinates used by the renderer, picking, and clipping.
- Does not affect: source color values, stored anchor colors (only where they are shown, not their values), exported ramp tokens, or display simulation.

Sources:

- `registry.ts` space registry.
- `theme.ts` `jsToWorld`.
- Oklab and CIELAB references.

### `pipelineClip`

Title: `Clip / cut`

Summary:
Controls which part of the already-positioned color solid is visible.

Details:

- Input: world-space solid geometry.
- Changes: slice plane, cut direction, slab width, and cylindrical/chroma cut radius.
- Output: visible subset of the solid plus pickable clipped surfaces.
- Does not affect: stored colors, ramp stops, export output, or display overlays such as outline visibility.

Sources:

- `_docs/design.md` slice mathematics.
- `plane.ts`.
- WebGL solid shader clipping uniforms.

### `pipelineVision`

Title: `Vision preview`

Summary:
Applies LMS-stage color-vision-deficiency simulation to visual previews.

Details:

- Input: display-bound linear sRGB colors.
- Changes: preview colors according to protan, deutan, or tritan deficiency severity.
- Output: simulated colors in viewport, inspector panels, and ramp previews.
- Does not affect: source RGB values, saved anchors, generated ramp stops, or exported tokens.

Sources:

- `cvd.ts`.
- LMS/cone fundamentals implementation.
- `_docs/design.md` CVD simulation notes.

### `pipelineDisplay`

Title: `Display aids`

Summary:
Toggles visual overlays and reference geometry around the viewport.

Details:

- Input: rendered color solid and clip result.
- Changes: floor grid, surface grid, clipped surface grid alpha, outlines, outline depth testing, and wide-gamut reference shell.
- Output: viewport aids for orientation and comparison.
- Does not affect: color transforms, ramp generation, export output, or CVD simulation settings.

Sources:

- WebGL renderer draw order.
- `_docs/design.md` outline and shell notes.

### `pipelinePick`

Title: `Pick`

Summary:
Selects where the next viewport click or tap writes a picked color into the ramp workflow.

Details:

- Input: currently visible pick hit on the solid or clipped surface.
- Changes: active target, such as anchor A, anchor B, or adding a spline control point.
- Output: linear-sRGB source colors stored as ramp inputs.
- Does not affect: interpolation mode, adjustment policy, gamut mapping, or export format.

Sources:

- `Viewport.svelte` picking handlers.
- `theme.ts` anchor representation.

### `pipelinePoints`

Title: `Anchors / points`

Summary:
Shows and edits the source colors used by ramp generation.

Details:

- Input: picked linear-sRGB anchors and spline control points.
- Changes: point selection, ordering, duplication, deletion, and future keyboard nudging.
- Output: ordered ramp source points for interpolation.
- Does not affect: interpolation method, WCAG/even adjustments, gamut mapping policy, or final export format.

Sources:

- `ThemeRamp.svelte` control point panel.
- Spline gesture plan.

### `pipelineInterpolate`

Title: `Interpolate`

Summary:
Builds raw ramp samples from anchors or spline control points.

Details:

- Input: anchors A/B or ordered spline control points.
- Changes: ramp mode, step count, hue-arc direction, spread parameters, spline interpolation space, and spline surface constraint.
- Output: raw ramp stops before adjustment and final gamut mapping.
- Does not affect: final export serialization or CVD preview; out-of-gamut colors may still exist at this stage.

Sources:

- `theme.ts` `buildRawRamp`.
- `interp.ts`.
- `_docs/spline-surface-ramp-plan.md`.

### `pipelineAdjust`

Title: `Adjust`

Summary:
Post-processes generated ramp stops for contrast or perceptual spacing.

Details:

- Input: raw interpolated ramp stops.
- Changes: WCAG AA fitting target and even perceptual spacing.
- Output: adjusted ramp stops that still pass through final gamut mapping afterward.
- Does not affect: source anchors/control points, interpolation mode, or viewport color solid.

Sources:

- `theme.ts` `fitWcag` and `fitEven`.
- WCAG contrast references.
- Oklab references.

### `pipelineGamutMap`

Title: `Gamut map`

Summary:
Applies the terminal ramp-only policy for out-of-gamut generated stops.

Details:

- Input: adjusted ramp stops, possibly outside sRGB.
- Changes: clipping or Oklab projection method used to bring stops into the export gamut.
- Output: final in-gamut ramp colors for preview and export.
- Does not affect: the 3D explorer gamut, hover readouts, CVD simulation, or source anchors.

Sources:

- `gamut-map.ts`.
- `theme.ts` `finalizeRamp`.
- Ottosson gamut clipping reference.

### `pipelineExport`

Title: `Export`

Summary:
Serializes final ramp colors after interpolation, adjustment, and gamut mapping.

Details:

- Input: final ramp stops.
- Changes: export action and output text format.
- Output: CSS OKLCH tokens or DTCG JSON.
- Does not affect: ramp source points, viewport display, or upstream pipeline settings.

Sources:

- `theme.ts` `exportTokens`.
- `theme.ts` `exportDTCG`.

### `pipelineView`

Title: `View / camera`

Summary:
Explains viewport navigation and direct manipulation controls.

Details:

- Input: current camera and gesture state.
- Changes: camera orientation, pan/orbit behavior, reset actions, and gesture reference visibility.
- Output: a different view of the same color model.
- Does not affect: color values, clipping parameters, ramp generation, or exports.

Sources:

- `Viewport.svelte`.
- `_docs/camera-and-canvas-gesture-plan.md`.

### `pipelinePerformance`

Title: `Performance`

Summary:
Controls rendering density and automatic tessellation reduction.

Details:

- Input: renderer frame timing and selected tessellation.
- Changes: tessellation, auto-adjust enablement, and minimum average FPS target.
- Output: lower or higher rendering density for the same color model.
- Does not affect: color math, ramp stops, clipping parameters, or exported tokens.

Sources:

- `Viewport.svelte` performance sampler.
- WebGL instancing design notes.

## Implementation Plan

1. Add `PipelineHelpId` and node-specific help entries in `fe/src/lib/inspector/help-copy.ts`.
2. Update `ControlGroup.svelte` prop typing from `SidebarGroupId` to `HelpId` so node help IDs can be used directly.
3. Replace `LeftControls.svelte` help IDs:
   - `Gamut / encoding` -> `pipelineGamut`
   - `World space` -> `pipelineWorld`
   - `Clipping` -> `pipelineClip`
   - `Display aids` -> `pipelineDisplay`
   - `Vision preview` -> `pipelineVision`
   - `Pick` -> `pipelinePick`
   - `Anchors / points` -> `pipelinePoints`
   - `Interpolate` -> `pipelineInterpolate`
   - `Adjust` -> `pipelineAdjust`
   - `Gamut map` -> `pipelineGamutMap`
   - `Export` -> `pipelineExport`
   - `View` -> `pipelineView`
   - `Performance` -> `pipelinePerformance`
4. Add a `?` button to the `View` group once it has `pipelineView` help.
5. Keep existing inspector help entries unchanged.
6. Keep old sidebar help IDs only if some legacy panels still reference them. Remove them once no component uses them.
7. Run `npm run check` and `npm run build`.

## Copy Guidelines

- Keep summaries under two lines in the popup.
- Prefer concrete stage language: input, changes, output, does not affect.
- Avoid explaining keyboard shortcuts in every popup; link to gesture reference for details.
- Avoid implying that display previews mutate saved colors.
- Mention ramp/export separation whenever a setting affects generated tokens but not the 3D solid.
