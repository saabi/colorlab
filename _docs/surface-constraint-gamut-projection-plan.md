# Surface Constraint and Generalized Gamut Projection Plan

## Context

The ramp `Interpolate` step has a `Curve constraint` selector with two current values:

- `Free`: interpolate through the color volume.
- `Surface (radial shell)`: snap each curve sample to the active solid surface.

The current surface constraint is implemented in `fe/src/lib/engine/theme.ts` as `snapToSurface()`. It works in active viewport/world coordinates by taking the sample point `(x, y, z)`, holding `y` fixed, and scaling the radial vector `(x, z)` outward from the neutral axis until `solidField()` crosses the boundary.

That is useful, but it is only one projection heuristic:

- It preserves the active world-space vertical coordinate.
- It assumes radial projection from the neutral axis.
- It uses the visible solid field, including slice/cylinder clips.
- It is geometric, not explicitly a color-space gamut mapping method.

Björn Ottosson's sRGB gamut clipping work frames a closely related problem in Oklab: keep hue fixed, choose a projection line toward some neutral-axis focus point, then intersect that line with the RGB gamut boundary. The existing app already ports this family in `fe/src/lib/color/gamut-map.ts` for the terminal ramp gamut-map stage, using `findCusp()` and `findGamutIntersection()` from `fe/src/lib/color/okhsv.ts`.

This document proposes a staged design that improves curve-to-surface constraints now and lays groundwork for a later generalized gamut projection engine shared by:

- Interpolate-stage surface constraints.
- Ramp terminal gamut mapping.
- Explorer-gamut-to-display gamut clipping/visualization.
- Future non-sRGB / active-gamut boundary projection.

References:

- `_docs/references.md`, "Björn Ottosson / sRGB gamut clipping"
- https://bottosson.github.io/posts/gamutclipping/
- `fe/src/lib/color/gamut-map.ts`
- `fe/src/lib/color/okhsv.ts`
- `fe/src/lib/engine/theme.ts`

## Design Principle

Separate three concepts that currently sit close together:

1. **Interpolation geometry**  
   The path generated from source anchors in an interpolation space.

2. **Curve constraint**  
   Optional projection of each interpolation sample to a boundary while the curve is being built.

3. **Terminal gamut mapping**  
   Final policy that maps generated stops/curves into the export gamut.

4. **Explorer display clipping**  
   Optional visualization/mapping of the active Explorer gamut into a smaller display/export gamut such as sRGB.

The UI should make this distinction clear:

- Curve constraint changes the shape of the visual/interpolated path.
- Gamut map changes exported/final colors.
- Explorer display clipping changes how the primary solid is visualized or classified against a target gamut.
- Both may use similar projection algorithms, but at different pipeline stages.

## Current Behavior

Current `surface` behavior:

```ts
function snapToSurface(p, state, matrices) {
  const dx = p[0];
  const dz = p[2];
  const at = (t) => [dx * t, p[1], dz * t];
  ...
}
```

This is best described to users as:

> Radial shell: preserve the active world-space height and push chroma/radius outward to the visible solid boundary.

It is not a nearest-point projection and not the same as Oklab gamut clipping.

## Proposed User-Facing Constraint Options

Replace the binary `Free / Surface` selector with:

### `Free`

No projection. Interpolated samples remain wherever the chosen interpolation space places them.

Use when:

- the user wants interior paths;
- interpolating neutral-to-color ramps;
- seeing how a color space bends straight lines.

### `Surface: radial`

Current behavior. Preserve active world vertical coordinate and push the sample outward along `(x, z)`.

Good default for:

- visually following the displayed solid shell;
- surface-hugging color ramps;
- active clipped volume exploration.

Limitations:

- not nearest boundary;
- depends strongly on active world mode;
- can behave differently across RGB cube, XYZ, CIELAB, Oklab, and luma modes;
- includes slice/cylinder clipping if active, which may or may not be desired.

### `Surface: Oklab chroma`

Project in Oklab/OKLCH at fixed hue and approximately fixed lightness by reducing or increasing chroma to the sRGB boundary.

For curve constraint, there are two variants:

- If the sample is inside sRGB, optionally push outward to maximum chroma for that `L,h`.
- If the sample is outside sRGB, pull inward to the boundary.

