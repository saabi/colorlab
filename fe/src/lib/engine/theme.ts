import { m3, type Vec3 } from '$lib/color/math';
import { SPACES } from '$lib/color/registry';
import { CUBE_ROT, REC709_Y, lsrgb2oklab, oklab2lsrgb, xyz2lab } from '$lib/color/pipeline';
import { INTERP_SPACES, type InterpSpaceKey } from '$lib/color/interp';
import { mapToGamut } from '$lib/color/gamut-map';
import { TRC } from '$lib/color/transfer';
import { solidField } from './picking';

import type { ExplorerState, SplineSample, ThemeAnchor, ThemeStop } from './types';
import type { DerivedMatrices } from '$lib/renderer/uniforms';

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);

export function wcag(srgbLin: Vec3, other: Vec3) {
	const Y = (c: Vec3) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
	const a = Y(srgbLin.map(clamp01) as Vec3);
	const b = Y(other);
	const [hi, lo] = a > b ? [a, b] : [b, a];
	return (hi + 0.05) / (lo + 0.05);
}

export const srgbHex = (s: Vec3) =>
	'#' +
	s
		.map((v) =>
			Math.round(TRC.srgb.enc(clamp01(v)) * 255)
				.toString(16)
				.padStart(2, '0')
		)
		.join('');

export function jsToWorld(gamutRgb: Vec3, state: ExplorerState, matrices: DerivedMatrices): Vec3 {
	if (state.spaceMode === 0) return m3.mulV(CUBE_ROT, [gamutRgb[0] - 0.5, gamutRgb[1] - 0.5, gamutRgb[2] - 0.5]);
	if (state.spaceMode === 5) {
		const p = m3.mulV(CUBE_ROT, [gamutRgb[0] - 0.5, gamutRgb[1] - 0.5, gamutRgb[2] - 0.5]);
		return [p[0], REC709_Y[0] * gamutRgb[0] + REC709_Y[1] * gamutRgb[1] + REC709_Y[2] * gamutRgb[2] - 0.5, p[2]];
	}
	const xyz = m3.mulV(matrices.rgb2xyz, gamutRgb);
	if (state.spaceMode === 1) return [xyz[0] - 0.48, xyz[1] - 0.5, xyz[2] - 0.54];
	if (state.spaceMode === 2) {
		const lab = xyz2lab(xyz);
		return [lab[1] * 0.01, (lab[0] - 50) * 0.01, lab[2] * 0.01];
	}
	const ok = lsrgb2oklab(m3.mulV(matrices.toSrgbLin.toSrgb, gamutRgb));
	return [ok[1] * 2.2, ok[0] - 0.5, ok[2] * 2.2];
}

export function anchorWorld(anchor: ThemeAnchor, state: ExplorerState, matrices: DerivedMatrices) {
	return jsToWorld(m3.mulV(matrices.toSrgbLin.fromSrgb, anchor.srgbLin), state, matrices);
}

function stopFromWorld(world: Vec3, state: ExplorerState, matrices: DerivedMatrices): ThemeStop {
	const rgb = SPACES[state.spaceMode].fromWorld(world, matrices.rgb2xyz, matrices.toSrgbLin);
	const tol = 1e-3;
	const inG = rgb.every((v) => v >= -tol && v <= 1 + tol);
	const srgbLin = m3.mulV(matrices.toSrgbLin.toSrgb, rgb);
	const ok = lsrgb2oklab(srgbLin.map(clamp01) as Vec3);
	return {
		world,
		srgbLin,
		hex: srgbHex(srgbLin),
		inG,
		cw: wcag(srgbLin, [1, 1, 1]),
		cb: wcag(srgbLin, [0, 0, 0]),
		oklch: [ok[0], Math.hypot(ok[1], ok[2]), ((Math.atan2(ok[2], ok[1]) * 180) / Math.PI + 360) % 360]
	};
}

