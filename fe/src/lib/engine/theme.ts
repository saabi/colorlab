import { m3, type Vec3 } from '$lib/color/math';
import { SPACES } from '$lib/color/registry';
import { CUBE_ROT, REC709_Y, lsrgb2oklab, oklab2lsrgb, xyz2lab } from '$lib/color/pipeline';
import { INTERP_SPACES } from '$lib/color/interp';
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

export function buildRamp(state: ExplorerState, matrices: DerivedMatrices) {
	const T = state.theme;
	T.stops = [];
	if (T.mode === 'spline') {
		buildSplineRamp(state, matrices);
		return;
	}
	T.splineCurve = [];
	if (!T.A || (!T.B && T.mode !== 'spread')) return;
	const wA = anchorWorld(T.A, state, matrices);
	const cyl = (w: Vec3) => ({ r: Math.hypot(w[0], w[2]), th: Math.atan2(w[2], w[0]), y: w[1] });
	if (T.mode === 'spread') {
		const cA = cyl(wA);
		const dh = (T.dh * Math.PI) / 180;
		for (let i = 0; i < T.steps; i += 1) {
			const t = T.steps === 1 ? 0.5 : i / (T.steps - 1);
			const th = cA.th + dh * (2 * t - 1);
			const r = Math.max(0, T.cprof === 'linear' ? cA.r + T.dc * (2 * t - 1) : cA.r - T.dc * Math.abs(2 * t - 1));
			T.stops.push(stopFromWorld([r * Math.cos(th), cA.y, r * Math.sin(th)], state, matrices));
		}
		return;
	}
	if (!T.B) return;
	const wB = anchorWorld(T.B, state, matrices);
	const cA = cyl(wA);
	const cB = cyl(wB);
	let dth = cB.th - cA.th;
	while (dth > Math.PI) dth -= 2 * Math.PI;
	while (dth < -Math.PI) dth += 2 * Math.PI;
	if (T.arcLong) {
		dth = dth > 0 ? dth - 2 * Math.PI : dth + 2 * Math.PI;
	}
	for (let i = 0; i < T.steps; i += 1) {
		const t = T.steps === 1 ? 0 : i / (T.steps - 1);
		let w: Vec3;
		if (T.mode === 'arc') {
			const r = cA.r + (cB.r - cA.r) * t;
			const th = cA.th + dth * t;
			const y = cA.y + (cB.y - cA.y) * t;
			w = [r * Math.cos(th), y, r * Math.sin(th)];
		} else {
			w = [wA[0] + (wB[0] - wA[0]) * t, wA[1] + (wB[1] - wA[1]) * t, wA[2] + (wB[2] - wA[2]) * t];
		}
		T.stops.push(stopFromWorld(w, state, matrices));
	}
}

const HIRES = 200; // spline sampling resolution for arc length + visualization

