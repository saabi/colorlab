# Gamut Explorer — Design Document

A WebGL2 instrument for exploring color spaces as 3D solids, slicing them with
arbitrary planes, and inspecting the full stimulus → display transform chain.
Successor to the CIELAB cube viewer; base for the perceptual theme designer.

## 1. Goals

1. Render the image of an RGB cube under any registered color-space transform,
   as a **single instanced draw call** (six 256×256 quad grids from one unit quad).
2. Slice the solid with an **arbitrary plane** by *flattening* vertices in the
   vertex shader (the clamp/project trick from the original viewer, generalized
   from axis-aligned L/chroma clips to any plane `dot(p,n)=d`).
3. **Analytic picking**: ray ∩ slice plane in model space — no geometry raycast,
   no GPU readback; works in regions outside every gamut.
4. Show the **chain of transforms** for the hovered stimulus: encoded RGB →
   linear → XYZ → LMS → Lab/Oklab, with linked instrument panels
   (transfer curve, cone fundamentals, xy chromaticity).
5. **Single source of truth**: every matrix and curve lives once, in JS; the
   GPU receives them as uniforms. Shader fields and CPU markers cannot disagree.

## 2. Non-goals (for this base)

- WebGPU backend (see §9), text rendering in-scene, HDR output, theme-token
  export (next layer), marching-squares authorable boundary (next layer).

## 3. Architecture

```
┌────────────────────────────────────────────────────────────┐
│ pipeline.js  — SINGLE SOURCE OF TRUTH                      │
│  · transfer functions (sRGB piecewise, pure-gamma)         │
│  · primaries → RGB↔XYZ matrices (Primaries/White algebra)  │
│  · CIELAB f/f⁻¹ (corrected), Oklab M1/M2, cone fits        │
│  · mat3/vec3 helpers, inverses                             │
├────────────────────────────────────────────────────────────┤
│ registry.js  — color space + gamut registries              │
│  · gamuts: sRGB/Rec709, NTSC'53, EBU, SMPTE-C, P3-D65,     │
│            Rec2020, CIE-RGB  (the conserved museum)        │
│  · spaces: Linear RGB · CIE XYZ · CIELAB · Oklab           │
│  · per space: { mode, worldArrange, inverse, planePresets }│
├────────────────────────────────────────────────────────────┤
│ renderer.js  — WebGL2                                      │
│  · solid: 1 unit quad, drawArraysInstanced ×(6·N²)         │
│  · gl_InstanceID → face,cell,uv → cube rgb → toWorld(mode) │
│  · slice flatten in vertex shader (slab clamp ±ε)          │
│  · floor grid (port of grid.frag), hover marker (POINTS)   │
├────────────────────────────────────────────────────────────┤
│ pick.js      — analytic ray·plane, world→space→rgb inverse │
│ panels.js    — 2D-canvas instruments (OETF, cones, xy)     │
│ ui.js, camera.js, main.js                                  │
└────────────────────────────────────────────────────────────┘
```

In this artifact all modules live in one HTML file, delimited by
`/* == module: name == */` banners that match the intended repo layout:

```
src/
  pipeline.js   registry.js   renderer.js   shaders/
  pick.js       panels.js     camera.js     ui.js     main.js
index.html      DESIGN.md
```

## 4. Single source of truth

- All matrices are authored **row-major in JS** (`pipeline.js`) and uploaded
  column-major (`m3gl` transpose) as uniforms. The shader never hard-codes a
  matrix that exists in JS.
- Nonlinearities that cannot be uniforms (Lab f, cube root) are implemented
  twice but **tested against each other**: `selftest()` round-trips corner and
  random colors through JS forward/inverse at startup and logs any drift.
- Gamut changes (NTSC, P3 …) recompute `RGB→XYZ` from primaries/white via the
  same `Primaries/White` algebra as `colorspaces.glsl`, then re-upload. The
  Oklab path for non-sRGB gamuts composes `gamutRGB→XYZ→linear-sRGB` into M1
  on the CPU, so the shader stays gamut-agnostic.

## 5. Slice mathematics

