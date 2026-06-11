# ICtCp / ITP

Sources:

- ITU-R BT.2100, "Image parameter values for high dynamic range television for use in production and international programme exchange": https://www.itu.int/rec/R-REC-BT.2100
- ITU-R BT.2124, `Delta E_ITP` HDR/WCG color-difference metric: https://www.itu.int/rec/R-REC-BT.2124
- ICtCp overview and relation to IPT: https://en.wikipedia.org/wiki/ICtCp

## Why Add It

ICtCp is not a general scene-independent perceptual Lab replacement. It is a standardized HDR/WCG television signal representation. The related ITP space is useful because BT.2124 defines a simple Euclidean color-difference metric from it.

This is interesting for COLOR LAB if the app adds:

- HDR display-referred inspection;
- Rec.2020/PQ workflows;
- a `Delta E_ITP` metric panel.

## Draft Code

This is display-referred BT.2100/PQ code. It expects linear BT.2020 RGB in absolute display luminance units or normalized with an explicit peak.

```ts
type Vec3 = [number, number, number];

const BT2020_RGB_TO_LMS = [
  [1688 / 4096, 2146 / 4096,  262 / 4096],
  [ 683 / 4096, 2951 / 4096,  462 / 4096],
  [  99 / 4096,  309 / 4096, 3688 / 4096],
] as const;

const LMS_TO_BT2020_RGB = inverse3(BT2020_RGB_TO_LMS);

const LMSP_TO_ICTCP = [
  [ 2048 / 4096,   2048 / 4096,     0 / 4096],
  [ 6610 / 4096, -13613 / 4096,  7003 / 4096],
  [17933 / 4096, -17390 / 4096,  -543 / 4096],
] as const;

const ICTCP_TO_LMSP = inverse3(LMSP_TO_ICTCP);

function pqEncode(luminanceCdM2: number): number {
  // Use the standard ST 2084 constants, not JzAzBz's modified m2.
  const m1 = 2610 / 16384;
  const m2 = 2523 / 32;
  const c1 = 3424 / 4096;
  const c2 = 2413 / 128;
  const c3 = 2392 / 128;
  const y = Math.max(0, luminanceCdM2 / 10000);
  const yp = y ** m1;
  return ((c1 + c2 * yp) / (1 + c3 * yp)) ** m2;
}

function pqDecode(code: number): number {
  const m1 = 2610 / 16384;
  const m2 = 2523 / 32;
  const c1 = 3424 / 4096;
  const c2 = 2413 / 128;
  const c3 = 2392 / 128;
  const p = Math.max(0, code) ** (1 / m2);
  return 10000 * (Math.max(0, p - c1) / (c2 - c3 * p)) ** (1 / m1);
}

export function bt2020RgbToIctcp(rgbLinear: Vec3, peakCdM2 = 1000): Vec3 {
  const lms = mulM3(BT2020_RGB_TO_LMS, rgbLinear.map((v) => v * peakCdM2) as Vec3);
  const lmsp = lms.map(pqEncode) as Vec3;
  return mulM3(LMSP_TO_ICTCP, lmsp);
}

export function ictcpToBt2020Rgb(ictcp: Vec3, peakCdM2 = 1000): Vec3 {
  const lmsp = mulM3(ICTCP_TO_LMSP, ictcp);
  const lms = lmsp.map(pqDecode) as Vec3;
  return mulM3(LMS_TO_BT2020_RGB, lms).map((v) => v / peakCdM2) as Vec3;
}

export function ictcpToItp([i, ct, cp]: Vec3): Vec3 {
  return [i, 0.5 * ct, cp];
}

export function deltaEItp(itpA: Vec3, itpB: Vec3): number {
  return 720 * Math.hypot(itpA[0] - itpB[0], itpA[1] - itpB[1], itpA[2] - itpB[2]);
}
```

## Considerations

- This should not be named simply "perceptual Lab"; it is display-referred video colorimetry.
- Needs explicit BT.2020 RGB conversion from app XYZ. Do not use active arbitrary gamut primaries directly unless documenting the change.
- Best first use is a metric panel or HDR comparison, not spline interpolation.
- `Delta E_ITP = 1` is intended as a just-noticeable-difference-style threshold in BT.2124 contexts.

