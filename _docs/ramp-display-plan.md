# Plan: Ramp Display & Interaction on the 3D Viewport

Status: proposal (revised after the `generated-stops-issues.png` capture). Follows
the completed `ramp-pipeline-plan.md`. Scope is the *presentation and interaction*
of ramp colors in the 3D viewport + a reusable palette surface.

## What the capture shows (corrected diagnosis)

In `generated-stops-issues.png`: 3 interpolated stops + 6 generated (Expand) stops,
with **surface constraint off** and the **cylinder cut shrunk to a thin column** —
so nothing is depth-occluded, yet the **generated stops still don't appear in 3D**.
Conclusions, replacing the earlier depth-occlusion theory:

- **`theme.grid` (the Expand palette) is never rendered in 3D.** Only `theme.stops`
  (the 1-D base ramp) and `theme.points` get markers. The generated cells — the
  thing you actually export — have world positions (`stopFromSrgbLin` computes
  `world`) but are simply not drawn.
- **Display ≠ export.** The Export panel's preview strip always renders
  `theme.stops`, even when `expand !== 'none'` and the exported text is the grid.
  So the user sees 3 base swatches while exporting 18 — confusing. The viewport
  shows neither the grid nor the post-map palette.
- Source points and stops still share one marker style (indistinguishable), and
  there is still no idle hover cursor (the background `grab`/`grabbing` already
  exists in `app.css`).

So the direction changes: **the 3D should show every ramp and stop**, occlusion is
solved by **making the solid translucent** (a real Explorer parameter), and the
**palette is a reusable component** shown as a desktop overlay / mobile tab. Earlier
"base ramp in 3D, grid only in the pin" recommendation is dropped.

## Requirements (from the user)

1. **3D displays all ramps and stops** — source points, the interpolation curve,
   placed stops, and every generated (Expand grid) cell — with **per-aid show/hide
   toggles**, each placed in the panel that *produces* that aid (referent grouping).
2. **The color solid gets an alpha (opacity) parameter** in the Explorer pipeline,
   so you can see stops/curves *through* the solid (transparency instead of ghosting).
3. **Displayed colors must equal the gamut-mapped exported colors**, in 3D and in the
   export panel (fix the preview/export mismatch; render grid post-map).
4. **A reusable palette component** with a configurable swatch rectangle size (the
   Expand panel already renders cells this way) — reused across Expand preview,
   Export preview, and the pin surface.
5. **Pin placement:** desktop = overlay on top of the 3D explorer; **mobile = an
   additional tab** in the bottom panel set (`RightInspector`, alongside
   transfer/cones/xy/values).

## Design

### A. Render all ramp geometry in 3D, each toggleable

Add markers/curves for the full ramp output, gated by per-aid visibility flags:

| Aid | Drawn from | Visibility toggle lives in | Default |
|---|---|---|---|
| Source points | `theme.points` | **Sources** step | on |
| Interpolation curve | `theme.splineCurve` | **Interpolate** step | on |
| Placed stops | `theme.stops` | **Place** step | on |
| Generated palette cells | `theme.grid` (flattened) | **Expand** step | on |

- Each toggle is a persisted boolean on `theme` (e.g. `showPoints`, `showCurve`,
  `showStops`, `showPalette`). Additive fields, factory default `true`, no schema bump.
- Grid cells render as markers at each cell's `world` (already computed, post-map).
  Optionally (later) draw a faint connecting curve per grid **row** (each harmony row
  / tonal row is its own ramp) — defer to keep v1 clean; the per-aid toggle makes
  clutter manageable.
- **Batch the markers.** Today each marker is its own `drawArrays(POINTS,1)`. With a
  grid (e.g. 3×6=18, harmony up to 4×N) plus stops + points, switch the marker pass
  to **instanced points** (one buffer of positions+colors+style, one instanced draw)
  to keep it a couple of draw calls. This also makes per-aid layers cheap.

### B. Distinguish marker roles + hover cursor

- **Marker styles** via uniforms/instance attributes on the shared `mark` shader
  (`uSize`, `uRing`): source points = larger with a bold ring (interactive, selected
  keeps the gold ring); placed stops = medium dots; palette cells = small dots; hover
  probe unchanged. Enough to read inputs vs outputs at a glance.
- **Hover cursor**: idle hit-test in `onPointerMove` (when `!dragging`, mouse only)
  against source points → `hoverPointIndex` runtime state → cursor `pointer` over a
  draggable point, `grab` over the background (already present), existing cursors for
  active gestures. Only source points are interactive; stops/cells are read-only.

### C. Translucent solid (occlusion via alpha)

- Add `explorer.solidAlpha` (persisted, ~0.15–1, default 1). Render the solid with
  blending at that alpha; when `< 1`, drop `depthMask` for the solid so ramp markers
  and curves behind it remain visible (and read as "inside" through the glass).
