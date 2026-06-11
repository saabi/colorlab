# Plan: Ramp Pipeline v2 + Display Fixes

Status: design + phased implementation plan. Written in response to
[claude-ramp-display-review-handoff.md](./claude-ramp-display-review-handoff.md).
Each phase ends in a verified commit and a "resume here" marker so any follow-on
agent can continue mid-stream.

## 1. Executive summary

**Problems.** (A) Translucent solid shows blend artifacts — back faces composite
over front faces because the solid draws unculled, unsorted, and without depth
writes. (B) `PaletteStrip` regressed the sidebar previews from fluid full-width
chips to fixed 18px squares. (C) The Expand operators (harmony / tints-shades /
spread) are three code paths for one concept — a generalized spread over
hue/chroma/lightness — and the pipeline lacks per-step enable flags and a uniform
data shape. (D) Viewport cursors don't distinguish anchor / solid / background on
idle hover.

**Goals.** Fix A and B with minimal blast radius; redesign the ramp pipeline
around a single `ColorGrid` (= `ThemeStop[][]`) flowing through enableable
stages, with one generalized Spread whose presets reproduce harmony and
tints-shades exactly; polish cursors; keep the display==export invariant.

**Non-goals.** Multiple independent source lists (the grid shape permits it;
deferred), instanced marker rendering (perf follow-up), order-independent
transparency beyond the front-surface model chosen below, screenshot CI.

---

## 2. Issue A — solid-opacity artifacts (fix design)

**Diagnosis confirmed** from `solid-opacity-less-than-1.png`: with
`solidAlpha < 1` the current pass blends all fragments (front *and* back faces,
plus stacked front layers on concave cuts) in draw order with `depthMask(false)`
— back faces composite over front faces → dark wedge artifacts.

**Why not `CULL_FACE`:** the solid is 6×N² instanced quads warped per space mode
in the vertex shader. Winding is not guaranteed consistent-outward across faces
and warps (that is why `CULL_FACE` is globally disabled). Culling would trade
color artifacts for missing-face artifacts per space mode.

**Chosen fix — depth pre-pass (front-surface translucency):** when
`solidAlpha < 1`:

1. **Pre-pass:** draw the solid with `colorMask(false)` and `depthMask(true)` —
   records the nearest surface depth only.
2. **Color pass:** draw the solid again with `depthFunc(LEQUAL)`,
   `depthMask(false)`, blend `SRC_ALPHA, ONE_MINUS_SRC_ALPHA`. Only the
   front-most fragment per pixel survives → exactly one translucent layer, no
   ordering or winding sensitivity, concave cuts handled.
3. Restore `depthFunc(LESS)`, disable blend.

**Aid visibility through the glass:** the pre-pass writes the solid's depth, so
markers/curves behind it would now be depth-rejected. Therefore, when
`solidAlpha < 1`, the ramp-aid passes (hover probe, stops, palette cells, source
points, interpolation curve) draw with `DEPTH_TEST` disabled — always visible
through the translucent solid, which is the feature's purpose. At
`solidAlpha === 1` everything keeps today's opaque path (zero cost, markers
properly occluded — lowering alpha is the "see inside" gesture).

**Interactions audit:** shell pass (additive, depth-test off) unaffected; surface
grid-lines pass already `LEQUAL` + polygon offset + `depthMask(false)` → lands on
the pre-pass depth correctly; floor is depth-tested and will be hidden behind the
solid's depth (acceptable, arguably more correct); outlines honor their own
`outlineDepthTest` flag.

**Test checklist (manual, on a real GPU):** capture scenario — Oklab world, sRGB
gamut, opacity ~0.3–0.7, with and without slice + cylinder cut; verify (a) no
dark wedges, (b) stops/points/curve visible through the solid, (c) markers in
*front* of the solid still draw, (d) opacity 1 identical to before, (e) grid
lines still etch the surface.

Files: `webgl-renderer.ts` only.

---

## 3. Issue B — PaletteStrip layout modes

Add a `layout: 'fixed' | 'fluid'` prop (default `'fixed'`, so the viewport pin
overlay and the mobile inspector tab are untouched).

- **fixed:** current behavior — `swatch`-px squares, rows wrap.
- **fluid:** the pre–Stage-1 sidebar look — each row is `display:flex; gap:2px;
  height: 26px`, cells `flex:1` (no wrap), filling the panel width evenly.
  `swatch` is ignored; a `rowHeight` prop (default 26) covers the old `.ramp`
  height.

