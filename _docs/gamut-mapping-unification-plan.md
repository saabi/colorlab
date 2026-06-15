# Plan: Unify Gamut Mapping into a Single Policy

Status: Proposal and Implementation Plan

---

## 1. Problem

Out-of-gamut (OOG) colors are produced, detected, and mapped in several disconnected places, with two overlapping mapping implementations and an inconsistent application model.

### 1.1 Audit of today's pipeline

**Producers** — colors whose linear sRGB falls outside `[0, 1]`:
- `stopFromWorld` ([`theme.ts`](fe/src/lib/engine/theme.ts) ~L49) and `stopFromOklab` (~L267) mint `ThemeStop.srgbLin` that can be OOG (segment/arc/spread ramps that leave sRGB, spline interpolation in OKHSV/OKLCH overshooting the boundary).
- Spline control points placed on a wide-gamut solid.

**Detectors / reporters** (each computes its own notion of "in gamut"):
- `ThemeStop.inG` — measured against **sRGB** (`srgbLin ∈ [0,1]`), in both `stopFromWorld` and `stopFromOklab`.
- `HoverHit.inGamut` (`picking.ts` L60) — measured against the **active display gamut** cube. Different reference space from the theme.
- UI surfaces: ramp-chip dashed outline ([`ThemeRamp.svelte`](fe/src/lib/components/ThemeRamp.svelte) L105), "OUT OF GAMUT" badge ([`RightInspector.svelte`](fe/src/lib/components/RightInspector.svelte) L151), `OOG` comment in CSS export, `inGamut` field in DTCG export.

**Mappers** — three, with different math and scope:
1. **`fitGamut`** (`theme.ts` L283) — on-demand button ("Fit stops inside sRGB"), per-stop, only OOG stops, constant-`L` chroma **bisection** in Oklab toward sRGB. Functionally equivalent to Ottosson's `preserve-chroma`, reimplemented iteratively.
2. **`GAMUT_CLIP`** registry ([`clip.ts`](fe/src/lib/color/clip.ts)) — 5 analytic Ottosson strategies, applied **during spline generation** via `theme.splineConstraint`.
3. **`clamp01`** — implicit hard per-channel clip, used for display encoding (chips, swatches, shader marks), WCAG luminance, and Oklab arc length. Not a gamut map per se, but it silently disagrees with whatever soft mapping was chosen.

### 1.2 The problems

- **Duplicated math:** `fitGamut`'s bisection duplicates `clip.ts`'s `preserve-chroma` (the analytic version is faster and exact).
- **Two UIs for one concept:** the spline **"Gamut handling"** select and the **"Fit stops inside sRGB"** button both choose how to handle OOG, but only one works per mode and they don't share a method set.
- **Mixed application models:** spline clipping is *baked in during generation*; `fitGamut` is a *destructive on-demand* pass over existing stops. There is no single, predictable place where "OOG → in gamut" happens.
- **Conflated concerns in `splineConstraint`:** that one enum holds both a *geometry constraint* (`free`, `surface` = radial shell snap in world space) and *gamut-mapping strategies* (the 5 clip methods). These are different operations.
- **Inconsistent target gamut:** theme mapping always targets **sRGB**; the viewport/hover use the **active** gamut. Acceptable, but undocumented and surprising.

---

## 2. Goal

One canonical gamut-mapping function and one user-facing **policy**, applied at a single chokepoint, governing OOG handling for every theme mode (segment / arc / spread / spline) and for export. Keep the spline-only *geometry* constraint (`free`/`surface`) separate from the *gamut* policy.

Non-goals: changing how the 3D solid or hover/pick report gamut (viewport concern); per-channel display clamp at final 8-bit encoding stays (it is legitimate device quantization, applied *after* mapping).

---

## 3. Proposal

### 3.0 Status and amendment

This plan originally focused on unifying the terminal ramp gamut-map stage and disentangling it from spline geometry constraints. That work has since evolved in `_docs/surface-constraint-gamut-projection-plan.md`, which is now the canonical plan for shared projection algorithms.

Amendments:

- Keep the distinction between **curve constraint** and **terminal gamut mapping**. Surface projection shapes the interpolated path; terminal gamut mapping reconciles final ramp colors for export/display.
- Treat the method enum as the simple preset layer, not the complete algorithm configuration.
- Introduce a shared projection parameter shape before adding more target gamuts:

```typescript
export interface ProjectionParams {
	method: GamutMapMethod | SurfaceProjectionMethod;
	alpha: number;      // adaptive methods; default 0.05
	focusL?: number;    // future custom neutral-axis focus
	neutral?: 'preserve' | 'radial-fallback' | 'remember-hue';
}
```

