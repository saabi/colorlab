# Color Space Shells Review and 3D Chromaticity Overlay Spec

Status: review and implementation proposal.

## Current Shell System

The current **Reference gamut shell** is implemented as a second solid render
pass:

- `ExplorerState.shell` selects a `ShellKey`.
- `rebuildShell(shell)` returns `DerivedMatrices` for that gamut.
- `Viewport.svelte` passes `shellMatrices` to `WebGlRenderer.draw(...)`.
- `WebGlRenderer` draws the same instanced RGB cube mesh with `ghost = 1`, using
  the shell gamut matrices instead of the active gamut matrices.

In practice, a shell is currently:

```text
the boundary of another RGB primary set, transformed into the active world space
```

Current shell candidates are RGB gamuts:

- `sRGB`
- `DCI-P3 D65`
- `Rec.2020`
- `NTSC 1953`
- `CIE 1931 RGB`

This is efficient and coherent because it reuses the same shader and mesh as the
main solid. However, it also means shells are limited to **RGB-device volumes**.
They cannot yet show non-device colorimetric structures such as the spectral
locus, MacAdam limits, constant-Y chromaticity planes, or appearance-model
boundaries.

## Existing Local Building Blocks

The app already has enough local colorimetry to build a useful first 3D
chromaticity overlay:

- `waveToXyz(nm)` in `fe/src/lib/color/pipeline.ts`
- `SPECTRUM_NM_MIN/MAX` in `fe/src/lib/panels/spectrum-panel.ts`
- xy spectral locus construction in `fe/src/lib/panels/xy-panel.ts`
- active gamut RGB ↔ XYZ matrices in `DerivedMatrices`
- `rgbToWorld(...)` / `jsToWorld(...)` style world-space mapping

The spectral locus used by the xy panel is not a static CIE data table. It is
generated from the app's cone-fit functions:

```ts
const xyz = waveToXyz(nm);
const S = xyz[0] + xyz[1] + xyz[2];
const xy = [xyz[0] / S, xyz[1] / S];
```

That is good enough for a consistent app-local visualization, and it keeps the
3D overlay numerically aligned with the existing xy/cone panels.

## What "3D XYZ Chromaticity Shell" Should Mean

Chromaticity is normally 2D:

```text
x = X / (X + Y + Z)
y = Y / (X + Y + Z)
z = Z / (X + Y + Z)
x + y + z = 1
```

In 3D XYZ coordinates, chromaticities lie on the plane:

```text
X + Y + Z = constant
```

So a "3D XYZ chromaticity shell" can be built at two levels:

1. a line overlay showing the chromaticity boundary embedded in the current 3D
   world;
2. a ruled curved surface that sweeps that boundary through intensity or
   lightness.

The owner's preferred direction is the second form: a **locus curved surface**,
not only a curve. The curve remains useful as an edge/outline of the surface.

The basic reference elements are:

1. **Spectral locus curve:** monochromatic colors from roughly 402-682 nm,
   normalized to constant `X + Y + Z = 1`.
2. **Line of purples:** straight edge connecting the short- and long-wavelength
   endpoints.
3. Optional **white point marker:** D65 or active gamut white chromaticity on the
   same plane.
4. Optional **RGB primary triangle:** the active gamut or selected reference
   gamut projected onto the same plane.

The surface version gives users a familiar xy diagram expanded into the third
dimension, embedded inside the active 3D world space.

## Why This Is Useful

The existing shell answers:

```text
What colors can another RGB gamut encode?
```

A 3D chromaticity overlay answers:

```text
Where is the spectral boundary of human-visible chromaticities relative to this
RGB gamut and this world-space geometry?
```

It would make several advanced relationships visible:

- sRGB/P3/Rec.2020 are triangles inside the spectral locus in chromaticity.
- Some spectral colors sit outside any display gamut.
- Oklab/CIELAB world shapes are embeddings of colorimetric values, not the whole
  visual chromaticity boundary.
- A constant-chromaticity ray changes intensity/lightness while preserving xy.

## Feasibility

### Feasible as a line overlay

Very feasible.

Implementation requires:

