# Unimplemented Chromaticity Diagrams for Future Integration

**Status (2026-06-16):** Several spaces below are now **implemented** under different semantics — see [`cone-fundamentals-chromaticity-math-audit.md`](cone-fundamentals-chromaticity-math-audit.md).

| Diagram | Status in app |
|---------|----------------|
| CIE 2006 / physiological xy (xF, yF) | **Shipped** — observer-aware label on the CIE 1931 xy mode when Stockman-Sharpe 2°/10° is selected |
| Oklab (a, b) | **Shipped** as fixed-lightness opponent-plane view (`oklab-ab`), not a chromaticity diagram |
| MacLeod-Boynton (l, s) | **Shipped** — table-backed 2° locus + calibrated SS 2° source-basis projection (`macleod-boynton`); fixed basis, not tied to Observer selector |
| CIE 1964 10° (x10, y10) | **Shipped** — observer-aware label on CIE 1931 xy when CIE 1964 10° observer is selected |

This document catalog-details the major chromaticity representation spaces and diagrams that are **not yet** implemented in COLOR LAB, outlining their mathematical formulas, use cases, and integration paths.

---

## 1. Physiological CIE 2006/2015 Chromaticity ($x_F, y_F$) — **Implemented (observer-aware xy)**

> **Shipped:** When the active observer is Stockman-Sharpe 2°/10°, the chromaticity panel labels and projects physiological XYZ_F coordinates onto xy using the standard chromaticity formula. There is no separate diagram key — the observer selection drives the basis.

*Historical note — original gap:*
    $$x_F = \frac{X_F}{X_F + Y_F + Z_F}, \quad y_F = \frac{Y_F}{X_F + Y_F + Z_F}$$
    Where $X_F, Y_F, Z_F$ are the tristimulus coordinates computed by weighting a spectrum against the CIE 2006 2° or 10° physiological Color Matching Functions (derived from Stockman & Sharpe cone fundamentals).
*   **Why Include It**:
    It corrects the long-standing errors in the blue region of the CIE 1931 standard observer. A dedicated $(x_F, y_F)$ diagram allows scientific analysis of physiological color matches without introducing the geometric coordinate mismatch that occurs when projecting physiological data onto historical CIE 1931 axes.
*   **Implementation Key**: `'cie2006-xfyf'`

---

## 2. Oklab Perceptual Chromaticity Plane ($a, b$) — **Implemented (opponent-plane view)**

> **Shipped** as `oklab-ab` — fixed Oklab L = 0.5 opponent-plane cross-section with sampled gamut boundaries, not a chromaticity diagram.

*Historical note — original gap:*

*   **Mathematical Formulation**:
    Given the Oklab coordinates $L, a, b$ (computed via the non-linear LMS mapping from CIE XYZ):
    *   **X-Axis**: $a$ (Green-Red chromaticity)
    *   **Y-Axis**: $b$ (Blue-Yellow chromaticity)
*   **Why Include It**:
    Oklab is the modern state of the art for perceptual uniformity and is native to the CSS Color Module Level 4. Visualizing gamuts and ramps directly on the Oklab $a\text{-}b$ plane highlights Oklab's superior hue linearity (especially the blue-to-purple transition) compared to historical spaces like CIELAB.
*   **Implementation Key**: `'oklab-ab'`

---

## 3. CAM16-UCS Chromaticity Plane ($a', b'$)

CAM16-UCS is the uniform color space associated with the **CAM16** Color Appearance Model, which accounts for advanced viewing conditions (such as background luminance, adaptational state, and surround brightness).

*   **Mathematical Formulation**:
    $$a' = M' \cos(h), \quad b' = M' \sin(h)$$
    Where $M'$ is the scale-corrected CAM16 colorfulness and $h$ is the CAM16 hue angle.
*   **Why Include It**:
    It is widely considered the most perceptually uniform space available for standard-dynamic-range color comparison, outperforming CIELAB in color-difference predictability.
*   **Implementation Key**: `'cam16-ucs'`

---

## 4. ICtCp Opponent Space ($C_t, C_p$)

Standardized in **ITU-R BT.2100**, ICtCp was specifically designed for High Dynamic Range (HDR) and Wide Color Gamut (WCG) video systems.

*   **Mathematical Formulation**:
    *   **X-Axis**: $C_p$ (Protan / Red-Green opponent axis)
    *   **Y-Axis**: $C_t$ (Tritan / Blue-Yellow opponent axis)
    Derived by mapping XYZ to a physiological LMS space, applying the non-linear Perceptual Quantizer (PQ) or Hybrid Log-Gamma (HLG) transfer function, and projecting to opponent channels.