- Apply this parameter model to **surface projection first**, because it is easier to evaluate visually and does not change export semantics.
- After the surface UI and tests settle, reuse the same parameter model for terminal `theme.gamutMap`.
- Keep `sRGB` as the first target gamut. Add P3/Rec.2020 through a matrix-based generic boundary solver later.
- Make the current fixed target visible in the UI/help/tutorial before adding target selection:
  - `Gamut Map` shows `Target gamut: sRGB`;
  - pipeline help explains Explorer Gamut controls the studied solid, while Gamut Map controls ramp output;
  - tutorials teach P3/Rec.2020 explorer colors as possibly outside the sRGB output target.

Most convenient implementation order:

1. Finish Surface Projection UI polish: alpha presets, alpha status copy, and clearer path-vs-export wording.
2. Reuse the same parameter shape in terminal `Gamut Map`, but store it separately as `gamutMapParams`.
3. Add `Advanced gamut mapping` UI with the same alpha presets/status, shown only when the selected mapping method can use alpha.
4. Update pipeline node statuses and help copy after both Surface Projection and Gamut Map have params, so the graph reflects both stages consistently.
5. Surface the current fixed target as `sRGB` in UI/help/tutorial copy.
6. Add generic target-gamut solving after parameterized sRGB behavior is stable.
7. Add Explorer display-gamut classification before any GPU-side projection.
8. Consider compression and CPU/GPU code generation only after the clipping/projection surface area stabilizes.

### 3.1 A single gamut-map module

Promote `clip.ts` into the canonical `color/gamut-map.ts` (or keep the filename and widen its API). Single entry point:

```typescript
export type GamutMapMethod =
	| 'none'            // leave OOG (current default; UI shows the dashed-outline warning)
	| 'clip'            // naive per-channel clamp to [0,1] (formalizes the implicit clamp01)
	| 'preserve-chroma' // Ottosson: project at constant L (replaces fitGamut's bisection)
	| 'project-0.5'
	| 'project-cusp'
	| 'adaptive-0.5'
	| 'adaptive-cusp';

// linear sRGB -> linear sRGB inside the destination gamut.
export function mapToGamut(srgbLin: Vec3, method: GamutMapMethod): Vec3;
```

