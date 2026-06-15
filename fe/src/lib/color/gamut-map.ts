// Gamut mapping: bring a (possibly out-of-gamut) LINEAR sRGB color into the
// sRGB gamut. `mapToGamut` is the single canonical entry point used across the
// pipeline (theme stops, spline samples, export).
//
// The boundary-projection strategies are ported from Björn Ottosson's
// "sRGB gamut clipping" post / ok_color.h
// (https://bottosson.github.io/posts/gamutclipping/): each projects in Oklab
// toward a focus point (L0, 0) on the neutral axis; the choice of L0 is what
// distinguishes them. In-gamut colors are returned unchanged. Operates in
// linear sRGB to match the rest of the app (the reference applies the sRGB
// transfer function on top; we don't).

import { lsrgb2oklab, oklab2lsrgb } from './pipeline';
import { findCusp, findGamutIntersection } from './okhsv';
import type { Vec3 } from './math';

/** Boundary-projection strategies (Ottosson). */
export type GamutClipMethod =
	| 'preserve-chroma'
	| 'project-0.5'
	| 'project-cusp'
	| 'adaptive-0.5'
	| 'adaptive-cusp';

/** Full policy set: identity, naive clamp, plus the projection strategies. */
export type GamutMapMethod = 'none' | 'clip' | GamutClipMethod;

export interface GamutMapParams {
	alpha: number;
}

export const DEFAULT_GAMUT_MAP_PARAMS: GamutMapParams = {
	alpha: 0.05
};

export const GAMUT_CLIP_METHODS: readonly GamutClipMethod[] = [
	'preserve-chroma',
	'project-0.5',
	'project-cusp',
	'adaptive-0.5',
	'adaptive-cusp'
];

export const GAMUT_MAP_METHODS: readonly GamutMapMethod[] = ['none', 'clip', ...GAMUT_CLIP_METHODS];

const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);
const clamp01 = (x: number) => clamp(x, 0, 1);
const sgn = (x: number) => (0 < x ? 1 : 0) - (x < 0 ? 1 : 0);

const inGamut = (rgb: Vec3) =>
	rgb[0] < 1 && rgb[1] < 1 && rgb[2] < 1 && rgb[0] > 0 && rgb[1] > 0 && rgb[2] > 0;

export function normalizeGamutMapParams(params?: Partial<GamutMapParams>): GamutMapParams {
	const alpha = params?.alpha;
	return {
		alpha: typeof alpha === 'number' && Number.isFinite(alpha) ? Math.max(0, alpha) : DEFAULT_GAMUT_MAP_PARAMS.alpha
	};
}

// Shared projection: choose L0 via `pickL0`, then project to the gamut boundary.
function project(rgb: Vec3, pickL0: (L: number, C: number, a_: number, b_: number) => number): Vec3 {
	if (inGamut(rgb)) return rgb;
	const lab = lsrgb2oklab(rgb);
	const L = lab[0];
	const eps = 1e-5;
	const C = Math.max(eps, Math.hypot(lab[1], lab[2]));
	const a_ = lab[1] / C;
	const b_ = lab[2] / C;
	const L0 = pickL0(L, C, a_, b_);
	const t = findGamutIntersection(a_, b_, L, C, L0);
	const Lc = L0 * (1 - t) + t * L;
	const Cc = t * C;
	return oklab2lsrgb([Lc, Cc * a_, Cc * b_]);
}

export const GAMUT_CLIP: Record<GamutClipMethod, (rgb: Vec3, params?: Partial<GamutMapParams>) => Vec3> = {
	'preserve-chroma': (rgb) => project(rgb, (L) => clamp(L, 0, 1)),
	'project-0.5': (rgb) => project(rgb, () => 0.5),
	'project-cusp': (rgb) => project(rgb, (_L, _C, a_, b_) => findCusp(a_, b_).L),
	'adaptive-0.5': (rgb, params) =>
		project(rgb, (L, C) => {
			const alpha = normalizeGamutMapParams(params).alpha;
			const Ld = L - 0.5;
			const e1 = 0.5 + Math.abs(Ld) + alpha * C;
			return 0.5 * (1 + sgn(Ld) * (e1 - Math.sqrt(Math.max(0, e1 * e1 - 2 * Math.abs(Ld)))));
		}),
	'adaptive-cusp': (rgb, params) =>
		project(rgb, (L, C, a_, b_) => {
			const alpha = normalizeGamutMapParams(params).alpha;
			const cusp = findCusp(a_, b_);
			const Ld = L - cusp.L;
			const k = 2 * (Ld > 0 ? 1 - cusp.L : cusp.L);
			const e1 = 0.5 * k + Math.abs(Ld) + (alpha * C) / k;
			return cusp.L + 0.5 * (sgn(Ld) * (e1 - Math.sqrt(Math.max(0, e1 * e1 - 2 * k * Math.abs(Ld)))));
		})
};

/**
 * Map a linear-sRGB color into the sRGB gamut according to `method`.
 *  - 'none'  -> identity (leave out-of-gamut)
 *  - 'clip'  -> naive per-channel clamp to [0,1]
 *  - others  -> Ottosson boundary projection (in-gamut colors unchanged)
 */
export function mapToGamut(srgbLin: Vec3, method: GamutMapMethod, params?: Partial<GamutMapParams>): Vec3 {
	if (method === 'none') return srgbLin;
	if (method === 'clip') return [clamp01(srgbLin[0]), clamp01(srgbLin[1]), clamp01(srgbLin[2])];
	return GAMUT_CLIP[method](srgbLin, params);
}
