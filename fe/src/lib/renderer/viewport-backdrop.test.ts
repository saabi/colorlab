import { describe, expect, it } from 'vitest';
import {
	neutralBackdropOklabFromSrgb,
	VIEWPORT_CLEAR_DARK_SRGB,
	VIEWPORT_CLEAR_NEUTRAL_SRGB,
	viewportClearSrgb
} from './viewport-backdrop';

describe('viewport backdrop', () => {
	it('keeps dark and neutral presets distinct', () => {
		expect(viewportClearSrgb(false)).toEqual(VIEWPORT_CLEAR_DARK_SRGB);
		expect(viewportClearSrgb(true)).toEqual(VIEWPORT_CLEAR_NEUTRAL_SRGB);
		expect(VIEWPORT_CLEAR_NEUTRAL_SRGB[0]).toBeGreaterThan(VIEWPORT_CLEAR_DARK_SRGB[0]);
	});

	it('encodes Oklab L = 0.5 neutral gray', () => {
		const [r, g, b] = VIEWPORT_CLEAR_NEUTRAL_SRGB;
		expect(r).toBeCloseTo(g, 6);
		expect(g).toBeCloseTo(b, 6);
		const lab = neutralBackdropOklabFromSrgb(VIEWPORT_CLEAR_NEUTRAL_SRGB);
		expect(lab[0]).toBeCloseTo(0.5, 4);
		expect(lab[1]).toBeCloseTo(0, 4);
		expect(lab[2]).toBeCloseTo(0, 4);
	});
});
