import { lsrgb2oklab, oklab2lsrgb } from './pipeline';
import { findCusp, findGamutIntersection } from './okhsv';

import type { GamutClipMethod } from './gamut-map';
import type { Vec3 } from './math';

export type SurfaceProjectionMethod = GamutClipMethod;
export type SurfaceProjectionNeutralFallback = 'preserve' | 'radial-fallback' | 'remember-hue';

export interface SurfaceProjectionParams {
	method: SurfaceProjectionMethod;
	alpha: number;
	focusL: number;
	neutral: SurfaceProjectionNeutralFallback;
}

export const DEFAULT_SURFACE_PROJECTION_PARAMS: SurfaceProjectionParams = {
	method: 'adaptive-0.5',
	alpha: 0.05,
	focusL: 0.5,
	neutral: 'preserve'
};

const EPS = 1e-7;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const sgn = (x: number) => (0 < x ? 1 : 0) - (x < 0 ? 1 : 0);

export function normalizeSurfaceProjectionParams(
	methodOrParams: SurfaceProjectionMethod | Partial<SurfaceProjectionParams>
): SurfaceProjectionParams {
	if (typeof methodOrParams === 'string') return { ...DEFAULT_SURFACE_PROJECTION_PARAMS, method: methodOrParams };
	return {
		method: methodOrParams.method ?? DEFAULT_SURFACE_PROJECTION_PARAMS.method,
		alpha: Number.isFinite(methodOrParams.alpha) ? Math.max(0, methodOrParams.alpha!) : DEFAULT_SURFACE_PROJECTION_PARAMS.alpha,
		focusL: Number.isFinite(methodOrParams.focusL) ? clamp(methodOrParams.focusL!, 0, 1) : DEFAULT_SURFACE_PROJECTION_PARAMS.focusL,
		neutral: methodOrParams.neutral ?? DEFAULT_SURFACE_PROJECTION_PARAMS.neutral
	};
}

export function inSrgbGamut(rgb: Vec3, tolerance = 0): boolean {
	return rgb.every((value) => value >= -tolerance && value <= 1 + tolerance);
}

function normalizedOklabHue(rgb: Vec3) {
	const lab = lsrgb2oklab(rgb);
	const C = Math.hypot(lab[1], lab[2]);
	if (C < EPS) return null;
	return { L: lab[0], C, a_: lab[1] / C, b_: lab[2] / C };
}

export function projectOklabMaxChroma(srgbLin: Vec3): Vec3 {
	const hue = normalizedOklabHue(srgbLin);
	if (!hue) return srgbLin;
	const L = clamp(hue.L, 0, 1);
	if (L <= EPS || L >= 1 - EPS) return oklab2lsrgb([L, 0, 0]);
	const cusp = findCusp(hue.a_, hue.b_);
	const Cmax = findGamutIntersection(hue.a_, hue.b_, L, 1, L, cusp);
	return oklab2lsrgb([L, Cmax * hue.a_, Cmax * hue.b_]);
}

function adaptiveL0(L: number, C: number, focusL: number, alpha: number) {
	const Ld = L - focusL;
	const k = 2 * (Ld > 0 ? 1 - focusL : focusL);
	if (k <= EPS) return focusL;
	const e1 = 0.5 * k + Math.abs(Ld) + (alpha * C) / k;
	return focusL + 0.5 * (sgn(Ld) * (e1 - Math.sqrt(Math.max(0, e1 * e1 - 2 * k * Math.abs(Ld)))));
}

function projectionFocusL(params: SurfaceProjectionParams, L: number, C: number, a_: number, b_: number) {
	if (params.method === 'preserve-chroma') return clamp(L, 0, 1);
	if (params.method === 'project-0.5') return params.focusL;
	const cusp = params.method === 'project-cusp' || params.method === 'adaptive-cusp' ? findCusp(a_, b_) : null;
	if (params.method === 'project-cusp') return cusp!.L;
	if (params.method === 'adaptive-cusp') return adaptiveL0(L, C, cusp!.L, params.alpha);
	return adaptiveL0(L, C, params.focusL, params.alpha);
}

export type OklabProjectionLine = {
	L: number;
	C: number;
	a_: number;
	b_: number;
	L0: number;
};

export function oklabMaxChromaLine(srgbLin: Vec3): OklabProjectionLine | null {
	const hue = normalizedOklabHue(srgbLin);
	if (!hue) return null;
	return { ...hue, L0: clamp(hue.L, 0, 1) };
}

export function oklabProjectionLine(
	srgbLin: Vec3,
	methodOrParams: SurfaceProjectionMethod | Partial<SurfaceProjectionParams>
): OklabProjectionLine | null {
	const hue = normalizedOklabHue(srgbLin);
	if (!hue) return null;
	const params = normalizeSurfaceProjectionParams(methodOrParams);
	return { ...hue, L0: projectionFocusL(params, hue.L, hue.C, hue.a_, hue.b_) };
}

export function oklabProjectionLinePoint(line: OklabProjectionLine, t: number): Vec3 {
	const L = line.L0 * (1 - t) + t * line.L;
	const C = line.C * t;
	return oklab2lsrgb([L, C * line.a_, C * line.b_]);
}

export function projectOklabToBoundary(
	srgbLin: Vec3,
	methodOrParams: SurfaceProjectionMethod | Partial<SurfaceProjectionParams>
): Vec3 {
	const line = oklabProjectionLine(srgbLin, methodOrParams);
	if (!line) return srgbLin;
	const t = findGamutIntersection(line.a_, line.b_, line.L, line.C, line.L0);
	return oklabProjectionLinePoint(line, t);
}
