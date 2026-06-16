# Unimplemented Chromaticity Diagrams for Future Integration

This document catalog-details the major chromaticity representation spaces and diagrams that are currently not implemented in COLOR LAB, outlining their mathematical formulas, use cases, and integration paths.

---

## 1. Physiological CIE 2006/2015 Chromaticity ($x_F, y_F$)

Although COLOR LAB supports the **CIE 2006 / Stockman & Sharpe Physiological Observer** datasets, it does not currently define a dedicated physiological chromaticity projection. Instead, it overlays physiological data onto standard CIE 1931 xy coordinates.

*   **Mathematical Formulation**:
    $$x_F = \frac{X_F}{X_F + Y_F + Z_F}, \quad y_F = \frac{Y_F}{X_F + Y_F + Z_F}$$
    Where $X_F, Y_F, Z_F$ are the tristimulus coordinates computed by weighting a spectrum against the CIE 2006 2° or 10° physiological Color Matching Functions (derived from Stockman & Sharpe cone fundamentals).
*   **Why Include It**:
    It corrects the long-standing errors in the blue region of the CIE 1931 standard observer. A dedicated $(x_F, y_F)$ diagram allows scientific analysis of physiological color matches without introducing the geometric coordinate mismatch that occurs when projecting physiological data onto historical CIE 1931 axes.
*   **Implementation Key**: `'cie2006-xfyf'`

---

## 2. Oklab Perceptual Chromaticity Plane ($a, b$)

COLOR LAB currently utilizes Oklab as a 3D world geometry, but does not expose it as a 2D instrument diagram projection on the chromaticity panel.

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

## 6. Historical CIE 1964 10° $(x_{10}, y_{10})$

*   **Mathematical Formulation**:
    $$x_{10} = \frac{X_{10}}{X_{10} + Y_{10} + Z_{10}}, \quad y_{10} = \frac{Y_{10}}{X_{10} + Y_{10} + Z_{10}}$$
    Using the standard CIE 1964 10° Color Matching Functions.
*   **Why Include It**:
    Useful for comparing small-field (2°) vs. large-field (10°) industrial matching criteria.
*   **Implementation Key**: `'cie1964-x10y10'`

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
