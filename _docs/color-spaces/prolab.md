# ProLab

Sources:

- Konovalenko et al., "ProLab: perceptually uniform projective colour coordinate system", arXiv: https://arxiv.org/abs/2012.07653
- Colour Science implementation: https://raw.githubusercontent.com/colour-science/colour/develop/colour/models/prolab.py

## Why Add It

ProLab is a projective transform of XYZ that was designed to improve perceptual uniformity while preserving some linear/projective geometry advantages. It is mathematically compact and exactly invertible.

This is interesting for COLOR LAB as an experimental mode because it may give useful geometry for gamut/spline analysis without a heavy appearance model.

## Draft Code

```ts
type Vec3 = [number, number, number];
type Vec4 = [number, number, number, number];

const PROLAB_Q = [
  [ 75.54,  486.66,  167.39, 0.0],
  [617.72, -595.45,  -22.27, 0.0],
  [ 48.34,  194.94, -243.28, 0.0],
  [  0.7554,  3.8666,  1.6739, 1.0],
] as const;

const PROLAB_Q_INV = inverse4(PROLAB_Q);

function mulProjective(q: readonly (readonly number[])[], xyz: Vec3): Vec3 {
  const v: Vec4 = [xyz[0], xyz[1], xyz[2], 1];
  const r = q.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2] + row[3] * v[3]) as Vec4;
  return [r[0] / r[3], r[1] / r[3], r[2] / r[3]];
}

export function xyzToProLab(xyz: Vec3): Vec3 {
  return mulProjective(PROLAB_Q, xyz);
}

export function proLabToXyz(prolab: Vec3): Vec3 {
  return mulProjective(PROLAB_Q_INV, prolab);
}
```

## Considerations

- The inverse is easy, but the projective denominator can approach zero for invalid inputs. Guard against that.
- Less familiar to color-design users than Oklab/IPT/JzAzBz.
- Could be a hidden experimental interpolation space before exposing it in the primary UI.
- Validate against paper examples or Colour Science before implementation; the DOI metadata in the current Colour Science header appears inconsistent with the arXiv citation, so rely on the paper/code pair rather than the DOI string alone.