- sample wavelengths;
- normalize each `XYZ` to a chosen chromaticity plane;
- convert each XYZ point into the current world coordinate system;
- upload a dynamic line strip buffer;
- draw it after or alongside existing line overlays.

This is similar in complexity to the current CPU-generated slice outline, and
much simpler than a new solid shell. It is a useful diagnostic milestone but not
the desired final form.

### Feasible as a locus surface

A locus surface is possible:

```text
for each wavelength:
  for each intensity/lightness parameter t:
    XYZ = scale(t, wavelength) * normalizedSpectralXYZ(wavelength)
```

This creates a curved spectral reference surface whose outer rim is the
chromaticity locus and whose interior direction represents intensity/lightness.
It is not a device gamut, but it is a real colorimetric reference structure:
spectral chromaticity swept through stimulus magnitude.

The main design issue is choosing the second parameter:

- **radiometric/XYZ scale:** `XYZ(t, nm) = t * XYZ_chromaticity(nm)`;
- **constant CIE Y ladder:** choose `Y = t`, then derive `X` and `Z` from xy;
- **perceptual lightness ladder:** choose target Lab/Oklab lightness and solve
  for the XYZ scale that reaches it.

The surface is practical in WebGL2 as a generated mesh or as an instanced strip.
It does not require tessellation shaders.

## Mapping Arbitrary XYZ Into Active World Spaces

The main solid starts from active-gamut RGB values. A spectral overlay starts
from arbitrary XYZ values, many of which are out of the active gamut.

To draw those points in the same world space, use this conversion route:

```text
XYZ sample
  -> active-gamut linear RGB via active xyz2rgb
  -> existing world-space transform
```

That works because out-of-gamut RGB values can still be transformed
mathematically. They simply land outside the active solid.

Per world mode:

- **XYZ world:** use `XYZ - [0.48, 0.5, 0.54]`.
- **RGB cube world:** convert XYZ to active-gamut RGB, then apply cube rotation.
- **Luma world:** convert XYZ to active-gamut RGB, then apply the luma romboid
  transform.
- **CIELAB world:** convert XYZ directly through `xyz2lab(...)` using the active
  white point policy.
- **Oklab world:** convert XYZ to sRGB-linear, then `lsrgb2oklab(...)`, matching
  the existing active-gamut-to-sRGB path.

The last point matters: Oklab in this app is effectively computed from the
stimulus expressed as sRGB-linear, not from active-gamut RGB coordinates
directly. For arbitrary XYZ spectral samples, the equivalent is:

```text
XYZ -> sRGB-linear -> Oklab
```

The existing matrices already allow this because:

```text
active RGB -> XYZ -> sRGB-linear
```

is encoded in `DerivedMatrices.toSrgbLin`.

## Normalization Choices

This is the central design decision.

### Option A — Constant `X + Y + Z = 1`

Use chromaticity coordinates directly for the locus rim:

```ts
const S = X + Y + Z;
const xyz = [X / S, Y / S, Z / S];
```

Pros:

- exactly represents the xy chromaticity diagram plane;
- simple and familiar;
- independent of luminance variation in the cone fits;
- clean for XYZ world mode.

Cons:

- in Lab/Oklab, this is not constant lightness;
- spectral locus may pass through unexpected heights in perceptual spaces;
- scale is arbitrary relative to the device solid.

### Option B — Constant `Y = 1`

Normalize by luminance:

```ts
const xyz = [X / Y, 1, Z / Y];
```

Pros:

- matches common colorimetry convention for chromaticity-derived XYZ;
- white point is naturally `[x/y, 1, z/y]`;
- useful for comparing fixed-luminance chromaticities.

Cons:

- blue/violet wavelengths can produce very large X/Z values when Y is small;
- likely too large/cluttered in the 3D scene without scaling/clipping.

### Option C — Fit to Active Solid Scale

Normalize to a plane and then apply a global scale so the overlay sits near the
active solid:

```text
XYZ chromaticity -> world position -> scale around white/neutral center
```

Pros:

- visually legible;
- avoids huge outliers.

Cons:

- less physically literal;
- must be labelled as a scaled reference overlay.

