# SRLAB2

Source: Jan Behrens / Magnetkern, "SRLAB2 - an alternative to CIE-L*a*b*" with permissive C snippets for sRGB <-> SRLAB2.

Reference links:

- https://www.magnetkern.de/srlab2.html
- Existing reference entry: `_docs/references.md`, "Alternative to CIELAB".

## Why Add It

SRLAB2 is a compact Lab-like opponent space intended to improve CIELAB lightness/chroma/hue behavior while avoiding the full complexity of CIECAM02. It is a good candidate for:

- a "better Lab" spline interpolation option;
- a 3D world-space mode if the inverse behaves well over all displayed gamuts;
- side-by-side comparison against CIELAB and Oklab.

The published code is sRGB-facing. COLOR LAB should use XYZ-facing transforms so the space works with every active gamut.

## XYZ-Facing Transform

The published forward code does:

1. encoded sRGB -> linear sRGB;
2. linear sRGB -> SRLAB2 response channels with matrix `A`;
3. CIELAB-like piecewise cube-root response compression;
4. compressed responses -> SRLAB2 `L, a, b`.

For COLOR LAB, replace step 1 and the sRGB matrix with:

```ts
// Derived as A * inverse(sRGB_D65_to_XYZ_D65).
// XYZ is D65 relative, Y=1 for white.
const XYZ_TO_SRLAB2_RESPONSE = [
  [ 0.423865054851,  0.693382531783, -0.088367752187],
  [-0.203842676636,  1.153789628679,  0.036685705132],
  [-0.000855663135, -0.000942116158,  0.919836790617],
] as const;

const SRLAB2_RESPONSE_TO_XYZ = [
  [1.830684192333, -1.099990314989, 0.219742642875],
  [0.323366523558,  0.672381935970, 0.004248979189],
  [0.002034162822, -0.000334580307, 1.087358147568],
] as const;

const SRLAB2_RESPONSE_TO_LAB = [
  [ 37.0950,   62.9054,   -0.0008],
  [663.4684, -750.5078,   87.0328],
  [ 63.9569,  108.4576, -172.4152],
] as const;

const SRLAB2_LAB_TO_RESPONSE = [
  [0.01,  0.000904127,  0.000456344],
  [0.01, -0.000533159, -0.000269178],
  [0.01,  0.000000000, -0.005800000],
] as const;
```

## Draft Code

```ts
type Vec3 = [number, number, number];
type Mat3 = readonly (readonly [number, number, number])[];

function mulM3(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

function srlab2ForwardResponse(t: number): number {
  return t <= 216 / 24389 ? t * (24389 / 2700) : 1.16 * Math.cbrt(t) - 0.16;
}

function srlab2InverseResponse(t: number): number {
  return t <= 0.08 ? t * (2700 / 24389) : ((t + 0.16) / 1.16) ** 3;
}

export function xyzToSrlab2(xyz: Vec3): Vec3 {
  const response = mulM3(XYZ_TO_SRLAB2_RESPONSE, xyz).map(srlab2ForwardResponse) as Vec3;
  return mulM3(SRLAB2_RESPONSE_TO_LAB, response);
}

export function srlab2ToXyz(lab: Vec3): Vec3 {
  const response = mulM3(SRLAB2_LAB_TO_RESPONSE, lab).map(srlab2InverseResponse) as Vec3;
  return mulM3(SRLAB2_RESPONSE_TO_XYZ, response);
}
```

## Considerations

- The derived XYZ matrices use standard D65 sRGB primaries. This matches the app's D65-centric pipeline.
- The published page says the code maps sRGB black to `L* = 0` and ignores sRGB encoding flare. That is appropriate for this app.
- The threshold constants differ slightly from IEC sRGB's `0.04045` transfer threshold in the published code. That only affects the sRGB wrapper; the XYZ-facing module bypasses sRGB transfer entirely.
- Add round-trip tests from `XYZ -> SRLAB2 -> XYZ` and compare the published sRGB example path separately.
- If used as a WebGL world mode, verify response channels remain real for out-of-gamut/generated vertices; use signed cube root behavior if needed.

