# Pipeline-Driven Parameter UI Proposal

Status: design proposal, ready for implementation planning.

## Design Review Revisions (authoritative — supersede conflicting text below)

A post-draft review resolved several contradictions and under-specified decisions. Where the prose below disagrees, these decisions win.

1. **Two node kinds, not one.** Distinguish **control nodes** (own real parameters) from **informational/teaching nodes** (a transform stage with no controls yet). Informational nodes are first-class: they show status + help + an optional shortcut and are styled read-only/dimmed. Do **not** invent controls or relocate unrelated controls just to fill a node panel.
2. **Canonical node set.** The implemented, clickable set is: `All`, `Gamut`, `World`, `Clip`, `Vision`, `Display`, `Pick`, `Anchors/Points`, `Interpolate`, `Adjust`, `Gamut Map`, `Export`, `View`, `Performance`. `Encoded RGB`, `Linear RGB`, `XYZ`, and `Raw Stops` are **informational sub-stages** surfaced in help/status text and the pipeline trace, not separate clickable nodes for now; promote them to nodes only when they gain controls (calibration, raw-vs-final preview). This reconciles the 16-vs-12 mismatch between §Node Types and §First Implementation Target.
3. **Drop "scope" as a reused lane word; use an "affects" badge.** Lanes (`Explorer`/`Ramp`/`Support`) describe the workflow group. Effect is a separate **`affects`** badge from a small fixed set: `Viewport`, `Ramp`, `Export`, `Display only`, `View only`. Never render `lane / scope` combos like "Explorer / Display". `pipeline-nodes.ts` is the single source of truth for each node's `lane`, `affects`, controls, and help id; these docs reference it and must not re-list control maps that drift.
4. **Positioning: navigation + teaching first; `All` is a fully-supported primary surface.** The rail is the map and the teacher; `All` (the default) remains the unthrottled workhorse for multi-step workflows. Do not degrade `All` into a legacy afterthought. Per-node focus is for learning and single-stage tweaks.
5. **Node enablement.** Ramp nodes (`Anchors/Points`, `Interpolate`, `Adjust`, `Gamut Map`, `Export`) are dimmed/disabled until at least one source exists (anchor A/B set, or ≥1 spline control point). Informational nodes are always visible but read-only. This teaches dataflow and removes dead clicks.
6. **`selectedNode` persistence.** Persist the last-selected node in **session** (last-open UI) state only — never in the document snapshot — so reload keeps working context instead of dumping the user back to `All`.
7. **Destination-gamut is a first-class warning, not a footnote.** `Gamut Map` and `Export` must show the destination gamut (currently sRGB) and warn when it differs from the explorer gamut (e.g., solid = P3, export = sRGB). A `gamut explorer` silently flattening wide-gamut ramps to sRGB is a trap.
8. **Promote "Raw vs Final" preview and OOG badges to near-term.** A before/after stop preview on `Gamut Map`/`Export` (OOG count + swatch diff) is the payoff that makes the pipeline framing tangible, especially now that gamut mapping exists. Add OOG warning badges to `Interpolate` and `Gamut Map`. (Was buried under §Additional Suggestions.)
9. **Wording.** User-facing copy says "pipeline steps/stages"; "node"/"graph" stays internal to avoid implying a rewireable editor.

## Goal

Rework the app controls around the color pipelines rather than around broad sidebar groups. The user should see a compact, static pseudo-node graph where each node represents a pipeline step. Clicking a node opens the parameters for that step. The graph is non-rewirable: it explains the dataflow and acts as navigation, not a general visual programming surface.

The 3D display remains the center of the app. The node graph should be a thin contextual control layer, not a replacement for the viewport.

## Current Problem

The current sidebar groups are pragmatic, but they mix concerns:

- Color model controls affect the explorer pipeline.
- Theme ramp controls affect a separate ramp pipeline.
- Gamut mapping for ramp stops is not part of the main display pipeline.
- Performance, gestures, and display controls are operational concerns rather than color transforms.

