# Plan: Multi-space Color Picker + Multiple Source Lists

Status: design + phased implementation. Two features requested by the owner.

## Feature 1 — Multi-space color picker

A classic 2-D plane + vertical bar picker that works in **any registered color
space**, one space at a time, with a selectable **bar axis** (which of the
space's three channels rides the vertical bar; the other two span the plane).

### Space registry (extensible)

The interp registry (`color/interp.ts`) already gives every space
`fromSrgbLin` / `toSrgbLin` / `cyclic`. Extend `InterpSpace` with **channel
metadata** so any current or future space is automatically pickable:

```ts
channels: [{ name: string; min: number; max: number }, ×3]
```

Additions to the registry (valid interpolation spaces too, so the spline
gains them for free):

- **`hsv`**, **`hsl`** — the standard sRGB picking mechanisms (hue cyclic).
- **`okhsl`** — Björn Ottosson's second picker space, ported verbatim from
  `ok_color.h` (`get_ST_mid`, `get_Cs`, `okhsl_to/from`), reusing the existing
  `toe`/`toeInv`/`findCusp`/`findGamutIntersection` in `color/okhsv.ts`.
  Reference: bottosson.github.io/posts/colorpicker/ + /misc/colorpicker/.

### Component — `ColorPicker.svelte`

- Props: `value: Vec3 (srgbLin)`, `onchange(srgbLin)`.
- Controls: space `<select>` (from the registry), **bar-axis** `<select>`
  (defaults to the hue channel when the space has one, else channel 0), hex
  field + swatch.
- **Plane canvas**: low-res `ImageData` (≈120²) upscaled; pixel = space coords
  (x → channel i, y → channel j inverted, bar channel fixed) → `toSrgbLin` →
  encode. **Out-of-sRGB regions render clamped and dimmed** so the gamut
  boundary is visible (gamut-anchored spaces — HSV/HSL/OKHSV/OKHSL — are fully
  in-gamut by construction). Marker ring at the current coords.
- **Bar canvas**: 1-D strip of the bar channel with the plane channels held.
- Drag on plane/bar updates coords live; committed color is `clamp01`-ed
  (sources are in-gamut colors; OOG generation stays the ramp pipeline's job).
- Redraws are rAF-throttled; the plane only re-renders when space, bar axis,
  or bar value changes.

### Integration

Sources panel: when a source point is selected, the picker **edits it live**;
with no selection it stages a color with an "Add as new point" button. (The
picker is a reusable component; other future surfaces can mount it.)

## Feature 2 — Multiple source lists (multi-spline)

### Data model (schema v8 — breaking)

```ts
theme.lists: ThemeAnchor[][]   // replaces theme.points
theme.activeList: number       // persisted; clamped on load
```

Migration v7→v8: `lists = [points]`, `activeList = 0`. Interpolation/place
settings (mode, space, steps, place policy, …) remain **shared across lists**
in v1; per-list overrides are a possible follow-up.

### Pipeline

`interpolateRamp` and `placeStops` become pure per-list functions
(take a points list / curve, return results). `buildRamp`:

```text
curves   = lists.map(interpolate)        // SplineSample[][] (runtime)
rawRows  = curves.map(place)            // ThemeStop[][]
rows     = gamut-map per row            // post-map
grid     = expandOn ? spread(rows) : (lists > 1 ? rows : [])
```

Active-list aliases keep the existing UI working unchanged:
`splineCurve = curves[active]`, `stops = rows[active]`,
`rawStops = rawRows[active]`. The Expand row-generator multiplies **each**
base row, so multi-list × harmony composes naturally. `grid` is non-empty
whenever output is 2-D (expand on, or >1 list) — display == export holds.

### UI / display

- **Sources panel**: a list-chip row (`1 … N`, `+` add, `×` remove — min 1
  list); the points list, Set A/B, Add point, picking and dragging all target
  the **active list**. Status shows `L lists · N pts` when L > 1.
- **3D**: all lists' curves and source points draw (each list is its own
  ramp); selection ring and drag/Delete/nudge apply to the active list only.
- **PaletteStrip** already renders ragged rows (lists of different lengths) in
  both layouts — no change needed; grid exports likewise handle ragged rows.

### Phases

| Phase | Content |
|---|---|
| P1 | Registry channels + hsv/hsl/okhsl + `ColorPicker.svelte` + Sources integration |
| P2 | Multi-list engine + schema v8 + migration + tests |
| P3 | Multi-list UI (list chips), viewport interaction, renderer rows |

Each phase = verified commit (`check` / `test` / `build`).
