# Evaluation of Perceptually Equidistant Color Spaces for Colorlab

Status: Research & Implementation Proposal

This document evaluates the color spaces referenced in [`_docs/references.md`](file:///home/ushif/repos/colorlab/_docs/references.md) alongside modern researched alternatives, with a focus on **perceptually equidistant metrics** (like CIELAB and Oklab) that would be valuable additions to the Gamut Explorer and Theme Designer.

---

## 1. Color Spaces from `references.md`

### CIELUV ($L^*u^*v^*$)
* **Standard:** ISO/CIE 11664-5:2024 (CIE 1976 L\*u\*v\*)
* **Overview:** Standardized by the CIE in 1976 alongside CIELAB, CIELUV is a sibling space designed for perceptual uniformity.
* **Key Characteristic:** Unlike CIELAB, it features a corresponding **Uniform Chromaticity Scale (UCS) diagram** ($u', v'$). In this diagram, additive mixtures of lights (e.g., combining primaries) lie along straight lines.
* **Relevance to Colorlab:** 
  - Drawing color trajectories or splines in CIELUV is highly relevant for display technologies because it maps linear operations on light mixtures directly.
  - However, its hue uniformity is generally considered slightly worse than CIELAB, and significantly worse than Oklab.

### SRLAB2
* **Reference:** Jan Bezold (Magnetkern)
* **Overview:** A rectangular color space ($L^*, a^*, b^*$) designed to be as simple to compute as CIELAB while incorporating the superior perceptual uniformity of the CIECAM02 color appearance model.
* **Key Characteristic:** It uses a simplified transform of XYZ to simulate cone responses, followed by a compression step, resolving many of CIELAB's non-uniformities (like the blue-to-purple shift).
* **Relevance to Colorlab:**
  - Excellent candidate for a "better CIELAB" that doesn't carry the high computational complexity of full CAM16/CIECAM02.
  - Very clean implementation profile, making it easy to run on both the CPU and GPU.

### OKLrCH (Reference Lightness $L_r$)
* **Reference:** Björn Ottosson
* **Overview:** A modified variant of OKLCH where the standard lightness $L$ is replaced with a reference lightness $L_r$.
* **Key Characteristic:** The lightness $L$ in Oklab differs noticeably from CIELAB's $L^*$ (which is a standard in design industries). By applying a "toe" correction ($L_r = toe(L)$), OKLrCH aligns Oklab's lightness scale directly with CIELAB's $L^*$ while preserving Oklab’s superior hue and chroma uniformity.
* **Relevance to Colorlab:**
  - Highly useful for designers who want the predictability of CIELAB lightness (e.g., matching WCAG contrast standards that are calibrated around CIELAB-like formulas) combined with the smooth, hue-constant interpolation of Oklab.

---

## 2. Advanced Researched Color Spaces

Through external research, the following perceptually equidistant spaces stand out as highly interesting candidates for Colorlab:

### JzAzBz (Safdar et al., 2017)
* **Philosophy:** Engineered specifically for **High Dynamic Range (HDR)** and **Wide Color Gamut (WCG)** systems.
* **Key Characteristic:** 
  - Uses the Dolby PQ (Perceptual Quantizer, SMPTE ST 2084) transfer function to model luminance response instead of a simple power-law or log curve.
  - Achieves **exceptional hue linearity**, completely eliminating the blue-to-purple shift that plagues CIELAB and improving upon Oklab in highly saturated regions.
* **Relevance to Colorlab:**
  - As Colorlab orbits wide gamuts like Display P3 and Rec.2020, JzAzBz is the most mathematically robust space for measuring equidistant ramps at extreme saturations and high luminance.
  - Perfect for building HDR-ready design tokens.

### CAM16-UCS ($J' a' b'$)
* **Philosophy:** The Uniform Color Space (UCS) variant of the CIE-standardized CAM16 Color Appearance Model.
* **Key Characteristic:**
  - Represents the state-of-the-art in perceptual color difference ($\Delta E$) prediction.
  - Accounts for viewing conditions (ambient light, surround luminance, background reflection). By fixing these to a standard setting (e.g., sRGB viewing environment: D65, 64 lux, 20% gray background), it can be used as a static color space.
* **Relevance to Colorlab:**
  - The "gold standard" for scientific colorimetry. Adding it would allow users to inspect colors through the most perceptually accurate model available today.
  - Its complexity makes it heavy for GPU vertex/fragment shaders, but it is excellent for CPU-side spline evaluation.

### IPT (Ebner & Fairchild, 1998)
* **Philosophy:** Designed specifically for **hue uniformity** during gamut mapping.
* **Key Characteristic:** A straight line in IPT coordinate space corresponds to an almost perfectly constant perceived hue.
* **Relevance to Colorlab:**
  - Ramps generated along an IPT spline will maintain absolute hue consistency from maximum saturation all the way to gray, making it the superior space for creating "clean" monochromatic ramps.

---

## 3. Comparison of Perceptually Equidistant Spaces

The table below compares these spaces for inclusion in Colorlab's 3D engine:

| Color Space | Mathematical Complexity | Hue Linearity / Constant Hue | Lightness Predictability | Primary Strength | Best Use Case in Colorlab |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **CIELAB** | Low | Poor (blue shifts to purple) | Excellent ($L^*$ standard) | Industry standard | Existing baseline (Mode 2) |
| **CIELUV** | Low | Poor | Good | Additive mixing linearity | Display calibration analysis |
| **Oklab** | Low | Excellent | Good | Simple & fast, uniform | Standard rendering & picking (Mode 3) |
| **SRLAB2** | Low | Very Good | Excellent ($L^*$ matched) | Simple alternative to CIELAB | Computational color workflows |
| **OKLrCH** | Low | Excellent | Excellent ($L^*$ matched) | Matches CIELAB lightness | High-contrast design tokens |
| **JzAzBz** | Medium | Outstanding (HDR optimized) | Excellent | Best-in-class for WCG/HDR | Wide-gamut theme ramps |
| **CAM16-UCS** | High | Outstanding | Outstanding | Scientific accuracy | Precision inspection & measurement |
| **IPT** | Low | Outstanding | Fair | Perfect hue-constancy | Monochromatic theme ramps |

---

## 4. Implementation Recommendations

To enrich Colorlab's scientific capabilities and design workflows, we recommend implementing the following three spaces next:

1. **JzAzBz** (as Space Mode 6):
   - **Why:** Essential for modern wide-gamut (Rec.2020) and HDR exploration.
   - **Implementation:** Implement the PQ-curve compression and coordinate mapping in [`fe/src/lib/color/pipeline.ts`](file:///home/ushif/repos/colorlab/fe/src/lib/color/pipeline.ts).
2. **IPT** (as Space Mode 7):
   - **Why:** Solves the problem of hue-shifting theme ramps during saturation sweeps.
   - **Implementation:** Straightforward matrix multiplication and power-law functions.
3. **OKLrCH** (as a sub-mode or alternative coordinates):
   - **Why:** Solves Svelte/DTCG designers' need for $L^*$ compliance without losing Oklab's hue properties.
   - **Implementation:** Implement `toe` and `toe_inv` functions in [`fe/src/lib/color/transfer.ts`](file:///home/ushif/repos/colorlab/fe/src/lib/color/transfer.ts).
