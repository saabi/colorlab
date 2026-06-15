# Plan for Drawing Spline Curves on Gamut Surfaces for Theme Ramps

Status: Proposal and Implementation Plan

Storage note: this older implementation plan shows `ThemeAnchor { srgbLin }`
because that matched the state shape at the time. Roadmap direction now requires
source colors to be stored in gamut-independent `XYZ D65` (or equivalent), with
active-gamut RGB, display RGB, and world coordinates derived at runtime. See
[`color-space-role-architecture.md`](color-space-role-architecture.md).

---

## 1. Overview and Goals

The theme designer currently supports three ramp modes ([`fe/src/lib/engine/theme.ts`](fe/src/lib/engine/theme.ts) `buildRamp`):
- **Segment** (`seg`): straight-line Cartesian interpolation between two anchors ($A$, $B$) in world space.
- **Hue arc** (`arc`): cylindrical interpolation between $A$ and $B$ sweeping around the neutral axis.
- **Spread A** (`spread`): builds a ramp from anchor $A$ using delta hue ($\Delta h$) and delta chroma ($\Delta c$).

These are limited to simple geometric paths (lines and arcs) and to exactly two anchors. Designers building sophisticated, highly vibrant, or multi-hue ramps often need to trace paths along the **gamut boundary** (where chroma is maximized) through an arbitrary number of waypoints.

Drawing **spline curves on the surface of the 3D solid** offers:
1. **Navigating the gamut boundary** — tracing the outer shell to capture maximum saturation without dipping into low-chroma interior regions.
2. **Arbitrary trajectories** — e.g. a "fire" ramp from deep purple on the dark boundary up through red and orange to bright yellow on the light boundary.
3. **Smooth perceptual transitions** — interpolating curves that pass exactly through each waypoint without sharp corners.

### Goals
- Introduce a **Spline** theme mode supporting an arbitrary number of control points.
- Let the user **choose the color space the curve is interpolated in** — the OK\* family (Oklab, OKLCH, **OKLrCH**, **OKHSV**) plus CIELAB, CIELCh, CIELUV, CIELCh(uv), and linear sRGB — via an extensible registry. OK\* definitions follow Björn Ottosson's reference implementation; see [`_docs/references.md`](_docs/references.md).
- Support **interactive control point placement and dragging** locked to the 3D gamut surface (or slice plane / cylinder cap).
- Render the spline in the 3D viewport as a **gradient curve** showing the actual ramp trajectory.
- Offer **Surface lock** (project intermediate points onto the active boundary) alongside **Free** (interpolate inside the volume).
- Retain full compatibility with auto-adjust heuristics (`fitGamut`, `fitWcag`, `fitEven`) and token export (CSS, DTCG).

### Design constraints discovered from the codebase
These shaped the plan and must be respected:
- **Persistence is whitelisted, not structural.** `PersistedTheme = Omit<ExplorerState['theme'], 'arm' | 'stops'>` ([`types.ts`](fe/src/lib/engine/types.ts)), but `toPersistedExplorer` ([`snapshot.ts`](fe/src/lib/documents/snapshot.ts)) and `coerceTheme` ([`schema.ts`](fe/src/lib/documents/schema.ts)) are **manual whitelists**. Any new persisted field must be added to *both*, plus the `THEME_MODES` enum and a `parse.test.ts` fixture. See §7 and `.cursor/rules/document-persistence.mdc`.
- **No mat4 helpers exist.** [`math.ts`](fe/src/lib/color/math.ts) has only `m3` (3×3). Projecting world→screen needs a new helper in `camera.ts` (where `persp`/`lookAt`/`camEye` already live).
- **CVD is applied per-frame from draw input**, not stored on the renderer (`webgl-renderer.ts` reads `input.state.cvd` each draw). Spline colors must be recolored per-frame the same way, not baked once.
- **`jsToWorld` has five space-specific mappings** (modes 0/1/2/3/5). Arc length and Oklab conversions must not assume the Oklab mapping.
- **WebGL2 `lineWidth` is clamped to 1px** on virtually all drivers — a "thick" line needs real geometry.

---

## 2. Architecture & Data Model

### Phase 1: State, types, and the interpolation-space registry

#### 1. Interpolation-space registry — new file [`fe/src/lib/color/interp.ts`](fe/src/lib/color/interp.ts)

The space a curve is *interpolated* in is independent of `spaceMode` (which only controls the 3D viewport geometry). We model it as a small registry so adding spaces is a one-line change.