// Pipeline: interpolate (buildRawRamp) -> WCAG/even (optional, separate) -> gamut-map (finalizeRamp) -> encode.
export function buildRamp(state: ExplorerState, matrices: DerivedMatrices) {
	buildRawRamp(state, matrices);
	finalizeRamp(state, matrices);
	buildExpand(state, matrices);
}

// Expand stage: turn each final 1-D stop into a row of variants -> a 2-D palette.
// 'tints-shades' walks Oklab lightness around each base color (hue/chroma held),
// gamut-mapped per cell by the same policy. 'none' leaves the ramp 1-D (grid = []).
const EXPAND_L_RANGE = 0.32;
const HARMONY_OFFSETS: Record<ExplorerState['theme']['harmony'], number[]> = {
	complementary: [0, 180],
	triadic: [0, 120, 240],
	analogous: [-30, 0, 30],
	tetradic: [0, 90, 180, 270]
};
function buildExpand(state: ExplorerState, matrices: DerivedMatrices) {
	const T = state.theme;
	if (T.expand === 'none' || !T.stops.length) {
		T.grid = [];
		return;
	}
	const cols = Math.max(2, T.expandSteps);
	const mapCell = (lin: Vec3) => (T.gamutMap !== 'none' ? mapToGamut(lin, T.gamutMap) : lin);

	if (T.expand === 'harmony') {
		// Rotate the whole ramp's hue into related ramps; rows = harmony angles,
		// columns = the ramp's stops. Hue is rotated in Oklab (a,b held in length).
		const offsets = HARMONY_OFFSETS[T.harmony];
		T.grid = offsets.map((deg) => {
			const rad = (deg * Math.PI) / 180;
			const cos = Math.cos(rad);
			const sin = Math.sin(rad);
			return T.stops.map((s) => {
				const ok = lsrgb2oklab(s.srgbLin.map(clamp01) as Vec3);
				const a = ok[1] * cos - ok[2] * sin;
				const b = ok[1] * sin + ok[2] * cos;
				return stopFromSrgbLin(mapCell(oklab2lsrgb([ok[0], a, b])), state, matrices);
			});
		});
		return;
	}

	if (T.expand === 'spread') {
		// Fan each stop across delta hue/chroma in the world's cylindrical frame
		// (the former standalone spread mode, now applied per stop).
		const dh = (T.dh * Math.PI) / 180;
		T.grid = T.stops.map((s) => {
			const w = s.world;
			const r0 = Math.hypot(w[0], w[2]);
			const th0 = Math.atan2(w[2], w[0]);
			const row: ThemeStop[] = [];
			for (let j = 0; j < cols; j += 1) {
				const t = cols === 1 ? 0.5 : j / (cols - 1);
				const th = th0 + dh * (2 * t - 1);
				const r = Math.max(0, T.cprof === 'linear' ? r0 + T.dc * (2 * t - 1) : r0 - T.dc * Math.abs(2 * t - 1));
				const cell = stopFromWorld([r * Math.cos(th), w[1], r * Math.sin(th)], state, matrices);
				row.push(T.gamutMap !== 'none' ? stopFromSrgbLin(mapCell(cell.srgbLin), state, matrices) : cell);
			}
			return row;
		});
		return;
	}

	// 'tints-shades': walk Oklab lightness around each base color (hue/chroma held).
	T.grid = T.stops.map((s) => {
		const ok = lsrgb2oklab(s.srgbLin.map(clamp01) as Vec3);
		const hi = Math.min(1, ok[0] + EXPAND_L_RANGE);
		const lo = Math.max(0, ok[0] - EXPAND_L_RANGE);
		const row: ThemeStop[] = [];
		for (let j = 0; j < cols; j += 1) {
			const t = cols === 1 ? 0.5 : j / (cols - 1);
			const L = hi + (lo - hi) * t; // light tint -> dark shade
			row.push(stopFromSrgbLin(mapCell(oklab2lsrgb([L, ok[1], ok[2]])), state, matrices));
		}
		return row;
	});
}

function buildRawRamp(state: ExplorerState, matrices: DerivedMatrices) {
	const T = state.theme;
	T.stops = [];
	T.splineCurve = [];
	// 'linear' and 'spline' share one engine, parameterized by path type + space.
	interpolateRamp(state, matrices);
}

