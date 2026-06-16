import { describe, it, expect } from 'vitest';
import { interpolateDataset, DEFAULT_OBSERVERS } from './fundamentals';
import { DIAGRAMS } from './diagrams';
import { generateSpectralLocus } from './locus';

describe('fundamentals & registries', () => {
	it('should interpolate dataset values linearly', () => {
		const obs = DEFAULT_OBSERVERS['stockman-sharpe-2deg'];
		
		// Exact sample at 390 nm (min boundary)
		const lms390 = obs.evaluateLms(390);
		expect(lms390[0]).toBeCloseTo(4.15003e-4, 8);
		expect(lms390[1]).toBeCloseTo(3.68349e-4, 8);
		expect(lms390[2]).toBeCloseTo(9.54729e-3, 8);

		// Interpolated sample between 390 and 391 nm (e.g., 390.5)
		const lms390_5 = obs.evaluateLms(390.5);
		const expectedL = (4.15003e-4 + 5.02650e-4) / 2;
		expect(lms390_5[0]).toBeCloseTo(expectedL, 8);
	});

	it('should clamp values to 0.0 outside the visible range boundaries', () => {
		const obs = DEFAULT_OBSERVERS['stockman-sharpe-2deg'];
		
		// Far below min wavelength (390 nm)
		const lms350 = obs.evaluateLms(350);
		expect(lms350).toEqual([0.0, 0.0, 0.0]);

		// Far above max wavelength (830 nm)
		const lms900 = obs.evaluateLms(900);
		expect(lms900).toEqual([0.0, 0.0, 0.0]);
	});

	it('should match the CIE 2006 2deg CMFs matrix mapping', () => {
		const obs = DEFAULT_OBSERVERS['stockman-sharpe-2deg'];
		const xyz = obs.evaluateXyz(500); // 500 nm CMF
		
		// Standard CIE 2006 2deg values at 500 nm:
		// X = ~0.0049, Y = ~0.323, Z = ~0.272
		expect(xyz[0]).toBeGreaterThan(0.0);
		expect(xyz[1]).toBeGreaterThan(0.2);
		expect(xyz[2]).toBeGreaterThan(0.2);
	});

	it('should project coordinates onto different chromaticity diagrams without NaN', () => {
		const obs = DEFAULT_OBSERVERS['stockman-sharpe-2deg'];
		const lms = obs.evaluateLms(555);
		const xyz = obs.evaluateXyz(555);

		for (const diag of Object.values(DIAGRAMS)) {
			const coords = diag.project(xyz, lms);
			expect(Number.isNaN(coords[0])).toBe(false);
			expect(Number.isNaN(coords[1])).toBe(false);
		}
	});

	it('should generate a closed spectral locus with a purple line', () => {
		const obs = DEFAULT_OBSERVERS['stockman-sharpe-2deg'];
		const diag = DIAGRAMS['cie1931-xy'];
		
		const locus = generateSpectralLocus(obs, diag, 380, 780, 5);
		
		expect(locus.points.length).toBeGreaterThan(0);
		expect(locus.purpleLine[0]).toEqual(locus.points[0].chromaticity);
		expect(locus.purpleLine[1]).toEqual(locus.points[locus.points.length - 1].chromaticity);
		
		// Values at red extreme (780 nm)
		const redPt = locus.purpleLine[1];
		expect(redPt[0]).toBeGreaterThan(0.6); // x > 0.6 for red
		expect(redPt[1]).toBeLessThan(0.4);    // y < 0.4
	});
});