This makes it easy for users to assume that every option in the sidebar affects the 3D solid. That is wrong for ramp gamut mapping, export policies, WCAG adjustments, and some CVD display previews.

## Design Principle

Each configurable parameter should appear at the point in the pipeline where it acts.

The UI should answer:

1. What data exists at this stage?
2. What transformation happens next?
3. Which parameters can I change here?
4. Does this affect the 3D explorer, the ramp, export, display preview, or all of them?

## Proposed Layout

### Desktop

Use three persistent regions:

- Center: 3D viewport, unchanged.
- Top or bottom of viewport: compact pipeline strip.
- Side drawer/panel: selected node parameters.

The left sidebar becomes a contextual parameter panel. Instead of always showing all grouped controls, it shows the selected node's controls plus a small "All controls" fallback during transition.

Recommended first placement:

- Put the node graph as a horizontal strip directly above the 3D viewport toolbar or integrated into the viewport toolbar area.
- Keep nodes small: icon/title/status, no large cards.
- Keep the selected node panel in the existing left sidebar area to avoid a large layout rewrite.

### Quick Access Top Bar

The current quick access top bar should remain, but its role should narrow. It should be treated as a high-frequency control strip that mirrors a few pipeline parameters, not as the main organizing model for the UI.

Keep these controls in the top bar because users need them while manipulating the viewport:

- Space
- Gamut
- Slice toggle
- Cylinder toggle
- Vision
- Touch tool

The pipeline graph remains authoritative for parameter organization. The top bar is a shortcut layer:

- Changing a top-bar value updates the corresponding node status.
- Selecting a node can highlight the matching top-bar shortcut when one exists.
- The top bar should not grow much beyond its current scope.
- Less frequent controls should move to the selected node parameter panel.

Recommended desktop order:

```text
Pipeline rail / nodes
Quick bar: Space | Gamut | Slice | Cylinder | Vision | Touch tool
3D viewport
```

On mobile, the quick bar should become a compact overlay or scrollable row near the viewport, while detailed node controls live in the bottom parameter panel.

### Mobile

Use the existing split-screen idea:

- Top: 3D viewport.
- Bottom: inspector/parameters.
- Pipeline graph: horizontally scrollable strip above the bottom parameter panel or overlayed as a compact rail at the top of the bottom half.
- Hamburger drawer remains for document actions and less frequent settings.

On mobile, tapping a node switches the bottom panel content. Long labels collapse to short labels.

## Node Graph Model

The graph is static and non-rewirable. It can show multiple lanes:

```text
Explorer lane:
Encoded RGB -> Linear RGB -> XYZ -> World Space -> Slice/Cylinder -> CVD Preview -> Display

Ramp lane:
Picked Color -> Anchors/Points -> Interpolation -> Raw Stops -> Adjustments -> Gamut Map -> Export

Support lane:
Camera/View -> Performance -> Documents
```

The lanes can share visual alignment where data crosses:

- Picked Color is produced by the explorer/picking path.
- Anchors/Points are stored in linear sRGB.
- Ramp exports are generated from ramp stops, not from the viewport display pipeline.
- CVD preview affects display/inspection presentation, not source colors or exported tokens.

## Node Types

## Parameter Ownership

The first implementation pass should not treat the existing sidebar groups as the final panel boundaries. Those groups are too broad: `Color model`, `Display`, and `Theme` each contain parameters that act at different pipeline stages. The selected node should expose a small, stage-specific parameter set, while the `All controls` node can keep the legacy grouped view during the transition.

A good rule is:

- A parameter belongs to the node where it first changes data, geometry, or presentation.
- A high-frequency duplicate may remain in the quick bar, but its canonical explanation and full settings live in the node panel.
- If a control only changes the rendering aid, not color data, it belongs to `Display` or `View`, not the color transform node.
- If a control changes ramp output, it belongs to the ramp lane even when it is visually previewed in the 3D viewport.

### Explorer Lane Control Map

