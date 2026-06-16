import { describe, it, expect } from 'vitest';

import { bradfordAdaptation } from './adapt';
import { GAMUTS } from './pipeline';
import { m3 } from './math';
import { rebuildMatrices } from '$lib/renderer/uniforms';

const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1];

describe('bradford chromatic adaptation', () => {
	it('is the identity when source and destination whites match', () => {
		const m = bradfordAdaptation(GAMUTS.srgb.W, GAMUTS.srgb.W);
		m.forEach((v, i) => expect(Math.abs(v - IDENTITY[i])).toBeLessThan(1e-9));
	});

	it('maps the source white exactly onto the destination white', () => {
		// Illuminant C (NTSC 1953) → D65.
		const adapted = m3.mulV(bradfordAdaptation(GAMUTS.ntsc.W, GAMUTS.srgb.W), GAMUTS.ntsc.W);
		GAMUTS.srgb.W.forEach((v, i) => expect(Math.abs(adapted[i] - v)).toBeLessThan(1e-9));
	});
});

describe('rebuildMatrices D65 adaptation', () => {
	it('leaves D65 gamuts unchanged (identity adaptation)', () => {
		const native = rgbToXyzMReference('srgb');
		const built = rebuildMatrices('srgb').rgb2xyz;
		built.forEach((v, i) => expect(Math.abs(v - native[i])).toBeLessThan(1e-9));
	});

	it('adapts a non-D65 gamut so its white maps to D65 XYZ', () => {
		// rgb2xyz · (1,1,1) is the gamut white; after adaptation it must be D65.
		const white = m3.mulV(rebuildMatrices('ntsc').rgb2xyz, [1, 1, 1]);
		GAMUTS.srgb.W.forEach((v, i) => expect(Math.abs(white[i] - v)).toBeLessThan(1e-6));
	});

	it('reports D65 as the interchange white for a non-D65 gamut', () => {
		rebuildMatrices('cie').white.forEach((v, i) =>
			expect(Math.abs(v - GAMUTS.srgb.W[i])).toBeLessThan(1e-9)
		);
	});
});

describe('rebuildMatrices display-gamut mapping (rgb2displayRgb)', () => {
	it('is identity when active gamut equals display gamut', () => {
		const m = rebuildMatrices('p3', 'stockman-sharpe-2deg', 'p3').rgb2displayRgb;
		m.forEach((v, i) => expect(Math.abs(v - IDENTITY[i])).toBeLessThan(1e-9));
	});

	it('keeps an in-display color inside the [0,1] cube', () => {
		// A mid grey in sRGB stays in-gamut on any wider display.
		const { rgb2displayRgb } = rebuildMatrices('srgb', 'stockman-sharpe-2deg', 'rec2020');
		const out = m3.mulV(rgb2displayRgb, [0.5, 0.5, 0.5]);
		out.forEach((c) => expect(c).toBeGreaterThanOrEqual(-1e-6));
		out.forEach((c) => expect(c).toBeLessThanOrEqual(1 + 1e-6));
	});

	it('flags an out-of-display color (P3 pure green on an sRGB display) as out of [0,1]', () => {
		const { rgb2displayRgb } = rebuildMatrices('p3', 'stockman-sharpe-2deg', 'srgb');
		const out = m3.mulV(rgb2displayRgb, [0, 1, 0]); // pure P3 green
		const outside = out.some((c) => c < -1e-4 || c > 1 + 1e-4);
		expect(outside).toBe(true);
	});

	it('reports the display white point', () => {
		expect(rebuildMatrices('srgb', 'stockman-sharpe-2deg', 'p3').displayWhite).toEqual(GAMUTS.p3.W);
	});
});

// Local reference: native (unadapted) rgb→XYZ for a gamut.
function rgbToXyzMReference(key: keyof typeof GAMUTS) {
	const g = GAMUTS[key];
	const inv = m3.inv(g.P);
	const s = m3.mulV(inv, g.W);
	return m3.mul(g.P, m3.diag(s));
}
