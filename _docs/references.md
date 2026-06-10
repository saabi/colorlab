# External references

Curated reading that informs COLOR LAB's color math, gamut handling, and theme workflows.

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