#### Gamut / Encoding

Canonical controls:

- Gamut / cube primaries.
- Transfer function summary for the selected gamut.
- Future custom chromaticities.
- Future monitor/profile warning if the selected gamut conflicts with display assumptions.

Quick-bar duplicate:

- Gamut selector can remain in the viewport toolbar.

Do not include:

- World-space selector. It acts after XYZ conversion.
- Wide-gamut shell. It is a display/reference overlay.
- CVD controls. They are a display simulation.

#### Linear RGB

Canonical controls:

- Linear RGB coordinate/readout options, if added.
- Future RGB cube axis visibility, if tied specifically to cube coordinates.

Current app status:

- This node may be informational only for now. It should still appear in help/pipeline text because it explains why encoded values are decoded before matrices and perceptual spaces.

Do not include:

- Tessellation. It affects renderer density, not the linear RGB data model.

#### XYZ / Chromaticity

Canonical controls:

- Future white point and adaptation controls.
- Future observer/CMF source selection, if added.
- Links or toggles for chromaticity-related inspector overlays.

Current app status:

- Mostly informational until custom chromaticities/calibration work begins.

Do not include:

- Gamut selector, except as a read-only upstream summary.
- LMS/CVD controls. LMS simulation is downstream display preview.

#### World Space

Canonical controls:

- World space selector: RGB, XYZ, CIELAB, Oklab, Luma, future spaces.
- Future world-space axis/grid labels, if they describe coordinates.
- Future chromaticity-volume or intensity-volume display mode if it changes world-space geometry.

Quick-bar duplicate:

- Space selector can remain in the viewport toolbar.

Do not include:

- Floor grid and surface grid style. Those are display aids.
- Slice/cylinder settings. They operate after the world geometry exists.

#### Clip / Cut

Canonical controls:

- Enable slice.
- Cut above plane.
- Cut below plane.
- Plane mode: lightness, hue plane, custom.
- Slice offset.
- Hue / azimuth.
- Custom elevation.
- Slab half-width epsilon.
- Enable cylindrical cut.
- Cylinder/chroma radius.
- Future direct-manipulation mode hints for dragging slice offset or cylinder radius.

Quick-bar duplicate:

- Slice toggle and cylinder toggle can remain in the viewport toolbar.

Do not include:

- Plane outline and cylinder outline visibility. These are display overlays for the cut result.
- Surface grid clipped-part alpha. This is a display style for clipped geometry.

#### Vision / CVD

Canonical controls:

- Color vision mode.
- Severity.
- Scope/status showing whether CVD simulation is propagated to viewport, inspector panels, and ramp previews.

Quick-bar duplicate:

- Vision mode can remain in the viewport toolbar.

Do not include:

- Wide-gamut shell or grid controls.
- Ramp gamut mapping. CVD is a preview transform; gamut mapping changes exported ramp colors.

#### Display Aids

Canonical controls:

- Floor grid.
- Surface grid lines.
- Clipped surface grid alpha, fixed white styling.
- Plane outline visibility.
- Cylinder outline visibility.
- Depth-test cross-section outlines.
- Wide-gamut reference shell.
- Future spectrum/chromaticity panel display options if they are visual overlays rather than color transforms.

Do not include:

- CVD controls. They are a display simulation, but important enough to remain their own node because they affect every visual panel.
- Tessellation and FPS target. Those are performance.

### Ramp Lane Control Map

#### Pick

Canonical controls:

- Set A.
- Set B.
- Add spline/control point arm.
- Touch tool selection when it determines picking behavior.
- Current armed target and next-click behavior.
- Short picked-color readout or link to the values panel.

Quick-bar duplicate:

- Touch tool may remain in the viewport toolbar.

Do not include:

- Theme mode. That determines how picked inputs are used downstream.
- Export buttons.

#### Anchors / Points

Canonical controls:

- A and B anchor swatches/readouts.
- Theme mode only if selecting the mode changes which source points are editable; otherwise keep mode in `Interpolate`.
- Spline control point list.
- Select point.
- Reorder point.
- Duplicate point.
- Delete point.
- Selected point nudge instructions / keyboard shortcuts.

Do not include:

- Spline interpolation space. That belongs to `Interpolate`.
- Gamut mapping. That is terminal output policy.

#### Interpolate

Canonical controls:

- Theme/ramp mode: segment, hue arc, spread A, spline.
- Spline interpolation space.
- Spline curve constraint: free vs surface.
- Hue arc long path.
- Spread delta hue.
- Spread delta chroma.
- Spread chroma profile.
- Steps count, unless a separate `Raw Stops` node is introduced.
- Raw ramp preview before adjustments, if implemented.

Do not include:

- WCAG AA target.
- Even perceptual spacing button.
- Gamut mapping policy.
- Export buttons.

#### Raw Stops

Canonical controls:

- Steps count if separated from `Interpolate`.
- Raw/OOG preview toggle.
- Raw stop inspection.
- OOG count/status.

Current app status:

- This can be folded into `Interpolate` initially to avoid adding a node with too little UI. The proposal should keep it as an internal stage because it is useful for help text and future raw-vs-final previews.

#### Adjust

Canonical controls:

- Ensure WCAG AA on white.
- AA target.
- Future WCAG background color selector.
- Even perceptual spacing.
- Future adjustment order/status if multiple adjusters are enabled.

Do not include:

- Gamut mapping policy, although the panel should note that mapping runs after adjustments.
- Export buttons.

#### Gamut Map

Canonical controls:

- Gamut mapping policy: none, clip, preserve chroma, project to L 0.5, project to cusp, adaptive variants.
- Destination gamut status. Today this is sRGB for ramp export.
- OOG before/after summary.
- Future method-specific parameters, if exposed.

Do not include:

- The explorer gamut selector. The ramp map destination is currently separate from the visible solid gamut.
- CVD mode. CVD only previews final colors.

#### Export

Canonical controls:

- Final ramp preview after adjustments and gamut mapping.
- Export CSS tokens.
- Export DTCG JSON.
- Export text area / copy status.
- Future export format, color-space, token namespace, metadata, and naming controls.

Do not include:

- Interpolation method controls.
- WCAG/even adjustment actions.
- Gamut map method selector, except as read-only upstream status.

### Support Lane Control Map

#### View / Camera

Canonical controls:

- Reset camera.
- Gesture reference.
- Future camera pan/orbit freedom options.
- Future direct-manipulation gesture mode hints.

Do not include:

- Touch tool if it selects ramp picking behavior. That belongs to `Pick`, with a quick-bar duplicate.
- Rendering density. That belongs to `Performance`.

#### Performance

Canonical controls:

- Auto-adjust tessellation.
- Minimum average FPS.
- Tessellation.
- Instance count/status.
- Current measured FPS/redraw status, if exposed.

Do not include:

- Grid visibility. The grid can affect performance, but it is a display aid first.

### Legacy Component Split Needed

The current `ThemeRamp.svelte` should be split before the pipeline UI can feel coherent. Recommended fragments:

```text
RampPickPanel.svelte
  Set A / Set B / Add point arm and pick status.

RampPointsPanel.svelte
  A/B anchors, spline control point list, selection, reorder, duplicate, delete.

RampInterpolationPanel.svelte
  Mode, interpolation space, curve constraint, arc/spread parameters, steps.

RampAdjustPanel.svelte
  WCAG, AA target, even spacing.

RampGamutMapPanel.svelte
  Gamut mapping policy and OOG status.

RampExportPanel.svelte
  Final ramp preview, export buttons, export text.
```

Likewise, `LeftControls.svelte` should stop using one `showColor`, one `showDisplay`, and one `showTheme` gate. It needs a switch from `selectedNode` to a real panel component:

```text
selectedNode === 'gamut'       -> GamutEncodingPanel
selectedNode === 'world'       -> WorldSpacePanel
selectedNode === 'clip'        -> ClipPanel
selectedNode === 'cvd'         -> VisionPreviewPanel
selectedNode === 'display'     -> DisplayAidsPanel
selectedNode === 'pick'        -> RampPickPanel
selectedNode === 'interpolate' -> RampInterpolationPanel
selectedNode === 'adjust'      -> RampAdjustPanel
selectedNode === 'gamut-map'   -> RampGamutMapPanel
selectedNode === 'export'      -> RampExportPanel
selectedNode === 'view'        -> ViewPanel
selectedNode === 'performance' -> PerformancePanel
```

The `All controls` fallback can compose these panels in pipeline order rather than preserving the old broad groups. That gives users an escape hatch while still teaching the same mental model.

### 1. Encoded RGB

Purpose: input/display encoding and transfer curve.

Controls:

- Gamut selector / primaries
- Transfer function, future gamma/custom calibration
- Future monitor profile/custom chromaticities

Help copy:

Encoded RGB is the device or standard code value. It must be decoded before matrix and perceptual-space operations.

### 2. Linear RGB

Purpose: cube coordinate domain and linear-light operations.

Controls:

- Active gamut cube resolution summary
- Future linear RGB readout options
- Maybe "show cube axes" and RGB-space display options

Help copy:

Linear RGB is the actual cube coordinate space. Geometry starts here before conversion to XYZ or perceptual spaces.

### 3. XYZ

Purpose: shared colorimetric connection space.

Controls:

- White point/adaptation controls, when added
- Observer data/source references
- Chromaticity panel link

Help copy:

XYZ is the common interchange space between gamuts and perceptual spaces. Most matrix transforms pass through this stage.

### 4. World Space

Purpose: map color data into the 3D viewport.

Controls:

- World space selector: RGB, XYZ, CIELAB, Oklab, Luma, future spaces
- Wide-gamut shell
- Floor/surface grid display if kept tied to geometry

Help copy:

World space controls the 3D geometry only. It changes how colors are positioned, not their source values.

### 5. Clipping / Cutaway

Purpose: geometry masking and cross-section interaction.

Controls:

- Slice enable, mode, offset, cut above/below
- Cylindrical cut enable/radius
- Plane/cylinder outlines
- Surface grid behavior on clipped parts

Help copy:

Clipping edits the visible subset of the color solid. It does not alter color values or ramp exports.

### 6. CVD Preview

Purpose: color vision deficiency simulation.

Controls:

- CVD mode and severity
- Future "apply to all panels" status

Help copy:

CVD preview is a display simulation stage. It should affect viewport, inspectors, and ramp previews, but it should not change stored or exported colors.

### 7. Display

Purpose: final monitor/display assumption.

Controls:

- sRGB-compliant monitor assumption
- Future calibration workflow entry point
- Future monitor profile/custom primaries/gamma

Help copy:

This is the final presentation stage. Accurate output depends on monitor configuration and calibration.

### 8. Picked Color

Purpose: bridge from explorer pipeline to ramp pipeline.

Controls:

- Pick A / Pick B mode
- Touch tool selection
- Hovered/picked source readout link

Help copy:

Picked colors come from the visible solid and are stored as linear sRGB anchors for theme generation.

### 9. Anchors / Spline Points

Purpose: editable source points for generated ramps.

Controls:

- Theme mode selection when relevant
- A/B anchor selection
- Spline control point list, reorder, duplicate, delete
- Direct 3D point editing guidance

Help copy:

These points define ramp source colors. They are not the same as final exported stop colors if adjustments or gamut mapping are enabled.

### 10. Interpolation

Purpose: ramp path generation.

Controls:

- Segment / hue arc / spread / spline
- Spline interpolation space
- Curve constraint: free vs surface-locked
- Steps count could live here or in Raw Stops

Help copy:

Interpolation creates raw ramp samples from anchors or control points. It can temporarily create out-of-gamut colors.

### 11. Raw Stops

Purpose: generated ramp samples before terminal policies.

