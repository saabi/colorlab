# Pipeline Panel Completion Plan

Status: implementation plan.

## Problem

The pipeline-node UI should not leave any selected node with an empty or explanatory-only panel. If a node exists in the pipeline graph, selecting it must expose the controls that belong to that stage, even when the same action also remains available in the viewport quick bar or gesture layer.

The current weak point is `View`: camera operations currently live only in `Viewport.svelte` through gestures and keyboard shortcuts, so the `View` node cannot present real controls unless camera state and camera actions are routed to the left panel.

## Completion Rule

Every node panel must include at least one of:

- direct controls that mutate app state;
- direct commands that invoke viewport/app actions;
- read-only status paired with a concrete shortcut to the place where the stage is controlled, only for truly informational stages.

For the current graph, no selected node should be purely placeholder text.

## Required Panels

### Gamut / Encoding

Controls:

- Gamut / cube primaries selector.
- Transfer function summary for the active gamut.
- Future calibration/custom chromaticity entry point, disabled until implemented.

State:

- `explorer.gamut`.

Quick-bar mirror:

- The viewport toolbar may keep the gamut selector.

### World Space

Controls:

- World-space selector: Oklab, CIELAB, XYZ, RGB, Luma.
- Read-only note/status for current coordinate domain.

State:

- `explorer.spaceMode`.

Quick-bar mirror:

- The viewport toolbar may keep the space selector.

### Clip / Cut

Controls:

- Slice enable.
- Cut above plane.
- Cut below plane.
- Plane mode.
- Offset.
- Hue / azimuth.
- Custom elevation.
- Slab half-width epsilon.
- Cylindrical cut enable.
- Cylinder/chroma radius.

State:

- `explorer.slice`.
- `explorer.cutAbove`.
- `explorer.cutBelow`.
- `explorer.planeMode`.
- `explorer.off`.
- `explorer.az`.
- `explorer.el`.
- `explorer.eps`.
- `explorer.cylSlice`.
- `explorer.cylRad`.

Quick-bar mirror:

- The viewport toolbar may keep slice and cylinder toggles.

### Vision Preview

Controls:

- CVD mode.
- Severity.
- Read-only scope status: viewport, inspector panels, and ramp previews.

State:

- `explorer.cvd`.
- `explorer.cvdSev`.

Quick-bar mirror:

- The viewport toolbar may keep CVD mode. Severity should live in this panel.

### Display Aids

Controls:

- Floor grid.
- Surface grid lines.
- Clipped grid alpha.
- Plane outline.
- Cylinder outline.
- Depth-test cross-section outlines.
- Wide-gamut shell.

State:

- `explorer.floor`.
- `explorer.lines`.
- `explorer.surfaceGridAlpha`.
- `explorer.planeOutline`.
- `explorer.cylinderOutline`.
- `explorer.outlineDepthTest`.
- `explorer.shell`.

### Pick

Controls:

- Set A.
- Set B.
- Add spline control point when in spline mode.
- Touch tool selector or synchronized touch-tool status.
- Current armed target status.

State:

- `explorer.theme.arm`.
- Viewport-local `touchTool` should move into shared app/UI state or be passed up from `Viewport`.

Implementation note:

- `touchTool` currently lives inside `Viewport.svelte`. To make `Pick` complete, promote it to `AppShell.svelte` as shared UI state and pass it to both `Viewport` and `LeftControls`, or persist it in `ExplorerState` if it should be saved.
- Prefer shared non-persisted UI state first; touch tool is interaction mode, not document state.

### Anchors / Points

Controls:

- A anchor swatch/readout.
- B anchor swatch/readout.
- Spline control point list.
- Select point.
- Move point earlier/later.
- Duplicate point.
- Delete point.
- Future nudge controls or nudge hint tied to keyboard behavior.

State:

- `explorer.theme.A`.
- `explorer.theme.B`.
- `explorer.theme.controlPoints`.
- `explorer.theme.selectedCp`.

### Interpolate

Controls:

- Ramp mode.
- Step count.
- Spline interpolation space.
- Spline curve constraint.
- Hue arc long path.
- Spread delta hue.
- Spread delta chroma.
- Spread chroma profile.
- Raw ramp preview/status if added.

State:

- `explorer.theme.mode`.
- `explorer.theme.steps`.
- `explorer.theme.splineSpace`.
- `explorer.theme.splineConstraint`.
- `explorer.theme.arcLong`.
- `explorer.theme.dh`.
- `explorer.theme.dc`.
- `explorer.theme.cprof`.