### Recommendation

Use **Option A** for v1:

```text
XYZ chromaticity plane: X + Y + Z = 1
```

Then generate the surface inward/downward by scaling from that rim:

```ts
const rim = [X / S, Y / S, Z / S];
const xyz = scale * rim;
```

Use a simple scale factor if needed for readability, but keep the label explicit:

```text
Spectral locus (XYZ chromaticity, normalized)
```

## Proposed Overlay Types

### 0. Spectral Locus Surface

Render a mesh parameterized by wavelength and intensity/lightness:

```text
u = wavelength index
v = intensity/lightness step
```

Position:

```ts
const spectral = waveToXyz(nm);
const S = spectral[0] + spectral[1] + spectral[2];
const chromaXyz = [spectral[0] / S, spectral[1] / S, spectral[2] / S];
const xyz = scale(v, nm) * chromaXyz;
const world = xyzToActiveWorld(xyz, state, matrices);
```

Recommended first `scale(v, nm)`:

```ts
scale = v
```

with `v` in `[0, 1]`. This is the simplest XYZ-intensity surface. It naturally
collapses to black at `v = 0` and reaches the normalized spectral locus at
`v = 1`.

Alternative perceptual version:

```text
choose target Oklab/CIELAB lightness L
binary-search scale so world color reaches L
```

This would produce a lightness-layered surface that may align better with the
Oklab/CIELAB worlds, but it is more expensive and less literal.

Rendering:

- mesh resolution: roughly `140 wavelengths × 24 intensity bands`;
- primitive: indexed triangles or triangle strips;
- vertex color: spectral color at wavelength, dimmed by `v`;
- alpha: low, around `0.18-0.35`;
- optional wire/rim overlay: draw the spectral locus edge and line of purples on
  top for readability.

This should be treated as a reference surface, not a gamut shell.

### 1. Spectral Locus Curve

Render as a colored line strip:

- wavelengths: `SPECTRUM_NM_MIN..SPECTRUM_NM_MAX` at 1-2 nm step;
- position: normalized XYZ mapped into active world space;
- color: `spectrumColor(nm)` or computed display preview from `waveToXyz`;
- draw with depth test off or faint additive blending.

This is still useful as the rim of the surface and as a low-cost fallback.

### 2. Line of Purples

Render the straight line between the short- and long-wavelength endpoints:

- neutral gray or muted magenta dashed line;
- optional, enabled with the spectral locus by default;
- important because it closes the chromaticity boundary but is not spectral.

### 3. Gamut Primary Triangle on Chromaticity Plane

Render active or selected gamut primaries on the same chromaticity plane:

```ts
for each primary xy:
  xyz = [x, y, 1 - x - y] // Option A
```

This gives a direct 3D counterpart to the xy panel triangle.

Recommendation: include this as a second toggle or a mode variant, because the
existing RGB shell already compares gamut volumes.

### 4. Lightness-Layered Locus Surface

Advanced follow-up to the simple XYZ-intensity surface:

```text
for target L in [0, 1]:
  find scale such that mapped XYZ has that Lab/Oklab lightness
  p(nm, L) = world(scale * spectralXYZ_chromaticity)
```

This would create a spectral surface whose cross-sections align with perceptual
lightness. It is probably more informative in Oklab/CIELAB world modes, but the
scale solve and interpretation need more care.

### 5. MacAdam / Pointer's Gamut

Potential future shells:

- **Pointer's gamut:** surface of real-world object colors.
- **MacAdam limits:** theoretical maximum reflectance-color volume.

These would be highly educational, but require external datasets and careful
license/provenance review. They should not be the next implementation unless the
app explicitly adds a data-source pipeline.

## UI Proposal

Do not overload `Reference gamut shell` with non-gamut overlays unless the type
system is renamed.

Current label:

```text
Reference gamut shell
```

This is accurate for RGB gamuts but not for spectral locus/chromaticity. Better:

```text
Reference overlay
```

with grouped options:

```text
None
RGB gamut shells
  sRGB
  DCI-P3 D65
  Rec.2020
  NTSC 1953
  CIE 1931 RGB
Chromaticity references
  Spectral locus (XYZ chromaticity)
  Spectral locus + active primary triangle
```

If the control remains a simple select, use flat labels:

```text
None
sRGB shell
P3 shell
Rec.2020 shell
CIE RGB shell
Spectral locus
Spectral locus + primaries
```

Longer term, split the controls:

- `Reference gamut shell`: RGB volumes
- `Chromaticity overlay`: spectral locus / primary triangle / intensity volume

That is more honest and avoids mixing surface volumes with line overlays.

## Can Spectral Surfaces Be Primary Solids?

Yes, but they should be treated as **alternate reference solids**, not as normal
RGB primary gamuts.

An RGB gamut solid is defined by:

```text
three primaries + white point + transfer assumption
```

Every point inside the solid is a nonnegative mixture of the three primaries.
The current renderer exploits this by sampling the six faces of an RGB cube and
mapping those RGB triples into the selected world space.

A spectral locus surface is different:

```text
wavelength chromaticity × intensity/lightness
```

It is not a 3-primary device model. It is not controlled by RGB channel limits,
and it is not the convex hull of three primaries. It is a physically meaningful
reference surface made from monochromatic stimuli, but it should not be labelled
as a "gamut" without qualification.

### Feasible primary-solid modes

The app can support multiple primary geometry sources:

```ts
type SolidSource =
  | 'rgb-gamut'
  | 'spectral-locus-surface'
  | 'optimal-color-solid'; // future
```

#### `rgb-gamut`

Current behavior:

- active `gamut` selects the RGB primary set;
- the solid is the RGB cube boundary transformed into the active world space;
- reference gamut shells compare other RGB primary sets.

#### `spectral-locus-surface`

New primary solid option:

- the main viewport object is the wavelength × intensity/lightness surface;
- active `world space` still controls the 3D embedding;
- active `gamut` may still define display preview colors and optional RGB
  comparison shell/triangle, but it is no longer the source of the primary
  geometry;
- picking returns a spectral sample parameter (`nm`, intensity/lightness) plus
  its XYZ/RGB/Lab/Oklab chain.

This is feasible because the app already has `waveToXyz(nm)` and world-space
mapping code. The main implementation difference is geometry generation: instead
of six instanced RGB cube faces, the renderer draws a spectral surface mesh.

#### `optimal-color-solid`

Future scientific mode:

- represents the boundary of all physically realizable object colors under an
  illuminant;
- requires external data or optimal-color computation;
- not the same as the spectral locus surface.

This would be closer to a true "visible/object color solid" than the spectral
surface, but it is significantly more complex.

### Recommended product model

Do not overload `gamut` to include spectral surfaces. Keep `gamut` for RGB
device definitions and introduce a separate control:

```text
Primary solid
  RGB gamut
  Spectral surface
```

When `Primary solid = RGB gamut`, the current UI remains meaningful:

- Gamut selector
- Reference gamut shell
- RGB source picking

When `Primary solid = Spectral surface`, the UI should adapt:

- Gamut selector becomes display-preview / comparison context, not geometry
  source;
- Reference shell remains available as an RGB comparison overlay;
- Sources/ramp picking may need guardrails, because a picked spectral point can
  be outside the selected display gamut and may require gamut mapping before it
  becomes an exportable RGB anchor.

### Recommended implementation path

1. Implement the spectral locus surface as a **Chromaticity overlay** first.
2. Validate scaling, coloring, depth behavior, and world-space mappings.
3. Add `solidSource: 'rgb-gamut' | 'spectral-locus-surface'` as a runtime/UI
   state once the overlay is useful.
4. Add picking for the spectral surface only after the visual mode is stable.
5. Decide how spectral picks become ramp anchors:
   - map to active gamut RGB and mark out-of-gamut if needed;
   - or require explicit gamut mapping;
   - or use them as reference-only picks that do not feed export ramps.

This keeps the first step safe while leaving a clear path to using spectral
surfaces as primary viewport solids.

## Data Model Proposal

Current:

```ts
export type ShellKey = 'none' | 'srgb' | 'p3' | 'rec2020' | 'ntsc' | 'cie';
shell: ShellKey;
```

Recommended v1:

```ts
export type ReferenceOverlayKey =
  | 'none'
  | 'shell-srgb'
  | 'shell-p3'
  | 'shell-rec2020'
  | 'shell-ntsc'
  | 'shell-cie-rgb'
  | 'spectral-locus'
  | 'spectral-locus-primaries';
```

Migration can map:

```text
none -> none
srgb -> shell-srgb
p3 -> shell-p3
...
```

Lower-risk alternative:

Keep `shell` as-is and add:

```ts
chromaticityOverlay: 'off' | 'spectral-locus' | 'spectral-locus-primaries';
```

This avoids a schema rename and is the recommended first data-model change.

## Renderer Architecture

Keep the current shell pass unchanged for RGB gamut shells.

Add a new line renderer path:

```ts
renderer.rebuildReferenceOverlay(state, matrices)
renderer.drawReferenceOverlay(input, proj, view)
```

or extend the existing `lineProgram` path with a second line buffer:

- `boundaryLineBuffer`: current slice/cylinder outlines;
- `referenceLineBuffer`: spectral locus / primary triangle.

Recommended:

- use a separate buffer/count for reference overlays;
- rebuild it when any of these change:
  - active `spaceMode`;
  - active `gamut`;
  - active reference overlay mode;
  - CVD mode/severity if vertex colors are precomputed with CVD;
- draw after the solid, before point markers;
- respect `hideAids`.

The current `lineProgram` supports only one uniform color. A colored spectral
line needs either:

1. a new colored-line shader with position + color attributes; or
2. many small uniform-colored line draws; or
3. reuse `splineProgram` because it already supports per-vertex color.

Recommendation: reuse `splineProgram` for the spectral locus curve. It already
accepts:

```text
layout(location=0) vec3 position
layout(location=1) vec3 color
```

For the line of purples and primary triangle, either use the same colored-line
buffer with muted constant colors per vertex, or draw separate uniform lines.

## CVD Handling

The current solid applies CVD in the fragment shader. The spectral overlay should
be visually consistent with the rest of the viewport.

Options:

1. precompute display colors using `simulateCvdSrgb(...)` before uploading line
   colors;
2. add CVD uniforms to the colored-line fragment shader;
3. accept non-CVD overlay colors.

Recommendation for v1:

- precompute overlay vertex colors with `simulateCvdSrgb(...)`;
- rebuild the reference overlay when `state.cvd` or `state.cvdSev` changes.

This matches how ramp swatch colors are handled in the renderer.

## Interaction With Active Gamut

The spectral locus is not an RGB gamut and should not be clipped to the active
solid. It is a reference. Points may lie outside the active solid and should
remain visible.

Recommended draw state:

- depth test off, or depth test on with a "through glass" option;
- alpha around `0.55-0.8`;
- line width limited by WebGL portability (assume 1 px);
- use color and opacity rather than thick lines for emphasis.

If depth test is off, the overlay can become visually noisy. If depth test is on,
parts hidden inside the solid may be hard to interpret. Make this a design
choice:

- v1: depth test off, low alpha;
- later: add "Reference overlays through solid" if needed.

## Suggested Shell/Overlay Additions

### High Value

1. **Spectral locus surface (XYZ intensity)**  
   Shows monochromatic chromaticities swept through intensity in the current 3D
   world.

2. **Spectral locus rim + active primary triangle**  
   Embeds the xy-panel idea directly into the 3D scene.

3. **D65 / active white marker**  
   A small point or cross on the chromaticity plane helps orient the locus.

### Medium Value

4. **Rec.2100 / BT.2020 with PQ/HLG metadata**  
   Geometry matches Rec.2020 primaries, so this is more of a transfer/HDR label
   than a new shell. Useful only once HDR behavior is modeled.

5. **ACES AP0 / AP1 shells**  
   Useful for film/VFX workflows. Requires adding primaries/white points and
   deciding how to treat AP0's very wide imaginary-primary coverage.

