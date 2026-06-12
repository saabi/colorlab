# 3D Space Morphing Plan

Status: proposal for implementation.

## Goal

When the user switches the 3D explorer's **World space** (RGB cube, XYZ,
CIELAB, Oklab, Luma), the solid currently jumps immediately to the new geometry.
The goal is a smooth morphing animation where the same color samples move from
their old world coordinates to their new world coordinates.

The morph should make it easier to understand that the app is not changing the
colors themselves: it is changing the geometric embedding used to visualize
them.

## Current Architecture

The solid is rendered by `solid.vert` from a fixed RGB cube-face
parameterization:

```glsl
vec3 rgb = warpRgbForMesh(faceToRgb(face, uv));
vec3 p = toWorld(rgb);
gl_Position = uProj * uView * vec4(p, 1.0);
```

`toWorld(rgb)` branches on `uSpaceMode`:

- `0`: rotated linear RGB cube
- `1`: XYZ
- `2`: CIELAB
- `3`: Oklab
- `5`: luminance romboid

This is a good basis for morphing because every vertex already starts from a
stable RGB identity. A morph can evaluate the same RGB coordinate in two spaces
and interpolate between the resulting world positions.

Ramp overlays are different:

- source points, stops, curves, and palette rows are built on the CPU;
- their `world` positions are computed in `theme.ts` via `jsToWorld(...)`;
- `WebGlRenderer` uploads those positions directly to point/line shaders.

So a complete morph needs both:

1. GPU morphing for the solid and shell;
2. CPU/draw-time morphing for ramp overlays.

## Core Model

For a color sample `rgb`:

```text
old position = toWorld(rgb, oldSpace)
new position = toWorld(rgb, newSpace)
shown position = mix(old position, new position, ease(t))
```

This preserves color identity throughout the animation. The vertex or marker
does not represent a different color while moving; only its position changes.

Recommended easing:

```ts
function ease(t: number) {
  return t * t * (3 - 2 * t); // smoothstep
}
```

Recommended duration:

- desktop: `450-650ms`;
- mobile: `300-450ms`;
- reduced motion: skip animation.

## Runtime State

Add a transient, non-persisted morph state near the viewport/renderer boundary.
Do **not** add it to saved documents.

```ts
interface SpaceMorph {
  active: boolean;
  from: SpaceMode;
  to: SpaceMode;
  startMs: number;
  durationMs: number;
  t: number;
}
```

This can live inside `Viewport.svelte` initially. It does not need to be part of
`ExplorerState` unless multiple components need direct access.

## Starting a Morph

World-space selectors currently bind directly to `explorer.spaceMode`. Replace
that with explicit setter functions in:

- `LeftControls.svelte`
- `ViewportToolbar.svelte`

Instead of:

```svelte
<select bind:value={explorer.spaceMode}>
```

use:

```svelte
<select
  value={explorer.spaceMode}
  onchange={(event) => onSpaceModeChange(Number(event.currentTarget.value) as SpaceMode)}
>
```

The setter should:

1. ignore no-op changes;
2. if reduced motion is active, assign immediately;
3. clear hover;
4. start `SpaceMorph { from, to, startMs, durationMs }`;
5. assign `explorer.spaceMode = to` so UI and target-space logic update;
6. rebuild ramp state for the target space;
7. defer boundary outline rebuild until the morph ends.

## Solid Shader Changes

Extend `solid.vert` with dual mode uniforms:

```glsl
uniform int uSpaceMode;
uniform int uFromSpaceMode;
uniform int uToSpaceMode;
uniform float uMorphT;
```

Refactor:

```glsl
vec3 toWorld(vec3 rgb) { ... }
vec3 fromWorld(vec3 p) { ... }
```

into mode-aware functions:

```glsl
vec3 toWorldMode(vec3 rgb, int mode) { ... }
vec3 fromWorldMode(vec3 p, int mode) { ... }
```

Then compute:

```glsl
float mt = uMorphT * uMorphT * (3.0 - 2.0 * uMorphT);
vec3 p0 = toWorldMode(rgb, uFromSpaceMode);
vec3 p1 = toWorldMode(rgb, uToSpaceMode);
vec3 p = mix(p0, p1, mt);
```

For normal draws:

```text
uFromSpaceMode = state.spaceMode
uToSpaceMode = state.spaceMode
uMorphT = 1
```

## Clipping During Morph

Clipping is the most sensitive part because the current shader folds geometry
onto slice/cylinder caps in the active world space.

### Recommended v1

During a morph:

1. evaluate the uncut old and new positions;
2. mix them;
3. apply clipping/folding in the target space behavior.

This keeps implementation small. The cut surface may visually settle during the
animation, but the end state is correct.

### Better v2

Compute clipped positions independently in both spaces, then morph between
those:

```text
old clipped = clip(toWorld(rgb, oldSpace), oldSpace)
new clipped = clip(toWorld(rgb, newSpace), newSpace)
shown = mix(old clipped, new clipped, t)
```

This is visually more coherent for active slices and cylinder cuts, but requires
parameterizing more of the existing folding logic by mode. It should only be
done after v1 is working and evaluated.

## Mesh Warp Caveat

The solid currently uses a perceptual-space mesh density warp:

- Oklab: `uMeshWarp = 2.0`
- CIELAB: `uMeshWarp = 1.7`
- other spaces: `uMeshWarp = 1.0`

If the mesh warp changes at the start of the morph, vertex identity changes and
the surface can crawl or shear. A morph should keep a stable RGB sample identity.

Recommended v1:

- freeze mesh warp at the `from` space while the morph runs;
- switch to the target warp only after the animation completes.

