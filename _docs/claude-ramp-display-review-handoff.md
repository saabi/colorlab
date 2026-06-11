# Review & handoff: ramp display work + follow-up plan

**Audience:** Claude (or any follow-on agent)  
**Purpose:** Evaluate recent ramp-display commits, fix known regressions, and **design** a second-generation ramp pipeline + interaction polish.  
**Status:** Review from project owner — **not** an implementation spec. Claude must produce the detailed design, migration plan, and task breakdown.

**Do not treat this document as finished design work.** It captures problems, intent, constraints, and pointers into the codebase. The robust plan (phases, schema changes, UI wireframes, test matrix, rollback strategy) must be written by Claude in a new plan doc.

---

## 1. Scope of recent work (context)

The following commits shipped the [ramp-display-plan.md](./ramp-display-plan.md) (marked implemented in `243e7a8`):

| Commit | Summary |
|--------|---------|
| `17edff7` | **Stage 1:** `PaletteStrip.svelte`; export preview shows exported set (grid when expanded) |
| `12468f0` | **Stage 2:** Full ramp in 3D — points, curve, stops, palette grid; per-aid toggles on producing steps |
| `7f41833` | **Stage 3:** `solidAlpha` — translucent color solid for see-through occlusion |
| `9058c43` | **Stage 4:** Marker size differentiation; idle hover cursor over draggable source points |
| `0077e4f` | **Stage 5:** Pinned palette overlay (desktop) + palette inspector tab (mobile) |
| `0a50ddc` | **Stage 6:** Drop dead `theme.aa`; `hideAids` also hides ramp overlays |
| `243e7a8` | Mark plan complete |

Prior pipeline work ([ramp-pipeline-plan.md](./ramp-pipeline-plan.md)) already unified Sources → Interpolate → Place → Expand → Gamut-map → Export, including harmony expand (`f5be46b`).

**Key files touched:**

- [`fe/src/lib/components/PaletteStrip.svelte`](../fe/src/lib/components/PaletteStrip.svelte) — reusable swatch grid
- [`fe/src/lib/components/ThemeRamp.svelte`](../fe/src/lib/components/ThemeRamp.svelte) — sidebar ramp UI; now uses `PaletteStrip` for expand/export/gamut previews
- [`fe/src/lib/components/Viewport.svelte`](../fe/src/lib/components/Viewport.svelte) — 3D aids, pin overlay, cursor modes
- [`fe/src/lib/components/RightInspector.svelte`](../fe/src/lib/components/RightInspector.svelte) — mobile palette tab
- [`fe/src/lib/renderer/webgl-renderer.ts`](../fe/src/lib/renderer/webgl-renderer.ts) — solid draw, ramp markers/curves
- [`fe/src/lib/engine/theme.ts`](../fe/src/lib/engine/theme.ts) — `buildExpand`, harmony/spread/tints-shades

**Captures (local, may be untracked — add to repo when planning):**

- [`_docs/solid-opacity-less-than-1.png`](./solid-opacity-less-than-1.png) — translucent solid color artifacts (Issue 2 below)
- [`_docs/generated-stops-issues.png`](./generated-stops-issues.png) — earlier diagnosis that motivated display work (grid not in 3D, export mismatch)

---

## 2. Issue A — Solid opacity artifacts

### Symptom

With **Solid opacity** &lt; 1 (`explorer.solidAlpha`), strange color artifacts appear on the 3D solid. See capture: `_docs/solid-opacity-less-than-1.png`.

### Current implementation (likely cause)

In [`webgl-renderer.ts`](../fe/src/lib/renderer/webgl-renderer.ts) `draw()`:

- `gl.disable(gl.CULL_FACE)` is set globally (line ~81).
- When `solidAlpha < 1`:
  - `gl.enable(gl.BLEND)` with `SRC_ALPHA, ONE_MINUS_SRC_ALPHA`
  - **`gl.depthMask(false)`** — translucent solid does **not** write depth
  - Solid is drawn as instanced triangle strips (6 × N² quads per face)

Intent (from ramp-display-plan): see ramp markers **through** the solid without depth-occluding them.

**Hypothesis:** Without back-face culling and without depth writes, **back-facing fragments composite with front-facing fragments** (and possibly with each other out of order), producing muddy/incorrect colors especially where the mesh folds or self-overlaps in view space.

### Owner request

When opacity &lt; 1, either:

1. **Cull back-facing triangles**, or  
2. Ensure back faces are **depth-tested** so they do not incorrectly blend on top of front faces.

Preserve the original goal: ramp aids behind the surface should remain visible.

### Claude must decide

- Whether to enable `CULL_FACE` only when `solidAlpha < 1` (front faces only) vs always.
- Whether translucent pass should use `depthMask(false)` only for aids, not for the solid — or a two-pass approach (opaque depth pre-pass + alpha color pass).
- Interaction with shell pass, grid lines, outlines, and ramp marker depth (markers drawn after solid; see ~line 198+ in renderer).
- Regression test strategy (visual/manual checklist; no screenshot CI required unless easy).

