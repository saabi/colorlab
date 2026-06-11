# Plan: Ramp Display & Interaction on the 3D Viewport

Status: proposal. Follows the completed `ramp-pipeline-plan.md`. Scope is the
*presentation and interaction* of ramp colors in the 3D viewport (not the
generation pipeline, which is done).

## Current behavior (verified in code)

- **Markers are one shared style.** `shaders/mark.{vert,frag}` draws a fixed
  `gl_PointSize = 10` circular disc with a colored fill + border ring. It is used
  identically for: the hover marker, every `theme.stops` marker, and every source
  point (`theme.points`, drawn in `drawSpline`). So **source points and generated
  stops are visually indistinguishable** (ask #1).
- **Generated stops *are* drawn** (`webgl-renderer.ts`, `if (theme.stops.length)`)
  — but markers render with **DEPTH_TEST enabled**. Source points sit on the
  solid's surface (picked there) so they show; interpolated stops on a linear/free
  path run **through the opaque solid's interior and are depth-occluded**. That is
  almost certainly why stops "are not displayed" (ask #2). The interpolation curve
  (`splineCurve`) *is* drawn as a line strip for every interpolating mode.
- **Background cursor already signals orbit**: `canvas.cursor-orbit` is `grab`,
  `:active` is `grabbing` (`app.css`). What's missing is a cursor change when
  hovering an **interactive source point** — `onPointerMove` only does work while
  `dragging`, so there is no idle hover hit-test (ask #1, second half).
- **Gamut mapping + export already cover generated colors** (ask #3): `finalizeRamp`
  maps `theme.stops`; `buildExpand` maps every grid cell (when `gamutMap !== 'none'`);
  `exportTokens`/`exportDTCG` serialize the 1-D ramp and `exportTokensGrid`/
  `exportDTCGGrid` serialize the 2-D palette. So #3 is largely satisfied today — the
  real work is making the *displayed* set equal the *exported* set and confirming no
  path bypasses mapping.
- **The 2-D expand palette (`theme.grid`) is not represented in the viewport at all**,
  and there is no always-on "exported colors" surface (ask #4).

## The four asks → design

### 1. Distinguish anchor (source) points from generated stops; hover cursor

**Marker differentiation.** Give the shared marker a small style vocabulary via
uniforms (no new programs): `uSize` (point size) and `uRing` (ring thickness /
style flag). Proposed visual language:

| Role | Style |
|---|---|
| **Source point** (interactive) | larger (~14px), bold white ring + filled core; **selected** keeps the existing gold ring |
| **Generated stop** (read-only) | smaller (~8px), thin/no ring, filled |
| **Hover probe** | unchanged (cyan in-gamut / red OOG) |

This makes "draggable inputs" read as chips with halos and "outputs" read as plain
dots. (Alternative: square vs round via `gl_PointCoord` in the frag shader — more
distinct but heavier; ring/size is enough for v1.)

**Occlusion fix (also resolves ask #2).** Generated-stop markers should be visible
even when their path dips inside the solid. Options:
- **(a) Always-on-top:** draw stop markers with `DEPTH_TEST` disabled. Simplest;
  loses depth cueing.
- **(b) Two-pass ghost (recommended):** draw depth-tested at full opacity, then a
  second always-on-top pass at low alpha for the occluded portions, so stops read as
  "behind the surface" rather than vanishing.
- Source points are picked on the surface and already mostly visible; apply the same
  treatment for consistency (e.g. when a clip/cut hides them).
- **Decision needed:** (a) quick vs (b) polished. Recommend (b), behind the existing
  outline-depth-test mental model.

**Hover cursor.** Add idle hover handling in `onPointerMove` (when `!dragging`):
hit-test source points via `getControlPointAtScreen`; store `hoverPointIndex`
(runtime). Derive the canvas cursor: `pointer`/`grab` over a source point (signals
draggable), `grab` over the background (orbit, already in place), existing
`crosshair`/resize cursors for inspect/slice/cylinder gestures. Throttle the
hit-test to pointer-move (cheap: it projects N source points). Mouse-only; touch
keeps its toolbar affordances.

### 2. Show generated stops (+ curve) on the 3D display

Mostly delivered by the occlusion fix above — once stop markers are visible, they
already sit on the drawn `splineCurve` at each placed position. Confirm: the curve
renders for `linear` and `spline` (it does); single-seed ramps show one stop; the
markers use the gamut-mapped `stops` (they do). No new geometry needed beyond the
visibility fix and differentiation.

### 3. Generated stops gamut-mapped and exportable

Audit result: **already true** for both the 1-D ramp and the 2-D grid. Action items
are confirmation + parity, not new mapping:
- Ensure every surface that *shows* generated colors (3D markers, the new pin panel)
  reads the **post-`finalizeRamp` / post-`buildExpand`** colors, so what you see is
  what exports.
- Keep the `gamutMap === 'none'` case honest: OOG markers/swatches should carry the
  same OOG affordance as the ramp chips (dashed outline) rather than silently
  clamping only in display.

### 4. Pin / always-visible generated colors (as exported)

Add a **pinned palette surface** that always shows the final exported colors,
independent of which pipeline steps are expanded:
- **Content:** the 1-D ramp (`theme.stops`) normally, or the 2-D grid
  (`theme.grid`) when `expand !== 'none'` — i.e. exactly the export set, with hex
  titles and OOG affordance.
- **Location (decision needed):** an **overlay strip pinned to the top of the
  viewport** (matches "on top of the 3D display") vs a block in the right sidebar.
  Recommend the viewport overlay, toggled by a pin control, so it sits over the 3D
  view as requested; the right sidebar stays the editing surface.
- **State:** `explorer.pinPalette: boolean` (persisted, additive — no schema bump),
  plus the pin toggle in the viewport toolbar (near the existing controls).
- Reuse the `rampChipStyle` + grid markup already in `ThemeRamp` (extract a small
  `PaletteStrip` component shared by the Export panel and the pin overlay).

## Recommendation on 3D vs pin for the 2-D palette

Keep the **3D viewport showing the base 1-D ramp** (the spatial path + its stops,
clearly differentiated), and let the **pin overlay carry the full exported palette**
(1-D or 2-D grid). Scattering 100+ grid cells into 3D (e.g. 11×12) is visually noisy
and most expand variants (tints/shades) have no meaningful independent 3D path.
Harmony rows *do* have real 3D paths (rotated ramps) — a later option could let the
user toggle "show all harmony ramps in 3D" — but v1 should not auto-scatter the grid.
**Decision needed:** confirm "base ramp in 3D, full palette in the pin overlay."

## Observations / additions

- **Read-only vs interactive.** Only source points are interactive (draggable);
  stops and grid cells are outputs. So the hover-cursor hit-test targets source
  points only — keeps the model unambiguous and the per-frame hit-test cheap.
- **Draw-call batching.** Stops are drawn one `drawArrays` per marker today; fine for
  a 1-D ramp. If grid markers ever go into 3D, batch via instancing (a single
  instanced point draw) to avoid ~100 calls/frame.
- **CVD consistency.** Markers already apply `simulateCvdSrgb`; the pin panel must too,
  so the pinned preview matches the viewport and the inspector.
- **Selection legibility.** With differentiated markers, also reflect
  `selectedPoint` in the pin/inspector (and consider click-to-select from the pin).
- **Accessibility.** The pin toggle must be keyboard-reachable; pinned swatches need
  `title`/`aria-label` with hex; the hover cursor is a mouse affordance only (don't
  regress touch).
- **Naming for the code/UI:** "anchor/source points" = `theme.points`; "generated
  stops" = `theme.stops`; "palette" = `theme.grid`. Keep these consistent in labels
  and help copy.
- **Tangential cleanup:** `theme.aa` is now dead state (unused since the Place stage
  replaced WCAG-fit) — drop it from the persisted theme while we're touching theme
  state (Playbook B removal, no bump).

## Suggested staging (each shippable, with a commit between)

1. **Marker differentiation + occlusion fix** — `mark` shader gains `uSize`/`uRing`;
   renderer draws source points vs stops in distinct styles and stops always-visible
   (ghost pass). Resolves #1 (appearance) and #2.
2. **Hover cursor** — idle hit-test in `onPointerMove`, `hoverPointIndex` runtime
   state, cursor derivation. Resolves #1 (cursor).
3. **Pin palette overlay** — `pinPalette` state + toolbar toggle + `PaletteStrip`
   component (1-D ramp or 2-D grid), wired to the gamut-mapped export set. Resolves #4
   and the display side of #3.
4. **Parity + cleanup** — confirm displayed == exported (OOG affordance everywhere),
   optional `theme.aa` removal, optional "harmony ramps in 3D" toggle.

## Risks

- **Depth ghosting** can look busy with many stops; keep the occluded-pass alpha low
  and the size small.
- **Idle hit-test cost** — guard to mouse pointer-moves and a small radius; it only
  projects source points (typically 2–7).
- **Pin overlay vs viewport real estate** — make it compact and toggleable; never
  cover the gesture-help/toolbar.
- **State additions** are additive (`pinPalette`) — no migration; `theme.aa` removal
  is a Playbook-B omit with a parse-test fixture.