const HIRES = 200; // spline sampling resolution for arc length + visualization

// Shift each successive cyclic (hue, degrees) coordinate to within 180deg of the
// previous one so Catmull-Rom interpolates the shortest continuous hue path.
function unwrapAngles(coords: Vec3[], idx: 0 | 1 | 2, longHue = false) {
	for (let i = 1; i < coords.length; i += 1) {
		const prev = coords[i - 1][idx];
		let cur = coords[i][idx];
		while (cur - prev > 180) cur -= 360;
		while (cur - prev < -180) cur += 360;
		// Long-hue: take the other way around the wheel for each successive step.
		if (longHue && cur !== prev) cur += cur > prev ? -360 : 360;
		coords[i][idx] = cur;
	}
}

const mix3 = (a: Vec3, b: Vec3, f: number): Vec3 => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];

// Barry-Goldman pyramidal evaluation of a (centripetal) Catmull-Rom segment
// defined by points p0..p3 at strictly increasing knots t0..t3, for t in [t1, t2].
function catmullRom(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t0: number, t1: number, t2: number, t3: number, t: number): Vec3 {
	const a1 = mix3(p0, p1, (t - t0) / (t1 - t0));
	const a2 = mix3(p1, p2, (t - t1) / (t2 - t1));
	const a3 = mix3(p2, p3, (t - t2) / (t3 - t2));
	const b1 = mix3(a1, a2, (t - t0) / (t2 - t0));
	const b2 = mix3(a2, a3, (t - t1) / (t3 - t1));
	return mix3(b1, b2, (t - t1) / (t2 - t1));
}

// Cartesian embedding of an interpolation coordinate, used only for centripetal
// knot spacing. Cyclic (cylindrical) spaces embed (L, C, h) -> (L, C cos h, C sin h)
// so the chord metric is sensible and works for virtual endpoints too.
function embed(c: Vec3, cyclic: 0 | 1 | 2 | null): Vec3 {
	if (cyclic === null) return c;
	const out: Vec3 = [c[0], c[1], c[2]];
	const h = (c[cyclic] * Math.PI) / 180;
	const others = [0, 1, 2].filter((i) => i !== cyclic) as number[];
	// treat the non-cyclic pair as (lightness, chroma); embed chroma * angle.
	const lIdx = others[0];
	const cIdx = others[1];
	out[lIdx] = c[lIdx];
	out[cIdx] = c[cIdx] * Math.cos(h);
	out[cyclic] = c[cIdx] * Math.sin(h);
	return out;
}

const dist3 = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// Snap a world point onto the active solid boundary along the radial line from
// the neutral (Y) axis. Brackets outward first so interior points project out to
// the shell, then bisects to the v == 0 crossing. Returns the point unchanged if
// the radial line never exits the solid (e.g. degenerate slice geometry).
function snapToSurface(p: Vec3, state: ExplorerState, matrices: DerivedMatrices): Vec3 {
	const dx = p[0];
	const dz = p[2];
	const at = (t: number): Vec3 => [dx * t, p[1], dz * t];
	let tIn = 0;
	let tOut = 1;
	for (let i = 0; i < 24 && solidField(at(tOut), state, matrices).v <= 0; i += 1) tOut *= 1.5;
	if (solidField(at(tOut), state, matrices).v <= 0) return p;
	for (let i = 0; i < 24; i += 1) {
		const mid = (tIn + tOut) / 2;
		if (solidField(at(mid), state, matrices).v <= 0) tIn = mid;
		else tOut = mid;
	}
	return at(tIn);
}