```typescript
import { m3, type Vec3 } from './math';
import { GAMUTS, lsrgb2oklab, oklab2lsrgb, rgbToXyzM, xyz2lab, lab2xyz, xyz2luv, luv2xyz } from './pipeline';
import { toe, toeInv, lsrgbToOkhsv, okhsvToLsrgb } from './okhsv'; // ported from ok_color.h (see §2.1.b)

export type InterpSpaceKey =
	| 'oklab' | 'oklch' | 'oklrch' | 'okhsv'
	| 'cielab' | 'cielch'
	| 'cieluv' | 'cielchuv'
	| 'srgb-linear';

export interface InterpSpace {
	label: string;
	/** linear sRGB -> interpolation coordinates */
	fromSrgbLin(srgbLin: Vec3): Vec3;
	/** interpolation coordinates -> linear sRGB */
	toSrgbLin(coords: Vec3): Vec3;
	/** index of a coordinate that is a hue angle in degrees (interpolated cyclically), else null */
	cyclic: 0 | 1 | 2 | null;
}

const srgb2xyz = rgbToXyzM(GAMUTS.srgb.P, GAMUTS.srgb.W);
const xyz2srgb = m3.inv(srgb2xyz);

// cartesian (a,b) -> cylindrical (C, h°) and back
const toLCh = (l: number, a: number, b: number): Vec3 => [l, Math.hypot(a, b), ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360];
const fromLCh = (l: number, c: number, h: number): Vec3 => [l, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180)];

export const INTERP_SPACES: Record<InterpSpaceKey, InterpSpace> = {
	oklab: {
		label: 'Oklab',
		fromSrgbLin: (s) => lsrgb2oklab(s),
		toSrgbLin: (c) => oklab2lsrgb(c),
		cyclic: null
	},
	oklch: {
		label: 'OKLCH',
		fromSrgbLin: (s) => { const o = lsrgb2oklab(s); return toLCh(o[0], o[1], o[2]); },
		toSrgbLin: (c) => oklab2lsrgb(fromLCh(c[0], c[1], c[2])),
		cyclic: 2
	},
	oklrch: {
		// OKLCH with L replaced by the toe-corrected reference lightness Lr (matches CIELab L* far better).
		label: 'OKLrCH',
		fromSrgbLin: (s) => { const o = lsrgb2oklab(s); const lch = toLCh(o[0], o[1], o[2]); return [toe(lch[0]), lch[1], lch[2]]; },
		toSrgbLin: (c) => oklab2lsrgb(fromLCh(toeInv(c[0]), c[1], c[2])),
		cyclic: 2
	},
	okhsv: {
		// Ottosson's gamut-anchored picking space. Hue is exposed in degrees so the shared
		// cyclic-unwrap logic works uniformly; okhsv.ts uses turns (0..1) internally.
		label: 'OKHSV',
		fromSrgbLin: (s) => { const hsv = lsrgbToOkhsv(s); return [hsv[0] * 360, hsv[1], hsv[2]]; },
		toSrgbLin: (c) => okhsvToLsrgb(((c[0] % 360) + 360) % 360 / 360, c[1], c[2]),
		cyclic: 0
	},
	cielab: {
		label: 'CIELAB',
		fromSrgbLin: (s) => xyz2lab(m3.mulV(srgb2xyz, s)),
		toSrgbLin: (c) => m3.mulV(xyz2srgb, lab2xyz(c)),
		cyclic: null
	},
	cielch: {
		label: 'CIELCh',
		fromSrgbLin: (s) => { const l = xyz2lab(m3.mulV(srgb2xyz, s)); return toLCh(l[0], l[1], l[2]); },
		toSrgbLin: (c) => m3.mulV(xyz2srgb, lab2xyz(fromLCh(c[0], c[1], c[2]))),
		cyclic: 2
	},
	cieluv: {
		label: 'CIELUV',
		fromSrgbLin: (s) => xyz2luv(m3.mulV(srgb2xyz, s)),
		toSrgbLin: (c) => m3.mulV(xyz2srgb, luv2xyz(c)),
		cyclic: null
	},
	cielchuv: {
		label: 'CIELCh(uv)',
		fromSrgbLin: (s) => { const l = xyz2luv(m3.mulV(srgb2xyz, s)); return toLCh(l[0], l[1], l[2]); },
		toSrgbLin: (c) => m3.mulV(xyz2srgb, luv2xyz(fromLCh(c[0], c[1], c[2]))),
		cyclic: 2
	},
	'srgb-linear': {
		label: 'Linear sRGB',
		fromSrgbLin: (s) => s,
		toSrgbLin: (c) => c,
		cyclic: null
	}
};

export const INTERP_SPACE_KEYS = Object.keys(INTERP_SPACES) as InterpSpaceKey[];
```

**Notes on the OK\* entries:**
- **OKLCH / OKLrCH** reuse the existing `lsrgb2oklab` / `oklab2lsrgb` (`pipeline.ts`, already validated by `selftest.ts`). OKLrCH only adds the `toe`/`toe_inv` lightness remap. The reference white and matrices are unchanged.
- **OKHSV is gamut-anchored to sRGB.** Its conversion finds the sRGB gamut cusp for each hue, so it is meaningful only against the sRGB boundary — appropriate here because theme anchors are stored as linear sRGB. Hue is undefined for achromatic colors; the registry/`okhsv.ts` must guard `C → 0` (fall back to a stable hue, e.g. 0) so dragging a control point onto the neutral axis does not produce `NaN`.