- The 5 Ottosson strategies are the existing `GAMUT_CLIP` functions (already verified against `ok_color.h`).
- `'clip'` formalizes `clamp01` as an explicit, selectable policy.
- `'none'` is identity (preserves today's default behavior of surfacing OOG rather than silently mapping).
- **`fitGamut` is reimplemented** as `mapToGamut(srgbLin, 'preserve-chroma')` per stop and then deleted as a bespoke routine (its constant-L chroma reduction *is* `preserve-chroma`). Optionally retain a `'chroma-bisection'` method aliased to `preserve-chroma` for one release if exact-legacy output matters (it shouldn't; analytic is strictly better).

Destination gamut: **sRGB only** for now (Ottosson cusp constants are sRGB-specific). Design the signature with a future `gamut` parameter; for non-sRGB targets, fall back to a `solidField`-based bisection (gamut-agnostic) — documented as out of scope here. See §7.

### 3.2 Pipeline ordering (decided)

The canonical order for producing a ramp is:

```
interpolate  →  WCAG / even adjust  →  gamut-map  →  encode
```

- **interpolate** — segment/arc/spread/spline produce raw stops (possibly OOG, full chroma).
- **WCAG / even** — optional perceptual adjustments operate on the *raw* interpolated colors (so WCAG sees true chroma, not pre-reduced chroma).
- **gamut-map** — the single policy stage; **always the last color transform**, guaranteeing the result is in gamut even after WCAG nudged lightness.
- **encode** — `clamp01` → 8-bit / display, strictly last and display-only.

This means gamut-map is **not** applied inside `mintStop` (that would map immediately after interpolation, before WCAG/even). Instead:

### 3.2.1 One policy field, one terminal stage

Add a single theme policy:

```typescript
theme.gamutMap: GamutMapMethod   // persisted; default 'none'
```

`stopFromWorld` / `stopFromOklab` remain the only `ThemeStop` minters, but they produce **raw** stops (compute `inG`, no mapping). A single terminal stage applies the policy:

```
finalizeRamp(state) =>            // the last stage of every recompute
   state.theme.stops = state.theme.stops.map(s =>
      remintWith(mapToGamut(s.srgbLin, state.theme.gamutMap)))   // recompute inG/hex/wcag/oklch/world
```

`finalizeRamp` runs as the last step of `buildRamp` (after interpolation) **and** of `fitWcag` / `fitEven` (after their adjustment), so gamut-map is always last regardless of which adjustments the user applied. Because every theme mode funnels through `buildRamp` → `finalizeRamp`, the policy governs segment, arc, spread, **and** spline ramps (plus the hi-res spline curve samples) in one place.

To make the ordering deterministic rather than dependent on button-press sequence, the **recommended** form is to treat WCAG/even as recompute stages (persisted toggles consumed inside `buildRamp` before `finalizeRamp`) rather than destructive one-shot buttons. If that is too large for this pass, the fallback is: keep them as buttons but have each call `finalizeRamp` last — this still guarantees gamut-map runs after WCAG/even, at the cost of order-sensitivity between repeated presses (an existing limitation, not a regression).

### 3.3 Disentangle the spline constraint

`splineConstraint` returns to **geometry only**:

```typescript
splineConstraint: 'free' | 'surface'   // world-space shell snap, not a gamut map
```

The 5 clip strategies move out of `splineConstraint` into the shared `theme.gamutMap`. So a spline can be `surface`-locked (radial shell snap) *and* additionally gamut-mapped by the global policy — orthogonal, composable controls.

Note the interaction: `surface` already lands samples on the active solid's shell; if `gamutMap` is also a clip method, mapping runs at stop finalization on the resulting color. For sRGB display gamut these largely agree; for wide gamuts they differ (shell = active gamut, map = sRGB). Documented.

### 3.4 UI: one control replaces two

- Remove the **"Fit stops inside sRGB"** button.
- Replace the spline **"Gamut handling"** select's clip entries with a **"Gamut mapping"** select shown for **all** theme modes, bound to `theme.gamutMap`. Options: None / Clip (clamp) / Preserve chroma / Project to L 0.5 / Project to cusp / Adaptive (0.5) / Adaptive (cusp).
- Spline keeps a separate, smaller **"Curve constraint"** control: Free / Surface (radial shell) — only in spline mode.
- Keep the OOG dashed-outline + inspector badge; with a non-`none` policy, stops will simply read in-gamut, so the warning naturally disappears once mapped.

Because mapping is the terminal `finalizeRamp` stage applied on each recompute, there is no separate "apply" step — selecting a method maps immediately and reversibly (switching back to `none` restores the raw OOG colors, since mapping is recomputed from the interpolated result, not baked destructively into stored anchors).

---

## 4. Files touched

| File | Change |
|------|--------|
| `color/clip.ts` → `color/gamut-map.ts` | Add `'none'`/`'clip'` to the method union; export `mapToGamut`; keep the 5 Ottosson fns. Re-export old names for one release if needed. |
| `engine/types.ts` | Add `theme.gamutMap: GamutMapMethod` (persisted). Narrow `SplineConstraint` back to `'free' \| 'surface'`. |
| `engine/state.svelte.ts` | Default `gamutMap: 'none'`; `splineConstraint: 'surface'`. |
| `engine/theme.ts` | Add the `finalizeRamp` terminal stage (applies `mapToGamut` per stop, recomputes `inG`/derived fields); call it at the end of `buildRamp`, `fitWcag`, `fitEven`; reimplement/remove `fitGamut`; remove the `splineConstraint`-based clip branch in `buildSplineRamp` (gamut-map now happens in `finalizeRamp`, after interpolation/adjustment). |
| `components/ThemeRamp.svelte` | Remove Fit button; add global "Gamut mapping" select; reduce spline control to Free/Surface "Curve constraint". |
| `documents/schema.ts` | Add `gamutMap` enum coerce + default; narrow `SPLINE_CONSTRAINTS` to `['free','surface']`; **migrate** old clip values (see §5). |
| `documents/snapshot.ts` | Persist `gamutMap`; keep `splineConstraint`. |
| `inspector/help-copy.ts` | Update theme help: one gamut-mapping policy; cite the gamut-clipping reference (already linked). |
| `components/PipelinePopover.svelte` | See §4.1 — no stage change in this pass; only the trailing note is clarified. |
| `color/spaces.test.ts`, `engine/theme-spline.test.ts`, `documents/parse.test.ts` | Update for the merged method set + migration fixture. |

### 4.1 Pipeline popover (`PipelinePopover.svelte`)

This popover documents the **universal per-pixel viewport chain** (Encoded RGB → Linear RGB → XYZ → World space → CVD → Display) and takes only `cvd`/`cvdSev` props — it is not theme-aware. The new gamut-map is a **theme-ramp** stage (interpolate → WCAG/even → gamut-map → encode), which is a *different* pipeline from the one this popover describes.

**Decision for this pass: do not add a stage.** Adding a "Gamut map" box would wrongly imply every viewport pixel is gamut-mapped, which it is not (the solid is in-gamut by construction; hover/pick clamp per channel). Keeping the universal chain unchanged avoids that misrepresentation. We only **clarify the trailing note** so it acknowledges where gamut mapping lives:

> "The display step assumes an sRGB-compliant monitor. Out-of-gamut colors produced by theme ramps are reconciled by the theme's gamut-mapping policy (see Theme panel), not by this viewport chain. Future versions will let you set custom chromaticities and gamma; the pipeline will update to match."

**Conditional follow-up (ties to §7 "apply policy to hover/pick"):** *if* the gamut-map policy is later extended to the viewport/hover readouts, then this popover gains a real **"Gamut map"** step inserted immediately before **Display** (analogous to how the CVD step is rendered), shown enabled only when the active policy ≠ `none` and disabled/dashed otherwise. That requires threading the policy (and `gamutMap`) into the component as a prop. Out of scope for the core unification, but the insertion point and rendering pattern are specified here so the follow-up is a drop-in.

---

## 5. Persistence & migration (breaking — Playbook C)

This **reshapes** an existing persisted enum: `splineConstraint` previously could hold the 5 clip values; those move to the new `gamutMap` field. Per `.cursor/rules/document-persistence.mdc`:

1. Bump `CURRENT_STATE_SCHEMA_VERSION` (→ 3).
2. Add `migrateV2ToV3` in `migrate.ts`: if a saved `theme.splineConstraint` is one of the 5 clip methods, set `theme.gamutMap = <that method>` and `theme.splineConstraint = 'surface'` (it was acting as a clip + the user likely wanted boundary behavior); if it was `'free'`/`'surface'`, keep it and set `gamutMap = 'none'`. Always default `gamutMap` for older saves.
3. Update `toSnapshot`/`schema.ts` together; add a `parse.test.ts` fixture: a v2 save with `splineConstraint: 'preserve-chroma'` migrates to `{ splineConstraint: 'surface', gamutMap: 'preserve-chroma' }`.
4. Note the change in the `migrate.ts` changelog and `documents/README.md` version table.

---

## 6. Step-by-step

1. Rename/extend `clip.ts` → `gamut-map.ts`; add `none`/`clip`; add `mapToGamut`; keep `GAMUT_CLIP` internals. Update imports.
2. `types.ts`/`state.svelte.ts`: add `gamutMap`; narrow `splineConstraint`.
3. `theme.ts`: add `finalizeRamp` (terminal gamut-map stage) and call it at the end of `buildRamp`/`fitWcag`/`fitEven`; delete `fitGamut` bespoke math (or alias to `preserve-chroma`). Remove the clip branch from `buildSplineRamp`'s `worldAt` (keep `surface` radial snap). Keep `stopFromWorld`/`stopFromOklab` producing raw stops.
4. `ThemeRamp.svelte`: swap UI (global select + spline Free/Surface; drop Fit button). Drop `fitGamut` import/handler.
5. Persistence + migration (§5) + tests.
6. Help copy; run `npm run check` and `npm test`.

---

## 7. Open questions / future

- **Target gamut beyond sRGB.** Should `gamutMap` clip to the *active* display gamut (P3/Rec.2020) rather than always sRGB? Requires either per-gamut Ottosson constants or a `solidField`-bisection fallback. Recommend: keep sRGB now (matches export = sRGB hex / `oklch()`), add a `gamut: 'srgb' | 'display'` option later.
- **`fitWcag`/`fitEven` ordering — decided (§3.2):** pipeline is interpolate → WCAG/even → gamut-map → encode. They are not gamut maps; they operate on raw interpolated colors and `finalizeRamp` (gamut-map) always runs after them. Recommended: make them recompute stages so order is deterministic; fallback keeps them as buttons that each call `finalizeRamp` last.
- **Should `'none'` remain the default?** Keeps current "show me the OOG" behavior. Alternative default `'preserve-chroma'` would auto-fix ramps but hides the educational OOG signal. Recommend `'none'` default; the dashed outline keeps teaching.
- **Apply policy to hover/pick readouts?** Currently viewport gamut ≠ theme gamut. Out of scope; revisit if a "show mapped color" inspector toggle is wanted.