// Unified interpolator for 'linear' and 'spline' path types over any interpolation
// space (incl. stateful "world"). Builds a hi-res curve, then arc-length resamples.
function interpolateRamp(state: ExplorerState, matrices: DerivedMatrices) {
	const T = state.theme;
	T.splineCurve = [];
	const cps = T.points;
	if (!cps.length) return;

	// Space accessors. "world" interpolates directly in the active 3D geometry;
	// every other space round-trips through the interp registry.
	const isWorld = T.splineSpace === 'world';
	const space = isWorld ? null : INTERP_SPACES[T.splineSpace as InterpSpaceKey];
	const cyclic = isWorld ? null : space!.cyclic;
	const toCoord = (srgbLin: Vec3): Vec3 =>
		isWorld ? jsToWorld(m3.mulV(matrices.toSrgbLin.fromSrgb, srgbLin), state, matrices) : space!.fromSrgbLin(srgbLin);
	const worldAt = (coord: Vec3): Vec3 => {
		const world = isWorld
			? coord
			: jsToWorld(m3.mulV(matrices.toSrgbLin.fromSrgb, space!.toSrgbLin(coord)), state, matrices);
		return T.splineConstraint === 'surface' ? snapToSurface(world, state, matrices) : world;
	};

	// A single source point is a degenerate "ramp" of one stop — useful as the seed
	// for the spread Expand operator (the former single-seed spread mode).
	if (cps.length === 1) {
		const stop = stopFromWorld(worldAt(toCoord(cps[0].srgbLin)), state, matrices);
		T.splineCurve = [{ world: stop.world, srgbLin: stop.srgbLin }];
		T.stops = [stop];
		return;
	}

	// 1. Source points -> interpolation coordinates (hue unwrapped for cyclic spaces).
	const coords = cps.map((cp) => toCoord(cp.srgbLin));
	if (cyclic !== null) unwrapAngles(coords, cyclic, T.arcLong);
	const n = coords.length;

	// 2. Hi-res curve in coord space. Linear = piecewise straight through the points;
	//    spline = centripetal Catmull-Rom with reflected virtual endpoints (a straight
	//    line at n = 2, so segment/arc are exactly the linear case).
	const curve: SplineSample[] = [];
	if (T.mode === 'spline') {
		const p0: Vec3 = [2 * coords[0][0] - coords[1][0], 2 * coords[0][1] - coords[1][1], 2 * coords[0][2] - coords[1][2]];
		const pN: Vec3 = [
			2 * coords[n - 1][0] - coords[n - 2][0],
			2 * coords[n - 1][1] - coords[n - 2][1],
			2 * coords[n - 1][2] - coords[n - 2][2]
		];
		const pts = [p0, ...coords, pN];
		const emb = pts.map((c) => embed(c, cyclic));
		const knots = [0];
		for (let i = 1; i < emb.length; i += 1) {
			knots.push(knots[i - 1] + Math.sqrt(Math.max(dist3(emb[i - 1], emb[i]), 1e-9)));
		}
		for (let i = 0; i < HIRES; i += 1) {
			const progress = i / (HIRES - 1);
			const seg = Math.min(Math.floor(progress * (n - 1)), n - 2);
			const localFrac = progress * (n - 1) - seg;
			const t = knots[seg + 1] + localFrac * (knots[seg + 2] - knots[seg + 1]);
			const coord = catmullRom(pts[seg], pts[seg + 1], pts[seg + 2], pts[seg + 3], knots[seg], knots[seg + 1], knots[seg + 2], knots[seg + 3], t);
			const stop = stopFromWorld(worldAt(coord), state, matrices);
			curve.push({ world: stop.world, srgbLin: stop.srgbLin });
		}
	} else {
		for (let i = 0; i < HIRES; i += 1) {
			const progress = i / (HIRES - 1);
			const seg = Math.min(Math.floor(progress * (n - 1)), n - 2);
			const localFrac = progress * (n - 1) - seg;
			const coord = mix3(coords[seg], coords[seg + 1], localFrac);
			const stop = stopFromWorld(worldAt(coord), state, matrices);
			curve.push({ world: stop.world, srgbLin: stop.srgbLin });
		}
	}
	T.splineCurve = curve;

	// Place stage: sample `steps` swatches along the curve per the chosen policy.
	placeStops(state, matrices);
}