### Adjust

Controls:

- Ensure WCAG AA on white.
- AA target.
- Even perceptual spacing.
- Future WCAG background selector.

State:

- `explorer.theme.aa`.
- `explorer.theme.wcagBg`.
- Commands call `fitWcag` and `fitEven`.

### Gamut Map

Controls:

- Gamut mapping policy selector.
- Read-only destination gamut status, currently sRGB.
- Out-of-gamut count/status before and after mapping, if exposed.

State:

- `explorer.theme.gamutMap`.
- Derived from `explorer.theme.stops`.

### Export

Controls:

- Final ramp preview.
- Export CSS tokens.
- Export DTCG JSON.
- Export text area/copy status.

State:

- `explorer.theme.stops`.
- Runtime export text.

### View / Camera

Controls:

- Reset camera.
- Yaw.
- Pitch.
- Distance / zoom.
- Field of view.
- Target X/Y/Z.
- Gesture reference popup trigger or open command.
- Optional: "Frame current solid" command after implemented.

State:

- `camera.yaw`.
- `camera.pitch`.
- `camera.dist`.
- `camera.fov`.
- `camera.target`.
- Runtime gesture-reference open state, if the panel should open the existing reference.

Implementation notes:

- `LeftControls.svelte` currently receives only `explorer` and `matrices`; it must also receive `camera`.
- Move `resetCamera` out of `Viewport.svelte` into a shared helper, or pass an `onResetCamera` callback from `AppShell`.
- Avoid duplicating camera constants in panel code. Export min/max values from `camera.ts` or create local constants in one shared camera-control component.
- The View panel should not merely point users to gestures; it should provide form controls for exact camera adjustments.

### Performance

Controls:

- Auto-adjust tessellation.
- Minimum average FPS.
- Tessellation.
- Instance count/status.
- Future measured FPS/status readout.

State:

- `explorer.autoPerformance`.
- `explorer.minAverageFps`.
- `explorer.N`.

## Component Plan

Create or extract panel-level components so `LeftControls.svelte` becomes routing/composition rather than a large control host:

```text
GamutEncodingPanel.svelte
WorldSpacePanel.svelte
ClipPanel.svelte
VisionPreviewPanel.svelte
DisplayAidsPanel.svelte
RampPickPanel.svelte or ThemeRamp panel="pick"
RampPointsPanel.svelte or ThemeRamp panel="points"
RampInterpolationPanel.svelte or ThemeRamp panel="interpolate"
RampAdjustPanel.svelte or ThemeRamp panel="adjust"
RampGamutMapPanel.svelte or ThemeRamp panel="gamut-map"
RampExportPanel.svelte or ThemeRamp panel="export"
ViewCameraPanel.svelte
PerformancePanel.svelte
```

Short term, `ThemeRamp.svelte` may remain section-aware. For explorer/support panels, extraction is preferable because camera and display controls will otherwise make `LeftControls.svelte` too large.

## App State Plumbing

Required prop changes:

```text
AppShell
  owns selectedPipelineNode
  owns touchTool as non-persisted UI state
  passes explorer, matrices, camera, touchTool to LeftControls
  passes explorer, camera, touchTool to Viewport

LeftControls
  receives camera
  receives/binds touchTool
  receives resetCamera callback or imports shared reset helper

Viewport
  receives/binds touchTool instead of owning it privately
  uses shared reset helper
```

Camera state is already persisted in the app state, so the View panel should edit the same `appState.camera` object used by the renderer.

## Completeness Checklist

- [ ] Selecting every pipeline node shows at least one direct control or command.
- [ ] `View` exposes real camera controls.
- [ ] `Pick` exposes touch-tool selection or synchronized pick mode.
- [ ] No panel reuses broad legacy help content after node-specific help IDs are implemented.
- [ ] The `All controls` node composes the same complete panels in pipeline order.
- [ ] Quick-bar controls remain mirrors, not the only way to access a pipeline stage.
- [ ] `npm run check` passes.
- [ ] `npm run build` passes.

## Implementation Order

1. Promote `touchTool` from `Viewport.svelte` into `AppShell.svelte`.
2. Pass `camera` and `touchTool` to `LeftControls.svelte`.
3. Add `ViewCameraPanel.svelte` with camera controls and reset command.
4. Add touch-tool selector/status to `Pick`.
5. Extract explorer/support panels from `LeftControls.svelte` if the file becomes unwieldy.
6. Wire node-specific help IDs from `_docs/pipeline-popup-content-plan.md`.
7. Run checks and build.