This corresponds most closely to the existing `preserve-chroma` / constant-lightness projection family, but used as a boundary snap rather than final clipping.

Good for:

- hue-arc ramps;
- perceptual surface paths independent of current viewport world mode;
- preparing the later generalized projection engine.

Limitations:

- initially sRGB-only unless generalized;
- based on Oklab, so it is not exactly "active world surface" in CIELAB/XYZ view;
- active display gamut other than sRGB requires more work.

### `Surface: Oklab projection`

Use Ottosson-style projection lines toward a neutral-axis focus point:

- fixed `L0 = clamp(L, 0, 1)` (`preserve lightness / chroma compression`);
- fixed `L0 = 0.5`;
- hue-dependent `L0 = L_cusp`;
- adaptive `L0 = 0.5`;
- adaptive `L0 = L_cusp`.

This mirrors the existing gamut-map policies and exposes a stronger experimental surface lock.

Recommended v1 UI:

- Do not list every algorithm directly inside `Curve constraint` immediately.
- Use `Curve constraint = Surface projection`.
- Add a second selector: `Projection method`.
- Reuse the existing gamut-map method labels where possible.

### Missing Configurability To Add

The current implementation covers the basic projection-line families, but it is still less configurable than the algorithms described in Ottosson's gamut clipping article.

Missing features:

- **Adaptive alpha parameter.** Current code hard-codes `alpha = 0.05`. The reference article shows that this value materially changes behavior, with low values preserving lightness more strongly and high values compressing lightness more aggressively toward the projection focus.
- **Custom focus lightness.** Current choices are fixed `L0 = 0.5`, hue cusp `L0 = L_cusp`, or adaptive versions. There is no user-configurable neutral-axis focus such as `L0 = 0.35` or `L0 = 0.65`.
- **Named presets plus advanced parameters.** Current UI exposes only method names. It should support simple presets first and reveal advanced parameters only when needed.
- **Separate projection roles.** The same method names are used by Interpolate-stage surface projection and terminal ramp gamut mapping, but they do different things. Surface projection uses the selected method as a line direction, then intersects the active clipped solid. Gamut mapping maps final generated colors into the export/display target gamut.
- **Generic target gamut.** Current analytic cusp math is sRGB/Oklab-specific. A later generalized solver needs a target gamut parameter and matrix-based boundary checks for P3, Rec.2020, etc.
- **Gamut compression.** Current behavior is clipping/projection only. There is no smooth compression region that starts before the target gamut boundary.
- **Fallback policy.** Near-neutral samples and failed intersections currently fall back implicitly. Users cannot choose preserve, radial fallback, nearest visible surface, or remembered hue fallback.
- **CPU/GPU parity controls.** Projection is CPU-only for ramp generation. Shader work should start with classification, not full projection, until algorithms stabilize.

## Data Model

Current type:

```ts
export type SplineConstraint = 'free' | 'surface';
```

Recommended additive model:

```ts
export type SplineConstraint =
  | 'free'
  | 'surface-radial'
  | 'surface-oklab-chroma'
  | 'surface-oklab-project';

export type SurfaceProjectionMethod =
  | 'preserve-chroma'
  | 'project-0.5'
  | 'project-cusp'
  | 'adaptive-0.5'
  | 'adaptive-cusp';

export interface ProjectionParams {
  method: SurfaceProjectionMethod;
  alpha: number;      // adaptive methods; default 0.05
  focusL: number;     // custom focus method; future
  neutral: 'preserve' | 'radial-fallback' | 'remember-hue';
}
```

Migration:

- Existing persisted `'surface'` should load as `'surface-radial'`.
- To avoid breaking schema immediately, a transitional option is to keep `'surface'` as an alias internally and display it as `Surface: radial`.
- Full implementation should bump the schema because `SplineConstraint` is persisted and validated in `documents/schema.ts`.

Recommended v1:

- Keep `splineConstraint: 'free' | 'surface'` for compatibility.
- Add `theme.surfaceProjection?: SurfaceProjectionMethod` only if implementing Oklab projection.
- Later schema migration can rename `'surface'` to `'surface-radial'`.

Recommended next migration:

- Keep `theme.surfaceProjection` for backward compatibility.
- Add `theme.surfaceProjectionParams` only when advanced parameters are introduced.
- Derive params from the legacy method field on load:
  - `surfaceProjectionParams.method = theme.surfaceProjection`;
  - `surfaceProjectionParams.alpha = 0.05`;
  - `surfaceProjectionParams.neutral = 'preserve'`.
- Do not expose the params object for terminal `Gamut Map` until the surface projection UI has validated the controls.

## Shared Projection Core

Introduce a projection module that is not tied to theme/ramp UI:

```ts
// fe/src/lib/color/boundary-project.ts
export interface BoundaryProjectionInput {
  srgbLin: Vec3;
  targetGamut: 'srgb'; // future: GamutKey / RGB matrix
  method: SurfaceProjectionMethod;
  mode: 'pull-in' | 'push-out' | 'nearest-on-line';
}

export interface BoundaryProjectionResult {
  srgbLin: Vec3;
  inGamutBefore: boolean;
  boundaryHit: boolean;
  method: SurfaceProjectionMethod;
}
```

Initial implementation can wrap existing `mapToGamut()` for pull-in behavior and add a new `projectToOklabBoundary()` for exact boundary hits.

The key missing helper for curve constraints is **push-out**:

- Existing `mapToGamut()` leaves in-gamut colors unchanged.
- Surface locking often wants in-gamut samples moved outward to the boundary.
- That requires computing the boundary intersection even for in-gamut samples.

For Oklab, this is straightforward because `findGamutIntersection(a, b, L1, C1, L0)` returns `t` along the projection line. For fixed-lightness chroma projection, use `L0 = L1` and `C1 = 1`-style search/intersection to find `Cmax` at current `L,h`.

## Algorithm Candidates

### A. Radial world projection

Current algorithm.

Keep it because it answers a distinct visual question:

> Where is the displayed solid boundary along this world-space ray?

Implementation:

- Rename internally to `snapToWorldRadialSurface`.
- Keep using `solidField()`.
- Consider a toggle later: include active clip masks vs full RGB shell.

### B. Oklab fixed-lightness max chroma

Given linear sRGB:

1. Convert to Oklab.
2. Compute `L`, `C`, normalized hue direction `a_`, `b_`.
3. Find maximum boundary chroma for that `L,h`.
4. Return `oklab_to_srgb([L, Cmax*a_, Cmax*b_])`.

This is the cleanest semantic match for "surface chroma" and is easiest to explain.

Edge cases:

- Near neutral (`C < eps`): keep original or use a stable remembered hue. Do not invent a visible hue from pure neutral unless user intent is clear.
- `L <= 0` or `L >= 1`: clamp/handle as boundary endpoints.

### C. Oklab pull/push projection toward focus point

Use existing Ottosson projection methods:

- `preserve-chroma`
- `project-0.5`
- `project-cusp`
- `adaptive-0.5`
- `adaptive-cusp`

For surface constraint:

- If the sample is outside the target gamut, project inward.
- If inside and surface lock asks for boundary, project outward along the same line or use fixed-lightness max chroma.

This is useful for exploring perceptual projection lines but may be less intuitive than fixed-lightness max chroma.

### D. Nearest surface in active world space

Numerically minimize distance from the sample to `solidField(p) == 0`.

Possible approaches:

- gradient descent / sphere tracing if a usable field gradient exists;
- sample multiple rays around the point and choose nearest boundary;
- CPU iterative nearest point against tessellated shell.

Not recommended for v1:

- slower;
- less predictable;
- hard to explain;
- may disagree with visible clipped surfaces unless carefully scoped.

Keep as future research.

## Relationship to Future Generalized Gamut Mapping

The existing `gamut-map.ts` is sRGB/Oklab-specific:

- source colors are linear sRGB;
- projection uses Oklab;
- gamut boundary is sRGB via fixed polynomial coefficients.

Generalizing to all app gamuts means separating:

1. **working perceptual space**  
   likely Oklab first; later maybe CIELAB/OKLrCH/ProLab.

2. **target RGB gamut**  
   sRGB, P3, Rec.2020, etc.

3. **boundary solver**  
   find intersection of a line in perceptual coordinates with `rgb in [0,1]^3`.

For non-sRGB gamuts, Ottosson's fitted `compute_max_saturation()` constants are not directly valid. The article explicitly notes future value in solving from RGB matrices directly. For this app, a robust generalized solver can use:

