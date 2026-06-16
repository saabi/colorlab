# Cone Fundamentals And Chromaticity Math Audit

Status: verification report, 2026-06-16.

Implementation status:

- Implemented in this pass:
  - table-backed MacLeod-Boynton spectral locus coordinates;
  - fixed-lightness Oklab and CIELAB opponent-plane projections and labels;
  - sampled fixed-lightness gamut boundaries for Oklab/CIELAB opponent planes;
  - observer-range-safe spectral locus generation;
  - table-comparison regression tests for CIE xy, CIE 2006 xF/yF, and
    MacLeod-Boynton locus data;
  - fixed-lightness gamut-boundary regression tests for Oklab/CIELAB.
- Deferred:
  - verified MacLeod-Boynton projection/inverse for arbitrary non-spectral
    stimuli.

Scope reviewed:

- `fe/src/lib/color/fundamentals.ts`
- `fe/src/lib/color/diagrams.ts`
- `fe/src/lib/color/locus.ts`
- `fe/src/lib/color/xyz-spaces.ts`
- `fe/src/lib/panels/xy-panel.ts`
- `fe/src/lib/panels/cones-panel.ts`
- `fe/src/lib/renderer/uniforms.ts`
- `fe/src/lib/renderer/webgl-renderer.ts`
- generated datasets under `data/processed/` and `fe/src/lib/color/data/`

Validation run:

- `npm test` in `fe/`: passed, 129 tests.
- `npm run check` in `fe/`: passed, 0 diagnostics.
- Direct CSV numeric probes against generated datasets.

## Summary

The recent dataset work is directionally sound, and the core Stockman-Sharpe
LMS -> CIE 2006 XYZ matrix path is numerically consistent with the generated
CIE 2006 XYZ table. CIE `xy`, CIE 1960 `uv`, and CIE 1976 `u'v'` formulas are
standard for XYZ inputs.

The audit found three exposed diagram modes that should not be considered valid
chromaticity diagrams unless handled with explicit mode-specific semantics:

1. **MacLeod-Boynton**: arbitrary-stimulus projection does not yet match the
   normalization of the bundled
   MacLeod-Boynton coordinate table.
2. **Oklab `(a, b)`**: this is not a chromaticity diagram; it is now handled as
   a fixed-lightness opponent-plane view.
3. **CIELAB `(a*, b*)`**: this is not a chromaticity diagram; it is a
   lightness-dependent opponent plane and is now handled as a fixed-lightness
   opponent-plane view.

The safest near-term fix is to keep CIE 1931 `xy`, CIE 1960 `uv`, and CIE 1976
`u'v'` as true chromaticity diagrams, while moving MacLeod-Boynton to a
table-backed projection and relabeling Oklab/CIELAB as **opponent-plane views**
with explicit fixed-lightness or normalized-stimulus policy.

## Numeric Checks

### Stockman-Sharpe LMS -> CIE 2006 XYZ

Checked `data/processed/ss2deg_1nm.csv` through the matrix in
`fundamentals.ts` against `data/processed/ciexyz2006_2deg_1nm.csv`.

Result:

- RMS absolute XYZ vector error: `1.42e-6`
- Max absolute vector error: `5.76e-6` at `444 nm`

This is good and appears to be rounding-level agreement.

Examples:

| nm | Matrix XYZ | CIE 2006 table XYZ |
|----|------------|--------------------|
| 390 | `[0.003769647, 0.000414616, 0.018472607]` | `[0.00376965, 0.000414616, 0.0184726]` |
| 500 | `[0.002461503, 0.348353165, 0.237675460]` | `[0.00246159, 0.348354, 0.237675]` |
| 555 | `[0.528023412, 0.999460622, 0.002327184]` | `[0.528023, 0.999461, 0.00232719]` |

Verdict: **valid**.

### CIE 1931 XYZ -> xy

Checked `x = X/(X+Y+Z)`, `y = Y/(X+Y+Z)` from
`data/processed/ciexyz31_1nm.csv` against `data/processed/ciexy31_1nm.csv`.

Result:

- RMS coordinate error: `3.73e-6`
- Max coordinate error: `1.82e-5` at `591 nm`

This is rounding-level agreement.

Verdict: **valid**.

### CIE 2006 XYZ_F -> x_F y_F

Checked the same projection from `ciexyz2006_2deg_1nm.csv` against
`ciexy2006_2deg_1nm.csv`.

Result:

- RMS coordinate error: `4.20e-6`
- Max coordinate error: `7.56e-6` at `786 nm`

Verdict: **valid**.

## Findings

### 1. MacLeod-Boynton Projection Is Not Currently Valid

