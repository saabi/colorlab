# Per-List Ramp Pipeline Plan

Status: design proposal. Implements Roadmap **#3 (per-list pipeline instances)**
and folds in **#4 (independent main-curve vs extension constraints)** because they
share one breaking schema change. See
[`color-space-role-architecture.md`](color-space-role-architecture.md) §"Source
Lists as Pipeline Instances" and §"Constraint Domains".

## Goal

Today every source list shares **one** global set of ramp pipeline settings. Give
each source list (`theme.lists[i]`) its own pipeline: interpolation, placement,
constraints, expand, and step count — so a document can hold several ramps that
are genuinely different (one spline in Oklab surface-locked, another linear free,
etc.). The terminal gamut-map stays a single shared step (see Decisions). Global
controls become per-list defaults and explicit batch commands.

## Scope

In scope:

- Move the per-ramp pipeline fields off `theme` and into each list.
- Add a separate **extension constraint** (Extend/Expand) distinct from the main
  curve constraint (#4) — additive; defaults to today's behavior.
- One schema bump (v12 → v13) + migration + the four-files-in-sync update.
- Engine: thread a per-list pipeline config through the stage functions.
- UI: edit the **active list's** pipeline; add "apply to all lists" + duplicate.

Out of scope (separate workstreams):

- **White point / chromatic adaptation (#2).** It is a matrix/rendering change in
  `uniforms.ts` with **no persisted fields**, so it does **not** need this schema
  bump and should land independently. Do not couple them.
- Generic target-gamut solver, display-gamut classification.

## Current state (verified)

`ExplorerState['theme']` mixes three kinds of field (`engine/types.ts`):

- **Per-list source data (persisted):** `lists: ThemeAnchor[][]`, `activeList`.
- **Global pipeline settings (persisted):** `mode`, `splineSpace`,
  `splineConstraint`, `surfaceProjection`, `surfaceProjectionParams`,
  `interpolateOn`, `placeOn`, `place`, `arcLong`, `contrastMin`, `contrastMax`,
  `wcagBg`, `expandOn`, `expandRows`, `expandCols`, `gamutMap`, `gamutMapParams`,
  `steps`.
- **Global display toggles (persisted):** `showPoints`, `showCurve`, `showStops`,
  `showPalette`.
- **Runtime/derived (not persisted):** `curves`, `rawRows`, `rows` (already
  **per-list**), `splineCurve`/`rawStops`/`stops` (active-list aliases), `grid`,
  `selectedPoint`, `arm`.

`buildRamp` already maps the stage functions over `theme.lists`, but
`interpolateList`, `placeList`, `buildExpand`, and `finalizeRamp` all read the
**global** `T = state.theme` fields — so every list currently gets identical
settings. That is the whole change: make those functions read a **per-list**
pipeline.

## Target data model

```ts
// engine/types.ts
export interface ConstraintConfig {
  constraint: SplineConstraint;            // free | surface-radial | surface-oklab-chroma | surface-oklab-project
  projection: SurfaceProjectionMethod;
  projectionParams: SurfaceProjectionParams;
}

export interface ListPipeline {
  mode: ThemeMode;
  splineSpace: InterpSpaceChoice;
  interpolateOn: boolean;
  placeOn: boolean;
  place: PlacePolicy;
  arcLong: boolean;
  contrastMin: number;
  contrastMax: number;
  wcagBg: 'white' | 'black';
  steps: number;
  main: ConstraintConfig;          // was splineConstraint/surfaceProjection/surfaceProjectionParams
  expandOn: boolean;
  expandRows: AxisSpreadConfig;
  expandCols: AxisSpreadConfig;
  extension: ConstraintConfig;     // NEW (#4); migration default = { constraint:'free', … }
}

export interface RampList {
  anchors: ThemeAnchor[];
  pipeline: ListPipeline;
}

// theme becomes:
//   lists: RampList[];           (was ThemeAnchor[][])
//   activeList: number;
//   gamutMap: GamutMapMethod;          (stays GLOBAL — shared terminal step)
//   gamutMapParams: GamutMapParams;    (stays GLOBAL)
//   showPoints/showCurve/showStops/showPalette;   (stay global — see decision)
//   …runtime arrays unchanged (already per-list)…
```

## Decisions

- **Which fields go per-list:** every pipeline field above (mode, space, stage
  enables, placement, main + extension constraints, expand, `steps`).
- **Terminal `gamutMap` stays GLOBAL — a single shared step (decided).** The
  output target is **the active colorspace** (Active gamut), and OOG colors are
  reconciled with **one** method choice (`gamutMap`/`gamutMapParams`) applied to
  **all** lists/colors. It is not per-list. Implementation note: the analytic
  mapper is sRGB-specific today, so non-sRGB active targets await the generic
  target-gamut solver (surface-constraint Phase 5); when Active gamut = sRGB (the
  default) this is exactly today's behavior. Export *encoding* for wide-gamut
  output (e.g. `color(display-p3 …)`) is a separate downstream concern.
- **Display toggles stay global** (`showPoints/showCurve/showStops/showPalette`).
  They toggle aid *type* visibility across the viewport, not per-ramp; keeping
  them global limits scope and avoids confusing per-list show/hide. (Open Q: could
  become per-list later.)
- **No separate persisted `defaults` object.** New/duplicated lists **clone the
  active list's pipeline**; the factory default pipeline lives in
  `createAppState`. An explicit **"Apply pipeline to all lists"** command copies
  the active list's pipeline to every list. (Alternative: a persisted
  `theme.defaults` template — rejected for v1 as extra state.)
- **Batch #4 into the same schema bump.** `extension` ships in the v13 shape now
  (its shape mirrors `main`, already specified by the role doc), defaulting to
  `free` so migration is behavior-identical. *Wiring* the Expand stage to honor it
  can land in a later phase without another migration. (Conservative alternative:
  defer `extension` to v14 — rejected to avoid a second migration.)
- **White point (#2) is NOT in this bump** — no persisted fields; independent.

## Persistence & migration (breaking — Playbook C)

Per `documents/README.md` + `.cursor/rules/document-persistence.mdc`:

1. Bump `CURRENT_STATE_SCHEMA_VERSION` 12 → **13** (`engine/types.ts`).
2. `migrateV12ToV13` (`documents/migrate.ts`): build one `ListPipeline` from the
   old global theme fields; map `theme.lists` (`ThemeAnchor[][]`) → `RampList[]`,
   each `{ anchors, pipeline: clone(builtPipeline) }`; set
   `pipeline.extension = { constraint:'free', projection:<old surfaceProjection>,
   projectionParams:<old params> }`; delete the lifted global fields. **Keep
   `theme.gamutMap`/`theme.gamutMapParams` where they are** (shared terminal step —
   not lifted into lists). Append the changelog line.
3. Four-files-in-sync **together**: `engine/types.ts` (shape),
   `engine/state.svelte.ts` (factory: one list with a default `ListPipeline`),
   `documents/snapshot.ts` (`toPersistedExplorer`: serialize per-list pipeline),
   `documents/schema.ts` (`coerceTheme` → coerce `RampList[]` + each
   `ListPipeline`; reuse existing `coerceSurfaceProjectionParams`/
   `coerceGamutMapParams`/`coerceSpread`).
4. `parse.test.ts`: add a **v12 fixture** (global settings + 2 lists) asserting it
   migrates to two lists each carrying the lifted pipeline; round-trip test.
5. Update `documents/README.md` version table.

Note: this also touches the **share** transport — but only via `parseSnapshot`,
which already runs migration, so shared v12 links/files upgrade for free.

## Engine changes (`engine/theme.ts`)

Thread the list's pipeline into the stage functions instead of reading `T`:

- `interpolateList(anchors, pipeline, state, matrices)` — read
  `pipeline.mode/splineSpace/arcLong/main.*`.
- `placeList(curve, pipeline, state, matrices)` — read
  `pipeline.steps/place/contrastMin/Max/wcagBg`.
- `buildExpand` → run **per list** using each `pipeline.expandOn/expandRows/
  expandCols` (today it builds one grid from the base; becomes per-list,
  consistent with `grid` already being "all lists' ramps"). Its `mapCell` keeps
  reading the **global** `theme.gamutMap`/`gamutMapParams`.
- `finalizeRamp` → **unchanged in structure**: it stays the single shared terminal
  step reading the global `theme.gamutMap`/`gamutMapParams` and maps every list's
  rows with that one method. (No per-list threading here.)
- `buildRamp` passes `T.lists[i].pipeline` into the interpolate/place/expand
  calls; active-list aliases (`stops`/`splineCurve`/`rawStops`) keep pointing at
  `activeList`.

Helpers `activeAnchors`/`anchorWorld` adapt to `RampList` (anchors now nested).

## UI changes

- `ThemeRamp.svelte`: bind every pipeline control to
  `explorer.theme.lists[activeList].pipeline.*` instead of `explorer.theme.*`.
  Mechanical but broad (it is the main control surface).
- Add **"Apply pipeline to all lists"** and ensure add-list / duplicate-list copy
  the active pipeline.
- `pipeline-nodes.ts` / `PipelinePopover.svelte`: node statuses reflect the
  **active list's** pipeline.
- A lightweight indicator that lists can differ (e.g. the list chip shows mode).

## Phasing

1. **Data model + migration + engine + active-list UI.** Restructure to
   `RampList`/`ListPipeline`; migrate; thread per-list pipeline through the stage
   functions; point all `ThemeRamp` bindings at the active list. **For a
   single-list document this is behavior-identical.** Largest phase.
2. **Multi-list pipeline UX.** "Apply to all," duplicate-with-pipeline, per-list
   indicators; verify lists with divergent settings render correctly.
3. **Wire extension constraint (#4).** Honor `pipeline.extension` in the Expand
   stage (project/clamp generated variants); add its compact UI. Schema already
   carries the field, so no migration here.

## Test plan

- `parse.test.ts`: v12→v13 migration fixture (global → per-list); coercion of a
  malformed per-list pipeline falls back to defaults; round-trip equality.
- `theme-spline.test.ts`: two lists with **different** `mode`/`splineSpace`/
  `place` produce independent, correct rows (guards against residual global
  reads).
- Default-pipeline parity: a migrated single-list doc reproduces pre-change stops
  exactly (snapshot/byte compare of generated stops).
- `npm run check` + `npm test` green.

## Risks

- **Breadth of `ThemeRamp` rebind** — many bindings move one level deeper; easy to
  miss one and silently keep a global read. Mitigate with the divergent-lists test.
- **`buildExpand` per-list semantics** — confirm the `grid` shape stays what the
  palette/export consumers expect when lists differ.
- **Schema churn** — bundling #4's `extension` field now avoids a second
  migration; if its shape is wrong we pay a v14. Shape is taken from the role doc,
  so risk is low.

## Open questions

- Should display toggles (`showCurve` etc.) eventually become per-list?
- "Apply to all" — also copy `steps`, or only the shaping settings? (Lean: copy
  everything; it is the explicit batch action.)
- Add-list default: clone the **active** list's pipeline, or the **factory**
  default? (Lean: active, matching "new lists inherit current settings".)