// Shift each successive cyclic (hue, degrees) coordinate to within 180deg of the
// previous one so Catmull-Rom interpolates the shortest continuous hue path.
function unwrapAngles(coords: Vec3[], idx: 0 | 1 | 2) {
	for (let i = 1; i < coords.length; i += 1) {
		const prev = coords[i - 1][idx];
		let cur = coords[i][idx];
		while (cur - prev > 180) cur -= 360;
		while (cur - prev < -180) cur += 360;
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

function buildSplineRamp(state: ExplorerState, matrices: DerivedMatrices) {
	const T = state.theme;
	T.splineCurve = [];
	const space = INTERP_SPACES[T.splineSpace];
	const cps = T.controlPoints;
	if (cps.length < 2) return;

	// 1. Control points -> interpolation coordinates (hue unwrapped for cyclic spaces).
	const coords = cps.map((cp) => space.fromSrgbLin(cp.srgbLin));
	if (space.cyclic !== null) unwrapAngles(coords, space.cyclic);

	// 2. Augment with reflected virtual endpoints for the boundary segments.
	const n = coords.length;
	const p0: Vec3 = [2 * coords[0][0] - coords[1][0], 2 * coords[0][1] - coords[1][1], 2 * coords[0][2] - coords[1][2]];
	const pN: Vec3 = [
		2 * coords[n - 1][0] - coords[n - 2][0],
		2 * coords[n - 1][1] - coords[n - 2][1],
		2 * coords[n - 1][2] - coords[n - 2][2]
	];
	const pts = [p0, ...coords, pN];

	// 3. Centripetal knots from cartesian-embedded chord lengths.
	const emb = pts.map((c) => embed(c, space.cyclic));
	const knots = [0];
	for (let i = 1; i < emb.length; i += 1) {
		knots.push(knots[i - 1] + Math.sqrt(Math.max(dist3(emb[i - 1], emb[i]), 1e-9)));
	}

	// 4. High-resolution sampling -> world positions + colors.
	const worldAt = (coord: Vec3): Vec3 => {
		const srgbLin = space.toSrgbLin(coord);
		const gamutRgb = m3.mulV(matrices.toSrgbLin.fromSrgb, srgbLin);
		const world = jsToWorld(gamutRgb, state, matrices);
		return T.splineConstraint === 'surface' ? snapToSurface(world, state, matrices) : world;
	};
	const curve: SplineSample[] = [];
	for (let i = 0; i < HIRES; i += 1) {
		const progress = i / (HIRES - 1);
		const seg = Math.min(Math.floor(progress * (n - 1)), n - 2);
		const localFrac = progress * (n - 1) - seg;
		const t = knots[seg + 1] + localFrac * (knots[seg + 2] - knots[seg + 1]);
		const coord = catmullRom(
			pts[seg],
			pts[seg + 1],
			pts[seg + 2],
			pts[seg + 3],
			knots[seg],
			knots[seg + 1],
			knots[seg + 2],
			knots[seg + 3],
			t
		);
		const stop = stopFromWorld(worldAt(coord), state, matrices);
		curve.push({ world: stop.world, srgbLin: stop.srgbLin });
	}
	T.splineCurve = curve;

	// 5. Cumulative arc length in Oklab (matches fitEven's perceptual metric).
	const oks = curve.map((s) => lsrgb2oklab(s.srgbLin.map(clamp01) as Vec3));
	const cum = [0];
	for (let i = 1; i < curve.length; i += 1) {
		cum.push(cum[i - 1] + Math.hypot(oks[i][0] - oks[i - 1][0], oks[i][1] - oks[i - 1][1], oks[i][2] - oks[i - 1][2]));
	}
	const total = cum[cum.length - 1] || 1e-9;

	// 6. Resample `steps` swatches equidistant along arc length.
	const steps = T.steps;
	for (let s = 0; s < steps; s += 1) {
		const target = (steps === 1 ? 0 : s / (steps - 1)) * total;
		let i = 0;
		while (i < curve.length - 1 && cum[i + 1] < target) i += 1;
		const span = cum[Math.min(i + 1, curve.length - 1)] - cum[i] || 1e-9;
		const f = Math.min(1, Math.max(0, (target - cum[i]) / span));
		const a = curve[i].world;
		const b = curve[Math.min(i + 1, curve.length - 1)].world;
		T.stops.push(stopFromWorld([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f], state, matrices));
	}
}

function stopFromOklab(ok: Vec3, state: ExplorerState, matrices: DerivedMatrices): ThemeStop {
	const srgbLin = oklab2lsrgb(ok);
	const tol = 1e-3;
	const inG = srgbLin.every((v) => v >= -tol && v <= 1 + tol);
	const gamutRgb = m3.mulV(matrices.toSrgbLin.fromSrgb, srgbLin);
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

export function fitGamut(state: ExplorerState, matrices: DerivedMatrices) {
	state.theme.stops = state.theme.stops.map((s) => {
		const ok = lsrgb2oklab(s.srgbLin.map(clamp01) as Vec3);
		if (s.inG) return s;
		const L = ok[0];
		const h = Math.atan2(ok[2], ok[1]);
		let lo = 0;
		let hi = Math.hypot(ok[1], ok[2]);
		for (let i = 0; i < 24; i += 1) {
			const C = (lo + hi) / 2;
			const t = oklab2lsrgb([L, C * Math.cos(h), C * Math.sin(h)]);
			if (t.every((v) => v >= -1e-3 && v <= 1.001)) lo = C;
			else hi = C;
		}
		return stopFromOklab([L, lo * Math.cos(h), lo * Math.sin(h)], state, matrices);
	});
}

export function fitWcag(state: ExplorerState, matrices: DerivedMatrices) {
	const target = state.theme.aa;
	const onWhite = state.theme.wcagBg !== 'black';
	state.theme.stops = state.theme.stops.map((s) => {
		const ok = lsrgb2oklab(s.srgbLin.map(clamp01) as Vec3);
		const C = Math.hypot(ok[1], ok[2]);
		const h = Math.atan2(ok[2], ok[1]);
		const ratio = (L: number) => wcag(oklab2lsrgb([L, C * Math.cos(h), C * Math.sin(h)]), onWhite ? [1, 1, 1] : [0, 0, 0]);
		let L = ok[0];
		if (ratio(L) >= target) return stopFromOklab([L, ok[1], ok[2]], state, matrices);
		const dir = onWhite ? -1 : 1;
		let best = L;
		for (let i = 0; i < 60 && L >= 0 && L <= 1; i += 1) {
			L += dir * 0.04;
			if (ratio(L) >= target) {
				best = L;
				break;
			}
		}
		return stopFromOklab([Math.min(Math.max(best, 0), 1), C * Math.cos(h), C * Math.sin(h)], state, matrices);
	});
}

export function fitEven(state: ExplorerState, matrices: DerivedMatrices) {
	const st = state.theme.stops;
	if (st.length < 3) return;
	const oks = st.map((s) => lsrgb2oklab(s.srgbLin.map(clamp01) as Vec3));
	const cum = [0];
	for (let i = 1; i < oks.length; i += 1) cum.push(cum[i - 1] + Math.hypot(oks[i][0] - oks[i - 1][0], oks[i][1] - oks[i - 1][1], oks[i][2] - oks[i - 1][2]));
	const total = cum[cum.length - 1];
	if (total < 1e-6) return;
	const sample = (f: number): Vec3 => {
		const tgt = f * total;
		for (let i = 1; i < cum.length; i += 1) {
			if (cum[i] >= tgt) {
				const seg = cum[i] - cum[i - 1] || 1e-9;
				const l = (tgt - cum[i - 1]) / seg;
				return oks[i - 1].map((v, k) => v + (oks[i][k] - v) * l) as Vec3;
			}
		}
		return oks[oks.length - 1];
	};
	state.theme.stops = st.map((_, i) => stopFromOklab(sample(i / (st.length - 1)), state, matrices));
}

export function exportTokens(stops: ThemeStop[]) {
	if (!stops.length) return '/* place anchors A and B (or two spline control points) on the slice first */';
	return [':root {', ...stops.map((s, i) => `  --ramp-${i + 1}: oklch(${(s.oklch[0] * 100).toFixed(2)}% ${s.oklch[1].toFixed(4)} ${s.oklch[2].toFixed(2)}); /* ${s.hex}${s.inG ? '' : ' OOG'} */`), '}'].join('\n');
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
