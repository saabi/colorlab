# DIN99 / DIN99d

Sources:

- Cui et al., "Uniform colour spaces based on the DIN99 colour-difference formula", Color Research & Application, 2002, DOI: https://doi.org/10.1002/col.10066
- Colour Science implementation: https://raw.githubusercontent.com/colour-science/colour/develop/colour/models/din99.py

## Why Add It

DIN99 and its refinements are cheap Lab-derived spaces. They are useful if the app wants another industrial color-difference baseline that improves over raw CIELAB without adding a full appearance model.

DIN99d is probably the best variant to test first.

## Draft Code

DIN99 wraps CIELAB. Keep the existing app `xyzToLab()` and `labToXyz()` functions, then apply the transform below.

```ts
type Vec3 = [number, number, number];

const DIN99D = {
  c1: 325.22,
  c2: 0.0036,
  c3Deg: 50.0,
  c4: 1.14,
  c5: 22.5,
  c6: 0.06,
  c7Deg: 50.0,
  c8: 1.0,
};

export function labToDin99d([L, a, b]: Vec3): Vec3 {
  const c3 = (DIN99D.c3Deg * Math.PI) / 180;
  const c7 = (DIN99D.c7Deg * Math.PI) / 180;
  const e = Math.cos(c3) * a + Math.sin(c3) * b;
  const f = DIN99D.c4 * (-Math.sin(c3) * a + Math.cos(c3) * b);
  const G = Math.hypot(e, f);
  const h = Math.atan2(f, e) + c7;
  const C99 = DIN99D.c5 * Math.log1p(DIN99D.c6 * G) / DIN99D.c8;
  const L99 = DIN99D.c1 * Math.log1p(DIN99D.c2 * L);
  return [L99, C99 * Math.cos(h), C99 * Math.sin(h)];
}

export function din99dToLab([L99, a99, b99]: Vec3): Vec3 {
  const c3 = (DIN99D.c3Deg * Math.PI) / 180;
  const c7 = (DIN99D.c7Deg * Math.PI) / 180;
  const h99 = Math.atan2(b99, a99) - c7;
  const C99 = Math.hypot(a99, b99);
  const G = Math.expm1((DIN99D.c8 / DIN99D.c5) * C99) / DIN99D.c6;
  const e = G * Math.cos(h99);
  const f = G * Math.sin(h99);
  const a = e * Math.cos(c3) - (f / DIN99D.c4) * Math.sin(c3);
  const b = e * Math.sin(c3) + (f / DIN99D.c4) * Math.cos(c3);
  const L = Math.expm1(L99 / DIN99D.c1) / DIN99D.c2;
  return [L, a, b];
}

export function xyzToDin99d(xyz: Vec3): Vec3 {
  return labToDin99d(xyzToLabD65(xyz));
}

export function din99dToXyz(din: Vec3): Vec3 {
  return labD65ToXyz(din99dToLab(din));
}
```

## Considerations

- Cheap and invertible because the expensive part is already implemented CIELAB.
- More relevant for color-difference/tolerance views than for designer-facing ramps.
- Axis names should be `L99, a99, b99`, not `L*, a*, b*`.
- Test all variants later (`DIN99`, `DIN99b`, `DIN99c`, `DIN99d`) but expose only one to avoid UI clutter.