// Place (declarative sampling) — choose where the N stops land on the hi-res curve:
//   even     -> equidistant in Oklab arc length (perceptually even).
//   uniform  -> equidistant in curve parameter.
//   tones    -> equidistant in Oklab lightness L (Material/Tailwind-style tonal ramp).
//   contrast -> equidistant in WCAG contrast vs the chosen background (Leonardo-style).
function placeStops(state: ExplorerState, matrices: DerivedMatrices) {
	const T = state.theme;
	const curve = T.splineCurve;
	const steps = T.steps;
	T.stops = [];
	if (!curve.length) return;

	// Contrast ladder: place stops at explicit WCAG target ratios spanning
	// [contrastMin, contrastMax] vs the chosen background (Leonardo-style). Each
	// target snaps to the nearest curve sample (HIRES = fine granularity).
	if (T.place === 'contrast') {
		const bg: Vec3 = T.wcagBg === 'black' ? [0, 0, 0] : [1, 1, 1];
		const cs = curve.map((s) => wcag(s.srgbLin, bg));
		const lo = Math.min(T.contrastMin, T.contrastMax);
		const hi = Math.max(T.contrastMin, T.contrastMax);
		for (let s = 0; s < steps; s += 1) {
			const target = steps === 1 ? lo : lo + (hi - lo) * (s / (steps - 1));
			let best = 0;
			let bestD = Infinity;
			for (let i = 0; i < cs.length; i += 1) {
				const d = Math.abs(cs[i] - target);
				if (d < bestD) {
					bestD = d;
					best = i;
				}
			}
			T.stops.push(stopFromWorld(curve[best].world, state, matrices));
		}
		return;
	}

	const oks = curve.map((s) => lsrgb2oklab(s.srgbLin.map(clamp01) as Vec3));

	// Build a non-decreasing axis to invert. 'even' uses cumulative arc length; the
	// others use the metric value itself (ascending normalized so inversion works).
	let axis: number[];
	if (T.place === 'uniform') {
		axis = curve.map((_, i) => i);
	} else if (T.place === 'tones') {
		axis = oks.map((o) => o[0]);
	} else {
		axis = [0];
		for (let i = 1; i < curve.length; i += 1) {
			axis.push(axis[i - 1] + Math.hypot(oks[i][0] - oks[i - 1][0], oks[i][1] - oks[i - 1][1], oks[i][2] - oks[i - 1][2]));
		}
	}
	// Normalize to non-decreasing (tonal/contrast ramps may run dark->light or light->dark).
	const ascending = axis[axis.length - 1] >= axis[0];
	const ax = ascending ? axis : axis.map((v) => -v);
	const lo = ax[0];
	const hi = ax[ax.length - 1];

	const worldAtTarget = (target: number): Vec3 => {
		let i = 0;
		while (i < curve.length - 1 && ax[i + 1] < target) i += 1;
		const j = Math.min(i + 1, curve.length - 1);
		const span = ax[j] - ax[i] || 1e-9;
		const f = Math.min(1, Math.max(0, (target - ax[i]) / span));
		const a = curve[i].world;
		const b = curve[j].world;
		return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
	};

	for (let s = 0; s < steps; s += 1) {
		const t = steps === 1 ? 0 : s / (steps - 1);
		T.stops.push(stopFromWorld(worldAtTarget(lo + (hi - lo) * t), state, matrices));
	}
}

function stopFromSrgbLin(srgbLin: Vec3, state: ExplorerState, matrices: DerivedMatrices): ThemeStop {
	const tol = 1e-3;
	const inG = srgbLin.every((v) => v >= -tol && v <= 1 + tol);
	const gamutRgb = m3.mulV(matrices.toSrgbLin.fromSrgb, srgbLin);
	const ok = lsrgb2oklab(srgbLin.map(clamp01) as Vec3);
	return {
		srgbLin,
		hex: srgbHex(srgbLin),
		inG,
		cw: wcag(srgbLin, [1, 1, 1]),
		cb: wcag(srgbLin, [0, 0, 0]),
		world: jsToWorld(gamutRgb, state, matrices),
		oklch: [ok[0], Math.hypot(ok[1], ok[2]), ((Math.atan2(ok[2], ok[1]) * 180) / Math.PI + 360) % 360]
	};
}