Current implementation in `diagrams.ts`:

```ts
l = L / (L + M)
s = S / (L + M)
```

Compared against bundled `data/processed/smb_cc_2deg_1nm.csv`, using
Stockman-Sharpe 2° LMS:

- RMS coordinate error: `4.21`
- Max coordinate error: `12.67` at `415 nm`

Examples:

| nm | Current projection | Bundled MB table |
|----|--------------------|------------------|
| 390 | `[0.5298, 12.1877]` | `[0.6905, 0.8557]` |
| 450 | `[0.3642, 6.9779]` | `[0.5315, 0.5485]` |
| 500 | `[0.4032, 0.1714]` | `[0.5723, 0.0131]` |
| 555 | `[0.5024, 0.000626]` | `[0.6666, 0.000045]` |
| 700 | `[0.9417, 0]` | `[0.9697, 0]` |

The bundled table likely includes the conventional MacLeod-Boynton
normalization/scaling. The current formula is an unscaled LMS ratio, so it is
not equivalent to the source data.

Required fix:

- Use the bundled `smb_cc_2deg_1nm` table for the spectral locus when the
  diagram is MacLeod-Boynton.
- For arbitrary XYZ stimuli, implement the same normalization used by the source
  table, or defer arbitrary MB projection until the scale is verified.
- Do not use the current simple `S/(L+M)` value as the plotted `s` coordinate
  while labeling it MacLeod-Boynton.

Recommended short-term UI behavior:

- Either hide MacLeod-Boynton until table-backed projection is implemented, or
  label it explicitly as `Unscaled LMS ratio (experimental)`.

### 2. Oklab `(a, b)` Is Not A Chromaticity Diagram

Current implementation:

```ts
const srgbLin = XYZ2SRGB * xyz;
const ok = lsrgb2oklab(max(srgbLin, 0));
return [ok.a, ok.b];
```

Problems:

- Oklab is an opponent color appearance-ish coordinate transform, not a
  chromaticity system. `(a, b)` depends on Oklab lightness and stimulus scale.
- Spectral and wide-gamut XYZ values often convert to negative linear sRGB
  channels. Clamping those channels before Oklab changes the color direction and
  breaks spectral-locus geometry.
- The sRGB primary triangle is not a straight triangle in Oklab `(a, b)`.
  Drawing straight edges between projected primaries is not the true projected
  gamut boundary in a nonlinear space.
- The background fill unprojects by assuming fixed `L = 0.5`, but the locus and
  gamut primaries are projected with their actual Oklab `L`. That mixes two
  different slices in one plot.

Verdict: **invalid as a chromaticity diagram**. It can be a useful
**Oklab opponent-plane view** if its slice policy is explicit.

Recommended fix:

- Rename UI option to `Oklab a/b plane (L fixed)` or similar.
- Define a fixed `L` for the whole diagram, or normalize stimuli to a chosen
  Oklab `L` before taking `(a, b)`.
- Do not clamp negative linear sRGB before Oklab when projecting reference
  spectra. If a sign-preserving Oklab transform is used elsewhere, use the same
  policy here.
- Replace straight primary triangles with sampled projected gamut boundaries for
  nonlinear diagrams, or omit gamut triangles in this mode.

Implementation update:

- Oklab now uses a fixed `L = 0.5` slice.
- The panel samples the active gamut boundary by binary-searching maximum chroma
  per hue in that fixed slice and checking the resulting XYZ against the active
  RGB gamut.
- The sRGB preview fill also uses the fixed-lightness inverse and true sRGB
  inclusion, rather than a projected primary triangle.

### 3. CIELAB `(a*, b*)` Is Not A Chromaticity Diagram

Current implementation:

```ts
const lab = xyz2lab(xyz, D65);
return [lab.a, lab.b];
```

Problems:

- CIELAB `a* b*` is not chromaticity. It depends on `L*`, reference white, and
  stimulus scale.
- Spectral CMF values are not normalized to a constant luminance before
  projection, so the spectral curve is partly a luminous-efficiency curve in
  disguise.
- The background fill unprojects with fixed `L = 50`, but the plotted locus and
  gamut primaries use their actual `L*`.
- Like Oklab, straight primary triangles in Lab `a*b*` are not true projected
  gamut boundaries.

Verdict: **invalid as a chromaticity diagram**. It can be a useful
**CIELAB opponent-plane view** if shown as a fixed-`L*` slice.

Recommended fix:

- Rename UI option to `CIELAB a*/b* plane (L* fixed)`.
- Use a fixed `L*` for plotted stimuli, or normalize spectral/gamut data to the
  same luminance before plotting.
