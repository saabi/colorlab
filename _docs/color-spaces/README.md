# Perceptual Color Space Research Notes

Status: research notes for future implementation.

These notes expand `_docs/references.md` and `_docs/color-spaces-evaluation.md` with implementation sketches for perceptually uniform or hue-linear spaces that could be useful in COLOR LAB.

All snippets are TypeScript-oriented drafts. They assume the app's usual color pipeline:

- tristimulus values are CIE XYZ, D65, relative scale with `Y = 1` for diffuse white unless a note says otherwise;
- display RGB conversion should stay outside the perceptual-space modules;
- each module should expose `xyzToSpace(xyz)` and `spaceToXyz(space)` if the inverse is practical;
- world-space rendering needs a fast inverse; spline interpolation only needs reliable forward/inverse CPU functions.

## Candidate Priority

| Priority | Space | Why it is interesting | Implementation risk |
|---|---|---|---|
| 1 | [SRLAB2](srlab2.md) | Simple "better Lab"; easy XYZ-facing transform after deriving matrices from the published sRGB code. | Low |
| 1 | [IPT](ipt.md) | Very simple hue-linear space, good for monochromatic ramps and gamut mapping. | Low |
| 2 | [JzAzBz](jzazbz.md) | HDR/WCG uniform space; relevant for Rec.2020/P3 and future HDR mode. | Medium, absolute luminance policy |
| 2 | [DIN99d](din99d.md) | Improved Lab-like tolerance space; cheap because it wraps CIELAB. | Low |
| 3 | [ICtCp / ITP](ictcp-itp.md) | Standard HDR television opponent space and `Delta E_ITP` metric. | Medium, display-referred BT.2100 assumptions |
| 3 | [IgPgTg](igpgtg.md) | Modern hue-linear space derived from Gaussian spectra. | Low-medium, less widely adopted |
| 4 | [CAM16-UCS](cam16-ucs.md) | Strong scientific appearance model under fixed viewing conditions. | High, full CAM16 dependency |
| 4 | [ProLab](prolab.md) | Projective XYZ space with good uniformity and simple inverse. | Medium, newer and less familiar |
| Research only | [OSA-UCS](osa-ucs.md) | Historically important uniform scale, useful as reference geometry. | High, 10-degree observer and iterative inverse |

## Recommendation

Start with SRLAB2 and IPT. They are cheap, invertible, and add clear value to the spline interpolation registry. JzAzBz should come next only after the app has an explicit absolute luminance convention. CAM16-UCS is best treated as an inspection/metric feature or optional CPU-only interpolation mode, not as the next WebGL world-space mode.

