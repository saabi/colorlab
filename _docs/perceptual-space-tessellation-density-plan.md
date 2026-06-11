# Perceptual-Space Tessellation Density Plan

Status: investigation and implementation proposal.

## Problem

In Oklab, and less strongly in CIELAB, the rendered RGB solid has visibly uneven surface resolution. Darker regions look under-tessellated and faceted, while lighter regions appear compressed with many triangles packed into a smaller world-space area.

This is most visible in Oklab because the Oklab forward transform applies a cube-root-like nonlinearity to linear light. CIELAB has the same general issue through its `f(t)` lightness/chromatic adaptation curve, although the thresholded linear segment makes the behavior slightly different.

## Current Rendering Path

The solid is rendered as six instanced cube faces:

```glsl
int cells = uN * uN;
int face = gl_InstanceID / cells;
int cell = gl_InstanceID - face * cells;
vec2 uv = (vec2(float(cell % uN), float(cell / uN)) + aCorner) / float(uN);
vec3 rgb = faceToRgb(face, uv);
vec3 p = toWorld(rgb);
```

For Oklab:

```glsl
vec3 lms = uOkM1 * rgb;
lms = sign(lms) * pow(abs(lms), vec3(1.0 / 3.0));
vec3 lab = uOkM2 * lms;
return vec3(lab.y * 2.2, lab.x - 0.5, lab.z * 2.2);
```

For CIELAB:

```glsl
vec3 f = vec3(labF(xyz.x / uWhite.x), labF(xyz.y / uWhite.y), labF(xyz.z / uWhite.z));
vec3 lab = vec3(116.0 * f.y - 16.0, 500.0 * (f.x - f.y), 200.0 * (f.y - f.z));
return vec3(lab.y, lab.x - 50.0, lab.z) * 0.01;
```

So the mesh is uniformly sampled in RGB face coordinates, but the displayed surface is the image of those samples under a strongly nonlinear transform.

## Likely Cause

This is not primarily a world-space scale bug. The shape is correct, but the mesh parameterization is not appropriate for perceptual spaces.

The key point is the cube-root derivative:

```text
d(cuberoot(x)) / dx = 1 / (3 * x^(2/3))
```

Near black, small changes in linear RGB can produce relatively large changes in Oklab/CIELAB world position. A uniform RGB grid therefore becomes sparse in dark regions. At higher lightness, the derivative is much smaller, so many RGB samples collapse into a visually compressed light region.

Increasing `N` helps globally, but it wastes most added triangles where the transform is already compressed. The better fix is to redistribute samples before transformation.

## Non-Goal

Do not change the color-space transform or the shape of the solid.

The goal is only to change the sampling of the cube faces so that the same mathematical surface is represented with more useful vertex density.

## Proposed Solutions

### Option 1: Perceptual-Space UV Warp

Apply an analytic warp to each free face coordinate before `faceToRgb`.

Instead of:

```glsl
vec2 uv = linearCellUv;
vec3 rgb = faceToRgb(face, uv);
```

Use:

```glsl
float warp01(float t, float k) {
  return pow(t, k);
}

vec2 uv = vec2(warp01(linearUv.x, k), warp01(linearUv.y, k));
vec3 rgb = faceToRgb(face, uv);
```

With `k > 1`, samples are concentrated toward `0`, which helps compensate for the dark-region expansion caused by cube-root/perceptual transforms.

Recommended first values:

- Oklab: `k = 2.0` or `2.2`.
- CIELAB: `k = 1.6` or `1.8`.
- RGB/XYZ/Luma: keep `k = 1.0`.

Pros:

- Very small shader-only change.
- Keeps the same solid shape because vertices are still evaluated through the same `toWorld(rgb)`.
- Works with the current instanced rendering model.
- No CPU geometry generation.
- No new buffers.

Cons:

- It is only a heuristic.
- The best exponent may differ by face and gamut.
- Surface grid lines based on `vRgb` remain uniform in RGB, while triangles become nonuniform in RGB. That may be acceptable, but should be checked visually.
- Concentrating samples near RGB zero may over-prioritize corners where only one or two channels are dark.

Implementation detail:

- Add a uniform such as `uMeshWarp`.
- Compute it from `spaceMode`, initially hardcoded:
  - Oklab: `2.0`.
  - CIELAB: `1.7`.
  - everything else: `1.0`.
- Apply the warp only to the free `uv` coordinates, not the fixed face coordinate.

This should be the first implementation to try.

### Option 2: Symmetric Dark-Biased Warp Per Channel

The simple `pow(t, k)` warp densifies near `0`, but cube faces also include fixed channels at `1`. On faces such as `R = 1`, dark-looking areas can still occur when the other channels are low, so the simple warp is often enough. However, if visible artifacts remain near mixed-lightness edges, use a per-channel dark-bias based on the full RGB tuple.

Possible formulation:

```glsl
vec3 warpRgb(vec3 rgb, float k) {
  return pow(rgb, vec3(k));
}
```

For fixed `1` channels, `pow(1, k) = 1`, so the face remains on the same cube boundary. Free channels are still concentrated near zero.

This is equivalent to warping `uv` after `faceToRgb`, but it is clearer for future adaptive extensions.

Pros:

- Keeps all face boundaries valid.
- Naturally handles any face.

Cons:

- Same heuristic limits as Option 1.
- Changes the RGB parameter spacing of the whole mesh, so grid and tessellation semantics need to be explained.

