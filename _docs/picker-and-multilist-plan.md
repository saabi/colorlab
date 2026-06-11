# Plan: Multi-space Color Picker + Multiple Source Lists

Status: **implemented** (P1 picker + sidebar integration; P2 multi-list engine,
schema v8, migration, tests; P3 list-chip UI, multi-list 3D rendering).

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
  See **References** below for the interactive demos and JavaScript sources.

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

### Integration (v1 — anchor points in the sidebar)

**First integration surface:** the **Sources** step in the left sidebar, on
**anchor points** (the existing point rows / Set A / Set B chips). The picker
is a reusable component; other surfaces (viewport inspect, export preview, …)
come later.

**Interaction:**

1. User **clicks an anchor row** in the sidebar → that point becomes selected
   and the **picker opens** (inline below the points list, or in a popover —
   implementation choice in P1).
2. Dragging the plane/bar or editing hex updates the anchor's `srgbLin`
   **immediately**; each change triggers `buildRamp` so the **full pipeline
   recomputes in real time** (interpolate → place → expand → gamut-map):
   curve, stops, grid, 3D markers, and export preview all stay in sync.
3. With **no anchor selected**, the picker stages a color and shows **Add as
   new point** (appends to the active list).

Do not defer live updates to an Apply/OK button for v1 — the owner expects
sidebar anchor editing to feel like direct manipulation of the ramp.

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
| P1 ✅ | Registry channels + hsv/hsl/okhsl + `ColorPicker.svelte` + **sidebar anchor integration** (click anchor → open picker → live `buildRamp`) |
| P2 ✅ | Multi-list engine + schema v8 + migration + tests |
| P3 ✅ | Multi-list UI (list chips), viewport interaction, renderer rows |

Each phase = verified commit (`check` / `test` / `build`).

---

## References — Ottosson picker implementations

The plan's plane+bar UI and several picker spaces have **working reference
implementations** that should be mined before writing new math or canvas code
from scratch.

### Interactive demos (UX + axis layout)

| Demo | URL | Relevance |
|------|-----|-----------|
| **Interactive color picker comparison** | [bottosson.github.io/misc/colorpicker/](https://bottosson.github.io/misc/colorpicker/) | Side-by-side pickers for **HSV, OKHSV, OKLrCH, HSL, OKHSL, HSLuv** — each with a 2-D plane + vertical bar and the axis mapping (H / S or C / V, Lr, or L). Use as the primary **interaction and layout reference** for `ColorPicker.svelte` (which channel is horizontal, which is vertical, which rides the bar). |
| **Blog post — Okhsv and Okhsl** | [bottosson.github.io/posts/colorpicker/](https://bottosson.github.io/posts/colorpicker/) | Theory, gamut-anchored construction, Lr toe function, and embedded C++ for OKHSV/OKHSL/HSL/HSV conversions. Already cited in [`references.md`](./references.md). |

### Source code (port / adapt)

GitHub tree: [github.com/bottosson/bottosson.github.io/tree/master/misc/colorpicker](https://github.com/bottosson/bottosson.github.io/tree/master/misc/colorpicker)

| File | Relevance |
|------|-----------|
| [`colorconversion.js`](https://github.com/bottosson/bottosson.github.io/blob/master/misc/colorpicker/colorconversion.js) | **Core conversions** — sRGB ↔ HSV/HSL/OKHSV/OKHSL and shared helpers. Single-file reference; PowerToys and others port this to native code. Start here for HSV/HSL/OKHSL math if not pulling from `ok_color.h`. |
| [`render.js`](https://github.com/bottosson/bottosson.github.io/blob/master/misc/colorpicker/render.js) | **Plane and bar rasterization** — how each picker space fills the 2-D patch and 1-D strip (including out-of-gamut handling for non-anchored spaces like OKLrCH). Direct template for our `ImageData` plane/bar canvases. |
| [`workerokhsl.js`](https://github.com/bottosson/bottosson.github.io/blob/master/misc/colorpicker/workerokhsl.js) | OKHSL-specific worker path (plane generation at picker resolution). |
| [`worker.js`](https://github.com/bottosson/bottosson.github.io/blob/master/misc/colorpicker/worker.js) | Generic worker dispatch for other spaces (HSV, OKHSV, HSL, …). |
| [`workerhsluv.js`](https://github.com/bottosson/bottosson.github.io/blob/master/misc/colorpicker/workerhsluv.js) | HSLuv picker — optional future space; shows another gamut-shaped plane. |
| [`hsluv.js`](https://github.com/bottosson/bottosson.github.io/blob/master/misc/colorpicker/hsluv.js) | HSLuv color math (if we add it to the registry later). |
| [`main.js`](https://github.com/bottosson/bottosson.github.io/blob/master/misc/colorpicker/main.js) | Wires pickers, drag handlers, and space switching — useful for pointer→coord mapping. |

Authoritative C++ header (all spaces + gamut clip): [`ok_color.h`](https://bottosson.github.io/misc/ok_color.h) — already partially ported in [`fe/src/lib/color/okhsv.ts`](../fe/src/lib/color/okhsv.ts) (`toe`, `findCusp`, `findGamutIntersection`, OKHSV). **OKHSL** (`get_ST_mid`, `get_Cs`, `okhsl_to_srgb` / `srgb_to_okhsl`) is not yet in the repo; prefer `ok_color.h` + `colorconversion.js` cross-check when adding it.

### What to reuse vs rewrite

- **Reuse (port or thin-wrap):** OKHSV/OKHSL/HSV/HSL conversion functions; OKHSL plane/bar sampling logic from `render.js` + workers; axis defaults per space (hue on bar when cyclic).
- **Rewrite in Svelte/TS:** Component shell, rAF throttling, sidebar anchor binding, live `buildRamp` wiring — the demo is vanilla JS + workers, not a component library.
- **Extend beyond Ottosson:** Generic registry-driven picker for Oklab, OKLCH, CIELAB, etc. — use the same plane+bar pattern but `interp.ts` `fromSrgbLin`/`toSrgbLin` instead of `colorconversion.js`; dim OOG cells like OKLrCH in the demo.

Also listed in project [`references.md`](./references.md) under **Björn Ottosson** for cross-linking.
