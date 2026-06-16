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

// Local reference: native (unadapted) rgb→XYZ for a gamut.
function rgbToXyzMReference(key: keyof typeof GAMUTS) {
	const g = GAMUTS[key];
	const inv = m3.inv(g.P);
	const s = m3.mulV(inv, g.W);
	return m3.mul(g.P, m3.diag(s));
}