### Option 3: Lightness-Equalized Warp

Instead of choosing a fixed exponent, choose face coordinates so that approximate Oklab/CIELAB lightness changes more evenly.

For a rough analytic approximation, invert the cube-root behavior:

```text
desired perceptual coordinate s in [0, 1]
linear-light coordinate ~= s^3
```

This suggests exponents near `3`, but full Oklab lightness is a weighted cube-root of LMS, not a per-channel cube root of RGB. A pure `k = 3` may overcorrect.

A tunable exponent between `1.7` and `2.4` is likely safer. If the app eventually exposes a "perceptual mesh distribution" slider, it could use this range.

Pros:

- Better theoretical match to the observed problem.
- Still cheap and analytic.

Cons:

- Oklab is not separable per RGB channel.
- Needs tuning and screenshot comparisons.

### Option 4: Adaptive Face Tessellation

Generate a nonuniform mesh whose cells are smaller where the RGB-to-world Jacobian has high area stretch.

CPU-side approach:

1. For each face, sample a coarse grid.
2. Estimate local stretch from neighboring `toWorld(rgb)` positions.
3. Subdivide regions with high stretch.
4. Upload a vertex/index buffer per face or per space/gamut.

GPU-side approach:

- Not practical in WebGL2 without tessellation shaders or compute.
- Could emulate some adaptive behavior with instanced tiles and per-band remapping, but complexity rises quickly.

Pros:

- Most accurate solution.
- Can target actual world-space area distortion instead of using a heuristic.

Cons:

- Breaks the current elegant one-quad instanced draw model.
- Requires CPU mesh building, buffers, and cache invalidation per gamut/space.
- More complex interaction with clipping, grid-only pass, and cap behavior.

This should not be the first fix.

### Option 5: Piecewise Band Warp

Keep the instanced draw model but remap rows/columns through a small piecewise function:

```glsl
float warp01(float t) {
  if (t < 0.5) return 0.5 * pow(2.0 * t, k0);
  return 1.0 - 0.5 * pow(2.0 * (1.0 - t), k1);
}
```

This can concentrate samples near both dark and selected high-curvature regions if needed.

Pros:

- Still shader-only.
- More flexible than one exponent.

Cons:

- Harder to reason about.
- Risk of tuning visually rather than mathematically.

Use only if the simple dark-biased warp underperforms.

## Recommended First Implementation

Implement Option 1/2 as an internal shader remap:

```glsl
uniform float uMeshWarp;

vec3 warpRgbForMesh(vec3 rgb) {
  if (abs(uMeshWarp - 1.0) < 0.001) return rgb;
  return pow(clamp(rgb, 0.0, 1.0), vec3(uMeshWarp));
}
```

Then in `main()`:

```glsl
vec3 rgb = warpRgbForMesh(faceToRgb(face, uv));
```

Suggested defaults:

```ts
function meshWarpForSpace(spaceMode: SpaceMode) {
  if (spaceMode === 3) return 2.0; // Oklab
  if (spaceMode === 2) return 1.7; // CIELAB
  return 1.0;
}
```

Keep this internal at first. Do not add a UI control until the visual result is validated.

## Important Side Effects To Check

### Surface Grid

The surface grid currently uses interpolated `vRgb` to draw grid lines. If mesh RGB is warped, interpolation still happens in the warped RGB coordinate domain. Grid lines should remain valid in color-space coordinates, but their density relative to triangle edges changes.

If grid appearance becomes misleading, split the concepts:

- `vRgb`: actual color coordinate used for color and grid.
- `vMeshCoord`: unwarped mesh coordinate used only for grid if needed.

First try without this split.

### Picking

Picking is analytic and uses `fromWorld`, not the rendered mesh triangles. The warp should not affect picking correctness because the surface is still the same RGB cube image, only sampled differently.

### Slice Flattening

The slice flattening loop operates after `toWorld(rgb)` and repeatedly inverts through `fromWorld(p)`. Since the initial vertices still lie on the same cube boundary, the clipping math remains valid.

The cap grid should be checked visually because warped tessellation changes where vertices are available to be flattened onto the cap.

### Boundary Outlines

CPU boundary outlines use their own sampling path (`rgbToWorld` and face/cross-section logic), so they will not automatically match the warped vertex distribution. This is probably fine because outlines are independent line geometry.

### Auto Performance

The warp does not change instance count, so auto performance behavior should be unchanged.

## Validation Plan

Use screenshots at the same camera and state before/after:

1. Oklab, sRGB, `N = 128`, surface grid on.
2. Oklab, sRGB, `N = 256`, surface grid on.
3. CIELAB, sRGB, `N = 128`, surface grid on.
4. Oklab with slice enabled at low lightness.
5. Oklab with slice enabled at high lightness.
6. Oklab with cylindrical cut enabled.

Look for:

- Reduced faceting in dark Oklab regions.
- No obvious over-densification artifacts near black.
- No cracks between cube faces.
- Surface grid remains coherent.
- Slice cap remains coherent.
- Hover/picking still matches visible surface.

## Longer-Term Option

If the shader warp improves the issue but cannot fully solve it, implement a diagnostic "mesh stretch heatmap" mode:

- In the vertex or fragment path, estimate world-space derivatives from `vWorld` or `vRgb`.
- Visualize high stretch regions.
- Use that to tune per-space warp exponents or justify adaptive CPU meshing.

This would make future changes less subjective.