Controls:

- Step count
- Preview raw/OOG status toggle, if added
- Stop inspection/readout

Help copy:

Raw stops show what interpolation produced before WCAG, even spacing, or gamut mapping policies.

### 12. Adjustments

Purpose: optional ramp post-processing before final gamut mapping.

Controls:

- Ensure WCAG AA
- AA target and background
- Even perceptual spacing

Help copy:

Adjustments alter generated ramp stops for contrast or spacing. The final gamut mapping policy still runs afterward.

### 13. Gamut Map

Purpose: terminal ramp-only out-of-gamut policy.

Controls:

- None / clip / preserve chroma / projection methods

Help copy:

Gamut mapping reconciles generated ramp stops with sRGB export. It does not reshape the 3D color solid or hover readouts.

### 14. Export

Purpose: final token output.

Controls:

- CSS OKLCH export
- DTCG JSON export
- Future export color-space and metadata options

Help copy:

Exports serialize the final ramp stops after adjustments and gamut mapping.

### 15. Camera / View

Purpose: navigation, not color math.

Controls:

- Reset camera
- Gesture reference
- Camera freedom/pan/orbit settings if added

Help copy:

Camera settings change how the model is viewed, not the model itself.

### 16. Performance

Purpose: renderer quality/speed tradeoffs.

Controls:

- Tessellation
- Auto-adjust tessellation
- Minimum average FPS

Help copy:

Performance settings change rendering density and responsiveness, not color values.

## Interaction Model

### Node Selection

- Click/tap node: select it and show related controls.
- Hover/focus node: show short purpose tooltip.
- Help button inside selected node panel: show detailed explanation, references, and "affects" scope.

Each node should show a scope badge:

- `Explorer`
- `Ramp`
- `Display`
- `Export`
- `View`

This is important because a parameter may visually affect the viewport without changing source colors, or may affect export without affecting the viewport.

### Compact Status

Each node should show one small status value:

- Gamut node: `sRGB`, `P3`, `Rec.2020`
- World node: `Oklab`
- CVD node: `Normal`, `Deutan 0.8`
- Interpolation node: `Spline / OKLCH`
- Gamut Map node: `Adaptive cusp`
- Performance node: `128 / auto 30`

This lets the graph act as both navigation and a dashboard.

### Parameter Panel

The selected-node panel should follow a consistent structure:

```text
Node title
One-sentence purpose
Scope badges
Primary controls
Secondary controls
Help / references
```

Do not put every control behind popovers. Node selection should make common controls directly available. Popovers are for explanation, not primary interaction.

## Visual Design

Avoid a full node-editor aesthetic with draggable boxes, cables, and canvas controls. That would compete with the 3D viewport.

Recommended styling:

- static horizontal/vertical lanes;
- small rectangular nodes with 6-8px radius;
- subtle connecting lines/arrows;
- selected node accent border;
- disabled/inactive nodes dashed or dimmed;
- pipeline split shown as lane separation, not cable spaghetti.

For the pipeline strip, a segmented "rail" is probably better than a literal graph canvas.

## Suggested Component Architecture

```text
PipelineGraph.svelte
  - renders lanes and nodes
  - owns selected node id
  - emits selection changes

PipelineNode.svelte
  - compact node visual/status/help affordance

PipelineParameterPanel.svelte
  - switches by selected node id
  - hosts existing controls in smaller node-specific sections

pipeline/nodes.ts
  - static node registry
  - labels, descriptions, scope, lane, order, help ids

pipeline/control-panels/
  - ExplorerGamutPanel.svelte
  - WorldSpacePanel.svelte
  - ClipPanel.svelte
  - RampInterpolationPanel.svelte
  - RampGamutMapPanel.svelte
  - PerformancePanel.svelte
```

Start by moving existing controls into node-specific panel components without changing state shape.

## Migration Plan

### Phase 1: Static Graph Beside Existing Sidebar