*   **Why Include It**:
    Unlike traditional spaces, ICtCp's chromaticity representation is optimized to maintain constant hue and chroma under extreme luminance scales (from 0.01 to 10,000 nits), making it highly relevant for HDR television and cinematography applications.
*   **Implementation Key**: `'ictcp-ctcp'`

---

## 5. JzAzBz Chromaticity ($A_z, B_z$)

Developed in 2017 by SAFRAN, JzAzBz is a perceptually uniform color space optimized for HDR and wide-gamut displays.

*   **Mathematical Formulation**:
    *   **X-Axis**: $A_z$ (Red-Green opponent axis)
    *   **Y-Axis**: $B_z$ (Blue-Yellow opponent axis)
*   **Why Include It**:
    It offers significantly better hue linearity than CIELAB (specifically correcting the blue hue-bending problem) and is computationally simpler than CAM16-UCS.
*   **Implementation Key**: `'jzazbz-azbz'`

---

## 6. Historical CIE 1964 10° $(x_{10}, y_{10})$ — **Implemented (observer-aware xy)**

> **Shipped:** When CIE 1964 10° is the active observer, the chromaticity panel label reads `CIE 1964 10° x10 y10` and projects that observer's XYZ coordinates.

*   **Mathematical Formulation**:
    $$x_{10} = \frac{X_{10}}{X_{10} + Y_{10} + Z_{10}}, \quad y_{10} = \frac{Y_{10}}{X_{10} + Y_{10} + Z_{10}}$$
    Using the standard CIE 1964 10° Color Matching Functions.
*   **Why Include It**:
    Useful for comparing small-field (2°) vs. large-field (10°) industrial matching criteria.
*   **Implementation Key**: `'cie1964-x10y10'`

---

## Future: MacLeod-Boynton variants and active-observer LMS ratios

**Shipped today:** `macleod-boynton` — CIE 2° table + Stockman-Sharpe 2° LMS basis only. Independent of the Observer model selector.

**Not planned without source tables or explicit normalization policy:**

| Proposed mode | Notes |
|---------------|-------|
| MacLeod-Boynton 10° | Needs a published 10° MB chromaticity table and fitted `kL`/`kS` for a 10° LMS basis |
| MacLeod-Boynton for another 2° fundamental | Constants must be fitted per table; do not reuse the 2° SS constants blindly |
| Active LMS chromaticity | LMS ratio view using the **active** observer's fundamentals — useful comparison tool but must not be called MacLeod-Boynton |

See [`cone-fundamentals-chromaticity-math-audit.md`](cone-fundamentals-chromaticity-math-audit.md) §Future Work: MacLeod-Boynton Variants.

---

## Integration Blueprint

To implement any of the above diagrams, the following files should be updated:

### 1. `fe/src/lib/color/diagrams.ts`
Add the diagram configuration to the `DIAGRAMS` registry:
```typescript
export const DIAGRAMS: Record<string, ChromaticityDiagram> = {
  // ... existing diagrams ...
  'oklab-ab': {
    key: 'oklab-ab',
    label: 'Oklab (a, b)',
    xAxisLabel: 'a',
    yAxisLabel: 'b',
    project: (xyz) => {
      // Map XYZ to Oklab coordinates
      const srgb = m3.mulV(XYZ2SRGBLIN, xyz);
      const ok = lsrgb2oklab(srgb);
      return [ok[1], ok[2]]; // [a, b]
    }
  }
};
```

### 2. `fe/src/lib/panels/xy-panel.ts`
Implement the corresponding unprojection in `unproject2d` (so background spectrum fill and coordinates inspector continue to work):
```typescript
function unproject2d(x: number, y: number, diagramKey: string): Vec3 | null {
  // ... existing projections ...
  if (diagramKey === 'oklab-ab') {
    // Inverse Oklab: Map [a, b] with L = 0.5 (or active slider L) back to XYZ
    const oklab: Vec3 = [0.5, x, y];
    const srgbLin = oklab2lsrgb(oklab);
    return m3.mulV(SRGB2XYZ, srgbLin);
  }
}
```

### 3. `fe/src/lib/components/LeftControls.svelte` & `schema.ts`
Add the corresponding `<option>` to the UI select element and the validation key to `CHROMATICITY_DIAGRAMS` to persist it properly.