- Use the correct reference white for the selected XYZ space / observer, not
  blindly D65 if non-D65 or non-CIE-1931 contexts are active.
- Replace straight primary triangles with sampled projected gamut boundaries, or
  omit them in this mode.

Implementation update:

- CIELAB now uses a fixed `L* = 50` slice.
- The panel samples the active gamut boundary by binary-searching maximum chroma
  per hue in that fixed slice and checking the resulting XYZ against the active
  RGB gamut.
- The sRGB preview fill also uses the fixed-lightness inverse and true sRGB
  inclusion, rather than a projected primary triangle.

### 4. Locus Generation Defaults Can Produce Artificial Endpoints

`generateSpectralLocus` defaults to `380..780 nm`, while Stockman-Sharpe tables
are currently `390..830 nm`. Because `interpolateDataset` returns zero outside
the tabulated range, a default locus for Stockman-Sharpe starts with a `[0,0,0]`
sample and projects it to `[0,0]`.

Current `xy-panel.ts` avoids this for the panel because it uses spectrum constants
that appear to align better, but the reusable `generateSpectralLocus` helper can
still produce artificial endpoints.

Recommended fix:

- Default `generateSpectralLocus` to `observer.dataset.wavelengthRange`.
- Only allow explicit ranges after intersecting them with the dataset range.
- Do not include zero-valued out-of-range points in purple-line endpoints.

### 5. CIE 1931 / 1960 / 1976 Projections Are Valid But Need Observer Labels

The projection formulas are correct:

- CIE 1931: `x = X/(X+Y+Z)`, `y = Y/(X+Y+Z)`.
- CIE 1960 UCS: `u = 4X/(X+15Y+3Z)`, `v = 6Y/(X+15Y+3Z)`.
- CIE 1976 UCS: `u' = 4X/(X+15Y+3Z)`, `v' = 9Y/(X+15Y+3Z)`.

But when the active observer is CIE 2006 / Stockman-Sharpe-derived, the label
`CIE 1931 (x, y)` is no longer precise. It should become observer-aware:

- `CIE 1931 xy` when using CIE 1931 XYZ.
- `CIE 2006 x_F y_F` when using the CIE 2006 physiological XYZ_F observer.
- Equivalent explicit labels for CIE 1964 10° and Judd/Judd-Vos variants.

### 6. Gamut Background Fill Is Only Exact For Projective Diagrams

The `xy-panel.ts` background fill unprojects 2D coordinates to XYZ and then to
sRGB. This is appropriate for `xy`, `uv`, and `u'v'` because those are
projective chromaticity coordinates.

It is not appropriate for:

- MacLeod-Boynton until the correct inverse/normalization is implemented.
- Oklab and CIELAB opponent-plane views unless a fixed lightness slice is used
  consistently for all plotted elements.

## Recommended Implementation Order

1. **Restrict or relabel invalid modes immediately**
   - Keep `cie1931-xy`, `cie1960-uv`, and `cie1976-upvp`.
   - Hide or mark MacLeod-Boynton as experimental until it is table-backed.
   - Relabel Oklab/CIELAB as fixed-lightness opponent-plane views, not
     chromaticity diagrams.

2. **Fix MacLeod-Boynton**
   - Use `smb_cc_2deg_1nm` for locus plotting.
   - Derive/verify the conventional transform and scale for arbitrary stimuli.
   - Add a test comparing spectral locus points against the bundled table.

3. **Split diagram kinds**
   - `chromaticityDiagram`: CIE xy/uv/u'v'/MacLeod-Boynton once fixed.
   - `opponentPlane`: Oklab `a/b`, CIELAB `a*/b*`, possibly IPT/JzAzBz later.

4. **Use sampled boundaries for nonlinear planes**
   - For Oklab/CIELAB, sample RGB cube edges/faces and project them into the
     plane. Do not draw straight primary triangles.
   - Status: implemented with per-hue radial binary search in the fixed
     opponent plane. This samples the true cross-section boundary rather than
     only cube edges/faces.

5. **Strengthen tests**
   - Compare CIE xy tables to projected XYZ tables.
   - Compare CIE 2006 xy tables to projected XYZ_F tables.
   - Compare MacLeod-Boynton table to implementation.
   - Verify `generateSpectralLocus` does not include out-of-range zero samples.
   - Verify sampled Oklab/CIELAB fixed-lightness boundaries remain inside the
     target gamut.

## Test Coverage Gap

Current `fundamentals.test.ts` mostly verifies that values are finite and that a
few broad inequalities hold. It does not catch the MacLeod-Boynton mismatch or
the nonlinear-plane labeling issues.

Add table-comparison tests before relying on these diagram modes in tutorials or
user-facing diagnostics.
