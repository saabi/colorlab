# IPT

Sources:

- Ebner & Fairchild, "Development and Testing of a Color Space (IPT) with Improved Hue Uniformity", 1998.
- Colour Science reference implementation: https://raw.githubusercontent.com/colour-science/colour/develop/colour/models/ipt.py

## Why Add It

IPT is one of the cleanest additions for COLOR LAB. It is designed for hue uniformity and has a very small transform:

`XYZ(D65) -> LMS -> signed power 0.43 -> IPT`

It is especially useful for:

- monochromatic ramps that should keep perceived hue stable from saturated color toward neutral;
- spline interpolation choices;
- inspecting hue-linearity failures in Lab/Luv/Oklab.

## Draft Code

```ts
type Vec3 = [number, number, number];
type Mat3 = readonly (readonly [number, number, number])[];

const XYZ_TO_IPT_LMS = [
  [ 0.4002, 0.7075, -0.0807],
  [-0.2280, 1.1500,  0.0612],
  [ 0.0000, 0.0000,  0.9184],
] as const;

const IPT_LMS_TO_XYZ = inverse3(XYZ_TO_IPT_LMS);

const IPT_LMSP_TO_IPT = [
  [0.4000,  0.4000,  0.2000],
  [4.4550, -4.8510,  0.3960],
  [0.8056,  0.3572, -1.1628],
] as const;

const IPT_TO_LMSP = inverse3(IPT_LMSP_TO_IPT);

function spow(x: number, p: number): number {
  return Math.sign(x) * Math.abs(x) ** p;
}

export function xyzToIpt(xyz: Vec3): Vec3 {
  const lms = mulM3(XYZ_TO_IPT_LMS, xyz);
  const lmsp = lms.map((v) => spow(v, 0.43)) as Vec3;
  return mulM3(IPT_LMSP_TO_IPT, lmsp);
}

export function iptToXyz(ipt: Vec3): Vec3 {
  const lmsp = mulM3(IPT_TO_LMSP, ipt);
  const lms = lmsp.map((v) => spow(v, 1 / 0.43)) as Vec3;
  return mulM3(IPT_LMS_TO_XYZ, lms);
}
```

## Considerations

- Input XYZ must be D65 adapted.
- IPT is simple enough for CPU and shader code.
- It is hue-linear, not necessarily the best lightness or color-difference metric.
- For user naming, label it "IPT (hue-linear)" rather than implying full modern perceptual uniformity.
- Implementation priority: high for spline interpolation; medium for world-space mode.

