import { m3, type Vec3 } from '$lib/color/math';
import { SPACES } from '$lib/color/registry';
import { CUBE_ROT, REC709_Y, lsrgb2oklab, oklab2lsrgb, xyz2lab } from '$lib/color/pipeline';
import { TRC } from '$lib/color/transfer';

import type { ExplorerState, ThemeAnchor, ThemeStop } from './types';
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
	if (!stops.length) return '/* place anchors A and B on the slice first */';
	return [':root {', ...stops.map((s, i) => `  --ramp-${i + 1}: oklch(${(s.oklch[0] * 100).toFixed(2)}% ${s.oklch[1].toFixed(4)} ${s.oklch[2].toFixed(2)}); /* ${s.hex}${s.inG ? '' : ' OOG'} */`), '}'].join('\n');
}

export function exportDTCG(stops: ThemeStop[]) {
	if (!stops.length) return '/* place anchors first */';
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
