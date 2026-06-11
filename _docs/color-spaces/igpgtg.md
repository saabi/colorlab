# IgPgTg

Sources:

- Hellwig & Fairchild, "Using Gaussian Spectra to Derive a Hue-linear Color Space", Journal of Perceptual Imaging, 2020, DOI: https://doi.org/10.2352/J.Percept.Imaging.2020.3.2.020401
- Colour Science implementation: https://raw.githubusercontent.com/colour-science/colour/develop/colour/models/igpgtg.py

## Why Add It

IgPgTg is a newer hue-linear opponent space derived from Gaussian spectra. It is interesting as a modern competitor to IPT for hue-stable interpolation.

## Draft Code

```ts
type Vec3 = [number, number, number];

const XYZ_TO_IGPGTG_LMS = [
  [ 2.968, 2.741, -0.649],
  [ 1.237, 5.969, -0.173],
  [-0.318, 0.387,  2.311],
] as const;

const IGPGTG_LMS_TO_XYZ = inverse3(XYZ_TO_IGPGTG_LMS);

const IGPGTG_LMSP_TO_IGPGTG = [
  [ 0.117,  1.464,   0.130],
  [ 8.285, -8.361,  21.400],
  [-1.208,  2.412, -36.530],
] as const;

const IGPGTG_TO_LMSP = inverse3(IGPGTG_LMSP_TO_IGPGTG);
const IGPGTG_SCALE: Vec3 = [18.36, 21.46, 19435];
const IGPGTG_EXP = 0.427;

function spow(x: number, p: number): number {
  return Math.sign(x) * Math.abs(x) ** p;
}

export function xyzToIgPgTg(xyz: Vec3): Vec3 {
  const lms = mulM3(XYZ_TO_IGPGTG_LMS, xyz);
  const lmsp = lms.map((v, i) => spow(v / IGPGTG_SCALE[i], IGPGTG_EXP)) as Vec3;
  return mulM3(IGPGTG_LMSP_TO_IGPGTG, lmsp);
}

export function igPgTgToXyz(igpgtg: Vec3): Vec3 {
  const lmsp = mulM3(IGPGTG_TO_LMSP, igpgtg);
  const lms = lmsp.map((v, i) => spow(v, 1 / IGPGTG_EXP) * IGPGTG_SCALE[i]) as Vec3;
  return mulM3(IGPGTG_LMS_TO_XYZ, lms);
}
```

## Considerations

- Like IPT, input XYZ should be D65 adapted.
- The constants produce less intuitive axis ranges; UI scaling needs empirical tuning.
- Good candidate for a hidden experimental spline interpolation mode.
- Less broadly adopted than IPT or Oklab, so documentation burden is higher.

