# OSA-UCS

Sources:

- Moroney, "A Radial Sampling of the OSA Uniform Color Scales", Color and Imaging Conference, 2003.
- Cao, Trussell & Shamey, "Comparison of the performance of inverse transformation methods from OSA-UCS to CIEXYZ", JOSA A, 2013, DOI: https://doi.org/10.1364/JOSAA.30.001508
- Colour Science implementation: https://raw.githubusercontent.com/colour-science/colour/develop/colour/models/osa_ucs.py

## Why Add It

OSA-UCS is historically important and visually interesting. It uses `L, j, g` axes with yellow-blue and red-green opponent dimensions.

It is probably not a near-term implementation target, but it is useful as a reference model for what a non-CIELAB uniform scale looks like.

## Forward Draft

```ts
type Vec3 = [number, number, number];

const XYZ_TO_OSA_RGB = [
  [ 0.7990, 0.4194, -0.1648],
  [-0.4493, 1.3265,  0.0927],
  [-0.1149, 0.3394,  0.7170],
] as const;

function spow(x: number, p: number): number {
  return Math.sign(x) * Math.abs(x) ** p;
}

export function xyzToOsaUcs(xyzY1: Vec3): Vec3 {
  // OSA-UCS is conventionally given with XYZ on Y=100 and the 1964 10-degree observer.
  const [X, Y, Z] = xyzY1.map((v) => v * 100) as Vec3;
  const sum = X + Y + Z || 1;
  const x = X / sum;
  const y = Y / sum;
  const Y0 = Y * (
    4.4934 * x * x + 4.3034 * y * y - 4.276 * x * y -
    1.3744 * x - 2.5643 * y + 1.8103
  );
  const Y0c = spow(Y0, 1 / 3);
  const lambda = 5.9 * (Y0c - 2 / 3 + 0.042 * spow(Y0 - 30, 1 / 3));
  const rgb = mulM3(XYZ_TO_OSA_RGB, [X, Y, Z]).map((v) => spow(v, 1 / 3)) as Vec3;
  const C = lambda / (5.9 * (Y0c - 2 / 3));
  const L = (lambda - 14.4) / Math.SQRT2;
  const j = C * (1.7 * rgb[0] + 8.0 * rgb[1] - 9.7 * rgb[2]);
  const g = C * (-13.7 * rgb[0] + 17.7 * rgb[1] - 4.0 * rgb[2]);
  return [L, j, g];
}
```

## Inverse

The inverse is not a simple matrix/nonlinearity reversal. The Colour Science implementation uses an improved method with Cardano's formula for a cubic subproblem plus Newton iteration for the remaining nonlinear system.

For COLOR LAB, do not implement OSA-UCS as a world-space mode until the inverse is ported and tested thoroughly.

## Considerations

- OSA-UCS uses the CIE 1964 10-degree observer, while the app mostly uses CIE 1931 2-degree data.
- Inverse cost and observer mismatch make it lower priority.
- Useful as a documentation/reference comparison, not as a first user-facing feature.