- matrix-based RGB evaluation from perceptual coordinates;
- bracketing + bisection on projection parameter;
- optional Newton/Halley acceleration later;
- cached hue/lightness tables for speed if needed.

This is slower than the sRGB closed-form approximation, but ramp generation has low sample counts compared with image processing. A binary search per ramp sample is acceptable for interactive use if coalesced and cached.

## Explorer Gamut Clipping to sRGB

An upcoming related feature is optional clipping/visualization when the main Explorer `Gamut (cube primaries)` is not sRGB.

Example:

- Active Explorer gamut: Rec.2020.
- Target/display gamut: sRGB.
- Goal: show which Rec.2020 colors are present in sRGB, which are missing, and how outliers would map if clipped/projected.

This is adjacent to, but separate from, ramp `Gamut Map`:

- Ramp `Gamut Map` operates on generated ramp stops and export tokens.
- Explorer gamut clipping/classification operates on the primary 3D solid and its sampled surface/volume.

### Pipeline Placement

This should become an explicit late Explorer pipeline step, probably after `World`/`Clip` and before `Vision`/`Display`, or as a sub-stage of `Display`.

Candidate label:

```text
Display gamut
  Off
  Classify against sRGB
  Clip/project to sRGB
```

Alternative label:

```text
Target gamut
  Native gamut
  sRGB comparison
  sRGB clipped projection
```

Rationale:

- It is not the same as selecting the primary RGB cube.
- It is not the same as choosing a reference shell.
- It answers a specific display/export question: "What part of this active gamut survives in sRGB?"

### Visual Modes

Recommended modes:

1. **Classify only**
   - Keep the active gamut solid in its native geometry.
   - Mark regions outside sRGB with a distinct overlay/tint/alpha/grid style.
   - Use the reference gamut shell to show the sRGB boundary in the same world space.

2. **Intersection highlight**
   - Emphasize the intersection volume/surface between active gamut and sRGB.
   - Dim or make transparent outliers.
   - This pairs naturally with the existing reference shell.

3. **Projected/clipped view**
   - Map out-of-sRGB active-gamut samples to the sRGB boundary using the selected projection method.
   - This would visualize how colors collapse under a chosen gamut clipping strategy.

4. **Difference/outlier view**
   - Show only active-gamut colors that are outside sRGB.
   - Useful when comparing Rec.2020/P3 to sRGB.

### Interaction With Reference Gamut Shell

Reference gamut shell remains valuable:

- It shows the target gamut boundary geometrically.
- It helps users see the intersection of active and reference gamuts.
- With classification enabled, it makes outliers understandable instead of just tinted.

The shell should not be treated as the clipping algorithm. It is the geometric reference. The clipping/classification step decides how to color, hide, or project samples relative to that reference.

### Relationship to Surface Constraint

The same boundary-projection primitives can support:

- `Surface: Oklab chroma` for curve samples.
- Ramp terminal gamut mapping.
- Explorer active-gamut sample projection into sRGB.

But the inputs differ:

- Surface constraint projects a curve sample.
- Ramp gamut map projects generated stops.
- Explorer display clipping classifies/projects many solid samples.

For the explorer solid, performance matters more. Start with classification (`rgb in target gamut?`) because it is cheap. Projection can be added after the projection core is stable.

### Implementation Notes

State additions could look like:

```ts
displayGamutMode:
  | 'native'
  | 'classify-srgb'
  | 'intersection-srgb'
  | 'project-srgb';

displayGamutProjection: SurfaceProjectionMethod;
```

Longer term, replace `sRGB` hardcoding with:

```ts
targetDisplayGamut: GamutKey;
```

For first implementation, `sRGB` is the correct target because browser/CSS export and most displays still make sRGB the baseline.

Renderer considerations:

- Classification can happen in shader by converting the active sample to sRGB and checking `[0,1]`.
- Outlier tint/alpha can be a uniform-driven display mode.
- Projection is heavier; it may need CPU precomputed samples, shader approximations, or a lower-resolution projected overlay.
- The reference shell should remain independently toggled and can default to sRGB when `Gamut != sRGB` and display comparison is active.

This should be planned as an Explorer pipeline feature before exposing generalized gamut mapping for every ramp/export target.