This may cause a small tessellation-density snap at the end, but it avoids
larger geometric artifacts during the animation.

Possible v2:

- sample unwarped RGB only during morph;
- or evaluate both endpoints from a shared neutral parameterization;
- or introduce a dedicated morph mesh warp policy.

## Renderer API

Extend `DrawInput`:

```ts
interface DrawInput {
  state: ExplorerState;
  matrices: DerivedMatrices;
  shellMatrices: DerivedMatrices | null;
  camera: Camera;
  morph?: {
    active: boolean;
    from: SpaceMode;
    to: SpaceMode;
    t: number;
  };
}
```

`WebGlRenderer.uploadSolidUniforms(...)` should use:

```ts
const from = input.morph?.active ? input.morph.from : state.spaceMode;
const to = input.morph?.active ? input.morph.to : state.spaceMode;
const t = input.morph?.active ? input.morph.t : 1;
```

and upload:

```ts
uFromSpaceMode = from
uToSpaceMode = to
uMorphT = t
```

For the mesh warp:

```ts
uMeshWarp = meshWarpForSpace(input.morph?.active ? from : state.spaceMode)
```

## Overlay Morphing

The solid is only part of the visual transition. These overlays should move with
the color space:

- source points;
- selected point ring;
- hover marker if shown;
- placed stops;
- expanded palette cells;
- curve polylines.

Each overlay sample has or can derive `srgbLin`, so draw-time morphing is
straightforward:

```ts
function worldForSrgbMorph(srgbLin, state, matrices, morph) {
  const gamutRgb = m3.mulV(matrices.toSrgbLin.fromSrgb, srgbLin);
  if (!morph?.active) return rgbToWorldMode(gamutRgb, state.spaceMode, matrices);
  const a = rgbToWorldMode(gamutRgb, morph.from, matrices);
  const b = rgbToWorldMode(gamutRgb, morph.to, matrices);
  return lerp3(a, b, ease(morph.t));
}
```

This avoids needing to store both old and new overlay positions. The renderer can
compute the visual position as it builds the point/line buffers.

Notes:

- For source points, this is exact.
- For generated stops and palette cells, this is also exact because each stop
  stores `srgbLin`.
- For spline curves, each sample stores `srgbLin`; draw the curve at morphed
  positions instead of using `sample.world` during an active morph.

## Boundary Outlines

The cross-section outline buffer is CPU-generated and mode-dependent. Rebuilding
it every animation frame would add complexity and cost.

Recommended v1:

- hide or fade slice/cylinder outline lines while `morph.active`;
- rebuild boundary once when the morph finishes in the target space;
- draw outlines normally afterward.

Possible v2:

- store two outline buffers, old and new;
- draw both with cross-faded alpha;
- or generate a correspondence between line vertices and morph them. This is
  harder because old/new outline topology can differ.

## Picking and Hover

Recommended v1 behavior:

- clear hover when the morph starts;
- pick in target space while the morph is active;
- optionally suppress hover marker until the morph completes;
- allow camera orbit/pan/zoom during morph.

Picking against the interpolated shape is technically possible but not worth the
complexity for v1.

## Shell Overlay

The reference shell uses the same solid shader and a different matrix set
(`shellMatrices`). It should receive the same morph uniforms as the main solid.

This makes the active solid and shell reshape together when switching world
space.

## Reduced Motion

Respect:

```ts
window.matchMedia('(prefers-reduced-motion: reduce)')
```

If reduced motion is enabled:

- assign `spaceMode` immediately;
- rebuild ramp and boundary immediately;
- skip RAF morphing.

## Implementation Phases

### Phase 1 — Solid Morph

- Add morph state in `Viewport.svelte`.
- Route world-space selectors through `onSpaceModeChange`.
- Add dual-space shader uniforms.
- Morph the main solid and shell.
- Hide/rebuild boundary outlines at morph end.
- Respect reduced motion.

This phase gives the primary visual polish.

### Phase 2 — Overlay Morph

- Add `rgbToWorldMode(...)` or equivalent renderer helper.
- Draw source points, stops, palette cells, and curves at morphed positions.
- Suppress or target-space draw hover marker during morph.

This prevents overlays from popping while the solid moves.

### Phase 3 — Clipping Polish

- Evaluate whether active slice/cylinder morphs look acceptable.
- If needed, implement dual clipped endpoint morphing.
- Consider fade-out/fade-in for cap grid and outline layers if topology changes
  are distracting.

### Phase 4 — Tuning

- Tune duration by device class.
- Pause or reduce morph duration during auto-performance degradation.
- Add tiny analytics event for world-space switch with `from`, `to`, and whether
  reduced motion skipped animation.

## Risks

- **Vertex identity artifacts:** caused by changing mesh warp during morph.
  Freeze mesh warp for v1.
- **Clipping artifacts:** active slices/cylinders can look like they are sliding
  while the solid morphs. Hide outlines and evaluate before implementing dual
  clipping.
- **Overlay popping:** source/ramp overlays will pop unless Phase 2 is included.
- **Auto-reduce interaction:** morphing adds more draw calls only if implemented
  carelessly. Keep the solid as one draw and only animate uniforms.
- **Complexity creep:** do not attempt interpolated picking or morphing CPU
  boundary topology in v1.

## Recommended First Implementation

Implement Phases 1 and 2 together:

1. solid and shell morph on GPU;
2. ramp/source overlays draw at morphed positions;
3. boundary outlines hidden during morph and rebuilt afterward;
4. picking/hover uses target space;
5. reduced-motion skips animation.

This is the smallest version that will feel coherent to users.
