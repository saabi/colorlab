# External references

Curated reading that informs COLOR LAB's color math, gamut handling, and theme workflows. Prefer these official sources over blog summaries when implementing or auditing the pipeline.

## CIE / ISO colorimetry

| Standard | URL | Relevance |
|----------|-----|-----------|
| **CIE 015:2018 — Colorimetry, 4th Edition** | [cie.co.at/publications/colorimetry-4th-edition](https://www.cie.co.at/publications/colorimetry-4th-edition) | Umbrella CIE recommendation for tristimulus values, chromaticity coordinates, illuminants, and color-difference practice. Background for the whole XYZ → xy → Lab/Luv chain. |
| **ISO/CIE 11664-1:2019 — CIE standard colorimetric observers** | [cie.co.at/publications/colorimetry-part-1-cie-standard-colorimetric-observers](https://www.cie.co.at/publications/colorimetry-part-1-cie-standard-colorimetric-observers) | Defines the CIE 1931 2° and CIE 1964 10° color-matching functions used to build XYZ from spectra and cone fundamentals. |
| **CIE 1931 standard colorimetric system** (e-ILV) | [cie.co.at/eilvterm/17-23-045](https://cie.co.at/eilvterm/17-23-045) | Terminology entry for the XYZ tristimulus system and its relationship to chromaticity coordinates. |
| **ISO/CIE 11664-4:2019 — CIE 1976 L\*a\*b\* (CIELAB)** | [cie.co.at/publications/colorimetry-part-4-cie-1976-lab-colour-space-1](https://www.cie.co.at/publications/colorimetry-part-4-cie-1976-lab-colour-space-1) | Official definition of CIELAB and Euclidean ΔE in Lab. Used in `pipeline.ts`, world-space mode 2, spline interpolation (`interp.ts`), and the values panel. |
| **ISO/CIE 11664-5:2024 — CIE 1976 L\*u\*v\* (CIELUV)** | [cie.co.at/publications/colorimetry-part-5-cie-1976-luv-colour-space-and-u-v-uniform-chromaticity-scale-1](https://www.cie.co.at/publications/colorimetry-part-5-cie-1976-luv-colour-space-and-u-v-uniform-chromaticity-scale-1) | Official definition of CIELUV and u′v′ chromaticity. Used for CIELUV / CIELCh(uv) spline interpolation. |

## Alternative to CIELAB

| Resource | URL | Relevance |
|----------|-----|-----------|
| **SRLAB2** (Magnetkern) | [magnetkern.de/srlab2.html](https://www.magnetkern.de/srlab2.html) | A CIELAB-like rectangular space (L\*, a\*, b\*) derived from CIECAM02 transformations to improve lightness/chroma/hue uniformity while staying nearly as simple as CIELAB. Reference C code for sRGB ↔ SRLAB2; useful context when comparing the app's CIELAB spline interpolation against perceptually motivated Lab alternatives. |

## RGB color spaces, primaries, and transfer functions

| Standard | URL | Relevance |
|----------|-----|-----------|
| **IEC 61966-2-1:1999 — Default RGB colour space — sRGB** | [webstore.iec.ch/publication/6169](https://webstore.iec.ch/en/publication/6169) | Official sRGB OETF/EOTF, viewing conditions, and colorimetry. Default transfer curve for sRGB, P3, and Rec.2020 gamuts in `transfer.ts` and the transfer panel. |
| **ITU-R BT.709-6 — HDTV parameter values** | [itu.int/rec/R-REC-BT.709](https://www.itu.int/rec/R-REC-BT.709) | Rec.709 / sRGB primaries and D65 white point (`GAMUTS.srgb` in `pipeline.ts`). |
| **ITU-R BT.2020-2 — UHDTV parameter values** | [itu.int/rec/R-REC-BT.2020](https://www.itu.int/rec/R-REC-BT.2020) | Rec.2020 wide-gamut primaries (`GAMUTS.rec2020`). |
| **SMPTE ST 2113:2018 — Colorimetry of P3 color spaces** | [doi.org/10.5594/SMPTE.ST2113.2018](https://doi.org/10.5594/SMPTE.ST2113.2018) | Official P3 primary chromaticities (P3D65, P3DCI, etc.). |
| **ICC Display P3 encoding registry** | [registry.color.org/rgb-registry/displayp3](https://registry.color.org/rgb-registry/displayp3) | Display P3 as used on Apple and web platforms: P3 primaries, D65 white, piecewise sRGB-compatible transfer (`GAMUTS.p3`). |
| **ICC RGB encoding registry (overview)** | [registry.color.org/rgb-registry](https://registry.color.org/rgb-registry/) | Cross-reference for BT.601/709/2020, DCI-P3, Display P3, and related output-referred encodings. |

Legacy museum gamuts in `pipeline.ts` (NTSC 1953, EBU, SMPTE-C, CIE RGB) follow historical primary sets documented in the app's design notes and ported shader registry; they use pure gamma 2.2 or linear encoding rather than the IEC sRGB piecewise curve.

## Web color syntax and design tokens

| Specification | URL | Relevance |
|---------------|-----|-----------|
| **W3C CSS Color Module Level 4** | [w3.org/TR/css-color-4](https://www.w3.org/TR/css-color-4) | Normative `oklab()`, `oklch()`, `lab()`, `lch()`, and wide-gamut syntax. Aligns browser export with the app's Oklab/OKLCH readouts and theme CSS export. |
| **W3C CSS Color Module Level 5** | [w3.org/TR/css-color-5](https://www.w3.org/TR/css-color-5) | Relative color syntax and advanced color manipulation built on Color 4. |
| **DTCG Design Tokens Color Module 2025.10** | [designtokens.org/TR/2025.10/color](https://www.designtokens.org/TR/2025.10/color/) | Vendor-neutral JSON color tokens (`$type: color`) including `oklch`, `srgb`, `display-p3`, and `rec2020`. Basis for DTCG export in the theme ramp. |

## Accessibility

| Standard | URL | Relevance |
|----------|-----|-----------|
| **WCAG 2.2 — Success Criterion 1.4.3 Contrast (Minimum)** | [w3.org/WAI/WCAG22/Understanding/contrast-minimum.html](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) | Relative luminance and contrast-ratio formula used by `fitWcag()` in `theme.ts` (sRGB-encoded channels, 4.5:1 AA target by default). |

## Color-vision deficiency simulation

| Paper | URL | Relevance |
|-------|-----|-----------|
| **Brettel, Viénot & Mollon, *Computerized simulation of color appearance for dichromats*, JOSA A 14(10), 1997** | [doi.org/10.1364/JOSAA.14.002647](https://doi.org/10.1364/JOSAA.14.002647) | LMS-space projection algorithm for protan/deutan/tritan simulation in `cvd.ts` and the display panel. |

## Björn Ottosson

| Post | URL | Relevance |
|------|-----|-----------|
| **A perceptual color space for image processing** (Oklab) | [bottosson.github.io/posts/oklab/](https://bottosson.github.io/posts/oklab/) | Defines Oklab and OKLCh coordinates (matrices `M1`/`M2`, cube-root nonlinearity) used for world-space viewing, theme ramp interpolation, even perceptual spacing, and WCAG auto-adjust heuristics. Already implemented as `OK_M1`/`OK_M2`/`lsrgb2oklab`/`oklab2lsrgb` in `pipeline.ts`. |
| **sRGB gamut clipping** | [bottosson.github.io/posts/gamutclipping/](https://bottosson.github.io/posts/gamutclipping/) | Background for mapping out-of-gamut colors back into displayable sRGB without naive per-channel clamping. Informs the “fit stops inside sRGB” chroma-reduction strategy and out-of-gamut feedback in the theme ramp. Source of `compute_max_saturation` / `find_cusp` / `find_gamut_intersection`, which Okhsv depends on. |
| **Two new color spaces for color picking — Okhsv and Okhsl** | [bottosson.github.io/posts/colorpicker/](https://bottosson.github.io/posts/colorpicker/) | Defines **Okhsv** (the gamut-anchored cylindrical picking space used as a spline interpolation space) and the **`toe` / `toe_inv`** functions that produce the reference lightness **Lr** — the basis for **OKLrCH** (OKLCH with `L` replaced by Lr, which more closely matches CIELab `L*`). Constants: `k₁ = 0.206`, `k₂ = 0.03`, `k₃ = (1+k₁)/(1+k₂)`. |
| **`ok_color.h`** (combined reference implementation) | [bottosson.github.io/misc/ok_color.h](https://bottosson.github.io/misc/ok_color.h) | Authoritative single-file C++ source for all of the above: `toe`/`toe_inv`, `compute_max_saturation`, `find_cusp`, `to_ST`/`get_ST_mid`, `find_gamut_intersection`, and `okhsv_to_srgb`/`srgb_to_okhsv`. Port these verbatim (operating in linear sRGB, i.e. skipping the sRGB transfer function the header applies) when implementing OKHSV and OKLrCH. |

## Non-Riemannian perceptual color geometry

| Paper | URL | Relevance |
|-------|-----|-----------|
| **Bujack, R. et al., *The non-Riemannian nature of perceptual color space*, PNAS 119(18), 2022** | [doi.org/10.1073/pnas.2119753119](https://doi.org/10.1073/pnas.2119753119) · [PMC full text](https://pmc.ncbi.nlm.nih.gov/articles/PMC9170152/) | Shows that human color difference perception exhibits diminishing returns, so perceptual color space cannot be modeled as a Riemannian manifold. Explains why standard ΔE metrics work for small steps but break down for large differences — relevant context for Oklab arc-length spacing and any future large-step interpolation. |
| **Bujack, R. et al., *The Geometry of Color in the Light of a Non-Riemannian Space*, Computer Graphics Forum (EuroVis 2025)** | [doi.org/10.1111/cgf.70136](https://doi.org/10.1111/cgf.70136) | Builds on the non-Riemannian metric to formalize hue, saturation, and lightness from perceptual distance alone (geodesics, neutral axis, Bezold–Brücke effect). Cited in the in-app help for the transfer and color-model panels. |

## Public Display Chromaticities Databases

| Database | URL | Relevance |
|----------|-----|-----------|
| **linuxhw/EDID** | [github.com/linuxhw/EDID](https://github.com/linuxhw/EDID) | Community repository containing raw binary and text EDID dumps for thousands of displays. Source for automated model-based primary chromaticity (CIE 1931 xy) extraction. |
| **DisplayCAL / ArgyllCMS CCSS Registry** | [displaycal.net](https://displaycal.net/) | Registry of community-contributed Colorimeter Calibration Spectral Samples (.ccss). Can be parsed to retrieve the spectral power distribution (SPD) of red/green/blue emitters for various display backlights. |
| **DisplaySpecifications** | [displayspecifications.com](https://www.displayspecifications.com/) | Catalog of consumer monitor technical specifications. Reference for official gamut coverages (sRGB, DCI-P3, Adobe RGB) to estimate primaries when EDID is unavailable. |