// Terminal gamut-map stage: the single place out-of-gamut colors are reconciled.
// Runs last in every recompute (after interpolation and any WCAG/even adjustment),
// so the policy governs all theme modes and the hi-res spline curve uniformly.
export function finalizeRamp(state: ExplorerState, matrices: DerivedMatrices) {
	const method = state.theme.gamutMap;
	// Keep the pre-map stops for the raw-vs-final preview. The mapping below
	// replaces `stops` with new objects, so the old array is safe to retain.
	state.theme.rawStops = state.theme.stops;
	if (method === 'none') return;
	state.theme.stops = state.theme.stops.map((s) => stopFromSrgbLin(mapToGamut(s.srgbLin, method), state, matrices));
	if (state.theme.mode === 'spline' && state.theme.splineCurve.length) {
		state.theme.splineCurve = state.theme.splineCurve.map((s) => {
			const mapped = mapToGamut(s.srgbLin, method);
			return { world: jsToWorld(m3.mulV(matrices.toSrgbLin.fromSrgb, mapped), state, matrices), srgbLin: mapped };
		});
	}
}

export function exportTokens(stops: ThemeStop[]) {
	if (!stops.length) return '/* place anchors A and B (or two spline control points) on the slice first */';
	return [':root {', ...stops.map((s, i) => `  --ramp-${i + 1}: oklch(${(s.oklch[0] * 100).toFixed(2)}% ${s.oklch[1].toFixed(4)} ${s.oklch[2].toFixed(2)}); /* ${s.hex}${s.inG ? '' : ' OOG'} */`), '}'].join('\n');
}

export function exportTokensGrid(grid: ThemeStop[][]) {
	if (!grid.length) return '/* expand the ramp into a palette first */';
	const lines = [':root {'];
	grid.forEach((row, r) => {
		row.forEach((s, c) => {
			lines.push(
				`  --ramp-${r + 1}-${(c + 1) * 100}: oklch(${(s.oklch[0] * 100).toFixed(2)}% ${s.oklch[1].toFixed(4)} ${s.oklch[2].toFixed(2)}); /* ${s.hex}${s.inG ? '' : ' OOG'} */`
			);
		});
	});
	lines.push('}');
	return lines.join('\n');
}

export function exportDTCGGrid(grid: ThemeStop[][]) {
	if (!grid.length) return '/* expand the ramp into a palette first */';
	const palette: Record<string, unknown> = {};
	grid.forEach((row, r) => {
		const ramp: Record<string, unknown> = {};
		row.forEach((s, c) => {
			ramp[String((c + 1) * 100)] = {
				$value: s.hex,
				$extensions: {
					'gamut.explorer': {
						oklch: { l: +s.oklch[0].toFixed(4), c: +s.oklch[1].toFixed(4), h: +s.oklch[2].toFixed(2) },
						inGamut: s.inG
					}
				}
			};
		});
		palette[`ramp-${r + 1}`] = { $type: 'color', ...ramp };
	});
	return JSON.stringify({ palette }, null, 2);
}

export function exportDTCG(stops: ThemeStop[]) {
	if (!stops.length) return '/* place anchors (or two spline control points) first */';
	const ramp: Record<string, unknown> = {};
	stops.forEach((s, i) => {
		ramp[String((i + 1) * 100)] = {
			$value: s.hex,
			$extensions: {
				'gamut.explorer': {
					oklch: { l: +s.oklch[0].toFixed(4), c: +s.oklch[1].toFixed(4), h: +s.oklch[2].toFixed(2) },
					wcagOnWhite: +s.cw.toFixed(2),
					wcagOnBlack: +s.cb.toFixed(2),
					inGamut: s.inG
				}
			}
		};
	});
	return JSON.stringify({ ramp: { $type: 'color', ...ramp } }, null, 2);
}
