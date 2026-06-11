# CAM16-UCS

Sources:

- Li et al., "Comprehensive color solutions: CAM16, CAT16, and CAM16-UCS", Color Research & Application, 2017, DOI: https://doi.org/10.1002/col.22131
- Colour Science CAM16-UCS implementation: https://raw.githubusercontent.com/colour-science/colour/develop/colour/models/cam16_ucs.py
- Colour Science CAM02-UCS equations reused by CAM16-UCS: https://raw.githubusercontent.com/colour-science/colour/develop/colour/models/cam02_ucs.py

## Why Add It

CAM16-UCS is the most scientifically complete candidate in this list. It gives a uniform color space from CAM16 appearance correlates under specified viewing conditions.

It is useful for:

- high-accuracy inspection;
- CPU-side comparisons of uniformity;
- optional spline interpolation where users accept a heavier model.

## Core UCS Mapping

CAM16-UCS itself is not just an XYZ matrix. The full path is:

`XYZ + viewing conditions -> CAM16 J, M, h -> J', a', b'`

The compact part is the `JMh -> J'a'b'` mapping:

```ts
type Vec3 = [number, number, number];

const CAM16_UCS = {
  K_L: 1.0,
  c1: 0.007,
  c2: 0.0228,
};

export function cam16JmhToUcs([J, M, hDeg]: Vec3): Vec3 {
  const { c1, c2 } = CAM16_UCS;
  const Jp = ((1 + 100 * c1) * J) / (1 + c1 * J);
  const Mp = Math.log1p(c2 * M) / c2;
  const h = (hDeg * Math.PI) / 180;
  return [Jp, Mp * Math.cos(h), Mp * Math.sin(h)];
}

export function cam16UcsToJmh([Jp, ap, bp]: Vec3): Vec3 {
  const { c1, c2 } = CAM16_UCS;
  const J = -Jp / (c1 * Jp - 1 - 100 * c1);
  const Mp = Math.hypot(ap, bp);
  const M = Math.expm1(c2 * Mp) / c2;
  const h = ((Math.atan2(bp, ap) * 180) / Math.PI + 360) % 360;
  return [J, M, h];
}
```

## Missing Piece

To expose `xyzToCam16Ucs()` and `cam16UcsToXyz()`, the app needs full CAM16 forward/inverse functions:

```ts
export function xyzToCam16Ucs(xyz: Vec3, vc = SRGB_VIEWING_CONDITIONS): Vec3 {
  const { J, M, h } = xyzToCam16(xyz, vc);
  return cam16JmhToUcs([J, M, h]);
}

export function cam16UcsToXyz(jab: Vec3, vc = SRGB_VIEWING_CONDITIONS): Vec3 {
  const [J, M, h] = cam16UcsToJmh(jab);
  return cam16ToXyz({ J, M, h }, vc);
}
```

## Considerations

- Viewing conditions must be explicit. Colour Science defaults to sRGB-like viewing: D65, 64 lux ambient, 80 cd/m2, adapting field luminance around 20% of white.
- Full CAM16 is much heavier than Oklab/IPT/SRLAB2.
- Do this as a CPU-side interpolation/inspection mode first. A WebGL world-space mode is possible but probably not worth the shader complexity.
- The inverse can be fragile near black, high chroma, or out-of-domain inputs. Add robust clamping and tests.

