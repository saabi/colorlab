import { describe, expect, it } from 'vitest';
import { DEFAULT_APP_PREFERENCES, sanitizeAppPreferences } from './app.svelte';

describe('app preferences', () => {
	it('returns defaults for missing or invalid input', () => {
		expect(sanitizeAppPreferences(null)).toEqual(DEFAULT_APP_PREFERENCES);
		expect(sanitizeAppPreferences({ autoRotate: 'yes', minAverageFps: 24, theme: 'sepia' })).toEqual(
			DEFAULT_APP_PREFERENCES
		);
	});

	it('keeps valid preference fields', () => {
		expect(
			sanitizeAppPreferences({
				autoRotate: false,
				autoPerformance: false,
				minAverageFps: 15,
				neutralBackdrop: true,
				theme: 'light',
				displayGamut: 'p3'
			})
		).toEqual({
			autoRotate: false,
			autoPerformance: false,
			minAverageFps: 15,
			observerModel: 'stockman-sharpe-2deg',
			chromaticityDiagram: 'cie1931-xy',
			neutralBackdrop: true,
			theme: 'light',
			displayGamut: 'p3'
		});
	});

	it('defaults invalid theme values to dark', () => {
		expect(sanitizeAppPreferences({ theme: 'sepia' }).theme).toBe('dark');
	});

	it('defaults displayGamut to sRGB and rejects unknown values', () => {
		expect(sanitizeAppPreferences({}).displayGamut).toBe('srgb');
		expect(sanitizeAppPreferences({ displayGamut: 'prophoto' }).displayGamut).toBe('srgb');
		expect(sanitizeAppPreferences({ displayGamut: 'rec2020' }).displayGamut).toBe('rec2020');
	});
});
