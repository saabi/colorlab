# JzAzBz

Sources:

- Safdar et al., "Perceptually uniform color space for image signals including high dynamic range and wide gamut", Optics Express, 2017, DOI: https://doi.org/10.1364/OE.25.015131
- Colour Science reference implementation: https://raw.githubusercontent.com/colour-science/colour/develop/colour/models/jzazbz.py

## Why Add It

JzAzBz targets HDR and wide-gamut image signals. It is relevant for COLOR LAB because the app already displays P3 and Rec.2020 shells, and future HDR work needs a space whose lightness nonlinearity is not SDR-only.

## Draft Code

This code is intentionally explicit about absolute luminance. The ST 2084 / PQ step is absolute; do not silently treat relative `Y=1` XYZ as if it were `10000 cd/m^2`.

```ts
type Vec3 = [number, number, number];

const JZ_B = 1.15;
const JZ_G = 0.66;
const JZ_D = -0.56;
const JZ_D0 = 1.6295499532821566e-11;

const PQ_M1 = 2610 / 16384;
const PQ_M2_JZ = 1.7 * 2523 / 32;
const PQ_C1 = 3424 / 4096;
const PQ_C2 = 2413 / 128;
const PQ_C3 = 2392 / 128;

const XYZP_TO_JZ_LMS = [
  [ 0.41478972, 0.57999900, 0.01464800],
  [-0.20151000, 1.12064900, 0.05310080],
  [-0.01660080, 0.26480000, 0.66847990],
] as const;

const JZ_LMSP_TO_IZAZBZ = [
  [0.500000,  0.500000,  0.000000],
  [3.524000, -4.066708,  0.542708],
  [0.199076,  1.096799, -1.295875],
] as const;

const IZAZBZ_TO_JZ_LMSP = inverse3(JZ_LMSP_TO_IZAZBZ);
const JZ_LMS_TO_XYZP = inverse3(XYZP_TO_JZ_LMS);

function pqEncodeAbsolute(luminanceCdM2: number): number {
  const y = Math.max(0, luminanceCdM2 / 10000);
  const yp = y ** PQ_M1;
  return ((PQ_C1 + PQ_C2 * yp) / (1 + PQ_C3 * yp)) ** PQ_M2_JZ;
}

function pqDecodeAbsolute(code: number): number {
  const p = Math.max(0, code) ** (1 / PQ_M2_JZ);
  return 10000 * (Math.max(0, p - PQ_C1) / (PQ_C2 - PQ_C3 * p)) ** (1 / PQ_M1);
}

export function xyzToJzazbz(xyz: Vec3, diffuseWhiteCdM2 = 203): Vec3 {
  const abs: Vec3 = xyz.map((v) => v * diffuseWhiteCdM2) as Vec3;
  const xp = JZ_B * abs[0] - (JZ_B - 1) * abs[2];
  const yp = JZ_G * abs[1] - (JZ_G - 1) * abs[0];
  const lms = mulM3(XYZP_TO_JZ_LMS, [xp, yp, abs[2]]);
  const lmsp = lms.map(pqEncodeAbsolute) as Vec3;
  const [iz, az, bz] = mulM3(JZ_LMSP_TO_IZAZBZ, lmsp);
  const jz = ((1 + JZ_D) * iz) / (1 + JZ_D * iz) - JZ_D0;
  return [jz, az, bz];
}

export function jzazbzToXyz(jab: Vec3, diffuseWhiteCdM2 = 203): Vec3 {
  const [jz, az, bz] = jab;
  const iz = (jz + JZ_D0) / (1 + JZ_D - JZ_D * (jz + JZ_D0));
  const lmsp = mulM3(IZAZBZ_TO_JZ_LMSP, [iz, az, bz]);
  const lms = lmsp.map(pqDecodeAbsolute) as Vec3;
  const [xp, yp, z] = mulM3(JZ_LMS_TO_XYZP, lms);
  const x = (xp + (JZ_B - 1) * z) / JZ_B;
  const y = (yp + (JZ_G - 1) * x) / JZ_G;
  return [x / diffuseWhiteCdM2, y / diffuseWhiteCdM2, z / diffuseWhiteCdM2];
}
```

## Considerations

- The key product decision is `diffuseWhiteCdM2`. For SDR web UI, `203 cd/m^2` is a common HDR reference white convention, but the app should expose or document it.
- For normal SDR ramps, Oklab may still be more predictable and simpler.
- For Rec.2020 and HDR comparisons, JzAzBz is more relevant than CIELAB/Oklab.
- Add tests for both `XYZ -> JzAzBz -> XYZ` and sensitivity to different white luminance values.
- If this becomes a 3D world mode, axis ranges will be very different from Lab/Oklab and need UI scaling.