CIELUV (the `cieluv` / `cielchuv` entries) requires two new functions in [`pipeline.ts`](fe/src/lib/color/pipeline.ts) (`xyz2luv` / `luv2xyz`, standard D65-referenced formulas using `GAMUTS.srgb.W` as the reference white). Add round-trip checks to [`selftest.ts`](fe/src/lib/color/selftest.ts) for CIELUV **and** for the OK\* round-trips (`srgbLin → space → srgbLin`) alongside the existing Lab/Oklab checks.

#### 2.1.b OKHSV / Lr helpers — new file [`fe/src/lib/color/okhsv.ts`](fe/src/lib/color/okhsv.ts)

Ported verbatim from [`ok_color.h`](https://bottosson.github.io/misc/ok_color.h), operating in **linear sRGB** (we skip the `srgb_transfer_function` the header applies, since the rest of the app works in linear sRGB). Reuses the existing `lsrgb2oklab` / `oklab2lsrgb` for `oklab_to_linear_srgb` / `linear_srgb_to_oklab`.

```typescript
import { lsrgb2oklab, oklab2lsrgb } from './pipeline';
import type { Vec3 } from './math';

const K1 = 0.206, K2 = 0.03, K3 = (1 + K1) / (1 + K2);
export const toe = (x: number): number =>
	0.5 * (K3 * x - K1 + Math.sqrt((K3 * x - K1) * (K3 * x - K1) + 4 * K2 * K3 * x));
export const toeInv = (x: number): number => (x * x + K1 * x) / (K3 * (x + K2));

function computeMaxSaturation(a: number, b: number): number {
	let k0, k1, k2, k3, k4, wl, wm, ws;
	if (-1.88170328 * a - 0.80936493 * b > 1) {
		k0 = 1.19086277; k1 = 1.76576728; k2 = 0.59662641; k3 = 0.75515197; k4 = 0.56771245;
		wl = 4.0767416621; wm = -3.3077115913; ws = 0.2309699292;
	} else if (1.81444104 * a - 1.19445276 * b > 1) {
		k0 = 0.73956515; k1 = -0.45954404; k2 = 0.08285427; k3 = 0.12541070; k4 = 0.14503204;
		wl = -1.2684380046; wm = 2.6097574011; ws = -0.3413193965;
	} else {
		k0 = 1.35733652; k1 = -0.00915799; k2 = -1.15130210; k3 = -0.50559606; k4 = 0.00692167;
		wl = -0.0041960863; wm = -0.7034186147; ws = 1.7076147010;
	}
	let S = k0 + k1 * a + k2 * b + k3 * a * a + k4 * a * b;
	const kl = 0.3963377774 * a + 0.2158037573 * b;
	const km = -0.1055613458 * a - 0.0638541728 * b;
	const ks = -0.0894841775 * a - 1.2914855480 * b;
	const l_ = 1 + S * kl, m_ = 1 + S * km, s_ = 1 + S * ks;
	const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
	const ldS = 3 * kl * l_ * l_, mdS = 3 * km * m_ * m_, sdS = 3 * ks * s_ * s_;
	const ldS2 = 6 * kl * kl * l_, mdS2 = 6 * km * km * m_, sdS2 = 6 * ks * ks * s_;
	const f = wl * l + wm * m + ws * s;
	const f1 = wl * ldS + wm * mdS + ws * sdS;
	const f2 = wl * ldS2 + wm * mdS2 + ws * sdS2;
	return S - (f * f1) / (f1 * f1 - 0.5 * f * f2);
}

function findCusp(a: number, b: number): { L: number; C: number } {
	const sCusp = computeMaxSaturation(a, b);
	const rgb = oklab2lsrgb([1, sCusp * a, sCusp * b]);
	const lCusp = Math.cbrt(1 / Math.max(rgb[0], rgb[1], rgb[2]));
	return { L: lCusp, C: lCusp * sCusp };
}

const toST = (cusp: { L: number; C: number }) => ({ S: cusp.C / cusp.L, T: cusp.C / (1 - cusp.L) });

export function okhsvToLsrgb(h: number, s: number, v: number): Vec3 {
	const a_ = Math.cos(2 * Math.PI * h), b_ = Math.sin(2 * Math.PI * h);
	const { S: Smax, T: Tmax } = toST(findCusp(a_, b_));
	const S0 = 0.5, k = 1 - S0 / Smax;
	const Lv = 1 - (s * S0) / (S0 + Tmax - Tmax * k * s);
	const Cv = (s * Tmax * S0) / (S0 + Tmax - Tmax * k * s);
	let L = v * Lv, C = v * Cv;
	const Lvt = toeInv(Lv), Cvt = (Cv * Lvt) / Lv;
	const Lnew = toeInv(L);
	C = L > 0 ? (C * Lnew) / L : 0;
	L = Lnew;
	const rgbScale = oklab2lsrgb([Lvt, a_ * Cvt, b_ * Cvt]);
	const scaleL = Math.cbrt(1 / Math.max(rgbScale[0], rgbScale[1], rgbScale[2], 0));
	L *= scaleL; C *= scaleL;
	return oklab2lsrgb([L, C * a_, C * b_]);
}

export function lsrgbToOkhsv(rgb: Vec3): Vec3 {
	const lab = lsrgb2oklab(rgb);
	let C = Math.hypot(lab[1], lab[2]);
	const a_ = C > 1e-9 ? lab[1] / C : 1, b_ = C > 1e-9 ? lab[2] / C : 0; // guard achromatic
	let L = lab[0];
	const h = 0.5 + (0.5 * Math.atan2(-lab[2], -lab[1])) / Math.PI;
	const { S: Smax, T: Tmax } = toST(findCusp(a_, b_));
	const S0 = 0.5, k = 1 - S0 / Smax;
	const t = Tmax / (C + L * Tmax);
	const Lv = t * L, Cv = t * C;
	const Lvt = toeInv(Lv), Cvt = Lv > 0 ? (Cv * Lvt) / Lv : 0;
	const rgbScale = oklab2lsrgb([Lvt, a_ * Cvt, b_ * Cvt]);
	const scaleL = Math.cbrt(1 / Math.max(rgbScale[0], rgbScale[1], rgbScale[2], 0));
	L /= scaleL; C /= scaleL;
	C = L > 0 ? (C * toe(L)) / L : 0;
	L = toe(L);
	const v = Lv > 0 ? L / Lv : 0;
	const sOut = (S0 + Tmax) * Cv / (Tmax * S0 + Tmax * k * Cv);
	return [h, sOut, v];
}
```

`computeMaxSaturation` and `find_gamut_intersection` use sRGB-specific coefficients baked into `ok_color.h`; that is correct here because anchors are linear sRGB. (If gamut-relative OKHSV is ever wanted for P3/Rec.2020, those constants would need regenerating — out of scope.)

#### 2. Type modifications in [`fe/src/lib/engine/types.ts`](fe/src/lib/engine/types.ts)

```typescript
import type { InterpSpaceKey } from '$lib/color/interp';

export type ThemeMode = 'seg' | 'arc' | 'spread' | 'spline';
export type SplineConstraint = 'free' | 'surface';

export interface ExplorerState {
	// ... existing properties ...
	theme: {
		A: ThemeAnchor | null;
		B: ThemeAnchor | null;
		// spline
		controlPoints: ThemeAnchor[];        // persisted; reuse ThemeAnchor { srgbLin }
		selectedCp: number | null;           // runtime selection — NOT persisted (see below)
		splineConstraint: SplineConstraint;  // persisted
		splineSpace: InterpSpaceKey;         // persisted — interpolation color space
		steps: number;
		arm: 'A' | 'B' | 'spline-add' | null;
		mode: ThemeMode;
		stops: ThemeStop[];
		dh: number;
		dc: number;
		cprof: ChromaProfile;
		arcLong: boolean;
		aa: number;
		wcagBg: 'white' | 'black';
	};
	hover: HoverHit | null;
}

// selectedCp is transient UI state — exclude it from persistence next to arm/stops:
export type PersistedTheme = Omit<ExplorerState['theme'], 'arm' | 'stops' | 'selectedCp'>;
```

`controlPoints`, `splineConstraint`, and `splineSpace` **are** persisted (they survive the `Omit`). `selectedCp` must be added to the `Omit` so selection does not leak into saved documents or dirty-tracking. `arm` is already reset on load by `applySnapshot`.

#### 3. Default state in [`fe/src/lib/engine/state.svelte.ts`](fe/src/lib/engine/state.svelte.ts)

```typescript
theme: {
	A: null,
	B: null,
	controlPoints: [],
	selectedCp: null,
	splineConstraint: 'surface', // default to snapping to the boundary
	splineSpace: 'oklch',        // default interpolation space
	steps: 5,
	arm: null,
	mode: 'seg',
	stops: [],
	dh: 40,
	dc: 0.0,
	cprof: 'linear',
	arcLong: false,
	aa: 4.5,
	wcagBg: 'white'
}
```

---

## 3. Spline Interpolation & Surface Snapping

### Phase 2: Mathematics

#### 1. Centripetal Catmull-Rom

We use a **centripetal** Catmull-Rom spline (Barry–Goldman form), not the uniform form. Centripetal parameterization (knot spacing $\propto \lVert P_{i+1}-P_i\rVert^{1/2}$) is what prevents the cusps and self-intersections that uniform Catmull-Rom produces on unevenly spaced points — exactly the artifact we must avoid when tracing a boundary. The curve still passes **exactly** through every control point, so the colors the user places are guaranteed to appear in the ramp.

Knot distances are measured in **Oklab** (convert each control point's `srgbLin` via `lsrgb2oklab`), independent of both `spaceMode` and the chosen interpolation space. This gives a single, perceptual, well-defined metric for knot spacing and avoids mixing angle-degrees with lightness/chroma magnitudes.

The interpolation itself runs **componentwise in the chosen interpolation space's coordinates**:
- non-cyclic components (e.g. L, a, b or L, C) interpolate normally;
- the cyclic component (a hue angle, when `space.cyclic !== null`) is **unwrapped** across the control-point sequence (each successive hue shifted by ±360° to the nearest value) before interpolation, then wrapped back into `[0, 360)`. This makes OKLCH/OKLrCH/OKHSV/CIELCh/CIELCh(uv) trace constant-or-smoothly-varying-hue arcs instead of cutting through the gray axis.

Boundary handling (virtual endpoints) uses reflection in the interpolation coordinates: $P_{-1} = 2P_0 - P_1$ and $P_k = 2P_{k-1} - P_{k-2}$ (applied to the *unwrapped* hue so reflection stays continuous).

#### 2. Theme engine integration in [`fe/src/lib/engine/theme.ts`](fe/src/lib/engine/theme.ts)

`buildRamp` keeps its existing structure for `seg`/`arc`/`spread` (including the early `if (!T.A …) return` guard, which must **not** block spline mode). Add a spline branch:

```typescript
export function buildRamp(state: ExplorerState, matrices: DerivedMatrices) {
	const T = state.theme;
	T.stops = [];

	if (T.mode === 'spline') {
		buildSplineRamp(state, matrices);
		return;
	}

	if (!T.A || (!T.B && T.mode !== 'spread')) return;
	// ... existing seg / arc / spread code unchanged ...
}

const HIRES = 200; // curve sampling resolution for arc-length + visualization

function buildSplineRamp(state: ExplorerState, matrices: DerivedMatrices) {
	const T = state.theme;
	const space = INTERP_SPACES[T.splineSpace];
	const cps = T.controlPoints;
	if (cps.length < 2) return;

	// 1. Control points -> interpolation coordinates, with hue unwrapped for cyclic spaces.
	const coords = cps.map((cp) => space.fromSrgbLin(cp.srgbLin));
	if (space.cyclic !== null) unwrapAngles(coords, space.cyclic);

	// 2. Centripetal knots from Oklab chord lengths.
	const okl = cps.map((cp) => lsrgb2oklab(cp.srgbLin));
	const knots = [0];
	for (let i = 1; i < okl.length; i++) {
		const d = Math.hypot(okl[i][0] - okl[i - 1][0], okl[i][1] - okl[i - 1][1], okl[i][2] - okl[i - 1][2]);
		knots.push(knots[i - 1] + Math.sqrt(Math.max(d, 1e-6))); // sqrt => centripetal; epsilon guards coincident points
	}

	// 3. High-resolution sampling -> world positions + linear-sRGB colors.
	//    These hi-res points feed BOTH arc length and the visual curve buffer.
	const curve = sampleSpline(coords, knots, space, HIRES, state, matrices); // Array<{ world, srgbLin }>
	T.splineCurve = curve; // stored for the renderer (see §4); not persisted

	// 4. Arc length in Oklab (matches fitEven's perceptual metric).
	const cum = [0];
	for (let i = 1; i < curve.length; i++) {
		const a = lsrgb2oklab(curve[i - 1].srgbLin);
		const b = lsrgb2oklab(curve[i].srgbLin);
		cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
	}
	const total = cum[cum.length - 1] || 1e-9;

	// 5. Resample `steps` swatches equidistant along arc length. Guard steps === 1.
	const steps = T.steps;
	for (let s = 0; s < steps; s++) {
		const f = steps === 1 ? 0 : s / (steps - 1);
		const target = f * total;
		let i = 0;
		while (i < curve.length - 1 && cum[i + 1] < target) i++;
		const span = (cum[i + 1] ?? cum[i]) - cum[i] || 1e-9;
		const t = Math.min(1, Math.max(0, (target - cum[i]) / span));
		const a = curve[i].world;
		const b = (curve[i + 1] ?? curve[i]).world;
		const w: Vec3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
		T.stops.push(stopFromWorld(w, state, matrices)); // recovers color from geometry, consistent with other modes
	}
}
```

`sampleSpline` evaluates the centripetal Catmull-Rom at `HIRES` parameter values, converts each coordinate back to `srgbLin` via `space.toSrgbLin`, maps to world via `jsToWorld(matrices.toSrgbLin.fromSrgb · srgbLin, …)`, and — when `T.splineConstraint === 'surface'` — snaps the world point to the boundary (below) and re-reads its color so chroma is pushed to the shell. It returns `{ world, srgbLin }` per sample. The cyclic component is interpolated on its unwrapped values and wrapped before `toSrgbLin`.

Because each final stop is produced by `stopFromWorld(world, …)` (which derives the color from `SPACES[mode].fromWorld(world)`), stop colors and geometry stay consistent across all space modes — no hardcoded per-mode inverse is needed (the previous draft's `worldToOklab` is removed).

#### 3. Surface snapping (corrected)

```typescript
// Snap a world point onto the active solid boundary along the radial line from the
// neutral (Y) axis. Brackets OUTWARD first so interior points project out to the shell,
// then bisects. solidField().v <= 0 is inside; we want the v == 0 crossing.
function snapToSurface(p: Vec3, state: ExplorerState, matrices: DerivedMatrices): Vec3 {
	const cx = 0, cz = 0; // neutral axis at this lightness
	const dx = p[0] - cx, dz = p[2] - cz;
	const at = (t: number): Vec3 => [cx + dx * t, p[1], cz + dz * t];

	// Find a t that is outside the solid (field > 0). Expand from the point outward.
	let tIn = 0;          // axis is inside for a star-shaped section
	let tOut = 1;
	for (let i = 0; i < 24 && solidField(at(tOut), state, matrices).v <= 0; i++) tOut *= 1.5;
	if (solidField(at(tOut), state, matrices).v <= 0) return p; // never exits — leave unchanged

	for (let i = 0; i < 24; i++) {            // bisect the inside/outside bracket
		const mid = (tIn + tOut) / 2;
		if (solidField(at(mid), state, matrices).v <= 0) tIn = mid;
		else tOut = mid;
	}
	return at(tIn);
}
```

**Limitations to document in the UI/help copy:** radial-at-fixed-lightness snapping assumes the cross-section is star-shaped about the neutral axis (true for the convex gamut shell). For tilted slice planes, the cylinder mask, or non-convex sections it may not find the nearest boundary, and it never changes lightness. Surface lock is therefore a "push chroma to the shell at constant lightness" tool; when `cutAbove`/`cutBelow`/`cylSlice` are active it degrades gracefully (it still returns a boundary point along the radial line, or the original point if the line never exits the solid). This is acceptable for v1; a true nearest-surface projection (march along the `solidField` gradient) is a possible later enhancement.

---

## 4. WebGL Visualization

### Phase 3: Renderer updates

The **swatch markers** reuse the existing `markProgram` exactly as theme stops already do (`webgl-renderer.ts` draws each stop via `markProgram` in a loop, recomputing CVD per draw). Control-point indicators reuse the same program — no new sphere geometry — distinguished by border/color, with the selected point highlighted.

The **gradient curve** is drawn from the hi-res `splineCurve` (≈200 vertices), **not** from `stops` (which holds only `steps` points and would render as a coarse polyline).

#### 1. Shaders — [`fe/src/lib/renderer/shaders/`](fe/src/lib/renderer/shaders)

`spline.vert` / `spline.frag`: a position + per-vertex color pass-through (same `#version 300 es` style as the existing shaders). Wire them through `shaders.ts` exports (`VS_SPLINE`, `FS_SPLINE`) like the other programs.

```glsl
// spline.vert
#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aCol;
uniform mat4 uProj, uView;
out vec3 vCol;
void main() { gl_Position = uProj * uView * vec4(aPos, 1.0); vCol = aCol; }
```
```glsl
// spline.frag
#version 300 es
precision highp float;
in vec3 vCol; out vec4 frag;
void main() { frag = vec4(vCol, 1.0); }
```

#### 2. `webgl-renderer.ts`

- Add `splineProgram`, `splineVao`, `splineBuffer`, `splineVertCount`, compiled/created in the constructor like the other programs.
- **`updateSplineGeometry(curve, cvd, sev)`** uploads interleaved `[pos.xyz, encodedColor.rgb]`. Colors are derived from each sample's `srgbLin` with `simulateCvdSrgb(srgbLin, cvd, sev)` then `TRC.srgb.enc(clamp01(...))` — taking CVD/severity from the **current draw input** (there is no `this.activeCvd`; mirror the existing stop-marker loop). Call this whenever the curve or the active CVD/gamut changes.
- Draw inside `draw()` after the stop markers:

```typescript
if (input.state.theme.mode === 'spline' && this.splineVertCount > 1) {
	gl.useProgram(this.splineProgram);
	gl.bindVertexArray(this.splineVao);
	gl.uniformMatrix4fv(this.U(this.splineProgram, 'uProj'), false, proj);
	gl.uniformMatrix4fv(this.U(this.splineProgram, 'uView'), false, view);
	gl.drawArrays(gl.LINE_STRIP, 0, this.splineVertCount);
}
```

> **Line width.** `gl.lineWidth` is clamped to 1px on essentially all WebGL2 drivers, so `LINE_STRIP` gives a thin (but smooth, because hi-res) curve. v1 ships the 1px curve. If a visibly **thick** gradient ribbon is required, generate camera-facing triangle-strip geometry (expand each segment by a screen-space width using the view-right vector) instead of `LINE_STRIP` — note this as a follow-up, not a blocker.

---

## 5. Viewport Interaction & Gestures

### Phase 4: Gestures in [`fe/src/lib/components/Viewport.svelte`](fe/src/lib/components/Viewport.svelte)

#### 1. Projecting control points to screen — new helper in [`camera.ts`](fe/src/lib/engine/camera.ts)

There is **no `m4`** in the codebase. Add a single screen-projection helper next to `persp`/`lookAt` rather than inventing a 4×4 math module:

```typescript
// camera.ts — project a world point to canvas pixels, or null if behind the camera.
export function projectToScreen(world: Vec3, cam: Camera, w: number, h: number): [number, number] | null {
	const eye = camEye(cam);
	const f = persp(cam.fov, w / h, 0.05, 40);  // existing Float32Array(16), column-major
	const v = lookAt(eye, cam.target, [0, 1, 0]);
	const mv = mulMat4(f, v);                    // small local 4x4*4x4
	const c = mulMat4Vec4(mv, [world[0], world[1], world[2], 1]);
	if (c[3] <= 0) return null;                  // behind camera
	return [((c[0] / c[3] + 1) / 2) * w, ((1 - c[1] / c[3]) / 2) * h];
}
```

`mulMat4` / `mulMat4Vec4` are tiny local helpers (column-major, matching `persp`/`lookAt`). `getControlPointAtScreen` then iterates `controlPoints`, calls `anchorWorld(cp, explorer, matrices)`, projects, and returns the nearest within a hit radius (use ≈12px for mouse, ≈24px for touch — read pointer type).

#### 2. Selecting and dragging

- **Pointer-down** on a projected control point → select it (`theme.selectedCp = idx`) and enter a `'drag-control-point'` gesture; this must take priority over orbit so the camera does not rotate.
- **Pointer-move** while dragging casts `pick(...)`; on a hit, write the picked color and rebuild:

```typescript
if (gesture.kind === 'drag-control-point' && explorer.theme.selectedCp !== null) {
	const r = canvas.getBoundingClientRect();
	const hit = pick(event.clientX - r.left, event.clientY - r.top, r.width, r.height, explorer, matrices, camera);
	if (hit) {
		const srgbLin = m3.mulV(matrices.toSrgbLin.toSrgb, hit.rgbLin);
		explorer.theme.controlPoints[explorer.theme.selectedCp] = { srgbLin };
		scheduleRampRebuild(); // throttled — see Performance
	}
	return;
}
```

  `pick` returns `null` when the ray *origin* is already inside the solid (`solidField(ro).v <= 0`), so dragging while the camera is inside the gamut is a no-op — acceptable, but worth a note in help copy.

#### 3. Adding and removing — a single add mechanism

- **Add:** a **toggle** sets `theme.arm = 'spline-add'`. While armed, a click on the solid surface appends a control point at the picked location (and clears `arm`, or stays armed for rapid placement — pick one in UI). We do **not** also bind double-click-to-add: double-click already resets the camera, and overloading it causes gesture conflicts (cf. the recent mobile-gesture fix).
- **Remove:** `Backspace`/`Delete` removes `controlPoints[selectedCp]` when one is selected.

#### 4. Selection lifecycle

After delete, clamp or clear `selectedCp`. Clear `selectedCp` and `arm` when leaving spline mode. Never use `!` non-null assertions on `selectedCp` — guard explicitly (as above).

#### 5. Performance

Surface-locked rebuild is `HIRES × bisection` `solidField` calls (~thousands) per `buildRamp`, and a drag fires `pointermove` continuously. Mitigate:
- **Throttle** rebuilds to animation frames (`scheduleRampRebuild` coalesces to one rebuild per frame).
- Optionally reduce `HIRES` during an active drag and do a full-resolution rebuild on pointer-up.
- Let Viewport's existing reactive `$effect` own the actual `draw()` call after state changes; do **not** also call `draw()` inside the move handler (avoids double draws per frame).

---

## 6. User Interface & Controls

### Phase 5: Panel updates in [`fe/src/lib/components/ThemeRamp.svelte`](fe/src/lib/components/ThemeRamp.svelte)

1. **Mode control:** add `{ value: 'spline', label: 'Spline' }` to the existing `SegmentedControl` options.
2. **Interpolation space:** a select/segmented control bound to `theme.splineSpace`, populated from `INTERP_SPACES` (`label` per entry). Visible in spline mode (and a candidate to also expose for `seg`/`arc` later).
3. **Constraint toggle:** `Free` / `Surface-locked` bound to `theme.splineConstraint`.
4. **Control-point list:** color chips with hex (reuse the existing stop chip styling), the selected row highlighted, each with a delete button; clicking a row sets `selectedCp`.
5. **Add toggle:** "Add control point" button that arms `theme.arm = 'spline-add'`.
6. **Help copy:** instructional text — *"Toggle Add, then click the solid to drop control points. Drag a point on the surface to reshape the curve. Select a point and press Delete to remove it."* Add a panel-help entry in [`inspector/help-copy.ts`](fe/src/lib/inspector/help-copy.ts) covering interpolation space, surface lock semantics, and the snapping limitation from §3.3.

```
 +-------------------------------------------------+
 |  Segment | Hue arc | Spread A | *Spline*        |
 +-------------------------------------------------+
 | Interpolate in: [ OKLCH ▾ ]                     |
 | Constraint:     [ Free ] [ *Surface* ]          |
 |                                                 |
 | Control points:                                 |
 |  • #1a4f7e  (selected)                    [Del] |
 |  • #d84315                                [Del] |
 |  • #ffeb3b                                [Del] |
 |                                                 |
 |  [ + Add control point ]                        |
 +-------------------------------------------------+
```

---

## 7. Persistence (Playbook A) & Token Export

Adding `controlPoints`, `splineConstraint`, and `splineSpace` are **additive persisted fields with factory defaults** → document-persistence **Playbook A** (no schema-version bump). All four of the following change **together** (see `.cursor/rules/document-persistence.mdc` and [`documents/README.md`](fe/src/lib/documents/README.md)):

1. **[`engine/types.ts`](fe/src/lib/engine/types.ts)** — new fields on `theme`; add `selectedCp` to the `PersistedTheme` `Omit` (it is **not** persisted).
2. **[`engine/state.svelte.ts`](fe/src/lib/engine/state.svelte.ts)** — factory defaults (§2.3).
3. **[`documents/snapshot.ts`](fe/src/lib/documents/snapshot.ts)** — in `toPersistedExplorer`, add `controlPoints` (deep-clone each anchor, like `cloneAnchor`), `splineConstraint`, `splineSpace` to the persisted `theme` block. Every persisted field needs a matching coerce line in step 4.
4. **[`documents/schema.ts`](fe/src/lib/documents/schema.ts)** —
   - add `'spline'` to `THEME_MODES` (else saved spline docs are coerced back to the default mode);
   - add `SPLINE_CONSTRAINTS = ['free','surface']` and `INTERP_SPACE_KEYS` enum coercers;
   - in `coerceTheme`: `controlPoints` via a new `coerceAnchorList` (array-guard each element through `coerceAnchor`, dropping invalid entries), `splineConstraint` via `enumOf`, `splineSpace` via `enumOf` against `INTERP_SPACE_KEYS`;
   - add the same three fields to the `defaults` block in `coerceSnapshot`.
5. **Do NOT bump `CURRENT_SNAPSHOT_VERSION`** (= `CURRENT_STATE_SCHEMA_VERSION`). No migration is needed — legacy saves get the factory defaults via coercion.
6. **[`documents/parse.test.ts`](fe/src/lib/documents/parse.test.ts)** — add fixtures: (a) a legacy save with no spline fields loads with `controlPoints: []`, `splineConstraint: 'surface'`, `splineSpace: 'oklch'`, `mode` unchanged; (b) a save with `mode: 'spline'` and a `controlPoints` array round-trips; (c) garbage `controlPoints` / unknown `splineSpace` coerce to safe defaults.

**`applySnapshot`** already resets `arm`/`stops`/`hover` on load; also reset `selectedCp = null` and clear the runtime `splineCurve` there (neither is persisted).

### Auto-adjust & export
- `fitGamut`, `fitWcag`, `fitEven` operate on the final `theme.stops` array, so they continue to work unchanged for spline-derived ramps.
- DTCG/CSS export read `theme.stops` and are unchanged. Update the empty-state strings in `exportTokens`/`exportDTCG` (currently *"place anchors A and B first"*) to also cover spline mode (e.g. *"add at least two control points"*).

---

## 8. Runtime-only field note

`theme.splineCurve` (the ≈200 hi-res `{ world, srgbLin }[]` from §3) is **derived runtime state** like `stops`: it is rebuilt by `buildRamp`, consumed by the renderer, and must be excluded from persistence (it is not part of `PersistedTheme`). If preferred, keep it off `theme` entirely and return it from `buildRamp`/store it on the renderer to avoid widening the persisted type surface — either way it must never reach `toPersistedExplorer`.

---

## 9. Implementation checklist

- [ ] `pipeline.ts`: `xyz2luv` / `luv2xyz` (+ `selftest.ts` round-trips for CIELUV and the OK\* spaces)
- [ ] `color/okhsv.ts`: port `toe`/`toeInv`, `computeMaxSaturation`, `findCusp`, `toST`, `okhsvToLsrgb`/`lsrgbToOkhsv` from `ok_color.h`; guard achromatic hue
- [ ] `color/interp.ts`: registry, `INTERP_SPACES`, `INTERP_SPACE_KEYS` (Oklab, OKLCH, OKLrCH, OKHSV, CIE\*, linear sRGB)
- [ ] `engine/types.ts`: theme fields, `ThemeMode += 'spline'`, `SplineConstraint`, `PersistedTheme` Omit includes `selectedCp`
- [ ] `engine/state.svelte.ts`: defaults
- [ ] `engine/theme.ts`: centripetal CR, hue unwrap, `buildSplineRamp`, corrected `snapToSurface`, `steps===1` guard
- [ ] `engine/camera.ts`: `projectToScreen` + local mat4 helpers
- [ ] `renderer/shaders/spline.{vert,frag}` + `shaders.ts` exports
- [ ] `renderer/webgl-renderer.ts`: spline program/VAO/buffer, `updateSplineGeometry`, per-frame CVD, draw call; control-point markers via `markProgram`
- [ ] `components/Viewport.svelte`: select/drag/add/delete gestures, throttled rebuild, touch hit radius
- [ ] `components/ThemeRamp.svelte`: mode option, interpolation-space select, constraint toggle, CP list, add toggle
- [ ] `inspector/help-copy.ts`: spline help + surface-lock limitations
- [ ] `documents/snapshot.ts` + `documents/schema.ts`: persist `controlPoints`/`splineConstraint`/`splineSpace`; `THEME_MODES += 'spline'`
- [ ] `documents/parse.test.ts`: legacy-default, round-trip, garbage-coercion fixtures
- [ ] `exportTokens`/`exportDTCG`: spline empty-state copy
- [ ] `npm run check` and `npm test` pass