**Do not ship a fix without verifying against the capture scenario** (typical gamut, slice/cylinder optional, opacity ~0.3–0.7).

---

## 3. Issue B — PaletteStrip sidebar regression

### Symptom

`PaletteStrip` works well as a **fixed-size swatch grid** on the viewport pin overlay (`swatch={16}`) and inspector tab (`swatch={22}`).  

On the **left sidebar** (`ThemeRamp.svelte`), replacing the old markup changed appearance undesirably. Sidebar palettes should look **as before**: chips **resize to fill available width**, not fixed pixel squares that wrap awkwardly.

### Before (commit `17edff7^`)

Expand preview used fluid layout:

```svelte
<div class="palette-grid">
  {#each explorer.theme.grid as row}
    <div class="ramp">
      {#each row as cell}
        <div class="ramp-chip" style={rampChipStyle(cell)} />
      {/each}
    </div>
  {/each}
</div>
```

CSS: `.ramp { display: flex; gap: 2px; height: 26px }`, `.ramp-chip { flex: 1 }` ([`app.css`](../fe/src/app.css) ~1113–1124).

### After (current)

`ThemeRamp` uses `<PaletteStrip rows={...} />` with **default `swatch=18`** and **fixed width/height per cell** — no `layout="fluid"` variant.

Usages in sidebar:

- Expand preview: `PaletteStrip rows={explorer.theme.grid}`
- Gamut map raw/final: `rows={[rawStops]}`, `rows={[stops]}`
- Export preview: `rows={grid or [stops]}`

### Owner request

- **Keep** `PaletteStrip` for viewport overlay / inspector (fixed swatch size is correct there).
- **Restore** sidebar behavior: full-width fluid chips like the old `.ramp` / `.ramp-chip` pattern.
- Prefer **one component with two layout modes** (e.g. `layout="fluid" | "fixed"`) over duplicating markup — but Claude chooses API.

### Acceptance

- Expand grid with many columns: one row fills sidebar width evenly.
- Export / raw-vs-final strips: same fluid behavior as pre–Stage 1.
- Viewport pin unchanged.

---

## 4. Issue C — Second-generation ramp pipeline (major redesign)

### Owner observation

The current **Expand** operators (`harmony`, `tints-shades`, `spread` in [`theme.ts` `buildExpand`](../fe/src/lib/engine/theme.ts)) are **special cases** of a more general **spread** generator. The pipeline can be expressed as transformations on a **`list of lists of colors`**, with optional enable flags per stage.

Claude must **design** this pipeline and a **migration plan** robust enough for another agent to continue if credits run out.

### Conceptual model (owner intent — Claude refines & specifies)

```text
Data shape throughout: ColorGrid = Color[][]
  (outer list = "ramps" / rows / curves; inner list = stops along one curve)

Sources     →  ColorGrid   (starts as anchor lists)
Interpolate →  ColorGrid   (optional per-step; produces curves per input list)
Place       →  ColorGrid   (stop placement along each curve)
Expand      →  ColorGrid   (generalized spread; may add rows and/or columns)
Gamut map   →  ColorGrid   (terminal policy per cell)
Export      →  serialized from final grid
```

**Per-step enable checkbox:** Each pipeline stage can be toggled active/inactive (persisted). When inactive, pass through previous grid unchanged (Claude must define edge cases: e.g. Interpolate off with multiple source lists).

#### Interpolate

- For **each inner list** (anchor sequence), if Interpolate is on: generate a **curve** between anchors per current settings (path type, space, spline constraint, etc.).
- Output: one curve per input list → still `ColorGrid` (each row is a high-res or sampled curve; Place reduces to stops).

Claude: reconcile with existing `interpolateRamp`, `splineCurve`, `rawStops`, `stops`.

#### Place

- For each curve, compute stop placement (even, uniform, tones, contrast ladder — existing policies).
- Output: `ColorGrid` of placed stops (one row per curve).

#### Expand (generalized spread)

Replace separate **Harmony** and **Tints & shades** operators with an extended **Spread**:

| Axis | Spread capability (requested) |
|------|-------------------------------|
| Hue | delta, direction: positive / negative / symmetric (mirrored) |
| Chroma | same |
| Lightness | same (subsumes tints-shades) |

- Spread operates on a **curve** (one row); Expand applies it to produce **additional rows** (related ramps) and/or **columns** (variants along each stop) — Claude must define the exact algebra so Harmony (rotate whole ramp hue) and Tints (L walk per stop) are **presets** or parameterizations of Spread, not parallel code paths.
- **Each resulting curve instance should be drawable in the 3D viewport** (extend current `showCurve` / grid row curves; ramp-display plan deferred "per-row curves").

#### Gamut map & Export

- Unchanged in role; operate on final `ColorGrid`.
- Keep **display == export** invariant from ramp-display work.

### Migration requirements (Claude must document)