World position `p = arrange(space(rgb))`. With plane `(n, d)`,
signed distance `s = dot(p,n) − d`. Cut modes (two checkboxes):
**above** clamps `s ≤ +ε`, **below** clamps `s ≥ −ε`, both ⇒ slab `±ε`.

A bare clamp along `n` is not sufficient: far-side vertices land at in-plane
positions whose colors do not exist at the plane, overflowing the true
cross-section. The fix is the generalized form of the original
`colorspace.vert` loop — after each flatten, **invert world→RGB, clamp RGB to
the cube (folding the vertex onto the cross-section boundary), and re-derive
world**, iterated ×3 with a final exact snap. This requires `fromWorld` in the
vertex shader; its inverse matrices are computed in `pipeline.js` and uploaded
as uniforms (single-source preserved).
Presets: **Lightness** (n = +Y world), **Hue plane** (n horizontal, plane
contains the neutral axis ⇒ d=0; shows hue θ and θ+180°), **Custom**
(spherical az/el normal + offset). All presets are expressed in world space so
they are valid in every registered space.

## 6. Picking

Ray from camera basis (no mat4 inverse): `dir = normalize(f + x·tanθ·a·r + y·tanθ·u)`.
The ray is marched against the **visible-surface field**: a point is inside
the rendered solid iff `fromWorld(p) ∈ [0,1]³` *and* it survives the active
cut. First entry is bisected (~20 iterations) to the boundary, which is a cube
face or the slice cap — whichever is actually in front. Every picked point is
therefore a real color by construction; the earlier infinite-plane
intersection reported phantom out-of-gamut hits beyond the cross-section
boundary. The chain readout and panels are fed from this single CPU
evaluation — **one stimulus, N instruments**.

Cone panel honesty rule: excitations are integrals, so a general stimulus is
shown as three **bars** (basis-consistent with the plotted fits via
inv(LMS2XYZ2)); only spectral stimuli would sit *on* the λ-curves. The xy
panel plots the stimulus inside the locus built from the same cone fits.

## 7. Bugs fixed from the uploaded shaders

| File | Bug | Fix |
|---|---|---|
| colorspaces.glsl `xyz2lab` | `a* = 500(fx−fz)` (Z-referenced) | `500(fx−fy)`; inverse updated to `fx = a/500 + fy` |
| colorspaces.glsl `primariesSamsung1` | `0.0.042` parse error; Rec2020 comment | corrected literal; not carried into registry |
| colorspace.vert | dead, divergent `xyz2lab` (extra /100) | removed; one canonical Lab |
| LMS bases | two unlabelled conventions | curves and bars both pinned to `LMS2XYZ2` basis |
| labU `/100` | magic scale baked into transform | per-space `arrange` (scale+offset) in registry |

## 8. Rendering details

- Solid: `TRIANGLE_STRIP`, 4 verts, `6·N²` instances; N ∈ {64,128,192,256}.
  Faces: id/(N²) → axis pinned to 0/1; uv from id%(N²). No index/vertex buffers
  beyond the 8-float corner quad — the memory argument that motivated instancing.
- Fragment: port of `colorspace.frag` (display = sRGB-encoded cube parameter,
  AA major/minor grid via `fwidth`, distance fade).
- Floor: port of `grid.frag` with the radial rings **enabled** (they were
  commented out in the upload but present in the screenshot); additive blend,
  no depth write.
- DPR-aware framebuffer (cap 2), orbit camera (drag/wheel/touch).

## 9. WebGPU migration notes

The design isolates exactly what WebGPU changes: `renderer.js` (pipeline/bind
groups replace program/uniforms; `@builtin(instance_index)` replaces
`gl_InstanceID`; WGSL ports of the two shaders) and nothing else — pipeline,
registry, picking, panels are API-free. The flatten and instancing translate
1:1. Recommended order: land features on WebGL2, then add `renderer-webgpu.js`
behind a capability check.

## 10. Roadmap

1. Okhsl/Okhsv: deferred as *geometry modes* (see §11); planned as picker
   coordinates in the theme layer instead.
2. P3/Rec.2020 **shells** — **shipped**: second instanced pass through the
   identical pipeline (same cut), additive ghost.
3. Cross-section boundary (marching squares + edge bisection) — **shipped**
   as a rendered outline; the same polyline is the future snap-to-gamut path.