## CPU/GPU Implementation Strategy

The generalized gamut clipping/projection work will eventually touch both CPU and GPU paths.

CPU needs:

- ramp stop generation;
- curve surface projection;
- export/token generation;
- tests and numeric validation;
- document examples and thumbnails if generated offline.

GPU needs:

- real-time solid classification;
- outlier/intersection visualization;
- possibly projected/clipped overlays for the active Explorer gamut;
- future direct visual comparison between active gamut and target gamut.

This creates an obvious maintenance risk: the same color math may need to exist in TypeScript and GLSL. That does not mean a full DSL/code generator is necessary now, but the design should avoid making future parity impossible.

### First-Iteration Recommendation

Do not build a code-generation system in the first iteration.

Instead:

1. Keep the canonical algorithms in TypeScript first.
2. Keep GPU work limited to cheap classification whenever possible.
3. Use shared constants/matrices generated or exported from one place where practical.
4. Add CPU tests that define expected behavior.
5. Add visual/debug modes that compare CPU and GPU classifications on sampled points if mismatch risk becomes visible.

For the first Explorer gamut comparison, shader logic can be simple:

```text
active gamut sample -> target sRGB linear -> in/out check
```

This requires matrix conversion and range tests, not the full Ottosson projection machinery. That is much cheaper to maintain in GLSL.

Projection/clipping methods should remain CPU-first until the visual design proves they are needed on the solid itself. For ramp generation, CPU is the correct home because output tokens must be deterministic and testable.

### When Duplication Becomes a Problem

Parallel TypeScript/GLSL implementations become risky when:

- the same nonlinear conversion appears in both places;
- the same projection algorithm appears in both places;
- a bug fix must be manually ported between CPU and shader code;
- tests can only cover the TypeScript version;
- visual behavior disagrees with exported values.

Likely duplication hotspots:

- Oklab conversions;
- target-gamut matrix conversion;
- transfer functions;
- CVD transforms;
- `solidField`-like boundary predicates;
- gamut classification;
- future generalized line-boundary solvers.

Some duplication already exists in the app because shader math and TypeScript math both need Oklab/XYZ/RGB transforms. That is acceptable while the duplicated surface is small and stable. It becomes less acceptable if projection algorithms multiply.

### Code Generation / DSL Option

A small math DSL or source-generation layer may become worthwhile later, but only after the shared math stabilizes.

Potential goal:

```text
one abstract operation graph -> TypeScript function + GLSL function
```

Useful generated targets:

- TypeScript scalar/vector functions for tests and CPU ramp generation.
- GLSL functions for shader classification/projection.
- Maybe documentation tables of constants/matrices.

The DSL should be intentionally narrow:

- scalar arithmetic;
- vec3 operations;
- matrix multiply;
- clamp/mix/dot/pow/cbrt/sqrt;
- branch expressions;
- small fixed iteration loops only if needed.

It should not try to represent arbitrary TypeScript or GLSL. The goal would be color math kernels, not the app logic.

Candidate kernels:

- linear RGB <-> XYZ;
- linear sRGB <-> Oklab;
- Oklab <-> OKLCH;
- target gamut classification;
- simple projection-line evaluation;
- CVD LMS transforms.

Avoid generating:

- Svelte state code;
- renderer draw-pass code;
- document parsing/migration;
- complex UI logic;
- algorithms needing dynamic arrays or object-heavy code.

### Costs of a DSL

A DSL has real costs:

- more infrastructure than hand-written functions;
- harder debugging unless generated code is readable;
- new test burden for the generator itself;
- risk of constraining algorithm design to what the DSL can express;
- harder onboarding for contributors.

Because this repo is still evolving quickly, a DSL too early could freeze the wrong abstractions.

### Middle-Ground Before a DSL

Before building a true code generator, use lighter mechanisms:

1. **Shared constants module**
   - Store matrices/constants once in TypeScript.
   - Generate GLSL `const` blocks or uniform payloads from those constants.

2. **Golden sample tests**
   - Sample known colors through CPU math.
   - Add a GPU/debug path later that renders or reads a small comparison texture.

3. **Function-pair naming convention**
   - Keep GLSL and TypeScript functions deliberately parallel:
     - `lsrgb2oklab()` / `lsrgb2oklab`
     - `targetGamutClassify()` / `target_gamut_classify`
   - Document which implementation is canonical.