6. **Display P3 D65 vs DCI-P3 theatrical variants**  
   Current label says DCI-P3 D65, but the primaries are Display P3-like with D65
   and sRGB transfer. Clarifying or splitting variants would improve accuracy.

### Advanced / Dataset-Dependent

7. **Pointer's gamut**  
   Real-world object color boundary. Very useful educationally, but requires a
   dataset and license review.

8. **MacAdam limits / optimal color solid**  
   Theoretical reflectance boundary. High scientific value, but significantly
   more complex than RGB shells.

9. **Pointer/MacAdam intensity surfaces**  
   Analogous surfaces for object-color or optimal-color limits, once datasets
   are available.

## Recommended First Implementation

Implement a new **Chromaticity overlay** control with:

```ts
chromaticityOverlay:
  | 'off'
  | 'spectral-surface'
  | 'spectral-surface-primaries'
  | 'spectral-locus'
```

Then:

1. Build a low-alpha mesh from `waveToXyz(nm)` and intensity bands.
2. Normalize each wavelength to `X + Y + Z = 1`.
3. Scale by intensity band `v`.
4. Map each XYZ point to active world space.
5. Draw the surface with CVD-adjusted spectral colors and alpha.
6. Draw the spectral locus rim and line of purples on top.
7. Add active primary triangle for the `spectral-surface-primaries` mode.
8. Rebuild on gamut/world/CVD/overlay changes.
9. Hide it under `hideAids`.

This gives the requested "3D XYZ chromaticity shell" as a curved reference
surface without pretending it is an RGB gamut volume.

## Open Questions

1. Should the overlay use `X + Y + Z = 1` or `Y = 1` normalization?
   Recommendation: start with `X + Y + Z = 1`.

2. Should it be controlled under the existing Gamut step or a new display
   subsection?
   Recommendation: Gamut step, but under a distinct "Chromaticity overlay"
   label.

3. Should it draw through the solid?
   Recommendation: yes for v1, with low alpha, but the surface should be faint
   enough not to compete with the active gamut solid.

4. Should the spectral line use physical colors or UI colors?
   Recommendation: spectral preview colors, CVD-adjusted.

5. Should the line be affected by active gamut?
   Recommendation: no clipping; active gamut affects only the world mapping and
   optional primary triangle.

## Non-Goals

- Do not replace the existing RGB gamut shell pass.
- Do not call the spectral locus surface a "gamut shell" in user-facing UI.
- Do not add external spectral datasets for v1.
- Do not implement Pointer's gamut or MacAdam limits until dataset provenance is
  settled.
- Do not make the overlay pickable in v1.

---

## Review Findings

*Reviewed 2026-06-12. Overall: architecturally sound. Six issues to resolve before
starting implementation.*

### Confirmed correct

- Three-level separation (RGB shells / spectral overlay / spectral primary solid) is
  the right decomposition. Each level is independently shippable.
- `splineProgram` reuse for the colored line strip is correct — it already exposes
  `vec3 position` + `vec3 color` per-vertex attributes and is the natural fit.
- Data model recommendation (add `chromaticityOverlay` field; leave `shell: ShellKey`
  unchanged) avoids schema churn. One version bump, one `toSnapshot`/`coerce` touch.
- Implementation order (wire rim first → surface mesh → primary triangle) is correct.
  The rim proves the XYZ → world mapping before the surface geometry is committed.
- CVD precomputation on CPU before upload matches the pattern used for ramp swatch
  colors in the renderer. Cost is trivial at 140 wavelengths; fine for 3360 vertices too.
- "Do not make the overlay pickable in v1" is the right call — picking a spectral
  surface point that is OOG in the active gamut raises anchor-storage questions that
  need their own design pass.

### Issue 1 — Corrected: `X + Y + Z = 1` rim spans the solid's full lightness range naturally

**Initial review estimates were wrong.** Recomputing through the actual app pipeline
(`waveToXyz → xyz2rgb → toSrgbLin.toSrgb → lsrgb2oklab`):