- **Home:** the **Gamut** step (the solid *is* the active gamut made visible) — it
  sits with the solid's other appearance settings. (Judgment call; alternative is a
  neutral "Solid" control, but Gamut is the cleanest referent.)
- This replaces the earlier ghost-pass idea; transparency is the user-requested and
  more general mechanism (also helps see the curve/stops in normal use).

### D. Display == export parity

- **Export panel preview** renders the **grid** when `expand !== 'none'` (reuse the
  palette component), matching the exported text; the 1-D ramp otherwise.
- **3D + every preview use post-map colors** (`finalizeRamp` for stops, `buildExpand`
  per cell). Carry the OOG affordance (dashed outline) consistently into 3D markers
  (e.g. a distinct ring/!inG tint) and the palette component, so `gamutMap: 'none'`
  reads as "out of gamut" everywhere instead of silently clamping in one place.
- Audit that no displayed surface reads `rawStops` where it should read `stops`.

### E. Reusable `PaletteStrip` component

- Extract the existing Expand-grid markup into `components/PaletteStrip.svelte`:
  props `rows: ThemeStop[][]` (or `stops: ThemeStop[]` for 1-D), `swatchSize`
  (px rectangle, configurable), `cvd`/`cvdSev` for preview, optional click→select.
- Reuse in: the **Expand panel** preview, the **Export panel** preview, the **pin
  overlay** (desktop), and the **mobile pin tab**. Single source of truth for "how a
  generated palette looks," matching export.

### F. Pin surface — desktop overlay / mobile tab

- `explorer.pinPalette: boolean` (persisted) + a pin toggle in the viewport toolbar.
- **Desktop:** a compact `PaletteStrip` **overlay** pinned at the top of the viewport
  (over the 3D), shown when `pinPalette` is on; never covers the toolbar/gesture help.
- **Mobile:** add a **`palette` tab** to `RightInspector` (which stacks below the
  viewport on mobile) next to transfer/cones/xy/values, rendering the same
  `PaletteStrip`. Drive desktop-overlay vs mobile-tab off the existing mobile
  breakpoint; the pin toggle governs the desktop overlay.
- The tab/overlay always shows the **final exported set** (1-D ramp or 2-D grid),
  independent of which pipeline steps are expanded.

## Observations / additions

- **Marker count / perf** — instancing (design A) is the enabler; without it, large
  harmony/tints grids would spam draw calls.
- **Transparency ordering** — a translucent solid with markers-after + `depthMask`
  off gives "always-visible inside" for free; we don't need sorted OIT for v1. If the
  solid should still occlude *opaque* aids when alpha≈1, gate the depthMask drop on
  `solidAlpha < 1`.
- **Per-row curves** for the grid (harmony especially) are compelling but defer; the
  palette tab already communicates the full set.
- **Selection from the palette** — clicking a source-point swatch could select it
  (ties into B's differentiation); nice-to-have.
- **Naming:** anchor/source points = `theme.points`; placed stops = `theme.stops`;
  palette = `theme.grid`. Keep labels/help consistent.
- **Dead state:** `theme.aa` is unused since the Place stage — drop it (Playbook-B
  omit) while touching theme state.
- **`hideAids` interaction** — the master "hide viewport aids" should also hide these
  ramp aids (or they get their own grouping); decide whether ramp markers count as
  "aids" under that toggle (recommend: yes, they're overlays).

## Suggested staging (a commit between each)

1. **Parity fix (smallest, highest-value):** Export-panel preview shows the grid when
   expanded; confirm post-map everywhere; extract `PaletteStrip` and reuse in Expand +
   Export. (Resolves #3, #4, and the immediate confusion in the capture.)
2. **Render the full ramp in 3D:** instanced marker pass + draw `theme.grid`; per-aid
   `show*` toggles in Sources/Interpolate/Place/Expand. (Resolves #1.)
3. **Translucent solid:** `solidAlpha` + Gamut-step slider + blended render. (Resolves
   #2, improves visibility generally.)
4. **Marker differentiation + hover cursor.** (Polish for #1.)
5. **Pin surface:** `pinPalette` + toolbar toggle + desktop overlay + mobile
   `RightInspector` tab, all via `PaletteStrip`. (Resolves #5.)
6. **Cleanup:** drop `theme.aa`; reconcile with `hideAids`.

## Risks

- **Transparency + depth** can look muddy; tune default alpha and the depthMask rule.
- **Instanced marker refactor** touches the hot render path — keep the existing
  per-marker path until the instanced one is verified, then switch.
- **Mobile tab** must not bloat the bottom panel; the palette tab reuses the same
  canvas/markup budget as the other instruments.
- **State additions** are additive (`show*`, `solidAlpha`, `pinPalette`); `theme.aa`
  removal is a Playbook-B omit with a parse-test fixture. No schema bump expected.