Sidebar usages in `ThemeRamp.svelte` (Expand preview, gamut-map raw/final,
Export preview) pass `layout="fluid"`. Acceptance per handoff §3: many-column
expand rows fill the sidebar width; export / raw-vs-final match pre-Stage-1;
viewport pin unchanged.

Files: `PaletteStrip.svelte`, `ThemeRamp.svelte`.

---

## 4. Pipeline v2 — design

### 4.1 Data shape and stage contracts

```ts
// rows = ramps/curves; cols = stops along one ramp. Reuses ThemeStop.
type ColorGrid = ThemeStop[][];
```

```text
Sources      anchors: ThemeAnchor[]                     (one list today; grid-ready)
Interpolate  anchors → curveRows: SplineSample[][]      (enableable)
Place        curveRows → ColorGrid (placed stops/row)   (enableable)
Expand       ColorGrid → ColorGrid (generalized Spread) (enableable)
Gamut map    per-cell policy ('none' IS the off switch — no extra flag)
Export       serialize final ColorGrid
```

`buildRamp` stays the single orchestrator (in `theme.ts`; a separate
`ramp-pipeline.ts` module is optional and deferred — restructuring into explicit
stage functions inside `theme.ts` keeps churn reviewable). Stage outputs kept on
`theme`: `splineCurve` (rename-in-place as the first curve row; `curveRows`
runtime field for all rows), `rawStops`, `stops` (= grid row 0 when 1-D),
`grid`.

### 4.2 Per-step enable flags

New persisted booleans (default `true`): `interpolateOn`, `placeOn`,
`expandOn`. Semantics:

| State | Behavior |
|---|---|
| `interpolateOn: false` | No curve. Stops = the source anchors themselves (each anchor → stop). Place is inapplicable → its controls disabled in UI, status "—". Enables hand-picked palettes (pick N colors, optionally Expand them). |
| `placeOn: false` (interp on) | Curve still built & drawn as an aid; stops = the source anchors (exact picked colors), not resampled. |
| `expandOn: false` | Grid = base ramp only (1 row). |
| Gamut map | `gamutMap: 'none'` already means off — documented equivalence, no new flag. |
| Sources / Export | Always on (disabling is meaningless). |

UI: a `ToggleRow` at the top of each panel ("Enable interpolation" / "Enable
placement" / "Enable expand"); `pipeline-nodes.ts` status shows `Off` when
disabled.

### 4.3 Generalized Spread

All color math in **Oklch** (L, C, h) — harmony is a hue walk, tints a lightness
walk, legacy spread a hue+chroma walk; one mechanism. (Legacy spread fanned in
the *world* cylindrical frame; for Oklab world that is ≈Oklch. Documented minor
behavior change for non-Oklab worlds — principled and world-independent now.)

**Axis spec** (per axis: hue°, chroma, lightness):

```ts
type SpreadDir = 'off' | 'ramp' | 'sym' | 'edges';
type SpreadAxis = { delta: number; dir: SpreadDir };   // delta may be negative
```

Offset of column `t ∈ [0,1]` (t = i/(count−1)):
- `ramp`:  `delta · t` (positive/negative direction via delta sign)
- `sym`:   `delta · (2t − 1)` (−δ → +δ, centered)
- `edges`: `delta · |2t − 1|` (0 at center, δ at both edges — preserves legacy
  `cprof: 'mirror'` exactly)

**Two generator slots** (each `{ count, hue, chroma, light }`):
- **Row generator** — applies its offsets to *every stop of a ramp copy*,
  producing `R` related ramps (harmony lives here).
- **Column generator** — expands *each stop* into `K` variants (tints / spread
  live here).

Output shape: rowGen → `R × S`; colGen → `S × K`; both → `(R·S) × K` (each
(ramp, stop) ladder is a row; export names rows hierarchically `r-s`). Identity
generator = `count ≤ 1` or all axes `off`.

**Preset mapping (exact):**

| Legacy | v2 parameters |
|---|---|
| harmony complementary | rows: count 2, hue `ramp` δ=180 |
| harmony triadic | rows: count 3, hue `ramp` δ=240 → [0,120,240] |
| harmony analogous | rows: count 3, hue `sym` δ=30 → [−30,0,30] |
| harmony tetradic | rows: count 4, hue `ramp` δ=270 → [0,90,180,270] |
| tints-shades | cols: count = expandSteps, light `sym` δ=−0.32 (descending: tint → shade, matching old order) |
| spread | cols: count = expandSteps, hue `sym` δ=dh; chroma `sym` δ=dc (old `cprof:'linear'`) or chroma `edges` δ=−dc (old `'mirror'`) |
| none | both generators identity |

Preset buttons in the Expand panel only *set parameters* (same pattern as the
Segment/Arc/Spline interpolation presets).

**Per-cell math:** base stop → Oklab → (L,C,h) → apply offsets (h += δh;
C = max(0, C+δC); L = clamp01(L+δL)) → `oklab2lsrgb` → gamut-map per policy →
`stopFromSrgbLin`. Same OOG affordance as today.

### 4.4 3D display

Each output grid row gets a faint **polyline through its stops' world positions**
(the deferred "per-row curves"), drawn in the existing spline-line pass style at
low alpha, gated by `showPalette` (no new toggle). The base interpolation curve
keeps `showCurve`. Markers unchanged (Stage-4 sizes).

### 4.5 Schema migration (v6 → v7)

Breaking (field replacement) → bump `CURRENT_STATE_SCHEMA_VERSION` to 7.

- Remove: `expand`, `harmony`, `expandSteps`, `dh`, `dc`, `cprof`.
- Add: `expandOn: boolean`, `expandRows: AxisSpreadConfig`,
  `expandCols: AxisSpreadConfig`, `interpolateOn`, `placeOn`.
- `migrateV6ToV7`: map legacy fields per the preset table above
  (`expand:'none'` → `expandOn:false` + identity generators). Fixtures in
  `parse.test.ts` for each legacy expand value.
- `migrate.ts` changelog entry; playbook rules followed (types / state defaults /
  snapshot / schema / fixtures together).

**Equivalence tests** (`theme-spline.test.ts`): for each legacy preset, run the
migrated v2 parameters and assert the produced grid matches the pre-migration
algorithm's output within 1e-6 (implement the old formulas inline in the test as
the oracle).

