import { describe, expect, it } from 'vitest';

import {
	inSrgbGamut,
	projectOklabMaxChroma,
	projectOklabToBoundary,
	type SurfaceProjectionMethod
} from './boundary-project';

import type { Vec3 } from './math';

const finite = (rgb: Vec3) => rgb.every((value) => Number.isFinite(value));
const boundaryish = (rgb: Vec3) => Math.min(...rgb.map((value) => Math.min(Math.abs(value), Math.abs(1 - value))));

describe('Oklab boundary projection', () => {
	it('pushes an in-gamut chromatic color to the sRGB boundary at fixed Oklab lightness', () => {
		const projected = projectOklabMaxChroma([0.25, 0.08, 0.02]);
		expect(finite(projected)).toBe(true);
		expect(inSrgbGamut(projected, 1e-4)).toBe(true);
		expect(boundaryish(projected)).toBeLessThan(2e-3);
	});

	it('handles neutral colors without inventing a hue', () => {
		const neutral: Vec3 = [0.25, 0.25, 0.25];
		expect(projectOklabMaxChroma(neutral)).toEqual(neutral);
		expect(projectOklabToBoundary(neutral, 'adaptive-0.5')).toEqual(neutral);
	});

	it('returns finite boundary colors for every projection method', () => {
		const methods: SurfaceProjectionMethod[] = [
			'preserve-chroma',
			'project-0.5',
			'project-cusp',
			'adaptive-0.5',
			'adaptive-cusp'
		];
		for (const method of methods) {
			const projected = projectOklabToBoundary([0.3, 0.02, 0.9], method);
			expect(finite(projected), method).toBe(true);
			expect(inSrgbGamut(projected, 1e-4), method).toBe(true);
			expect(boundaryish(projected), method).toBeLessThan(2e-3);
		}
	});
});