4. **Shader includes**
   - Use `glslify` or local shader modules to keep GLSL kernels centralized.
   - This reduces shader duplication even without cross-language generation.

5. **Generated GLSL constants only**
   - Start by generating matrices and scalar constants, not functions.
   - This gets many parity benefits with lower complexity.

### Long-Term Recommendation

Consider a DSL/codegen layer only if all of the following become true:

- Explorer display clipping needs the same projection algorithms as ramp export.
- The projection algorithms support multiple target gamuts.
- CPU/GPU mismatches become a recurring source of bugs.
- GLSL helper modules are already centralized and still not enough.
- The math kernels have stabilized enough that their AST shape is unlikely to churn every week.

If those conditions are met, the codegen project is worth exploring as its own milestone, not as part of the first generalized gamut clipping implementation.

Pragmatic staged path:

1. Hand-written TypeScript projection core with tests.
2. GLSL classification only, using shared constants/uniforms.
3. Centralize GLSL math with `glslify`.
4. Generate GLSL constants from TypeScript constants.
5. Add GPU golden-sample comparison tooling if needed.
6. Only then consider a tiny expression DSL for shared kernels.

## Proposed Implementation Phases

### Phase 1: Clarify and preserve current behavior

Status: implemented.

Goal:

- Make the current heuristic explicit.
- Reduce future confusion between surface constraint and gamut mapping.

Tasks:

- Rename helper in `theme.ts` from `snapToSurface()` to `snapToRadialWorldSurface()`.
- Update UI label from `Surface (radial shell)` to `Surface: radial shell`.
- Update help copy to mention it is world-space radial projection, not final gamut mapping.
- Add unit tests around current behavior if practical:
  - interior sample moves outward;
  - boundary sample stays near boundary;
  - no NaN near neutral axis.

No schema change required.

### Phase 2: Add Oklab max-chroma surface constraint

Status: implemented.

Goal:

- Provide a better perceptual surface projection for ramp curves.

Tasks:

- Add `projectOklabMaxChroma(srgbLin)` helper.
- Add `theme.splineConstraint = 'surface-oklab-chroma'` or a separate projection selector.
- Convert curve samples:
  - interpolation coord -> linear sRGB;
  - project to Oklab boundary;
  - convert projected sRGB to active world for display.
- Add UI option under Interpolate.
- Add document schema migration/coercion.
- Add tests comparing projected colors against `inGamut` and expected boundary conditions.

Recommended default:

- Keep existing documents on radial shell.
- Consider `Surface: Oklab chroma` as the new default only after visual review.

### Phase 3: Reuse Ottosson projection methods for curve constraints

Status: implemented in basic form.

Goal:

- Expose projection-line choices analogous to ramp gamut mapping.

Tasks:

- Extract common projection code from `gamut-map.ts` into a reusable boundary module.
- Add a method selector for surface projection.
- Reuse labels from Gamut Map where possible.
- Keep `Surface: Oklab chroma` as the simple option; place advanced methods behind `Surface: projection`.

Tests:

- each projection returns finite linear sRGB;
- out-of-gamut samples map to boundary/in-gamut;
- in-gamut samples either remain unchanged for pull-in mode or move to boundary for surface mode;
- endpoints and near-neutral colors are stable.

### Phase 4: Parameterize Ottosson projection controls

Goal:

- Add the configurability missing from the basic implementation while keeping the simple presets usable.

Recommended scope:

- Surface projection first.
- Terminal `Gamut Map` second, after the surface UI proves the parameter model.

Tasks:

- Replace the internal hard-coded adaptive `alpha = 0.05` with a parameter.
- Keep preset labels stable:
  - `Adaptive L 0.5`
  - `Adaptive cusp`
- Add an Advanced disclosure under `Surface: Oklab projection`:
  - adaptive alpha slider;
  - optional custom focus `L0` slider only after alpha is validated;
  - neutral fallback policy if user testing shows neutral samples are confusing.
- Add a parameter object beside the existing method field:

```ts
theme.surfaceProjectionParams = {
  method: theme.surfaceProjection,
  alpha: 0.05,
  focusL: 0.5,
  neutral: 'preserve'
}
```