| wavelength | stimulus | Oklab L |
|---|---|---|
| ~555 nm | peak green | ≈ 0.85 (near sRGB green L≈0.87, top of solid) |
| ~600 nm | orange-red | ≈ 0.74 |
| ~700 nm | deep red | ≈ 0.55 |
| ~450 nm | blue | ≈ 0.36 (mid-range, comparable to a dark blue) |
| ~380 nm | UV boundary | ≈ 0.05 (expected — human eyes barely respond here) |

The rim spans L ≈ 0.05–0.85, covering nearly the full height of the sRGB solid. This
is **physically correct and educationally meaningful**: equal-power monochromatic
green is ~5× more luminous than equal-power blue. The intensity surface naturally
envelops the gamut solid, sweeping from the black point outward to this rim in every
world mode. Users who understand the label will see exactly why the rim varies in
height; users who don't can be taught by the label.

The surface is not a visual confusion risk — it is a correct chromaticity ×
stimulus-magnitude reference structure. The initial "con" listed in the spec was
based on wrong estimates.

**Resolution:** proceed with `X + Y + Z = 1` normalization as-is. Label the overlay
"Spectral locus (XYZ chromaticity)". Reserve per-wavelength constant-L normalization
(binary search per wavelength for a target Oklab L) as a future `spectral-surface-equal-l`
mode — useful for comparing hue geometry at fixed perceptual brightness.

### Issue 2 — Surface depth test should be on, not off

The document recommends "v1: depth test off, low alpha" for the surface. That works
for a line strip, but a ~3360-vertex mesh covering the full viewport with depth test
off will visually bleed through all solid geometry and ramp markers. At low alpha it
becomes a tinted fog over the entire scene.

**Resolution:** use depth test **on** for the surface (parts occluded by the solid are
hidden — acceptable for a reference overlay). Draw the wire locus rim and line of
purples afterward with depth test off so they remain visible even when the solid
occludes the surface. This matches how the slice outline is drawn now.

### Issue 3 — Triangle index buffer layout unspecified

The mesh generation algorithm (140 wavelengths × 24 intensity bands) is described at
the mathematical level but the WebGL index buffer construction is not. Triangle strip
with degenerate vertices, indexed triangle list, and strip restarts all produce the
same geometry but have different constraints on how the surface wraps at the
line-of-purples seam.

**Resolution:** decide before implementation. Indexed triangle list is the simplest
and most flexible — no degenerate vertices, no strip restart extension required, and
the seam between wavelength max and the line of purples is just two extra triangles.
The extra index data at this mesh size is negligible.

### Issue 4 — Confirm `splineProgram` uniforms before reuse

The document assumes `splineProgram` can be reused for the spectral line, but does not
list which uniforms the program requires. If `splineProgram` expects uniforms specific
to the ramp draw call (e.g., alpha modulation tied to solid state), the overlay may
need a thin shader variant or an extra uniform guard.

**Resolution:** read `shaders/spline.vert` and `spline.frag` before starting. If the
only uniforms are the standard `uView`/`uProj`/`uModel` matrices plus one `uAlpha`,
reuse is straightforward. If there are ramp-specific uniforms, create a minimal
`spectral-line` shader variant that shares only the position/color attribute layout.

### Issue 5 — "DCI-P3 D65" label (low priority, no action needed)

The document flags the gamut label as potentially confusing. The primaries in
`pipeline.ts` — (0.68, 0.32), (0.265, 0.69), (0.15, 0.06) at D65 — are exactly
Display P3, which is DCI-P3 adapted to D65. The current label is technically correct;
the confusion is an industry naming issue, not an app bug. No change needed.

### Recommended pre-implementation checklist

1. Decide Issue 1 policy (accept skewed rim vs. constant-L renormalize).
2. Fix Issue 2 in the spec (surface: depth on; rim: depth off).
3. Specify index buffer layout for the surface mesh (Issue 3).
4. Read `splineProgram` uniforms and confirm reuse or note where a variant is needed
   (Issue 4).
5. Add `chromaticityOverlay` to `types.ts`, `state.svelte.ts`, `schema.ts`,
   `snapshot.ts`, and bump schema version.
6. Build the wire locus curve first. Validate XYZ → world mapping visually in all
   five world modes before committing the surface mesh.