4. Theme layer — v0 ramps shipped earlier; **v1 adds**: Spread-from-primary
   mode (Δhue/Δchroma, linear or mirror chroma profile), WCAG contrast per
   stop (tooltips + exports), DTCG JSON export alongside CSS oklch tokens.
5. Spectrum strip — **shipped**: JS port of spectrum.frag (same cone fits,
   LMS white balance, gamutScale), with dominant-wavelength marker
   (complementary λc reported on the purple side).
6. Display calibration: a "Custom display" gamut entry with user-entered
   primary/white chromaticities; optional EDID-derived defaults (e.g. the
   public linuxhw/EDID corpus) with the caveat that EDID chromaticities are
   manufacturer-claimed, not measured — user-supplied colorimeter values
   (DisplayCAL/ArgyllCMS) take precedence. Browsers expose neither EDID nor
   the active ICC profile, so entry is manual or fetched from a service.

## 11. Why Okhsl/Okhsv are not geometry modes

Both are *display-gamut-relative* remaps of Oklab: their coordinates are
normalized against the sRGB cusp, so the sRGB cube's image under them is a
perfect cylinder by construction — geometrically trivial, and misleading for
any non-sRGB cube. They earn their keep as **picker coordinates** (sliders
that behave like HSL but stay perceptual), which is where the theme layer
will adopt them.

## 12. Slice fold — final-snap correction

The fold loop must END on the cube clamp, and the cap may be flattened only
where the snapped point is still a valid color. An unconditional final snap
parks non-converged far-side vertices on the plane outside the cube (the
overflow sheet observed with thin slabs on steep custom planes). Verified at
the reported failing configuration: cube violation bounded by the 2e-3 snap
tolerance across 3k random vertices.

## 13. Cube orientation and the luminance romboid

The Linear RGB cube (mode 0) and Luminance romboid (mode 5) render rotated so
the neutral diagonal [1,1,1] aligns with world +Y — black on its bottom
corner, white on top, R/G/B at equal mid-height. The rotation `rx(−atan√2)·
ry(−45°)` is scaled so |white.y| = 0.5, matching the floor plane every other
space rests on. The romboid keeps the same xz but sets vertical = Rec.709
luminance, so equal heights are equal luma; it inverts (for picking) through
the rotated-cube map, which is exact enough for a didactic view.
Default world space is **Oklab**; CIELAB is retained, labelled deprecated, for
didactics and cross-checking.

## 14. Color vision deficiency

Simulated at the **LMS cone stage** — the physically correct locus. sRGB-linear
→ cone LMS (via `XYZ2LMS2 · sRGB→XYZ`) → dichromat projection → back to RGB, in
the fragment shader so the whole solid is seen as a deficient viewer would.
Each projection is **derived from this project's own cone fits + the D65 white
point** (Viénot/Brettel method: collapse the missing cone coordinate onto the
plane through W and an anchor wavelength), so it is idempotent *and* fixes the
neutral axis exactly — grays stay gray (white-drift < 1e-9). An earlier set of
borrowed constants drifted grays by 12–17%; corrected. Severity interpolates
identity→projection for anomalous trichromats (verified exact at both ends).
The hovered-stimulus swatch carries the same simulation from the same `CVD`
matrices (single source); surface grid lines stay keyed to true color so
structure remains legible.

## 15. Theme auto-adjust heuristics

All operate on stops in Oklab regardless of view space:
- **Fit inside sRGB** — hold L,h; bisect chroma to the gamut boundary (the
  chroma-reduction map, per stop).
- **Ensure WCAG AA** — hold C,h; move L away from the chosen background until
  the target ratio (slider, 3–7) is met.
- **Even perceptual spacing** — re-sample stops at equal Oklab arc length
  between the endpoints (fixes bunching from non-uniform anchors).

## 16. Z-order

Wide-gamut shell first with depth-test OFF (additive, behind), then the opaque
main solid (writes depth; its grid lines are in-shader so they never fight),
then floor (additive, no depth write), markers, and the cross-section outline
LAST with depth-test off so it is always visible. This removes the
shell/solid z-fighting.