- Update `boundary-project.ts` so `oklabProjectionLine()` accepts method + params.
- Keep `surfaceProjection` as a compatibility alias and derive params on load.
- Add tests:
  - `alpha = 0.05`, `0.5`, and `5.0` produce distinct projection lines for chromatic samples;
  - default params reproduce current output;
  - neutral fallback remains finite and stable.

Non-goals:

- Do not generalize target gamut in this phase.
- Do not add GPU projection.
- Do not add gamut compression yet.

### Phase 5: Generalize target gamut

Goal:

- Let ramp gamut mapping target sRGB/P3/Rec.2020 or the active/export gamut, not only sRGB.

Tasks:

- Add a target gamut parameter to projection helpers.
- Implement a generic line-boundary solver:
  - choose perceptual projection line;
  - evaluate candidate perceptual point;
  - convert to target RGB using target matrix;
  - solve for first `rgb in [0,1]` boundary crossing.
- Keep the current sRGB analytic implementation as a fast path.
- Add UI copy distinguishing:
  - display/export target;
  - explorer gamut;
  - interpolation space.

### Phase 6: Add Explorer display-gamut comparison

Goal:

- When active Explorer gamut is P3/Rec.2020/etc., optionally compare/classify/project it against sRGB.

Tasks:

- Add a late Explorer pipeline node or Display sub-stage.
- Add state for display-gamut comparison mode.
- Add shader classification for active-gamut samples outside sRGB.
- Integrate with reference shell defaults and help copy.
- Defer projected/clipped rendering until classification and intersection views are visually clear.

Tests:

- sRGB active gamut with sRGB target should classify all valid samples as in-gamut.
- P3/Rec.2020 active gamut should classify known pure-primary regions as outside sRGB.
- CVD simulation should run after this display-gamut visualization step, not before it.

### Phase 7: Add optional gamut compression

Goal:

- Add smooth compression as a separate policy from hard clipping/projection.

Rationale:

- Projection is useful for exact boundary mapping, but it creates a discontinuity at the boundary: in-gamut colors remain unchanged and out-of-gamut colors are moved.
- Compression can begin before the boundary and preserve visual relationships more smoothly.

Tasks:

- Add compression parameters only after target-gamut projection is stable:
  - compression start threshold;
  - compression strength;
  - target gamut.
- Keep compression as a terminal ramp/export policy first.
- Avoid using compression for Interpolate-stage surface constraints; surface constraints intentionally seek a boundary.

### Phase 8: Evaluate GPU/codegen needs

Goal:

- Decide whether projection math needs shared TypeScript/GLSL generation.

Entry criteria:

- Explorer display clipping needs real projection, not only classification.
- Projection supports more than one target gamut.
- CPU/GPU mismatches become visible or costly.

Recommended order:

1. Centralize GLSL helper modules with `glslify`.
2. Generate GLSL constants from TypeScript constants if needed.
3. Add golden-sample comparison tooling.
4. Only then consider a small math DSL for shared kernels.

## UI Proposal

In `Interpolate`:

```text
Curve constraint
  Free
  Surface: radial shell
  Surface: Oklab chroma
  Surface: projection

Projection method
  Preserve lightness
  Project to L 0.5
  Project to hue cusp
  Adaptive L 0.5
  Adaptive cusp

Advanced
  Adaptive alpha 0.05
  Alpha presets 0.05 / 0.50 / 5.00
  Status Lightness-preserving ↔ more compression
  Custom focus L 0.50    (only for future custom-focus method)
  Neutral fallback Preserve
```

Only show `Projection method` when `Surface: projection` is active.
Only show `Adaptive alpha` for adaptive methods. Custom `focusL` and neutral fallback should stay hidden until they are implemented and user-tested.

Immediate UI polish:

- Add alpha preset chips matching Ottosson's examples: `0.05`, `0.5`, `5.0`.
- Add a compact status line beside or below the alpha slider:
  - low alpha: `Lightness-preserving`;
  - mid alpha: `Balanced`;
  - high alpha: `More compression`.
- Keep the Advanced disclosure collapsed by default.
- Make Interpolate help text explicit: Surface Projection constrains the path to the active clipped surface; it does not perform final export gamut mapping.

For first implementation, a simpler UI is acceptable:

```text
Curve constraint
  Free
  Surface: radial shell
  Surface: Oklab chroma
```

## Recommended Next Implementation Order

Current state:

- Phase 1 is implemented.
- Phase 2 is implemented.
- Phase 3 is implemented in basic form.
- Phase 4 alpha parameterization is implemented for both Interpolate-stage surface projection and terminal `Gamut Map`:
  - `surfaceProjectionParams.alpha` controls adaptive surface projection lines.
  - `gamutMapParams.alpha` controls adaptive terminal gamut mapping.
  - Both default to `0.05`, preserving previous output.
  - Pipeline copy/status now separates path shaping from final/export gamut correction.

### Phase 4B: Convert fixed-focus presets into method + params

Goal:

- Keep existing method values for document compatibility, but stop treating names like `project-0.5` and `adaptive-0.5` as the full configuration.
- Use `focusL` as the neutral-axis focus parameter wherever a "middle lightness" projection is selected.

Compatibility strategy:

- Keep stored method strings:
  - `project-0.5`
  - `adaptive-0.5`
- Interpret them as:
  - `project-focus` with `focusL = 0.5` by default;
  - `adaptive-focus` with `focusL = 0.5` by default.
- Do not rename the persisted enum in this phase. A later schema cleanup may introduce explicit `project-focus` / `adaptive-focus` values once target-gamut generalization is ready.

Implementation order:

1. Add `focusL` to `gamutMapParams` with default `0.5`; bump schema and migrate older documents.
2. Change terminal `Gamut Map` methods `project-0.5` and `adaptive-0.5` to read `params.focusL`.
3. Change `Surface: Oklab projection` methods `project-0.5` and `adaptive-0.5` to read `surfaceProjectionParams.focusL` (the field already exists).
4. Add compact Advanced controls:
   - `Focus L` slider for `project-0.5` and `adaptive-0.5`;
   - existing `Adaptive alpha` only for adaptive methods;
   - keep the controls separate between Interpolate and Gamut Map.
5. Update user-facing labels from `Project to L 0.5` / `Adaptive L 0.5` to focus-oriented labels while keeping values unchanged.
6. Add tests:
   - default focus `0.5` reproduces previous output;
   - changing focus changes projection lines/output for chromatic out-of-gamut samples;
   - document migration and round-trip preserve `gamutMapParams.focusL`.

Non-goals:

- Do not introduce new persisted method names yet.
- Do not generalize target gamut in this change.
- Do not add compression controls.

Next order:

1. **Phase 4B focus parameterization.** Convert fixed `L 0.5` behavior into defaulted `focusL` params while keeping persisted method strings compatible.
2. **Phase 5: generic target-gamut solver.** Add matrix-based line/boundary solving for P3/Rec.2020. Keep sRGB analytic code as a fast path.
3. **Phase 6: Explorer display-gamut classification.** Start with shader classification only, because it is cheap and answers the main visual question.
4. **Projected Explorer display mode.** Add only after classification and generic CPU projection are proven.
5. **Phase 7: gamut compression.** Treat as a separate terminal ramp/export policy, not a surface constraint.
6. **Phase 8: GPU/codegen evaluation.** Defer until duplicated projection algorithms exist in both TypeScript and GLSL.

Avoid making terminal `Gamut Map` target all gamuts in the same change as projection parameterization. That would touch persistence, UI, export semantics, tests, examples, and possibly renderer expectations. The safer path is: parameterize the current sRGB/Oklab implementation first, then generalize target gamut.

## Open Questions

- Should `Surface: radial shell` include active slice/cylinder clips, or should it always use the full RGB solid?
- Should Oklab surface projection target sRGB only, or active `Gamut (cube primaries)`?
- Should surface-projected curves be allowed to generate out-of-sRGB values when the active gamut is P3/Rec.2020?
- Does `Gamut Map` mean "map to sRGB export" permanently, or should it become "map to selected export gamut"?
- Should Explorer display-gamut comparison be a new pipeline node, or live inside `Display`?
- Should reference shell auto-switch to sRGB when active gamut is not sRGB and sRGB comparison is enabled?
- Should projected Explorer solids replace geometry, or be rendered as a separate overlay so the native active gamut remains visible?
- What should happen for pure neutral samples where hue is undefined?
