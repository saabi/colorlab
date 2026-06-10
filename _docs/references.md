# External references

Curated reading that informs COLOR LAB's color math, gamut handling, and theme workflows.

## Björn Ottosson

| Post | URL | Relevance |
|------|-----|-----------|
| **A perceptual color space for image processing** (Oklab) | [bottosson.github.io/posts/oklab/](https://bottosson.github.io/posts/oklab/) | Defines Oklab and OKLab/OKLCh coordinates used for world-space viewing, theme ramp interpolation, even perceptual spacing, and WCAG auto-adjust heuristics. |
| **sRGB gamut clipping** | [bottosson.github.io/posts/gamutclipping/](https://bottosson.github.io/posts/gamutclipping/) | Background for mapping out-of-gamut colors back into displayable sRGB without naive per-channel clamping. Informs the “fit stops inside sRGB” chroma-reduction strategy and out-of-gamut feedback in the theme ramp. |
| **Two new color spaces for color picking — Okhsv and Okhsl** | [bottosson.github.io/posts/colorpicker/](https://bottosson.github.io/posts/colorpicker/) | Related perceptual alternatives to HSL/HSV for interactive color picking. Useful context for future picker UX and for understanding why Oklab-based cylindrical coordinates behave more predictably than legacy HSL. |

## Non-Riemannian perceptual color geometry

| Paper | URL | Relevance |
|-------|-----|-----------|
| **Bujack, R. et al., *The non-Riemannian nature of perceptual color space*, PNAS 119(18), 2022** | [doi.org/10.1073/pnas.2119753119](https://doi.org/10.1073/pnas.2119753119) · [PMC full text](https://pmc.ncbi.nlm.nih.gov/articles/PMC9170152/) | Shows that human color difference perception exhibits diminishing returns, so perceptual color space cannot be modeled as a Riemannian manifold. Explains why standard ΔE metrics work for small steps but break down for large differences — relevant context for Oklab arc-length spacing and any future large-step interpolation. |
| **Bujack, R. et al., *The Geometry of Color in the Light of a Non-Riemannian Space*, Computer Graphics Forum (EuroVis 2025)** | [doi.org/10.1111/cgf.70136](https://doi.org/10.1111/cgf.70136) | Builds on the non-Riemannian metric to formalize hue, saturation, and lightness from perceptual distance alone (geodesics, neutral axis, Bezold–Brücke effect). Cited in the in-app help for the transfer and color-model panels. |