### 4.6 Phases (each = verified commit; resume markers)

| Phase | Content | Resume marker |
|---|---|---|
| **A** | Issue A renderer fix | `git log` contains "solid translucency depth pre-pass" |
| **B** | Issue B PaletteStrip layout modes | "PaletteStrip fluid layout" |
| **C** | Issue D cursor polish | "viewport cursor polish" |
| **D1** | Stage refactor: explicit `sources/interpolate/place/expand/gamut` functions over `ColorGrid` inside `theme.ts`; behavior identical; tests unchanged | "pipeline v2 stage refactor" |
| **D2** | Generalized Spread + presets + v7 migration + equivalence tests; remove harmony/tints/spread code paths | "generalized spread (v7)" |
| **D3** | Per-step enable flags + UI toggles + pipeline-node statuses | "per-step enable flags" |
| **D4** | Per-row 3D curves; mark this plan implemented | "per-row grid curves" |

If interrupted: check the latest "Display/Pipeline v2" commit subject against
this table and continue at the next row. Always: `npm run check`, `npm test`,
`npm run build` in `fe/` before each commit.

---

## 5. Issue D — cursor polish

Idle hover hit-test order **point → solid → background** (mouse only, never on
touch):

| Hover target | Cursor | Implementation |
|---|---|---|
| Source anchor | `move` (4-way drag affordance) | existing `getControlPointAtScreen` (cheap; ≤ ~7 points) on every mousemove |
| Solid surface | `crosshair` (pick/inspect affordance) | `pick()` ray-test, **rAF-throttled** (one pick per frame max) to bound cost |
| Background | `grab` / `grabbing` (orbit) | existing `.cursor-orbit`, already applies at idle |

Active-gesture cursors (pan/slice/cylinder/inspect-drag) unchanged and take
precedence while dragging. `.cursor-point` becomes `cursor: move` (renamed
`cursor-move-point` not needed; just restyle). Short addendum noted in
`camera-and-canvas-gesture-plan.md`.

---

## 6. Open questions for owner (non-blocking; defaults chosen)

1. Spread axis space is now Oklch regardless of world space (legacy spread used
   the world frame). Default: accept; revisit if a world-frame option is missed.
2. When both row and column generators are active the grid flattens to
   `(R·S) × K` rows with hierarchical export names `--ramp-{r}-{s}-{col}`.
   Default: accept.

## 7. Verification checklist (from handoff §7)

- [ ] `npm run check` / `npm test` green per phase
- [ ] Opacity 0.3–0.7: no artifacts; aids visible through solid; opacity 1 unchanged
- [ ] Sidebar palettes fluid; viewport pin fixed
- [ ] Export preview == exported text == 3D markers (post gamut-map)
- [ ] Migrated presets match legacy outputs within tolerance
- [ ] Cursors distinguish anchor (`move`) / solid (`crosshair`) / background (`grab`)