- Add `PipelineGraph.svelte`.
- Add node registry with explorer and ramp lanes.
- Selecting nodes only scrolls/highlights existing sidebar groups.
- Keep all current controls visible.

Goal: validate labels, ordering, and scope without breaking workflows.

### Phase 2: Node-Scoped Parameter Panel

- Extract existing sidebar groups into reusable panel fragments.
- Left sidebar shows controls for selected node.
- Add "All controls" fallback tab or node.
- Keep current viewport toolbar for high-frequency controls.
- Do not route multiple nodes to the same broad legacy panel. `Pick`, `Interpolate`, `Adjust`, `Gamut Map`, and `Export` must not all show the full theme panel.
- Split `ThemeRamp.svelte` first, because it currently hides most of the ramp pipeline distinctions.
- Split display controls so `Vision / CVD` and `Display Aids` are separate panels.
- Split color controls so `Gamut / Encoding` and `World Space` are separate panels.

Goal: make the pipeline graph the main control navigation.

Recommended extraction order:

1. `ThemeRamp.svelte` into ramp lane panels. This fixes the largest mismatch immediately.
2. `Color model` into `GamutEncodingPanel` and `WorldSpacePanel`.
3. `Display` into `VisionPreviewPanel` and `DisplayAidsPanel`.
4. `Clipping` into `ClipPanel`, leaving outline/grid style controls in `DisplayAidsPanel`.
5. Replace the `All controls` legacy view with a pipeline-ordered composition of the new panels.

### Phase 3: Full Pipeline-Driven Layout

- Replace current group list with the node parameter panel.
- Add node status values.
- Add help content per node.
- Move ramp pipeline explanation from `RampPipelinePopover` into the graph/help model.

Goal: pipeline graph becomes the authoritative UI map.

### Phase 4: Mobile Optimization

- Pipeline graph becomes horizontal scroll strip.
- Bottom panel switches by selected node.
- Frequent gestures remain in viewport toolbar and gesture reference.

Goal: no hidden desktop-only pipeline controls.

## Implementation Notes

- State should remain in `ExplorerState`; the graph is navigation and grouping only.
- Do not add graph-node state to saved documents except maybe last selected UI node, and only if it proves useful.
- Help content should reuse/extend `help-copy.ts`, but node help may need a new `PipelineHelpId` namespace.
- Analytics can track node selection: `pipeline_node_select { node, lane, mobile }`.
- Keyboard navigation should support arrowing through nodes and Enter/Space to select.
- The graph must be accessible as a tablist/tree-like navigation, not just visual boxes.

## Risks

- Too much UI chrome around the viewport.
  - Mitigation: compact rail, no draggable graph canvas.

- Users may mistake static nodes for rewritable node graphs.
  - Mitigation: clear visual language, no ports, no draggable cables, use "pipeline steps" copy.

- Splitting controls too finely can make common workflows slower.
  - Mitigation: keep high-frequency controls in viewport toolbar and allow an "All controls" mode during transition.

- Ramp and explorer pipelines share concepts but not effects.
  - Mitigation: scope badges and explicit node help.

## Additional Suggestions

- Add a "What changed?" pulse on nodes when a control affects downstream output. Example: changing gamut briefly highlights `Linear RGB -> XYZ -> World Space`.
- Add node badges for warnings: `OOG`, `CVD preview`, `uncalibrated display`, `auto tessellation`.
- Let node help include source references from `_docs/references.md`.
- Add a small "Pipeline trace" in hover readouts showing the current color's path through encoded RGB, linear RGB, XYZ, world, and display preview.
- For ramp stops, let users toggle `Raw` vs `Final` preview to see what gamut mapping changed.

## First Implementation Target

Build the graph as a read-only navigation layer with these initial nodes:

1. Gamut
2. World
3. Clip
4. CVD
5. Display
6. Pick
7. Interpolate
8. Adjust
9. Gamut Map
10. Export
11. View
12. Performance

This gives enough structure to test the concept without overwhelming the UI or requiring a deep state rewrite.
