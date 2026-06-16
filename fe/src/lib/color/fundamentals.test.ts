import { describe, it, expect } from 'vitest';
import { interpolateDataset, DEFAULT_OBSERVERS, observerDisplayLabel, observerShortLabel } from './fundamentals';
import {
	DIAGRAMS,
	diagramDisplayLabel,
	diagramShortLabel,
	lmsToMacLeodBoynton,
	macLeodBoynton2DegToXyz,
	xyzToMacLeodBoynton2Deg
} from './diagrams';
import { generateSpectralLocus } from './locus';
import { generateOpponentPlaneGamutBoundary, isXyzInsideGamut, opponentPlaneToXyz } from './diagram-boundary';
import { m3 } from './math';
import type { SpectralDataset } from './types';
import { ciexy2006_2deg_1nm } from './data/ciexy2006_2deg_1nm';
import { ciexy31_1nm } from './data/ciexy31_1nm';
import { ciexyz2006_2deg_1nm } from './data/ciexyz2006_2deg_1nm';
import { ciexyz31_1nm } from './data/ciexyz31_1nm';
import { smb_cc_2deg_1nm } from './data/smb_cc_2deg_1nm';

function sample(dataset: SpectralDataset, nm: number, channel: string): number {
	const [minW] = dataset.wavelengthRange;
	const idx = Math.round((nm - minW) / dataset.step);
	return dataset.channels[channel][idx];
}

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

	it('should constrain spectral loci to the observer dataset range', () => {
		const obs = DEFAULT_OBSERVERS['stockman-sharpe-2deg'];
		const diag = DIAGRAMS['cie1931-xy'];

		const defaultLocus = generateSpectralLocus(obs, diag);
		expect(defaultLocus.points[0].wavelength).toBe(390);
		expect(defaultLocus.points.at(-1)?.wavelength).toBe(830);

		const clampedLocus = generateSpectralLocus(obs, diag, 380, 780, 5);
		expect(clampedLocus.points[0].wavelength).toBe(390);
		expect(clampedLocus.purpleLine[0]).not.toEqual([0, 0]);
	});

	it('should match CIE 1931 xy table from the CIE 1931 XYZ table', () => {
		const diag = DIAGRAMS['cie1931-xy'];
		let maxError = 0;
		for (let nm = 360; nm <= 830; nm += 1) {
			const xyz = [
				sample(ciexyz31_1nm, nm, 'X'),
				sample(ciexyz31_1nm, nm, 'Y'),
				sample(ciexyz31_1nm, nm, 'Z')
			] as [number, number, number];
			const xy = diag.project(xyz, [0, 0, 0]);
			const expected = [sample(ciexy31_1nm, nm, 'x'), sample(ciexy31_1nm, nm, 'y')];
			maxError = Math.max(maxError, Math.hypot(xy[0] - expected[0], xy[1] - expected[1]));
		}
		expect(maxError).toBeLessThan(2e-5);
	});

	it('should match CIE 2006 xF yF table from the physiological XYZF table', () => {
		const diag = DIAGRAMS['cie1931-xy'];
		let maxError = 0;
		for (let nm = 390; nm <= 830; nm += 1) {
			const xyz = [
				sample(ciexyz2006_2deg_1nm, nm, 'X'),
				sample(ciexyz2006_2deg_1nm, nm, 'Y'),
				sample(ciexyz2006_2deg_1nm, nm, 'Z')
			] as [number, number, number];
			const xy = diag.project(xyz, [0, 0, 0]);
			const expected = [sample(ciexy2006_2deg_1nm, nm, 'x'), sample(ciexy2006_2deg_1nm, nm, 'y')];
			maxError = Math.max(maxError, Math.hypot(xy[0] - expected[0], xy[1] - expected[1]));
		}
		expect(maxError).toBeLessThan(8e-6);
	});

	it('should use the bundled MacLeod-Boynton table for spectral locus coordinates', () => {
		const obs = DEFAULT_OBSERVERS['stockman-sharpe-2deg'];
		const diag = DIAGRAMS['macleod-boynton'];
		const locus = generateSpectralLocus(obs, diag, 390, 830, 5);

		for (const point of locus.points) {
			const l = sample(smb_cc_2deg_1nm, point.wavelength, 'Mb1');
			const s = sample(smb_cc_2deg_1nm, point.wavelength, 'Mb3');
			expect(point.chromaticity[0]).toBeCloseTo(l, 8);
			expect(point.chromaticity[1]).toBeCloseTo(s, 8);
		}
	});

	it('should calibrate MacLeod-Boynton arbitrary LMS projection to the bundled spectral table', () => {
		const obs = DEFAULT_OBSERVERS['stockman-sharpe-2deg'];
		const diag = DIAGRAMS['macleod-boynton'];
		let maxL = 0;
		let maxS = 0;

		for (let nm = 390; nm <= 830; nm += 5) {
			const lms = obs.evaluateLms(nm);
			const projected = diag.project(obs.evaluateXyz(nm), lms);
			const direct = lmsToMacLeodBoynton(lms);
			const fromXyz = xyzToMacLeodBoynton2Deg(obs.evaluateXyz(nm));
			const expected = [sample(smb_cc_2deg_1nm, nm, 'Mb1'), sample(smb_cc_2deg_1nm, nm, 'Mb3')];
			expect(projected).toEqual(fromXyz);
			expect(fromXyz[0]).toBeCloseTo(direct[0], 12);
			expect(fromXyz[1]).toBeCloseTo(direct[1], 12);
			maxL = Math.max(maxL, Math.abs(projected[0] - expected[0]));
			if (expected[1] > 1e-5) maxS = Math.max(maxS, Math.abs(projected[1] - expected[1]));
		}

		expect(maxL).toBeLessThan(2e-6);
		expect(maxS).toBeLessThan(4e-6);
	});

	it('should keep MacLeod-Boynton projection on its 2deg source basis regardless of active observer LMS', () => {
		const diag = DIAGRAMS['macleod-boynton'];
		const xyz = DEFAULT_OBSERVERS['stockman-sharpe-2deg'].evaluateXyz(482);
		const activeObserverLms = m3.mulV(DEFAULT_OBSERVERS['ciexyz31-2deg'].toLmsMatrix, xyz);
		const projected = diag.project(xyz, activeObserverLms);
		const expected = xyzToMacLeodBoynton2Deg(xyz);

		expect(projected).toEqual(expected);
		expect(projected[0]).toBeGreaterThan(0.5);
		expect(projected[0]).toBeLessThan(0.7);
		expect(projected[1]).toBeGreaterThan(0.05);
		expect(projected[1]).toBeLessThan(0.1);
	});

	it('should unproject MacLeod-Boynton coordinates back to the same chromatic direction', () => {
		for (const nm of [430, 482, 520, 555]) {
			const expected = [
				sample(smb_cc_2deg_1nm, nm, 'Mb1'),
				sample(smb_cc_2deg_1nm, nm, 'Mb3')
			];
			const xyz = macLeodBoynton2DegToXyz(expected[0], expected[1]);
			expect(xyz).not.toBeNull();
			const projected = xyzToMacLeodBoynton2Deg(xyz!);
			expect(projected[0]).toBeCloseTo(expected[0], 10);
			expect(projected[1]).toBeCloseTo(expected[1], 10);
		}
	});

	it('should generate fixed-lightness opponent-plane gamut boundaries inside the target gamut', () => {
		for (const diagramKey of ['oklab-ab', 'cielab-ab']) {
			const boundary = generateOpponentPlaneGamutBoundary(diagramKey, 'srgb', 48);
			expect(boundary.length).toBe(48);
			for (const [x, y] of boundary) {
				const xyz = opponentPlaneToXyz(diagramKey, x, y);
				expect(xyz).not.toBeNull();
				expect(isXyzInsideGamut(xyz!, 'srgb')).toBe(true);
			}
			const maxRadius = Math.max(...boundary.map(([x, y]) => Math.hypot(x, y)));
			expect(maxRadius).toBeGreaterThan(diagramKey === 'oklab-ab' ? 0.08 : 40);
		}
	});

	it('should label chromaticity diagrams according to the selected observer', () => {
		expect(diagramDisplayLabel('cie1931-xy', 'ciexyz31-2deg')).toBe('CIE 1931 2° xy');
		expect(diagramDisplayLabel('cie1931-xy', 'stockman-sharpe-2deg')).toBe('CIE 2006 2° xF yF');
		expect(diagramDisplayLabel('cie1931-xy', 'stockman-sharpe-10deg')).toBe('CIE 2006 10° xF yF');
		expect(diagramDisplayLabel('cie1931-xy', 'ciexyz64-10deg')).toBe('CIE 1964 10° x10 y10');
		expect(diagramDisplayLabel('cie1976-upvp', 'stockman-sharpe-2deg')).toContain('CIE 2006 2° observer');
		expect(diagramDisplayLabel('macleod-boynton', 'stockman-sharpe-2deg')).toBe('MacLeod-Boynton 2° (l, s)');
		expect(diagramShortLabel('oklab-ab')).toBe('a b');
		expect(diagramShortLabel('cielab-ab')).toBe('a*b*');
	});

	it('should label observer datasets for the cone fundamentals panel', () => {
		expect(observerDisplayLabel('stockman-sharpe-2deg')).toBe('Stockman & Sharpe (2000) 2° Cone Fundamentals');
		expect(observerDisplayLabel('ciexyz31-2deg')).toBe('CIE 1931 2° XYZ CMFs');
		expect(observerShortLabel('stockman-sharpe-2deg')).toBe('Stockman & Sharpe (2000) 2°');
		expect(observerShortLabel('ciexyz31-2deg')).toBe('CIE 1931 2°');
		expect(observerShortLabel('ciexyzjv-5nm')).toBe('Judd-Vos 1978 2°');
	});
});
