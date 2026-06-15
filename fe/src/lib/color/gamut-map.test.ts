import { describe, expect, it } from 'vitest';

import { inSrgbGamut } from './boundary-project';
import { mapToGamut } from './gamut-map';

import type { Vec3 } from './math';

const finite = (rgb: Vec3) => rgb.every((value) => Number.isFinite(value));

describe('gamut map params', () => {
	it('keeps the adaptive default stable while allowing alpha to change output', () => {
		const sample: Vec3 = [1.25, -0.05, 0.72];
		const implicitDefault = mapToGamut(sample, 'adaptive-0.5');
		const explicitDefault = mapToGamut(sample, 'adaptive-0.5', { alpha: 0.05 });
		const strongerCompression = mapToGamut(sample, 'adaptive-0.5', { alpha: 5 });

		expect(implicitDefault[0]).toBeCloseTo(explicitDefault[0], 12);
		expect(implicitDefault[1]).toBeCloseTo(explicitDefault[1], 12);
		expect(implicitDefault[2]).toBeCloseTo(explicitDefault[2], 12);
		expect(finite(strongerCompression)).toBe(true);
		expect(inSrgbGamut(strongerCompression, 1e-4)).toBe(true);

		const delta = Math.max(
			Math.abs(implicitDefault[0] - strongerCompression[0]),
			Math.abs(implicitDefault[1] - strongerCompression[1]),
			Math.abs(implicitDefault[2] - strongerCompression[2])
		);
		expect(delta).toBeGreaterThan(1e-3);
	});
});
