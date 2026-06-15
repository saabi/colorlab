import { describe, expect, it } from 'vitest';
import { DEFAULT_APP_PREFERENCES, sanitizeAppPreferences } from './app.svelte';

describe('app preferences', () => {
	it('returns defaults for missing or invalid input', () => {
		expect(sanitizeAppPreferences(null)).toEqual(DEFAULT_APP_PREFERENCES);
		expect(sanitizeAppPreferences({ autoRotate: 'yes', minAverageFps: 24 })).toEqual(
			DEFAULT_APP_PREFERENCES
		);
	});

	it('keeps valid preference fields', () => {
		expect(
			sanitizeAppPreferences({
				autoRotate: false,
				autoPerformance: false,
				minAverageFps: 15
			})
		).toEqual({
			autoRotate: false,
			autoPerformance: false,
			minAverageFps: 15
		});
	});
});
