import { lsrgb2oklab, oklab2lsrgb } from './pipeline';
import { findCusp, findGamutIntersection } from './okhsv';

import type { GamutClipMethod } from './gamut-map';
import type { Vec3 } from './math';

export type SurfaceProjectionMethod = GamutClipMethod;

const EPS = 1e-7;
const ALPHA = 0.05;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const sgn = (x: number) => (0 < x ? 1 : 0) - (x < 0 ? 1 : 0);

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

function adaptiveL0ToMid(L: number, C: number) {
	const Ld = L - 0.5;
	const e1 = 0.5 + Math.abs(Ld) + ALPHA * C;
	return 0.5 * (1 + sgn(Ld) * (e1 - Math.sqrt(Math.max(0, e1 * e1 - 2 * Math.abs(Ld)))));
}

function adaptiveL0ToCusp(L: number, C: number, cuspL: number) {
	const Ld = L - cuspL;
	const k = 2 * (Ld > 0 ? 1 - cuspL : cuspL);
	if (k <= EPS) return cuspL;
	const e1 = 0.5 * k + Math.abs(Ld) + (ALPHA * C) / k;
	return cuspL + 0.5 * (sgn(Ld) * (e1 - Math.sqrt(Math.max(0, e1 * e1 - 2 * k * Math.abs(Ld)))));
}

function projectionFocusL(method: SurfaceProjectionMethod, L: number, C: number, a_: number, b_: number) {
	if (method === 'preserve-chroma') return clamp(L, 0, 1);
	if (method === 'project-0.5') return 0.5;
	const cusp = method === 'project-cusp' || method === 'adaptive-cusp' ? findCusp(a_, b_) : null;
	if (method === 'project-cusp') return cusp!.L;
	if (method === 'adaptive-cusp') return adaptiveL0ToCusp(L, C, cusp!.L);
	return adaptiveL0ToMid(L, C);
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

export function oklabProjectionLine(srgbLin: Vec3, method: SurfaceProjectionMethod): OklabProjectionLine | null {
	const hue = normalizedOklabHue(srgbLin);
	if (!hue) return null;
	return { ...hue, L0: projectionFocusL(method, hue.L, hue.C, hue.a_, hue.b_) };
}

export function oklabProjectionLinePoint(line: OklabProjectionLine, t: number): Vec3 {
	const L = line.L0 * (1 - t) + t * line.L;
	const C = line.C * t;
	return oklab2lsrgb([L, C * line.a_, C * line.b_]);
}

export function projectOklabToBoundary(srgbLin: Vec3, method: SurfaceProjectionMethod): Vec3 {
	const line = oklabProjectionLine(srgbLin, method);
	if (!line) return srgbLin;
	const t = findGamutIntersection(line.a_, line.b_, line.L, line.C, line.L0);
	return oklabProjectionLinePoint(line, t);
}