1. **Schema / snapshot versioning** — map `expand`, `harmony`, `dh`, `dc`, `cprof`, `expandSteps` to new Spread params; backward compatibility or one-time coercion.
2. **UI** — pipeline steps in left sidebar ([`LeftControls.svelte`](../fe/src/lib/components/LeftControls.svelte), [`pipeline-nodes.ts`](../fe/src/lib/components/pipeline-nodes.ts)); Expand panel becomes Spread controls.
3. **3D display** — [`webgl-renderer.ts`](../fe/src/lib/renderer/webgl-renderer.ts) marker/curve passes; per-aid toggles.
4. **Tests** — extend [`theme-spline.test.ts`](../fe/src/lib/engine/theme-spline.test.ts); property tests that old presets ≈ new spread presets.
5. **Phased rollout** — e.g. Phase 0: design doc; Phase 1: internal `ColorGrid` type + pass-through; Phase 2: generalized Spread behind feature flag; Phase 3: remove harmony/tints code paths; Phase 4: per-step enable flags.
6. **Definition of done** per phase so work is resumable.

### Related docs (read before designing)

- [`ramp-pipeline-plan.md`](./ramp-pipeline-plan.md) — completed Stage 1–3 pipeline
- [`ramp-display-plan.md`](./ramp-display-plan.md) — 3D/display layer (implemented)
- [`gamut-mapping-unification-plan.md`](./gamut-mapping-unification-plan.md) — gamut policy chokepoint
- [`pipeline-node-ui-proposal.md`](./pipeline-node-ui-proposal.md) — sidebar pipeline UX

### Suggestions for Claude (non-binding)

- Introduce a single `RampPipelineState` or `ColorGrid` module (`fe/src/lib/engine/ramp-pipeline.ts`) as the only place stages chain; `buildRamp` becomes a thin orchestrator.
- Model Spread as **outer product** of 1-D generators along hue/chroma/L axes (each generator: `none | positive | negative | symmetric`), then Cartesian-expand rows/columns — may simplify replacing harmony vs tints vs per-stop spread.
- Keep **preset buttons** in UI ("Harmony: triadic", "Tints & shades") that only set Spread parameters.
- Consider whether `theme.grid` remains runtime-only or becomes the canonical persisted shape when Expand is on.

---

## 5. Issue D — Cursor feedback on viewport (polish)

### What works

Marker size differentiation (points / stops / palette cells) — **keep**.

### Gaps (owner request)

| Hover target | Desired cursor | Current behavior |
|--------------|----------------|------------------|
| **Source anchor** (draggable point) | Move / 4-way drag (e.g. `cursor: move` or `grab`) | `cursor-point` → `pointer` ([`Viewport.svelte`](../fe/src/lib/components/Viewport.svelte) ~78, 437–440; [`app.css`](../fe/src/app.css) `.cursor-point`) |
| **Empty background** (orbit) | Grab / grabbing | `cursor-orbit` when `gesture.kind === 'orbit'` — may not show on **idle** hover before drag |
| **Solid surface** (pick/inspect) | Distinct from orbit — indicate different behavior | No idle hover distinction; inspect uses `cursor-inspect` (crosshair) only during active inspect gesture |

Claude should:

1. Audit all `cursor-*` classes and when they apply (`cursorMode` derived state).
2. Propose idle hit-test order: point → solid → background.
3. Wire pointer move hit-test (already has `getControlPointAtScreen`; may need pick vs miss) without hurting touch.
4. Document in [`camera-and-canvas-gesture-plan.md`](./camera-and-canvas-gesture-plan.md) or a short addendum.

---

## 6. Deliverables expected from Claude

Produce a **new plan document** (e.g. `_docs/ramp-pipeline-v2-plan.md`) containing:

1. **Executive summary** — problems, goals, non-goals  
2. **Issue A fix** — rendering approach, files, test checklist  
3. **Issue B fix** — `PaletteStrip` API / sidebar restore  
4. **Pipeline v2 design** — data types, stage contracts, Spread math, preset mapping from harmony/tints/spread  
5. **Migration** — schema, UI, 3D, tests, phased tasks with explicit "resume here" markers  
6. **Cursor polish** — behavior table + implementation steps  
7. **Open questions** for owner (only if blocking)

Then implement in order: **A and B first** (small, user-visible bugs), then pipeline v2 in phases per the plan.

---

## 7. Verification checklist (global)

- [ ] `npm run check` and `npm test` in `fe/`
- [ ] Solid opacity: no color artifacts per capture; aids still visible through solid
- [ ] Sidebar palettes fluid-width; viewport pin fixed-size
- [ ] Export preview == exported colors == 3D palette markers (post gamut-map)
- [ ] Harmony/tints presets (once migrated) match prior commit outputs within tolerance
- [ ] Cursors: anchor / solid / background distinguishable on desktop mouse hover

---

*Generated for handoff from project owner review. Last context commit on branch: `ff2f918` (sidebar width) + 9 unpushed commits including full ramp-display stack.*
